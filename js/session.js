/* Al-Biruni\'s Challenge 2026 — session and access control
   ------------------------------------------------------------------
   Students sign in with an account created for this competition. This app
   only ever *reads* the shared MATHSIMIZED `users` document to pre-fill a
   registration form; it never writes to it, and never touches any
   MATHSIMIZED page, stylesheet or script. */

(function (global) {
  'use strict';

  const A = global.ABC;
  const R = A.repo;

  const SESSION = {
    user: null,
    record: null,
    registration: null,
    result: null,
    attempt: null,
    submission: null,
    finalist: null,
    certificates: null,
    ready: false
  };

  /* Route protection ---------------------------------------------------- */
  const PORTAL_ROUTES = [
    'student/dashboard.html', 'student/registration.html', 'student/round1.html',
    'student/round1-result.html', 'student/round2.html', 'student/round2-submit.html',
    'student/finalist.html', 'student/certificates.html', 'student/announcements.html',
    'student/profile.html'
  ];
  const ADMIN_ROUTES = [
    'admin/index.html', 'admin/settings.html', 'admin/registrations.html',
    'admin/questions.html', 'admin/import.html', 'admin/round1.html', 'admin/results.html',
    'admin/round2.html', 'admin/finalists.html', 'admin/grand-finale.html',
    'admin/certificates.html', 'admin/brand-ambassadors.html', 'admin/announcements.html',
    'admin/users.html'
  ];
  /* The path relative to the site root, so that route protection works when
     the app is served from a subdirectory as well as from the domain root. */
  function currentRoute() {
    const p = global.location.pathname;
    /* rootPath() may be absolute or a bare path depending on how the page was
       loaded, so reduce it to a pathname before comparing. */
    let root = String(A.rootPath() || '');
    try { root = new URL(root, global.location.href).pathname; } catch (e) { /* not a URL */ }
    let rel = p;
    if (root && root !== '/' && p.indexOf(root) === 0) rel = p.slice(root.length);
    rel = rel.replace(/^\/+/, '');
    return rel || 'index.html';
  }

  /* Matched on the full site-relative path. Basenames are deliberately not
     used: student/round1.html and admin/round1.html share a file name, and
     treating one as the other would lock students out of the portal. */
  function isPortalRoute(route) { return !!route && PORTAL_ROUTES.indexOf(route) !== -1; }
  function isAdminRoute(route) { return !!route && ADMIN_ROUTES.indexOf(route) !== -1; }

  function home() { return A.rootPath('student/dashboard.html'); }
  function login() { return A.rootPath('login.html?next=' + encodeURIComponent(global.location.pathname)) }

  /* Load the full competition context for the signed-in student. */
  async function refresh() {
    if (!SESSION.user) return SESSION;
    const uid = SESSION.user.uid;
    SESSION.record = await R.ensureUser(SESSION.user);
    const [reg, res, att, sub, fin, certs] = await Promise.all([
      R.getRegistration(uid),
      A.round1.getResult(uid),
      A.round1.getAttempt(uid),
      A.round2.getSubmission(uid),
      A.round2.isFinalist(uid),
      R.getCertificatesForUser(uid)
    ]);
    SESSION.registration = reg;
    SESSION.result = res;
    SESSION.attempt = att;
    SESSION.submission = sub;
    SESSION.finalist = fin;
    SESSION.certificates = certs;
    SESSION.ready = true;
    document.dispatchEvent(new CustomEvent('abc:session', { detail: SESSION }));
    return SESSION;
  }

  /* Sign-in helpers used by the login page. */
  async function signIn(email, password, remember) {
    await A.auth.signInWithEmailAndPassword(email, password);
    if (remember) localStorage.setItem('abc_remember', '1');
    return A.auth.currentUser;
  }

  /* A username, not a full name. The full name belongs in the competition
     registration form, where we need it for certificates — not here, where
     someone might type a nickname.

     This site has its own accounts, so creating the login is not the whole of
     it: the username is reserved and the user record is written here. If
     either of those fails the account is deleted again rather than left
     half-made, because a student with a login and no username cannot register
     and would be stuck. */
  async function signUp(email, password, username) {
    const value = A.repo.normaliseUsername(username);
    const check = await A.repo.isUsernameAvailable(value);
    if (!check.available) {
      const e = new Error(check.error || 'That username is not available.');
      e.code = 'username-taken';
      throw e;
    }

    const cred = await A.auth.createUserWithEmailAndPassword(email, password);
    try {
      await A.repo.reserveUsername(cred.user.uid, value);
      await A.repo.createUser(cred.user, value);
      try { await cred.user.updateProfile({ displayName: value }); } catch (err) { /* not fatal */ }
      /* Send the verification email. It is not enforced for students, but
         the rules grant admin from request.auth.token.email, and Firebase
         leaves the email claim out of the ID token until the address is
         verified. Without this the organiser account is created but can never
         be recognised as an admin, and the panel refuses it with a message
         that gives no clue why. */
      try { await cred.user.sendEmailVerification(); } catch (err) { /* not fatal */ }
    } catch (err) {
      /* Roll the login back so a half-made account cannot linger. */
      try { await cred.user.delete(); } catch (e) { /* nothing more we can do */ }
      const e = new Error('Could not finish creating your account: ' + (err.message || err));
      e.code = 'signup-incomplete';
      throw e;
    }
    return cred.user;
  }

  async function sendReset(email) {
    await A.auth.sendPasswordResetEmail(email);
  }

  /* Re-send the verification email. Needed after the first one, and after any
     address change. */
  async function resendVerification() {
    const user = A.user;
    if (!user) throw new Error('You are not signed in.');
    if (user.emailVerified) return { alreadyVerified: true };
    await user.sendEmailVerification();
    return { alreadyVerified: false };
  }

  /* True when this account is the organiser's but has not been confirmed yet.
     A distinct state from "not an admin", because the fix is different: this
     one clears by checking an inbox. */
  function isUnverifiedAdmin() {
    const user = A.user;
    if (!user || user.emailVerified) return false;
    const email = (user.email || '').toLowerCase();
    return email === String(A.ADMIN_EMAIL || '').toLowerCase();
  }

  async function signOut() {
    try { await A.auth.signOut(); } finally { A.redirect('index.html'); }
  }

  /* Standard bootstrap for every page. Guard decides access. */
  async function boot(options) {
    const opts = options || {};
    const route = opts.route || currentRoute();

    await A.READY;
    const user = A.user;

    if (!user) {
      if (isPortalRoute(route) || isAdminRoute(route) || opts.requireAuth) {
        A.redirect(login());
        return null;
      }
      SESSION.ready = true;
      if (opts.onReady) opts.onReady(SESSION);
      return SESSION;
    }

    if (isAdminRoute(route)) {
      const rec = await R.ensureUser(user);
      /* Let the admin page render its own explanation for an unconfirmed
         organiser address, rather than bouncing to the portal from here. */
      if (!R.isAdmin(rec) && !isUnverifiedAdmin()) {
        /* Nobody should ever see this: the guard on every admin page is an
           email comparison, and only one address matches. It stays in place
           so a future third-party account cannot reach the panel by guessing
           a URL. */
        A.ui.toast('This account does not have access to the panel.', 'error');
        setTimeout(() => A.redirect('student/dashboard.html'), 1200);
        return null;
      }
      SESSION.record = rec;
      SESSION.ready = true;
      if (opts.onReady) opts.onReady(SESSION);
      return SESSION;
    }

    if (isPortalRoute(route)) {
      await refresh();
      if (!SESSION.registration && opts.requireRegistration !== false &&
          route !== 'student/registration.html' && route !== 'student/profile.html') {
        A.redirect('student/registration.html?required=1');
        return null;
      }
      if (opts.onReady) opts.onReady(SESSION);
      return SESSION;
    }

    if (user) await refresh();
    if (opts.onReady) opts.onReady(SESSION);
    return SESSION;
  }

  /* Helpers used across student pages. */
  const ctx = () => ({
    registration: SESSION.registration,
    result: SESSION.result,
    attempt: SESSION.attempt,
    isFinalist: !!SESSION.finalist,
    role: SESSION.record ? SESSION.record.role : null
  });

  function isRegistered() { return !!SESSION.registration; }

  function isQualifiedRound2() {
    return !!(SESSION.registration && SESSION.registration.qualifiedForRound2);
  }

  function studentName() {
    return (SESSION.registration && SESSION.registration.studentName) ||
      (SESSION.record && SESSION.record.displayName) ||
      (SESSION.user && SESSION.user.displayName) || 'Student';
  }

  function category() {
    return (SESSION.registration && SESSION.registration.category) || null;
  }

  A.session = {
    resendVerification, isUnverifiedAdmin,
    SESSION, PORTAL_ROUTES, ADMIN_ROUTES, currentRoute, isPortalRoute, isAdminRoute,
    boot, refresh, signIn, signUp, sendReset, signOut, ctx,
    isRegistered, isQualifiedRound2, studentName, category
  };
})(window);
