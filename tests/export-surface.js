/* Catches the bug where a module advertises a function in its public surface
 * that it never actually defines. `A.repo.listJudges()` on the Users & Access
 * page was exported and missing, which would have thrown at runtime on a page
 * nobody had opened yet.
 *
 * It reads each module's final export block and compares it against the
 * functions that module defines, then checks that every A.<module>.<fn> call
 * anywhere in the site resolves.
 *
 * Run: node tests/export-surface.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;
let checks = 0;

function pass(l) { checks += 1; console.log('PASS  ' + l); }
function fail(l, d) { checks += 1; failures += 1; console.log('FAIL  ' + l + (d ? '\n        ' + d : '')); }

/* The export block of a module is the last `return {` before its closing
   `})(window);`, so a small object literal returned from some helper deeper in
   the file cannot be mistaken for it. */
function finalReturnSurface(text) {
  const end = text.lastIndexOf('})(window)');
  if (end === -1) return null;
  const head = text.slice(0, end);
  const start = head.lastIndexOf('return {');
  if (start === -1) return null;
  return readLiteral(text, start);
}

/* A.ui = { ... } */
function assignedSurface(text, marker) {
  const i = text.lastIndexOf(marker);
  if (i === -1) return null;
  return readLiteral(text, i);
}

function readLiteral(text, from) {
  const open = text.indexOf('{', from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        const body = text.slice(open + 1, i);
        const names = new Set();
        for (const m of body.matchAll(/(?:^|[{,;])\s*([a-zA-Z_$][\w$]*)\s*(?=[,;:}]|$)/g)) {
          names.add(m[1]);
        }
        return names;
      }
    }
  }
  return null;
}

function definedNames(text) {
  const names = new Set();
  for (const m of text.matchAll(/(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/g)) names.add(m[1]);
  for (const m of text.matchAll(/\b(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=/g)) names.add(m[1]);
  return names;
}

/* ---------- sub-object namespaces ---------- */
const MODULES = {
  'A.repo': ['js/repo.js', (t) => assignedSurface(t, 'A.repo = {')],
  'A.round1': ['js/round1.js', (t) => assignedSurface(t, 'A.round1 = {')],
  'A.round2': ['js/round2.js', (t) => assignedSurface(t, 'A.round2 = {')],
  'A.ui': ['js/ui.js', (t) => assignedSurface(t, 'A.ui = {')]
};

const surfaces = {};
Object.entries(MODULES).forEach(([ns, [rel, extract]]) => {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const exported = extract(text);
  if (!exported || !exported.size) {
    fail(ns + ': has a block listing its public surface');
    return;
  }
  const defined = definedNames(text);
  const missing = [...exported].filter((n) => !defined.has(n));
  if (missing.length) {
    fail(ns + ': every exported name is defined in ' + rel, missing.join(', '));
  } else {
    pass(ns + ': all ' + exported.size + ' exported names are defined');
  }
  surfaces[ns] = exported;
});

/* ---------- helpers attached straight onto ABC ----------
 * core.js publishes through Object.assign(global.ABC, {...}), and admin.js,
 * judge.js, session.js and portal.js attach further helpers with A.x = ... */
const GLOBAL_FILES = ['js/core.js', 'js/admin.js', 'js/session.js', 'js/portal.js', 'js/page.js', 'js/firebase-config.js'];
const globalSurface = new Set();
GLOBAL_FILES.forEach((rel) => {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const assign = text.lastIndexOf('Object.assign(global.ABC, {');
  if (assign !== -1) readLiteral(text, assign).forEach((n) => globalSurface.add(n));
  for (const m of text.matchAll(/\bA\.([a-zA-Z_$][\w$]*)\s*=\s*(?:function\b|\()/g)) globalSurface.add(m[1]);
  for (const m of text.matchAll(/\bA\.([a-zA-Z_$][\w$]*)\s*=\s*[a-zA-Z_$][\w$]*;/g)) globalSurface.add(m[1]);
  /* firebase-config.js publishes through the ABC alias rather than A. */
  for (const m of text.matchAll(/\bABC\.([a-zA-Z_$][\w$]*)\s*=/g)) globalSurface.add(m[1]);
});
if (globalSurface.size) pass('ABC: ' + globalSurface.size + ' global helpers are published');
else fail('ABC: global helpers are published');

/* ---------- every call resolves ---------- */
const files = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (e.name === 'node_modules' || e.name === '.git') return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(js|html)$/.test(e.name)) files.push(full);
  });
})(ROOT);

const broken = new Set();
let calls = 0;
files.forEach((f) => {
  const rel = path.relative(ROOT, f);
  if (rel.startsWith('tests' + path.sep)) return;
  const text = fs.readFileSync(f, 'utf8');

  for (const m of text.matchAll(/\bA\.(repo|round1|round2|ui)\.([a-zA-Z_$][\w$]*)/g)) {
    calls += 1;
    const ns = 'A.' + m[1];
    if (surfaces[ns] && !surfaces[ns].has(m[2])) {
      broken.add('A.' + m[1] + '.' + m[2] + '  used in ' + rel);
    }
  }
  for (const m of text.matchAll(/\bA\.([a-zA-Z_$][\w$]*)\b(?!\s*[.=(])/g)) {
    calls += 1;
    const name = m[1];
    const reserved = ['ui', 'repo', 'round1', 'round2', 'admin', 'judge', 'db', 'fb',
      'auth', 'storage', 'server', 'READY', 'page', 'ROLE', 'CATEGORIES', 'session', 'root'];
    /* A property a module both sets and reads is a module-local cache, not a
       missing helper. */
    const fileText = fs.readFileSync(f, 'utf8');
    if (new RegExp('\\bA\\.' + name + '\\s*=').test(fileText)) continue;
    if (reserved.includes(name) || surfaces['A.' + name]) continue;
    if (!globalSurface.has(name)) broken.add('A.' + name + '  used in ' + rel);
  }
});

if (broken.size) {
  fail('every A.<fn> call resolves to something that is published (' + calls + ' calls checked)',
    [...broken].join('\n        '));
} else {
  pass('every A.<fn> call resolves (' + calls + ' calls checked)');
}

console.log('\n' + (failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks pass'));
process.exit(failures ? 1 : 0);
