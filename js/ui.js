/* Al-Biruni\'s Challenge 2026 — shared UI shell
   Renders the site header, navigation, footer, toasts and modals so that
   every page shares one consistent frame. */

(function (global) {
  'use strict';

  const A = global.ABC;
  const esc = A.esc;

  const NAV_PUBLIC = [
    { href: 'index.html', label: 'Home' },
    { href: 'about.html', label: 'About' },
    { href: 'how-it-works.html', label: 'How It Works' },
    { href: 'rounds.html', label: 'Rounds' },
    { href: 'categories.html', label: 'Categories' },
    { href: 'prizes.html', label: 'Prizes' },
    { href: 'brand-ambassadors.html', label: 'Brand Ambassadors' },
    { href: 'announcements.html', label: 'Announcements' },
    { href: 'results.html', label: 'Results' }
  ];

  const NAV_PORTAL = [
    { section: 'My Competition' },
    { href: 'student/dashboard.html', label: 'Dashboard', glyph: '◈' },
    { href: 'student/registration.html', label: 'Registration', glyph: '✎' },
    { section: 'Rounds' },
    { href: 'student/round1.html', label: 'Round 1 · Rapid-Fire Qualifier', glyph: '①' },
    { href: 'student/round1-result.html', label: 'Round 1 Result', glyph: '≡' },
    { href: 'student/round2.html', label: 'Round 2 · Communication', glyph: '②' },
    { href: 'student/round2-submit.html', label: 'Round 2 Submission', glyph: '↗' },
    { section: 'Grand Finale' },
    { href: 'student/finalist.html', label: 'Finalist Area', glyph: '③' },
    { section: 'Recognition' },
    { href: 'student/certificates.html', label: 'Certificates', glyph: '❖' },
    { href: 'student/announcements.html', label: 'Announcements', glyph: '◈' },
    { href: 'student/profile.html', label: 'Profile', glyph: '●' }
  ];

  const NAV_ADMIN = [
    { section: 'Overview' },
    { href: 'admin/index.html', label: 'Dashboard', glyph: '◈' },
    { href: 'admin/settings.html', label: 'Competition Settings', glyph: '⚙' },
    { href: 'admin/registrations.html', label: 'Registrations', glyph: '✎' },
    { section: 'Round 1' },
    { href: 'admin/questions.html', label: 'Question Bank', glyph: '?' },
    { href: 'admin/import.html', label: 'Import Questions', glyph: '⇪' },
    { href: 'admin/round1.html', label: 'Attempts & Leaderboard', glyph: '≡' },
    { href: 'admin/results.html', label: 'Results Publication', glyph: '★' },
    { section: 'Round 2' },
    { href: 'admin/round2.html', label: 'Submissions & Judging', glyph: '②' },
    { href: 'admin/finalists.html', label: 'Finalist Selection', glyph: '③' },
    { section: 'Grand Finale' },
    { href: 'admin/grand-finale.html', label: 'Grand Finale', glyph: '◆' },
    { section: 'Recognition' },
    { href: 'admin/certificates.html', label: 'Certificates', glyph: '❖' },
    { href: 'admin/brand-ambassadors.html', label: 'Brand Ambassadors', glyph: '★' },
    { href: 'admin/announcements.html', label: 'Announcements', glyph: '◈' },
    { section: 'Access' },
    { href: 'admin/users.html', label: 'Users & Access', glyph: '●' },
    { href: 'student/dashboard.html', label: 'My Student Portal', glyph: '☺' },
    { href: 'index.html', label: '← Public Site', glyph: '↩' }
  ];

  /* ---------- emblem ---------- */
  function emblemSVG(size) {
    const s = size || 220;
    return `
<svg class="emblem" viewBox="0 0 240 240" width="${s}" height="${s}" role="img" aria-label="Al-Biruni\'s Challenge emblem: a scholar with a telescope directed at a circle marked theta">
  <defs>
    <linearGradient id="abcGold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D8BC7E"/><stop offset="100%" stop-color="#B78B3C"/>
    </linearGradient>
    <linearGradient id="abcBurg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#642B36"/><stop offset="100%" stop-color="#34131A"/>
    </linearGradient>
  </defs>
  <circle cx="120" cy="120" r="116" fill="none" stroke="url(#abcGold)" stroke-width="1.4"/>
  <circle cx="120" cy="120" r="108" fill="none" stroke="url(#abcGold)" stroke-width="0.6" opacity="0.75"/>
  <g fill="none" stroke="url(#abcGold)" stroke-width="0.55" opacity="0.6">
    <ellipse cx="120" cy="120" rx="108" ry="42"/>
    <path d="M12 120h216M120 12v216"/>
    <path d="M30 60l180 120M210 60L30 180" opacity="0.5"/>
  </g>
  <g transform="translate(120 120)">
    <ellipse cx="0" cy="56" rx="66" ry="20" fill="url(#abcBurg)" opacity="0.9"/>
    <ellipse cx="0" cy="52" rx="60" ry="17" fill="none" stroke="url(#abcGold)" stroke-width="1"/>
    <path d="M-58 52 L-44 22 L44 22 L58 52 Z" fill="url(#abcBurg)"/>
    <path d="M-44 22 L-30 2 L30 2 L44 22 Z" fill="#4E2029"/>
    <g fill="url(#abcGold)">
      <rect x="-40" y="30" width="16" height="14" rx="2"/>
      <rect x="-18" y="30" width="16" height="14" rx="2"/>
      <rect x="4" y="30" width="16" height="14" rx="2"/>
      <rect x="26" y="30" width="14" height="14" rx="2"/>
    </g>
    <g>
      <circle cx="0" cy="-14" r="13" fill="#DFA6A1"/>
      <path d="M-13 -16 a13 13 0 0 1 26 0 z" fill="url(#abcBurg)"/>
      <path d="M-17 24 q17 -14 34 0 v18 h-34 z" fill="url(#abcBurg)"/>
      <path d="M-2 20 h4 v16 h-4 z" fill="#DFA6A1"/>
    </g>
    <g transform="rotate(-24)">
      <rect x="14" y="-26" width="46" height="7" rx="3" fill="url(#abcGold)"/>
      <rect x="52" y="-31" width="16" height="17" rx="3" fill="url(#abcGold)"/>
      <rect x="6" y="-24" width="8" height="3" rx="1.5" fill="#642B36"/>
    </g>
    <circle cx="96" cy="-52" r="21" fill="none" stroke="url(#abcGold)" stroke-width="1.6"/>
    <text x="96" y="-44" font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-size="26" fill="url(#abcGold)" text-anchor="middle">&#952;</text>
  </g>
</svg>`;
  }

  /* ---------- header ---------- */
  function renderHeader(active) {
    const mount = document.querySelector('[data-abc-header]');
    if (!mount) return;
    const user = A.user;
    const authLinks = user
      ? `<li><a href="${A.rootPath('student/dashboard.html')}">My Dashboard</a></li>
         <li><button type="button" class="btn btn-outline btn-sm" data-abc-signout>Sign out</button></li>`
      : `<li><a href="${A.rootPath('login.html')}">Log In</a></li>
         <li><a class="btn btn-primary btn-sm" href="${A.rootPath('register.html')}">Register</a></li>`;

    mount.innerHTML = `
<header class="site-header">
  <div class="shell nav">
    <a class="brand" href="${A.rootPath('index.html')}">
      <span style="width:38px;flex:none">${emblemSVG(38).replace('class="emblem"', 'class="emblem" style="margin:0"')}</span>
      <span class="brand-text">
        <span class="brand-name">Al-Biruni&rsquo;s Challenge</span>
        <span class="brand-sub">2026 &middot; by MATHSIMIZED</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="abcNav" aria-label="Menu"><span></span><span></span><span></span></button>
    <ul class="nav-links" id="abcNav">
      ${NAV_PUBLIC.map((i) => `<li><a href="${A.rootPath(i.href)}"${i.href === active ? ' aria-current="page"' : ''}>${esc(i.label)}</a></li>`).join('')}
      ${authLinks}
    </ul>
  </div>
</header>`;

    const toggle = mount.querySelector('.nav-toggle');
    const list = mount.querySelector('.nav-links');
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      list.classList.toggle('open', !open);
    });

    const out = mount.querySelector('[data-abc-signout]');
    if (out) {
      out.addEventListener('click', async () => {
        try { await A.auth.signOut(); } finally { A.redirect('index.html'); }
      });
    }
  }

  function renderFooter() {
    const mount = document.querySelector('[data-abc-footer]');
    if (!mount) return;
    mount.innerHTML = `
<footer class="site-footer">
  <div class="shell">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="brand" style="margin-bottom:0.8rem">
          <span style="width:34px;flex:none">${emblemSVG(34).replace('class="emblem"', 'class="emblem" style="margin:0"')}</span>
          <span class="brand-text">
            <span class="brand-name">Al-Biruni&rsquo;s Challenge</span>
            <span class="brand-sub">2026 &middot; by MATHSIMIZED</span>
          </span>
        </div>
        <p style="font-size:0.9rem;max-width:38ch">A nationwide mathematics competition for school students across Pakistan, built on <em style="color:#D8BC7E">Think &middot; Explain &middot; Create</em>.</p>
        <div class="theta-footer" aria-hidden="true">&#952;</div>
      </div>
      <div>
        <h4>Competition</h4>
        <ul>
          <li><a href="${A.rootPath('about.html')}">About the Challenge</a></li>
          <li><a href="${A.rootPath('how-it-works.html')}">How It Works</a></li>
          <li><a href="${A.rootPath('rounds.html')}">The Three Rounds</a></li>
          <li><a href="${A.rootPath('timeline.html')}">Competition Timeline</a></li>
          <li><a href="${A.rootPath('categories.html')}">Categories</a></li>
          <li><a href="${A.rootPath('prizes.html')}">Prizes &amp; Awards</a></li>
        </ul>
      </div>
      <div>
        <h4>Participate</h4>
        <ul>
          <li><a href="${A.rootPath('register.html')}">Register</a></li>
          <li><a href="${A.rootPath('login.html')}">Student Login</a></li>
          <li><a href="${A.rootPath('student/dashboard.html')}">Student Portal</a></li>
          <li><a href="${A.rootPath('brand-ambassadors.html')}">Brand Ambassadors</a></li>
          <li><a href="${A.rootPath('announcements.html')}">Announcements</a></li>
        </ul>
      </div>
      <div>
        <h4>Information</h4>
        <ul>
          <li><a href="${A.rootPath('results.html')}">Results</a></li>
          <li><a href="${A.rootPath('grand-finale.html')}">Grand Finale</a></li>
          <li><a href="${A.rootPath('privacy.html')}">Privacy</a></li>
          <li><a href="${A.rootPath('rules.html')}">Rules &amp; Eligibility</a></li>
          <li><a href="${A.rootPath('contact.html')}">Contact</a></li>
          <li><a href="https://www.instagram.com/al_birunis_challenge/" target="_blank" rel="noopener">Instagram &#64;al_birunis_challenge</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-base">
      <span>&copy; <span data-year></span> Al-Biruni&rsquo;s Challenge 2026 &middot; by MATHSIMIZED. All rights reserved.</span>
      <span>Grand Finale &middot; Karachi, 29 November 2026</span>
    </div>
  </div>
</footer>`;
    const y = mount.querySelector('[data-year]');
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /* ---------- portal sidebar ---------- */
  function renderPortalNav(active) {
    const mount = document.querySelector('[data-abc-portalnav]');
    if (!mount) return;
    mount.innerHTML = `
<div class="panel">
  <div class="portal-user">
    <div class="name" data-portal-name>Student</div>
    <div class="meta" data-portal-email></div>
  </div>
  <ul class="portal-nav">
    ${NAV_PORTAL.map((i) => {
      if (i.section) return `<li class="nav-section">${esc(i.section)}</li>`;
      return `<li><a href="${A.rootPath(i.href)}"${i.href === active ? ' aria-current="page"' : ''}><span class="glyph" aria-hidden="true">${i.glyph}</span>${esc(i.label)}</a></li>`;
    }).join('')}
    <li class="nav-section">Account</li>
    <li><button type="button" class="btn btn-ghost btn-sm btn-block" data-abc-signout style="justify-content:flex-start">Sign out</button></li>
  </ul>
</div>`;
    const out = mount.querySelector('[data-abc-signout]');
    if (out) {
      out.addEventListener('click', async () => {
        try { await A.auth.signOut(); } finally { A.redirect('index.html'); }
      });
    }
  }

  /* ---------- admin sidebar ---------- */
  function renderAdminNav(active) {
    const mount = document.querySelector('[data-abc-adminnav]');
    if (!mount) return;
    mount.innerHTML = `
<aside class="admin-side" id="abcAdminSide">
  <div class="admin-brand">
    <span style="width:30px;flex:none">${emblemSVG(30).replace('class="emblem"', 'class="emblem" style="margin:0"')}</span>
    <span class="brand-text">
      <span class="brand-name">Al-Biruni&rsquo;s</span>
      <span class="brand-sub">Admin Panel</span>
    </span>
  </div>
  <ul class="admin-nav">
    ${NAV_ADMIN.map((i) => {
      if (i.section) return `<li class="nav-section">${esc(i.section)}</li>`;
      return `<li><a href="${A.rootPath(i.href)}"${i.href === active ? ' aria-current="page"' : ''}><span class="glyph" aria-hidden="true">${i.glyph}</span>${esc(i.label)}</a></li>`;
    }).join('')}
    <li class="nav-section">Elsewhere</li>
    <li><a href="${A.rootPath('index.html')}"><span class="glyph" aria-hidden="true">⌂</span>Public site</a></li>
  </ul>
</aside>`;
  }

  function renderAdminTopbar(title, subtitle) {
    const mount = document.querySelector('[data-abc-topbar]');
    if (!mount) return;
    mount.innerHTML = `
<div class="admin-topbar">
  <div style="display:flex;align-items:center;gap:0.75rem;min-width:0">
    <button class="btn btn-outline btn-sm admin-menu-btn" type="button" data-abc-adminmenu aria-label="Menu">&#9776;</button>
    <div style="min-width:0">
      <h1>${esc(title)}</h1>
      ${subtitle ? `<div class="small muted">${esc(subtitle)}</div>` : ''}
    </div>
  </div>
  <div class="flex-center">
    <span class="badge badge-burgundy" data-abc-admindoctorial></span>
    <a class="btn btn-outline btn-sm" href="${A.rootPath('index.html')}" target="_blank" rel="noopener">View public site &#8599;</a>
  </div>
</div>`;
    const btn = mount.querySelector('[data-abc-adminmenu]');
    if (btn) {
      btn.addEventListener('click', () => {
        const side = document.getElementById('abcAdminSide');
        const open = side.classList.toggle('open');
        let scrim = document.querySelector('.admin-scrim');
        if (open && !scrim) {
          scrim = document.createElement('div');
          scrim.className = 'admin-scrim';
          scrim.addEventListener('click', () => { side.classList.remove('open'); scrim.remove(); });
          document.body.appendChild(scrim);
        } else if (!open && scrim) { scrim.remove(); }
      });
    }
  }

  /* ---------- toasts ---------- */
  function toastHost() {
    let host = document.getElementById('abc-toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'abc-toasts';
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, kind, ms) {
    const host = toastHost();
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span class="toast-message">${esc(message)}</span><button class="toast-close" type="button" aria-label="Dismiss">&#215;</button>`;
    el.querySelector('.toast-close').addEventListener('click', () => el.remove());
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 260);
    }, ms || 4200);
    return el;
  }

  /* ---------- modal ---------- */
  function modal(options) {
    const opts = options || {};
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const actions = opts.actions || [{ label: 'Close', value: null, variant: 'secondary' }];
    overlay.innerHTML = `
<div class="modal${opts.wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="abcModalTitle">
  <div class="modal-header">
    <h3 id="abcModalTitle">${esc(opts.title || '')}</h3>
    <button class="modal-close" type="button" aria-label="Close">&#215;</button>
  </div>
  <div class="modal-body">${opts.body || ''}</div>
  <div class="modal-footer">
    ${actions.map((a, i) => `<button type="button" class="btn btn-${a.variant || 'secondary'}" data-modal-action="${i}">${esc(a.label)}</button>`).join('')}
  </div>
</div>`;

    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function close(result) {
      overlay.classList.add('closing');
      document.body.style.overflow = prevOverflow;
      setTimeout(() => overlay.remove(), 180);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (opts.onClose) opts.onClose(result);
    }

    overlay.querySelector('.modal-close').addEventListener('click', () => close(null));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
    overlay.querySelectorAll('[data-modal-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const a = actions[Number(btn.dataset.modalAction)];
        if (a && a.onClick) {
          const r = a.onClick(overlay);
          if (r === false) return;
          if (r && typeof r.then === 'function') {
            r.then((v) => close(v === undefined ? a.value : v));
            return;
          }
          close(r === undefined ? a.value : r);
          return;
        }
        close(a ? a.value : null);
      });
    });

    overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && document.body.contains(overlay)) {
        document.removeEventListener('keydown', onKey);
        close(null);
      }
    });

    const focusTarget = overlay.querySelector('[data-autofocus]') || overlay.querySelector('.modal-body input, .modal-body textarea, .modal-body select') || overlay.querySelector('.modal-footer .btn');
    if (focusTarget) setTimeout(() => focusTarget.focus(), 40);
    return { overlay, close };
  }

  function confirmModal(title, message, confirmLabel) {
    return new Promise((resolve) => {
      modal({
        title,
        body: `<p>${esc(message)}</p>`,
        actions: [
          { label: 'Cancel', value: false, variant: 'secondary' },
          { label: confirmLabel || 'Confirm', value: true, variant: 'danger' }
        ],
        onClose: (r) => resolve(r === true)
      });
    });
  }

  function formModal(title, fields, opts) {
    const options = opts || {};
    const rows = fields.map((f) => {
      if (f.type === 'select') {
        return `<div class="field${f.span ? ' span-2' : ''}">
          <label for="fm-${f.name}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>
          <select class="select" id="fm-${f.name}" name="${f.name}"${f.required ? ' required' : ''}>
            ${(f.options || []).map((o) => `<option value="${esc(o.value)}"${o.value === f.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}
          </select>
          ${f.hint ? `<div class="field-hint">${esc(f.hint)}</div>` : ''}
        </div>`;
      }
      if (f.type === 'textarea') {
        return `<div class="field${f.span ? ' span-2' : ''}">
          <label for="fm-${f.name}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>
          <textarea class="textarea" id="fm-${f.name}" name="${f.name}" rows="${f.rows || 4}"${f.required ? ' required' : ''} placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>
          ${f.hint ? `<div class="field-hint">${esc(f.hint)}</div>` : ''}
        </div>`;
      }
      if (f.type === 'checkbox') {
        return `<div class="field${f.span ? ' span-2' : ''}">
          <div class="checkline">
            <input type="checkbox" id="fm-${f.name}" name="${f.name}"${f.value ? ' checked' : ''}>
            <label for="fm-${f.name}">${esc(f.label)}</label>
          </div>
          ${f.hint ? `<div class="field-hint">${esc(f.hint)}</div>` : ''}
        </div>`;
      }
      return `<div class="field${f.span ? ' span-2' : ''}">
        <label for="fm-${f.name}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>
        <input class="input" type="${f.type || 'text'}" id="fm-${f.name}" name="${f.name}" value="${esc(f.value === undefined ? '' : f.value)}"${f.required ? ' required' : ''}${f.step ? ` step="${f.step}"` : ''}${f.min !== undefined ? ` min="${f.min}"` : ''}${f.max !== undefined ? ` max="${f.max}"` : ''} placeholder="${esc(f.placeholder || '')}"${f.readonly ? ' readonly' : ''}>
        ${f.hint ? `<div class="field-hint">${esc(f.hint)}</div>` : ''}
      </div>`;
    }).join('');

    return new Promise((resolve) => {
      const m = modal({
        title,
        wide: options.wide,
        body: `<form id="abcFormModal" class="form-grid" novalidate>${rows}</form>${options.note ? `<div class="alert" style="margin-top:1rem">${esc(options.note)}</div>` : ''}`,
        actions: [
          { label: 'Cancel', value: null, variant: 'secondary' },
          {
            label: options.submitLabel || 'Save',
            variant: 'primary',
            onClick: (overlay) => {
              const form = overlay.querySelector('#abcFormModal');
              if (!form.reportValidity()) return false;
              const data = {};
              new FormData(form).forEach((v, k) => { data[k] = typeof v === 'string' ? v.trim() : v; });
              fields.forEach((f) => { if (f.type === 'checkbox') data[f.name] = form.elements[f.name].checked; });
              return data;
            }
          }
        ],
        onClose: (r) => resolve(r && typeof r === 'object' ? r : null)
      });
      return m;
    });
  }

  /* ---------- small render helpers ---------- */
  function setBusy(container, isBusy, message) {
    if (!container) return;
    if (isBusy) {
      container.innerHTML = `<div class="loading-block"><span class="spinner lg"></span><span>${esc(message || 'Loading…')}</span></div>`;
    }
  }

  function emptyState(glyph, title, message, actionHtml) {
    return `<div class="empty-state">
      <span class="glyph" aria-hidden="true">${glyph || '&#9675;'}</span>
      <h3>${esc(title)}</h3>
      <p>${esc(message || '')}</p>
      ${actionHtml || ''}
    </div>`;
  }

  function alertBox(kind, title, message) {
    return `<div class="alert${kind ? ' alert-' + kind : ''}">
      <div>${title ? `<strong>${esc(title)}</strong>` : ''}${esc(message || '')}</div>
    </div>`;
  }

  function countdown(el, target) {
    const targetTime = A.toDate(target);
    if (!el) return;
    if (!targetTime) { el.innerHTML = ''; return; }
    function tick() {
      const diff = targetTime.getTime() - Date.now();
      if (diff <= 0) {
        el.innerHTML = `<div class="alert alert-warn"><div><strong>Time reached</strong>This deadline has now passed.</div></div>`;
        clearInterval(timer);
        return;
      }
      const s = Math.floor(diff / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      el.innerHTML = `<div class="countdown">
        <div class="unit"><span class="n">${d}</span><span class="l">Days</span></div>
        <div class="unit"><span class="n">${A.pad(h)}</span><span class="l">Hours</span></div>
        <div class="unit"><span class="n">${A.pad(m)}</span><span class="l">Minutes</span></div>
        <div class="unit"><span class="n">${A.pad(sec)}</span><span class="l">Seconds</span></div>
      </div>`;
    }
    tick();
    const timer = setInterval(tick, 1000);
  }

  /* Category chooser for forms — real radio inputs inside styled cards.
     Lives here rather than in page.js so the public registration form and
     the student portal registration both get it. The selected value is read
     from input[name="category"]. */
  function renderCategoryChoices(mount, opts) {
    const o = opts || {};
    const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (!el) return null;
    const selected = o.selected || null;
    el.innerHTML = A.repo.CATEGORIES.map((c) => `
      <label class="choice">
        <input type="radio" name="${A.esc(o.name || 'category')}" value="${c.id}"${c.id === selected ? ' checked' : ''}${o.disabled ? ' disabled' : ''}>
        <span class="choice-title">${A.esc(c.label)}</span>
        <span class="choice-desc">${A.esc(c.blurb)}</span>
      </label>`).join('');
    return el;
  }

  A.ui = {
    NAV_PUBLIC, NAV_PORTAL, NAV_ADMIN,
    emblemSVG, renderHeader, renderFooter, renderPortalNav, renderAdminNav, renderAdminTopbar,
    toast, modal, confirmModal, formModal,
    setBusy, emptyState, alertBox, countdown, renderCategoryChoices
  };
})(window);
