/* Admin panel bootstrap
   Renders the admin shell, enforces the admin role, and provides the small
   helpers every admin page shares (filters, CSV export, confirm-and-run
   actions, table rendering). */

(function (global) {
  'use strict';

  const A = global.ABC;

  /* Bootstrap an admin page. Returns the loaded session. */
  A.admin = function (options) {
    const opts = options || {};
    A.ui.renderAdminNav(opts.active);
    A.ui.renderAdminTopbar(opts.title || 'Admin', opts.subtitle || '');

    return A.session.boot({
      route: opts.route,
      requireAuth: true,
      onReady: async function (S) {
        if (!A.repo.isAdmin(S.record)) {
          showDenied('This area is restricted to competition administrators.');
          return;
        }
        const who = document.querySelector('[data-abc-admindoctorial]');
        if (who) who.textContent = (S.record.displayName || A.user.email) + ' · Admin';
        document.dispatchEvent(new CustomEvent('abc:admin-ready', { detail: S }));
        if (opts.onReady) await opts.onReady(S);
      }
    });
  };

  function showDenied(message) {
    const main = document.querySelector('.admin-main');
    if (!main) return;
    main.innerHTML = `<div class="shell" style="padding:4rem 0;max-width:620px">
      <div class="alert alert-danger"><div><strong>Access denied</strong>${A.esc(message)}</div></div>
      <div class="btn-row" style="margin-top:1.25rem"><a class="btn btn-outline" href="${A.rootPath('index.html')}">Back to the public site</a></div>
    </div>`;
  }

  /* ---------------- table helper ---------------- */
  /* columns: [{ key, label, render?, className? }] */
  A.table = function (columns, rows, options) {
    const o = options || {};
    if (!rows.length) {
      return A.ui.emptyState(o.emptyGlyph || '&#9675;', o.emptyTitle || 'Nothing to show yet', o.emptyMessage || '');
    }
    return `<div class="table-wrap"><table class="data">
      <thead><tr>${columns.map((c) => `<th${c.className ? ' class="' + c.className + '"' : ''}>${A.esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row, i) => `<tr${o.rowClass ? ' class="' + o.rowClass(row) + '"' : ''}>${columns.map((c) => {
        const content = c.render ? c.render(row, i) : A.esc(row[c.key] === null || row[c.key] === undefined || row[c.key] === '' ? '—' : row[c.key]);
        return `<td${c.className ? ' class="' + c.className + '"' : ''}>${content}</td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  };

  /* Simple client-side filter bar. wire(host, rows, renderFn) */
  A.filterBar = function (host, rows, renderFn, placeholder) {
    const el = typeof host === 'string' ? document.querySelector(host) : host;
    if (!el) return;
    el.innerHTML = `
      <div class="filter-bar">
        <input class="input" type="search" data-filter placeholder="${A.esc(placeholder || 'Search…')}" aria-label="Search">
        <div class="filter-count" data-filter-count>${A.esc(A.num(rows.length))} ${A.plural(rows.length, 'row')}</div>
      </div>
      <div data-filter-results></div>`;
    const input = el.querySelector('[data-filter]');
    const results = el.querySelector('[data-filter-results]');
    const count = el.querySelector('[data-filter-count]');

    function apply() {
      const q = input.value.trim().toLowerCase();
      const out = q ? rows.filter((r) => JSON.stringify(r).toLowerCase().indexOf(q) !== -1) : rows;
      count.textContent = `${A.num(out.length)} ${A.plural(out.length, 'row')}${q ? ' matched' : ''}`;
      results.innerHTML = renderFn(out);
    }
    input.addEventListener('input', A.debounce(apply, 150));
    apply();
  };

  /* Run an action behind a confirmation dialog with a busy button. */
  A.confirmRun = function (options) {
    return A.ui.confirmModal(options.title, options.message, options.confirmLabel || 'Confirm')
      .then((ok) => {
        if (!ok) return false;
        const btn = options.button;
        if (btn) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = A.esc(options.busyLabel || 'Working…'); }
        return Promise.resolve(options.run())
          .then((result) => {
            if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; }
            if (options.success) A.ui.toast(options.success, 'ok');
            return result;
          })
          .catch((err) => {
            if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; }
            A.ui.toast((err && err.message) || 'The action failed.', 'error');
            throw err;
          });
      });
  };

  /* Export helper: builds a CSV from rows and downloads it. */
  A.exportCSV = function (filename, columns, rows) {
    if (!rows.length) { A.ui.toast('There is nothing to export yet.', 'error'); return; }
    const head = columns.map((c) => c.label);
    const body = rows.map((r) => columns.map((c) => (c.csv ? c.csv(r) : r[c.key])));
    A.downloadCSV(filename, head, body);
  };

  /* Bind a datetime-local input to a config value (ISO string or null). */
  A.readDateInput = function (input) {
    const v = input && input.value ? input.value.trim() : '';
    return v ? new Date(v).toISOString() : null;
  };

  A.fillDateInput = function (input, value) {
    if (!input) return;
    input.value = A.toInputValue(value);
  };

  global.ABC = A;
})(window);
