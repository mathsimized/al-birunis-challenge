/* Announcements admin — publish notices to the public site and the portal. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let rows = [];

  A.admin({
    active: 'admin/announcements.html',
    title: 'Announcements',
    subtitle: 'Notices for students and the public',
    onReady: load
  });

  async function load() {
    rows = await A.repo.listAnnouncements();
    render();
  }

  function render() {
    const published = rows.filter((r) => r.published);
    const drafts = rows.filter((r) => !r.published);

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Notices', rows.length, '')}
        ${stat('Published', published.length, 'Live on the public and portal pages')}
        ${stat('Drafts', drafts.length, drafts.length ? 'Not visible to anyone' : 'None')}
        ${stat('Pinned', rows.filter((r) => r.pinned).length, '')}
      </div>

      <div class="btn-row" style="margin:1.5rem 0">
        <button class="btn btn-primary" id="newBtn">Write a notice</button>
        <button class="btn btn-outline" id="quickOpenBtn">Quick notice: registration open</button>
        <button class="btn btn-outline" id="quickR1Btn">Quick notice: Round 1 open</button>
        <button class="btn btn-outline" id="quickR2Btn">Quick notice: Round 2 open</button>
        <button class="btn btn-outline" id="quickFinBtn">Quick notice: finalists confirmed</button>
        <button class="btn btn-outline" id="quickBaBtn">Quick notice: BA top five</button>
        <button class="btn btn-outline" id="bestBtn">Ceremony: Best BA announcement</button>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>All notices</h2></div>
        <div class="panel-body">
          <div data-list></div>
        </div>
      </div>`;

    host.querySelector('#newBtn').addEventListener('click', () => openEditor(null));

    /* The top five is published as names and ranks only. The counts behind it
       stay in the admin panel, and the Best Brand Ambassador is named at the
       Grand Finale rather than here. */
    host.querySelector('#quickBaBtn').addEventListener('click', async function () {
      const btn = this;
      btn.disabled = true;
      try {
        const baRows = await A.repo.listBAs();
        const ranked = A.repo.baLeaderboard(baRows, 5);
        if (!ranked.length) { A.ui.toast('No approved ambassadors yet.', 'error'); return; }
        openEditor(Object.assign({ audience: 'everyone', published: true, pinned: true }, topFiveCopy(ranked)));
      } catch (e) {
        A.ui.toast(e.message || 'Could not load the ranking.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
    /* The Best Brand Ambassador is named at the Grand Finale, and only there.
       This is the one notice that states the count behind the win, so it is
       built from the admin panel and never published to the website. */
    host.querySelector('#bestBtn').addEventListener('click', async function () {
      const btn = this;
      btn.disabled = true;
      try {
        const baRows = await A.repo.listBAs();
        const ranked = A.repo.baLeaderboard(baRows, 5);
        if (!ranked.length) { A.ui.toast('No approved ambassadors yet.', 'error'); return; }
        openEditor(Object.assign({
          audience: 'everyone', published: true, pinned: true
        }, bestCopy(ranked[0])));
      } catch (e) {
        A.ui.toast(e.message || 'Could not load the ranking.', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    const quick = (btn, title, body) => {
      host.querySelector(btn).addEventListener('click', function () {
        A.repo.saveAnnouncement({ title, body, audience: 'everyone', published: true })
          .then(function () { A.ui.toast('Notice published.', 'ok'); load(); });
      });
    };
    quick('#quickOpenBtn', 'Registration is open',
      'Registration for Al-Biruni\'s Challenge 2026 is now open. Sign in to the student portal to register and choose your category.');
    quick('#quickR1Btn', 'Round 1 is open',
      'Round 1, the Rapid-Fire Online Qualifier, is now open. Read the instructions carefully — you have one official attempt and the timer starts the moment you begin.');
    quick('#quickR2Btn', 'Round 2 is open for submissions',
      'Round 2, the Mathematical Communication Challenge, is open for submissions. Submit a Google Drive link to your presentation before the window closes.');
    quick('#quickFinBtn', 'Finalists confirmed',
      'The finalists for the Grand Finale have been confirmed. Finalists can see their event details in the finalist area of the student portal.');

    drawList();
  }

  function drawList() {
    const ordered = A.sortBy(rows, (r) => r.publishedAt || r.createdAt, 'desc');
    document.querySelector('[data-list]').innerHTML = A.table([
      { key: 'title', label: 'Notice', render: (r) => `<strong>${r.pinned ? '<span class="badge badge-burgundy">Pinned</span> ' : ''}${A.esc(r.title)}</strong><div class="small muted">${A.esc(A.trunc(r.body, 90))}</div>` },
      { key: 'audience', label: 'Audience', render: (r) => A.esc(A.repo.ANNOUNCEMENT_AUDIENCES[r.audience] || 'Everyone') },
      { key: 'published', label: 'Status', render: (r) => (r.published ? A.statusBadge('approved') : A.statusBadge('pending')) },
      { key: 'publishedAt', label: 'Published', render: (r) => (r.published ? A.fmtDateTime(r.publishedAt) : '—') },
      {
        label: 'Actions', render: (r) => `<div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-edit="${A.esc(r.id)}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${A.esc(r.id)}">${r.published ? 'Unpublish' : 'Publish'}</button>
          <button class="btn btn-ghost btn-sm" data-del="${A.esc(r.id)}">Delete</button>
        </div>`
      }
    ], ordered, { emptyTitle: 'No notices yet', emptyMessage: 'Write the first announcement for students.' });

    document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', function () {
      openEditor(rows.find((r) => r.id === this.getAttribute('data-edit')));
    }));
    document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', function () {
      const a = rows.find((r) => r.id === this.getAttribute('data-toggle'));
      A.repo.saveAnnouncement(Object.assign({}, a, { id: a.id, published: !a.published }))
        .then(function () { A.ui.toast(a.published ? 'Notice unpublished.' : 'Notice published.', 'ok'); load(); });
    }));
    document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', function () {
      const id = b.getAttribute('data-del');
      A.confirmRun({
        title: 'Delete this notice?',
        message: 'This cannot be undone.',
        confirmLabel: 'Delete', button: this,
        run: function () { return A.repo.deleteAnnouncement(id); },
        success: 'Notice deleted.'
      }).then(load).catch(function () {});
    }));
  }

  /* Copy the organiser can paste into the announcement and into Instagram.
     The top five is names and ranks only: the counts behind it stay private. */
  function topFiveCopy(ranked) {
    const top = ranked.slice(0, 5);
    const lines = top.map((b) => b.rank + '. ' + b.name + (b.school ? ' — ' + b.school : ''));
    return {
      title: 'Brand Ambassador top five announced',
      body: 'Our top five Brand Ambassadors for Al-Biruni\'s Challenge 2026 are:\n\n'
        + lines.join('\n') + '\n\n'
        + 'Thank you to every ambassador who took part. Registration counts behind '
        + 'this ranking are kept private by the organiser, and the Best Brand Ambassador '
        + 'award will be presented at the Grand Finale award ceremony in Karachi.\n\n'
        + 'Full details: ' + A.rootPath('brand-ambassadors.html')
    };
  }

  /* For the ceremony. Unlike the top-five notice this one states the count
     behind the win, which is why it is written here and not published to the
     website. */
  function bestCopy(best) {
    return {
      title: 'Best Brand Ambassador 2026',
      body: 'The Best Brand Ambassador for Al-Biruni\'s Challenge 2026 is '
        + best.name + ', with ' + best.attributedCount
        + ' attributed registrations.\n\n'
        + 'Our sincere congratulations. The full story, and the ambassadors who made the '
        + 'top five, are on the competition website.'
    };
  }

  function openEditor(a) {
    const isNew = !a;
    a = a || { audience: 'everyone', published: false, pinned: false };
    A.ui.formModal(isNew ? 'Write a notice' : 'Edit notice', [
      { name: 'title', label: 'Title', value: a.title || '', required: true, span: true },
      { name: 'body', label: 'Notice', type: 'textarea', value: a.body || '', required: true, span: true, rows: 6 },
      { name: 'audience', label: 'Audience', type: 'select', value: a.audience || 'everyone',
        options: Object.keys(A.repo.ANNOUNCEMENT_AUDIENCES).map((k) => ({ value: k, label: A.repo.ANNOUNCEMENT_AUDIENCES[k] })) },
      { name: 'published', label: 'Publish immediately', type: 'checkbox', value: a.published !== false },
      { name: 'pinned', label: 'Pin to the top', type: 'checkbox', value: !!a.pinned }
    ], { wide: true }).then(function (v) {
      if (!v) return;
      return A.repo.saveAnnouncement(v, isNew ? null : a.id).then(function () {
        A.ui.toast(isNew ? 'Notice saved.' : 'Notice updated.', 'ok');
        load();
      });
    }).catch(function (err) { A.ui.toast(err.message || 'Could not save the notice.', 'error'); });
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
