/* Al-Biruni\'s Challenge 2026 — shared page bootstrap
   Sets up the header/footer and loads the competition configuration for
   content pages. Load this before any page-specific script. */

(function (global) {
  'use strict';

  const A = global.ABC;

  /* Only what this project actually uses. Cloud Storage is deliberately
     absent: it requires the Blaze plan, and this project stays on Spark.
     A browser that loaded it would only be able to make calls that return
     402. */
  const SDK = [
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js'
  ];

  const MODULES = [
    'js/firebase-config.js', 'js/core.js', 'js/ui.js', 'js/repo.js',
    'js/round1.js', 'js/round2.js', 'js/session.js'
  ];

  /* Renders shell + returns the config promise. */
  A.page = function (options) {
    const opts = options || {};
    A.ui.renderHeader(opts.active);
    A.ui.renderFooter();
    const p = A.repo.getConfig();
    p.then((cfg) => {
      A.CFG = cfg;
      const el = document.querySelector('[data-ba-close]');
      if (el && cfg.baApplicationsCloseAt) el.textContent = A.fmtDate(cfg.baApplicationsCloseAt);
      const openEl = document.querySelector('[data-ba-open]');
      if (openEl && cfg.baApplicationsOpenAt) openEl.textContent = A.fmtDate(cfg.baApplicationsOpenAt);
      /* Any [data-d="configKey"] placeholder is filled from the config so
         confirmed dates stay in one place and remain admin-editable. */
      document.querySelectorAll('[data-d]').forEach((node) => {
        const value = cfg[node.getAttribute('data-d')];
        if (value === null || value === undefined || value === '') return;
        node.textContent = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? A.fmtDate(value) : String(value);
      });
      if (opts.onConfig) opts.onConfig(cfg);
    });
    return p;
  };

  /* Small helper for building repeated card grids. */
  A.renderCategories = function (mount, opts) {
    const o = opts || {};
    const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (!el) return;
    el.innerHTML = A.repo.CATEGORIES.map((c) => `
      <div class="card card-hover${o.plain ? '' : ' card-accent'}" id="${c.id}">
        <div class="round-index">${A.pad(c.order)}</div>
        <h3>${A.esc(c.label)}</h3>
        <p class="muted small">${A.esc(c.blurb)}</p>
        ${o.footer ? `<div style="margin-top:1rem">${o.footer(c)}</div>` : ''}
      </div>`).join('');
  };

  /* The chooser lives in ui.js so the portal registration can use it too. */
  A.renderCategoryChoices = A.ui.renderCategoryChoices;

  /* Announcement list used on several public pages. */
  A.renderAnnouncementList = function (mount, limit) {
    const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (!el) return;
    A.repo.onAnnouncements({}, (rows) => {
      const list = limit ? rows.slice(0, limit) : rows;
      if (!list.length) {
        el.innerHTML = A.ui.emptyState('&#9675;', 'No announcements yet',
          'Official notices will appear here as we publish them.');
        return;
      }
      el.innerHTML = list.map((a) => {
        const d = A.toDate(a.publishedAt || a.createdAt);
        return `<div class="announcement">
          <div class="date-block">
            <div class="d">${d ? d.getDate() : '--'}</div>
            <div class="m">${d ? d.toLocaleDateString('en-GB', { month: 'short' }) : ''}</div>
          </div>
          <div>
            <h3>${A.esc(a.title)}</h3>
            <div class="body" style="white-space:pre-line">${A.esc(a.body)}</div>
            <div class="audience">
              <span class="badge badge-muted">${A.esc(A.repo.ANNOUNCEMENT_AUDIENCES[a.audience] || 'Everyone')}</span>
              <span>${A.fmtDateTime(a.publishedAt || a.createdAt)}</span>
            </div>
          </div>
        </div>`;
      }).join('');
    });
  };
})(window);
