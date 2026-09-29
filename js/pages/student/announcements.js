/* Announcements inside the portal — the same published notices as the public
   page, plus any student-only notices. */
(function () {
  'use strict';
  const A = ABC;
  const mount = document.querySelector('[data-ann]');

  A.portal({
    active: 'student/announcements.html',
    route: 'student/announcements.html',
    onReady: function () {
      A.repo.onAnnouncements({}, function (rows) { render(rows); });
    }
  });

  function render(rows) {
    const S = A.session.SESSION;
    const reg = S.registration;
    const ctx = {
      record: S.record, registration: reg, attempt: S.attempt,
      result: S.result, finalist: S.finalist, isAmbassador: false
    };
    const mine = rows.filter((a) => A.repo.announcementVisibleTo(a, ctx));

    const open = A.round1Availability(A.round1.DEFAULT_QUIZ(), S.attempt);
    const notes = [];
    if (!reg) notes.push(card('warn', 'You are not registered yet', 'Register to take part in Round 1.', 'student/registration.html', 'Register now'));
    else if (open.code === 'upcoming') notes.push(card('info', 'Round 1 has not opened yet', 'It opens on ' + A.fmtDateTime(open.opensAt) + '.', 'student/round1.html', 'Read the instructions'));
    else if (open.code === 'in-progress') notes.push(card('warn', 'Your Round 1 attempt is in progress', 'Finish and submit it before the timer expires.', 'student/round1.html', 'Resume attempt'));
    else if (open.code === 'open' && !S.attempt) notes.push(card('ok', 'Round 1 is open', 'You have one official attempt. Read the instructions first.', 'student/round1.html', 'Go to Round 1'));
    if (reg && reg.qualifiedForRound2) notes.push(card('ok', 'You are qualified for Round 2', 'Check the brief and submit your work when the window opens.', 'student/round2.html', 'Go to Round 2'));

    mount.innerHTML = `
      <h1>Announcements</h1>
      <p class="muted">Official notices from the organiser. Check this page between rounds.</p>

      <div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:1.5rem;align-items:start;margin-top:1.5rem">
        <div>
          ${mine.length ? mine.map(item).join('') : A.ui.emptyState('&#9675;', 'No announcements yet', 'Official notices will appear here as the organiser publishes them.')}
        </div>
        <aside class="stack">
          ${notes.length ? `<div class="card"><h3 style="font-size:1.05rem">Your status</h3><div class="stack" style="margin-top:1rem">${notes.join('')}</div></div>` : ''}
          <div class="card">
            <h3 style="font-size:1.05rem">Public announcements</h3>
            <p class="muted small" style="margin:0 0 .75rem">Notices aimed at everyone are also published on the public site.</p>
            <a class="btn btn-outline btn-sm btn-block" href="${A.rootPath('announcements.html')}">Open the public page</a>
          </div>
        </aside>
      </div>`;
  }

  function item(a) {
    const d = A.toDate(a.publishedAt || a.createdAt);
    const pinned = a.pinned
      ? '<span class="badge badge-burgundy">Pinned</span> ' : '';
    return `<div class="announcement">
      <div class="date-block">
        <div class="d">${d ? d.getDate() : '--'}</div>
        <div class="m">${d ? d.toLocaleDateString('en-GB', { month: 'short' }) : ''}</div>
      </div>
      <div>
        <h3>${pinned}${A.esc(a.title)}</h3>
        <div class="body" style="white-space:pre-line">${A.esc(a.body)}</div>
        <div class="audience">
          <span class="badge badge-muted">${A.esc(A.repo.ANNOUNCEMENT_AUDIENCES[a.audience] || 'Everyone')}</span>
          <span>${A.fmtDateTime(a.publishedAt || a.createdAt)}</span>
        </div>
      </div>
    </div>`;
  }

  function card(kind, title, body, href, cta) {
    return `<div class="alert alert-${kind}">
      <div>
        <strong>${A.esc(title)}</strong>${A.esc(body)}
        <div style="margin-top:.6rem"><a class="btn btn-outline btn-sm" href="${A.rootPath(href)}">${A.esc(cta)}</a></div>
      </div>
    </div>`;
  }
})();
