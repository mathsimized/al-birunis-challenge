/* Question bank — the single source of truth for Round 1 questions.
   Correct answers live here and are never sent to a student's browser. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  let rows = [], quiz = null;
  const state = { category: '', type: '', difficulty: '', status: 'active' };

  A.admin({
    active: 'admin/questions.html',
    title: 'Question Bank',
    subtitle: 'Round 1 questions',
    onReady: load
  });

  async function load() {
    [rows, quiz] = await Promise.all([
      A.round1.listQuestions({}), A.round1.getQuiz()
    ]);
    render();
  }

  function render() {
    const stats = A.round1.questionStats(rows);
    const perAttempt = quiz.questionCount;

    host.innerHTML = `
      <div class="grid grid-4" style="gap:1rem">
        ${stat('Total questions', stats.total, `${stats.active} active`)}
        ${A.repo.CATEGORIES.map((c) => stat(c.label, (stats.byCategory[c.id] || {}).total || 0,
          `${(stats.byCategory[c.id] || {}).active || 0} active`)).join('')}
      </div>

      <div class="callout" style="margin-top:1.5rem">
        <strong>Paper per attempt:</strong>
        ${perAttempt ? A.esc(A.num(perAttempt)) + ' questions' : 'every active question in the student\'s category (no cap set)'} ·
        <strong>Selection:</strong> ${quiz.selectionMethod === 'manual' ? 'a fixed manual set' : 'random from the pool'}
        ${perAttempt && perAttempt > (stats.active || 0) ? ' · <span style="color:var(--danger)">warning: more questions are requested per attempt than exist in the bank</span>' : ''}
      </div>

      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header">
          <h2>Questions</h2>
          <div class="flex-center">
            <button class="btn btn-primary btn-sm" id="newBtn">New question</button>
            <a class="btn btn-outline btn-sm" href="import.html">Import from CSV</a>
            <button class="btn btn-outline btn-sm" id="exportBtn">Export</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="toolbar" style="margin-bottom:1rem">
            <div class="field">
              <label for="fCategory">Category</label>
              <select class="select" id="fCategory">
                <option value="">All categories</option>
                ${A.repo.CATEGORIES.map((c) => `<option value="${c.id}"${state.category === c.id ? ' selected' : ''}>${A.esc(c.label)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="fType">Type</label>
              <select class="select" id="fType">
                <option value="">All types</option>
                ${A.round1.Q_TYPES.map((t) => `<option value="${t}"${state.type === t ? ' selected' : ''}>${A.esc(A.round1.Q_TYPE_LABELS[t])}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="fDifficulty">Difficulty</label>
              <select class="select" id="fDifficulty">
                <option value="">Any difficulty</option>
                ${A.round1.DIFFICULTIES.map((d) => `<option value="${d}"${state.difficulty === d ? ' selected' : ''}>${A.esc(A.round1.DIFFICULTY_LABELS[d])}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="fStatus">Status</label>
              <select class="select" id="fStatus">
                <option value="active"${state.status === 'active' ? ' selected' : ''}>Active</option>
                <option value="inactive"${state.status === 'inactive' ? ' selected' : ''}>Inactive</option>
                <option value=""${state.status === '' ? ' selected' : ''}>All</option>
              </select>
            </div>
          </div>
          <div data-list></div>
        </div>
      </div>`;

    ['fCategory', 'fType', 'fDifficulty', 'fStatus'].forEach((id) => {
      host.querySelector('#' + id).addEventListener('change', function () {
        state[id.replace('f', '').toLowerCase()] = this.value;
        drawList();
      });
    });
    host.querySelector('#newBtn').addEventListener('click', () => openEditor(null));
    host.querySelector('#exportBtn').addEventListener('click', exportCsv);
    drawList();
  }

  function filtered() {
    return rows.filter((r) =>
      (!state.category || r.category === state.category) &&
      (!state.type || r.type === state.type) &&
      (!state.difficulty || r.difficulty === state.difficulty) &&
      (!state.status || r.status === state.status));
  }

  function drawList() {
    const list = filtered();
    A.filterBar('[data-list]', list, function (out) {
      return A.table([
        { key: 'text', label: 'Question', render: (r) => `<strong>${A.esc(A.trunc(r.text, 90))}</strong>${r.topic ? `<div class="small muted">${A.esc(r.topic)}</div>` : ''}` },
        { key: 'category', label: 'Category', render: (r) => A.esc(A.repo.categoryLabel(r.category)) },
        { key: 'type', label: 'Type', render: (r) => A.esc(A.round1.Q_TYPE_LABELS[r.type] || r.type) },
        { key: 'difficulty', label: 'Difficulty', render: (r) => A.esc(A.round1.DIFFICULTY_LABELS[r.difficulty] || r.difficulty) },
        { key: 'marks', label: 'Marks', className: 'num', render: (r) => A.esc(A.num(r.marks, 1)) },
        { key: 'status', label: 'Status', render: (r) => A.statusBadge(r.status === 'active' ? 'approved' : 'rejected') },
        {
          label: 'Actions', render: (r) => `<div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-edit="${A.esc(r.id)}">Edit</button>
            <button class="btn btn-ghost btn-sm" data-toggle="${A.esc(r.id)}">${r.status === 'active' ? 'Deactivate' : 'Activate'}</button>
            <button class="btn btn-ghost btn-sm" data-del="${A.esc(r.id)}">Delete</button>
          </div>`
        }
      ], out, { emptyTitle: 'No questions match', emptyMessage: 'Adjust the filters or add a question.' });
    }, 'Search question text or topic…');

    document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
      openEditor(rows.find((r) => r.id === b.getAttribute('data-edit')));
    }));
    document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', function () {
      const q = rows.find((r) => r.id === this.getAttribute('data-toggle'));
      A.round1.setQuestionStatus(q.id, q.status === 'active' ? 'inactive' : 'active')
        .then(function () { A.ui.toast('Question updated.', 'ok'); load(); });
    }));
    document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', function () {
      const btn = this;
      const q = rows.find((r) => r.id === btn.getAttribute('data-del'));
      A.confirmRun({
        title: 'Delete this question?',
        message: 'Attempts already taken keep their own copy, so existing attempts are unaffected. This cannot be undone.',
        confirmLabel: 'Delete', button: btn,
        run: function () { return A.round1.deleteQuestion(q.id); },
        success: 'Question deleted.'
      }).then(load).catch(function () {});
    }));
  }

  /* ---------------- editor ---------------- */
  function openEditor(q) {
    const isNew = !q;
    q = q || { category: 'prep', type: 'mcq', difficulty: 'medium', marks: 1, options: ['', '', '', ''], status: 'active' };

    const fields = [
      { name: 'category', label: 'Category', type: 'select', value: q.category, required: true, options: A.repo.CATEGORIES.map((c) => ({ value: c.id, label: c.label })) },
      { name: 'type', label: 'Type', type: 'select', value: q.type, required: true, options: A.round1.Q_TYPES.map((t) => ({ value: t, label: A.round1.Q_TYPE_LABELS[t] })) },
      { name: 'difficulty', label: 'Difficulty', type: 'select', value: q.difficulty, options: A.round1.DIFFICULTIES.map((d) => ({ value: d, label: A.round1.DIFFICULTY_LABELS[d] })) },
      { name: 'marks', label: 'Marks', type: 'number', value: A.num(q.marks, 1) },
      { name: 'status', label: 'Status', type: 'select', value: q.status, options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
      { name: 'text', label: 'Question text', type: 'textarea', value: q.text, required: true, span: true, rows: 3 },
      { name: 'optionsText', label: 'Answer options', type: 'textarea', value: (q.options || []).map((o) => (typeof o === 'string' ? o : o.text)).join('\n'), span: true, rows: 4, hint: 'One option per line. The letters A, B, C… are assigned in order.' },
      { name: 'correct', label: 'Correct answer', value: Array.isArray(q.correct) ? q.correct.join(', ') : (q.correct || ''), hint: 'Letter(s) for choice questions (A, or A;C for multiple select). The exact value for numeric or short answer.' },
      { name: 'topic', label: 'Topic' },
      { name: 'explanation', label: 'Explanation for the answer key', type: 'textarea', span: true, rows: 2, hint: 'Kept in the private answer key. Never shown to students.' }
    ];

    A.ui.formModal(isNew ? 'New question' : 'Edit question', fields, { wide: true })
      .then(function (v) {
        if (!v) return;
        const options = String(v.optionsText || '').split('\n').map((s) => s.trim()).filter(Boolean);
        const payload = {
          category: v.category,
          type: v.type,
          difficulty: v.difficulty,
          marks: A.num(v.marks, 1),
          status: v.status,
          text: v.text,
          options: options,
          correct: v.type === 'multiple_select'
            ? String(v.correct || '').split(/[|;,]/).map((s) => s.trim()).filter(Boolean)
            : v.correct,
          topic: v.topic,
          explanation: v.explanation
        };
        const check = A.round1.validateQuestion(A.round1.normaliseQuestion(payload));
        if (!check.ok) { A.ui.toast(check.errors.join(' '), 'error'); return openEditor(q); }
        return A.round1.saveQuestion(payload, isNew ? null : q.id)
          .then(function () { A.ui.toast(isNew ? 'Question added.' : 'Question updated.', 'ok'); load(); });
      })
      .catch(function (err) { A.ui.toast(err.message || 'Could not save the question.', 'error'); });
  }

  function exportCsv() {
    const list = filtered();
    A.exportCSV('al-birunis-question-bank.csv', [
      { key: 'category', label: 'Category', csv: (r) => r.category },
      { key: 'type', label: 'Type', csv: (r) => r.type },
      { key: 'difficulty', label: 'Difficulty', csv: (r) => r.difficulty },
      { key: 'marks', label: 'Marks' },
      { key: 'text', label: 'Question' },
      { key: 'options', label: 'Options', csv: (r) => (r.options || []).map((o) => (typeof o === 'string' ? o : o.text)).join(' | ') },
      { key: 'correct', label: 'Correct', csv: (r) => (Array.isArray(r.correct) ? r.correct.join(';') : r.correct) },
      { key: 'topic', label: 'Topic' },
      { key: 'explanation', label: 'Explanation' },
      { key: 'status', label: 'Status' }
    ], list);
  }

  function stat(label, value, hint) {
    return `<div class="stat"><div class="stat-label">${A.esc(label)}</div><div class="stat-value">${A.esc(A.num(value))}</div><div class="stat-hint">${A.esc(hint)}</div></div>`;
  }
})();
