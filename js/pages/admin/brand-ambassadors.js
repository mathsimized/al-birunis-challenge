/* Brand Ambassadors admin.
 *
 * Applications arrive on a Google Form, so this panel adds them, issues the
 * codes, credits registrations, and publishes the public top five.
 *
 * Everything here is administrator-only. The attributed counts never leave this
 * screen: the public page reads a separate snapshot that holds names and ranks
 * and no counts at all.
 */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  const FORM_URL = 'https://forms.gle/QvNTaC4cwCdNzzzR7';
  let rows = [], cfg = null, regs = [];
  const state = { status: 'approved' };

  A.admin({
    active: 'admin/brand-ambassadors.html',
    title: 'Brand Ambassadors',
    subtitle: 'Codes, attributed registrations and the public top five',
    onReady: load
  });

  async function load() {
    [rows, cfg, regs] = await Promise.all([
      A.repo.listBAs(), A.repo.getConfig(), A.repo.listRegistrations()
    ]);
    render();
  }

  function render() {
    const pending = rows.filter((r) => r.status === 'pending');
    const approved = rows.filter((r) => r.status === 'approved');
    const ranked = A.repo.baLeaderboard(rows);
    const close = A.toDate(cfg.baApplicationsCloseAt);
    const open = A.toDate(cfg.baApplicationsOpenAt);
    const applicationsOpen = (!open || Date.now() >= open.getTime()) &&
      (!close || Date.now() <= close.getTime());
    const unattributed = regs.filter((r) => r.baCode && r.attributedCounted !== true);
    const best = ranked[0];

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Ambassadors', rows.length, 'On record')}
        ${stat('Awaiting approval', pending.length, pending.length ? 'Needs a decision' : 'All reviewed')}
        ${stat('Approved', approved.length, 'Codes are active')}
        ${stat('Registrations attributed', A.num(approved.reduce((n, b) => n + A.num(b.attributedCount), 0)), 'Private to you')}
      </div>

      <div class="callout" style="margin-top:1.5rem">
        <strong>Applications:</strong> ${open ? 'open from ' + A.esc(A.fmtDate(open)) : 'no opening date set'} ·
        ${close ? 'close ' + A.esc(A.fmtDate(close)) : 'no closing date set'} ·
        <strong>${applicationsOpen ? 'currently open' : 'currently closed'}</strong>.
        There is no minimum or maximum number of ambassadors.
      </div>

      ${A.ui.alertBox('info', 'Privacy. ', 'Registration counts are visible only in this panel. Publishing the top five writes names and ranks to the public page and nothing else — no count is ever included. The Best Brand Ambassador is announced at the Grand Finale award ceremony, not on this site.')}

      <div class="grid" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:1.5rem;align-items:start;margin-top:1.5rem">
        <div class="panel">
          <div class="panel-header">
            <h2>Ambassadors</h2>
            <div class="flex-center">
              <button class="btn btn-primary btn-sm" id="addBtn">Add applicant</button>
              <button class="btn btn-outline btn-sm" id="exportBtn">Export</button>
            </div>
          </div>
          <div class="panel-body">
            <div class="callout" style="margin:0 0 1rem">
              Applicants apply on the
              <a href="${A.esc(FORM_URL)}" target="_blank" rel="noopener">Brand Ambassador Google Form</a>.
              Add each applicant here with <em>Add applicant</em>, or open the form's
              response sheet and use <em>Paste from sheet</em>.
            </div>
            <div class="tabs-pills" style="margin-bottom:1rem">
              <button class="pill ${state.status === 'approved' ? 'active' : ''}" data-status="approved">Approved (${approved.length})</button>
              <button class="pill ${state.status === 'pending' ? 'active' : ''}" data-status="pending">Pending (${pending.length})</button>
              <button class="pill ${state.status === 'rejected' ? 'active' : ''}" data-status="rejected">Not approved (${rows.filter((r) => r.status === 'rejected').length})</button>
              <button class="pill ${state.status === '' ? 'active' : ''}" data-status="">All (${rows.length})</button>
            </div>
            <div data-list></div>
          </div>
        </div>

        <div class="stack">
          <div class="panel">
            <div class="panel-header"><h2>Attributed registrations</h2></div>
            <div class="panel-body">
              <p class="small muted" style="margin-top:0">Ranked strictly by attributed
                registrations. These numbers are never published.</p>
              ${unattributed.length ? `
                ${A.ui.alertBox('warn', unattributed.length + ' registration(s) ', 'carr' + (unattributed.length === 1 ? 'ies' : 'y') + ' a Brand Ambassador code that has not been credited yet.')}
                <button class="btn btn-primary btn-sm" id="attributeBtn" style="margin-top:.75rem">Credit them now</button>` : ''}
              ${A.table([
                { key: 'rank', label: 'Rank', className: 'rank-cell', render: (b) => A.esc(A.ordinal(b.rank)) },
                { key: 'name', label: 'Ambassador', render: (b) => `<strong>${A.esc(b.name || '—')}</strong><div class="small muted">${A.esc(b.code || '')}</div>` },
                { key: 'attributedCount', label: 'Registrations', className: 'num', render: (b) => A.esc(A.num(b.attributedCount)) }
              ], ranked, { rowClass: (b) => (b.rank <= 3 ? 'rank-' + b.rank : ''), emptyTitle: 'No approved ambassadors yet' })}
              ${best ? `<p class="field-hint" style="margin-top:.75rem">On current numbers the
                Best Brand Ambassador is <strong>${A.esc(best.name)}</strong> with
                ${A.num(best.attributedCount)} attributed registrations. This is for your
                planning only — it is not published.</p>` : ''}
            </div>
          </div>

          <div class="panel">
            <div class="panel-header"><h2>Public top five</h2></div>
            <div class="panel-body">
              <p class="small muted" style="margin-top:0">Publishing shows the top five
                names and ranks on the Brand Ambassadors page, with no counts. Announce it
                on <a href="${A.esc(cfg.instagramUrl || 'https://www.instagram.com/al_birunis_challenge/')}" target="_blank" rel="noopener">Instagram</a> too.</p>
              <div class="btn-row" style="margin-top:1rem">
                <button class="btn btn-primary btn-sm" id="publishBtn">Publish top five</button>
                <button class="btn btn-ghost btn-sm" id="unpublishBtn">Take down</button>
              </div>
              <div data-published style="margin-top:1rem"></div>
            </div>
          </div>
        </div>
      </div>`;

    host.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
      state.status = b.getAttribute('data-status'); render();
    }));

    host.querySelector('#addBtn').addEventListener('click', function () { addDialog(); });
    host.querySelector('#exportBtn').addEventListener('click', function () {
      A.exportCSV('al-birunis-brand-ambassadors.csv', [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'contact', label: 'Contact' },
        { key: 'category', label: 'Category', csv: (b) => A.repo.categoryLabel(b.category) },
        { key: 'school', label: 'School' },
        { key: 'city', label: 'City' },
        { key: 'status', label: 'Status' },
        { key: 'attributedCount', label: 'Attributed registrations (private)' },
        { key: 'createdAt', label: 'Added at', csv: (b) => A.fmtDateTime(b.createdAt) }
      ], rows);
    });

    const attrBtn = host.querySelector('#attributeBtn');
    if (attrBtn) attrBtn.addEventListener('click', function () {
      A.confirmRun({
        title: 'Credit attributed registrations?',
        message: 'Every competition registration that carries a Brand Ambassador code will be credited to that ambassador. A registration is only ever credited once, and codes that are unknown or not yet active are skipped and listed.',
        confirmLabel: 'Credit', button: this, busyLabel: 'Crediting…',
        run: () => A.repo.attributeRegistrations(),
        success: 'Registrations credited.'
      }).then(function (res) {
        if (res && res.credited && res.credited.length) {
          A.ui.toast(res.credited.length + ' registration(s) credited.', 'ok');
        }
        if (res && res.skipped && res.skipped.length) {
          A.ui.toast(res.skipped.length + ' skipped — unknown code, or ambassador not approved.', 'warn');
        }
        load();
      }).catch(function () {});
    });

    host.querySelector('#publishBtn').addEventListener('click', function () {
      A.confirmRun({
        title: 'Publish the top five?',
        message: 'The top five names and ranks go live on the Brand Ambassadors page immediately. No registration count is published. The Best Brand Ambassador is not included — that is announced at the Grand Finale.',
        confirmLabel: 'Publish', button: this, busyLabel: 'Publishing…',
        run: () => A.repo.publishPublicBATopFive(5),
        success: 'Top five published.'
      }).then(load).catch(function () {});
    });

    host.querySelector('#unpublishBtn').addEventListener('click', function () {
      A.repo.unpublishPublicBATopFive()
        .then(function () { A.ui.toast('Top five taken down.', 'ok'); load(); });
    });

    drawList();
    drawPublished();
  }

  function drawPublished() {
    const mount = host.querySelector('[data-published]');
    A.repo.onPublicBATopFive(function (data) {
      if (!data || !data.published || !data.rows || !data.rows.length) {
        mount.innerHTML = '<p class="field-hint" style="margin:0">Nothing is published on the site right now.</p>';
        return;
      }
      mount.innerHTML = '<p class="field-hint" style="margin:0 0 .5rem">Published '
        + A.esc(A.fmtDateTime(data.publishedAt)) + ' — names and ranks only:</p>'
        + data.rows.map((r) => `<div class="small">${A.esc(A.ordinal(r.rank))}. ${A.esc(r.name)}</div>`).join('');
    });
  }

  function drawList() {
    const list = state.status ? rows.filter((r) => r.status === state.status) : rows;
    const ordered = A.sortBy(list, (r) => r.createdAt, 'desc');

    host.querySelector('[data-list]').innerHTML = A.table([
      { key: 'name', label: 'Ambassador', render: (b) => `<strong>${A.esc(b.name || '—')}</strong><div class="small muted">${A.esc(b.email || '')}${b.contact ? ' · ' + A.esc(b.contact) : ''}</div>` },
      { key: 'school', label: 'School', render: (b) => `${A.esc(b.school || '—')}${b.city ? '<div class="small muted">' + A.esc(b.city) + '</div>' : ''}` },
      { key: 'category', label: 'Category', render: (b) => A.esc(A.repo.categoryLabel(b.category)) },
      { key: 'code', label: 'Code', render: (b) => `<span class="mono">${A.esc(b.code || '—')}</span>` },
      { key: 'attributedCount', label: 'Registrations', className: 'num', render: (b) => A.esc(A.num(b.attributedCount)) },
      { key: 'status', label: 'Status', render: (b) => A.statusBadge(b.status) },
      {
        label: 'Actions', render: (b) => `<div class="row-actions">
          ${b.status !== 'approved' ? `<button class="btn btn-outline btn-sm" data-approve="${A.esc(b.id)}">Approve</button>` : ''}
          ${b.status === 'approved' ? `<button class="btn btn-ghost btn-sm" data-revoke="${A.esc(b.id)}">Revoke</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-edit="${A.esc(b.id)}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-copy="${A.esc(b.code)}">Copy code</button>
          <button class="btn btn-ghost btn-sm" data-del="${A.esc(b.id)}">Delete</button>
        </div>`
      }
    ], ordered, { emptyTitle: 'Nothing here', emptyMessage: 'Add applicants from the Google Form responses.' });

    host.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', function () {
      const btn = this;
      btn.disabled = true;
      A.repo.setBAStatus(btn.getAttribute('data-approve'), 'approved')
        .then(function () { A.ui.toast('Ambassador approved. Their code is now active.', 'ok'); })
        .catch(function (e) { A.ui.toast(e.message, 'error'); })
        .then(function () { btn.disabled = false; load(); });
    }));

    host.querySelectorAll('[data-revoke]').forEach((b) => b.addEventListener('click', function () {
      A.confirmRun({
        title: 'Revoke this ambassador?',
        message: 'Their code stops working immediately. Registrations already credited to them are kept.',
        confirmLabel: 'Revoke', button: this,
        run: () => A.repo.setBAStatus(this.getAttribute('data-revoke'), 'rejected'),
        success: 'Ambassador revoked.'
      }).then(load).catch(function () {});
    }));

    host.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', function () {
      addDialog(rows.find((r) => r.id === this.getAttribute('data-edit')));
    }));

    host.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', function () {
      A.copyToClipboard(this.getAttribute('data-copy'));
      A.ui.toast('Code copied.', 'ok');
    }));

    host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', function () {
      const code = this.getAttribute('data-del');
      A.confirmRun({
        title: 'Delete this ambassador?',
        message: 'The record and its attributed count are removed. Registrations that carry the code are left alone.',
        confirmLabel: 'Delete', button: this,
        run: () => A.repo.deleteBA(code),
        success: 'Ambassador deleted.'
      }).then(load).catch(function () {});
    }));
  }

  /* Add or edit one applicant. The fields mirror the Google Form. */
  async function addDialog(existing) {
    const b = existing || {};
    const data = await A.ui.formModal(existing ? 'Edit ambassador' : 'Add ambassador', [
      { name: 'name', label: 'Full name', value: b.name, required: true },
      { name: 'email', label: 'Email', type: 'email', value: b.email },
      { name: 'contact', label: 'Contact number', value: b.contact },
      {
        name: 'category', label: 'Category to promote', type: 'select',
        value: b.category || (A.repo.CATEGORIES[0] || {}).id,
        options: A.repo.CATEGORIES.map((c) => ({ value: c.id, label: c.label }))
      },
      { name: 'school', label: 'School / institution', value: b.school },
      { name: 'city', label: 'City', value: b.city },
      {
        name: 'code', label: 'Code', value: b.code, span: true,
        hint: 'Leave blank to generate one. This is the code the ambassador types on the competition registration form.'
      },
      {
        name: 'status', label: 'Status', type: 'select', value: b.status || 'approved',
        options: [
          { value: 'approved', label: 'Approved — the code is active' },
          { value: 'pending', label: 'Pending review' }
        ]
      }
    ], { submitLabel: existing ? 'Save changes' : 'Add ambassador', wide: true });

    if (!data) return;
    try {
      if (existing) {
        await A.repo.updateBA(existing.id, data);
        A.ui.toast('Ambassador updated.', 'ok');
      } else {
        const code = await A.repo.createBA(data);
        A.ui.toast('Added. Code: ' + code, 'ok');
      }
      load();
    } catch (e) {
      A.ui.toast(e.message || 'That could not be saved.', 'error');
    }
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
