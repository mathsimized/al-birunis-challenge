/* Admin dashboard — the operational summary: counts, what is open, what
   needs attention, and the next action for each round. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  A.admin({
    active: 'admin/index.html',
    title: 'Dashboard',
    subtitle: 'Al-Biruni\'s Challenge 2026',
    onReady: render
  });

  async function render() {
    const [cfg, quiz, r2cfg, finale, regs, results, attempts, submissions, finals, certs, bas, anns, judges, users] =
      await Promise.all([
        A.repo.getConfig(), A.round1.getQuiz(), A.round2.getRound2Config(), A.round2.getFinaleConfig(),
        A.repo.listRegistrations(), A.round1.listResults(), A.round1.listAttempts(),
        A.round2.listSubmissions({}), A.round2.listFinalists(),
        A.repo.listCertificates(), A.repo.listBAs(), A.repo.listAnnouncements({ includeUnpublished: true }),
        A.repo.listJudges(), A.repo.listUsers()
      ]);

    const r1 = A.round1Availability(quiz, null);
    const byCat = A.repo.CATEGORIES.map((c) => {
      const list = regs.filter((r) => r.category === c.id);
      return { c, total: list.length, qualified: list.filter((r) => r.qualifiedForRound2).length };
    });
    const pendingJudging = submissions.filter((s) => !s.locked || s.status !== 'judged');
    const unscored = attempts.filter((a) => a.status === 'submitted' && a.resultStatus !== 'scored');
    const unreleased = results.filter((r) => !r.releasedToStudent);
    const draftCerts = certs.filter((c) => !c.released);
    const pendingBA = bas.filter((b) => b.status === 'pending');

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Registrations', regs.length, 'Total across all categories')}
        ${stat('Round 1 attempts', attempts.length, unscored.length + ' awaiting scoring')}
        ${stat('Round 2 submissions', submissions.length, submissions.filter((s) => s.locked).length + ' locked')}
        ${stat('Finalists', finals.length, 'of ' + A.num(cfg.finalistCount, 30) + ' places')}
      </div>

      <div class="grid" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:1.5rem;align-items:start;margin-top:1.5rem">
        <div class="stack">
          <div class="panel">
            <div class="panel-header"><h2>Round status</h2></div>
            <div class="panel-body">
              ${roundRow('Round 1 — Rapid-Fire Qualifier', A.rootPath('admin/round1.html'),
                quiz.status === 'draft' ? ['badge-muted', 'Draft'] : r1.code === 'closed' ? ['badge-muted', 'Closed'] : r1.code === 'upcoming' ? ['badge-info', 'Upcoming'] : ['badge-ok', 'Open'],
                A.round1WindowLabel(quiz),
                `${attempts.length} attempts · ${A.num(results.length)} scored`)}
              ${roundRow('Round 1 — Results publication', A.rootPath('admin/results.html'),
                unreleased.length ? ['badge-warn', `${unreleased.length} unreleased`] : ['badge-ok', 'All released'],
                cfg.resultsReleasedToStudents ? 'Released to students' : 'Not yet released to students',
                `${results.filter((r) => r.qualified).length} qualified`)}
              ${roundRow('Round 2 — Communication Challenge', A.rootPath('admin/round2.html'),
                r2cfg.status === 'draft' ? ['badge-muted', 'Draft'] : (A.toDate(r2cfg.closesAt) && Date.now() > A.toDate(r2cfg.closesAt).getTime()) ? ['badge-muted', 'Closed'] : ['badge-ok', 'Submissions open'],
                `${A.fmtDateTime(r2cfg.opensAt) || 'Opens: to be set'} – ${A.fmtDateTime(r2cfg.closesAt) || 'closes: to be set'}`,
                `${submissions.length} submissions · ${judges.length} judges`)}
              ${roundRow('Grand Finale', A.rootPath('admin/grand-finale.html'),
                finale.status === 'planning' ? ['badge-muted', 'Planning'] : ['badge-info', finale.status],
                `${finale.city || 'Karachi'} · ${finale.month || 'November 2026'}`,
                `${finals.length} finalists confirmed`)}
            </div>
          </div>

          <div class="panel">
            <div class="panel-header"><h2>Registrations by category</h2></div>
            <div class="panel-body">
              <div class="table-wrap"><table class="data">
                <thead><tr><th>Category</th><th class="num">Registered</th><th class="num">Qualified for Round 2</th><th class="num">Share</th></tr></thead>
                <tbody>${byCat.map((row) => `<tr>
                  <td><strong>${A.esc(row.c.label)}</strong></td>
                  <td class="num">${A.esc(A.num(row.total))}</td>
                  <td class="num">${A.esc(A.num(row.qualified))}</td>
                  <td class="num">${regs.length ? A.pct(row.total, regs.length) + '%' : '—'}</td>
                </tr>`).join('')}</tbody>
                <tfoot><tr><th>Total</th><th class="num">${A.esc(A.num(regs.length))}</th><th class="num">${A.esc(A.num(byCat.reduce((n, r) => n + r.qualified, 0)))}</th><th></th></tr></tfoot>
              </table></div>
            </div>
          </div>
        </div>

        <aside class="stack">
          <div class="panel">
            <div class="panel-header"><h2>Needs attention</h2></div>
            <div class="panel-body">
              <div class="stack">
                ${task(unscored.length, 'attempts awaiting scoring', 'admin/round1.html', 'Score attempts')}
                ${task(results.filter((r) => r.releasedToStudent).length, 'results released to students', 'admin/results.html', 'Manage publication')}
                ${task(pendingBA.length, 'Brand Ambassador applications to review', 'admin/brand-ambassadors.html', 'Review applications')}
                ${task(draftCerts.length, 'certificates drafted but not released', 'admin/certificates.html', 'Manage certificates')}
                ${task(anns.filter((a) => a.published === false).length, 'unpublished announcements', 'admin/announcements.html', 'Publish notices')}
                ${task(judges.length < 2, 'judges for Round 2', 'admin/users.html', 'Manage judges', judges.length < 2)}
                ${task(pendingJudging.length, 'Round 2 submissions still in play', 'admin/round2.html', 'Open judging')}
                ${!anns.length ? task(1, 'no announcements published yet', 'admin/announcements.html', 'Write the first notice', true) : ''}
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header"><h2>Quick actions</h2></div>
            <div class="panel-body stack">
              <a class="btn btn-outline btn-sm btn-block" href="questions.html">Manage the question bank</a>
              <a class="btn btn-outline btn-sm btn-block" href="import.html">Import questions from CSV</a>
              <a class="btn btn-outline btn-sm btn-block" href="settings.html">Competition settings &amp; dates</a>
              <a class="btn btn-outline btn-sm btn-block" href="registrations.html">Export registrations</a>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header"><h2>Accounts</h2></div>
            <div class="panel-body">
              <dl class="kv">
                <dt>Total accounts</dt><dd>${A.esc(A.num(users.length))}</dd>
                <dt>Admins</dt><dd>${A.esc(A.num(users.filter((u) => u.role === A.ROLE.ADMIN).length))}</dd>
                <dt>Judges</dt><dd>${A.esc(A.num(users.filter((u) => u.role === A.ROLE.JUDGE).length))}</dd>
              </dl>
            </div>
          </div>
        </aside>
      </div>`;
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }

  function roundRow(name, href, badge, window, meta) {
    return `<a class="admin-round" href="${href}">
      <div style="min-width:0">
        <div class="admin-round-name">${A.esc(name)}</div>
        <div class="admin-round-meta">${A.esc(window)} &middot; ${A.esc(meta)}</div>
      </div>
      <span class="badge ${badge[0]}">${A.esc(badge[1])}</span>
    </a>`;
  }

  function task(count, label, href, cta, urgent) {
    return `<a class="admin-task${urgent && count ? ' urgent' : ''}" href="${href}">
      <span class="n">${A.esc(A.num(count))}</span>
      <span class="t"><span class="l">${A.esc(label)}</span><span class="c">${A.esc(cta)} &rarr;</span></span>
    </a>`;
  }
})();
