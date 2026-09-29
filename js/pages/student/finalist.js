/* Finalist area — Grand Finale details for confirmed finalists only. */
(function () {
  'use strict';
  const A = ABC;
  const mount = document.querySelector('[data-fin]');

  A.portal({
    active: 'student/finalist.html',
    route: 'student/finalist.html',
    onReady: function () { load(); },
    onDenied: function (reason) { denied(reason); }
  });

  function load() {
    Promise.all([A.round2.getFinaleConfig(), A.round2.isFinalist(A.user.uid)])
      .then(function (r) { render(r[0], r[1]); });
  }

  function denied(reason) {
    mount.innerHTML = `<h1>Finalist area</h1>
      ${A.ui.alertBox('warn', 'Restricted to finalists', reason || 'This area is only available to confirmed finalists.')}
      <div class="btn-row" style="margin-top:1.25rem"><a class="btn btn-outline" href="dashboard.html">Back to dashboard</a></div>`;
  }

  function render(cfg, finalist) {
    if (!finalist) { denied(); return; }

    const released = !!finalist.released;
    const awards = A.round2.AWARDS;
    const award = finalist.award ? awards[finalist.award] : null;

    mount.innerHTML = `
      <h1>Finalist area</h1>
      <p class="muted">Congratulations on reaching the Grand Finale. Everything you need is below.</p>
      <div style="margin:1.5rem 0">${A.ui.alertBox('ok', 'You are a confirmed finalist', 'Your place in the Grand Finale is confirmed.')}</div>

      <div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:1.5rem;align-items:start">
        <div class="stack">
          <div class="card card-accent">
            <div class="round-index">Grand Finale &middot; Presentation &middot; Demonstration &middot; Interview</div>
            <h2 style="font-size:1.35rem;margin-top:.35rem">${A.esc(cfg.city || 'Karachi')} &middot; ${A.esc(cfg.month || 'November 2026')}</h2>
            ${cfg.venue ? `<p class="muted" style="margin:.5rem 0 0">${A.esc(cfg.venue)}</p>` : ''}
            <dl class="kv" style="margin-top:1.5rem">
              <dt>Your category</dt><dd>${A.esc(A.repo.categoryLabel(finalist.category))}</dd>
              <dt>Round 2 rank</dt><dd>${finalist.rank ? A.esc(A.ordinal(finalist.rank)) : '—'}</dd>
              ${finalist.finalScore ? `<dt>Round 2 score</dt><dd>${A.esc(A.num(finalist.finalScore))} / 100</dd>` : ''}
              <dt>Presentation time</dt><dd>${cfg.presentationMinutes ? A.esc(A.num(cfg.presentationMinutes)) + ' minutes' : 'As announced'}</dd>
              <dt>Demonstration time</dt><dd>${cfg.demoMinutes ? 'Up to ' + A.esc(A.num(cfg.demoMinutes)) + ' minutes' : 'As announced'}</dd>
              <dt>Interviews</dt><dd>${cfg.interviewCount ? A.esc(A.num(cfg.interviewCount)) + ' per finalist' : 'As announced'}</dd>
            </dl>
            ${cfg.instructions ? `<div class="callout" style="margin-top:1.25rem"><strong>What to bring</strong><div style="white-space:pre-line;margin-top:.4rem">${A.esc(cfg.instructions)}</div></div>` : ''}
          </div>

          <div class="card">
            <h2 style="font-size:1.2rem">Your Grand Finale result</h2>
            ${released
              ? `<div class="grid grid-3" style="margin-top:1.25rem;gap:1rem">
                   <div class="stat burgundy"><div class="stat-label">Rank</div><div class="stat-value">${finalist.finalRank ? A.esc(A.ordinal(finalist.finalRank)) : '—'}</div></div>
                   <div class="stat"><div class="stat-label">Judges' score</div><div class="stat-value">${finalist.finalScore !== undefined && finalist.finalScore !== null ? A.esc(A.num(finalist.finalScore)) : '—'}</div></div>
                   <div class="stat ${award ? 'success' : ''}"><div class="stat-label">Outcome</div><div class="stat-value" style="font-size:1.35rem">${award ? A.esc(award.label) : 'Finalist'}</div>${award && award.cash ? `<div class="stat-hint">${A.esc(award.cash)}</div>` : ''}</div>
                 </div>`
              : `<p class="muted small" style="margin:.75rem 0 0">Your Grand Finale result and award will appear here once the team has announced it.</p>`}
          </div>
        </div>

        <aside class="stack">
          <div class="card">
            <h3 style="font-size:1.05rem">Grand Finale prizes</h3>
            <dl class="kv" style="margin-top:1rem">
              <dt>Category winner</dt><dd>${A.esc(awards.winner.cash)}${awards.winner.shield ? ' + ' + A.esc(awards.winner.shield) : ''}</dd>
              <dt>Runner-up</dt><dd>${A.esc(awards.runnerup.cash)}${awards.runnerup.shield ? ' + ' + A.esc(awards.runnerup.shield) : ''}</dd>
              <dt>Honourable mention</dt><dd>Certificate and recognition</dd>
            </dl>
          </div>
          <div class="card">
            <h3 style="font-size:1.05rem">Certificates</h3>
            <p class="muted small" style="margin:0 0 .75rem">Finalist and award certificates appear in your portal, where you can view and download them, once we release them.</p>
            <a class="btn btn-outline btn-sm btn-block" href="certificates.html">My certificates</a>
          </div>
          <div class="card">
            <h3 style="font-size:1.05rem">Need help?</h3>
            <p class="muted small" style="margin:0 0 .75rem">Contact the Al-Biruni\'s organising team for travel, timing or accessibility questions.</p>
            <a class="btn btn-outline btn-sm btn-block" href="${A.rootPath('contact.html')}">Contact the team</a>
          </div>
        </aside>
      </div>`;
  }
})();
