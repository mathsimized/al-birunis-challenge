/* Users & Access — who has an account here, and who runs the panel.
   There is no judge role: Round 2 is judged off the platform, so the only
   roles that exist are student and administrator. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let users = [], regs = [];

  A.admin({
    active: 'admin/users.html',
    title: 'Users & Access',
    subtitle: 'Accounts and roles',
    onReady: load
  });

  async function load() {
    [users, regs] = await Promise.all([
      A.repo.listUsers(), A.repo.listRegistrations()
    ]);
    render();
  }

  function render() {
    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Accounts', users.length, 'Everyone who has signed in')}
        ${stat('Admins', users.filter((u) => u.role === A.ROLE.ADMIN).length, 'Full access to this panel')}
        ${stat('Registered students', regs.length, 'Competition entries')}
      </div>

      ${A.ui.alertBox('info', 'Two roles only. ', 'Students can reach their own portal and nothing else. Administrators can reach this panel. The team role is granted automatically to the address you sign in with, so it can never be taken away from you here.')}

      <div data-panel="users"></div>`;

    usersPanel();
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
            { value: A.ROLE.ADMIN, label: 'Administrator' }
          ],
          hint: u.email === A.ADMIN_EMAIL ? 'This account is the configured team address and always keeps administrator access.' : ''
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

  function roleBadge(role) {
    if (role === A.ROLE.ADMIN) return A.statusBadge('finalist');
    return A.statusBadge('not-registered');
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
