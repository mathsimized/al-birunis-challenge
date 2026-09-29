/* Brand Ambassador response-sheet import.
 *
 * The organiser copies rows out of the Google Form's linked sheet, so the
 * parser has to survive whatever that sheet happens to contain: tabs or
 * commas, a timestamp column in front, a "never submit again" column at the
 * back, quoted cells, blank lines, and categories typed in prose.
 *
 * It is loaded out of the page module rather than a Firebase emulator,
 * because parsing is pure string work and needs no project to test.
 *
 * Run: node tests/ba-import-parse.js
 */
'use strict';
const fs = require('fs');
let src = fs.readFileSync('js/pages/admin/brand-ambassadors.js', 'utf8');
const start = src.indexOf('  const IMPORT_COLUMNS');
const end = src.indexOf('  async function importDialog');
const body = src.slice(start, end);

const CATEGORIES = [
  { id: 'prep', label: 'Prep (Grades 6-8)' },
  { id: 'high', label: 'High School (Grades 9-11)' },
  { id: 'open', label: 'Open (Grades 12 / university)' }
];
const A = {
  repo: { CATEGORIES },
  esc: (s) => String(s),
  ui: { alertBox: () => '', confirmModal: async () => true, toast: () => {} }
};
const fn = new Function('A', body + '\nreturn { parseImportedRows, splitRow, detectDelimiter, normaliseHeader };');
const api = fn(A);

let pass = 0, fail = 0;
const t = (label, cond, got) => {
  if (cond) { pass++; console.log('PASS  ' + label); }
  else { fail++; console.log('FAIL  ' + label + (got !== undefined ? '\n        got: ' + JSON.stringify(got) : '')); }
};

/* 1. a real Google Sheets copy: tabs, verbose headers, extra columns */
const sheets = [
  'Timestamp\tEmail Address\tName\tCategory to promote\tSchool / Institution\tCity\tContact Number\tNever submit again',
  '9/20/2026 10:12\tali@example.com\tAli Raza\tPrep (Grades 6-8)\tHabib Public School\tKarachi\t0300-1234567\tNever submit again',
  '9/20/2026 11:03\tsara@example.com\tSara Khan\tHigh School (Grades 9-11)\tAitchison\tLahore\t0321-9998887\tNever submit again'
].join('\n');
let r = api.parseImportedRows(sheets);
t('sheets: delimiter detected as tab', api.detectDelimiter(sheets) === '\t');
t('sheets: two applicants', r.rows.length === 2, r.rows);
t('sheets: name read', r.rows[0].name === 'Ali Raza', r.rows[0]);
t('sheets: email read past the timestamp column', r.rows[0].email === 'ali@example.com');
t('sheets: contact read', r.rows[1].contact === '0321-9998887');
t('sheets: school read', r.rows[0].school === 'Habib Public School');
t('sheets: city read', r.rows[1].city === 'Lahore');
t('sheets: category matched by label', r.rows[0].category === 'prep' && r.rows[1].category === 'high', r.rows.map((x) => x.category));
t('sheets: the never-submit column is ignored', r.problems.length === 0, r.problems);
t('sheets: marked as a form import', r.rows[0].source === 'google-form-import');

/* 2. CSV with a quoted comma inside a name cell */
const csv = 'Name,Email Address,Category,School\n"Hassan, Mir",hassan@example.com,Open (Grades 12 / university),KGS';
r = api.parseImportedRows(csv);
t('csv: delimiter detected as comma', api.detectDelimiter(csv) === ',');
t('csv: one applicant', r.rows.length === 1);
t('csv: quoted comma kept whole', r.rows[0].name === 'Hassan, Mir', r.rows[0].name);
t('csv: third category matched', r.rows[0].category === 'open', r.rows[0].category);

/* 3. a header with a numbered suffix and mixed case */
r = api.parseImportedRows('Full Name (required)\nBilal Ahmed');
t('header: "(required)" stripped', r.rows.length === 1 && r.rows[0].name === 'Bilal Ahmed', r);

/* 4. no header: refuse rather than import garbage */
r = api.parseImportedRows('Ali Raza\tPrep (Grades 6-8)');
t('no header: refuses and explains', r.rows.length === 0 && /name column/i.test(r.problems[0]), r);

/* 5. blank lines and a row without a name are skipped, not fatal */
r = api.parseImportedRows('Name,Category\n\nAli Raza,Prep\n,Prep\nSara Khan,Prep\n\n');
t('blank lines: three rows in, one blank-name row skipped', r.rows.length === 2, r.rows);
t('blank lines: the skip is reported', r.problems.length === 1, r.problems);

/* 6. an unrecognised category is imported but flagged, not dropped */
r = api.parseImportedRows('Name,Category\nAli Raza,Underwater Basket Weaving');
t('unknown category: row survives', r.rows.length === 1);
t('unknown category: category left empty', r.rows[0].category === '');
t('unknown category: flagged to the organiser', /not one of the three categories/.test(r.problems[0]), r.problems);

/* 7. a form footer line is not turned into a person */
r = api.parseImportedRows('Name,Category\nForm Response 1\nAli Raza,Prep');
t('form footer skipped', r.rows.length === 1 && r.rows[0].name === 'Ali Raza', r.rows);

/* 8. empty paste */
r = api.parseImportedRows('   \n  \n');
t('empty paste: says so', r.rows.length === 0 && /Nothing was pasted/.test(r.problems[0]), r);

/* 9. quoted cell with an escaped quote */
t('splitRow: "" is one quote', api.splitRow('a,"b""c",d', ',')[1] === 'b"c', api.splitRow('a,"b""c",d', ','));

console.log('\n' + (fail ? fail + ' of ' + (pass + fail) + ' FAILED' : 'all ' + pass + ' checks pass'));
process.exit(fail ? 1 : 0);
