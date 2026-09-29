/* Grand Finale admin — event logistics and the announcement of results. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let cfg = null, finale = null, finalists = [];

  A.admin({
    active: 'admin/grand-finale.html',
    title: 'Grand Finale',
    subtitle: 'Event details and finalist results',
    onReady: load
  });

  async function load() {
    [cfg, finale, finalists] = await Promise.all([
      A.repo.getConfig(), A.round2.getFinaleConfig(), A.round2.listFinalists()
    ]);
    render();
  }

  function render() {
    const byCat = A.repo.CATEGORIES.map((c) => ({
      c, list: finalists.filter((f) => f.category === c.id)
    }));
    const awarded = finalists.filter((f) => f.award);
    const released = finalists.filter((f) => f.released);
    const allScored = finalists.every((f) => f.finalScore !== null && f.finalScore !== undefined) && finalists.length > 0;

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Finalists', finalists.length, 'of ' + A.num(cfg.finalistCount, 30) + ' places')}
        ${stat('Awards assigned', awarded.length, 'Winner, runner-up, honourable mention')}
        ${stat('Results released', released.length, 'Visible in the finalist area')}
        ${stat('Fully scored', finalists.filter((f) => f.finalScore !== null && f.finalScore !== undefined).length, 'Judge totals recorded')}
      </div>

      <div class="callout" style="margin-top:1.5rem">
        <strong>Grand Finale:</strong> ${A.esc(finale.city || 'Karachi')} &middot;
        ${A.esc(finale.month || 'November 2026')} &middot;
        ${finale.date ? A.esc(A.fmtDate(finale.date)) : 'exact date to be announced'} &middot;
        demonstration time ${A.esc(A.num(finale.demoMinutes, 2))} minutes.
      </div>

      <div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:1.5rem;align-items:start;margin-top:1.5rem">
        <div class="stack">
          ${byCat.map((row) => `
            <div class="panel">
              <div class="panel-header">
                <h2>${A.esc(row.c.label)}</h2>
                <span class="badge badge-muted">${A.esc(A.num(row.list.length))} finalists</span>
              </div>
              <div class="panel-body">
                ${A.table([
                  { key: 'name', label: 'Finalist', render: (f) => `<strong>${A.esc(f.name || '—')}</strong><div class="small muted">${A.esc(f.school || '')}</div>` },
                  { key: 'finalScore', label: 'Judges’ score', className: 'num', render: (f) => (f.finalScore === null || f.finalScore === undefined ? '—' : A.esc(A.num(f.finalScore))) },
                  { key: 'finalRank', label: 'Final rank', className: 'num', render: (f) => (f.finalRank ? A.esc(A.ordinal(f.finalRank)) : '—') },
                  { key: 'award', label: 'Award', render: (f) => ((A.round2.AWARDS[f.award] || {}).label ? A.statusBadge('finalist') : A.statusBadge('pending')) },
                  { key: 'awardLabel', label: 'Outcome', render: (f) => A.esc((A.round2.AWARDS[f.award] || {}).label || 'Finalist') },
                  { key: 'released', label: 'Released', render: (f) => (f.released ? A.statusBadge('approved') : A.statusBadge('pending')) }
                ], row.list, { emptyTitle: 'No finalists in this category yet', emptyMessage: 'Confirm finalists from the Finalist Selection page.' })}
              </div>
            </div>`).join('')}
        </div>

        <aside class="stack">
          <div class="panel">
            <div class="panel-header"><h2>Announce results</h2></div>
            <div class="panel-body stack">
              <p class="small muted" style="margin:0">Releasing results shows each finalist their own
                final rank and award in the finalist area, and is what triggers the results announcement.</p>
              <button class="btn btn-primary btn-block" id="releaseResultsBtn" ${awarded.length ? '' : 'disabled'}>Release results to all finalists</button>
              <button class="btn btn-outline btn-block" id="withdrawResultsBtn" ${released.length ? '' : 'disabled'}>Withdraw all results</button>
              <div class="checkline"><input type="checkbox" id="finalistsConfirmed" ${finale.finalistsConfirmed ? 'checked' : ''}><label for="finalistsConfirmed">Finalist list confirmed</label></div>
              <div class="checkline"><input type="checkbox" id="finalistListReleased" ${finale.finalistListReleased ? 'checked' : ''}><label for="finalistListReleased">Show the finalist list publicly</label></div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header"><h2>Event checklist</h2></div>
            <div class="panel-body">
              ${checklist([
                { ok: !!finale.date, label: 'Exact event date set' },
                { ok: !!finale.venue, label: 'Venue set' },
                { ok: !!finale.reportingTime, label: 'Reporting time set' },
                { ok: finale.presentationMinutes !== null && finale.presentationMinutes !== undefined, label: 'Presentation length set' },
                { ok: finale.interviewCount !== null && finale.interviewCount !== undefined, label: 'Interview count set' },
                { ok: finalists.length === A.num(cfg.finalistCount, 30), label: 'All ' + A.num(cfg.finalistCount, 30) + ' finalists confirmed' },
                { ok: allScored, label: 'All finalists scored' },
                { ok: awarded.length >= 9, label: 'All nine category awards assigned' }
              ])}
            </div>
          </div>
        </aside>
      </div>`;

    host.querySelector('#releaseResultsBtn').addEventListener('click', function () {
      if (!finale.resultsReleased) {
        A.confirmRun({
          title: 'Mark results as announced?',
          message: 'This records that the Grand Finale results have been announced.',
          confirmLabel: 'Mark announced', button: this,
          run: function () { return A.round2.saveFinaleConfig({ resultsReleased: true }); },
          success: 'Results announced.'
        }).then(load).catch(function () {});
        return;
      }
      A.confirmRun({
        title: 'Release results to all finalists?',
        message: 'Each finalist will see their final rank and award in their finalist area.',
        confirmLabel: 'Release', button: this, busyLabel: 'Releasing…',
        run: function () { return Promise.all(finalists.map((f) => A.round2.setFinalistReleased(f.uid, true))); },
        success: 'Results released.'
      }).then(load).catch(function () {});
    });

    host.querySelector('#withdrawResultsBtn').addEventListener('click', function () {
      A.confirmRun({
        title: 'Withdraw all results?',
        message: 'Finalists will no longer see their final rank or award.',
        confirmLabel: 'Withdraw', button: this, busyLabel: 'Withdrawing…',
        run: function () { return Promise.all(finalists.map((f) => A.round2.setFinalistReleased(f.uid, false))); },
        success: 'Results withdrawn.'
      }).then(load).catch(function () {});
    });

    ['finalistsConfirmed', 'finalistListReleased'].forEach((id) => {
      host.querySelector('#' + id).addEventListener('change', function () {
        const patch = {};
        patch[id] = this.checked;
        A.round2.saveFinaleConfig(patch).then(function () { A.ui.toast('Saved.', 'ok'); load(); });
      });
    });
  }

  function checklist(items) {
    return `<ul class="stack" style="list-style:none;padding:0;margin:0">
      ${items.map((i) => `<li class="check-row ${i.ok ? 'done' : ''}">
        <span class="mark" aria-hidden="true">${i.ok ? '&#10003;' : '&#9675;'}</span>
        <span>${A.esc(i.label)}</span>
      </li>`).join('')}
    </ul>`;
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
