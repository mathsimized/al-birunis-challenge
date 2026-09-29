/* My certificates — released certificates only, with download and the
   file can be viewed and downloaded from this page. */
(function () {
  'use strict';
  const A = ABC;
  const mount = document.querySelector('[data-certs]');

  A.portal({
    active: 'student/certificates.html',
    route: 'student/certificates.html',
    onReady: function () {
      A.repo.onCertificatesForUser(A.user.uid, render);
    }
  });

  function render(rows) {
    const ordered = A.sortBy(rows, (r) => (A.repo.CERT_TYPES[r.type] || {}).order || 99);

    if (!ordered.length) {
      mount.innerHTML = `<h1>My certificates</h1>
        ${A.ui.emptyState('&#10070;', 'No certificates yet',
          'Certificates appear here as soon as the organiser releases them. Each one can be viewed and downloaded straight from this page.')}
        <div class="btn-row" style="justify-content:center"><a class="btn btn-outline" href="dashboard.html">Back to dashboard</a></div>`;
      return;
    }

    mount.innerHTML = `
      <h1>My certificates</h1>
      <p class="muted">Every certificate released to you is available here to view and download. Keep this page bookmarked, and quote the certificate code if you need to ask the organiser for a replacement.</p>

      <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.5rem;align-items:start;margin-top:1.5rem">
        <div class="stack">
          ${ordered.map(certCard).join('')}
        </div>
        <aside class="stack">
          <div class="card">
            <h3 style="font-size:1.05rem">Need a replacement?</h3>
            <p class="muted small" style="margin:0 0 .75rem">Contact the organiser quoting the certificate code shown on each card, and a fresh copy can be uploaded for you.</p>
            <a class="btn btn-outline btn-sm btn-block" href="${A.rootPath('contact.html')}">Contact organiser</a>
          </div>
          <div class="card">
            <h3 style="font-size:1.05rem">Name on certificates</h3>
            <p class="muted small" style="margin:0">Certificates use your registered name. If it is wrong, contact the organiser before the certificate is produced.</p>
            <a class="btn btn-outline btn-sm btn-block" style="margin-top:.75rem" href="registration.html">Check my details</a>
          </div>
        </aside>
      </div>`;
  }

  function certCard(c) {
    const label = A.repo.certLabel(c.type);
    const when = c.releasedAt || c.createdAt;
    return `<div class="card" data-cert="${A.esc(c.id)}">
      <div class="cert-card">
        <div class="cert-rule" aria-hidden="true"></div>
        <div class="cert-theta" aria-hidden="true">&#952;</div>
      </div>
      <div style="padding:1.1rem 1.25rem 1.25rem;border-top:1px solid var(--line)">
        <div style="display:flex;align-items:flex-start;gap:.75rem;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <h2 style="font-size:1.1rem">${A.esc(label)}</h2>
            <p class="small muted" style="margin:.2rem 0 0">${A.esc(A.repo.categoryLabel(c.category))}${c.awardLabel ? ' &middot; ' + A.esc(c.awardLabel) : ''}</p>
          </div>
          ${A.statusBadge('approved')}
        </div>
        <dl class="kv" style="margin-top:1rem">
          <dt>Certificate code</dt><dd class="mono">${A.esc(c.code || '—')}</dd>
          <dt>Issued</dt><dd>${A.fmtDate(when)}</dd>
          ${c.pdfUrl ? `<dt>Download</dt><dd><a class="btn btn-outline btn-sm" href="${A.esc(c.pdfUrl)}" target="_blank" rel="noopener">Open certificate</a></dd>` : ''}
        </dl>
      </div>
    </div>`;
  }
})();
