/* Judge scoring sheet.
 *
 * A judge sees the submissions, the rubric, and their own scores — and
 * nothing else. Other judges' scores, the aggregate and the public ranking
 * are not readable to this role, and nothing here asks the server for them. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let cfg = null, submissions = [], mine = [], state = { category: '', only: 'todo' };

  A.judge({
    active: 'judge/index.html',
    title: 'Judging Panel',
    subtitle: 'Round 2 presentations',
    onReady: load
  });

  async function load() {
    cfg = await A.round2.getRound2Config();
    const [subs, myJudgements] = await Promise.all([
      A.round2.listSubmissions({}),
      fetchMyJudgements()
    ]);
    submissions = subs;
    mine = myJudgements;
    render();
  }

  async function fetchMyJudgements() {
    /* One live query on the judge's own uid. The rules make this the only
       judgement a judge can read. */
    return new Promise(function (resolve) {
      A.db.collection('abc_round2_judgements')
        .where('judgeUid', '==', A.user.uid)
        .get()
        .then(function (s) {
          resolve(s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }));
        })
        .catch(function () { resolve([]); });
    });
  }

  function rubric() {
    return (cfg && cfg.rubric) || [];
  }

  function mineFor(submissionUid) {
    return mine.find((j) => j.submissionUid === submissionUid) || null;
  }

  function isComplete(sub) {
    const j = mineFor(sub.uid);
    if (!j) return false;
    const r = rubric();
    if (r.length) return r.every((c) => j.criteria && j.criteria[c.id] !== undefined && j.criteria[c.id] !== null);
    return j.overall !== undefined && j.overall !== null;
  }

  function render() {
    const r = rubric();
    const todo = submissions.filter((s) => !isComplete(s));
    const done = submissions.filter((s) => isComplete(s));
    const visible = (state.category ? submissions.filter((s) => s.category === state.category) : submissions)
      .filter((s) => (state.only === 'todo' ? !isComplete(s) : state.only === 'done' ? isComplete(s) : true));

    if (!r.length) {
      host.innerHTML = `
        <h1>Judging Panel</h1>
        ${A.ui.alertBox('warn', 'The rubric is not set yet',
          'The organiser has not finalised the Round 2 scoring criteria, so there is nothing to score against. You will be able to score once the rubric is published.')}
        <p class="muted small" style="margin-top:1rem">${visible.length} submission(s) are waiting.</p>`;
      return;
    }

    host.innerHTML = `
      <div class="grid grid-3" style="gap:1rem;margin-bottom:1.5rem">
        ${stat('Waiting for you', todo.length, 'Not yet scored')}
        ${stat('Scored by you', done.length, 'Saved to your sheet')}
        ${stat('Submissions', submissions.length, cfg.requireAllJudges ? 'All judges score each one' : 'Any judge is enough')}
      </div>

      ${A.ui.alertBox('info', 'What you can see',
      'Only your own scores appear here. Other judges&rsquo; scores and the overall ranking stay with the organiser, so every judgement is independent.')}

      <div class="toolbar" style="margin-top:1.5rem">
        <select class="select" id="fCat" style="max-width:220px">
          <option value="">All categories</option>
          ${A.repo.CATEGORIES.map((c) => `<option value="${c.id}"${state.category === c.id ? ' selected' : ''}>${A.esc(c.label)}</option>`).join('')}
        </select>
        <div class="tabs-pills">
          <button class="pill ${state.only === 'todo' ? 'active' : ''}" data-only="todo">To score (${todo.length})</button>
          <button class="pill ${state.only === 'done' ? 'active' : ''}" data-only="done">Scored (${done.length})</button>
          <button class="pill ${state.only === 'all' ? 'active' : ''}" data-only="all">All (${submissions.length})</button>
        </div>
      </div>

      <div class="stack" style="margin-top:1.25rem" data-list></div>`;

    host.querySelector('#fCat').addEventListener('change', function () { state.category = this.value; render(); });
    host.querySelectorAll('[data-only]').forEach((b) => b.addEventListener('click', function () {
      state.only = this.getAttribute('data-only'); render();
    }));

    drawList(visible);
  }

  function drawList(list) {
    const el = host.querySelector('[data-list]');
    if (!list.length) {
      el.innerHTML = A.ui.emptyState('&#10003;', 'Nothing waiting',
        'Every submission in this filter has been scored by you.');
      return;
    }
    el.innerHTML = list.map((s) => {
      const j = mineFor(s.uid);
      return `<article class="panel">
        <div class="panel-header">
          <h2>${A.esc(s.title || 'Untitled presentation')}</h2>
          <div class="flex-center">
            <span class="badge badge-muted">${A.esc(A.repo.categoryLabel(s.category))}</span>
            ${isComplete(s) ? A.statusBadge('approved') : A.statusBadge('pending')}
          </div>
        </div>
        <div class="panel-body">
          <dl class="kv">
            <dt>Student</dt><dd>${A.esc(s.studentName || '—')}</dd>
            <dt>School</dt><dd>${A.esc(s.school || '—')}</dd>
            <dt>Topic</dt><dd>${A.esc(s.topic || '—')}</dd>
            <dt>Submitted</dt><dd>${A.fmtDateTime(s.submittedAt)}</dd>
            ${s.linkTitle ? `<dt>Link title</dt><dd>${A.esc(s.linkTitle)}</dd>` : ''}
          </dl>
          ${s.driveUrl ? `<p style="margin:1rem 0 0"><a class="btn btn-outline btn-sm" href="${A.esc(s.driveUrl)}" target="_blank" rel="noopener noreferrer">Open the presentation &#8599;</a></p>` : '<p class="field-hint">No presentation link was submitted.</p>'}
          ${j && j.comment ? `<div class="callout" style="margin-top:1rem"><strong>Your comment:</strong> ${A.esc(j.comment)}</div>` : ''}
          <div class="btn-row" style="margin-top:1rem">
            <button class="btn btn-primary btn-sm" data-score="${A.esc(s.uid)}">${j ? 'Edit my scores' : 'Score this'}</button>
          </div>
        </div>
      </article>`;
    }).join('');

    el.querySelectorAll('[data-score]').forEach((b) => b.addEventListener('click', function () {
      const sub = submissions.find((s) => s.uid === this.getAttribute('data-score'));
      openScorer(sub);
    }));
  }

  function openScorer(sub) {
    const r = rubric();
    const existing = mineFor(sub.uid);
    const current = (existing && existing.criteria) || {};
    const fields = r.map((c) => ({
      name: 'c_' + c.id,
      label: c.label + (c.max ? ` (0–${c.max})` : ''),
      type: 'number',
      min: 0,
      max: A.num(c.max, 10),
      value: current[c.id] === undefined || current[c.id] === null ? '' : current[c.id],
      hint: c.description || ''
    }));
    fields.push({
      name: 'comment', label: 'Your notes', type: 'textarea', span: true, rows: 3,
      value: (existing && existing.comment) || '',
      hint: 'Private to you and the organiser. Never shown to the student.'
    });

    A.ui.formModal('Score — ' + (sub.title || sub.studentName), fields, { wide: true }).then(function (v) {
      if (!v) return;
      const criteria = {};
      let complete = true;
      r.forEach((c) => {
        const max = A.num(c.max, 10) || 10;
        const raw = v['c_' + c.id];
        const n = raw === '' || raw === null || raw === undefined ? null : A.num(raw, NaN);
        if (n === null || !isFinite(n)) { complete = false; return; }
        criteria[c.id] = Math.max(0, Math.min(max, n));
      });
      if (!complete) {
        A.ui.toast('Please give a score for every criterion, or clear one to leave it unscored.', 'error');
        return;
      }
      const btn = document.querySelector('[data-score="' + sub.uid + '"]');
      A.ui.setBusy(btn, true);
      return A.round2.saveJudgement(sub.uid, A.user.uid, { criteria: criteria, comment: v.comment || '' })
        .then(function () { A.ui.toast('Your scores are saved.', 'ok'); return load(); })
        .catch(function (err) { A.ui.toast(err.message || 'Could not save your scores.', 'error'); })
        .then(function () { A.ui.setBusy(btn, false); });
    }).catch(function () {});
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
