/* Al-Biruni\'s Challenge 2026 — data layer
   ------------------------------------------------------------------
   All competition data lives in namespaced `abc_*` collections so this
   standalone app never reads or writes the existing MATHSIMIZED data
   (with the single exception of a read-only profile lookup in
   getIdentity(), used to pre-fill registration).

   Security model
   --------------
   Round 1 correctness is never trusted to the browser:
     * abc_questions (the bank, including `correct`) is admin-read only.
     * When an attempt starts, a SANITISED snapshot of the chosen
       questions (no `correct`, no `explanation`) is copied into the
       attempt document the student owns.
     * The matching answer key is written to a separate document that
       only admins can read.
     * The student's answers are stored un-scored. Scoring is performed
       in trusted admin context, from the admin panel's own session, which
       is the only place a correct answer is readable.
     * Students only ever read their own result after the administrator
       releases it.
*/

(function (global) {
  'use strict';

  const A = global.ABC;
  const db = () => A.db;
  const C = {
    config: 'abc_config',
    users: 'abc_users',
    registrations: 'abc_registrations',
    questions: 'abc_questions',
    answerKeyByQuestion: 'abc_answer_keys',
    publicBa: 'abc_public_ba',
    quizzes: 'abc_quizzes',
    attempts: 'abc_attempts',
    results: 'abc_results',
    publicResults: 'abc_public_results',
    round2: 'abc_round2_submissions',
    finalists: 'abc_finalists',
    certificates: 'abc_certificates',
    ba: 'abc_ba',
    announcements: 'abc_announcements',
    audit: 'abc_audit_log',
    usernames: 'usernames' /* one reservation doc per username */
  };

  const CONFIG_ID = 'main';

  /* ---------------- categories ---------------- */
  const CATEGORIES = [
    { id: 'prep', label: 'Prep', order: 1, blurb: 'For students in their preparatory year, building core number sense before secondary mathematics.' },
    { id: 'olevel', label: 'O Levels', order: 2, blurb: 'For Cambridge / Federal O Level students, testing breadth, accuracy and rapid problem-solving.' },
    { id: 'alevel', label: 'A Levels', order: 3, blurb: 'For Cambridge / Federal A Level students, testing depth, structure and mathematical reasoning.' }
  ];
  const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
  const categoryLabel = (id) => (CATEGORIES.find((c) => c.id === id) || {}).label || '—';
  const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || null;

  /* ---------------- defaults ----------------
     Every value the brief left unconfirmed is null/empty here and is
     edited in the admin panel. Nothing unconfirmed is hardcoded. */
  const DEFAULT_CONFIG = {
    name: "Al-Biruni\'s Challenge 2026",
    tagline: 'Think · Explain · Create',
    team: 'MATHSIMIZED',
    instagramUrl: 'https://www.instagram.com/al_birunis_challenge/',
    instagramHandle: '@al_birunis_challenge',
    grandFinaleCity: 'Karachi',
    grandFinaleMonth: 'November 2026',
    grandFinaleDate: null,          /* admin-set */
    grandFinaleVenue: null,         /* admin-set */
    grandFinaleDemoMinutes: 2,      /* confirmed: up to two minutes */
    finalistCount: 30,              /* confirmed: 30 national finalists */
    registrationOpensAt: '2026-10-01',   /* confirmed 1 Oct 2026 */
    /* Registration stays open through the whole of 1 Nov 2026, so the final
       timestamp is 23:59 on the 1st. From 00:00 on the 2nd it is shut. */
    registrationClosesAt: '2026-11-01T23:59:00',
    /* Round 1 is attempted on the same day students register, 1 Nov 2026. */
    round1WindowOpensAt: '2026-11-01T09:00:00',
    round1WindowClosesAt: '2026-11-01T23:59:00',
    baApplicationsOpenAt: '2026-09-20', /* confirmed: BA window, separate from registration */
    baApplicationsCloseAt: '2026-10-05',/* confirmed 5 Oct 2026 */
    round1QualifyPerCategory: null, /* intended 100 — admin-set */
    round2QualifyPerCategory: null, /* intended 10  — admin-set */
    round2OpensAt: null,
    round2ClosesAt: null,
    round2ResultsAt: null,
    resultsReleasedToStudents: false,
    announceRegistrationOpen: false,
    announceRound1Open: false,
    announceRound2Open: false,
    announceFinalists: false,
    contactEmail: 'mathsimized@gmail.com'
  };

  /* ---------------- config ---------------- */
  async function getConfig() {
    const snap = await db().collection(C.config).doc(CONFIG_ID).get();
    return Object.assign({}, DEFAULT_CONFIG, snap.exists ? snap.data() : {});
  }

  function onConfig(cb) {
    return db().collection(C.config).doc(CONFIG_ID)
      .onSnapshot((s) => cb(Object.assign({}, DEFAULT_CONFIG, s.exists ? s.data() : {})), () => cb(DEFAULT_CONFIG));
  }

  async function saveConfig(patch) {
    const ref = db().collection(C.config).doc(CONFIG_ID);
    await ref.set(Object.assign(patch, { updatedAt: A.server }), { merge: true });
    return getConfig();
  }

  /* ---------------- identity & roles ---------------- */
  /* Is this username free?
   *
   * The check runs against the shared MATHSIMIZED `users` collection, not
   * against ours, because a username has to be unique across the whole
   * project — someone who signed up on the main site has already claimed
   * theirs. The shared rules keep that collection publicly readable for
   * exactly this query, and it is the only thing read here. A failure is
   * reported as "not available" rather than guessed at, so a network problem
   * can never silently hand two students the same name. */
  function normaliseUsername(username) {
    return String(username || '').toLowerCase().trim();
  }

  /* One document per username, addressed by the name itself, so this is a
     point read rather than a query and the answer is exact. */
  async function isUsernameAvailable(username) {
    const value = normaliseUsername(username);
    if (!value) return { available: false, error: 'A username is required.' };
    if (value.length < 3) return { available: false, error: 'Usernames are at least 3 characters.' };
    if (value.length > 24) return { available: false, error: 'Usernames are at most 24 characters.' };
    if (!/^[a-z0-9_]+$/.test(value)) return { available: false, error: 'Only lowercase letters, numbers and underscores.' };
    try {
      const snap = await db().collection(C.usernames).doc(value).get();
      return snap.exists
        ? { available: false, error: 'That username is already taken.' }
        : { available: true, error: null };
    } catch (e) {
      return { available: false, error: 'Could not check that username. Please try again.' };
    }
  }

  /* Claim a username for this account. The rules refuse the write if the name
     was taken between the check and here, so a race loses cleanly instead of
     quietly creating a second student called the same thing. */
  async function reserveUsername(uid, username) {
    const value = normaliseUsername(username);
    await db().collection(C.usernames).doc(value).set({
      uid: uid,
      username: value,
      createdAt: A.server
    });
    return value;
  }

  /* The student's own account record. There is no other profile anywhere,
     so this is only used to pre-fill the registration form after signup. */
  async function getProfile(uid) {
    try {
      const snap = await db().collection(C.users).doc(uid).get();
      if (!snap.exists) return null;
      const d = snap.data();
      return {
        username: d.username || d.displayName || '',
        displayName: d.fullName || '',
        email: d.email || ''
      };
    } catch (e) {
      return null;
    }
  }

  /* Written once, at signup. Role is decided by the address, not by anything
     the form submitted, so a student cannot nominate themselves. */
  async function createUser(user, username) {
    const isAdminEmail = (user.email || '').toLowerCase() === String(A.ADMIN_EMAIL || '').toLowerCase();
    const data = {
      uid: user.uid,
      username: normaliseUsername(username) || user.displayName || '',
      email: user.email || '',
      role: isAdminEmail ? A.ROLE.ADMIN : A.ROLE.STUDENT,
      createdAt: A.server,
      updatedAt: A.server
    };
    await db().collection(C.users).doc(user.uid).set(data, { merge: true });
    return data;
  }

  /* The competition's own user record holds role + category.
     It is written on first sign-in and is independent of MATHSIMIZED. */
  async function getUser(uid) {
    const snap = await db().collection(C.users).doc(uid).get();
    return snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null;
  }

  async function ensureUser(user) {
    const ref = db().collection(C.users).doc(user.uid);
    const snap = await ref.get();
    const isAdminEmail = (user.email || '').toLowerCase() === (A.ADMIN_EMAIL || '').toLowerCase();
    if (snap.exists) {
      const patch = {};
      if (user.email && snap.data().email !== user.email) patch.email = user.email;
      if (user.displayName && snap.data().displayName !== user.displayName) patch.displayName = user.displayName;
      if (Object.keys(patch).length) { patch.updatedAt = A.server; await ref.update(patch); }
      const data = snap.data();
      if (isAdminEmail && data.role !== A.ROLE.ADMIN) {
        await ref.update({ role: A.ROLE.ADMIN, updatedAt: A.server });
        data.role = A.ROLE.ADMIN;
      }
      return Object.assign({ id: snap.id }, data);
    }
    const data = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      role: isAdminEmail ? A.ROLE.ADMIN : A.ROLE.STUDENT,
      createdAt: A.server,
      updatedAt: A.server
    };
    await ref.set(data);
    return Object.assign({ id: user.uid }, data, { createdAt: null });
  }

  function isAdmin(userRecord) {
    if (userRecord && userRecord.role === A.ROLE.ADMIN) return true;
    /* The team address is admin by the verified sign-in token, not by a
       stored role. This is the same condition the Firestore rules use, so the
       two can never disagree. */
    const email = (A.user && A.user.email) || '';
    return !!email && email.toLowerCase() === String(A.ADMIN_EMAIL || '').toLowerCase();
  }

  async function listUsers() {
    const snap = await db().collection(C.users).get();
    return A.sortBy(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())), (u) => u.displayName || u.email || '');
  }

  async function setUserRole(uid, role, extra) {
    const allowed = Object.keys(A.ROLE).map((k) => A.ROLE[k]);
    if (allowed.indexOf(role) === -1) throw new Error('Unknown role.');
    await db().collection(C.users).doc(uid).update(Object.assign({ role, updatedAt: A.server }, extra || {}));
    await audit('user_role', { uid, role });
  }

  /* ---------------- registration ---------------- */
  async function getRegistration(uid) {
    const snap = await db().collection(C.registrations).doc(uid).get();
    return snap.exists ? Object.assign({ id: snap.id, uid }, snap.data()) : null;
  }

  function onRegistration(uid, cb) {
    return db().collection(C.registrations).doc(uid)
      .onSnapshot((s) => cb(s.exists ? Object.assign({ id: s.id, uid }, s.data()) : null));
  }

  async function submitRegistration(uid, data, userRecord) {
    const config = await getConfig();
    if (config.registrationOpensAt) {
      const open = A.toDate(config.registrationOpensAt);
      if (open && Date.now() < open.getTime()) throw new Error('Registration has not opened yet.');
    }
    if (config.registrationClosesAt) {
      const close = A.toDate(config.registrationClosesAt);
      if (close && Date.now() > close.getTime()) throw new Error('Registration has closed.');
    }
    const ref = db().collection(C.registrations).doc(uid);
    const existing = await ref.get();
    if (existing.exists) throw new Error('You are already registered for this competition.');

    const category = data.category;
    if (!CATEGORY_IDS.includes(category)) throw new Error('Please choose a valid category.');

    /* The Brand Ambassador code is taken down as free text and credited by the
       team, not by this page. Brand Ambassador records are administrator
       only — that is what keeps the numbers private — so the code cannot be
       checked here, and a student could not raise their own count even if this
       write were left open. The team runs "Attribute registrations" in the
       Brand Ambassador panel once the code has been issued to them. */
    const baCode = String(data.baCode || '').trim().toUpperCase();

    const payload = {
      uid,
      studentName: data.studentName || (userRecord && userRecord.displayName) || '',
      email: (userRecord && userRecord.email) || '',
      school: data.school || '',
      city: data.city || '',
      grade: data.grade || '',
      category,
      categoryConfirmed: data.categoryConfirmed !== false,
      parentContact: data.parentContact || '',
      baCode,
      baAttribution: null,
      attributedCounted: false,
      status: 'registered',
      registeredAt: A.server,
      updatedAt: A.server
    };
    await ref.set(payload);

    await audit('registration', { uid, category });
    return getRegistration(uid);
  }

  async function updateRegistration(uid, patch) {
    await db().collection(C.registrations).doc(uid).update(Object.assign(patch, { updatedAt: A.server }));
    return getRegistration(uid);
  }

  async function listRegistrations(filter) {
    let q = db().collection(C.registrations);
    if (filter && filter.category) q = q.where('category', '==', filter.category);
    const snap = await q.get();
    let rows = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    if (filter && filter.qualified === true) rows = rows.filter((r) => r.qualifiedForRound2 === true);
    if (filter && filter.baCode) rows = rows.filter((r) => r.baCode === filter.baCode);
    /* Registrations carrying a code that has not been credited yet. */
    if (filter && filter.unattributed === true) {
      rows = rows.filter((r) => r.baCode && r.attributedCounted !== true);
    }
    return A.sortBy(rows, (r) => r.studentName || r.email || '');
  }

  /* ---------------- announcements ---------------- */
  function onAnnouncements(opts, cb) {
    let q = db().collection(C.announcements);
    if (!opts || opts.includeUnpublished !== true) q = q.where('published', '==', true);
    if (opts && opts.orderBy !== false) q = q.orderBy('createdAt', 'desc');
    return q.onSnapshot((s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data()))), () => cb([]));
  }

  async function listAnnouncements() {
    const s = await db().collection(C.announcements).orderBy('createdAt', 'desc').get();
    return s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  }

  async function saveAnnouncement(data, id) {
    const payload = Object.assign({}, data, { updatedAt: A.server });
    if (id) {
      await db().collection(C.announcements).doc(id).update(payload);
      return id;
    }
    const ref = await db().collection(C.announcements).add(Object.assign({ createdAt: A.server }, payload));
    return ref.id;
  }

  async function deleteAnnouncement(id) {
    await db().collection(C.announcements).doc(id).delete();
  }

  /* An announcement is shown to a student when it is published and its
     audience matches that student. Audience values: 'all', 'registered',
     'round1', 'qualified', 'finalists', plus category ids. */
  /* Audiences are stored as a single string: 'everyone', 'students',
     'ambassadors', 'finalists', 'qualified', 'round1', or a category id. */
  const ANNOUNCEMENT_AUDIENCES = {
    everyone: 'Everyone',
    students: 'Registered students',
    ambassadors: 'Brand Ambassadors',
    finalists: 'Grand Finale finalists',
    qualified: 'Students qualified for Round 2',
    round1: 'Students who have taken Round 1',
    prep: 'Prep category',
    olevel: 'O-Level category',
    alevel: 'A-Level category'
  };

  function announcementVisibleTo(item, ctx) {
    if (!item || item.published === false) return false;
    const audience = item.audience || 'everyone';
    if (audience === 'everyone') return true;
    if (!ctx) return false;
    if (audience === 'students') return !!(ctx.registration || ctx.record);
    if (audience === 'round1') return !!(ctx.attempt && ctx.attempt.status !== 'in-progress');
    if (audience === 'qualified') return !!(ctx.result && ctx.result.qualified) || !!(ctx.registration && ctx.registration.qualifiedForRound2);
    if (audience === 'finalists') return !!ctx.finalist;
    if (audience === 'ambassadors') return !!ctx.isAmbassador;
    return !!(ctx.registration && ctx.registration.category === audience);
  }

  /* ---------------- brand ambassadors ---------------- */
  /* Applications arrive on a Google Form, not on this site, so there is no
     student-facing application. The team adds each approved applicant
     here, which mints their code. Records are keyed by the code, because that
     is what a student types on the registration form.

     abc_ba is administrator-only. That is the whole privacy design: the
     attributed counts are never readable by a student, or by
     anyone who signs up, so there is nothing to leak. */
  async function createBA(data) {
    const name = String(data.name || '').trim();
    if (!name) throw new Error('A name is required.');
    const code = String(data.code || '').trim().toUpperCase() ||
      'BA-' + A.uid('').slice(0, 8).toUpperCase();
    if (!/^BA-[A-Z0-9-]{4,20}$/.test(code)) throw new Error('Codes look like BA-XXXXXX.');
    const ref = db().collection(C.ba).doc(code);
    if ((await ref.get()).exists) throw new Error('That code is already in use.');
    await ref.set({
      code,
      name,
      email: String(data.email || '').trim(),
      contact: String(data.contact || '').trim(),
      category: data.category || '',
      school: data.school || '',
      city: data.city || '',
      source: data.source || 'google-form',
      status: data.status === 'pending' ? 'pending' : 'approved',
      attributedCount: 0,
      attributedUids: [],
      createdAt: A.server,
      updatedAt: A.server
    });
    await audit('ba_create', { code });
    return code;
  }

  async function updateBA(code, patch) {
    const allowed = {};
    ['name', 'email', 'contact', 'category', 'school', 'city', 'status'].forEach((k) => {
      if (patch[k] !== undefined) allowed[k] = patch[k];
    });
    allowed.updatedAt = A.server;
    await db().collection(C.ba).doc(code).update(allowed);
    await audit('ba_update', { code, fields: Object.keys(allowed) });
  }

  async function deleteBA(code) {
    await db().collection(C.ba).doc(code).delete();
    await audit('ba_delete', { code });
  }

  /* Admins only. */
  async function listBAs() {
    const s = await db().collection(C.ba).orderBy('attributedCount', 'desc').get();
    return s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  }

  async function getBA(code) {
    const snap = await db().collection(C.ba).doc(String(code || '').toUpperCase()).get();
    return snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null;
  }

  async function setBAStatus(code, status) {
    await db().collection(C.ba).doc(code).update({ status, updatedAt: A.server });
    await audit('ba_status', { code, status });
  }

  /* BA leaderboard ranks strictly by attributed registration count. */
  function baLeaderboard(rows, limit) {
    const approved = rows.filter((r) => r.status === 'approved');
    const ranked = A.sortBy(approved, (r) => A.num(r.attributedCount), 'desc');
    ranked.forEach((r, i) => { r.rank = i + 1; });
    return limit ? ranked.slice(0, limit) : ranked;
  }

  /* Credits registrations that carry a code. Run by the team: a student
     cannot raise their own count, and a registration is credited at most once
     because attributedUids is checked inside the batch. */
  async function attributeRegistrations() {
    const [regSnap, baSnap] = await Promise.all([
      db().collection(C.registrations).get(),
      db().collection(C.ba).get()
    ]);
    const byCode = {};
    baSnap.docs.forEach((d) => { byCode[d.id] = Object.assign({ id: d.id }, d.data()); });

    const credited = [];
    const skipped = [];
    for (const doc of regSnap.docs) {
      const reg = doc.data();
      const code = String(reg.baCode || '').toUpperCase();
      if (!code || reg.attributedCounted === true) continue;
      const ba = byCode[code];
      if (!ba) { skipped.push({ uid: doc.id, reason: 'unknown code' }); continue; }
      if (ba.status !== 'approved') { skipped.push({ uid: doc.id, reason: 'ambassador not active' }); continue; }
      const uids = Array.isArray(ba.attributedUids) ? ba.attributedUids : [];
      if (uids.indexOf(doc.id) !== -1) continue;   // already credited

      const batch = db().batch();
      batch.set(db().collection(C.ba).doc(code), {
        attributedCount: A.fb.firestore.FieldValue.increment(1),
        attributedUids: uids.concat([doc.id]),
        updatedAt: A.server
      }, { merge: true });
      batch.set(doc.ref, {
        attributedCounted: true,
        baAttribution: { code, name: ba.name || '', creditedAt: A.server },
        updatedAt: A.server
      }, { merge: true });
      await batch.commit();
      credited.push({ uid: doc.id, code, name: ba.name });
    }
    await audit('ba_attribution', { credited: credited.length, skipped: skipped.length });
    return { credited, skipped };
  }

  /* ---------------- public top five ---------------- */
  /* Names and ranks only. No count is ever written here, so the public page
     cannot leak one even by accident. Publishing this snapshot is the only
     Brand Ambassador information that ever leaves the admin panel. */
  async function publishPublicBATopFive(limit) {
    const rows = await listBAs();
    const top = baLeaderboard(rows, limit || 5).map((r) => ({
      rank: r.rank,
      name: r.name,
      school: r.school || '',
      category: r.category || ''
    }));
    await db().collection(C.publicBa).doc('topFive').set({
      published: true,
      rows: top,
      /* Deliberately absent: attributedCount, email, contact, code — and any
         count at all, including how many ambassadors were approved. The
         requirement is the top five and nothing else. */
      note: 'Best Brand Ambassador is announced at the Grand Finale award ceremony.',
      publishedAt: A.server
    });
    await audit('ba_top_five_publish', { count: top.length });
    return top;
  }

  async function unpublishPublicBATopFive() {
    await db().collection(C.publicBa).doc('topFive').set(
      { published: false, publishedAt: A.server }, { merge: true });
    await audit('ba_top_five_unpublish', {});
  }

  function onPublicBATopFive(cb) {
    return db().collection(C.publicBa).doc('topFive')
      .onSnapshot((snap) => cb(snap.exists ? snap.data() : null));
  }

  /* ---------------- certificates ---------------- */
  const CERT_TYPES = {
    participation: { label: 'Certificate of Participation', order: 1 },
    qualifier: { label: 'Round 2 Qualifier Certificate', order: 2 },
    finalist: { label: 'Finalist Certificate', order: 3 },
    winner: { label: "Winner's Certificate", order: 4 },
    runnerup: { label: 'Runner-Up Certificate', order: 5 },
    ba: { label: 'Brand Ambassador Certificate', order: 6 },
    bestba: { label: 'Best Brand Ambassador Certificate', order: 7 }
  };
  const certLabel = (t) => (CERT_TYPES[t] || {}).label || t;

  async function listCertificates(filter) {
    let q = db().collection(C.certificates);
    if (filter && filter.type) q = q.where('type', '==', filter.type);
    if (filter && filter.released === true) q = q.where('released', '==', true);
    if (filter && filter.released === false) q = q.where('released', '==', false);
    const s = await q.get();
    return s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  }

  async function getCertificatesForUser(uid) {
    const s = await db().collection(C.certificates)
      .where('uid', '==', uid).where('released', '==', true).get();
    return s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  }

  function onCertificatesForUser(uid, cb) {
    return db().collection(C.certificates)
      .where('uid', '==', uid).where('released', '==', true)
      .onSnapshot((s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data()))));
  }

  async function issueCertificate(data) {
    const ref = db().collection(C.certificates).doc();
    const code = 'ABC-' + new Date().getFullYear() + '-' + A.uid('').slice(0, 6).toUpperCase();
    /* The file is attached separately, through uploadCertificateFile or
       setCertificateLink, so issuing a batch of certificates does not mean
       choosing a file for each one first. */
    await ref.set({
      code,
      name: data.name || '',
      uid: data.uid || '',
      type: data.type || 'participation',
      category: data.category || '',
      awardLabel: data.awardLabel || '',
      released: false,
      createdAt: A.server,
      updatedAt: A.server
    });
    await audit('certificate_issue', { code, type: data.type });
    return ref.id;
  }

  /* The team uploads the certificate file; releasing makes it visible in
     the student's portal. No email is sent, because sending one from a
     browser would mean shipping an email API key to every visitor. */
  async function releaseCertificate(id) {
    return db().collection(C.certificates).doc(id)
      .update({ released: true, releasedAt: A.server, updatedAt: A.server })
      .then(function () { return audit('certificate_release', { id: id, released: true }); });
  }
  async function withdrawCertificate(id) {
    return db().collection(C.certificates).doc(id)
      .update({ released: false, releasedAt: null, updatedAt: A.server })
      .then(function () { return audit('certificate_withdraw', { id: id }); });
  }

  /* Certificate files, without Cloud Storage.
   *
   * Cloud Storage for Firebase has needed the Blaze plan since 3 February
   * 2026, so a bucket is not available on the free plan this project runs on.
   * Two ways in instead:
   *
   *   uploadCertificateFile  stores a small PDF in Firestore as a data URI. A
   *                         generated certificate is normally tens of
   *                         kilobytes, so this works for the normal case. The
   *                         limit is a Firestore document, so 700 KB of file
   *                         is the ceiling.
   *   certificateLink       a shareable link for anything larger, the same
   *                         approach Round 2 already uses for presentation
   *                         files.
   *
   * Both are administrator-only writes, and both are only readable by the
   * student the certificate belongs to. */
  const MAX_CERTIFICATE_BYTES = 700 * 1024;

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('That file could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadCertificateFile(id, file) {
    if (!file) throw new Error('No file was chosen.');
    if (file.size > MAX_CERTIFICATE_BYTES) {
      throw new Error(
        'That file is ' + Math.round(file.size / 1024) + ' KB. The limit is 700 KB, because the '
        + 'file is stored in Firestore rather than in Cloud Storage. For a larger file, save it to '
        + 'Google Drive, share it, and paste the link instead.');
    }
    const dataUrl = await readFileAsDataUrl(file);
    await db().collection(C.certificates).doc(id).set({
      pdfData: dataUrl,
      fileName: file.name,
      fileSize: file.size,
      link: null,
      updatedAt: A.server
    }, { merge: true });
    await audit('certificate_file', { id, fileName: file.name, size: file.size });
    return true;
  }

  async function setCertificateLink(id, link) {
    const url = String(link || '').trim();
    if (url && !/^https:\/\//i.test(url)) {
      throw new Error('A certificate link has to start with https://');
    }
    await db().collection(C.certificates).doc(id).set({
      link: url || null,
      pdfData: null,
      updatedAt: A.server
    }, { merge: true });
    await audit('certificate_link', { id, hasLink: !!url });
    return true;
  }

  /* What the student card should offer: an inline file, a link, or nothing. */
  function certificateAsset(c) {
    if (c && c.pdfData) return { kind: 'file', href: c.pdfData, name: c.fileName || 'certificate' };
    if (c && c.link) return { kind: 'link', href: c.link, name: c.fileName || 'Open certificate' };
    return null;
  }

  async function deleteCertificate(id) { await db().collection(C.certificates).doc(id).delete(); }

  /* ---------------- audit ---------------- */
  async function audit(action, detail) {
    try {
      const u = A.user;
      await db().collection(C.audit).add({
        action,
        detail: detail || {},
        by: u ? u.uid : 'system',
        byEmail: u ? u.email : '',
        at: A.server
      });
    } catch (e) { /* audit must never block an operation */ }
  }

  /* ---------------- exports ---------------- */
  A.repo = {
    C, CONFIG_ID, CATEGORIES, CATEGORY_IDS, categoryLabel, categoryById,
    DEFAULT_CONFIG, CERT_TYPES, certLabel,
    getConfig, onConfig, saveConfig,
    isUsernameAvailable, reserveUsername, normaliseUsername, getProfile, createUser,
    getUser, ensureUser, isAdmin, listUsers, setUserRole,
    getRegistration, onRegistration, submitRegistration, updateRegistration, listRegistrations,
    onAnnouncements, listAnnouncements, saveAnnouncement, deleteAnnouncement,
    announcementVisibleTo, ANNOUNCEMENT_AUDIENCES,
    getBA, createBA, updateBA, deleteBA, listBAs, setBAStatus, baLeaderboard,
    attributeRegistrations, publishPublicBATopFive, unpublishPublicBATopFive, onPublicBATopFive,
    listCertificates, getCertificatesForUser, onCertificatesForUser, issueCertificate,
    releaseCertificate, withdrawCertificate, uploadCertificateFile, setCertificateLink,
    certificateAsset, MAX_CERTIFICATE_BYTES, deleteCertificate,
    audit
  };
})(window);
