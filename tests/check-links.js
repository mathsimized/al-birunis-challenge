/* Verifies that every local link, script and A.rootPath() target exists.
 *   node tests/check-links.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'functions') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

const files = walk(root).filter((f) => !f.startsWith(path.join(root, 'tests')));
const broken = [];
let checked = 0;

for (const file of files) {
  const rel = path.relative(root, file);
  const src = fs.readFileSync(file, 'utf8');
  const patterns = file.endsWith('.html')
    ? [/(?:href|src)\s*=\s*"([^"]+)"/g]
    : [/<script src="([^"]+)"/g, /A\.rootPath\('([^']+)'\)/g];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) {
      let u = m[1].trim();
      if (!u || u.includes("'") || /^(https?:|mailto:|tel:|data:|\/\/|javascript:|#)/.test(u)) continue;
      u = u.split('#')[0].split('?')[0];
      if (!u) continue;
      checked += 1;
      if (u.startsWith('/')) continue; /* absolute site path, not a file */
      const target = re.source.includes('rootPath') ? path.join(root, u) : path.resolve(path.dirname(file), u);
      if (!fs.existsSync(target)) broken.push(`${rel} -> ${u}`);
    }
  }
}

console.log(`checked ${checked} references across ${files.length} files`);
if (broken.length) {
  broken.forEach((b) => console.log('  BROKEN', b));
  process.exit(1);
}
console.log('all references resolve');
