/* CSV question import — validate every row before anything is written. */
(function () {
  'use strict';
  const A = ABC;
  const host = document.querySelector('[data-host]');

  const COLUMNS = [
    { key: 'category', label: 'Category', required: true, hint: 'prep, olevel or alevel' },
    { key: 'type', label: 'Type', required: true, hint: 'mcq, multiple_select, numeric or short_answer' },
    { key: 'difficulty', label: 'Difficulty', hint: 'easy, medium or hard' },
    { key: 'marks', label: 'Marks' },
    { key: 'text', label: 'Question', required: true },
    { key: 'options', label: 'Options', hint: 'Separate with | for each option' },
    { key: 'correct', label: 'Correct', required: true, hint: 'A for mcq; A;C for multiple_select; exact value otherwise' },
    { key: 'topic', label: 'Topic' },
    { key: 'explanation', label: 'Explanation' },
    { key: 'status', label: 'Status', hint: 'active or inactive' }
  ];

  let parsed = [];

  A.admin({
    active: 'admin/import.html',
    title: 'Import Questions',
    subtitle: 'Bulk-load the question bank from CSV',
    onReady: render
  });

  function render() {
    host.innerHTML = `
      <div class="grid" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:1.5rem;align-items:start">
        <div class="panel">
          <div class="panel-header"><h2>Upload a CSV</h2></div>
          <div class="panel-body">
            <div class="field">
              <label for="csvFile">CSV file</label>
              <input class="input" type="file" id="csvFile" accept=".csv,text/csv">
              <div class="field-hint">The first row must contain the column headers listed on the right.</div>
            </div>
            <div class="field" style="margin-top:1rem">
              <label for="csvText">…or paste CSV</label>
              <textarea class="textarea mono" id="csvText" rows="6" placeholder="category,type,difficulty,marks,text,options,correct,topic"></textarea>
            </div>
            <div class="btn-row" style="margin-top:1rem">
              <button class="btn btn-primary" id="parseBtn">Validate rows</button>
              <button class="btn btn-outline" id="templateBtn">Download template</button>
              <button class="btn btn-outline" id="sampleBtn">Download a sample</button>
            </div>
            <div data-status style="margin-top:1rem"></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h2>Expected columns</h2></div>
          <div class="panel-body">
            ${A.table([
              { key: 'label', label: 'Column' },
              { key: 'hint', label: 'Notes', render: (r) => r.hint || '—' },
              { key: 'required', label: 'Required', render: (r) => (r.required ? '<span class="req">Yes</span>' : 'No') }
            ], COLUMNS)}
            <div class="callout" style="margin-top:1rem">
              <strong>Nothing is written until you confirm.</strong> Every row is validated first —
              missing categories, unanswerable options and duplicate rows are reported and skipped.
            </div>
          </div>
        </div>
      </div>

      <div data-preview></div>`;

    host.querySelector('#csvFile').addEventListener('change', function () {
      const file = this.files && this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { host.querySelector('#csvText').value = String(reader.result); validate(); };
      reader.readAsText(file);
    });
    host.querySelector('#parseBtn').addEventListener('click', validate);
    host.querySelector('#templateBtn').addEventListener('click', () => {
      A.downloadText('question-import-template.csv',
        COLUMNS.map((c) => A.csvEscape(c.label)).join(',') + '\r\n', 'text/csv');
    });
    host.querySelector('#sampleBtn').addEventListener('click', () => {
      A.downloadText('question-import-sample.csv', [
        COLUMNS.map((c) => A.csvEscape(c.label)).join(','),
        ['prep', 'mcq', 'easy', '1', 'What is the value of 7 x 6?', '36|42|48|54', 'B', 'Multiplication'].map(A.csvEscape).join(','),
        ['olevel', 'numeric', 'medium', '2', 'Solve for x: 3x + 5 = 20', '', '5', 'Linear equations'].map(A.csvEscape).join(','),
        ['alevel', 'multiple_select', 'hard', '3', 'Which of these are prime numbers?', '9|11|15|21', 'B', 'Number theory'].map(A.csvEscape).join(',')
      ].join('\r\n'), 'text/csv');
    });
  }

  function validate() {
    const text = host.querySelector('#csvText').value.trim();
    const status = host.querySelector('[data-status]');
    if (!text) { status.innerHTML = A.ui.alertBox('warn', '', 'Choose a file or paste some CSV first.'); return; }

    const table = A.parseCSV(text);
    if (table.length < 2) { status.innerHTML = A.ui.alertBox('warn', '', 'The CSV needs a header row and at least one question row.'); return; }

    const headers = table[0].map((h) => String(h).trim().toLowerCase());
    const index = {};
    headers.forEach((h, i) => { index[h] = i; });

    const missing = COLUMNS.filter((c) => c.required).filter((c) => index[headerFor(c)] === undefined);
    if (missing.length) {
      status.innerHTML = A.ui.alertBox('danger', 'Missing required columns',
        'The header row is missing: ' + missing.map((c) => c.label).join(', ') + '.');
      return;
    }

    const ok = [], bad = [], seen = new Set();
    table.slice(1).forEach((cells, i) => {
      const get = (name) => {
        const at = index[name];
        return at === undefined ? '' : String(cells[at] === undefined ? '' : cells[at]).trim();
      };
      const raw = {
        category: get('category').toLowerCase(),
        type: get('type').toLowerCase().replace(/[\s-]+/g, '_'),
        difficulty: get('difficulty').toLowerCase() || 'medium',
        marks: A.num(get('marks'), 1),
        text: get('text') || get('question'),
        options: get('options').split('|').map((s) => s.trim()).filter(Boolean),
        correct: get('correct'),
        topic: get('topic'),
        explanation: get('explanation'),
        status: get('status').toLowerCase() || 'active'
      };
      const data = A.round1.normaliseQuestion(raw);
      const check = A.round1.validateQuestion(data, i);
      const fingerprint = (data.category + '|' + data.text).toLowerCase();
      if (seen.has(fingerprint)) { bad.push({ row: i + 2, errors: ['Duplicate of an earlier row in this file.'] }); return; }
      seen.add(fingerprint);
      if (!check.ok) { bad.push({ row: i + 2, errors: check.errors }); return; }
      ok.push(Object.assign({}, data, { warnings: check.warnings, row: i + 2 }));
    });

    parsed = ok;
    renderPreview(ok, bad, status);
  }

  function headerFor(col) { return col.key === 'text' ? 'text' : col.key; }

  function renderPreview(ok, bad, status) {
    status.innerHTML = bad.length
      ? A.ui.alertBox('warn', `${ok.length} row(s) ready, ${bad.length} row(s) rejected`,
          'Fix the rejected rows in the source file and validate again.')
      : A.ui.alertBox('ok', `${ok.length} row(s) validated`, 'Nothing has been written yet.');

    const preview = document.querySelector('[data-preview]');
    preview.innerHTML = `
      <div class="panel" style="margin-top:1.5rem">
        <div class="panel-header">
          <h2>Preview</h2>
          <div class="flex-center">
            <button class="btn btn-primary" id="importBtn" ${ok.length ? '' : 'disabled'}>Import ${ok.length} question(s)</button>
          </div>
        </div>
        <div class="panel-body">
          ${A.table([
            { key: 'row', label: 'Row', className: 'num' },
            { key: 'category', label: 'Category', render: (r) => A.esc(A.repo.categoryLabel(r.category)) },
            { key: 'type', label: 'Type', render: (r) => A.esc(A.round1.Q_TYPE_LABELS[r.type] || r.type) },
            { key: 'text', label: 'Question', render: (r) => `<strong>${A.esc(A.trunc(r.text, 80))}</strong>${r.options.length ? `<div class="small muted">${A.esc(r.options.join(' · '))}</div>` : ''}` },
            { key: 'correct', label: 'Correct', render: (r) => `<span class="mono">${A.esc(Array.isArray(r.correct) ? r.correct.join(', ') : r.correct)}</span>` },
            { key: 'warnings', label: 'Notes', render: (r) => (r.warnings && r.warnings.length ? `<span class="small muted">${A.esc(r.warnings.join(' '))}</span>` : '—') }
          ], ok, { emptyTitle: 'Nothing to import', emptyMessage: 'Correct the errors listed above and validate again.' })}

          ${bad.length ? `<h3 style="margin-top:1.5rem">Rejected rows</h3>
            <ul class="stack small" style="padding-left:1.1rem">${bad.map((b) => `<li><strong>Row ${b.row}:</strong> ${A.esc(b.errors.join(' '))}</li>`).join('')}</ul>` : ''}
        </div>
      </div>`;

    const btn = document.getElementById('importBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        A.confirmRun({
          title: 'Import these questions?',
          message: `${parsed.length} question(s) will be added to the bank as active questions.`,
          confirmLabel: 'Import', button: this, busyLabel: 'Importing…',
          run: function () { return A.round1.importQuestions(parsed); },
          success: 'Questions imported.'
        }).then(function () {
          host.querySelector('#csvText').value = '';
          parsed = [];
          location.reload();
        }).catch(function () {});
      });
    }
  }
})();
