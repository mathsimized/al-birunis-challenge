/* Home page */
(function () {
  'use strict';
  const A = ABC;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  A.ui.renderHeader('index.html');
  A.ui.renderFooter();

  const emblemMount = $('[data-emblem]');
  if (emblemMount) emblemMount.innerHTML = A.ui.emblemSVG(230);

  /* Categories */
  const catMount = $('[data-categories]');
  if (catMount) {
    catMount.innerHTML = A.repo.CATEGORIES.map((c) => `
      <div class="card card-hover">
        <div class="round-index">${String(c.order).padStart(2, '0')}</div>
        <h3>${A.esc(c.label)}</h3>
        <p class="muted small">${A.esc(c.blurb)}</p>
        <a class="btn btn-outline btn-sm" href="categories.html#${c.id}">About ${A.esc(c.label)}</a>
      </div>`).join('');
  }

  /* Announcements */
  const annMount = $('[data-announcements]');
  function renderAnnouncements(rows) {
    if (!annMount) return;
    if (!rows.length) {
      annMount.innerHTML = A.ui.emptyState('&#9675;', 'No announcements yet',
        'Official notices about registration, rounds and results will appear here.');
      return;
    }
    annMount.innerHTML = rows.slice(0, 4).map((a) => {
      const d = A.toDate(a.publishedAt || a.createdAt);
      return `<div class="announcement">
        <div class="date-block">
          <div class="d">${d ? d.getDate() : '--'}</div>
          <div class="m">${d ? d.toLocaleDateString('en-GB', { month: 'short' }) : ''}</div>
        </div>
        <div>
          <h3>${A.esc(a.title)}</h3>
          <div class="body">${A.esc(A.trunc ? A.trunc(a.body, 220) : String(a.body || '').slice(0, 220))}${(a.body || '').length > 220 ? '&hellip;' : ''}</div>
          <div class="audience"><span class="badge badge-muted">${A.esc(A.repo.ANNOUNCEMENT_AUDIENCES[a.audience] || 'Everyone')}</span><span>${A.fmtRelative(a.publishedAt || a.createdAt)}</span></div>
        </div>
      </div>`;
    }).join('') + `<div class="text-center" style="margin-top:1.25rem"><a class="btn btn-outline btn-sm" href="announcements.html">View all announcements</a></div>`;
  }

  /* Config-driven content */
  let cfg = null;
  A.repo.getConfig().then((c) => {
    cfg = c;
    if (c.baApplicationsCloseAt) {
      const el = $('[data-ba-close]');
      if (el) el.textContent = A.fmtDate(c.baApplicationsCloseAt);
    }
    const q1 = $('[data-quota-r1]');
    if (q1) q1.textContent = c.round1QualifyPerCategory
      ? 'Top ' + c.round1QualifyPerCategory + ' per category'
      : 'Top students per category';
    const q2 = $('[data-quota-r2]');
    if (q2) q2.textContent = c.round2QualifyPerCategory
      ? 'Top ' + c.round2QualifyPerCategory + ' per category'
      : 'Top students per category';

    /* Countdown: show the next upcoming milestone. */
    const block = $('[data-countdown-block]');
    const label = $('[data-countdown-label]');
    const target = $('[data-countdown]');
    if (block && target) {
      const now = Date.now();
      const milestones = [
        { at: c.registrationOpensAt, label: 'Registration opens' },
        { at: c.round1WindowOpensAt, label: 'Round 1 opens' },
        { at: c.round1WindowClosesAt, label: 'Round 1 closes' },
        { at: c.round2OpensAt, label: 'Round 2 opens' },
        { at: c.round2ClosesAt, label: 'Round 2 closes' }
      ].filter((m) => {
        const t = A.toDate(m.at);
        return t && t.getTime() > now;
      }).sort((a, b) => A.toDate(a.at) - A.toDate(b.at));
      if (milestones.length) {
        block.hidden = false;
        label.textContent = milestones[0].label;
        A.ui.countdown(target, milestones[0].at);
      }
    }
  });

  A.repo.onAnnouncements({}, renderAnnouncements);
})();
