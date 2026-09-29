/* Round 1 — instructions, attempt start, and the live quiz.
   The student browser never receives a correct answer; it also never
   writes a score. Only the sanitised question snapshot in the attempt
   document is used here. */
(function () {
  'use strict';
  const A = ABC;
  const stage = document.querySelector('[data-stage]');
  const topbarMount = document.querySelector('[data-quiz-topbar]');
  const footerMount = document.querySelector('[data-abc-footer]');

  let quiz = null, attempt = null, config = null;
  let current = 0, timer = null, submitting = false, saving = false;

  A.session.boot({ route: 'student/round1.html' }).then(function (S) {
    if (!S) return;
    A.ui.renderHeader(null);
    A.ui.renderPortalNav('student/round1.html');
    const side = document.querySelector('[data-abc-portalnav]');
    const nameEl = side && side.querySelector('[data-portal-name]');
    if (nameEl) nameEl.textContent = A.session.studentName();
    const emailEl = side && side.querySelector('[data-portal-email]');
    if (emailEl) emailEl.textContent = (A.user && A.user.email) || '';

    attempt = S.attempt;
    if (!S.registration) {
      stage.innerHTML = note('warn', 'Registration required',
        'You must register for the competition before you can take Round 1.') +
        '<div class="btn-row" style="margin-top:1.25rem"><a class="btn btn-primary" href="registration.html">Register now</a></div>';
      A.ui.renderFooter();
      return;
    }

    Promise.all([A.round1.getQuiz(), A.repo.getConfig()]).then(function (r) {
      quiz = r[0]; config = r[1];
      if (attempt && attempt.status === 'in-progress') { startQuiz(); }
      else { renderInstructions(); }
      A.ui.renderFooter();
    });
  });

  /* alert() escapes its message, so notices needing emphasis are built here. */
  function note(kind, title, message) {
    return `<div class="alert alert-${kind}"><div>${title ? `<strong>${A.esc(title)}</strong>` : ''}${A.esc(message || '')}</div></div>`;
  }

  /* ---------------- instructions / start ---------------- */
  function renderInstructions() {
    const av = A.round1Availability(quiz, attempt);
    const done = attempt && (attempt.status === 'submitted' || attempt.status === 'scored');

    let notice = '';
    if (av.code === 'unavailable') notice = note('info', 'Round 1 is not open', av.message);
    else if (av.code === 'upcoming') notice = note('info', 'Round 1 has not opened yet',
      av.message + ' It opens on ' + A.fmtDateTime(av.opensAt) + '.');
    else if (av.code === 'in-progress') notice = note('info', 'Attempt in progress', av.message);
    else if (av.code === 'done') notice = note('ok', 'You have completed Round 1',
      'Your official attempt has been submitted and you have one attempt only, so a new attempt cannot be started.');
    else if (av.code === 'closed') notice = note('warn', 'Round 1 is closed',
      'Round 1 is now closed. If you took part, your result will appear once the organiser releases it.');

    const canStart = av.code === 'open' && !done;

    stage.innerHTML = `
      <div class="shell" style="padding:1.75rem 0 4rem">
        <div class="portal">
          <div class="portal-side" data-abc-portalnav></div>
          <div class="portal-main">
            <nav class="breadcrumb" aria-label="Breadcrumb">
              <a href="../index.html">Home</a><span aria-hidden="true">/</span><span aria-current="page">Round 1</span>
            </nav>
            <span class="eyebrow left">Round 1</span>
            <h1>Rapid-Fire Online Qualifier</h1>
            <p class="muted">A timed online mathematics quiz testing knowledge, number sense, speed and accuracy.</p>
            <div style="margin:1.5rem 0">${notice}</div>

            <div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:1.5rem;align-items:start">
              <div class="stack">
                <div class="card card-accent">
                  <h2 style="font-size:1.25rem">Instructions</h2>
                  <ol class="stack" style="padding-left:1.25rem;margin:1rem 0 0;font-size:.94rem">
                    <li>Make sure you have a <strong>stable internet connection</strong> and a quiet moment before you begin.</li>
                    <li>Press <strong>Start Round 1</strong> once, and only once. The timer starts immediately.</li>
                    <li>You have <strong>one official attempt</strong>. Do not create a second account to try again.</li>
                    <li>Your answers <strong>save automatically</strong>. You can move between questions freely.</li>
                    <li>Your attempt <strong>submits automatically</strong> when the time limit expires, so do not close the tab while the timer is running.</li>
                    <li>Correct answers are <strong>not shown</strong> during or after the attempt.</li>
                    <li>Your result and rank appear in your portal once the <strong>organiser releases results</strong>.</li>
                    <li>If a genuine technical fault interrupts you, <strong>contact the organiser</strong> — do not start again.</li>
                  </ol>
                </div>

                <div class="card">
                  <h2 style="font-size:1.25rem">Question types</h2>
                  <ul class="stack small" style="padding-left:1.25rem;margin:1rem 0 0">
                    <li><strong>Multiple choice</strong> — select one answer.</li>
                    <li><strong>Multiple select</strong> — select every answer that applies.</li>
                    <li><strong>Numeric</strong> — type a number only (no units or working).</li>
                    <li><strong>Short answer</strong> — type a short response. Spelling and extra spaces are handled automatically.</li>
                  </ul>
                </div>
              </div>

              <aside class="stack">
                <div class="card">
                  <h3 style="font-size:1.05rem">Round 1 details</h3>
                  <dl class="kv" style="margin-top:1rem">
                    <dt>Category</dt><dd>${A.esc(A.repo.categoryLabel(A.session.SESSION.registration.category))}</dd>
                    <dt>Questions</dt><dd>${quiz.questionCount ? A.esc(quiz.questionCount) : 'As configured by the organiser'}</dd>
                    <dt>Time limit</dt><dd>${quiz.timeLimitMinutes ? A.esc(quiz.timeLimitMinutes) + ' minutes' : 'As configured by the organiser'}</dd>
                    <dt>Window</dt><dd>${A.fmtTime ? A.esc(A.round1WindowLabel(quiz)) : ''}</dd>
                    <dt>Attempts allowed</dt><dd>${quiz.oneAttemptPerStudent === false ? 'As configured' : 'One official attempt'}</dd>
                    <dt>Resume</dt><dd>${quiz.allowResume === false ? 'Not allowed' : 'Allowed'}</dd>
                  </dl>
                </div>

                ${canStart ? `
                  <div class="card" style="border-color:var(--gold)">
                    <h3 style="font-size:1.05rem">Ready?</h3>
                    <p class="muted small">Once you start, the timer begins and your attempt is recorded as your official one.</p>
                    <label class="checkline"><input type="checkbox" id="readyCheck"><label for="readyCheck">I have read the instructions and I am ready to begin.</label></label>
                    <button class="btn btn-primary btn-lg btn-block" id="startBtn" disabled>Start Round 1</button>
                  </div>
                ` : ''}

                <div class="card">
                  <h3 style="font-size:1.05rem">Questions</h3>
                  <p class="muted small" style="margin:0">The organiser adds and manages the question bank for this competition. Check the announcements page for the round brief.</p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>`;

    const check = document.getElementById('readyCheck');
    const startBtn = document.getElementById('startBtn');
    if (check && startBtn) {
      check.addEventListener('change', function () { startBtn.disabled = !check.checked; });
      startBtn.addEventListener('click', onStart);
    }
  }

  function onStart() {
    const btn = document.getElementById('startBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Starting…';
    A.round1.beginAttempt(A.user, A.session.SESSION.registration)
      .then(function (att) {
        attempt = att;
        startQuiz();
      })
      .catch(function (err) {
        A.ui.toast(err.message || 'Could not start your attempt.', 'error');
        renderInstructions();
      });
  }

  /* ---------------- live quiz ---------------- */
  function startQuiz() {
    const questions = attempt.questions || [];
    const total = questions.length;
    const answers = attempt.answers || {};
    current = clampIndex(current, total);

    topbarMount.hidden = false;
    document.querySelector('[data-abc-footer]').hidden = true;

    stage.innerHTML = `
      <div class="shell" style="padding:1.5rem 0 4rem">
        <div class="quiz-shell">
          <aside class="quiz-nav-panel">
            <div class="panel">
              <div class="panel-header">
                <h2 style="font-size:1rem">Questions</h2>
                <span class="badge badge-muted" data-answered-count>0 / ${total}</span>
              </div>
              <div class="qindex" data-qindex></div>
              <div class="panel-footer">
                <button class="btn btn-primary btn-block" id="submitBtn">Submit attempt</button>
                <p class="field-hint" style="margin:.65rem 0 0;text-align:center">You can submit at any time before the timer ends.</p>
              </div>
            </div>
          </aside>
          <div class="card quiz-card" data-question></div>
        </div>
      </div>`;

    document.getElementById('submitBtn').addEventListener('click', confirmSubmit);
    buildIndex();
    renderQuestion();
    startTimer();
  }

  function clampIndex(i, total) {
    if (!total) return 0;
    return Math.min(Math.max(0, i), total - 1);
  }

  function buildIndex() {
    const host = document.querySelector('[data-qindex]');
    if (!host) return;
    const total = (attempt.questions || []).length;
    host.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(i + 1);
      b.addEventListener('click', function () { goTo(i); });
      host.appendChild(b);
    }
    updateIndexStyles();
  }

  function answered(i) {
    const v = (attempt.answers || {})[String(i)];
    return v !== null && v !== undefined && v !== '';
  }

  function updateIndexStyles() {
    const host = document.querySelector('[data-qindex]');
    if (!host) return;
    const total = (attempt.questions || []).length;
    Array.prototype.forEach.call(host.children, function (b, i) {
      b.classList.toggle('answered', answered(i));
      b.classList.toggle('current', i === current);
      b.classList.toggle('flagged', !!(attempt.flagged || {})[String(i)]);
      b.setAttribute('aria-current', i === current ? 'true' : 'false');
      b.setAttribute('aria-label', 'Question ' + (i + 1) + (answered(i) ? ', answered' : ', not answered'));
    });
    const count = document.querySelector('[data-answered-count]');
    if (count) {
      let n = 0;
      for (let i = 0; i < total; i++) if (answered(i)) n++;
      count.textContent = n + ' / ' + total;
    }
    const bar = document.querySelector('[data-progress-bar]');
    if (bar) bar.style.width = A.pct(current + 1, total) + '%';
    const label = document.querySelector('[data-progress-label]');
    if (label) label.textContent = 'Question ' + (current + 1) + ' of ' + total;
  }

  function goTo(i) {
    current = clampIndex(i, (attempt.questions || []).length);
    renderQuestion();
    A.round1.markVisited(attempt.uid, current);
  }

  function renderQuestion() {
    const q = (attempt.questions || [])[current];
    const host = document.querySelector('[data-question]');
    if (!q || !host) return;

    const value = (attempt.answers || {})[String(current)];
    let flagged = !!(attempt.flagged || {})[String(current)];
    const total = (attempt.questions || []).length;

    let bodyHtml = '';
    if (q.type === 'mcq') {
      bodyHtml = `<ul class="options">` + (q.options || []).map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        const checked = value === letter ? ' checked' : '';
        return `<li><label class="option">
          <input type="radio" name="opt" value="${A.esc(letter)}"${checked}>
          <span class="opt-key">${letter}</span>
          <span class="opt-text">${A.esc(opt)}</span>
        </label></li>`;
      }).join('') + `</ul>`;
    } else if (q.type === 'multiple_select') {
      const sel = Array.isArray(value) ? value : [];
      bodyHtml = `<ul class="options">` + (q.options || []).map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        const checked = sel.indexOf(letter) !== -1 ? ' checked' : '';
        return `<li><label class="option">
          <input type="checkbox" name="opt" value="${A.esc(letter)}"${checked}>
          <span class="opt-key">${letter}</span>
          <span class="opt-text">${A.esc(opt)}</span>
        </label></li>`;
      }).join('') + `</ul>`;
    } else if (q.type === 'numeric') {
      bodyHtml = `<div class="field" style="max-width:280px">
        <label for="numAnswer">Your answer</label>
        <input class="input mono" type="text" inputmode="decimal" id="numAnswer" value="${A.esc(value || '')}" placeholder="e.g. 42">
        <div class="field-hint">Numbers only — no units, no working.</div>
      </div>`;
    } else {
      bodyHtml = `<div class="field">
        <label for="textAnswer">Your answer</label>
        <input class="input" type="text" id="textAnswer" value="${A.esc(value || '')}" placeholder="Type your answer">
        <div class="field-hint">Extra spaces and capitalisation are handled automatically.</div>
      </div>`;
    }

    host.innerHTML = `
      <div class="quiz-meta">
        <span class="badge badge-burgundy">Question ${current + 1} of ${total}</span>
        ${q.marks ? `<span class="badge badge-muted">${A.esc(A.plural(q.marks, 'mark'))}</span>` : ''}
        ${q.topic ? `<span class="badge badge-muted">${A.esc(q.topic)}</span>` : ''}
        <span class="save-state" data-save><span class="dot"></span><span data-save-text>Saved</span></span>
      </div>
      <div class="quiz-question">${A.esc(q.text)}</div>
      ${bodyHtml}
      <div class="quiz-nav">
        <button class="btn btn-secondary" id="prevBtn" ${current === 0 ? 'disabled' : ''}>&larr; Previous</button>
        <div class="flex-center">
          <button class="btn btn-ghost" id="flagBtn" data-flag>${flagged ? 'Unflag' : 'Flag for review'}</button>
        </div>
        <button class="btn btn-primary" id="nextBtn" ${current === total - 1 ? 'disabled' : ''}>Next &rarr;</button>
      </div>`;

    /* Wire inputs. */
    host.querySelectorAll('input[name="opt"]').forEach(function (input) {
      input.addEventListener('change', function () {
        let next;
        if (q.type === 'multiple_select') {
          const sel = Array.prototype.slice.call(host.querySelectorAll('input[name="opt"]:checked')).map(function (c) { return c.value; });
          next = sel.length ? sel : null;
        } else {
          next = input.value;
        }
        saveAnswer(next);
      });
    });
    const numEl = host.querySelector('#numAnswer');
    if (numEl) numEl.addEventListener('input', debouncedSave(numEl, q));
    const textEl = host.querySelector('#textAnswer');
    if (textEl) textEl.addEventListener('input', debouncedSave(textEl, q));

    host.querySelector('#prevBtn').addEventListener('click', function () { goTo(current - 1); });
    const nextBtn = host.querySelector('#nextBtn');
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); });
    function paintFlag() {
      const btn = host.querySelector('#flagBtn');
      if (!btn) return;
      btn.textContent = flagged ? 'Unflag' : 'Flag for review';
      btn.classList.toggle('btn-outline', flagged);
      btn.classList.toggle('btn-ghost', !flagged);
      updateIndexStyles();
    }

    host.querySelector('#flagBtn').addEventListener('click', function () {
      const next = !flagged;
      attempt.flagged = attempt.flagged || {};
      attempt.flagged[String(current)] = next;   /* update the screen at once */
      flagged = next;
      paintFlag();
      A.round1.saveFlag(attempt.uid, current, next)
        .catch(function () {
          attempt.flagged[String(current)] = !next; /* roll the screen back */
          flagged = !next;
          paintFlag();
          A.ui.toast('That flag could not be saved. Try again.', 'error');
        });
    });

    updateIndexStyles();
  }

  function debouncedSave(el, q) {
    return A.debounce(function () {
      const raw = el.value.trim();
      const next = raw === '' ? null : (q.type === 'numeric' ? raw : raw);
      saveAnswer(next);
    }, 600);
  }

  const MAX_SAVE_RETRIES = 3;
  let saveRetries = 0;

  function saveAnswer(value) {
    if (saving) { pendingSave = value; return; }
    saving = true;
    pendingSave = undefined;
    (attempt.answers || (attempt.answers = {}))[String(current)] = value;
    setSaveState('saving', 'Saving…');
    A.round1.saveAnswer(attempt.uid, current, value)
      .then(function () {
        saveRetries = 0;
        setSaveState('ok', 'Saved');
        updateIndexStyles();
      })
      .catch(function (err) {
        saveRetries += 1;
        if (saveRetries <= MAX_SAVE_RETRIES) {
          /* A dropped connection must not cost a student their answer. */
          setSaveState('saving', 'Retrying…');
          setTimeout(function () { saveAnswer(value); }, Math.min(8000, 800 * Math.pow(2, saveRetries - 1)));
        } else {
          setSaveState('error', 'Not saved — check your connection');
          A.ui.toast('An answer could not be saved. It is still on screen — submit before closing this page.', 'error');
        }
      })
      .then(function () {
        saving = false;
        if (pendingSave !== undefined) { const v = pendingSave; pendingSave = undefined; saveAnswer(v); }
      });
  }
  let pendingSave;

  function setSaveState(state, text) {
    const el = document.querySelector('[data-save]');
    if (!el) return;
    el.className = 'save-state' + (state === 'saving' ? ' saving' : state === 'error' ? ' error' : '');
    const t = el.querySelector('[data-save-text]');
    if (t) t.textContent = text;
  }

  /* ---------------- timer ---------------- */
  function startTimer() {
    const el = document.querySelector('[data-timer]');
    if (!attempt.deadlineMs) {
      if (el) el.textContent = 'No limit';
      return;
    }
    function tick() {
      const left = Math.max(0, Math.floor((attempt.deadlineMs - Date.now()) / 1000));
      if (el) {
        el.textContent = A.fmtDuration(left);
        el.classList.toggle('warn', left <= 300 && left > 60);
        el.classList.toggle('critical', left <= 60);
      }
      if (left <= 0 && !submitting) {
        if (quiz.autoSubmitOnTimeExpiry === false) return;
        autoSubmit();
      }
    }
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
  }

  function autoSubmit() {
    if (submitting) return;
    submitting = true;
    clearInterval(timer);
    A.round1.submitAttempt(attempt.uid, { manual: false })
      .then(function () { showSubmitted(true); })
      .catch(function () { showSubmitted(true, 'Your time ran out. The organiser has been notified.'); });
  }

  function confirmSubmit() {
    if (submitting) return;
    const total = (attempt.questions || []).length;
    let n = 0;
    for (let i = 0; i < total; i++) if (answered(i)) n++;
    const unanswered = total - n;
    A.ui.confirmModal(
      'Submit your attempt?',
      unanswered === 0
        ? 'You have answered all ' + total + ' questions. Once submitted you cannot change your answers.'
        : 'You have answered ' + n + ' of ' + total + ' questions. ' + unanswered + ' ' + A.plural(unanswered, 'question is', 'questions are') + ' unanswered. You cannot change your answers after submitting.',
      'Submit attempt'
    ).then(function (ok) {
      if (!ok) return;
      submitting = true;
      clearInterval(timer);
      A.round1.submitAttempt(attempt.uid, { manual: true })
        .then(function () { showSubmitted(false); })
        .catch(function (err) { submitting = false; A.ui.toast(err.message || 'Could not submit.', 'error'); startTimer(); });
    });
  }

  function showSubmitted(auto, note) {
    const total = (attempt.questions || []).length;
    stage.innerHTML = `
      <div class="shell" style="padding:4rem 0">
        <div style="max-width:640px;margin-inline:auto;text-align:center">
          <div style="font-size:3rem;color:var(--gold)" aria-hidden="true">${auto ? '&#9200;' : '&#10003;'}</div>
          <h1>${auto ? 'Time is up' : 'Attempt submitted'}</h1>
          <p class="muted">${auto
            ? 'Your time ran out and your attempt was submitted automatically.'
            : 'Your Round 1 attempt has been recorded. Thank you for taking part.'}</p>
          ${note ? `<div class="alert alert-warn" style="margin-top:1rem;text-align:left"><div>${A.esc(note)}</div></div>` : ''}
          <div class="callout" style="margin-top:1.5rem;text-align:left">
            <strong>What happens next</strong>
            Your result and rank will appear in your portal once the organiser reviews the
            leaderboard and releases results. You will see your own result and rank whether or
            not you appear on the public leaderboard.
          </div>
          <div class="btn-row" style="justify-content:center;margin-top:1.5rem">
            <a class="btn btn-primary" href="round1-result.html">Go to my result page</a>
            <a class="btn btn-outline" href="dashboard.html">Back to dashboard</a>
          </div>
        </div>
      </div>`;
    topbarMount.hidden = true;
    document.querySelector('[data-abc-footer]').hidden = false;
  }
})();
