/* Guards the two decisions that are easy to undo by accident:
 *
 *   1. No backend. Nothing may reference Cloud Functions, the callable SDK or
 *      the Resend email path again.
 *   2. Brand Ambassador counts stay private. The public page and every
 *      student-facing page must be incapable of rendering a count, and the
 *      rules must keep the whole collection away from students.
 *
 * Run: node tests/privacy-and-no-backend.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;
let checks = 0;

function pass(label) { checks += 1; console.log('PASS  ' + label); }
function fail(label, detail) {
  checks += 1; failures += 1;
  console.log('FAIL  ' + label + (detail ? '\n        ' + detail : ''));
}

function walk(dir, out) {
  const acc = out || [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.git') return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  });
  return acc;
}

const files = walk(ROOT);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const source = files
  .filter((f) => /\.(js|html|json|md)$/.test(f))
  .map((f) => ({ file: path.relative(ROOT, f), text: fs.readFileSync(f, 'utf8') }));

/* ---------------- 1. no backend ---------------- */
const BANNED = [
  ['callFn', /callFn\s*\(/],
  ['the callable SDK', /firebase-functions-compat/],
  ['startRound1Attempt', /startRound1Attempt/],
  ['submitRound1Attempt', /submitRound1Attempt/],
  ['scoreRound1Attempt', /scoreRound1Attempt/],
  ['scoreAllPendingRound1', /scoreAllPendingRound1/],
  ['releaseCertificate (callable)', /callFn\(['"]releaseCertificate/],
  ['resendCertificateEmail', /resendCertificateEmail/],
  ['Resend', /\bResend\b/],
  ['api.resend.com', /api\.resend\.com/],
  ['the old BA self-service apply', /\.applyBA\(|applyBA\s*\(/]
];

BANNED.forEach(([label, re]) => {
  // tests/ may mention the banned names in order to assert their absence
  const hits = source.filter((s) => re.test(s.text) && !s.file.startsWith('tests' + path.sep));
  if (hits.length) {
    fail('no backend: ' + label, hits.map((h) => h.file).join(', '));
  } else {
    pass('no backend: ' + label);
  }
});

if (fs.existsSync(path.join(ROOT, 'functions'))) {
  fail('no backend: functions/ directory removed');
} else {
  pass('no backend: functions/ directory removed');
}

const firebaseJson = JSON.parse(read('firebase.json'));
if (firebaseJson.functions) {
  fail('no backend: firebase.json has no functions target');
} else {
  pass('no backend: firebase.json has no functions target');
}
if (firebaseJson.rewrites) {
  const asText = JSON.stringify(firebaseJson.rewrites);
  if (/function/i.test(asText)) {
    fail('no backend: firebase.json rewrites target no functions');
  } else {
    pass('no backend: firebase.json rewrites target no functions');
  }
} else {
  pass('no backend: firebase.json rewrites target no functions');
}

/* ---------------- 2. Brand Ambassador counts are private ---------------- */
const rules = read('firestore.rules');

function ruleBlock(name) {
  const i = rules.indexOf('match /' + name + '/');
  if (i === -1) return null;
  const end = rules.indexOf('\n    }', i);
  return rules.slice(i, end);
}

const baRule = ruleBlock('abc_ba');
if (!baRule) {
  fail('rules: abc_ba is declared');
} else if (/allow read, write: if isAdmin\(\);/.test(baRule)) {
  pass('rules: abc_ba is administrator-only');
} else {
  fail('rules: abc_ba is administrator-only', baRule.replace(/\s+/g, ' ').trim());
}

const keyRule = ruleBlock('abc_answer_keys');
if (keyRule && /allow read, write: if isAdmin\(\);/.test(keyRule)) {
  pass('rules: abc_answer_keys is administrator-only');
} else {
  fail('rules: abc_answer_keys is administrator-only');
}

const publicBaRule = ruleBlock('abc_public_ba');
if (publicBaRule && /resource\.data\.published == true/.test(publicBaRule)) {
  pass('rules: abc_public_ba is public only once published');
} else {
  fail('rules: abc_public_ba is public only once published');
}

// The published snapshot must not be able to carry a count.
const publishBlock = read('js/repo.js').slice(
  read('js/repo.js').indexOf('async function publishPublicBATopFive'),
  read('js/repo.js').indexOf('async function unpublishPublicBATopFive')
);
if (publishBlock && !/attributedCount/.test(publishBlock.replace(/\/\*[\s\S]*?\*\//g, ''))) {
  pass('repo: publishPublicBATopFive writes no count');
} else {
  fail('repo: publishPublicBATopFive writes no count');
}

/* No file that renders for a student may mention the count field.
 *
 * js/repo.js is deliberately excluded: it is the shared data layer, and the
 * admin functions that read and raise counts have to live somewhere. What
 * stops those from being called by a student is not this file's contents but
 * the Firestore rules above — abc_ba refuses every read and write that is not
 * an administrator's. */
const STUDENT_REACHABLE = [
  'brand-ambassadors.html',
  'js/page.js',
  'js/session.js',
  'js/portal.js',
  'js/ui.js'
];

(function studentReachableLeaks() {
  const portalPages = files
    .filter((f) => /student[\/\\].*\.html$/.test(f))
    .map((f) => path.relative(ROOT, f));
  const brandAmbassadorPublic = files
    .filter((f) => /(^|[\\\/])brand-ambassadors\.html$/.test(f))
    .map((f) => path.relative(ROOT, f));

  let leaked = [];
  STUDENT_REACHABLE.concat(portalPages, brandAmbassadorPublic).forEach((rel) => {
    let text;
    try { text = read(rel); } catch (e) { return; }
    if (/attributedCount/.test(text)) leaked.push(rel);
  });
  if (leaked.length) {
    fail('privacy: no student-facing file renders attributedCount', leaked.join(', '));
  } else {
    pass('privacy: no student-facing file renders attributedCount');
  }
})();

/* A student must not be able to write a count either. */
if (!/match \/abc_ba\/\{code\} \{\s*allow read, write: if isAdmin\(\);/.test(rules)) {
  fail('privacy: a student cannot write a Brand Ambassador record');
} else {
  pass('privacy: a student cannot write a Brand Ambassador record');
}

/* The registration form stores the code as text; it cannot look one up. */
const register = read('js/repo.js');
const attribution = register.slice(register.indexOf('async function registerStudent'));
if (attribution && !/collection\(C\.ba\)/.test(attribution)) {
  pass('privacy: registration does not read the Brand Ambassador collection');
} else {
  fail('privacy: registration does not read the Brand Ambassador collection');
}

/* ---------------- 3. the confirmed Brand Ambassador window ---------------- */
const config = read('js/repo.js');
if (/baApplicationsOpenAt: '2026-09-20'/.test(config)) {
  pass('config: applications open 20 September 2026');
} else {
  fail('config: applications open 20 September 2026');
}
if (/baApplicationsCloseAt: '2026-10-05'/.test(config)) {
  pass('config: applications close 5 October 2026');
} else {
  fail('config: applications close 5 October 2026');
}

if (/QvNTaC4cwCdNzzzR7/.test(read('brand-ambassadors.html'))) {
  pass('public page: links to the Brand Ambassador Google Form');
} else {
  fail('public page: links to the Brand Ambassador Google Form');
}

if (/instagram\.com\/al_birunis_challenge/.test(read('js/ui.js'))) {
  pass('footer: links to the official Instagram account');
} else {
  fail('footer: links to the official Instagram account');
}

console.log('\n' + (failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks pass'));
process.exit(failures ? 1 : 0);
