/* Student dashboard — the competition journey at a glance */
(function () {
  'use strict';
  const A = ABC;
  const mount = document.querySelector('[data-dash]');

  A.portal({
    active: 'student/dashboard.html',
    route: 'student/dashboard.html',
    onReady: function () { render(); }
  });

  let config = null, quiz = null, r2 = null;

  function stepFor(key, title, status, bodyHtml, actionHtml) {
    const cls = status === 'done' ? 'done' : (status === 'current' ? 'current' : '');
    return `<div class="step ${cls}">
      <div class="step-dot" aria-hidden="true">${status === 'done' ? '&#10003;' : A.esc(key)}</div>
      <div>
        <div class="step-title">${A.esc(title)} ${A.statusBadge(status === 'done' ? (key === 1 ? 'submitted' : 'qualified') : (status === 'current' ? 'open' : 'upcoming'))}</div>
        <div class="step-body">${bodyHtml}</div>
        ${actionHtml ? `<div class="btn-row" style="margin-top:.85rem">${actionHtml}</div>` : ''}
      </div>
    </div>`;
  }

  function render() {
    const S = A.session.SESSION;
    const reg = S.registration;
    const attempt = S.attempt;
    const result = S.result;
    const sub = S.submission;
    const fin = S.finalist;

    if (!reg) {
      mount.innerHTML = `
        <h1>Welcome, ${A.esc(A.session.studentName())}</h1>
        <p class="muted">You are signed in but not yet registered for the competition.</p>
        ${A.ui.alertBox('info', 'Registration required', 'Register once and your whole competition journey appears here.')}
        <div class="btn-row" style="margin-top:1.5rem">
          <a class="btn btn-primary btn-lg" href="registration.html">Register for the competition</a>
        </div>`;
      return;
    }

    const r1av = A.round1Availability(quiz, attempt);
    const released = !!(result && result.releasedToStudent);
    const round2Open = r2 && r2.status !== 'draft';
    const r2State = A.toDate(r2 && r2.closesAt);
    const finale = S.finaleCfg || {};

    /* --- Round 1 step --- */
    let r1Body, r1Action, r1Status;
    if (attempt && attempt.status === 'in-progress') {
      r1Status = 'current';
      r1Body = `<p style="margin:0">Your attempt is in progress. Your answers are saved automatically.</p>
        <div class="figures">
          <div><span class="figure-label">Answered</span><span class="figure-value">${A.esc(countAnswered(attempt))} / ${A.esc(A.num(attempt.questionCount))}</span></div>
          ${attempt.deadlineMs ? `<div><span class="figure-label">Time remaining</span><span class="figure-value" data-live-timer>—</span></div>` : ''}
        </div>`;
      r1Action = `<a class="btn btn-primary" href="round1.html">Resume attempt</a>`;
    } else if (attempt && (attempt.status === 'submitted' || attempt.status === 'scored')) {
      r1Status = 'done';
      r1Body = released && result
        ? `<div class="figures">
            <div><span class="figure-label">Score</span><span class="figure-value">${A.esc(result.score)}${result.maxScore ? ' <span class="muted" style="font-size:.9rem">/ ' + A.esc(result.maxScore) + '</span>' : ''}</span></div>
            <div><span class="figure-label">Rank</span><span class="figure-value">${A.esc(A.ordinal(result.rank))}</span></div>
            <div><span class="figure-label">Status</span><span class="figure-value" style="font-size:1.1rem">${result.qualified ? 'Qualified' : 'Not qualified'}</span></div>
          </div>`
        : `<p style="margin:0">Your attempt has been submitted. Your result will appear here once the organiser releases results.</p>`;
      r1Action = released
        ? `<a class="btn btn-outline" href="round1-result.html">View full result</a>`
        : `<a class="btn btn-secondary" href="round1-result.html">Result page</a>`;
    } else if (r1av.code === 'open') {
      r1Status = 'current';
      r1Body = `<p style="margin:0">Round 1 is open. Read the instructions before you start — you get one official attempt.</p>`;
      r1Action = `<a class="btn btn-primary" href="round1.html">View instructions &amp; start</a>`;
    } else {
      r1Status = 'future';
      r1Body = `<p style="margin:0">${A.esc(r1av.message)}</p>`;
      r1Action = r1av.opensAt ? `<span class="small muted">Opens ${A.fmtDateTime(r1av.opensAt)}</span>` : '';
    }

    /* --- Round 2 step --- */
    const qualified = !!(result && result.qualified);
    let r2Body, r2Action, r2Status;
    if (fin) {
      r2Status = 'done';
      r2Body = `<p style="margin:0">You progressed to the Grand Finale as a finalist.</p>`;
    } else if (sub && (sub.status === 'submitted')) {
      r2Status = 'done';
      r2Body = `<p style="margin:0">Your presentation was submitted${sub.locked ? ' and is locked' : ''}. It is now with the judges.</p>
        <div class="figures"><div><span class="figure-label">Submitted</span><span class="figure-value" style="font-size:1.1rem">${A.fmtDate(sub.submittedAt)}</span></div></div>`;
      r2Action = `<a class="btn btn-outline" href="round2.html">View submission</a>`;
    } else if (qualified && round2Open) {
      r2Status = 'current';
      r2Body = `<p style="margin:0">${qualified ? 'You qualified for Round 2.' : ''} Submit your presentation using a Google Drive link.</p>`;
      r2Action = `<a class="btn btn-primary" href="round2-submit.html">Submit presentation</a>`;
    } else if (qualified) {
      r2Status = 'future';
      r2Body = `<p style="margin:0">You qualified for Round 2. Submissions open ${A.fmtDate(A.toDate(r2 && r2.opensAt)) || 'soon'}.</p>`;
    } else if (released) {
      r2Status = 'future';
      r2Body = `<p style="margin:0">You did not qualify for Round 2 this season. Thank you for taking part.</p>`;
    } else {
      r2Status = 'future';
      r2Body = `<p style="margin:0">Qualification depends on your Round 1 result, which has not been released yet.</p>`;
    }

    /* --- Grand Finale step --- */
    const finaleOpen = !!fin;
    const gfBody = finaleOpen
      ? `<p style="margin:0">You are a confirmed finalist. Event details appear here once the organiser releases them.</p>
         <div class="figures">
           <div><span class="figure-label">Location</span><span class="figure-value" style="font-size:1.1rem">${A.esc(finale.city || (config && config.grandFinaleCity) || 'Karachi')}</span></div>
           <div><span class="figure-label">Date</span><span class="figure-value" style="font-size:1.1rem">${A.esc(A.toDate(finale.date) ? A.fmtDate(finale.date) : ((config && config.grandFinaleMonth) || 'November 2026'))}</span></div>
         </div>`
      : `<p style="margin:0">Thirty finalists reach the Grand Finale in Karachi, November 2026. Finalists are confirmed by the organiser.</p>`;
    const gfAction = finaleOpen ? `<a class="btn btn-primary" href="finalist.html">Open finalist area</a>` : '';

    /* --- Certificates count --- */
    let certCount = 0;
    A.repo.onCertificatesForUser(A.user.uid, function (certs) {
      certCount = certs.length;
      const el = document.querySelector('[data-cert-count]');
      if (el) el.textContent = String(certs.length);
    });

    const announced = !!(config && config.announceRound1Open);

    mount.innerHTML = `
      <div class="flex-between" style="margin-bottom:1.5rem">
        <div>
          <span class="eyebrow left">Al-Biruni&rsquo;s Challenge 2026</span>
          <h1 style="margin-bottom:.35rem">Welcome, ${A.esc(A.session.studentName())}</h1>
          <p class="muted" style="margin:0">Category: <strong>${A.esc(A.repo.categoryLabel(reg.category))}</strong> &middot; ${A.esc(reg.school || 'School not given')}</p>
        </div>
        <a class="btn btn-outline" href="announcements.html">Announcements</a>
      </div>

      ${r1av.code === 'open' && !attempt ? A.ui.alertBox('info', 'Round 1 is open', 'You have not started your official attempt yet. Remember: one attempt only.') : ''}
      ${r1av.code === 'closed' && attempt && attempt.status === 'in-progress' ? A.ui.alertBox('warn', 'Round 1 has closed', 'If you have an attempt still in progress, contact the organiser — do not start a new one.') : ''}

      <div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:1.5rem;align-items:start;margin-top:1.5rem">
        <div>
          <h2 style="font-size:1.35rem">Competition progress</h2>
          <div class="stepper">
            ${stepFor('1', 'Registration', 'done',
              `<p style="margin:0">Registered on ${A.fmtDate(reg.registeredAt)} &middot; ${A.esc(A.repo.categoryLabel(reg.category))}</p>`,
              `<a class="btn btn-outline btn-sm" href="registration.html">View registration</a>`)}
            ${stepFor('2', 'Round 1 — Rapid-Fire Qualifier', r1Status, r1Body, r1Action)}
            ${stepFor('3', 'Round 2 — Mathematical Communication', r2Status, r2Body, r2Action)}
            ${stepFor('4', 'Grand Finale — Build a Better World', finaleOpen ? 'done' : 'future', gfBody, gfAction)}
          </div>
        </div>

        <aside class="stack">
          <div class="card card-accent">
            <h3 style="font-size:1.1rem">At a glance</h3>
            <div class="stack small" style="margin-top:1rem">
              <div class="flex-between"><span class="muted">Category</span><strong>${A.esc(A.repo.categoryLabel(reg.category))}</strong></div>
              <div class="flex-between"><span class="muted">Round 1</span><span>${A.statusBadge(attempt ? (attempt.status === 'in-progress' ? 'in-progress' : 'submitted') : (r1av.code === 'open' ? 'open' : 'upcoming'))}</span></div>
              <div class="flex-between"><span class="muted">Round 2</span><span>${sub ? A.statusBadge('submitted') : (qualified ? A.statusBadge('open') : A.statusBadge('upcoming'))}</span></div>
              <div class="flex-between"><span class="muted">Finalist</span><span>${fin ? A.statusBadge('finalist') : A.statusBadge('upcoming')}</span></div>
              <div class="flex-between"><span class="muted">Certificates</span><strong data-cert-count>—</strong></div>
            </div>
          </div>
          <div class="card">
            <h3 style="font-size:1.1rem">Quick links</h3>
            <div class="stack" style="margin-top:.75rem">
              <a class="btn btn-outline btn-sm btn-block" href="round1.html">Round 1</a>
              <a class="btn btn-outline btn-sm btn-block" href="round1-result.html">My Round 1 result</a>
              <a class="btn btn-outline btn-sm btn-block" href="round2.html">Round 2</a>
              <a class="btn btn-outline btn-sm btn-block" href="certificates.html">Certificates</a>
              <a class="btn btn-outline btn-sm btn-block" href="profile.html">Profile &amp; account</a>
            </div>
          </div>
        </aside>
      </div>`;

    startLiveTimer(attempt);
  }

  function countAnswered(attempt) {
    const ans = attempt.answers || {};
    return Object.keys(ans).filter((k) => ans[k] !== null && ans[k] !== undefined && ans[k] !== '').length;
  }

  function startLiveTimer(attempt) {
    if (!attempt || !attempt.deadlineMs) return;
    const el = document.querySelector('[data-live-timer]');
    if (!el) return;
    function tick() {
      const left = Math.max(0, Math.floor((attempt.deadlineMs - Date.now()) / 1000));
      el.textContent = A.fmtDuration(left);
      if (left <= 0) location.reload();
    }
    tick();
    setInterval(tick, 1000);
  }

  /* Load config in parallel with the session. */
  Promise.all([
    A.repo.getConfig(),
    A.round1.getQuiz(),
    A.round2.getRound2Config(),
    A.round2.getFinaleConfig()
  ]).then(function (r) {
    config = r[0]; quiz = r[1]; r2 = r[2];
    A.session.SESSION.finaleCfg = r[3];
    render();
  }).catch(function (e) {
    mount.innerHTML = A.ui.alertBox('danger', 'Could not load your dashboard', e.message || 'Please refresh the page.');
  });
})();
