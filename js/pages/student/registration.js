/* Student registration — reads the shared profile to pre-fill, then
   collects only what the competition needs that is not already known. */
(function () {
  'use strict';
  const A = ABC;
  const mount = document.querySelector('[data-reg]');
  const required = A.queryParam('required') === '1';
  /* Set when the student has only just created their account, so the form can
     explain why they are being asked for a name when they only chose a
     username a moment ago. */
  const welcome = A.queryParam('welcome') === '1';

  let config = null, shared = null;

  A.portal({
    active: 'student/registration.html',
    route: 'student/registration.html',
    requireRegistration: false,
    onReady: function () { render(); }
  });

  A.repo.getConfig().then(function (c) { config = c; render(); });

  function windowNotice() {
    if (!config) return '';
    const open = A.toDate(config.registrationOpensAt);
    const close = A.toDate(config.registrationClosesAt);
    const now = Date.now();
    if (open && now < open.getTime()) {
      return A.ui.alertBox('info', 'Registration has not opened yet',
        'Registration opens on <strong>' + A.fmtDateTime(open) + '</strong>. You can still sign in and prepare.');
    }
    if (close && now > close.getTime()) {
      return A.ui.alertBox('warn', 'Registration has closed',
        'Registration closed at the end of <strong>' + A.fmtDate(close) + '</strong>. If you believe you should have been registered, contact the organiser.');
    }
    /* Students care about the deadline, not when it opened, so lead with that. */
    return A.ui.alertBox('ok', 'Registration is open',
      (close ? 'Register by <strong>' + A.fmtDate(close) + '</strong>' : '') +
      (close ? ' &mdash; it shuts at midnight' : ''));
  }

  function render() {
    const S = A.session.SESSION;
    const reg = S.registration;

    if (reg) { renderExisting(reg); return; }

    mount.innerHTML = `
      <span class="eyebrow left">Step 1 of the journey</span>
      <h1>Competition registration</h1>
      <p class="muted">Confirm your category and tell us about your school. It takes a minute.</p>
      ${welcome ? A.ui.alertBox('ok', 'Your account is ready', 'This form is the competition registration. Your name, category and school are what the organiser needs to enter you, and what will appear on your certificates. It is saved to your account, so you only fill this in once.') : ''}
      ${required ? A.ui.alertBox('warn', 'Registration required', 'You need to register before you can take part in Round 1.') : ''}
      <div style="margin:1.5rem 0">${windowNotice()}</div>
      <div data-form></div>`;

    buildForm();
  }

  function buildForm() {
    const host = document.querySelector('[data-form]');
    if (!host) return;
    const S = A.session.SESSION;

    host.innerHTML = `
      <form class="card" id="regForm" novalidate>
        <fieldset>
          <legend>Your category</legend>
          <p class="small muted">You compete in one category throughout. This cannot be changed once your Round 1 attempt begins.</p>
          <div class="choice-grid" data-categories></div>
          <div class="field-error" id="catErr" style="display:none">Please choose a category.</div>
        </fieldset>

        <div class="form-grid">
          <div class="field" id="f-name">
            <label for="studentName">Full name <span class="req">*</span></label>
            <input class="input" type="text" id="studentName" required>
            <div class="field-hint">This is the name that will appear on your certificates.</div>
            <div class="field-error">Please enter your full name.</div>
          </div>
          <div class="field">
            <label>Email</label>
            <input class="input" type="email" id="regEmail" readonly>
            <div class="field-hint">From your signed-in account.</div>
          </div>
          <div class="field" id="f-school">
            <label for="school">School <span class="req">*</span></label>
            <input class="input" type="text" id="school" required>
            <div class="field-error">Please enter your school.</div>
          </div>
          <div class="field" id="f-city">
            <label for="city">City <span class="req">*</span></label>
            <input class="input" type="text" id="city" required>
            <div class="field-error">Please enter your city.</div>
          </div>
          <div class="field" id="f-grade">
            <label for="grade">Grade / year <span class="req">*</span></label>
            <input class="input" type="text" id="grade" required placeholder="e.g. Grade 10 / Year 1">
            <div class="field-error">Please enter your grade or year.</div>
          </div>
          <div class="field">
            <label for="parentContact">Parent / guardian contact</label>
            <input class="input" type="tel" id="parentContact" placeholder="Optional">
            <div class="field-hint">Only used if the organiser needs to reach you.</div>
          </div>
          <div class="field span-2" id="f-ba">
            <label for="baCode">Brand Ambassador code</label>
            <input class="input" type="text" id="baCode" placeholder="e.g. BA-XXXXXX">
            <div class="field-hint">If a Brand Ambassador referred you, enter the code they
              sent you. The organiser credits it for you — you do not need to do anything else, and
              you will not be able to see or change the count.</div>
          </div>
        </div>

        <div class="checkline">
          <input type="checkbox" id="confirmCategory">
          <label for="confirmCategory">I confirm the category I have selected is the right one for me.</label>
        </div>

        <div data-status></div>
        <button class="btn btn-primary btn-lg" type="submit" id="submitBtn">Complete registration</button>
      </form>`;

    A.renderCategoryChoices('[data-categories]');
    document.getElementById('regEmail').value = (A.user && A.user.email) || '';

    /* Pre-fill from the shared Mathsimized profile where available so the
       student is not asked for information already held. */
    A.repo.getSharedProfile(A.user.uid).then(function (p) {
      shared = p;
      if (!p) return;
      const set = function (id, val) { if (val && !document.getElementById(id).value) document.getElementById(id).value = val; };
      set('studentName', p.displayName || (S.record && S.record.displayName));
      set('school', p.school);
      set('city', p.city);
      set('grade', p.grade);
    });

    document.getElementById('regForm').addEventListener('submit', onSubmit);
  }

  function onSubmit(e) {
    e.preventDefault();
    const status = document.querySelector('[data-status]');
    const btn = document.getElementById('submitBtn');
    const catEl = document.querySelector('input[name="category"]:checked');

    let ok = true;
    const mark = (id, bad) => { document.getElementById(id).classList.toggle('invalid', bad); if (bad) ok = false; };
    mark('f-name', !document.getElementById('studentName').value.trim());
    mark('f-school', !document.getElementById('school').value.trim());
    mark('f-city', !document.getElementById('city').value.trim());
    mark('f-grade', !document.getElementById('grade').value.trim());
    document.getElementById('catErr').style.display = catEl ? 'none' : 'block';
    if (!catEl) ok = false;

    if (!document.getElementById('confirmCategory').checked) {
      status.innerHTML = A.ui.alertBox('warn', '', 'Please confirm your category before submitting.');
      return;
    }
    if (!ok) { status.innerHTML = ''; return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Registering…';

    A.repo.submitRegistration(A.user.uid, {
      studentName: document.getElementById('studentName').value.trim(),
      category: catEl.value,
      school: document.getElementById('school').value.trim(),
      city: document.getElementById('city').value.trim(),
      grade: document.getElementById('grade').value.trim(),
      parentContact: document.getElementById('parentContact').value.trim(),
      baCode: document.getElementById('baCode').value.trim()
    }, { displayName: document.getElementById('studentName').value.trim(), email: A.user.email })
      .then(function () {
        A.ui.toast('You are registered.', 'ok');
        return A.session.refresh().then(render);
      })
      .catch(function (err) {
        status.innerHTML = A.ui.alertBox('danger', '', err.message || 'Registration could not be completed.');
        btn.disabled = false;
        btn.textContent = 'Complete registration';
      });
  }

  function renderExisting(reg) {
    const attemptStarted = A.session.SESSION.attempt &&
      ['in-progress', 'submitted', 'scored'].indexOf(A.session.SESSION.attempt.status) !== -1;

    mount.innerHTML = `
      <span class="eyebrow left">Step 1 of the journey</span>
      <h1>Your registration</h1>
      <p class="muted">These are the details the organiser holds for your entry.</p>

      <div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:1.5rem;align-items:start;margin-top:1.5rem">
        <div class="panel">
          <div class="panel-header"><h2>Registration details</h2>${A.statusBadge('registered')}</div>
          <div class="panel-body">
            <dl class="kv">
              <dt>Name</dt><dd>${A.esc(reg.studentName || '—')}</dd>
              <dt>Email</dt><dd>${A.esc(reg.email || (A.user && A.user.email) || '—')}</dd>
              <dt>Category</dt><dd>${A.esc(A.repo.categoryLabel(reg.category))}</dd>
              <dt>School</dt><dd>${A.esc(reg.school || '—')}</dd>
              <dt>City</dt><dd>${A.esc(reg.city || '—')}</dd>
              <dt>Grade / year</dt><dd>${A.esc(reg.grade || '—')}</dd>
              <dt>Parent contact</dt><dd>${A.esc(reg.parentContact || 'Not provided')}</dd>
              <dt>Brand Ambassador</dt><dd>${reg.baAttribution ? A.esc(reg.baAttribution.name || reg.baAttribution.code) + ' <span class="badge badge-muted">' + A.esc(reg.baAttribution.code) + '</span>' : 'None attributed'}</dd>
              <dt>Registered on</dt><dd>${A.fmtDateTime(reg.registeredAt)}</dd>
            </dl>
          </div>
        </div>

        <aside class="stack">
          <div class="card">
            <h3 style="font-size:1.05rem">Can I change something?</h3>
            <p class="muted small" style="margin:0 0 .75rem">
              ${attemptStarted
                ? 'Your Round 1 attempt has already been used, so your category is now fixed. Contact the organiser for any other correction.'
                : 'Your category and details can still be corrected up until you start your Round 1 attempt.'}
            </p>
            <button class="btn btn-outline btn-sm btn-block" id="editBtn" ${attemptStarted ? 'disabled' : ''}>Edit details</button>
          </div>
          <div class="card">
            <h3 style="font-size:1.05rem">Next step</h3>
            <p class="muted small" style="margin:0 0 .75rem">Round 1 is the online qualifier. Read the instructions before you start.</p>
            <a class="btn btn-primary btn-sm btn-block" href="round1.html">Go to Round 1</a>
          </div>
        </aside>
      </div>
      <div data-edit-host></div>`;

    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        openEditor(reg);
      });
    }
  }

  function openEditor(reg) {
    const host = document.querySelector('[data-edit-host]');
    host.innerHTML = `
      <form class="card" id="editForm" style="margin-top:1.5rem" novalidate>
        <h2 style="font-size:1.2rem">Edit registration</h2>
        <div class="form-grid">
          <div class="field"><label for="eName">Full name</label><input class="input" type="text" id="eName" value="${A.esc(reg.studentName || '')}"></div>
          <div class="field"><label for="eCategory">Category</label>
            <select class="select" id="eCategory">
              ${A.repo.CATEGORIES.map((c) => `<option value="${c.id}"${c.id === reg.category ? ' selected' : ''}>${A.esc(c.label)}</option>`).join('')}
            </select>
            <div class="field-hint">Changing this is only safe before you start Round 1.</div>
          </div>
          <div class="field"><label for="eSchool">School</label><input class="input" type="text" id="eSchool" value="${A.esc(reg.school || '')}"></div>
          <div class="field"><label for="eCity">City</label><input class="input" type="text" id="eCity" value="${A.esc(reg.city || '')}"></div>
          <div class="field"><label for="eGrade">Grade / year</label><input class="input" type="text" id="eGrade" value="${A.esc(reg.grade || '')}"></div>
          <div class="field"><label for="eParent">Parent / guardian contact</label><input class="input" type="tel" id="eParent" value="${A.esc(reg.parentContact || '')}"></div>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" type="submit">Save changes</button>
          <button class="btn btn-secondary" type="button" id="cancelEdit">Cancel</button>
        </div>
      </form>`;

    host.querySelector('#cancelEdit').addEventListener('click', function () { host.innerHTML = ''; });
    host.querySelector('#editForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const patch = {
        studentName: host.querySelector('#eName').value.trim(),
        category: host.querySelector('#eCategory').value,
        school: host.querySelector('#eSchool').value.trim(),
        city: host.querySelector('#eCity').value.trim(),
        grade: host.querySelector('#eGrade').value.trim(),
        parentContact: host.querySelector('#eParent').value.trim()
      };
      A.repo.updateRegistration(A.user.uid, patch)
        .then(function () { A.ui.toast('Registration updated.', 'ok'); A.session.refresh().then(render); })
        .catch(function (err) { A.ui.toast(err.message || 'Could not save.', 'error'); });
    });
  }
})();
