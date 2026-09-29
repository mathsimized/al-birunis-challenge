/* Users & Access — roles, judges and the judging panel. Judges only ever
   see submissions assigned to them, never scores from other judges. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let users = [], judges = [], regs = [];
  const state = { tab: 'users' };

  A.admin({
    active: 'admin/users.html',
    title: 'Users & Access',
    subtitle: 'Accounts, roles and judges',
    onReady: load
  });

  async function load() {
    [users, judges, regs] = await Promise.all([
      A.repo.listUsers(), A.repo.listJudges(), A.repo.listRegistrations()
    ]);
    render();
  }

  function render() {
    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Accounts', users.length, 'Everyone who has signed in')}
        ${stat('Admins', users.filter((u) => u.role === A.ROLE.ADMIN).length, 'Full access to this panel')}
        ${stat('Judges', judges.length, 'On the Round 2 panel')}
        ${stat('Registered students', regs.length, 'Competition entries')}
      </div>

      <div class="callout" style="margin-top:1.5rem">
        <strong>Least privilege.</strong> Judges receive read access to submissions and can write
        only their own scores. They never see other judges' scores, the aggregate, or the public
        leaderboard. Students have no access to this panel at all.
      </div>

      <div class="tabs" role="tablist" style="margin-top:1.5rem">
        <button class="tab" role="tab" aria-selected="${state.tab === 'users'}" data-tab="users">Accounts &amp; roles</button>
        <button class="tab" role="tab" aria-selected="${state.tab === 'judges'}" data-tab="judges">Judges</button>
      </div>

      <div data-panel="users"></div>
      <div data-panel="judges" ${state.tab === 'judges' ? '' : 'hidden'}></div>`;

    host.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      state.tab = b.getAttribute('data-tab');
      render();
    }));

    usersPanel();
    judgesPanel();
  }

  function usersPanel() {
    const el = host.querySelector('[data-panel="users"]');
    el.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h2>Accounts</h2>
          <div class="flex-center">
            <input class="input" type="search" data-filter placeholder="Search name or email…" style="max-width:260px">
            <button class="btn btn-outline btn-sm" data-export>Export</button>
          </div>
        </div>
        <div class="panel-body">
          <div data-list></div>
        </div>
      </div>`;

    A.filterBar('[data-list]', users, function (list) {
      return A.table([
        { key: 'displayName', label: 'Account', render: (u) => `<strong>${A.esc(u.displayName || '—')}</strong><div class="small muted">${A.esc(u.email || '')}</div>` },
        { key: 'role', label: 'Role', render: (u) => roleBadge(u.role) },
        { key: 'uid', label: 'User ID', render: (u) => `<span class="mono small">${A.esc(A.trunc(u.uid, 12))}</span>` },
        { key: 'createdAt', label: 'First seen', render: (u) => A.fmtDateTime(u.createdAt) },
        {
          label: 'Actions', render: (u) => `<div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-role="${A.esc(u.uid)}">Change role</button>
          </div>`
        }
      ], list, { emptyTitle: 'No accounts match' });
    });

    el.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', function () {
      const u = users.find((x) => x.uid === this.getAttribute('data-role'));
      A.ui.formModal('Change role — ' + (u.displayName || u.email), [
        {
          name: 'role', label: 'Role', type: 'select', value: u.role,
          options: [
            { value: A.ROLE.STUDENT, label: 'Student' },
            { value: A.ROLE.JUDGE, label: 'Judge' },
            { value: A.ROLE.ADMIN, label: 'Administrator' }
          ],
          hint: u.email === A.ADMIN_EMAIL ? 'This account is the configured organiser address and always keeps administrator access.' : ''
        }
      ]).then(function (v) {
        if (!v) return;
        return A.repo.setUserRole(u.uid, v.role)
          .then(function () { A.ui.toast('Role updated.', 'ok'); load(); });
      }).catch(function (err) { A.ui.toast(err.message || 'Could not change the role.', 'error'); });
    }));

    el.querySelector('[data-export]').addEventListener('click', function () {
      A.exportCSV('al-birunis-accounts.csv', [
        { key: 'uid', label: 'User ID' },
        { key: 'displayName', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { key: 'createdAt', label: 'Created at', csv: (u) => A.fmtDateTime(u.createdAt) }
      ], users);
    });
  }

  function judgesPanel() {
    const el = host.querySelector('[data-panel="judges"]');
    el.innerHTML = `
      <div class="grid" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:1.5rem;align-items:start">
        <div class="panel">
          <div class="panel-header">
            <h2>Judging panel</h2>
            <div class="flex-center">
              <button class="btn btn-primary btn-sm" data-new>Add judge</button>
            </div>
          </div>
          <div class="panel-body">
            ${A.table([
              { key: 'name', label: 'Judge', render: (j) => `<strong>${A.esc(j.name || '—')}</strong><div class="small muted">${A.esc(j.email || '')}</div>` },
              { key: 'focus', label: 'Focus', render: (j) => A.esc(j.focus || '—') },
              { key: 'authUid', label: 'Account', render: (j) => (j.authUid ? `<span class="mono small">${A.esc(A.trunc(j.authUid, 12))}</span>` : '<span class="small muted">No account linked</span>') },
              {
                label: 'Actions', render: (j) => `<div class="row-actions">
                  <button class="btn btn-ghost btn-sm" data-edit="${A.esc(j.id)}">Edit</button>
                  <button class="btn btn-ghost btn-sm" data-del="${A.esc(j.id)}">Remove</button>
                </div>`
              }
            ], judges, { emptyTitle: 'No judges yet', emptyMessage: 'Add at least two judges before Round 2 judging begins.' })}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h2>Add a judge</h2></div>
          <div class="panel-body">
            <p class="small muted" style="margin-top:0">A judge needs a MATHSIMIZED account with the
              Judge role. Add the judge here first, then give them the account and set their role to
              Judge on the Accounts tab.</p>
            <ol class="stack small" style="padding-left:1.15rem;margin:1rem 0 0">
              <li>Add the judge below with their name and email.</li>
              <li>Ask them to sign in once so their account is created.</li>
              <li>Set their role to <strong>Judge</strong> on the Accounts tab.</li>
              <li>Copy their user ID into the judge record so scores are attributed correctly.</li>
            </ol>
          </div>
        </div>
      </div>`;

    el.querySelector('[data-new]').addEventListener('click', () => openJudge(null));
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', function () {
      openJudge(judges.find((j) => j.id === this.getAttribute('data-edit')));
    }));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', function () {
      const id = b.getAttribute('data-del');
      A.confirmRun({
        title: 'Remove this judge?',
        message: 'Scores they have already recorded are kept.',
        confirmLabel: 'Remove', button: this,
        run: function () { return A.repo.deleteJudge(id); },
        success: 'Judge removed.'
      }).then(load).catch(function () {});
    }));
  }

  function openJudge(j) {
    const isNew = !j;
    j = j || { name: '', email: '', focus: '', active: true };
    A.ui.formModal(isNew ? 'Add a judge' : 'Edit judge', [
      { name: 'name', label: 'Name', value: j.name || '', required: true },
      { name: 'email', label: 'Email', value: j.email || '' },
      { name: 'focus', label: 'Judging focus', value: j.focus || '', hint: 'For example: mathematical accuracy, presentation clarity.' },
      { name: 'authUid', label: 'Account user ID', value: j.authUid || '', hint: 'Their Firebase user ID, so scores are attributed to them.' },
      { name: 'active', label: 'Active on the panel', type: 'checkbox', value: j.active !== false }
    ]).then(function (v) {
      if (!v) return;
      return A.repo.upsertJudge({
        name: v.name.trim(), email: v.email.trim(), focus: v.focus.trim(),
        authUid: v.authUid.trim(), active: v.active
      }, isNew ? null : j.id).then(function () {
        A.ui.toast(isNew ? 'Judge added.' : 'Judge updated.', 'ok');
        load();
      });
    }).catch(function (err) { A.ui.toast(err.message || 'Could not save the judge.', 'error'); });
  }

  function roleBadge(role) {
    if (role === A.ROLE.ADMIN) return A.statusBadge('finalist');
    if (role === A.ROLE.JUDGE) return A.statusBadge('approved');
    return A.statusBadge('not-registered');
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
