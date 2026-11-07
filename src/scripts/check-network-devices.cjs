const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const base = path.resolve(__dirname, '../frontend/public/network-devices');
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'provenance.json'), 'utf8'));
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.icons.length, 10);
for (const item of manifest.icons) {
  const bytes = fs.readFileSync(path.join(base, item.path));
  assert.equal(sha256(bytes), item.sha256, item.path);
  const artwork = bytes.toString().match(/<g class="device [\s\S]+<\/g>(?=<\/svg>)/)?.[0];
  assert.equal(sha256(artwork), item.artworkSha256, `Original geometry: ${item.path}`);
  assert.ok(!bytes.includes('/protocol-explorer/'), `Runtime dependency: ${item.path}`);
}
console.log('Shared network artwork: 10 original SVG variants and geometry verified.');
