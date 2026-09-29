/* My profile — account details, competition progress and data controls. */
(function () {
  'use strict';
  const A = ABC;
  const mount = document.querySelector('[data-prof]');

  A.portal({
    active: 'student/profile.html',
    route: 'student/profile.html',
    onReady: function () { load(); }
  });

  let shared = null;

  function load() {
    Promise.all([
      A.repo.getRegistration(A.user.uid),
      A.repo.getUser(A.user.uid),
      A.repo.getSharedProfile(A.user.uid)
    ]).then(function (r) { shared = r[2]; render(r[0], r[1]); });
  }

  function render(reg, record) {
    const S = A.session.SESSION;
    const linked = S.registration ? 'Linked to your competition registration' : 'No competition registration yet';

    mount.innerHTML = `
      <h1>My profile</h1>
      <p class="muted">Your account details and competition progress.</p>

      <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.5rem;align-items:start;margin-top:1.5rem">
        <div class="stack">
          <div class="card">
            <div style="display:flex;align-items:center;gap:1rem">
              <div class="user-avatar" aria-hidden="true">${A.esc(A.initials((A.user && A.user.displayName) || 'S'))}</div>
              <div style="min-width:0">
                <h2 style="font-size:1.2rem">${A.esc((A.user && A.user.displayName) || 'Student')}</h2>
                <p class="small muted" style="margin:.15rem 0 0">${A.esc((A.user && A.user.email) || '')}</p>
              </div>
            </div>
            <div data-status></div>
            <div class="btn-row" style="margin-top:1.25rem">
              <button class="btn btn-primary btn-sm" id="saveName">Update display name</button>
              <button class="btn btn-outline btn-sm" id="sendReset">Email me a password reset link</button>
            </div>
            <p class="field-hint" style="margin-top:.75rem">Your email address is your login identity and cannot be changed here. Contact the Al-Biruni\'s organising team if it is wrong.</p>
          </div>

          <div class="card">
            <h2 style="font-size:1.15rem">Competition details</h2>
            <dl class="kv" style="margin-top:1rem">
              <dt>Registration</dt><dd>${reg ? A.statusBadge('registered') : A.statusBadge('not-registered')}</dd>
              <dt>Category</dt><dd>${A.esc(A.repo.categoryLabel(reg ? reg.category : ''))}</dd>
              <dt>School</dt><dd>${A.esc(reg ? reg.school : '—')}</dd>
              <dt>City</dt><dd>${A.esc(reg ? reg.city : '—')}</dd>
              <dt>Grade / year</dt><dd>${A.esc(reg ? reg.grade : '—')}</dd>
              <dt>Brand Ambassador</dt><dd>${reg && reg.baAttribution ? A.esc(reg.baAttribution.code) : 'None attributed'}</dd>
              <dt>Registered on</dt><dd>${reg ? A.fmtDateTime(reg.registeredAt) : '—'}</dd>
            </dl>
            <a class="btn btn-outline btn-sm" style="margin-top:1rem" href="registration.html">${reg ? 'Review my details' : 'Register for the competition'}</a>
          </div>
        </div>

        <aside class="stack">
          <div class="card">
            <h3 style="font-size:1.05rem">Progress</h3>
            <div class="stepper" style="margin-top:1rem">
              ${step('Registration', reg ? 'done' : 'todo', reg ? 'Registered' : 'Not registered yet')}
              ${step('Round 1', S.attempt ? (S.attempt.status === 'in-progress' ? 'current' : 'done') : (reg ? 'current' : 'locked'),
                     S.attempt ? (S.attempt.status === 'in-progress' ? 'Attempt in progress' : 'Attempt submitted') : (reg ? 'Ready to begin' : 'Locked'))}
              ${step('Round 1 result', S.result && S.result.releasedToStudent ? 'done' : (S.attempt && S.attempt.status !== 'in-progress' ? 'current' : 'locked'),
                     S.result && S.result.releasedToStudent ? A.esc(A.ordinal(S.result.rank)) + ' &middot; ' + (S.result.qualified ? 'Qualified' : 'Not qualified') : 'Awaiting release')}
              ${step('Round 2', reg && reg.qualifiedForRound2 ? 'current' : 'locked', reg && reg.qualifiedForRound2 ? (S.submission ? 'Submitted' : 'Open to you') : 'Locked')}
              ${step('Grand Finale', S.finalist ? 'done' : 'locked', S.finalist ? 'Finalist' : 'Locked')}
              ${step('Certificates', S.certificates && S.certificates.length ? 'done' : 'locked', S.certificates && S.certificates.length ? S.certificates.length + ' released' : 'Awaiting release')}
            </div>
          </div>

          <div class="card">
            <h3 style="font-size:1.05rem">Your data</h3>
            <p class="muted small" style="margin:0 0 .75rem">${A.esc(linked)}. Competition data is stored separately from your MATHSIMIZED account data and is used only to run this competition.</p>
            <a class="btn btn-outline btn-sm btn-block" href="${A.rootPath('privacy.html')}">Read the privacy policy</a>
          </div>
        </aside>
      </div>`;

    document.getElementById('saveName').addEventListener('click', function () {
      A.ui.formModal({
        title: 'Update display name',
        fields: [{ name: 'displayName', label: 'Display name', value: (A.user && A.user.displayName) || '', required: true }]
      }).then(function (values) {
        if (!values) return;
        return A.user.updateProfile({ displayName: values.displayName.trim() })
          .then(() => A.repo.ensureUser(A.user, { displayName: values.displayName.trim() }))
          .then(() => { A.ui.toast('Display name updated.', 'ok'); render(reg, record); });
      }).catch(function (err) { A.ui.toast(err.message || 'Could not update your name.', 'error'); });
    });

    document.getElementById('sendReset').addEventListener('click', function () {
      A.auth.sendPasswordResetEmail(A.user.email)
        .then(function () { A.ui.toast('Password reset email sent.', 'ok'); })
        .catch(function (err) { A.ui.toast(err.message || 'Could not send the email.', 'error'); });
    });
  }

  function step(label, state, meta) {
    const mark = state === 'done' ? '&#10003;' : state === 'current' ? '&#9679;' : '&#9675;';
    return `<div class="step ${state === 'locked' ? '' : state}">
      <div class="step-dot" aria-hidden="true">${mark}</div>
      <div>
        <div class="step-title">${A.esc(label)} ${A.statusBadge(state === 'done' ? 'approved' : state === 'current' ? 'open' : 'upcoming')}</div>
        <div class="step-body">${meta}</div>
      </div>
    </div>`;
  }
})();
