/* Round 2 — brief, window state and the student's own status.
   The submission form itself lives in round2-submit.html. */
(function () {
  'use strict';
  const A = ABC;
  const mount = document.querySelector('[data-r2]');

  A.portal({
    active: 'student/round2.html',
    route: 'student/round2.html',
    onReady: function () {
      load();
      A.round2.onSubmission(A.user.uid, load);
      A.round2.onFinalist(A.user.uid, load);
    }
  });

  let cfg = null, loadSeq = 0;

  function load() {
    const seq = ++loadSeq;
    Promise.all([
      A.round2.getRound2Config(),
      A.round2.getSubmission(A.user.uid),
      A.round2.isFinalist(A.user.uid)
    ]).then(function (r) {
      if (seq !== loadSeq) return;
      cfg = r[0];
      render({ submission: r[1], finalist: r[2] });
    });
  }

  function note(kind, title, message) {
    return `<div class="alert alert-${kind}"><div>${title ? `<strong>${A.esc(title)}</strong>` : ''}${A.esc(message || '')}</div></div>`;
  }

  function windowState() {
    const o = A.toDate(cfg.opensAt), c = A.toDate(cfg.closesAt), now = Date.now();
    if (cfg.status === 'draft') return { code: 'draft', label: 'Not open yet' };
    if (cfg.status === 'closed') return { code: 'closed', label: 'Closed by the organiser' };
    if (o && now < o.getTime()) return { code: 'upcoming', label: 'Opens ' + A.fmtDateTime(o), opensAt: o };
    if (c && now > c.getTime()) return { code: 'closed', label: 'Closed ' + A.fmtDateTime(c) };
    return { code: 'open', label: 'Open now' };
  }

  function render(data) {
    const S = A.session.SESSION;
    const reg = S.registration;
    const state = windowState();
    const qualified = !!(reg && reg.qualifiedForRound2);
    const sub = data.submission;
    const finalist = data.finalist;

    let banner;
    if (!qualified) {
      banner = note('warn', 'Not yet qualified',
        'Round 2 is for students who qualified in Round 1. Your Round 1 result will show your status, and this page will update once the organiser finalises qualification.');
    } else if (state.code === 'draft') {
      banner = note('info', 'Round 2 is not open yet',
        'The brief and submission window are still being finalised. Announcements will be published when Round 2 opens.');
    } else if (state.code === 'upcoming') {
      banner = note('info', 'Submissions have not opened yet', 'Round 2 submissions open on ' + A.fmtDateTime(state.opensAt) + '.');
    } else if (state.code === 'closed') {
      banner = note('warn', 'Submissions are closed', 'The Round 2 submission window has closed. Your submitted work is now with the panel for assessment.');
    } else if (sub && sub.locked) {
      banner = note('ok', 'Your submission is in', 'Your Round 2 work has been submitted and is with the judging panel.');
    } else {
      banner = note('ok', 'Submissions are open', 'You are qualified for Round 2 and can submit your work.');
    }

    mount.innerHTML = `
      <h1>Round 2 &mdash; Mathematical Communication Challenge</h1>
      <p class="muted">Create a presentation that explains a mathematical idea clearly and originally. You may include a recording of yourself presenting.</p>
      <div style="margin:1.5rem 0">${banner}</div>

      <div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:1.5rem;align-items:start">
        <div class="stack">
          <div class="card">
            <h2 style="font-size:1.2rem">Brief</h2>
            <div class="prose" style="white-space:pre-line">${A.esc(cfg.brief)}</div>
            ${cfg.instructions ? `<div class="prose" style="white-space:pre-line;margin-top:1rem">${A.esc(cfg.instructions)}</div>` : ''}
            ${cfg.templateUrl ? `<a class="btn btn-outline btn-sm" style="margin-top:1rem" href="${A.esc(cfg.templateUrl)}" target="_blank" rel="noopener">Download the official template</a>` : ''}
            ${cfg.templateNote ? `<p class="field-hint" style="margin-top:.6rem">${A.esc(cfg.templateNote)}</p>` : ''}
          </div>

          <div class="card">
            <h2 style="font-size:1.2rem">How your work is assessed</h2>
            ${note('info', '', 'Round 2 submissions are reviewed by the panel and assessed off this website. Nothing about the assessment is shown to you, and the criteria will be published here once they are decided.')}
          </div>

          ${sub ? submissionCard(sub) : ''}
        </div>

        <aside class="stack">
          <div class="card">
            <h3 style="font-size:1.05rem">Round 2 details</h3>
            <dl class="kv" style="margin-top:1rem">
              <dt>Status</dt><dd>${A.statusBadge(state.code === 'open' ? 'open' : state.code === 'closed' ? 'closed' : 'upcoming')}</dd>
              <dt>Window</dt><dd>${A.esc(windowLabel())}</dd>
              <dt>Format</dt><dd>Presentation with optional recording</dd>
              <dt>Delivery</dt><dd>Google Drive link</dd>
              <dt>Your category</dt><dd>${A.esc(A.repo.categoryLabel(reg ? reg.category : ''))}</dd>
            </dl>
          </div>

          <div class="card">
            <h3 style="font-size:1.05rem">Submit or edit your work</h3>
            <p class="muted small" style="margin:0 0 .75rem">${sub && sub.locked
              ? 'Your submission is locked. Contact the organiser if it needs to be reopened.'
              : 'You can submit once the window is open, and update your link until the organiser locks it.'}</p>
            <a class="btn btn-primary btn-sm btn-block" href="round2-submit.html">${sub ? 'View submission' : 'Submit my work'}</a>
          </div>

          ${finalist ? `<div class="card" style="border-color:var(--gold)">
            <h3 style="font-size:1.05rem">You are a finalist</h3>
            <p class="muted small" style="margin:0 0 .75rem">Your Round 2 work was among the strongest entries. Head to the finalist area for Grand Finale details.</p>
            <a class="btn btn-primary btn-sm btn-block" href="finalist.html">Finalist area</a>
          </div>` : ''}
        </aside>
      </div>`;
  }

  function windowLabel() {
    const o = A.toDate(cfg.opensAt), c = A.toDate(cfg.closesAt);
    if (o && c) return A.fmtDateTime(o) + ' – ' + A.fmtDateTime(c);
    if (o) return 'Opens ' + A.fmtDateTime(o);
    if (c) return 'Closes ' + A.fmtDateTime(c);
    return 'To be announced';
  }

  function submissionCard(sub) {
    return `<div class="card">
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
        <h2 style="font-size:1.2rem;flex:1">Your submission</h2>
        ${sub.locked ? A.statusBadge('locked') : A.statusBadge('in-progress')}
      </div>
      <dl class="kv" style="margin-top:1rem">
        <dt>Title</dt><dd>${A.esc(sub.title || '—')}</dd>
        <dt>Topic</dt><dd>${A.esc(sub.topic || '—')}</dd>
        <dt>Submitted</dt><dd>${A.fmtDateTime(sub.submittedAt)}</dd>
        ${A.num(sub.resubmitCount) > 0 ? `<dt>Last updated</dt><dd>${A.fmtDateTime(sub.resubmittedAt)}</dd>` : ''}
        <dt>Status</dt><dd>${sub.locked ? 'Locked by the organiser' : 'Editable'}</dd>
      </dl>
      <a class="btn btn-outline btn-sm" style="margin-top:1rem" href="round2-submit.html">${sub.locked ? 'View details' : 'Edit submission'}</a>
    </div>`;
  }
})();
