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
  ['the old BA self-service apply', /\.applyBA\(|applyBA\s*\(/],
  /* Cloud Storage for Firebase has required the Blaze plan since
     3 February 2026, so nothing here may depend on a bucket again. */
  ['the Storage SDK', /firebase-storage-compat/],
  ['a storage bucket', /storageBucket|firebasestorage\.app/],
  ['firebase.storage()', /firebase\.storage\(/],
  ['upload via a bucket', /A\.storage\.|ABC\.storage\s*=|\.ref\(['"]certificates/]
];

BANNED.forEach(([label, re]) => {
  // tests/ may mention the banned names in order to assert their absence
  const hits = source.filter((s) => re.test(s.text)
    && !s.file.startsWith('tests' + path.sep)
    && /\.(js|html|json)$/.test(s.file));
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

/* ---------------- 3. certificates stay inside the free plan ----------------
   The file now lives in Firestore or behind a link the organiser supplies, so
   nothing is uploaded to a bucket, and a student still only ever sees their
   own certificate. */
[
  ['certificates: a student reads only their own document', /match \/abc_certificates\/\{certificateId\} \{\s*allow read: if isSelf\(resource\.data\.uid\) \|\| isAdmin\(\);/],
  ['certificates: only an admin writes', /match \/abc_certificates\/\{certificateId\} \{[\s\S]{0,160}?allow write: if isAdmin\(\);/]
].forEach(([label, re]) => {
  const rules = read('firestore.rules');
  if (re.test(rules)) pass('rules: ' + label);
  else fail('rules: ' + label);
});

/* This one is the other way round: a bucket path must not appear. */
if (!/storage/i.test(read('firestore.rules'))) {
  pass('rules: certificates: no bucket path in the rules');
} else {
  fail('rules: certificates: no bucket path in the rules');
}

/* The inline file is size-capped, because a Firestore document is 1 MiB. */
[
  ['certificates: the inline upload is capped below 1 MiB', /MAX_CERTIFICATE_BYTES = 700 \* 1024/],
  ['certificates: the cap is explained to the organiser', /700 KB/]
].forEach(([label, re]) => {
  const code = read('js/repo.js') + read('js/pages/admin/certificates.js');
  if (re.test(code)) pass(label);
  else fail(label);
});

/* Releasing must never imply an email, and the portal must offer the asset. */
[
  ['certificates: no email is sent on release', /certificate_email|sendCertificateEmail/]
].forEach(([label, re]) => {
  const hits = source.filter((s) => re.test(s.text)
    && !s.file.startsWith('tests' + path.sep)
    && /\.(js|html|json)$/.test(s.file));
  if (hits.length) fail(label, hits.map((h) => h.file).join(', '));
  else pass(label);
});

/* The public Brand Ambassador snapshot is a Firestore document anyone can
   read, so anything written into it is public whether or not a page renders
   it. It may carry a rank; it may not carry a count. */
[
  ['no totalApproved', /totalApproved/],
  ['no attributedCount', /attributedCount/],
  ['no per-row counts', /count:/],
  ['no approved total', /approved[A-Za-z]*Count/]
].forEach(([label, re]) => {
  const fn = read('js/repo.js');
  const start = fn.indexOf("C.publicBa).doc('topFive').set(");
  /* Comments are stripped: naming the forbidden field in a comment that
     says it is absent is exactly what should be allowed. */
  const payload = fn.slice(start, fn.indexOf('});', start)).replace(/\/\*[\s\S]*?\*\//g, '');
  if (re.test(payload)) fail('public BA snapshot: ' + label, payload);
  else pass('public BA snapshot: ' + label);
});

/* The best-ambassador copy may state a count, because it is spoken at the
   ceremony and lives only in the admin panel. */
if (/bestCopy/.test(read('js/pages/admin/announcements.js'))) {
  pass('announcements: the ceremony copy for Best Brand Ambassador exists');
} else {
  fail('announcements: the ceremony copy for Best Brand Ambassador exists');
}

/* The panel used to tell the organiser to "use Paste from sheet" without
   offering it. Assert the button and the parser exist together. */
[
  ['the paste button exists', /id="importBtn"/],
  ['it opens a dialog', /function importDialog/],
  ['it parses before it writes', /function parseImportedRows/],
  ['nothing is written without confirmation', /confirmModal/],
  ['it goes through createBA, so codes are issued the same way', /A\.repo\.createBA\(r\)/]
].forEach(([label, re]) => {
  const page = read('js/pages/admin/brand-ambassadors.js');
  if (re.test(page)) pass('BA import: ' + label);
  else fail('BA import: ' + label);
});

if (/bestBtn/.test(read('js/pages/admin/announcements.js'))) {
  pass('announcements: the ceremony copy is one click away in the admin panel');
} else {
  fail('announcements: the ceremony copy is one click away in the admin panel');
}

/* Signing up and registering are two separate steps. The signup form creates
   the login and nothing else; the portal form collects what the organiser
   needs. Conflating them was the original bug: full name on the signup page,
   and a "Continue" button that led to a second page of fields. */
[
  ['the signup form asks for a username, not a full name', /id="username"/],
  ['it does not ask for a full name', /id="name"[^>]*required|for="name"/],
  ['it has no "Continue" step', /id="nextBtn"/],
  ['it has no competition-details tab', /Competition details/],
  ['it creates the account and hands over to the portal', /student\/registration\.html\?required=1&welcome=1/],
  ['the portal form is where the full name is collected', /Full name/]
].forEach(([label, re]) => {
  const page = read('register.html') + read('js/pages/student/registration.js');
  const banned = /id="nextBtn"|Competition details/.test(re.source) || /id="name"[^>]*required|for="name"/.test(re.source);
  const found = re.test(page);
  if (banned ? found : !found) fail('signup flow: ' + label);
  else pass('signup flow: ' + label);
});

/* The shared MATHSIMIZED login is the only login. Nothing here may ask for a
   separate competition account. */
[
  ['the login page has no competition details panel', /class="steps"/]
].forEach(([label, re]) => {
  if (re.test(read('login.html'))) fail('login page: ' + label);
  else pass('login page: ' + label);
});

/* Usernames are checked against the shared collection, so they cannot collide
   with an account created on the main site. */
[
  ['the availability check queries the shared users collection', /C\.profileLookup\)\s*\.where\('username'/],
  ['a failed check never reports the name as free', /catch \(e\) \{\s*return \{ available: false/]
].forEach(([label, re]) => {
  if (re.test(read('js/repo.js'))) pass('username check: ' + label);
  else fail('username check: ' + label);
});

if (/certificateAsset/.test(read('js/pages/student/certificates.js'))) {
  pass('certificates: the student portal opens whatever asset was attached');
} else {
  fail('certificates: the student portal opens whatever asset was attached');
}

if (/instagram\.com\/al_birunis_challenge/.test(read('js/ui.js'))) {
  pass('footer: links to the official Instagram account');
} else {
  fail('footer: links to the official Instagram account');
}

console.log('\n' + (failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks pass'));
process.exit(failures ? 1 : 0);
