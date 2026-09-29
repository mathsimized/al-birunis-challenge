/* Exercises the route guards in js/session.js without a browser.
 *   node tests/route-guards.js
 */
/* eslint-disable no-eval */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/session.js', 'utf8');

// pull the constants and the three route helpers out of the module
const grab = (name) => {
  const m = src.match(new RegExp('const ' + name + ' = (\\[[\\s\\S]*?\\]);'));
  return eval(m[1]);
};
const grabFn = (sig) => {
  const i = src.indexOf(sig);
  const head = src.slice(i, src.indexOf('{', i));
  const start = src.indexOf('{', i);
  let depth = 0;
  for (let i2 = start; i2 < src.length; i2++) {
    if (src[i2] === '{') depth++;
    else if (src[i2] === '}') { depth--; if (!depth) return head + src.slice(start, i2 + 1); }
  }
};
const isPortalRoute = eval('(' + grabFn('function isPortalRoute(') + ')');
const isAdminRoute = eval('(' + grabFn('function isAdminRoute(') + ')');
const currentRoute = eval('(' + grabFn('function currentRoute(') + ')');
const ADMIN_ROUTES = grab('ADMIN_ROUTES');
const PORTAL_ROUTES = grab('PORTAL_ROUTES');

const ROOT = 'https://mathsimized.com/';
global.window = global;
global.location = { pathname: '/' };
var A = { rootPath: () => ROOT };
global.ABC = A;

const cases = [
  ['/student/round1.html', true, false],
  ['/student/dashboard.html', true, false],
  ['/student/registration.html', true, false],
  ['/admin/index.html', false, true],
  ['/admin/round2.html', false, true],
  ['/index.html', false, false],
  ['/rounds.html', false, false]
];
let fail = 0;
for (const [p, wantPortal, wantAdmin] of cases) {
  global.location.pathname = p;
  const rel = currentRoute();
  const gotPortal = isPortalRoute(rel);
  const gotAdmin = isAdminRoute(rel);
  const ok = gotPortal === wantPortal && gotAdmin === wantAdmin;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${p.padEnd(28)} rel=${rel.padEnd(26)} portal=${gotPortal} admin=${gotAdmin}`);
}

// a portal page that identifies itself by bare file name
console.log('bare-name route refused ->', !isPortalRoute('round2.html') && !isAdminRoute('round2.html') ? 'PASS' : (fail++, 'FAIL'));
console.log('ambiguous index.html    ->', isAdminRoute('index.html') === false ? 'PASS' : (fail++, 'FAIL'));

// served from a subdirectory
A.rootPath = () => 'https://host/al-biruni/';
global.location.pathname = '/al-biruni/student/round1.html';
const sub2 = currentRoute();
console.log(`subdirectory portal      -> ${sub2 === 'student/round1.html' && isPortalRoute(sub2) ? 'PASS' : (fail++, 'FAIL')}`);
global.location.pathname = '/al-biruni/admin/users.html';
const sub = currentRoute();
console.log(`subdirectory            -> ${sub === 'admin/users.html' && isAdminRoute(sub) ? 'PASS' : (fail++, 'FAIL')}`);

console.log(fail ? `\n${fail} FAILURES` : '\nall route guards behave');
process.exit(fail ? 1 : 0);
