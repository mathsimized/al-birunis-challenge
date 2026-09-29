/* A structural check on firestore.rules and storage.rules.
 *
 * This is NOT a compiler. It cannot replace `firebase deploy` or the emulator,
 * but it catches the mistakes that hand-editing a rules file actually produces:
 * an unbalanced brace, a match block for a collection the code never uses, a
 * helper function that is called but not defined, a collection that is only
 * mentioned in a comment, and a collection that has no rule at all and would
 * therefore fall through to the catch-all deny.
 *
 * Run: node tests/rules-lint.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;
let checks = 0;

function pass(l) { checks += 1; console.log('PASS  ' + l); }
function fail(l, d) { checks += 1; failures += 1; console.log('FAIL  ' + l + (d ? '\n        ' + d : '')); }

const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
const storage = fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8');

/* ---------- balance ---------- */
[['firestore.rules', rules], ['storage.rules', storage]].forEach(([name, text]) => {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const open = (stripped.match(/\{/g) || []).length;
  const close = (stripped.match(/\}/g) || []).length;
  if (open === close) pass(name + ': braces balance (' + open + ')');
  else fail(name + ': braces balance', open + ' open vs ' + close + ' close');
  (stripped.match(/\(/g) || []).length === (stripped.match(/\)/g) || []).length
    ? pass(name + ': parentheses balance')
    : fail(name + ': parentheses balance');
});

/* ---------- every collection the code touches has a rule ---------- */
const source = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (e.name === 'node_modules' || e.name === '.git') return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(js|html)$/.test(e.name)) source.push(fs.readFileSync(full, 'utf8'));
  });
})(ROOT);
const code = source.join('\n');

const declared = {};
const codeRe = /^\s{4}([a-zA-Z][a-zA-Z0-9]*):\s*'([a-z0-9_]+)'/gm;
let m;
while ((m = codeRe.exec(code))) declared[m[1]] = m[2];

/* A collection reaches Firestore through collection(C.x), doc(C.x, id) or a
   literal, so all three forms have to be picked up or a collection can be in
   use with no rule at all. */
const used = new Set();
const collect = (name) => {
  const value = declared[name];
  used.add(value === undefined ? 'UNMAPPED:' + name : value);
};
const indirectRe = /(?:\.collection|\.doc)\(\s*C\.([a-zA-Z][a-zA-Z0-9]*)/g;
while ((m = indirectRe.exec(code))) collect(m[1]);
const literalRe = /\.collection\(\s*'(abc_[a-z0-9_]+)'\s*\)/g;
while ((m = literalRe.exec(code))) used.add(m[1]);

const ruleRe = /match \/([a-z0-9_]+)\/\{/g;
const ruled = new Set();
while ((m = ruleRe.exec(rules))) ruled.add(m[1]);
/* The service line matches /databases/, and the shared MATHSIMIZED profile is
   matched as `users`. */
ruled.delete('databases');
ruled.add('users');

const unruled = [...used].filter((c) => c && !ruled.has(c));
if (unruled.length) {
  fail('every collection used in code has a rule (a missing one silently falls to the deny-all catch-all)',
    unruled.join(', '));
} else {
  pass('every collection used in code has a rule (' + used.size + ' collections)');
}

const unused = [...ruled].filter((c) => !used.has(c));
if (unused.length) {
  fail('no orphaned rules for collections the code no longer uses', unused.join(', '));
} else {
  pass('no orphaned rules for collections the code no longer uses');
}

/* ---------- helper functions are defined before use ---------- */
const defined = new Set();
const defRe = /function ([a-zA-Z]+)\s*\(/g;
while ((m = defRe.exec(rules))) defined.add(m[1]);

const builtin = new Set(['get', 'exists', 'diff', 'matches', 'hasAll', 'hasAny', 'hasOnly', 'keys', 'size', 'request', 'resource', 'math']);
const called = new Set();
const callRe = /\b([a-zA-Z]+)\s*\(/g;
const rulesNoComments = rules.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
while ((m = callRe.exec(rulesNoComments))) called.add(m[1]);

/* Anything that is not a rule helper is a keyword, a method on request/resource
   or a Firestore built-in, and is not the linter's business. */
const methods = new Set([
  'diff', 'affectedKeys', 'keys', 'hasAll', 'hasAny', 'hasOnly', 'size', 'matches',
  'get', 'exists', 'request', 'resource'
]);
const unknown = [...called].filter((c) =>
  !defined.has(c) && !methods.has(c) && !builtin.has(c)
  && !['if', 'match', 'allow', 'function', 'service', 'rules_version'].includes(c));
if (unknown.length) {
  fail('every function called in the rules is defined', 'undefined: ' + unknown.join(', '));
} else {
  pass('every function called in the rules is defined (' + defined.size + ' helpers)');
}

/* ---------- the catch-all really is closed ---------- */
if (/match \/\{document=\*\*\} \{\s*allow read, write: if false;/.test(rules)) {
  pass('firestore: the catch-all denies by default');
} else {
  fail('firestore: the catch-all denies by default');
}
if (/match \/\{allPaths=\*\*\} \{\s*allow read, write: if false;/.test(storage)) {
  pass('storage: the catch-all denies by default');
} else {
  fail('storage: the catch-all denies by default');
}

/* ---------- the invariants that matter, restated ---------- */
const attempts = rules.slice(rules.indexOf('match /abc_attempts/'), rules.indexOf('match /abc_results/'));
[
  ['abc_attempts: a student cannot write a score', /hasAny\(\[[^\]]*'score'/],
  ['abc_attempts: a student cannot write breakdown', /hasAny\(\[[^\]]*'breakdown'/],
  ['abc_attempts: a student cannot rewrite the paper', /hasAny\(\[[^\]]*'questions'/],
  ['abc_attempts: a student cannot rewrite startedAt', /hasAny\(\[[^\]]*'startedAt'/],
  ['abc_attempts: a submitted attempt is closed to its owner', /resource\.data\.status == 'in-progress'\s*\n?\s*&& request\.resource\.data\.status == 'submitted'/],
  ['abc_attempts: the category is pinned to the registration', /abc_registrations\/\$\(uid\)\)\.data\.category/],
  ['abc_attempts: the missing-doc lookup is guarded by exists()', /!exists\(\/databases\/\$\(database\)\/documents\/abc_quizzes\/round1\)/],
  ['abc_questions: active questions are readable by signed-in users', /signedIn\(\) && resource\.data\.status == 'active'/],
  ['abc_answer_keys: admin only', /match \/abc_answer_keys\/\{questionId\} \{\s*allow read, write: if isAdmin\(\);/],
  ['abc_ba: admin only, both directions', /match \/abc_ba\/\{code\} \{\s*allow read, write: if isAdmin\(\);/],
  ['abc_public_ba: public only once published', /match \/abc_public_ba\/\{doc\} \{\s*allow read: if resource\.data\.published == true;/],
  ['abc_certificates: a student reads only their own', /match \/abc_certificates[\s\S]*?isSelf\(resource\.data\.uid\)/],
  ['abc_round2_judgements: a judge sees only their own', /resource\.data\.judgeUid == request\.auth\.uid/],
  ['abc_users: the shared profile is never written here', /match \/users\/\{uid\} \{\s*allow read: if isSelf\(uid\);/]
].forEach(([label, re]) => {
  if (re.test(rules)) pass(label);
  else fail(label);
});

[
  ['storage: certificates are admin-write only', /match \/certificates\/\{file\}/],
  ['storage: organiser is admin only', /match \/organiser\/\{allPaths=\*\*\} \{\s*allow read, write: if isAdmin\(\);/]
].forEach(([label, re]) => {
  if (re.test(storage)) pass(label);
  else fail(label);
});

console.log('\n' + (failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks pass'));
process.exit(failures ? 1 : 0);
