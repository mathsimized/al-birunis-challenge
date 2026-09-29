/* Round 2 admin — submissions, the judging panel, and finalist selection.
   Each judge scores independently; the aggregate is computed from the
   configured rubric and never shown to students until released. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let cfg = null, submissions = [], judges = [], judgements = {}, results = [], quotal = null, catCfg = null;
  const state = { category: '', selected: null };

  A.admin({
    active: 'admin/round2.html',
    title: 'Round 2 — Submissions & Judging',
    subtitle: 'Submissions, judging panel and ranking',
    onReady: load
  });

  async function load() {
    [cfg, catCfg, submissions, judges, results] = await Promise.all([
      A.round2.getRound2Config(),
      A.repo.getConfig(),
      A.round2.listSubmissions({}),
      A.repo.listJudges(),
      A.round2.listFinalists()
    ]);
    judgements = await A.round2.listAllJudgements();
    if (state.selected && !submissions.some((s) => s.uid === state.selected)) state.selected = null;
    render();
  }

  function render() {
    const list = filtered();
    const ranked = A.round2.rankSubmissions(list, judgements, cfg);
    const st = windowState();

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Submissions', submissions.length, st.label)}
        ${stat('Locked', submissions.filter((s) => s.locked).length, 'Students cannot edit these')}
        ${stat('Judges on the panel', judges.length, judges.length < 2 ? 'Add at least two judges' : 'Assigned by the organiser')}
        ${stat('Finalists confirmed', results.length, 'Quota: ' + (catCfg.round2QualifyPerCategory === null || catCfg.round2QualifyPerCategory === undefined || catCfg.round2QualifyPerCategory === '' ? 'not set' : A.num(catCfg.round2QualifyPerCategory) + ' per category'))}
      </div>

      <div class="callout" style="margin-top:1.5rem">
        <strong>Rubric:</strong>
        ${cfg.rubric && cfg.rubric.length
          ? A.esc(cfg.rubric.map((c) => c.label).join(' · ')) + (cfg.useWeights ? ' — combined as a weighted average' : ' — averaged across judges')
          : 'no criteria set yet, so judges score overall only. Add criteria in Settings before judging begins.'}
        ${cfg.requireAllJudges ? ' A submission counts as complete only when every judge has scored.' : ''}
      </div>

      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header">
          <h2>Submissions &amp; ranking</h2>
          <div class="flex-center">
            <button class="btn btn-outline btn-sm" id="lockAllBtn">Lock all</button>
            <button class="btn btn-outline btn-sm" id="unlockAllBtn">Unlock all</button>
            <button class="btn btn-outline btn-sm" id="exportBtn">Export</button>
            <a class="btn btn-outline btn-sm" href="finalists.html">Finalist selection</a>
          </div>
        </div>
        <div class="panel-body">
          <div class="tabs-pills" style="margin-bottom:1rem">
            <button class="pill ${state.category === '' ? 'active' : ''}" data-cat="">All categories</button>
            ${A.repo.CATEGORIES.map((c) => `<button class="pill ${state.category === c.id ? 'active' : ''}" data-cat="${c.id}">${A.esc(c.label)}</button>`).join('')}
          </div>
          <div data-table></div>
        </div>
      </div>

      <div data-detail></div>`;

    host.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { state.category = b.getAttribute('data-cat'); render(); }));
    host.querySelector('#lockAllBtn').addEventListener('click', function () { setAllLocks(true, this); });
    host.querySelector('#unlockAllBtn').addEventListener('click', function () { setAllLocks(false, this); });
    host.querySelector('#exportBtn').addEventListener('click', () => {
      A.exportCSV('al-birunis-round2-judging.csv', [
        { key: 'rank', label: 'Rank' },
        { key: 'studentName', label: 'Student' },
        { key: 'category', label: 'Category', csv: (r) => A.repo.categoryLabel(r.category) },
        { key: 'title', label: 'Title' },
        { key: 'finalScore', label: 'Final score' },
        { key: 'judgeCount', label: 'Judges scored' },
        { key: 'judgingComplete', label: 'Complete', csv: (r) => (r.judgingComplete ? 'Yes' : 'No') },
        { key: 'submittedAt', label: 'Submitted', csv: (r) => A.fmtDateTime(r.submittedAt) }
      ], ranked);
    });

    drawTable(ranked);
    if (state.selected) drawDetail();
  }

  function filtered() {
    return submissions.filter((s) => !state.category || s.category === state.category);
  }

  function drawTable(ranked) {
    const el = document.querySelector('[data-table]');
    el.innerHTML = A.table([
      { key: 'rank', label: 'Rank', className: 'rank-cell', render: (r) => A.esc(r.rank ? A.ordinal(r.rank) : '—') },
      {
        key: 'studentName', label: 'Submission', render: (r) => `<strong>${A.esc(r.studentName || '—')}</strong>
          <div class="small muted">${A.esc(r.title || 'Untitled')}${r.topic ? ' &middot; ' + A.esc(r.topic) : ''}</div>`
      },
      { key: 'category', label: 'Category', render: (r) => A.esc(A.repo.categoryLabel(r.category)) },
      { key: 'finalScore', label: 'Final score', className: 'num', render: (r) => (r.finalScore === null ? '—' : A.esc(r.finalScore)) },
      {
        key: 'judgeCount', label: 'Judged', render: (r) => `${A.esc(A.num(r.judgeCount))} / ${A.esc(A.num(judges.length))}
          ${r.judgingComplete ? A.statusBadge('approved') : A.statusBadge('pending')}`
      },
      { key: 'locked', label: 'Editing', render: (r) => (r.locked ? A.statusBadge('locked') : A.statusBadge('in-progress')) },
      {
        label: 'Actions', render: (r) => `<div class="row-actions">
          <button class="btn btn-outline btn-sm" data-open="${A.esc(r.uid)}">${state.selected === r.uid ? 'Close' : 'Judge'}</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${A.esc(r.uid)}">${r.locked ? 'Unlock' : 'Lock'}</button>
        </div>`
      }
    ], ranked, {
      rowClass: (r) => (r.rank && r.rank <= 3 ? 'rank-' + r.rank : ''),
      emptyTitle: 'No submissions yet',
      emptyMessage: 'Qualified students submit a Drive link from the student portal.'
    });

    el.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', function () {
      state.selected = state.selected === this.getAttribute('data-open') ? null : this.getAttribute('data-open');
      drawTable(ranked);
      if (state.selected) drawDetail(); else document.querySelector('[data-detail]').innerHTML = '';
    }));
    el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', function () {
      const s = submissions.find((x) => x.uid === this.getAttribute('data-toggle'));
      A.round2.lockSubmission(s.uid, !s.locked)
        .then(function () { A.ui.toast(s.locked ? 'Submission unlocked.' : 'Submission locked.', 'ok'); load(); });
    }));
  }

  function drawDetail() {
    const s = submissions.find((x) => x.uid === state.selected);
    if (!s) { document.querySelector('[data-detail]').innerHTML = ''; return; }
    const mine = judgements[s.uid] || [];
    const agg = A.round2.aggregate(cfg, mine);
    const mineByJudge = {};
    mine.forEach((j) => { mineByJudge[j.judgeUid] = j; });

    const detail = document.querySelector('[data-detail]');
    detail.innerHTML = `
      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header">
          <h2>${A.esc(s.studentName || 'Submission')} — ${A.esc(s.title || '')}</h2>
          <div class="flex-center">
            ${agg.finalScore !== null ? `<span class="badge badge-burgundy">Aggregate ${A.esc(agg.finalScore)} / 100</span>` : A.statusBadge('pending')}
            <a class="btn btn-outline btn-sm" href="${A.esc(s.driveUrl)}" target="_blank" rel="noopener">Open Drive link &#8599;</a>
          </div>
        </div>
        <div class="panel-body">
          <dl class="kv">
            <dt>Category</dt><dd>${A.esc(A.repo.categoryLabel(s.category))}</dd>
            <dt>School</dt><dd>${A.esc(s.school || '—')}</dd>
            <dt>Topic</dt><dd>${A.esc(s.topic || '—')}</dd>
            <dt>Submitted</dt><dd>${A.fmtDateTime(s.submittedAt)}${A.num(s.resubmitCount) > 0 ? ' &middot; updated ' + A.fmtDateTime(s.resubmittedAt) : ''}</dd>
            <dt>Notes</dt><dd>${A.esc(s.notes || '—')}</dd>
            <dt>Judged by</dt><dd>${mine.length} of ${judges.length} judges</dd>
          </dl>

          <h3 style="margin-top:1.5rem">Judge scores</h3>
          ${judges.length ? A.table([
            { key: 'name', label: 'Judge', render: (j) => `<strong>${A.esc(j.name || '—')}</strong>${j.focus ? `<div class="small muted">${A.esc(j.focus)}</div>` : ''}` },
            { key: 'scored', label: 'Scored', render: (j) => (mineByJudge[j.id] ? A.statusBadge('approved') : A.statusBadge('pending')) },
            { key: 'total', label: 'Total', className: 'num', render: (j) => { const t = A.round2.judgeTotal(mineByJudge[j.id], cfg.rubric); return t === null || isNaN(t) ? '—' : A.esc(t); } },
            { key: 'updatedAt', label: 'Updated', render: (j) => (mineByJudge[j.id] ? A.fmtDateTime(mineByJudge[j.id].updatedAt) : '—') },
            { label: '', render: (j) => `<button class="btn btn-ghost btn-sm" data-score="${A.esc(j.id)}">${mineByJudge[j.id] ? 'Edit' : 'Score'}</button>` }
          ], judges) : A.ui.emptyState('&#9675;', 'No judges yet', 'Add judges in Users & Access before judging begins.')}

          <details style="margin-top:1.25rem">
            <summary class="small muted" style="cursor:pointer">Full judge breakdown</summary>
            <div data-breakdown style="margin-top:.75rem"></div>
          </details>
        </div>
      </div>`;

    detail.querySelectorAll('[data-score]').forEach((b) => b.addEventListener('click', function () {
      const judgeId = this.getAttribute('data-score');
      openScorer(s, judgeId, mineByJudge[judgeId]);
    }));

    const bd = detail.querySelector('[data-breakdown]');
    if (mine.length) {
      bd.innerHTML = mine.map((j) => {
        const judge = judges.find((x) => x.id === j.judgeUid) || {};
        return `<div style="margin-bottom:1rem">
          <strong>${A.esc(judge.name || j.judgeUid)}</strong>
          ${j.comment ? `<div class="small muted" style="margin:.25rem 0">${A.esc(j.comment)}</div>` : ''}
          <dl class="kv">${Object.keys(j.criteria || {}).map((c) => {
            const crit = (cfg.rubric || []).find((r) => r.id === c);
            return `<dt>${A.esc(crit ? crit.label : c)}</dt><dd>${A.esc(A.num(j.criteria[c]))}${crit ? ' / ' + A.esc(A.num(crit.max, 10)) : ''}</dd>`;
          }).join('')}</dl>
        </div>`;
      }).join('');
    } else {
      bd.innerHTML = '<p class="small muted">No scores recorded yet.</p>';
    }
  }

  /* ---------------- scorer modal ---------------- */
  function openScorer(submission, judgeId, existing) {
    const judge = judges.find((j) => j.id === judgeId) || {};
    /* Judgements are keyed by the judge's Firebase user id where known, so
       the judge's own portal and this panel write the same document. */
    const judgeUid = A.round2.judgeKey(judge);
    const criteria = cfg.rubric || [];
    const current = (existing && existing.criteria) || {};

    const fields = criteria.map((c) => ({
      name: 'c_' + c.id,
      label: c.label + (c.hint ? ' — ' + c.hint : ''),
      type: 'number',
      value: current[c.id] === undefined ? '' : current[c.id]
    }));
    if (!criteria.length) {
      fields.push({ name: 'overall', label: 'Overall score (0–100)', type: 'number', value: existing ? existing.overall || '' : '' });
    }
    fields.push({ name: 'comment', label: 'Private judge comment', type: 'textarea', span: true, rows: 3, value: (existing && existing.comment) || '', hint: 'Only administrators see this. It is never shown to students.' });

    A.ui.formModal('Score — ' + (judge.name || 'judge'), fields, { wide: true }).then(function (v) {
      if (!v) return;
      const payload = { judgeName: judge.name || '', comment: v.comment || '' };
      if (criteria.length) {
        payload.criteria = {};
        criteria.forEach((c) => { payload.criteria[c.id] = A.num(v['c_' + c.id], 0); });
      } else {
        payload.overall = A.num(v.overall, 0);
      }
      return A.round2.saveJudgement(submission.uid, judgeUid, payload)
        .then(function () { A.ui.toast('Score saved.', 'ok'); load(); });
    }).catch(function (err) { A.ui.toast(err.message || 'Could not save the score.', 'error'); });
  }

  function setAllLocks(locked, btn) {
    const list = filtered().filter((s) => s.locked !== locked);
    A.confirmRun({
      title: (locked ? 'Lock' : 'Unlock') + ' ' + list.length + ' ' + A.plural(list.length, 'submission') + '?',
      message: locked
        ? 'Students will no longer be able to change their Drive link.'
        : 'Students will be able to change their Drive link again.',
      confirmLabel: locked ? 'Lock all' : 'Unlock all', button: btn, busyLabel: 'Working…',
      run: function () { return Promise.all(list.map((s) => A.round2.lockSubmission(s.uid, locked))); },
      success: 'Done.'
    }).then(load).catch(function () {});
  }

  function windowState() {
    const o = A.toDate(cfg.opensAt), c = A.toDate(cfg.closesAt), now = Date.now();
    if (cfg.status === 'draft') return { label: 'Draft — not open to students' };
    if (o && now < o.getTime()) return { label: 'Opens ' + A.fmtDateTime(o) };
    if (c && now > c.getTime()) return { label: 'Closed ' + A.fmtDateTime(c) };
    return { label: 'Submissions open' };
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
