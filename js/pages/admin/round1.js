/* Round 1 admin — attempts, scoring and the live leaderboard.
   Scoring is a trusted-context action: the answer key never leaves the
   server-side/admin path, and students only ever see their own result. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let attempts = [], results = [], quiz = null, cfg = null;
  const state = { category: '', status: '' };

  A.admin({
    active: 'admin/round1.html',
    title: 'Round 1 — Attempts & Leaderboard',
    subtitle: 'Scoring, ranks and qualification',
    onReady: load
  });

  async function load() {
    [attempts, results, quiz, cfg] = await Promise.all([
      A.round1.listAttempts({}), A.round1.listResults(), A.round1.getQuiz(), A.repo.getConfig()
    ]);
    render();
  }

  function render() {
    const unscored = attempts.filter((a) => a.status !== 'in-progress' && a.resultStatus !== 'scored');
    const inProgress = attempts.filter((a) => a.status === 'in-progress');
    const quota = quiz.qualifyPerCategory !== null && quiz.qualifyPerCategory !== undefined
      ? quiz.qualifyPerCategory : cfg.round1QualifyPerCategory;
    const st = A.round1Availability(quiz, null);

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Attempts started', attempts.length, inProgress.length + ' in progress')}
        ${stat('Submitted', attempts.filter((a) => a.status !== 'in-progress').length, '')}
        ${stat('Awaiting scoring', unscored.length, unscored.length ? 'Needs attention' : 'All scored')}
        ${stat('Qualified', results.filter((r) => r.qualified).length, 'Quota: ' + (quota === null || quota === undefined || quota === '' ? 'not set' : A.num(quota) + ' per category'))}
      </div>

      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header"><h2>Round 1 status</h2><span class="badge ${st.code === 'open' ? 'badge-ok' : st.code === 'closed' ? 'badge-muted' : 'badge-info'}">${A.esc(A.titleCase(st.code))}</span></div>
        <div class="panel-body">
          <div class="btn-row">
            <button class="btn btn-outline btn-sm" id="scoreAllBtn">Score all pending</button>
            <button class="btn btn-outline btn-sm" id="rebuildBtn">Rebuild leaderboard</button>
            <a class="btn btn-outline btn-sm" href="results.html">Publication settings</a>
            <a class="btn btn-outline btn-sm" href="questions.html">Question bank</a>
          </div>
          <dl class="kv" style="margin-top:1rem">
            <dt>Window</dt><dd>${A.esc(A.round1WindowLabel(quiz))}</dd>
            <dt>Questions per attempt</dt><dd>${quiz.questionCount ? A.esc(A.num(quiz.questionCount)) : 'All active questions in the category'}</dd>
            <dt>Time limit</dt><dd>${quiz.timeLimitMinutes ? A.esc(A.num(quiz.timeLimitMinutes)) + ' minutes' : 'No limit'}</dd>
            <dt>Tie-break</dt><dd>${A.esc(tieLabel(quiz.tieBreak))}</dd>
          </dl>
        </div>
      </div>

      <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.5rem;align-items:start;margin-top:1.5rem">
        <div class="panel">
          <div class="panel-header"><h2>Leaderboard</h2></div>
          <div class="panel-body">
            <div class="tabs-pills" style="margin-bottom:1rem">
              <button class="pill ${state.category === '' ? 'active' : ''}" data-cat="">All</button>
              ${A.repo.CATEGORIES.map((c) => `<button class="pill ${state.category === c.id ? 'active' : ''}" data-cat="${c.id}">${A.esc(c.label)}</button>`).join('')}
            </div>
            <div data-board></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h2>Attempts</h2><span class="badge badge-muted">${A.esc(A.num(attempts.length))}</span></div>
          <div class="panel-body">
            <div class="toolbar" style="margin-bottom:1rem">
              <div class="field grow">
                <label for="q">Search</label>
                <input class="input" type="search" id="q" placeholder="Name, school or email…">
              </div>
              <div class="field">
                <label for="status">Status</label>
                <select class="select" id="status">
                  <option value="">Any</option>
                  <option value="in-progress"${state.status === 'in-progress' ? ' selected' : ''}>In progress</option>
                  <option value="submitted"${state.status === 'submitted' ? ' selected' : ''}>Submitted</option>
                  <option value="scored"${state.status === 'scored' ? ' selected' : ''}>Scored</option>
                </select>
              </div>
            </div>
            <div data-attempts></div>
          </div>
        </div>
      </div>`;

    host.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { state.category = b.getAttribute('data-cat'); render(); }));
    host.querySelector('#status').addEventListener('change', function () { state.status = this.value; drawAttempts(); });
    host.querySelector('#q').addEventListener('input', A.debounce(function () { drawAttempts(); }, 150));

    host.querySelector('#scoreAllBtn').addEventListener('click', function () {
      A.confirmRun({
        title: 'Score all pending attempts?',
        message: 'Every submitted attempt without a score will be marked against the answer key and added to the leaderboard.',
        confirmLabel: 'Score all', button: this, busyLabel: 'Scoring…',
        run: function () { return A.round1.scoreAllPending(); },
        success: 'Pending attempts scored.'
      }).then(load).catch(function () {});
    });

    host.querySelector('#rebuildBtn').addEventListener('click', function () {
      A.confirmRun({
        title: 'Rebuild the leaderboard?',
        message: 'Ranks and qualification flags are recalculated from scored attempts. Already released results stay released.',
        confirmLabel: 'Rebuild', button: this, busyLabel: 'Rebuilding…',
        run: function () { return A.round1.rebuildResults(); },
        success: 'Leaderboard rebuilt.'
      }).then(load).catch(function () {});
    });

    drawBoard();
    drawAttempts();
  }

  function drawBoard() {
    const list = A.sortBy(results.filter((r) => !state.category || r.category === state.category), (r) => A.num(r.rank));
    const el = document.querySelector('[data-board]');
    el.innerHTML = A.table([
      { key: 'rank', label: 'Rank', className: 'rank-cell', render: (r) => A.esc(r.rank ? A.ordinal(r.rank) : '—') },
      { key: 'name', label: 'Student', render: (r) => `<strong>${A.esc(r.name || '—')}</strong><div class="small muted">${A.esc(r.school || '')}</div>` },
      { key: 'category', label: 'Category', render: (r) => A.esc(A.repo.categoryLabel(r.category)) },
      { key: 'score', label: 'Score', className: 'num', render: (r) => `${A.esc(A.num(r.score))}${r.maxScore ? ' / ' + A.esc(A.num(r.maxScore)) : ''}` },
      { key: 'qualified', label: 'Status', render: (r) => A.statusBadge(r.qualified ? 'qualified' : 'not-qualified') },
      { key: 'releasedToStudent', label: 'Published', render: (r) => (r.releasedToStudent ? A.statusBadge('approved') : A.statusBadge('pending')) }
    ], list, {
      rowClass: (r) => (r.rank && r.rank <= 3 ? 'rank-' + r.rank : ''),
      emptyTitle: 'No scored results yet',
      emptyMessage: 'Score pending attempts to build the leaderboard.'
    });
  }

  function drawAttempts() {
    const q = (host.querySelector('#q').value || '').trim().toLowerCase();
    const list = attempts.filter((a) => {
      if (state.status === 'in-progress' && a.status !== 'in-progress') return false;
      if (state.status === 'submitted' && !(a.status !== 'in-progress' && a.resultStatus !== 'scored')) return false;
      if (state.status === 'scored' && a.resultStatus !== 'scored') return false;
      if (!q) return true;
      return [a.studentName, a.school, a.city, a.email].join(' ').toLowerCase().indexOf(q) !== -1;
    });

    A.sortBy(list, (a) => a.submittedAt || a.startedAt, 'desc');
    document.querySelector('[data-attempts]').innerHTML = A.table([
      { key: 'studentName', label: 'Student', render: (a) => `<strong>${A.esc(a.studentName || '—')}</strong><div class="small muted">${A.esc(a.school || '')}</div>` },
      { key: 'category', label: 'Category', render: (a) => A.esc(A.repo.categoryLabel(a.category)) },
      { key: 'status', label: 'Status', render: (a) => A.statusBadge(a.status === 'in-progress' ? 'in-progress' : a.resultStatus === 'scored' ? 'scored' : 'submitted') },
      { key: 'score', label: 'Score', className: 'num', render: (a) => (a.resultStatus === 'scored' ? `${A.esc(A.num(a.score))} / ${A.esc(A.num(a.maxScore))}` : '—') },
      { key: 'submittedAt', label: 'Submitted', render: (a) => (a.submittedAt ? A.fmtDateTime(a.submittedAt) : '<span class="small muted">In progress</span>') },
      {
        label: 'Actions', render: (a) => `<div class="row-actions">
          ${a.resultStatus !== 'scored' && a.status !== 'in-progress' ? `<button class="btn btn-outline btn-sm" data-score="${A.esc(a.uid)}">Score</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-detail="${A.esc(a.uid)}">Detail</button>
          ${a.status !== 'in-progress' ? `<button class="btn btn-ghost btn-sm" data-reopen="${A.esc(a.uid)}">Reopen</button>` : ''}
        </div>`
      }
    ], list, { emptyTitle: 'No attempts match', emptyMessage: 'Attempts appear here as students start Round 1.' });

    document.querySelectorAll('[data-score]').forEach((b) => b.addEventListener('click', function () {
      const btn = this;
      A.confirmRun({
        title: 'Score this attempt?',
        message: 'The attempt is marked against the answer key and the leaderboard is updated for this student.',
        confirmLabel: 'Score', button: btn, busyLabel: 'Scoring…',
        run: function () { return A.round1.scoreAttempt(btn.getAttribute('data-score')); },
        success: 'Attempt scored.'
      }).then(load).catch(function () {});
    }));

    document.querySelectorAll('[data-reopen]').forEach((b) => b.addEventListener('click', function () {
      const btn = this;
      A.confirmRun({
        title: 'Reopen this attempt?',
        message: 'The student will be able to continue the attempt again. Use this only for a genuine technical fault.',
        confirmLabel: 'Reopen', button: btn,
        run: function () { return A.round1.reopenAttempt(btn.getAttribute('data-reopen')); },
        success: 'Attempt reopened.'
      }).then(load).catch(function () {});
    }));

    document.querySelectorAll('[data-detail]').forEach((b) => b.addEventListener('click', function () {
      showDetail(this.getAttribute('data-detail'));
    }));
  }

  function showDetail(uid) {
    const a = attempts.find((x) => x.uid === uid);
    if (!a) return;
    const breakdown = a.breakdown || {};
    const rows = (a.questions || []).map((q, i) => {
      const b = breakdown[String(i)] || {};
      return {
        n: i + 1,
        text: q.text,
        type: q.type,
        given: b.given,
        correct: b.correct,
        marks: b.marksAwarded,
        ok: b.isCorrect
      };
    });
    A.ui.modal({
      title: 'Attempt detail',
      wide: true,
      body: `<dl class="kv">
          <dt>Student</dt><dd>${A.esc(a.studentName || '—')} (${A.esc(a.category || '')})</dd>
          <dt>School</dt><dd>${A.esc(a.school || '—')}</dd>
          <dt>Started</dt><dd>${A.fmtDateTime(a.startedAt)}</dd>
          <dt>Submitted</dt><dd>${a.submittedAt ? A.fmtDateTime(a.submittedAt) : 'In progress'}</dd>
          <dt>Score</dt><dd>${a.resultStatus === 'scored' ? A.esc(A.num(a.score)) + ' / ' + A.esc(A.num(a.maxScore)) : 'Not scored'}</dd>
        </dl>
        <h4 style="margin-top:1.25rem">Answers</h4>
        ${A.table([
          { key: 'n', label: '#', className: 'num' },
          { key: 'text', label: 'Question', render: (r) => A.esc(A.trunc(r.text, 70)) },
          { key: 'given', label: 'Given', render: (r) => `<span class="mono">${A.esc(fmtAnswer(r.given))}</span>` },
          { key: 'correct', label: 'Key', render: (r) => `<span class="mono">${A.esc(fmtAnswer(r.correct))}</span>` },
          { key: 'marks', label: 'Marks', className: 'num', render: (r) => A.esc(A.num(r.marks)) },
          { key: 'ok', label: '', render: (r) => (r.ok ? '<span class="badge badge-ok">Correct</span>' : '<span class="badge badge-muted">Wrong</span>') }
        ], rows, { emptyTitle: 'No answers recorded' })}
        ${a.resultStatus !== 'scored' ? '<p class="field-hint" style="margin-top:.75rem">Correct answers are only revealed after the attempt is scored.</p>' : ''}`,
      actions: [{ label: 'Close', value: null, variant: 'secondary' }]
    });
  }

  function fmtAnswer(v) {
    if (v === null || v === undefined || v === '') return '—';
    return Array.isArray(v) ? v.join(', ') : String(v);
  }

  function tieLabel(t) {
    if (t === 'submission_time') return 'Earlier submission ranks higher in a tie';
    if (t === 'first_to_finish') return 'Earlier finish ranks higher in a tie';
    return 'No tie-break — equal scores share a rank';
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
