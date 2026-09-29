/* Al-Biruni\'s Challenge 2026 — student portal bootstrap
   Renders the site header, the portal sidebar and provides a small set of
   reusable status helpers shared by every student page. */

(function (global) {
  'use strict';

  const A = global.ABC;

  /* Renders the chrome and returns a promise for the loaded session. */
  A.portal = function (options) {
    const opts = options || {};
    A.ui.renderHeader(null);
    A.ui.renderPortalNav(opts.active);
    const side = document.querySelector('[data-abc-portalnav]');
    if (side) {
      const name = side.querySelector('[data-portal-name]');
      const email = side.querySelector('[data-portal-email]');
      if (name) name.textContent = A.session.studentName();
      if (email) email.textContent = (A.user && A.user.email) || '';
    }
    return A.session.boot({ route: opts.route, requireRegistration: opts.requireRegistration, onReady: opts.onReady });
  };

  A.portalShell = function (active) {
    return `
<div class="shell">
  <div class="portal">
    <div class="portal-side" data-abc-portalnav></div>
    <div class="portal-main">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="../index.html">Home</a><span aria-hidden="true">/</span><span aria-current="page">${A.esc(active)}</span>
      </nav>
      <div data-portal-content></div>
    </div>
  </div>
</div>`;
  };

  /* Status pill for a registration/round state. */
  A.statusBadge = function (state) {
    const map = {
      registered: ['badge-ok', 'Registered'],
      'not-registered': ['badge-muted', 'Not registered'],
      upcoming: ['badge-info', 'Upcoming'],
      open: ['badge-ok', 'Open now'],
      closed: ['badge-muted', 'Closed'],
      'in-progress': ['badge-warn', 'In progress'],
      submitted: ['badge-info', 'Submitted'],
      scored: ['badge-info', 'Scored'],
      qualified: ['badge-ok', 'Qualified'],
      'not-qualified': ['badge-muted', 'Not qualified'],
      finalist: ['badge-burgundy', 'Finalist'],
      pending: ['badge-warn', 'Pending'],
      approved: ['badge-ok', 'Approved'],
      rejected: ['badge-danger', 'Not approved'],
      locked: ['badge-muted', 'Locked']
    };
    const s = map[state] || ['badge-muted', A.titleCase(state || 'Unknown')];
    return `<span class="badge ${s[0]}">${A.esc(s[1])}</span>`;
  };

  /* Round 1 availability, resolved from the quiz configuration. */
  A.round1Availability = function (quiz, attempt) {
    const state = A.round1.windowState(quiz);
    if (state.code === 'not-published') {
      return { code: 'unavailable', label: 'Not open yet', message: 'Round 1 has not been published yet. Check the announcements page for the opening date.' };
    }
    if (state.code === 'upcoming') {
      return { code: 'upcoming', label: 'Opens soon', message: 'Round 1 has not opened yet.', opensAt: state.opensAt };
    }
    if (state.code === 'closed') {
      return { code: 'closed', label: 'Closed', message: 'Round 1 is now closed.', closesAt: state.closesAt };
    }
    if (attempt && attempt.status === 'in-progress') {
      return { code: 'in-progress', label: 'Attempt in progress', message: 'You have an attempt in progress. Continue where you left off.' };
    }
    if (attempt && (attempt.status === 'submitted' || attempt.status === 'scored')) {
      return { code: 'done', label: 'Completed', message: 'You have completed your official Round 1 attempt.' };
    }
    return { code: 'open', label: 'Open now', message: 'Round 1 is open. You can begin your attempt.' };
  };

  /* Human label for the Round 1 window. */
  A.round1WindowLabel = function (quiz) {
    const o = A.toDate(quiz.opensAt), c = A.toDate(quiz.closesAt);
    if (o && c) return `${A.fmtDateTime(o)} – ${A.fmtDateTime(c)}`;
    if (o) return `Opens ${A.fmtDateTime(o)}`;
    if (c) return `Closes ${A.fmtDateTime(c)}`;
    return 'To be announced';
  };
})(window);
