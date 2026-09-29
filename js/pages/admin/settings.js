/* Competition settings — every date, window, quota and publication switch.
   Anything not yet confirmed stays empty so nothing is invented. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let cfg = null, quiz = null, r2cfg = null, finale = null;

  A.admin({
    active: 'admin/settings.html',
    title: 'Competition Settings',
    subtitle: 'Dates, quotas, windows and publication',
    onReady: load
  });

  async function load() {
    [cfg, quiz, r2cfg, finale] = await Promise.all([
      A.repo.getConfig(), A.round1.getQuiz(),
      A.round2.getRound2Config(), A.round2.getFinaleConfig()
    ]);
    render();
  }

  function render() {
    host.innerHTML = `
      <div class="callout" style="margin-bottom:1.5rem">
        <strong>Nothing is assumed.</strong> Fields left empty stay open-ended — the public site and
        student portal will say &ldquo;to be announced&rdquo; rather than inventing a date, quota or rule.
      </div>

      <div class="tabs" role="tablist">
        <button class="tab" role="tab" aria-selected="true" data-tab="general">General</button>
        <button class="tab" role="tab" aria-selected="false" data-tab="windows">Windows &amp; quotas</button>
        <button class="tab" role="tab" aria-selected="false" data-tab="r1">Round 1 quiz</button>
        <button class="tab" role="tab" aria-selected="false" data-tab="r2">Round 2 brief</button>
        <button class="tab" role="tab" aria-selected="false" data-tab="finale">Grand Finale</button>
      </div>

      <div data-panel="general"></div>
      <div data-panel="windows" hidden></div>
      <div data-panel="r1" hidden></div>
      <div data-panel="r2" hidden></div>
      <div data-panel="finale" hidden></div>`;

    host.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        host.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
        host.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.getAttribute('data-panel') !== btn.getAttribute('data-tab'); });
      });
    });

    panel('general', generalForm);
    panel('windows', windowsForm);
    panel('r1', round1Form);
    panel('r2', round2Form);
    panel('finale', finaleForm);
  }

  function panel(name, fn) {
    const el = host.querySelector('[data-panel="' + name + '"]');
    el.innerHTML = `<form class="panel" data-form>
      <div class="panel-body">${fn()}</div>
      <div class="panel-footer">
        <div data-status class="small muted"></div>
        <button class="btn btn-primary" type="submit">Save changes</button>
      </div>
    </form>`;
    el.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const status = el.querySelector('[data-status]');
      status.textContent = 'Saving…';
      Promise.resolve(readForm(name)).then((data) => save(name, data))
        .then((msg) => { status.textContent = msg || 'Saved.'; load(); })
        .catch((err) => { status.textContent = ''; A.ui.toast(err.message || 'Could not save.', 'error'); });
    });
  }

  /* ---------------- forms ---------------- */
  function generalForm() {
    return `
      <div class="form-grid">
        ${text('name', 'Competition name', cfg.name)}
        ${text('tagline', 'Tagline', cfg.tagline)}
        ${text('organiser', 'Organiser', cfg.organiser)}
        ${text('contactEmail', 'Contact email', cfg.contactEmail, 'email')}
        ${num('finalistCount', 'Number of finalists', cfg.finalistCount, '30 finalists reach the Grand Finale.')}
        ${num('grandFinaleDemoMinutes', 'Demonstration time (minutes)', cfg.grandFinaleDemoMinutes, 'Confirmed: up to two minutes.')}
      </div>
      <div class="panel" style="margin-top:1.5rem;box-shadow:none">
        <div class="panel-body">
          <h3 style="font-size:1rem">Announcement switches</h3>
          <p class="small muted">These control the notices published on the dashboard. Turning one on creates the notice if it does not already exist.</p>
          <div class="checkline"><input type="checkbox" id="announceRegistrationOpen" ${cfg.announceRegistrationOpen ? 'checked' : ''}><label for="announceRegistrationOpen">Registration is open</label></div>
          <div class="checkline"><input type="checkbox" id="announceRound1Open" ${cfg.announceRound1Open ? 'checked' : ''}><label for="announceRound1Open">Round 1 is open</label></div>
          <div class="checkline"><input type="checkbox" id="announceRound2Open" ${cfg.announceRound2Open ? 'checked' : ''}><label for="announceRound2Open">Round 2 is open</label></div>
          <div class="checkline"><input type="checkbox" id="announceFinalists" ${cfg.announceFinalists ? 'checked' : ''}><label for="announceFinalists">Finalists have been confirmed</label></div>
        </div>
      </div>`;
  }

  function windowsForm() {
    return `
      <div class="form-grid">
        ${date('registrationOpensAt', 'Registration opens', cfg.registrationOpensAt)}
        ${date('registrationClosesAt', 'Registration closes', cfg.registrationClosesAt)}
        ${date('baApplicationsOpenAt', 'Brand Ambassador registration opens', cfg.baApplicationsOpenAt)}
        ${date('baApplicationsCloseAt', 'Brand Ambassador applications close', cfg.baApplicationsCloseAt)}
      </div>
      <h3 style="font-size:1.05rem;margin-top:1.5rem">Qualification quotas</h3>
      <p class="small muted">Leave empty if qualification is decided manually. A quota of 0 qualifies nobody automatically.</p>
      <div class="form-grid">
        ${num('round1QualifyPerCategory', 'Round 1 — qualify per category', cfg.round1QualifyPerCategory, 'Intended top 100, not yet confirmed.')}
        ${num('round2QualifyPerCategory', 'Round 2 — finalists per category', cfg.round2QualifyPerCategory, 'Intended top 10, not yet confirmed.')}
      </div>`;
  }

  function round1Form() {
    return `
      <div class="form-grid">
        ${date('opensAt', 'Round 1 opens', quiz.opensAt)}
        ${date('closesAt', 'Round 1 closes', quiz.closesAt)}
        ${num('questionCount', 'Questions per attempt', quiz.questionCount, 'Leave empty to use every published question.')}
        ${num('timeLimitMinutes', 'Time limit (minutes)', quiz.timeLimitMinutes, 'Leave empty for no limit.')}
        ${num('defaultMarks', 'Default marks per question', quiz.defaultMarks)}
        ${num('poolLimitPerCategory', 'Draw from category pool', quiz.poolLimitPerCategory, 'Empty takes from the whole category pool.')}
      </div>
      <div class="form-grid" style="margin-top:1rem">
        <div class="field">
          <label for="selectionMethod">Question selection</label>
          <select class="select" id="selectionMethod">
            <option value="random"${quiz.selectionMethod === 'random' ? ' selected' : ''}>Random from the pool</option>
            <option value="manual"${quiz.selectionMethod === 'manual' ? ' selected' : ''}>A fixed manual set</option>
          </select>
        </div>
        <div class="field">
          <label for="tieBreak">Tie-break rule</label>
          <select class="select" id="tieBreak">
            <option value=""${!quiz.tieBreak ? ' selected' : ''}>No tie-break — equal scores share a rank</option>
            <option value="submission_time"${quiz.tieBreak === 'submission_time' ? ' selected' : ''}>Earlier submission ranks higher</option>
            <option value="first_to_finish"${quiz.tieBreak === 'first_to_finish' ? ' selected' : ''}>Earlier finish ranks higher</option>
          </select>
          <div class="field-hint">Not finalised. Equal scores share a rank until you choose.</div>
        </div>
        <div class="field">
          <label for="status">Round 1 status</label>
          <select class="select" id="status">
            <option value="draft"${quiz.status === 'draft' ? ' selected' : ''}>Draft — hidden from students</option>
            <option value="open"${quiz.status === 'open' ? ' selected' : ''}>Open — students may start</option>
            <option value="closed"${quiz.status === 'closed' ? ' selected' : ''}>Closed — no new attempts</option>
          </select>
        </div>
      </div>
      <div style="margin-top:1rem">
        <div class="checkline"><input type="checkbox" id="randomizeQuestions" ${quiz.randomizeQuestions ? 'checked' : ''}><label for="randomizeQuestions">Randomise question order per attempt</label></div>
        <div class="checkline"><input type="checkbox" id="randomizeOptions" ${quiz.randomizeOptions ? 'checked' : ''}><label for="randomizeOptions">Randomise option order</label></div>
        <div class="checkline"><input type="checkbox" id="allowResume" ${quiz.allowResume !== false ? 'checked' : ''}><label for="allowResume">Allow students to resume an unfinished attempt</label></div>
        <div class="checkline"><input type="checkbox" id="oneAttemptPerStudent" ${quiz.oneAttemptPerStudent !== false ? 'checked' : ''}><label for="oneAttemptPerStudent">One official attempt per student</label></div>
        <div class="checkline"><input type="checkbox" id="autoSubmitOnTimeExpiry" ${quiz.autoSubmitOnTimeExpiry !== false ? 'checked' : ''}><label for="autoSubmitOnTimeExpiry">Submit automatically when the time limit expires</label></div>
        <div class="checkline"><input type="checkbox" id="resultsVisibleImmediately" ${quiz.resultsVisibleImmediately ? 'checked' : ''}><label for="resultsVisibleImmediately">Let students see their score immediately (not recommended)</label></div>
      </div>`;
  }

  function round2Form() {
    return `
      <div class="form-grid">
        ${date('opensAt', 'Round 2 opens', r2cfg.opensAt)}
        ${date('closesAt', 'Round 2 closes', r2cfg.closesAt)}
        ${date('resultsAt', 'Round 2 results published', r2cfg.resultsAt)}
        ${text('title', 'Round 2 title', r2cfg.title)}
        ${text('templateUrl', 'Official template URL', r2cfg.templateUrl, 'url', 'The link students download the PowerPoint template from.')}
        ${text('templateNote', 'Template note', r2cfg.templateNote)}
      </div>
      <div class="field" style="margin-top:1rem"><label for="brief">Brief</label><textarea class="textarea" id="brief" rows="4">${A.esc(r2cfg.brief)}</textarea></div>
      <div class="field" style="margin-top:1rem"><label for="instructions">Additional instructions for students</label><textarea class="textarea" id="instructions" rows="3">${A.esc(r2cfg.instructions)}</textarea></div>

      ${A.ui.alertBox('info', 'Judging happens off this website. ', 'There is no rubric here, and no scores are stored. You receive the results separately, then mark the finalists on the Round 2 page and publish their names.')}
      <div style="margin-top:1rem">
        <div class="checkline"><input type="checkbox" id="resultsReleasedToStudents" ${r2cfg.resultsReleasedToStudents ? 'checked' : ''}><label for="resultsReleasedToStudents">Round 2 results released to students</label></div>
        <div class="field" style="max-width:280px;margin-top:1rem">
          <label for="status">Round 2 status</label>
          <select class="select" id="status">
            <option value="draft"${r2cfg.status === 'draft' ? ' selected' : ''}>Draft</option>
            <option value="open"${r2cfg.status === 'open' ? ' selected' : ''}>Open for submissions</option>
            <option value="closed"${r2cfg.status === 'closed' ? ' selected' : ''}>Closed</option>
          </select>
        </div>
      </div>`;

  }

  function finaleForm() {
    return `
      <div class="form-grid">
        ${text('city', 'City', finale.city)}
        ${text('month', 'Month', finale.month)}
        ${date('date', 'Exact date', finale.date)}
        ${text('venue', 'Venue', finale.venue)}
        ${text('reportingTime', 'Reporting time', finale.reportingTime)}
        ${num('presentationMinutes', 'Presentation time (minutes)', finale.presentationMinutes, 'Leave empty until announced.')}
        ${num('demoMinutes', 'Demonstration time (minutes)', finale.demoMinutes, 'Confirmed: up to two minutes.')}
        ${num('interviewCount', 'Interviews per finalist', finale.interviewCount, 'Leave empty until announced.')}
      </div>
      <div class="field" style="margin-top:1rem"><label for="instructions">What finalists should bring</label><textarea class="textarea" id="instructions" rows="3">${A.esc(finale.instructions)}</textarea></div>
      <div class="field" style="margin-top:1rem"><label for="materials">Materials provided</label><textarea class="textarea" id="materials" rows="2">${A.esc(finale.materials)}</textarea></div>
      <div style="margin-top:1rem">
        <div class="checkline"><input type="checkbox" id="finalistsConfirmed" ${finale.finalistsConfirmed ? 'checked' : ''}><label for="finalistsConfirmed">Finalist list confirmed and released</label></div>
        <div class="checkline"><input type="checkbox" id="finalistListReleased" ${finale.finalistListReleased ? 'checked' : ''}><label for="finalistListReleased">Show the public finalist list</label></div>
        <div class="checkline"><input type="checkbox" id="resultsReleased" ${finale.resultsReleased ? 'checked' : ''}><label for="resultsReleased">Grand Finale results released to finalists</label></div>
        <div class="field" style="max-width:280px;margin-top:1rem">
          <label for="status">Status</label>
          <select class="select" id="status">
            <option value="planning"${finale.status === 'planning' ? ' selected' : ''}>Planning</option>
            <option value="announced"${finale.status === 'announced' ? ' selected' : ''}>Announced</option>
            <option value="completed"${finale.status === 'completed' ? ' selected' : ''}>Completed</option>
          </select>
        </div>
      </div>`;
  }

  /* ---------------- read + save ---------------- */
  function el(name) { return host.querySelector('[data-panel="' + name + '"]'); }
  function checked(name) { const e = host.querySelector('#' + name); return !!(e && e.checked); }

  function readForm(name) {
    const scope = el(name);
    const v = (id) => { const e = scope.querySelector('#' + id); return e ? e.value.trim() : ''; };
    const n = (id) => { const raw = v(id); return raw === '' ? null : A.num(raw, 0); };
    const d = (id) => A.readDateInput(scope.querySelector('#' + id));

    if (name === 'general') {
      return A.repo.saveConfig({
        name: v('name'), tagline: v('tagline'), organiser: v('organiser'), contactEmail: v('contactEmail'),
        finalistCount: n('finalistCount'), grandFinaleDemoMinutes: n('grandFinaleDemoMinutes'),
        announceRegistrationOpen: checked('announceRegistrationOpen'),
        announceRound1Open: checked('announceRound1Open'),
        announceRound2Open: checked('announceRound2Open'),
        announceFinalists: checked('announceFinalists')
      }).then(() => 'General settings saved.');
    }
    if (name === 'windows') {
      return A.repo.saveConfig({
        registrationOpensAt: d('registrationOpensAt'), registrationClosesAt: d('registrationClosesAt'),
        baApplicationsOpenAt: v('baApplicationsOpenAt') || null, baApplicationsCloseAt: v('baApplicationsCloseAt') || null,
        round1QualifyPerCategory: n('round1QualifyPerCategory'),
        round2QualifyPerCategory: n('round2QualifyPerCategory')
      }).then(() => 'Windows and quotas saved.');
    }
    if (name === 'r1') {
      return A.round1.saveQuiz({
        opensAt: d('opensAt'), closesAt: d('closesAt'),
        questionCount: n('questionCount'), timeLimitMinutes: n('timeLimitMinutes'),
        defaultMarks: n('defaultMarks'), poolLimitPerCategory: n('poolLimitPerCategory'),
        selectionMethod: v('selectionMethod'), tieBreak: v('tieBreak') || null, status: v('status'),
        randomizeQuestions: checked('randomizeQuestions'), randomizeOptions: checked('randomizeOptions'),
        allowResume: checked('allowResume'), oneAttemptPerStudent: checked('oneAttemptPerStudent'),
        autoSubmitOnTimeExpiry: checked('autoSubmitOnTimeExpiry'),
        resultsVisibleImmediately: checked('resultsVisibleImmediately')
      }).then(() => 'Round 1 configuration saved.');
    }
    if (name === 'r2') {
      return A.round2.saveRound2Config({
        title: v('title'), brief: scope.querySelector('#brief').value.trim(),
        instructions: scope.querySelector('#instructions').value.trim(),
        templateUrl: v('templateUrl'), templateNote: v('templateNote'),
        opensAt: d('opensAt'), closesAt: d('closesAt'), resultsAt: d('resultsAt'),
        resultsReleasedToStudents: checked('resultsReleasedToStudents'), status: v('status')
      }).then(() => 'Round 2 brief saved.');
    }
    return A.round2.saveFinaleConfig({
      city: v('city'), month: v('month'), date: d('date'), venue: v('venue'),
      reportingTime: v('reportingTime'),
      presentationMinutes: n('presentationMinutes'), demoMinutes: n('demoMinutes'),
      interviewCount: n('interviewCount'),
      instructions: scope.querySelector('#instructions').value.trim(),
      materials: scope.querySelector('#materials').value.trim(),
      finalistsConfirmed: checked('finalistsConfirmed'),
      finalistListReleased: checked('finalistListReleased'),
      resultsReleased: checked('resultsReleased'), status: v('status')
    }).then(() => 'Grand Finale settings saved.');
  }

  /* ---------------- field helpers ---------------- */
  function text(name, label, value, type, hint) {
    return `<div class="field"><label for="${name}">${A.esc(label)}</label>
      <input class="input" id="${name}" type="${type || 'text'}" value="${A.esc(value || '')}">
      ${hint ? `<div class="field-hint">${A.esc(hint)}</div>` : ''}</div>`;
  }
  function num(name, label, value, hint) {
    return `<div class="field"><label for="${name}">${A.esc(label)}</label>
      <input class="input" id="${name}" type="number" min="0" step="1" value="${value === null || value === undefined ? '' : A.esc(value)}">
      ${hint ? `<div class="field-hint">${A.esc(hint)}</div>` : ''}</div>`;
  }
  function date(name, label, value) {
    return `<div class="field"><label for="${name}">${A.esc(label)}</label>
      <input class="input" id="${name}" type="datetime-local" value="${A.esc(A.toInputValue(value))}">
      <div class="field-hint">Leave empty for &ldquo;to be announced&rdquo;.</div></div>`;
  }
})();
