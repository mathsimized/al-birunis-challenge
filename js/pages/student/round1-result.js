/* My Round 1 result — the student's own score and rank are always shown
   once released, whether or not they appear on the public leaderboard. */
(function () {
  'use strict';
  const A = ABC;
  const mount = document.querySelector('[data-res]');
  let quiz = null;

  A.portal({
    active: 'student/round1-result.html',
    route: 'student/round1-result.html',
    onReady: function () {
      A.round1.getQuiz().then(function (q) { quiz = q; });
      A.round1.onResult(A.user.uid, render);
    }
  });

  /* alertBox escapes its message, so notices needing emphasis are built here. */
  function note(kind, title, message) {
    return `<div class="alert alert-${kind}"><div>${title ? `<strong>${A.esc(title)}</strong>` : ''}${A.esc(message || '')}</div></div>`;
  }

  function render(result) {
    const S = A.session.SESSION;
    const attempt = S.attempt;
    const reg = S.registration;

    if (!attempt) {
      mount.innerHTML = `<h1>Round 1 result</h1>
        ${A.ui.emptyState('&#9675;', 'No attempt yet', 'You have not started your Round 1 attempt yet.')}
        <div class="btn-row" style="justify-content:center"><a class="btn btn-primary" href="round1.html">Go to Round 1</a></div>`;
      return;
    }

    if (attempt.status === 'in-progress') {
      mount.innerHTML = `<h1>Round 1 result</h1>
        ${note('info', 'Your attempt is still in progress', 'Finish and submit your attempt to see your result here.')}
        <div class="btn-row" style="margin-top:1.25rem"><a class="btn btn-primary" href="round1.html">Resume attempt</a></div>`;
      return;
    }

    if (!result) {
      mount.innerHTML = `<h1>Round 1 result</h1>
        ${note('info', 'Your result is being prepared',
          'Your attempt has been submitted and is waiting to be scored. Your score and rank will appear here once results are released.')}
        ${attemptCard(attempt, reg)}`;
      return;
    }

    if (!result.releasedToStudent) {
      mount.innerHTML = `<h1>Round 1 result</h1>
        ${note('info', 'Your result is not published yet',
          'You have completed your attempt. Your score and rank will appear here as soon as the organiser releases results to students.')}
        ${attemptCard(attempt, reg)}
        <div class="btn-row" style="margin-top:1.5rem"><a class="btn btn-outline" href="dashboard.html">Back to dashboard</a></div>`;
      return;
    }

    const pctScore = result.maxScore ? A.pct(result.score, result.maxScore) : null;

    mount.innerHTML = `
      <h1>Your Round 1 Result</h1>
      <p class="muted">Your own score and rank are shown here once released, whether or not you appear on the public leaderboard.</p>

      <div class="card card-accent" style="margin-top:1.5rem">
        <div class="round-index">Round 1 &middot; Rapid-Fire Online Qualifier</div>
        <h2 style="font-size:1.4rem;margin-top:.35rem">${A.esc(A.repo.categoryLabel(result.category))}</h2>
        <div class="grid grid-3" style="margin-top:1.5rem;gap:1rem">
          <div class="stat">
            <div class="stat-label">Score</div>
            <div class="stat-value">${A.esc(A.num(result.score))}${result.maxScore ? `<span style="font-size:1rem;color:var(--muted)"> / ${A.esc(A.num(result.maxScore))}</span>` : ''}</div>
            ${pctScore !== null ? `<div class="stat-hint">${pctScore}%</div>` : ''}
          </div>
          <div class="stat burgundy">
            <div class="stat-label">Rank</div>
            <div class="stat-value">${result.rank ? A.esc(A.ordinal(result.rank)) : '—'}</div>
            <div class="stat-hint">in ${A.esc(A.repo.categoryLabel(result.category))}</div>
          </div>
          <div class="stat ${result.qualified ? 'success' : ''}">
            <div class="stat-label">Status</div>
            <div class="stat-value" style="font-size:1.4rem">${result.qualified ? 'Qualified' : 'Not qualified'}</div>
            <div class="stat-hint">${result.qualified ? 'Proceed to Round 2' : 'Thanks for taking part'}</div>
          </div>
        </div>
        <dl class="kv" style="margin-top:1.5rem">
          <dt>Correct answers</dt><dd>${A.esc(A.num(result.correctCount))} of ${A.esc(A.num(result.questionCount))}</dd>
          <dt>Submitted</dt><dd>${A.fmtDateTime(result.submittedAt)}${result.autoSubmitted ? ' (submitted automatically when time ran out)' : ''}</dd>
          <dt>Tie-break rule</dt><dd>${A.esc(tieBreakLabel(result.tieBreak))}</dd>
        </dl>
      </div>

      <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.5rem;align-items:start;margin-top:1.5rem">
        <div class="card">
          <h2 style="font-size:1.15rem">What next?</h2>
          ${result.qualified
            ? `<p class="muted small" style="margin:.5rem 0 .75rem">You have qualified for Round 2, the Mathematical Communication Challenge. Watch the announcements for the submission window.</p>
               <a class="btn btn-primary btn-sm" href="round2.html">Go to Round 2</a>`
            : `<p class="muted small" style="margin:.5rem 0 .75rem">Thank you for taking part in Round 1. Any certificate released by the organiser will appear in your portal.</p>
               <a class="btn btn-outline btn-sm" href="certificates.html">My certificates</a>`}
        </div>
        <div class="card">
          <h2 style="font-size:1.15rem">Public leaderboard</h2>
          <p class="muted small" style="margin:.5rem 0 .75rem">The organiser chooses how many ranked positions are shown publicly. Your own rank above is always yours to see.</p>
          <a class="btn btn-outline btn-sm" href="${A.rootPath('results.html')}">View public results</a>
        </div>
      </div>`;
  }

  function attemptCard(attempt, reg) {
    return `<div class="card" style="margin-top:1.5rem">
      <h2 style="font-size:1.15rem">Your attempt</h2>
      <dl class="kv" style="margin-top:1rem">
        <dt>Category</dt><dd>${A.esc(A.repo.categoryLabel(reg ? reg.category : ''))}</dd>
        <dt>Questions</dt><dd>${A.esc(A.num(attempt.questionCount))}</dd>
        <dt>Started</dt><dd>${A.fmtDateTime(attempt.startedAt)}</dd>
        <dt>Submitted</dt><dd>${A.fmtDateTime(attempt.submittedAt)}</dd>
        <dt>Status</dt><dd>${A.statusBadge(attempt.resultStatus === 'scored' ? 'scored' : 'submitted')}</dd>
      </dl>
      ${attempt.resultStatus === 'scored' ? '' :
        '<p class="field-hint" style="margin-top:1rem;margin-bottom:0">Your answers are with the organiser. Your result and rank appear here once scoring is complete, and results are released with the announcement.</p>'}
    </div>`;
  }

  function tieBreakLabel(t) {
    if (t === 'submission_time') return 'Earlier submission ranked higher in a tie';
    if (t === 'first_to_finish') return 'Earlier finish ranked higher in a tie';
    if (!t) return 'No tie-break applied — equal scores share a rank';
    return 'As configured by the organiser';
  }
})();
