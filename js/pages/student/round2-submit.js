/* Round 2 submission — the student pastes a Google Drive link to their
   presentation. The organiser controls the window and the lock. */
(function () {
  'use strict';
  const A = ABC;
  const mount = document.querySelector('[data-sub]');

  A.portal({
    active: 'student/round2-submit.html',
    route: 'student/round2-submit.html',
    onReady: function () {
      Promise.all([A.round2.getRound2Config(), A.round2.getSubmission(A.user.uid)])
        .then(function (r) { render(r[0], r[1]); });
      A.round2.onSubmission(A.user.uid, function (s) { render(cfg, s); });
    }
  });

  let cfg = null;

  function note(kind, title, message) {
    return `<div class="alert alert-${kind}"><div>${title ? `<strong>${A.esc(title)}</strong>` : ''}${A.esc(message || '')}</div></div>`;
  }

  function state() {
    const o = A.toDate(cfg.opensAt), c = A.toDate(cfg.closesAt), now = Date.now();
    if (cfg.status === 'draft') return { code: 'draft' };
    if (o && now < o.getTime()) return { code: 'upcoming', opensAt: o };
    if (c && now > c.getTime()) return { code: 'closed', closesAt: c };
    return { code: 'open' };
  }

  function render(config, sub) {
    cfg = config;
    const S = A.session.SESSION;
    const reg = S.registration;
    const st = state();
    const qualified = !!(reg && reg.qualifiedForRound2);
    const locked = !!(sub && sub.locked);

    if (!qualified) {
      mount.innerHTML = `<h1>Round 2 submission</h1>
        ${note('warn', 'Not yet qualified', 'Round 2 is for students who qualified in Round 1.')}
        <div class="btn-row" style="margin-top:1.25rem"><a class="btn btn-outline" href="round2.html">Back to Round 2</a></div>`;
      return;
    }

    const editable = st.code === 'open' && !locked;

    let banner;
    if (st.code === 'draft') banner = note('info', 'Submissions are not open yet', 'The organiser will publish the Round 2 brief and open the submission window shortly.');
    else if (st.code === 'upcoming') banner = note('info', 'Submissions have not opened yet', 'The window opens on ' + A.fmtDateTime(st.opensAt) + '.');
    else if (st.code === 'closed') banner = note('warn', 'Submissions are closed', 'The submission window closed on ' + A.fmtDateTime(st.closesAt) + '. Any changes now need the organiser.');
    else if (locked) banner = note('ok', 'Your submission is locked', 'Your work has been submitted and locked. Contact the organiser if it must be reopened.');
    else if (sub) banner = note('info', 'You can still update your link', 'Your saved link is shown below. Submit again to replace it before the window closes.');
    else banner = '';

    mount.innerHTML = `
      <h1>Round 2 submission</h1>
      <p class="muted">Share a Google Drive link to your presentation. Make sure the link is accessible to the judging panel.</p>
      <div style="margin:1.5rem 0">${banner}</div>

      <div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:1.5rem;align-items:start">
        <div>
          <form class="card" id="subForm" novalidate>
            <fieldset style="margin-top:0">
              <legend>Your work</legend>
              <div class="form-grid">
                <div class="field" id="f-title">
                  <label for="title">Title <span class="req">*</span></label>
                  <input class="input" type="text" id="title" ${editable ? '' : 'disabled'} value="${A.esc(sub ? sub.title : '')}" required>
                  <div class="field-error">Please give your presentation a title.</div>
                </div>
                <div class="field">
                  <label for="topic">Mathematical idea or topic</label>
                  <input class="input" type="text" id="topic" ${editable ? '' : 'disabled'} value="${A.esc(sub ? sub.topic : '')}" placeholder="e.g. The mathematics of star trails">
                </div>
                <div class="field span-2" id="f-url">
                  <label for="driveUrl">Google Drive link <span class="req">*</span></label>
                  <input class="input" type="url" id="driveUrl" ${editable ? '' : 'disabled'} value="${A.esc(sub ? sub.driveUrl : '')}" placeholder="https://drive.google.com/file/d/…">
                  <div class="field-hint">Set the sharing to &ldquo;Anyone with the link can view&rdquo; so judges can open it.</div>
                  <div class="field-error" data-url-err style="display:none"></div>
                </div>
                <div class="field span-2">
                  <label for="notes">Notes for the judges</label>
                  <textarea class="input" id="notes" rows="3" ${editable ? '' : 'disabled'} placeholder="Optional — anything the judges should know">${A.esc(sub ? sub.notes : '')}</textarea>
                </div>
              </div>
            </fieldset>
            <div data-status></div>
            <div class="btn-row">
              <button class="btn btn-primary" type="submit" id="submitBtn" ${editable ? '' : 'disabled'}>${sub ? 'Update submission' : 'Submit my work'}</button>
              <a class="btn btn-secondary" href="round2.html">Back to Round 2</a>
            </div>
          </form>
        </div>

        <aside class="stack">
          <div class="card">
            <h3 style="font-size:1.05rem">Checklist</h3>
            <ul class="stack small" style="padding-left:1.15rem;margin:1rem 0 0">
              <li>Use the official template${cfg.templateUrl ? ' (linked on the Round 2 page)' : ' provided by the organiser'}.</li>
              <li>Explain one mathematical idea clearly and originally.</li>
              <li>A recording of you presenting is optional.</li>
              <li>Check the link opens in a private/incognito window before submitting.</li>
              <li>You may update your link until the organiser locks your submission.</li>
            </ul>
          </div>
          ${sub ? `<div class="card">
            <h3 style="font-size:1.05rem">Submission history</h3>
            <dl class="kv" style="margin-top:1rem">
              <dt>First submitted</dt><dd>${A.fmtDateTime(sub.submittedAt)}</dd>
              ${A.num(sub.resubmitCount) > 0 ? `<dt>Last updated</dt><dd>${A.fmtDateTime(sub.resubmittedAt)}</dd>` : ''}
              <dt>Updates</dt><dd>${A.esc(A.num(sub.resubmitCount))}</dd>
            </dl>
          </div>` : ''}
        </aside>
      </div>`;

    const form = document.getElementById('subForm');
    if (editable) form.addEventListener('submit', onSubmit);

    /* Live link check so students catch a bad link before submitting. */
    const urlEl = document.getElementById('driveUrl');
    if (editable && urlEl) {
      urlEl.addEventListener('blur', function () {
        const err = A.round2.validateDriveUrl(urlEl.value);
        showUrlError(err);
      });
    }
  }

  function showUrlError(msg) {
    const box = document.querySelector('[data-url-err]');
    if (!box) return;
    box.textContent = msg || '';
    box.style.display = msg ? 'block' : 'none';
    document.getElementById('f-url').classList.toggle('invalid', !!msg);
  }

  function onSubmit(e) {
    e.preventDefault();
    const status = document.querySelector('[data-status]');
    const btn = document.getElementById('submitBtn');
    const title = document.getElementById('title').value.trim();
    const driveUrl = document.getElementById('driveUrl').value.trim();

    let ok = true;
    document.getElementById('f-title').classList.toggle('invalid', !title);
    if (!title) ok = false;

    const linkError = A.round2.validateDriveUrl(driveUrl);
    showUrlError(linkError);
    if (linkError) ok = false;
    if (!ok) { status.innerHTML = ''; return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Submitting…';

    A.round2.submitRound2(A.user, A.session.SESSION.registration, {
      title: title,
      topic: document.getElementById('topic').value.trim(),
      driveUrl: driveUrl,
      notes: document.getElementById('notes').value.trim()
    })
      .then(function () {
        A.ui.toast('Your Round 2 work has been submitted.', 'ok');
        return A.round2.getSubmission(A.user.uid);
      })
      .then(function (s) { render(cfg, s); })
      .catch(function (err) {
        status.innerHTML = note('danger', '', err.message || 'Your submission could not be saved.');
        btn.disabled = false;
        btn.textContent = 'Submit my work';
      });
  }
})();
