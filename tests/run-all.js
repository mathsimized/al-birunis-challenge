/* Runs every check. Exit code 1 if any of them fails.
 *
 *   node tests/run-all.js
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SUITE = [
  ['syntax', null],
  ['route-guards', 'tests/route-guards.js'],
  ['check-links', 'tests/check-links.js'],
  ['rules-lint', 'tests/rules-lint.js'],
  ['export-surface', 'tests/export-surface.js'],
  ['privacy-and-no-backend', 'tests/privacy-and-no-backend.js']
];

let failed = 0;

SUITE.forEach(([name, file]) => {
  process.stdout.write('\n=== ' + name + ' ===\n');
  try {
    if (!file) {
      const files = [];
      (function walk(dir) {
        fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
          if (['node_modules', '.git'].includes(e.name)) return;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else if (e.name.endsWith('.js')) files.push(full);
        });
      })(path.join(__dirname, '..'));
      files.forEach((f) => execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }));
      console.log('PASS  ' + files.length + ' JavaScript files parse');
    } else {
      process.stdout.write(execFileSync(process.execPath, [path.resolve(__dirname, '..', file)], { encoding: 'utf8' }));
    }
  } catch (err) {
    failed += 1;
    process.stdout.write((err.stdout || '') + (err.stderr || '') + '\n');
  }
});

console.log('\n' + '='.repeat(60));
if (failed) {
  console.log(failed + ' of ' + SUITE.length + ' checks FAILED');
  process.exit(1);
}
console.log('all ' + SUITE.length + ' checks pass');
