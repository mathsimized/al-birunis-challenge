/* Results publication — decide exactly what the public sees and release
   each student's own result. Students always see their own rank; the
   public leaderboard is a separate, admin-controlled cut-off. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let results = [], snapshots = {}, quiz = null, cfg = null;
  const state = { category: 'prep' };

  A.admin({
    active: 'admin/results.html',
    title: 'Results Publication',
    subtitle: 'Public leaderboard and student release',
    onReady: load
  });

  async function load() {
    [results, quiz, cfg] = await Promise.all([
      A.round1.listResults(), A.round1.getQuiz(), A.repo.getConfig()
    ]);
    const snaps = await Promise.all(A.repo.CATEGORY_IDS.map((c) => A.round1.getPublicResults(c)));
    snapshots = {};
    A.repo.CATEGORY_IDS.forEach((c, i) => { snapshots[c] = snaps[i]; });
    render();
  }

  function render() {
    const unreleased = results.filter((r) => !r.releasedToStudent);
    const cat = state.category;
    const catResults = A.sortBy(results.filter((r) => r.category === cat), (r) => A.num(r.rank));
    const snap = snapshots[cat] || { mode: 'hidden', published: false };

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Scored students', results.length, 'All categories')}
        ${stat('Released to students', results.length - unreleased.length, 'Each sees only their own result')}
        ${stat('Still private', unreleased.length, unreleased.length ? 'Not yet published' : 'All released')}
        ${stat('Public leaderboard', Object.values(snapshots).filter((s) => s && s.published).length, 'of 3 categories published')}
      </div>

      <div class="callout" style="margin-top:1.5rem">
        <strong>Two separate decisions.</strong> Releasing a result to a student shows them their own
        score, rank and qualification. Publishing the public leaderboard chooses how many ranked
        positions the public site shows — a student outside that cut-off still sees their own rank.
      </div>

      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header">
          <h2>Public leaderboard — ${A.esc(A.repo.categoryLabel(cat))}</h2>
          <div class="flex-center">
            <button class="btn btn-outline btn-sm" id="previewBtn">Preview</button>
            <button class="btn btn-primary btn-sm" id="publishBtn">Publish</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="toolbar" style="margin-bottom:1rem">
            <div class="field">
              <label for="cat">Category</label>
              <select class="select" id="cat">
                ${A.repo.CATEGORIES.map((c) => `<option value="${c.id}"${c.id === cat ? ' selected' : ''}>${A.esc(c.label)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="mode">How much to publish</label>
              <select class="select" id="mode">
                ${A.round1.PUBLIC_MODES.map((m) => `<option value="${m}"${snap.mode === m ? ' selected' : ''}>${A.esc(modeLabel(m))}</option>`).join('')}
              </select>
            </div>
            <div class="field" id="customWrap" ${snap.mode === 'custom' ? '' : 'hidden'}>
              <label for="custom">Custom number of positions</label>
              <input class="input" type="number" min="0" id="custom" value="${A.esc(A.num(snap.custom, 0))}">
            </div>
            <div class="field">
              <label for="note">Public note (optional)</label>
              <input class="input" type="text" id="note" value="${A.esc(snap.note || '')}" placeholder="e.g. Provisional results">
            </div>
          </div>
          <div class="checkline"><input type="checkbox" id="showNames" ${snap.showNames !== false ? 'checked' : ''}><label for="showNames">Show student names</label></div>
          <div class="checkline"><input type="checkbox" id="showSchools" ${snap.showSchools ? 'checked' : ''}><label for="showSchools">Show schools</label></div>
          <div class="checkline"><input type="checkbox" id="showScores" ${snap.showScores !== false ? 'checked' : ''}><label for="showScores">Show scores</label></div>
          <div class="checkline"><input type="checkbox" id="published" ${snap.published ? 'checked' : ''}><label for="published">Live on the public results page</label></div>
          <p class="field-hint" style="margin-top:.75rem">Current state: ${snap.published
            ? A.esc(A.num((snap.rows || []).length)) + ' positions visible publicly'
            : 'not published — the public page shows nothing for this category'}.</p>
        </div>
      </div>

      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header">
          <h2>Release to students</h2>
          <div class="flex-center">
            <button class="btn btn-outline btn-sm" id="releaseAllBtn">Release this category</button>
            <button class="btn btn-outline btn-sm" id="withholdAllBtn">Withhold this category</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="toolbar" style="margin-bottom:1rem">
            <div class="field grow">
              <label for="q">Search</label>
              <input class="input" type="search" id="q" placeholder="Name or school…">
            </div>
            <div class="field">
              <label for="filter">Show</label>
              <select class="select" id="filter">
                <option value="all">Everyone</option>
                <option value="unreleased">Not yet released</option>
                <option value="released">Released</option>
                <option value="qualified">Qualified only</option>
              </select>
            </div>
          </div>
          <div data-list></div>
        </div>
      </div>`;

    host.querySelector('#cat').addEventListener('change', function () { state.category = this.value; render(); });
    host.querySelector('#q').addEventListener('input', A.debounce(drawList, 150));
    host.querySelector('#filter').addEventListener('change', drawList);
    const modeEl = host.querySelector('#mode');
    modeEl.addEventListener('change', function () {
      host.querySelector('#customWrap').hidden = this.value !== 'custom';
    });

    host.querySelector('#publishBtn').addEventListener('click', function () {
      A.confirmRun({
        title: `Publish the ${A.repo.categoryLabel(cat)} leaderboard?`,
        message: 'The public results page updates immediately with the chosen cut-off. Individual students are not affected by this.',
        confirmLabel: 'Publish', button: this, busyLabel: 'Publishing…',
        run: function () {
          return A.round1.publishCategory(cat, {
            mode: host.querySelector('#mode').value,
            custom: A.num(host.querySelector('#custom').value, 0),
            showNames: host.querySelector('#showNames').checked,
            showSchools: host.querySelector('#showSchools').checked,
            showScores: host.querySelector('#showScores').checked,
            published: host.querySelector('#published').checked,
            note: host.querySelector('#note').value.trim()
          });
        },
        success: 'Public leaderboard updated.'
      }).then(load).catch(function () {});
    });

    host.querySelector('#previewBtn').addEventListener('click', function () {
      const mode = host.querySelector('#mode').value;
      const custom = A.num(host.querySelector('#custom').value, 0);
      const limit = A.round1.publicLimit(mode, custom);
      const rows = catResults.filter((r) => r.rank <= limit);
      A.ui.modal({
        title: 'Public preview — ' + A.repo.categoryLabel(cat),
        wide: true,
        body: rows.length
          ? A.table([
              { key: 'rank', label: 'Rank', className: 'rank-cell', render: (r) => A.esc(A.ordinal(r.rank)) },
              { key: 'name', label: 'Student' },
              { key: 'school', label: 'School' },
              { key: 'score', label: 'Score', className: 'num' }
            ], rows, { rowClass: (r) => (r.rank <= 3 ? 'rank-' + r.rank : '') })
          : A.ui.emptyState('&#9675;', 'Nothing would be published', 'This cut-off shows no positions. Choose a different option.'),
        actions: [{ label: 'Close', value: null, variant: 'secondary' }]
      });
    });

    host.querySelector('#releaseAllBtn').addEventListener('click', function () {
      const list = catResults.filter((r) => !r.releasedToStudent);
      A.confirmRun({
        title: `Release results to ${list.length} ${A.plural(list.length, 'student')}?`,
        message: 'Each student will see their own score, rank and qualification status. The public leaderboard is unchanged.',
        confirmLabel: 'Release', button: this, busyLabel: 'Releasing…',
        run: function () { return Promise.all(list.map((r) => A.round1.setResultReleased(r.uid, true))); },
        success: 'Results released.'
      }).then(load).catch(function () {});
    });

    host.querySelector('#withholdAllBtn').addEventListener('click', function () {
      const list = catResults.filter((r) => r.releasedToStudent);
      A.confirmRun({
        title: `Withhold results from ${list.length} ${A.plural(list.length, 'student')}?`,
        message: 'Those students will go back to seeing "your result is not published yet".',
        confirmLabel: 'Withhold', button: this, busyLabel: 'Updating…',
        run: function () { return Promise.all(list.map((r) => A.round1.setResultReleased(r.uid, false))); },
        success: 'Results withheld.'
      }).then(load).catch(function () {});
    });

    drawList();
  }

  function drawList() {
    const q = (host.querySelector('#q').value || '').trim().toLowerCase();
    const filter = host.querySelector('#filter').value;
    let list = results.filter((r) => !state.category || r.category === state.category);
    if (filter === 'unreleased') list = list.filter((r) => !r.releasedToStudent);
    if (filter === 'released') list = list.filter((r) => r.releasedToStudent);
    if (filter === 'qualified') list = list.filter((r) => r.qualified);
    if (q) list = list.filter((r) => [r.name, r.school, r.city].join(' ').toLowerCase().indexOf(q) !== -1);
    list = A.sortBy(list, (r) => A.num(r.rank));

    document.querySelector('[data-list]').innerHTML = A.table([
      { key: 'rank', label: 'Rank', className: 'rank-cell', render: (r) => A.esc(r.rank ? A.ordinal(r.rank) : '—') },
      { key: 'name', label: 'Student', render: (r) => `<strong>${A.esc(r.name || '—')}</strong><div class="small muted">${A.esc(r.school || '')}</div>` },
      { key: 'score', label: 'Score', className: 'num', render: (r) => `${A.esc(A.num(r.score))}${r.maxScore ? ' / ' + A.esc(A.num(r.maxScore)) : ''}` },
      { key: 'qualified', label: 'Qualified', render: (r) => A.statusBadge(r.qualified ? 'qualified' : 'not-qualified') },
      { key: 'releasedToStudent', label: 'Student can see', render: (r) => (r.releasedToStudent ? A.statusBadge('approved') : A.statusBadge('pending')) },
      {
        label: 'Actions', render: (r) => `<div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-toggle="${A.esc(r.uid)}">${r.releasedToStudent ? 'Withhold' : 'Release'}</button>
        </div>`
      }
    ], list, { emptyTitle: 'No students match', emptyMessage: 'Results appear here once attempts are scored.' });

    document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', function () {
      const btn = this;
      const r = list.find((x) => x.uid === btn.getAttribute('data-toggle'));
      A.round1.setResultReleased(r.uid, !r.releasedToStudent)
        .then(function () { A.ui.toast(r.releasedToStudent ? 'Result withheld.' : 'Result released.', 'ok'); load(); })
        .catch(function (err) { A.ui.toast(err.message || 'Could not update.', 'error'); });
    }));
  }

  function modeLabel(m) {
    return {
      hidden: 'Hidden — publish nothing publicly',
      top10: 'Top 10',
      top25: 'Top 25',
      top50: 'Top 50',
      top100: 'Top 100',
      top150: 'Top 150',
      top200: 'Top 200',
      everyone: 'Everyone — full leaderboard',
      custom: 'A custom number of positions'
    }[m] || m;
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
