/* Judge bootstrap. A judge sees only their own scoring sheet. */
(function () {
  'use strict';
  const A = ABC;

  A.judge = function (options) {
    const opts = options || {};
    A.ui.renderAdminNav(opts.active);
    A.ui.renderAdminTopbar(opts.title || 'Judging panel', opts.subtitle || '');

    return A.session.boot({
      route: opts.route,
      requireAuth: true,
      onReady: async function (S) {
        if (A.repo.isAdmin(S.record)) {
          const who = document.querySelector('[data-abc-admindoctorial]');
          if (who) who.textContent = (S.record.displayName || A.user.email) + ' · Administrator';
          document.dispatchEvent(new CustomEvent('abc:judge-ready', { detail: S }));
          if (opts.onReady) await opts.onReady(S);
          return;
        }
        if (!A.repo.isJudge(S.record)) {
          showDenied('This area is restricted to the judging panel and administrators.');
          return;
        }
        const who = document.querySelector('[data-abc-admindoctorial]');
        if (who) who.textContent = (S.record.displayName || A.user.email) + ' · Judge';
        document.dispatchEvent(new CustomEvent('abc:judge-ready', { detail: S }));
        if (opts.onReady) await opts.onReady(S);
      }
    });
  };

  function showDenied(message) {
    const host = document.querySelector('[data-host]');
    if (!host) return;
    host.innerHTML = A.ui.alertBox('warn', 'Restricted area', message) +
      `<div class="btn-row" style="margin-top:1.25rem">
        <a class="btn btn-outline" href="${A.rootPath('student/dashboard.html')}">Student portal</a>
        <button class="btn btn-ghost" id="signOut">Sign out</button>
      </div>`;
    const out = document.getElementById('signOut');
    if (out) out.addEventListener('click', function () { A.session.signOut(); });
  }
})(window);
