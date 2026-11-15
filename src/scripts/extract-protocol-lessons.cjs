// Offline maintenance: read pinned public data factories; never run the source app.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { parse } = require('@babel/parser');
const root = path.resolve(__dirname, '../..');
const archive = path.resolve(
  process.argv[2] || path.join(root, '../protocol-explorer-public-source/updates/2026-11-15')
);
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const entry = 'index-CNPseYOQ.js';
const language = 'vi-BtObyLa_.js';
const pins = {
  [entry]: '19e285d11f5fa0b1411ec94aaea6cd04531872e8322bb8a46c80e4f92e262834',
  [language]: '2c1292ff0fd48bb0ad7fac121a250e415bcc74c2a6b28a0d884bcf9d5fe4cfb8',
};
for (const [file, digest] of Object.entries(pins)) {
  if (hash(fs.readFileSync(path.join(archive, 'raw/assets', file))) !== digest)
    throw new Error(`Pinned source mismatch: ${file}`);
}
const source = fs.readFileSync(path.join(archive, 'raw/assets', entry), 'utf8');
const ast = parse(source, { sourceType: 'module' });
const declarations = new Map();
for (const statement of ast.program.body) {
  if (statement.type !== 'VariableDeclaration') continue;
  for (const declaration of statement.declarations)
    declarations.set(declaration.id.name, declaration);
}
const start = ast.program.body.find(
  (statement) =>
    statement.type === 'VariableDeclaration' &&
    statement.declarations.some((declaration) => declaration.id.name === 'h')
)?.start;
const end = declarations.get('Ts')?.init.end;
if (start == null || end == null) throw new Error('Pinned catalog boundaries missing');
const dataCode = source.slice(start, end) + ';';
const forbidden = new Set([
  'process',
  'require',
  'globalThis',
  'window',
  'document',
  'fetch',
  'eval',
  'Function',
  'WebAssembly',
  'setTimeout',
  'setInterval',
  'importScripts',
]);
function audit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'Identifier' && forbidden.has(node.name))
    throw new Error(`Unexpected global: ${node.name}`);
  if (
    node.type === 'MemberExpression' &&
    ['constructor', '__proto__', 'prototype'].includes(node.property.name || node.property.value)
  )
    throw new Error('Unexpected prototype access');
  if (['ImportExpression', 'ImportDeclaration'].includes(node.type))
    throw new Error('Unexpected import');
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(audit);
    else if (value && typeof value === 'object') audit(value);
  }
}
audit(parse(dataCode, { sourceType: 'script' }));
const options = { timeout: 5000, contextCodeGeneration: { strings: false, wasm: false } };
// TextEncoder is used by pure wire-data builders, not browser/network code.
const { lessons, menu } = JSON.parse(
  vm.runInNewContext(dataCode + '\nJSON.stringify({lessons:_s,menu:Ts})', { TextEncoder }, options)
);
if (menu.length !== 39 || Object.keys(lessons).length !== menu.length)
  throw new Error('Pinned catalog denominator mismatch');
const scene = {};
for (const [name, key] of [
  ['tw', 'routes'],
  ['$i', 'positions'],
  ['ye', 'labels'],
  ['gh', 'frames'],
]) {
  const init = declarations.get(name)?.init;
  if (init?.type !== 'ObjectExpression') throw new Error(`Missing scene data: ${name}`);
  audit(init);
  scene[key] = vm.runInNewContext(
    `(${source.slice(init.start, init.end)})`,
    Object.create(null),
    options
  );
}
const viSource = fs.readFileSync(path.join(archive, 'raw/assets', language), 'utf8');
const viAst = parse(viSource, { sourceType: 'module' });
const dictionary = Object.fromEntries(
  viAst.program.body
    .flatMap((statement) => statement.declarations || [])
    .filter((declaration) => ['o', 's', 'r'].includes(declaration.id.name))
    .flatMap((declaration) =>
      declaration.init.properties.map((property) => {
        if (property.type !== 'ObjectProperty' || property.value.type !== 'StringLiteral')
          throw new Error('Unexpected translation expression');
        return [property.key.name || property.key.value, property.value.value];
      })
    )
);
const legacy = new Set([
  'http',
  'https',
  'tcp',
  'udp',
  'ip',
  'dns',
  'dhcp',
  'icmp',
  'smtp',
  'pop3',
  'imap',
  'ftp',
  'ssh',
  'tls',
]);
const output = path.join(root, 'src/frontend/src/features/protocols/data/lessons');
fs.mkdirSync(output, { recursive: true });
const files = {};
function write(name, value, metadata) {
  fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
  files[name] = { sha256: hash(JSON.stringify(value)), ...metadata };
}
write('scene.json', scene, { steps: 0, events: 0 });
for (const item of menu) {
  const sourceLesson = lessons[item.id];
  const lesson = { ...sourceLesson };
  if (!legacy.has(item.id)) {
    const events = lesson.steps.flatMap((step) => step.events);
    const labels = [
      ...Object.values(scene.labels),
      ...Object.values(lesson.labels || {}),
      ...events.filter((event) => event.type === 'label').map((event) => event.label),
    ];
    lesson.teaching = {
      steps: lesson.steps.map((step) => {
        if (!dictionary[step.detail])
          throw new Error(`Missing Vietnamese explanation: ${item.id}/${step.title}`);
        return [dictionary[step.title] || step.title, dictionary[step.detail]];
      }),
      notes: Object.fromEntries(
        events
          .filter((event) => event.type === 'note')
          .map((event) => [event.text, dictionary[event.text] || event.text])
      ),
      labels: Object.fromEntries(labels.map(([name]) => [name, dictionary[name] || name])),
    };
  }
  write(`${item.id}.json`, lesson, {
    sourceSha256: hash(JSON.stringify(sourceLesson)),
    steps: lesson.steps.length,
    events: lesson.steps.reduce((n, step) => n + step.events.length, 0),
    playbackEvents: lesson.steps.reduce(
      (n, step) =>
        n +
        step.events.reduce(
          (m, event) => m + (event.type === 'stream' ? event.packets.length : 1),
          0
        ),
      0
    ),
  });
}
const counts = {
  lessons: menu.length,
  steps: Object.values(files).reduce((n, file) => n + file.steps, 0),
  playbackEvents: Object.values(files).reduce((n, file) => n + (file.playbackEvents || 0), 0),
};
fs.writeFileSync(
  path.join(output, 'provenance.json'),
  JSON.stringify(
    {
      source: 'https://protocol-explorer-alpha.vercel.app/',
      author: 'Dilum Sanjaya',
      entryUrl: `https://protocol-explorer-alpha.vercel.app/assets/${entry}`,
      entrySha256: pins[entry],
      languageUrl: `https://protocol-explorer-alpha.vercel.app/assets/${language}`,
      languageSha256: pins[language],
      version: '2026-11-15',
      hashEncoding: 'SHA-256 of UTF-8 JSON.stringify(parsed JSON), preserving key order',
      extraction:
        'Pinned protocol-data factories only; sourceSha256 covers original values. Native additions contain a teaching field extracted from the public Vietnamese dictionary. Source UI/runtime is not shipped.',
      catalog: menu,
      counts,
      files,
    },
    null,
    2
  ) + '\n'
);
console.log(JSON.stringify(counts));
