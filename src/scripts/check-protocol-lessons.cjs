const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const base = path.join(root, 'src/frontend/src/features/protocols/data/lessons');
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'provenance.json'), 'utf8'));
let steps = 0;
let playbackEvents = 0;
const ids = new Set(manifest.catalog.map((item) => item.id));
for (const [name, entry] of Object.entries(manifest.files)) {
  const data = JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
  assert.equal(
    crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    entry.sha256,
    name
  );
  if (name === 'scene.json') continue;
  assert.equal(data.id + '.json', name);
  assert.equal(data.steps.length, entry.steps);
  assert.ok(ids.has(data.id), `Unlisted scenario: ${data.id}`);
  const raw = { ...data };
  delete raw.teaching;
  assert.equal(
    crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex'),
    entry.sourceSha256,
    `Source data: ${name}`
  );
  const count = data.steps.reduce(
    (n, step) =>
      n +
      step.events.reduce((m, event) => m + (event.type === 'stream' ? event.packets.length : 1), 0),
    0
  );
  assert.equal(count, entry.playbackEvents, `Playback events: ${name}`);
  playbackEvents += count;
  if (data.teaching) assert.equal(data.teaching.steps.length, data.steps.length);
  steps += data.steps.length;
}
assert.equal(ids.size, 39, 'Pinned source catalog');
assert.equal(Object.keys(manifest.files).length, ids.size + 1);
assert.equal(manifest.counts.lessons, ids.size);
assert.equal(steps, manifest.counts.steps);
assert.equal(playbackEvents, manifest.counts.playbackEvents);
const onDisk = fs
  .readdirSync(base)
  .filter((name) => !['scene.json', 'provenance.json'].includes(name));
assert.deepEqual(
  onDisk.sort(),
  [...ids].map((id) => `${id}.json`).sort(),
  'Missing or stale scenario JSON'
);
assert.ok(
  !fs.existsSync(path.join(root, 'src/frontend/public/protocol-explorer')),
  'Temporary runtime must not ship'
);
if (process.argv.includes('--build')) {
  const build = path.join(root, 'src/frontend/build');
  assert.ok(fs.existsSync(path.join(build, 'asset-manifest.json')), 'Production build required');
  assert.ok(
    !fs.existsSync(path.join(build, 'protocol-explorer')),
    'Stale temporary runtime in build'
  );
  const assets = JSON.parse(fs.readFileSync(path.join(build, 'asset-manifest.json'), 'utf8'));
  assert.ok(
    !Object.keys(assets.files).some((name) =>
      /protocol-explorer|protocol-lesson-provenance/.test(name)
    ),
    'Unexpected runtime or provenance chunk'
  );
}
console.log(
  `Native protocol catalog: ${ids.size} lessons / ${steps} steps / ${playbackEvents} events and scene provenance verified; temporary runtime absent.`
);
