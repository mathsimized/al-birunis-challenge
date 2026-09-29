/* Certificates admin — draft certificates, then release them. Releasing
   makes the certificate visible in the student portal and is the trigger
   for the notification email. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let rows = [], regs = [], finalists = [], bas = [];
  const state = { type: '', released: '' };

  A.admin({
    active: 'admin/certificates.html',
    title: 'Certificates',
    subtitle: 'Draft, release and email',
    onReady: load
  });

  async function load() {
    [rows, regs, finalists, bas] = await Promise.all([
      A.repo.listCertificates(),
      A.repo.listRegistrations(),
      A.round2.listFinalists(),
      A.repo.listBAs()
    ]);
    render();
  }

  function render() {
    const draft = rows.filter((r) => !r.released);
    const sent = rows.filter((r) => r.released);

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Certificates', rows.length, 'All types')}
        ${stat('Drafted, not released', draft.length, draft.length ? 'Students cannot see these yet' : 'Nothing pending')}
        ${stat('Released', sent.length, 'Visible in the student portal')}
        ${stat('Eligible students', regs.length + finalists.length, 'Registered plus finalists')}
      </div>

      ${A.ui.alertBox('info', 'How certificates are attached. ', 'Upload a file to store it with the certificate, or paste a Google Drive link for a larger file. There is no Cloud Storage on this project: it requires a paid plan, so files are kept in Firestore (up to 700 KB) or as a link. Students download from their own portal, and no email is sent.')}

      <div class="callout" style="margin-top:1.5rem">
        <strong>How release works.</strong> A drafted certificate exists only in the admin panel.
        Releasing it puts it in the student's portal immediately and queues the notification email
        to the student's registered address. Withdrawing a release hides it again.
      </div>

      <div class="grid grid-4" style="gap:1rem;margin-top:1.5rem">
        ${bulkCard('participation', 'Participation', 'For every registered student', regs)}
        ${bulkCard('qualifier', 'Round 2 qualifier', 'For students qualified from Round 1', regs.filter((r) => r.qualifiedForRound2))}
        ${bulkCard('finalist', 'Finalist', 'For confirmed Grand Finale finalists', finalists)}
        ${bulkCard('ba', 'Brand Ambassador', 'For approved Brand Ambassadors', bas.filter((b) => b.status === 'approved'))}
      </div>

      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header">
          <h2>All certificates</h2>
          <div class="flex-center">
            <button class="btn btn-primary btn-sm" id="newBtn">Issue single</button>
            <button class="btn btn-outline btn-sm" id="releaseAllBtn">Release all drafts</button>
            <button class="btn btn-outline btn-sm" id="exportBtn">Export</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="toolbar" style="margin-bottom:1rem">
            <div class="field">
              <label for="fType">Type</label>
              <select class="select" id="fType">
                <option value=""${state.type === '' ? ' selected' : ''}>All types</option>
                ${Object.keys(A.repo.CERT_TYPES).map((t) => `<option value="${t}"${state.type === t ? ' selected' : ''}>${A.esc(A.repo.certLabel(t))}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="fReleased">Status</label>
              <select class="select" id="fReleased">
                <option value=""${state.released === '' ? ' selected' : ''}>All</option>
                <option value="draft"${state.released === 'draft' ? ' selected' : ''}>Drafts</option>
                <option value="released"${state.released === 'released' ? ' selected' : ''}>Released</option>
              </select>
            </div>
            <div class="field grow">
              <label for="q">Search</label>
              <input class="input" type="search" id="q" placeholder="Name or code…">
            </div>
          </div>
          <div data-list></div>
        </div>
      </div>`;

    host.querySelector('#fType').addEventListener('change', function () { state.type = this.value; drawList(); });
    host.querySelector('#fReleased').addEventListener('change', function () { state.released = this.value; drawList(); });
    host.querySelector('#q').addEventListener('input', A.debounce(drawList, 150));
    host.querySelector('#newBtn').addEventListener('click', () => issueSingle());
    host.querySelector('#releaseAllBtn').addEventListener('click', function () {
      A.confirmRun({
        title: 'Release every draft certificate?',
        message: 'All ' + draft.length + ' draft certificates become visible in the students\' portals.',
        confirmLabel: 'Release all', button: this, busyLabel: 'Releasing…',
        run: function () { return Promise.all(draft.map((c) => A.repo.releaseCertificate(c.id))); },
        success: 'Certificates released.'
      }).then(load).catch(function () {});
    });
    host.querySelector('#exportBtn').addEventListener('click', function () {
      A.exportCSV('al-birunis-certificates.csv', [
        { key: 'code', label: 'Code' },
        { key: 'type', label: 'Type', csv: (c) => A.repo.certLabel(c.type) },
        { key: 'name', label: 'Student' },
        { key: 'category', label: 'Category', csv: (c) => A.repo.categoryLabel(c.category) },
        { key: 'awardLabel', label: 'Award' },
        { key: 'released', label: 'Released', csv: (c) => (c.released ? 'Yes' : 'No') },
        { key: 'releasedAt', label: 'Released at', csv: (c) => (c.released ? A.fmtDateTime(c.releasedAt) : '') }
      ], rows);
    });

    document.querySelectorAll('[data-bulk]').forEach((b) => b.addEventListener('click', function () {
      bulkIssue(this.getAttribute('data-bulk'));
    }));

    drawList();
  }

  function asset(c) { return A.repo.certificateAsset(c); }

  /* The organiser supplies the file. It goes into Firestore as a data URI
     rather than Cloud Storage, because Cloud Storage needs the Blaze plan. */
  function uploadFile(c, button) {
    if (!c) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/png,image/jpeg,image/webp';
    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (!file) return;
      button.disabled = true;
      A.repo.uploadCertificateFile(c.id, file)
        .then(function () { A.ui.toast('Certificate file attached.', 'ok'); return load(); })
        .catch(function (e) { A.ui.toast(e.message || 'The upload failed.', 'error'); })
        .then(function () { button.disabled = false; });
    });
    input.click();
  }

  /* For a file too large to store in Firestore: save it to Google Drive, set
     the sharing to anyone with the link, and paste that link here. */
  function linkDialog(c) {
    A.ui.formModal('Certificate link', [
      {
        name: 'link', label: 'Shareable link', value: (c && c.link) || '', span: true,
        hint: 'A Google Drive share link works well. Set the file to "anyone with the link can view". Leave empty to remove the link.'
      }
    ], { wide: true }).then(function (v) {
      if (!v) return;
      A.repo.setCertificateLink(c.id, v.link)
        .then(function () { A.ui.toast(v.link ? 'Link saved.' : 'Link removed.', 'ok'); return load(); })
        .catch(function (e) { A.ui.toast(e.message, 'error'); });
    });
  }

  function bulkCard(type, title, sub, pool) {
    const existing = new Set(rows.filter((r) => r.type === type).map((r) => r.uid));
    const pending = pool.filter((p) => !existing.has(p.uid || p.id));
    return `<div class="panel">
      <div class="panel-header"><h2>${A.esc(A.repo.certLabel(type))}</h2></div>
      <div class="panel-body">
        <p class="small muted" style="margin:0 0 .75rem">${A.esc(sub)}</p>
        <dl class="kv">
          <dt>Eligible</dt><dd>${A.esc(A.num(pool.length))}</dd>
          <dt>Already issued</dt><dd>${A.esc(A.num(pool.length - pending.length))}</dd>
          <dt>To issue</dt><dd>${A.esc(A.num(pending.length))}</dd>
        </dl>
        <button class="btn btn-outline btn-sm btn-block" style="margin-top:.75rem" data-bulk="${type}" ${pending.length ? '' : 'disabled'}>Issue to ${A.esc(A.num(pending.length))}</button>
      </div>
    </div>`;
  }

  function drawList() {
    const q = (host.querySelector('#q').value || '').trim().toLowerCase();
    let list = rows;
    if (state.type) list = list.filter((r) => r.type === state.type);
    if (state.released === 'draft') list = list.filter((r) => !r.released);
    if (state.released === 'released') list = list.filter((r) => r.released);
    if (q) list = list.filter((r) => [r.name, r.code, r.awardLabel].join(' ').toLowerCase().indexOf(q) !== -1);
    list = A.sortBy(list, (r) => r.releasedAt || r.createdAt, 'desc');

    document.querySelector('[data-list]').innerHTML = A.table([
      { key: 'code', label: 'Code', render: (c) => `<span class="mono">${A.esc(c.code || '—')}</span>` },
      { key: 'name', label: 'Student', render: (c) => `<strong>${A.esc(c.name || '—')}</strong>${c.awardLabel ? `<div class="small muted">${A.esc(c.awardLabel)}</div>` : ''}` },
      { key: 'type', label: 'Type', render: (c) => A.esc(A.repo.certLabel(c.type)) },
      { key: 'category', label: 'Category', render: (c) => A.esc(A.repo.categoryLabel(c.category)) },
      { key: 'released', label: 'Status', render: (c) => (c.released ? A.statusBadge('approved') : A.statusBadge('pending')) },
      { key: 'file', label: 'File', render: (c) => (asset(c)
        ? '<span class="small">' + A.esc(asset(c).name) + '</span>'
        : '<span class="small muted">None</span>') },
      { key: 'releasedAt', label: 'Released', render: (c) => (c.released ? A.fmtDateTime(c.releasedAt) : '—') },
      {
        label: 'Actions', render: (c) => `<div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-toggle="${A.esc(c.id)}">${c.released ? 'Withdraw' : 'Release'}</button>
          <button class="btn btn-ghost btn-sm" data-file="${A.esc(c.id)}">${asset(c) ? 'Replace file' : 'Upload file'}</button>
          <button class="btn btn-ghost btn-sm" data-link="${A.esc(c.id)}">Link</button>
          <button class="btn btn-ghost btn-sm" data-del="${A.esc(c.id)}">Delete</button>
        </div>`
      }
    ], list, { emptyTitle: 'No certificates yet', emptyMessage: 'Issue one above, or use a bulk button.' });

    document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', function () {
      const btn = this;
      const c = rows.find((x) => x.id === btn.getAttribute('data-toggle'));
      A.confirmRun({
        title: (c.released ? 'Withdraw' : 'Release') + ' this certificate?',
        message: c.released
          ? 'It disappears from the student portal. The notification email cannot be recalled.'
          : 'It becomes visible in the student portal, where the student can view and download it.',
        confirmLabel: c.released ? 'Withdraw' : 'Release', button: btn,
        run: function () {
          return c.released
            ? A.repo.withdrawCertificate(c.id)
            : A.repo.releaseCertificate(c.id);
        },
        success: 'Certificate updated.'
      }).then(load).catch(function () {});
    }));
    document.querySelectorAll('[data-file]').forEach((b) => b.addEventListener('click', function () {
      uploadFile(rows.find((c) => c.id === this.getAttribute('data-file')), this);
    }));
    document.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', function () {
      linkDialog(rows.find((c) => c.id === this.getAttribute('data-link')));
    }));
    document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', function () {
      const btn = this;
      A.confirmRun({
        title: 'Delete this certificate?',
        message: 'This cannot be undone.',
        confirmLabel: 'Delete', button: btn,
        run: function () { return A.repo.deleteCertificate(btn.getAttribute('data-del')); },
        success: 'Certificate deleted.'
      }).then(load).catch(function () {});
    }));
  }

  function poolFor(type) {
    if (type === 'finalist') return finalists.map((f) => ({ uid: f.uid, name: f.name, category: f.category, awardLabel: (A.round2.AWARDS[f.award] || {}).label || 'Finalist' }));
    if (type === 'ba') return bas.filter((b) => b.status === 'approved').map((b) => ({ uid: b.uid || b.id, name: b.name, category: b.category, awardLabel: 'Brand Ambassador' }));
    if (type === 'qualifier') return regs.filter((r) => r.qualifiedForRound2).map((r) => ({ uid: r.uid, name: r.studentName, category: r.category, awardLabel: 'Qualified for Round 2' }));
    return regs.map((r) => ({ uid: r.uid, name: r.studentName, category: r.category, awardLabel: '' }));
  }

  async function bulkIssue(type) {
    const existing = new Set(rows.filter((r) => r.type === type).map((r) => r.uid));
    const pending = poolFor(type).filter((p) => !existing.has(p.uid));
    if (!pending.length) { A.ui.toast('Everyone eligible already has this certificate.', 'error'); return; }
    A.confirmRun({
      title: 'Issue ' + A.repo.certLabel(type) + ' to ' + pending.length + ' ' + A.plural(pending.length, 'student') + '?',
      message: 'Certificates are drafted only. Nothing reaches a student until you release them.',
      confirmLabel: 'Issue', button: document.querySelector('[data-bulk="' + type + '"]'), busyLabel: 'Issuing…',
      run: function () {
        return Promise.all(pending.map((p) => A.repo.issueCertificate({
          uid: p.uid, name: p.name, type: type, category: p.category, awardLabel: p.awardLabel
        })));
      },
      success: 'Certificates drafted.'
    }).then(load).catch(function () {});
  }

  function issueSingle() {
    A.ui.formModal('Issue a certificate', [
      { name: 'type', label: 'Type', type: 'select', value: 'participation', options: Object.keys(A.repo.CERT_TYPES).map((t) => ({ value: t, label: A.repo.certLabel(t) })) },
      { name: 'name', label: 'Name on certificate', required: true },
      { name: 'uid', label: 'Student UID', hint: 'The Firebase user ID so the certificate appears in their portal.' },
      { name: 'category', label: 'Category', type: 'select', value: 'prep', options: A.repo.CATEGORIES.map((c) => ({ value: c.id, label: c.label })) },
      { name: 'awardLabel', label: 'Award or note' }
    ], { wide: true }).then(function (v) {
      if (!v) return;
      return A.repo.issueCertificate(v).then(function () {
        A.ui.toast('Certificate drafted.', 'ok');
        load();
      });
    }).catch(function (err) { A.ui.toast(err.message || 'Could not issue the certificate.', 'error'); });
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
