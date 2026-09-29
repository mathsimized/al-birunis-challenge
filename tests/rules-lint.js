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
/* Cloud Storage was removed: it requires the Blaze plan. Its rules went with
   it, and the test below asserts that it stays gone. */
const STORAGE_GONE = !fs.existsSync(path.join(ROOT, 'storage.rules'));

/* ---------- balance ---------- */
[['firestore.rules', rules]].forEach(([name, text]) => {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const open = (stripped.match(/\{/g) || []).length;
  const close = (stripped.match(/\}/g) || []).length;
  if (open === close) pass(name + ': braces balance (' + open + ')');
  else fail(name + ': braces balance', open + ' open vs ' + close + ' close');
  (stripped.match(/\(/g) || []).length === (stripped.match(/\)/g) || []).length
    ? pass(name + ': parentheses balance')
    : fail(name + ': parentheses balance');
});

/* This is now the competition's own Firebase project. The other site's ruleset
   that used to be carried over verbatim is gone, along with the reason it had
   to be: there is no shared project left to break. The checks below replace the
   preservation assertions with the things that matter now. */
const SPLIT_REQUIRED = [
  /* The file's own header, which is what a person reads before deciding
     whether it is safe to paste into the console. It used to assert that
     deploying this file would replace another live site — true when the two
     shared a project, and dangerously wrong now. A comment is not enforced at
     runtime, so only a test catches it going stale. */
  ['the header names this project', /Target project: al-birunis-challenge/],
  ['the round window is checked with the server clock', /function round1AfterOpening\(\)[\s\S]{0,400}?request\.time >=/],
  ['and with the server clock on the closing side too', /function round1BeforeClosing\(\)[\s\S]{0,400}?request\.time <=/],
  ['it reads the configured opening time', /round1AfterOpening\(\)[\s\S]{0,400}?data\.get\('opensAt', null\)/],
  ['and the configured closing time', /round1BeforeClosing\(\)[\s\S]{0,400}?data\.get\('closesAt', null\)/],
  ['a missing config does not lock the round shut', /!exists\([\s\S]{0,120}?abc_quizzes\/round1\)/],
  ['and it is enforced when an attempt is opened', /allow create: if isAdmin\(\)[\s\S]{0,200}?round1WindowOpen\(\)/],
  ['an unconfigured deadline is not read as "closed"', /\.data\.get\('opensAt', null\) is timestamp/],

  ['the admin is identified by the verified email', /function isOrganiser\(\)[\s\S]{0,160}?request\.auth\.token\.email == 'mathsimized@gmail\.com'/],
  ['the organiser can bootstrap their own admin record', /isOrganiser\(\)\s*\?\s*request\.resource\.data\.role == 'admin'/],

  /* The username reservation. A stranger may read these, so the document has
     to stay trivial: no email, no competition data, ever. */
  ['a username is readable by anyone, to check availability', /match \/usernames\/\{name\} \{\s*allow read: if true;/],
  ['a username can only be claimed for yourself', /allow create: if signedIn\(\)[\s\S]{0,140}?request\.auth\.uid == request\.resource\.data\.uid/],
  ['a claim carries nothing but the name and the account id', /hasOnly\(\['uid', 'username', 'createdAt'\]\)/],
  ['the document is named by the name it claims', /name == request\.resource\.data\.username/],
  ['a claimed username cannot be taken back or renamed', /allow update, delete: if isAdmin\(\);/],

  ['a self-update can touch only its own display fields', /diff\(resource\.data\)\.affectedKeys\(\)[\s\S]{0,80}?\.hasOnly\(\['email', 'displayName', 'username', 'updatedAt'\]\)/]
];

SPLIT_REQUIRED.forEach(([label, re]) => {
  if (re.test(rules)) pass('split: ' + label);
  else fail('split: ' + label);
});

/* Nothing from the old shared project may reappear. Those rules described a
   site that does not live here, and a copy-paste slip could open write access
   to a collection nobody is maintaining. */
['games', 'news', 'lectures', 'notes', 'leaderboard', 'chatRooms', 'bookmarks',
 'continue_learning', 'activity', 'downloads', 'recently_viewed',
 'competition_participants', 'achievements', 'notifications', 'password_resets',
 'resource_stats', 'competitions', 'feedback', 'contact', 'presence', 'scores'
].forEach((c) => {
  if (new RegExp('match \\/' + c + '\\/').test(rules)) {
    fail('split: no leftover MATHSIMIZED rule for ' + c);
  } else {
    pass('split: no leftover MATHSIMIZED rule for ' + c);
  }
});

/* ---------- every collection the code touches has a rule ---------- */
const source = [];
const files = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (e.name === 'node_modules' || e.name === '.git') return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(js|html)$/.test(e.name)) { source.push(fs.readFileSync(full, 'utf8')); files.push(full); }
  });
})(ROOT);
const code = source.join('\n');
/* The test files name the things they forbid, so any check about the app's own
   files reads this instead of the full corpus. */
const appCode = files.filter((f) => !f.startsWith(path.join(ROOT, 'tests') + path.sep))
  .map((f) => fs.readFileSync(f, 'utf8')).join('\n');

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
/* The service line matches /databases/, which is not a collection. */
ruled.delete('databases');

/* Nothing outside abc_* and usernames belongs to this project. When this file
   still carried the other site's collections they were allow-listed here, so
   re-merging the two projects could not fail a test. That tolerance is the
   bug: a rule for a collection this project does not own can only be dead
   weight, or a copy-paste from a different project. */
const ours = new Set(['usernames']);
const foreign = [...ruled].filter((c) => !ours.has(c) && !c.startsWith('abc_'));
if (foreign.length) {
  fail('split: no rule for a collection this project does not own', foreign.join(', '));
} else {
  pass('split: no rule for a collection this project does not own');
}

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

/* The header is the part a person reads before deciding this file is safe to
   paste into the console, so a stale claim in it is worth a test of its own. */
{
  const header = rules.slice(0, rules.indexOf('service cloud.firestore'));
  if (/DO NOT REMOVE|would REPLACE the rules|shares the .*project/.test(header)) {
    fail('split: the header does not claim to break another site');
  } else {
    pass('split: the header does not claim to break another site');
  }
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
  'get', 'exists', 'request', 'resource',
  /* String and List methods that Firestore provides on rule values. */
  'startsWith', 'endsWith', 'lower', 'upper', 'replace', 'contains',
  'toSet', 'removeAll', 'hasAny', 'isEmpty', 'join'
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
if (STORAGE_GONE) pass('storage.rules is removed, because Cloud Storage needs Blaze');
else fail('storage.rules is removed, because Cloud Storage needs Blaze');

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
  ['abc_round2_submissions: only the student and the organiser', /match \/abc_round2_submissions\/\{uid\} \{\s*allow read: if isSelf\(uid\) \|\| isAdmin\(\);/]
].forEach(([label, re]) => {
  if (re.test(rules)) pass(label);
  else fail(label);
});

/* Judging is done off the platform. Nothing may bring a judge back: no role,
   no collection, no rules, no portal. */
[
  ['no judge role in the config', /ROLE\.JUDGE|['"]judge['"]\s*:\s*/],
  ['no judge collection in the rules', /abc_judges|abc_round2_judgements/],
  ['no isJudge helper in the rules', /function isJudge\(/],
  ['no judge files', /js\/judge\.js|js\/pages\/judge\//],
  ['no judge route', /JUDGE_ROUTES|isJudgeRoute/]
].forEach(([label, re]) => {
  const haystack = [
    rules,
    fs.readFileSync(path.join(ROOT, 'js/firebase-config.js'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'js/session.js'), 'utf8')
  ].join('\n') + appCode;
  if (re.test(haystack)) fail('no judging on the platform: ' + label, 'found: ' + re);
  else pass('no judging on the platform: ' + label);
});

if (fs.existsSync(path.join(ROOT, 'judge')) || fs.existsSync(path.join(ROOT, 'js/pages/judge'))
    || fs.existsSync(path.join(ROOT, 'js/judge.js'))) {
  fail('no judging on the platform: the judge area is deleted');
} else {
  pass('no judging on the platform: the judge area is deleted');
}

/* The organiser must be able to claim admin, or the panel is unreachable. */
[
  ['the organiser email is recognised', /function isOrganiser\(\)/],
  ['the organiser may create an admin record', /isOrganiser\(\)\s*\?\s*request\.resource\.data\.role == 'admin'/],
  ['the organiser may promote their own record', /isOrganiser\(\)\s*&&\s*request\.resource\.data\.role == 'admin'/],
  ['a student still cannot claim admin', /:\s*request\.resource\.data\.role == 'student'/]
].forEach(([label, re]) => {
  if (re.test(rules)) pass('admin bootstrap: ' + label);
  else fail('admin bootstrap: ' + label);
});

/* The organiser was locked out of their own panel because the rules made
   creating an admin record impossible. These assert it cannot recur. */
[
  ['a student can still only create a student record', /allow create: if isSelf\(uid\)[\s\S]{0,200}?request\.resource\.data\.role == 'admin'[\s\S]{0,200}?:\s*request\.resource\.data\.role == 'student'/]
].forEach(([label, re]) => {
  if (re.test(rules)) pass('organiser access: ' + label);
  else fail('organiser access: ' + label);
});

/* Nothing may reintroduce a bucket or the Storage SDK. */
[
  ['storage: no bucket in the Firebase config', /storageBucket/],
  ['storage: no Storage SDK is loaded', /firebase-storage-compat/],
  ['storage: no firebase.storage() call', /firebase\.storage\(/],
  ['storage: no Storage target in firebase.json', /"storage"\s*:/],
  ['storage: no upload through A.storage', /A\.storage\.|ABC\.storage\s*=/]
].forEach(([label, re]) => {
  /* The test suite is excluded, because these patterns have to appear in
     the assertions themselves. */
  const haystack = [
    rules,
    fs.readFileSync(path.join(ROOT, 'js/firebase-config.js'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'js/page.js'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8')
  ].join('\n')
    + source.filter((t) => !/PASS |FAIL /.test(t)).join('\n');
  if (re.test(haystack)) fail(label, 'found: ' + re);
  else pass(label);
});

console.log('\n' + (failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks pass'));
process.exit(failures ? 1 : 0);
