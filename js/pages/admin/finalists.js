/* Finalists — who reaches the Grand Finale, their award, and publishing.
 *
   Judging happens off the platform, so there is no ranked list and no score
   here. The team works from the results they were given, confirms the
   students by name, and then releases the list. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let cfg = null, finale = null, submissions = [], finalists = [];
  const state = { category: '' };

  A.admin({
    active: 'admin/finalists.html',
    title: 'Finalist Selection',
    subtitle: 'Who reaches the Grand Finale',
    onReady: load
  });

  async function load() {
    [cfg, finale, submissions, finalists] = await Promise.all([
      A.round2.getRound2Config(), A.round2.getFinaleConfig(),
      A.round2.listSubmissions({}), A.round2.listFinalists()
    ]);
    render();
  }

  function render() {
    const listed = A.round2.listByArrival(submissions.filter((s) => !state.category || s.category === state.category));
    const quotaRaw = cfg.quotaPerCategory;
    const confirmed = finalists.filter((f) => !state.category || f.category === state.category);

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Submissions', listed.length, 'Round 2 entries in this view')}
        ${stat('Finalists confirmed', finalists.length, 'Across all categories')}
        ${stat('Released to students', finalists.filter((f) => f.released).length, 'Finalist area visible')}
        ${stat('Awards set', finalists.filter((f) => f.award).length, '')}
      </div>

      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header"><h2>Confirm finalists by name</h2></div>
        <div class="panel-body">
          ${A.ui.alertBox('info', 'Confirm each student yourself. ', 'The results were given to you off this website, so there is no ranking to calculate here. Tick a name to confirm them as a finalist.')}
          <div class="field" style="max-width:320px;margin:1rem 0">
            <label for="cat">Category</label>
            <select class="select" id="cat">
              <option value=""${state.category === '' ? ' selected' : ''}>All categories</option>
              ${A.repo.CATEGORIES.map((c) => `<option value="${c.id}"${state.category === c.id ? ' selected' : ''}>${A.esc(c.label)}</option>`).join('')}
            </select>
          </div>
          <div data-table></div>
        </div>
      </div>

      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header">
          <h2>Confirmed finalists</h2>
          <div class="flex-center">
            <button class="btn btn-outline btn-sm" id="exportBtn">Export</button>
            <a class="btn btn-outline btn-sm" href="certificates.html">Issue certificates</a>
          </div>
        </div>
        <div class="panel-body">
          <div class="callout" style="margin-bottom:1rem">
            Thirty finalists reach the Grand Finale in Karachi on 29 November 2026. Awards are set per
            category: one winner, one runner-up and one honourable mention.
          </div>
          <div data-finalists></div>
        </div>
      </div>`;

    host.querySelector('#cat').addEventListener('change', function () { state.category = this.value; render(); });
    host.querySelector('#exportBtn').addEventListener('click', function () {
      A.exportCSV('al-birunis-finalists.csv', [
        { key: 'name', label: 'Student' },
        { key: 'category', label: 'Category', csv: (f) => A.repo.categoryLabel(f.category) },
        { key: 'school', label: 'School' },
        { key: 'city', label: 'City' },
        { key: 'award', label: 'Award', csv: (f) => (A.round2.AWARDS[f.award] || {}).label || '' },
        { key: 'released', label: 'Released', csv: (f) => (f.released ? 'Yes' : 'No') }
      ], finalists);
    });

    drawRanked(listed);
    drawFinalists(confirmed);
  }

  function drawRanked(listed) {
    const el = document.querySelector('[data-table]');
    el.innerHTML = A.table([
      { key: 'studentName', label: 'Student', render: (r) => `<strong>${A.esc(r.studentName || '—')}</strong><div class="small muted">${A.esc(r.school || '')}${r.city ? ' · ' + A.esc(r.city) : ''}</div>` },
      { key: 'category', label: 'Category', render: (r) => A.esc(A.repo.categoryLabel(r.category)) },
      { key: 'title', label: 'Presentation', render: (r) => `<div>${A.esc(r.title || 'Untitled')}</div>${r.topic ? `<div class="small muted">${A.esc(r.topic)}</div>` : ''}` },
      { key: 'submittedAt', label: 'Submitted', render: (r) => A.fmtDateTime(r.submittedAt) },
      {
        label: 'Finalist', render: (r) => (finalists.some((f) => f.uid === r.uid)
          ? A.statusBadge('finalist')
          : `<button class="btn btn-outline btn-sm" data-confirm="${A.esc(r.uid)}">Confirm</button>`)
      }
    ], listed, {
      emptyTitle: 'No submissions',
      emptyMessage: 'Round 2 submissions appear here once students submit them.'
    });

    el.querySelectorAll('[data-confirm]').forEach((b) => b.addEventListener('click', function () {
      const uid = this.getAttribute('data-confirm');
      const s = submissions.find((x) => x.uid === uid);
      A.round2.confirmFinalist(uid, {
        name: s.studentName, school: s.school, city: s.city, category: s.category,
        source: 'round2', email: s.email
      }).then(function () { A.ui.toast('Finalist confirmed.', 'ok'); load(); })
        .catch(function (err) { A.ui.toast(err.message || 'Could not confirm.', 'error'); });
    }));
  }

  function drawFinalists(list) {
    const el = document.querySelector('[data-finalists]');
    el.innerHTML = A.table([
      { key: 'name', label: 'Student', render: (f) => `<strong>${A.esc(f.name || '—')}</strong><div class="small muted">${A.esc(f.school || '')}${f.city ? ' · ' + A.esc(f.city) : ''}</div>` },
      { key: 'category', label: 'Category', render: (f) => A.esc(A.repo.categoryLabel(f.category)) },
      { key: 'award', label: 'Award', render: (f) => awardSelect(f) },
      { key: 'finalRank', label: 'Final rank', render: (f) => `<input class="input" style="width:90px" type="number" min="1" data-finalrank="${A.esc(f.uid)}" value="${f.finalRank === undefined || f.finalRank === null ? '' : A.esc(f.finalRank)}">` },
      { key: 'released', label: 'Finalist area', render: (f) => (f.released ? A.statusBadge('approved') : A.statusBadge('pending')) },
      {
        label: 'Actions', render: (f) => `<div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-release="${A.esc(f.uid)}">${f.released ? 'Withdraw' : 'Release'}</button>
          <button class="btn btn-ghost btn-sm" data-cert="${A.esc(f.uid)}">Certificate</button>
          <button class="btn btn-ghost btn-sm" data-remove="${A.esc(f.uid)}">Remove</button>
        </div>`
      }
    ], list, { emptyTitle: 'No finalists confirmed', emptyMessage: 'Confirm from the list above.' });

    el.querySelectorAll('[data-award]').forEach((sel) => sel.addEventListener('change', function () {
      const f = finalists.find((x) => x.uid === this.getAttribute('data-award'));
      A.round2.confirmFinalist(f.uid, { award: this.value })
        .then(function () { A.ui.toast('Award updated.', 'ok'); load(); });
    }));
    el.querySelectorAll('[data-finalrank]').forEach((inp) => inp.addEventListener('change', function () {
      const f = finalists.find((x) => x.uid === this.getAttribute('data-finalrank'));
      A.round2.saveFinalistResult(f.uid, { finalRank: A.num(this.value, 0) || null })
        .then(function () { A.ui.toast('Final rank saved.', 'ok'); });
    }));
    el.querySelectorAll('[data-release]').forEach((b) => b.addEventListener('click', function () {
      const f = finalists.find((x) => x.uid === this.getAttribute('data-release'));
      A.round2.setFinalistReleased(f.uid, !f.released)
        .then(function () { A.ui.toast(f.released ? 'Withdrawn.' : 'Released to the student.', 'ok'); load(); });
    }));
    el.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', function () {
      const btn = this;
      const f = finalists.find((x) => x.uid === btn.getAttribute('data-remove'));
      A.confirmRun({
        title: 'Remove this finalist?',
        message: 'They will no longer have access to the finalist area. Any certificates already issued are unaffected.',
        confirmLabel: 'Remove', button: btn,
        run: function () { return A.round2.removeFinalist(f.uid); },
        success: 'Finalist removed.'
      }).then(load).catch(function () {});
    }));
    el.querySelectorAll('[data-cert]').forEach((b) => b.addEventListener('click', function () {
      const f = finalists.find((x) => x.uid === this.getAttribute('data-cert'));
      issueCert('finalist', f);
    }));
  }

  function awardSelect(f) {
    return `<select class="select" style="max-width:180px" data-award="${A.esc(f.uid)}">
      <option value=""${!f.award ? ' selected' : ''}>Finalist</option>
      ${Object.keys(A.round2.AWARDS).map((k) => `<option value="${k}"${f.award === k ? ' selected' : ''}>${A.esc(A.round2.AWARDS[k].label)}</option>`).join('')}
    </select>`;
  }

  /* Shared with the certificates page. */
  async function issueCert(type, subject) {
    await A.ui.formModal('Issue a ' + A.repo.certLabel(type), [
      { name: 'uid', label: 'Student UID', value: subject.uid, required: true },
      { name: 'name', label: 'Name on certificate', value: subject.name || subject.studentName || '', required: true },
      { name: 'category', label: 'Category', type: 'select', value: subject.category, options: A.repo.CATEGORIES.map((c) => ({ value: c.id, label: c.label })) },
      { name: 'awardLabel', label: 'Award or note', value: (A.round2.AWARDS[subject.award] || {}).label || '' }
    ], { wide: true }).then(async function (v) {
      if (!v) return;
      await A.repo.issueCertificate({
        uid: v.uid, name: v.name, type: type, category: v.category, awardLabel: v.awardLabel
      });
      A.ui.toast('Certificate drafted. Attach the file, then release it, on the Certificates page.', 'ok');
    });
  }
  A.adminIssueCert = issueCert;

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
