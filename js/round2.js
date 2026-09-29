/* Al-Biruni's Challenge 2026 — Round 2, judging, finalists, Grand Finale
   ------------------------------------------------------------------
   Round 2 is a mathematical communication challenge. Students submit a
   Google Drive link (presentation material, PDF, recording, or a folder).
   Large video files are deliberately not uploaded to this site.

   The rubric, weighting, deadline and judging structure are all
   admin-configurable — none of them are hardcoded. */

(function (global) {
  'use strict';

  const A = global.ABC;
  const R = A.repo;
  const db = () => A.db;
  const C = R.C;

  /* ---------------- round 2 configuration ---------------- */
  const round2Doc = () => db().collection(C.config).doc('round2');
  const grandFinaleDoc = () => db().collection(C.config).doc('grandFinale');

  function DEFAULT_ROUND2() {
    return {
      title: 'Round 2 — Mathematical Communication Challenge',
      brief: 'Create a presentation using the official Mathsimized PowerPoint template that explains a mathematical idea clearly and originally. You may include a recording of you presenting.',
      templateUrl: '',
      templateNote: '',
      opensAt: null,
      closesAt: null,
      resultsAt: null,
      instructions: '',
      /* Judging happens off the platform, so there is no rubric and no
         weighting here. What is recorded is whether the organiser has
         published the names, which is what students are allowed to see. */
      resultsReleasedToStudents: false,
      status: 'draft'
    };
  }

  function DEFAULT_FINALE() {
    return {
      city: 'Karachi',            /* confirmed */
      month: 'November 2026',     /* confirmed */
      date: null,
      venue: '',
      reportingTime: '',
      demoMinutes: 2,             /* confirmed: up to two minutes */
      presentationMinutes: null,  /* admin-set once announced */
      interviewCount: null,       /* admin-set once announced */
      instructions: '',
      schedule: [],
      materials: '',
      finalistsConfirmed: false,
      finalistListReleased: false,
      resultsReleased: false,
      status: 'planning'
    };
  }

  async function getRound2Config() {
    const snap = await round2Doc().get();
    const cfg = Object.assign(DEFAULT_ROUND2(), snap.exists ? snap.data() : {});
    A.round2CfgCache = cfg;
    return cfg;
  }
  function onRound2Config(cb) {
    return round2Doc().onSnapshot(
      (s) => cb(Object.assign(DEFAULT_ROUND2(), s.exists ? s.data() : {})), () => cb(DEFAULT_ROUND2()));
  }
  async function saveRound2Config(patch) {
    await round2Doc().set(Object.assign({}, patch, { updatedAt: A.server }), { merge: true });
    return getRound2Config();
  }

  async function getFinaleConfig() {
    const snap = await grandFinaleDoc().get();
    return Object.assign(DEFAULT_FINALE(), snap.exists ? snap.data() : {});
  }
  function onFinaleConfig(cb) {
    return grandFinaleDoc().onSnapshot(
      (s) => cb(Object.assign(DEFAULT_FINALE(), s.exists ? s.data() : {})), () => cb(DEFAULT_FINALE()));
  }
  async function saveFinaleConfig(patch) {
    await grandFinaleDoc().set(Object.assign({}, patch, { updatedAt: A.server }), { merge: true });
    return getFinaleConfig();
  }

  /* ---------------- submissions ---------------- */
  const subRef = (uid) => db().collection(C.round2).doc(uid);

  function validateDriveUrl(url) {
    const s = String(url || '').trim();
    if (!s) return 'Please provide your Google Drive link.';
    if (!/^https?:\/\//i.test(s)) return 'The link must start with http:// or https://';
    if (!/(drive\.google\.com|docs\.google\.com|drive\.google\.com\/drive)/i.test(s)) {
      return 'The link must be a Google Drive link.';
    }
    return null;
  }

  async function getSubmission(uid) {
    const snap = await subRef(uid).get();
    return snap.exists ? Object.assign({ id: snap.id, uid }, snap.data()) : null;
  }

  function onSubmission(uid, cb) {
    return subRef(uid).onSnapshot(
      (s) => cb(s.exists ? Object.assign({ id: s.id, uid }, s.data()) : null), () => cb(null));
  }

  async function submitRound2(user, registration, data) {
    const cfg = await getRound2Config();
    if (cfg.status === 'draft') throw new Error('Round 2 is not open for submissions yet.');
    if (cfg.status === 'closed') throw new Error('The organiser has closed Round 2 submissions.');
    if (cfg.opensAt) {
      const t = A.toDate(cfg.opensAt);
      if (t && Date.now() < t.getTime()) throw new Error('Round 2 submissions have not opened yet.');
    }
    if (cfg.closesAt) {
      const t = A.toDate(cfg.closesAt);
      if (t && Date.now() > t.getTime()) throw new Error('Round 2 submissions have closed.');
    }
    if (!registration) throw new Error('You must be registered to submit.');
    if (!registration.qualifiedForRound2) {
      throw new Error('You are not currently qualified for Round 2.');
    }

    const existing = await getSubmission(user.uid);
    if (existing && existing.locked) {
      throw new Error('Your submission is locked. Contact the organiser if you need it reopened.');
    }

    const linkError = validateDriveUrl(data.driveUrl);
    if (linkError) throw new Error(linkError);

    const payload = {
      uid: user.uid,
      studentName: registration.studentName || user.displayName || '',
      email: registration.email || user.email || '',
      school: registration.school || '',
      city: registration.city || '',
      category: registration.category,
      title: String(data.title || '').trim(),
      driveUrl: String(data.driveUrl).trim(),
      notes: String(data.notes || '').trim(),
      topic: String(data.topic || '').trim(),
      locked: true,
      submittedAt: existing && existing.submittedAt ? existing.submittedAt : A.server,
      resubmittedAt: A.server,
      resubmitCount: existing ? A.num(existing.resubmitCount) + 1 : 0,
      status: 'submitted',
      updatedAt: A.server
    };
    await subRef(user.uid).set(payload);
    await R.audit('round2_submit', { uid: user.uid, resubmit: !!existing });
    return getSubmission(user.uid);
  }

  async function listSubmissions(filter) {
    let q = db().collection(C.round2);
    if (filter && filter.category) q = q.where('category', '==', filter.category);
    if (filter && filter.status) q = q.where('status', '==', filter.status);
    const snap = await q.get();
    return A.sortBy(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())), (r) => r.studentName);
  }

  /* Administrator reopens a locked submission for an exceptional case. */
  async function reopenSubmission(uid) {
    await subRef(uid).set({ locked: false, updatedAt: A.server }, { merge: true });
    await R.audit('round2_reopen', { uid });
  }

  async function lockSubmission(uid, locked) {
    await subRef(uid).set({ locked: !!locked, updatedAt: A.server }, { merge: true });
    await R.audit('round2_lock', { uid, locked: !!locked });
  }

  /* ---------------- no judging here ----------------
     Round 2 submissions are judged off the platform. The organiser receives
     the results by whatever route they use, then marks finalists in this
     panel and publishes the names. There is deliberately no score, no rubric
     and no per-judge record: storing numbers nobody reads would only risk
     them leaking, and there is no way to enforce a marking scheme from a
     browser anyway. */

  /* Submission order for the panel: by category, then by when it arrived. */
  function listByArrival(submissions) {
    return submissions.slice().sort((a, b) => {
      if (a.category !== b.category) return String(a.category).localeCompare(String(b.category));
      return toMillis(a.submittedAt) - toMillis(b.submittedAt);
    });
  }

  function toMillis(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    const t = new Date(value).getTime();
    return isNaN(t) ? 0 : t;
  }

  /* ---------------- finalists ---------------- */
  const finalistRef = (uid) => db().collection(C.finalists).doc(uid);

  async function isFinalist(uid) {
    const snap = await finalistRef(uid).get();
    return snap.exists ? Object.assign({ id: snap.id, uid }, snap.data()) : null;
  }

  function onFinalist(uid, cb) {
    return finalistRef(uid).onSnapshot(
      (s) => cb(s.exists ? Object.assign({ id: s.id, uid }, s.data()) : null), () => cb(null));
  }

  async function listFinalists(category) {
    let q = db().collection(C.finalists);
    if (category) q = q.where('category', '==', category);
    const snap = await q.get();
    return A.sortBy(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())), (r) => A.num(r.finalScore), 'desc');
  }

  /* Administrator confirms a set of finalists. Nothing is published to
     students until the admin separately releases the finalist list. */
  async function confirmFinalist(uid, data) {
    await finalistRef(uid).set(Object.assign({
      uid,
      confirmedAt: A.server,
      updatedAt: A.server,
      released: false
    }, data), { merge: true });
    await R.audit('finalist_confirm', { uid });
  }

  async function removeFinalist(uid) {
    await finalistRef(uid).delete();
    await R.audit('finalist_remove', { uid });
  }

  async function setFinalistReleased(uid, released) {
    await finalistRef(uid).set({ released: !!released, releasedAt: released ? A.server : null, updatedAt: A.server }, { merge: true });
  }

  /* Confirm a named set of submissions as finalists. The organiser picks them
     from the results they were given off-platform, so there is no ranking to
     compute here and nothing is confirmed automatically. */
  async function confirmSelected(submissions, category) {
    const done = [];
    for (const r of submissions) {
      await confirmFinalist(r.id, {
        name: r.studentName,
        school: r.school,
        city: r.city,
        category: r.category,
        source: 'round2'
      });
      done.push(r.id);
    }
    await R.audit('finalists_confirm_selected', { category, count: done.length });
    return done;
  }

  /* ---------------- grand finale results ---------------- */
  async function saveFinalistResult(uid, data) {
    await finalistRef(uid).set(Object.assign({ uid, updatedAt: A.server }, data), { merge: true });
  }

  const AWARDS = {
    winner: { label: 'Winner', cash: 'Rs. 30,000', shield: "Physical Winner's Shield" },
    runnerup: { label: 'Runner-up', cash: 'Rs. 10,000', shield: 'Physical Runner-Up Shield' },
    hm: { label: 'Honourable Mention', cash: null, shield: null }
  };

  A.round2 = {
    DEFAULT_ROUND2, DEFAULT_FINALE,
    getRound2Config, onRound2Config, saveRound2Config,
    getFinaleConfig, onFinaleConfig, saveFinaleConfig,
    validateDriveUrl, getSubmission, onSubmission, submitRound2, listSubmissions,
    reopenSubmission, lockSubmission, listByArrival,
    isFinalist, onFinalist, listFinalists, confirmFinalist, confirmSelected, removeFinalist,
    setFinalistReleased, saveFinalistResult, AWARDS
  };
})(window);
