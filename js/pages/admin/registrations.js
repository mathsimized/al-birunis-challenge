/* Registrations — browse, filter, correct and export every entry. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let rows = [], quiz = null, cfg = null;

  A.admin({
    active: 'admin/registrations.html',
    title: 'Registrations',
    subtitle: 'Every student entry',
    onReady: load
  });

  async function load() {
    [rows, quiz, cfg] = await Promise.all([
      A.repo.listRegistrations(), A.round1.getQuiz(), A.repo.getConfig()
    ]);
    render();
  }

  function render() {
    const quota = quiz.qualifyPerCategory !== null && quiz.qualifyPerCategory !== undefined
      ? quiz.qualifyPerCategory : cfg.round1QualifyPerCategory;

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${card('Total registrations', rows.length, 'All categories')}
        ${card('Prep', rows.filter((r) => r.category === 'prep').length, 'Category')}
        ${card('O-Level', rows.filter((r) => r.category === 'olevel').length, 'Category')}
        ${card('A-Level', rows.filter((r) => r.category === 'alevel').length, 'Category')}
      </div>

      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header">
          <h2>All registrations</h2>
          <div class="flex-center">
            <button class="btn btn-outline btn-sm" id="exportBtn">Export CSV</button>
            <button class="btn btn-outline btn-sm" id="rebuildBtn">Rebuild qualification</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="tabs-pills" style="margin-bottom:1rem">
            <button class="pill ${state.filter === 'all' ? 'active' : ''}" data-filter="all">All</button>
            ${A.repo.CATEGORIES.map((c) => `<button class="pill ${state.filter === c.id ? 'active' : ''}" data-filter="${c.id}">${A.esc(c.label)}</button>`).join('')}
            <button class="pill ${state.filter === 'qualified' ? 'active' : ''}" data-filter="qualified">Qualified for Round 2</button>
            <button class="pill ${state.filter === 'ba' ? 'active' : ''}" data-filter="ba">Brand Ambassador attributed</button>
          </div>
          <div data-list></div>
        </div>
      </div>

      <div class="callout" style="margin-top:1.5rem">
        <strong>Qualification quota:</strong>
        ${quota === null || quota === undefined || quota === ''
          ? 'not set. Qualification is recorded manually and is not applied automatically.'
          : A.esc(A.num(quota)) + ' per category, applied by rebuilding the Round 1 leaderboard.'}
      </div>`;

    host.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => { state.filter = btn.getAttribute('data-filter'); render(); });
    });
    host.querySelector('#exportBtn').addEventListener('click', exportCsv);
    host.querySelector('#rebuildBtn').addEventListener('click', function () {
      const btn = this;
      A.confirmRun({
        title: 'Rebuild Round 1 qualification?',
        message: 'This re-scores the leaderboard from submitted attempts, recalculates ranks, and rewrites which students are qualified for Round 2. Results already released to students stay released.',
        confirmLabel: 'Rebuild',
        button: btn,
        busyLabel: 'Rebuilding…',
        run: function () { return A.round1.rebuildResults(); },
        success: 'Leaderboard and qualification rebuilt.'
      }).then(load).catch(function () {});
    });

    drawList();
  }

  const state = { filter: 'all' };

  function filtered() {
    if (state.filter === 'all') return rows;
    if (state.filter === 'qualified') return rows.filter((r) => r.qualifiedForRound2);
    if (state.filter === 'ba') return rows.filter((r) => r.baAttribution);
    return rows.filter((r) => r.category === state.filter);
  }

  function drawList() {
    A.filterBar('[data-list]', filtered(), function (list) {
      return A.table([
        { key: 'studentName', label: 'Student', render: (r) => `<strong>${A.esc(r.studentName || '—')}</strong><div class="small muted">${A.esc(r.email || '')}</div>` },
        { key: 'category', label: 'Category', render: (r) => A.esc(A.repo.categoryLabel(r.category)) },
        { key: 'school', label: 'School', render: (r) => `${A.esc(r.school || '—')}<div class="small muted">${A.esc(r.city || '')}${r.grade ? ' &middot; ' + A.esc(r.grade) : ''}</div>` },
        { key: 'registeredAt', label: 'Registered', render: (r) => A.fmtDateTime(r.registeredAt) },
        { key: 'qualifiedForRound2', label: 'Round 2', render: (r) => A.statusBadge(r.qualifiedForRound2 ? 'qualified' : 'not-qualified') },
        { key: 'baAttribution', label: 'Ambassador', render: (r) => r.baAttribution ? `<span class="badge badge-muted">${A.esc(r.baAttribution.code)}</span>` : '—' },
        { key: 'parentContact', label: 'Contact' },
        {
          label: 'Actions', render: (r) => `<div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-edit="${A.esc(r.uid || r.id)}">Edit</button>
          </div>`
        }
      ], list, {
        emptyTitle: 'No registrations match',
        emptyMessage: state.filter === 'all' ? 'Registrations appear here as students sign up.' : 'Try a different filter.'
      });
    }, 'Search name, school, city or email…');

    document.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openEditor(btn.getAttribute('data-edit')));
    });
  }

  function openEditor(uid) {
    const reg = rows.find((r) => (r.uid || r.id) === uid);
    if (!reg) return;
    A.ui.formModal('Edit registration', [
      { name: 'studentName', label: 'Full name', value: reg.studentName || '', required: true },
      { name: 'category', label: 'Category', type: 'select', value: reg.category, options: A.repo.CATEGORIES.map((c) => ({ value: c.id, label: c.label })) },
      { name: 'school', label: 'School', value: reg.school || '' },
      { name: 'city', label: 'City', value: reg.city || '' },
      { name: 'grade', label: 'Grade / year', value: reg.grade || '' },
      { name: 'parentContact', label: 'Parent contact', value: reg.parentContact || '' },
      { name: 'qualifiedForRound2', label: 'Qualified for Round 2', type: 'checkbox', value: !!reg.qualifiedForRound2 }
    ]).then(function (values) {
      if (!values) return;
      const patch = {
        studentName: values.studentName.trim(),
        category: values.category,
        school: values.school.trim(),
        city: values.city.trim(),
        grade: values.grade.trim(),
        parentContact: values.parentContact.trim(),
        qualifiedForRound2: values.qualifiedForRound2 === true || values.qualifiedForRound2 === 'on'
      };
      return A.repo.updateRegistration(uid, patch)
        .then(function () { A.ui.toast('Registration updated.', 'ok'); load(); });
    }).catch(function (err) { A.ui.toast(err.message || 'Could not save.', 'error'); });
  }

  function exportCsv() {
    A.exportCSV('al-birunis-registrations.csv', [
      { key: 'studentName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'category', label: 'Category', csv: (r) => A.repo.categoryLabel(r.category) },
      { key: 'school', label: 'School' },
      { key: 'city', label: 'City' },
      { key: 'grade', label: 'Grade' },
      { key: 'parentContact', label: 'Parent contact' },
      { key: 'registeredAt', label: 'Registered at', csv: (r) => A.fmtDateTime(r.registeredAt) },
      { key: 'qualifiedForRound2', label: 'Qualified for Round 2', csv: (r) => (r.qualifiedForRound2 ? 'Yes' : 'No') },
      { key: 'round1Rank', label: 'Round 1 rank' },
      { key: 'baAttribution', label: 'Brand Ambassador code', csv: (r) => (r.baAttribution ? r.baAttribution.code : '') }
    ], rows);
  }

  function card(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
