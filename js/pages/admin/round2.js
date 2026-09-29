/* Round 2 admin — submissions, and marking finalists.
 *
 * Judging is not done on this platform. The organiser is given the results
 * separately, then ticks the students who qualified and publishes their names.
 * So this page deliberately holds no scores and no rubric: there is nothing
 * here for a score to leak out of, and a browser cannot enforce a marking
 * scheme in the first place. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let cfg = null, submissions = [], finalists = [], catCfg = null;
  const state = { category: '', selected: new Set() };

  A.admin({
    active: 'admin/round2.html',
    title: 'Round 2 — Submissions & finalists',
    subtitle: 'Review submissions and mark who reaches the Grand Finale',
    onReady: load
  });

  async function load() {
    [cfg, catCfg, submissions, finalists] = await Promise.all([
      A.round2.getRound2Config(),
      A.repo.getConfig(),
      A.round2.listSubmissions({}),
      A.round2.listFinalists()
    ]);
    render();
  }

  function isFinalist(uid) { return finalists.some((f) => f.id === uid); }

  function quota() {
    const q = catCfg && catCfg.round2QualifyPerCategory;
    return (q === null || q === undefined || q === '') ? null : A.num(q);
  }

  function render() {
    const list = filtered();
    const st = windowState();
    const q = quota();

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Submissions', submissions.length, st.label)}
        ${stat('Locked', submissions.filter((s) => s.locked).length, 'Students cannot edit these')}
        ${stat('Finalists marked', finalists.length, q === null ? 'Quota not set' : 'Quota: ' + q + ' per category')}
        ${stat('Selected now', state.selected.size, 'Not yet saved')}
      </div>

      ${A.ui.alertBox('info', 'How finalists are chosen. ', 'Marking happens off this website. Read the submissions here, then tick everyone who qualified. Nothing is published until you publish the names on the Finalists page.')}

      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header">
          <h2>Submissions</h2>
          <div class="flex-center">
            <button class="btn btn-primary btn-sm" id="saveBtn" ${state.selected.size ? '' : 'disabled'}>Mark ${state.selected.size} as finalist${state.selected.size === 1 ? '' : 's'}</button>
            <button class="btn btn-outline btn-sm" id="lockAllBtn">Lock all</button>
            <button class="btn btn-outline btn-sm" id="unlockAllBtn">Unlock all</button>
            <button class="btn btn-outline btn-sm" id="exportBtn">Export</button>
            <a class="btn btn-outline btn-sm" href="finalists.html">Publish names</a>
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
    host.querySelector('#saveBtn').addEventListener('click', function () { saveSelection(this); });
    host.querySelector('#exportBtn').addEventListener('click', () => {
      A.exportCSV('al-birunis-round2-submissions.csv', [
        { key: 'studentName', label: 'Student' },
        { key: 'category', label: 'Category', csv: (r) => A.repo.categoryLabel(r.category) },
        { key: 'school', label: 'School' },
        { key: 'title', label: 'Title' },
        { key: 'topic', label: 'Topic' },
        { key: 'driveUrl', label: 'Submission link' },
        { key: 'finalist', label: 'Marked finalist', csv: (r) => (isFinalist(r.uid) ? 'Yes' : 'No') },
        { key: 'submittedAt', label: 'Submitted', csv: (r) => A.fmtDateTime(r.submittedAt) }
      ], list);
    });

    drawTable(list);
    if (state.selected.size) drawDetail();
  }

  function filtered() {
    return A.round2.listByArrival(submissions.filter((s) => !state.category || s.category === state.category));
  }

  function drawTable(list) {
    const el = document.querySelector('[data-table]');
    el.innerHTML = A.table([
      {
        label: 'Finalist', className: 'num', render: (r) => (isFinalist(r.uid) || state.selected.has(r.uid)
          ? A.statusBadge('approved')
          : `<label class="checkline" style="margin:0"><input type="checkbox" data-pick="${A.esc(r.uid)}" ${state.selected.has(r.uid) ? 'checked' : ''}><span class="sr-only">Mark ${A.esc(r.studentName || '')} as a finalist</span></label>`)
      },
      {
        key: 'studentName', label: 'Submission', render: (r) => `<strong>${A.esc(r.studentName || '—')}</strong>
          <div class="small muted">${A.esc(r.title || 'Untitled')}${r.topic ? ' &middot; ' + A.esc(r.topic) : ''}</div>`
      },
      { key: 'category', label: 'Category', render: (r) => A.esc(A.repo.categoryLabel(r.category)) },
      { key: 'school', label: 'School', render: (r) => A.esc(r.school || '—') },
      { key: 'locked', label: 'Editing', render: (r) => (r.locked ? A.statusBadge('locked') : A.statusBadge('in-progress')) },
      {
        label: 'Actions', render: (r) => `<div class="row-actions">
          <button class="btn btn-outline btn-sm" data-open="${A.esc(r.uid)}">${state.selected.has(r.uid) ? 'Close' : 'Open'}</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${A.esc(r.uid)}">${r.locked ? 'Unlock' : 'Lock'}</button>
        </div>`
      }
    ], list, {
      emptyTitle: 'No submissions yet',
      emptyMessage: 'Qualified students submit a Drive link from the student portal.'
    });

    el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('change', function () {
      const uid = this.getAttribute('data-pick');
      if (this.checked) state.selected.add(uid); else state.selected.delete(uid);
      render();
    }));
    el.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', function () {
      const uid = this.getAttribute('data-open');
      if (state.selected.has(uid) && state.selected.size === 1) { state.selected.clear(); render(); return; }
      state.selected.clear();
      state.selected.add(uid);
      render();
    }));
    el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', function () {
      const s = submissions.find((x) => x.uid === this.getAttribute('data-toggle'));
      A.round2.lockSubmission(s.uid, !s.locked)
        .then(function () { A.ui.toast(s.locked ? 'Submission unlocked.' : 'Submission locked.', 'ok'); load(); });
    }));
  }

  function drawDetail() {
    const uid = [...state.selected][0];
    const s = submissions.find((x) => x.uid === uid);
    if (!s) { document.querySelector('[data-detail]').innerHTML = ''; return; }

    const detail = document.querySelector('[data-detail]');
    detail.innerHTML = `
      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header">
          <h2>${A.esc(s.studentName || 'Submission')} — ${A.esc(s.title || '')}</h2>
          <div class="flex-center">
            ${s.driveUrl ? `<a class="btn btn-outline btn-sm" href="${A.esc(s.driveUrl)}" target="_blank" rel="noopener">Open Drive link &#8599;</a>` : ''}
            <button class="btn btn-ghost btn-sm" data-close>Close</button>
          </div>
        </div>
        <div class="panel-body">
          <dl class="kv">
            <dt>Category</dt><dd>${A.esc(A.repo.categoryLabel(s.category))}</dd>
            <dt>School</dt><dd>${A.esc(s.school || '—')}</dd>
            <dt>City</dt><dd>${A.esc(s.city || '—')}</dd>
            <dt>Topic</dt><dd>${A.esc(s.topic || '—')}</dd>
            <dt>Submitted</dt><dd>${A.fmtDateTime(s.submittedAt)}${A.num(s.resubmitCount) > 0 ? ' &middot; updated ' + A.fmtDateTime(s.resubmittedAt) : ''}</dd>
            <dt>Notes</dt><dd>${A.esc(s.notes || '—')}</dd>
          </dl>
        </div>
      </div>`;
    detail.querySelector('[data-close]').addEventListener('click', function () { state.selected.clear(); render(); });
  }

  function saveSelection(btn) {
    const picks = [...state.selected];
    const rows = submissions.filter((s) => picks.indexOf(s.uid) !== -1);
    if (!rows.length) return;
    A.confirmRun({
      title: 'Mark ' + rows.length + ' ' + A.plural(rows.length, 'student') + ' as finalist' + (rows.length === 1 ? '?' : 's?'),
      message: 'These names go to the Grand Finale list. You still have to publish them on the Finalists page before students can see them.\n\n'
        + rows.map((r) => '· ' + (r.studentName || '—') + ' — ' + A.repo.categoryLabel(r.category)).join('\n'),
      confirmLabel: 'Mark as finalist', button: btn, busyLabel: 'Saving…',
      run: function () { return A.round2.confirmSelected(rows, state.category); }
    }).then(function (ok) {
      if (ok) { state.selected.clear(); A.ui.toast('Finalists marked. Publish the names when you are ready.', 'ok'); }
      return load();
    }).catch(function () {});
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
