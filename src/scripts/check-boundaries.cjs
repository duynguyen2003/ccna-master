const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { builtinModules, createRequire } = require('node:module');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '../..');
const nativeModules = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const errors = [];
let checkedFiles = 0;
let checkedImports = 0;

const layer = (filename) => {
  const relative = path.relative(root, filename).split(path.sep).join('/');
  if (relative.startsWith('src/frontend/src/')) return 'frontend';
  if (relative.startsWith('src/backend/src/')) return 'backend';
  if (relative.startsWith('src/agent/contracts/')) return 'agent-contracts';
  if (relative.startsWith('src/agent/browser/')) return 'agent-browser';
  if (relative.startsWith('src/agent/')) return 'agent';
  if (relative.startsWith('src/shared/')) return 'shared';
  return 'tooling';
};

const resolveLocal = (issuer, request) => {
  const candidate = path.resolve(path.dirname(issuer), request);
  for (const suffix of [
    '',
    '.js',
    '.jsx',
    '.mjs',
    '.json',
    '.css',
    '.cjs',
    '/index.js',
    '/index.jsx',
  ]) {
    const target = candidate + suffix;
    if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  }
  throw new Error(`Cannot resolve ${request}`);
};

const checkImport = (filename, request) => {
  checkedImports += 1;
  const issuerLayer = layer(filename);
  try {
    const builtin = request.startsWith('node:') || nativeModules.has(request);
    if (builtin) {
      assert.ok(
        !['frontend', 'shared', 'agent-contracts', 'agent-browser'].includes(issuerLayer),
        `${issuerLayer} must not depend on Node built-ins: ${request}`
      );
      return;
    }
    const target = request.startsWith('.')
      ? resolveLocal(filename, request)
      : createRequire(filename).resolve(request);
    const targetLayer = layer(target);
    if (issuerLayer === 'frontend') {
      assert.ok(
        !['backend', 'agent'].includes(targetLayer),
        'Frontend must not import backend or agent server code'
      );
    }
    if (issuerLayer === 'agent-browser') {
      if (!request.startsWith('.'))
        assert.ok(
          ['react', 'react/jsx-runtime', '@ccna/agent-contracts'].includes(request),
          'Agent browser UI may only use its declared browser dependencies'
        );
      assert.ok(
        !['frontend', 'backend', 'agent'].includes(targetLayer),
        'Agent browser UI must not import application or server implementation'
      );
    }
    if (issuerLayer === 'backend' || issuerLayer === 'agent') {
      assert.ok(targetLayer !== 'frontend', 'Backend must not import frontend code');
    }
    if (issuerLayer === 'shared' || issuerLayer === 'agent-contracts') {
      assert.ok(
        !['frontend', 'backend', 'agent', 'agent-browser'].includes(targetLayer),
        'Shared code and agent contracts must remain browser safe'
      );
    }
    if (targetLayer === 'agent' && issuerLayer === 'backend') {
      assert.ok(request.startsWith('@ccna/agent/'), 'Import agent through @ccna/agent subpaths');
    }
    if (targetLayer === 'shared' && issuerLayer !== 'shared') {
      assert.ok(request.startsWith('@ccna/shared/'), 'Import shared through @ccna/shared subpaths');
    }
  } catch (error) {
    errors.push(`${path.relative(root, filename)}: ${request}: ${error.message}`);
  }
};

const inspectJs = (filename, source) => {
  const ast = parser.parse(source, { sourceType: 'unambiguous', plugins: ['jsx'] });
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)
    ) {
      if (node.source?.type === 'StringLiteral') checkImport(filename, node.source.value);
    }
    if (node.type === 'ImportExpression' && node.source?.type === 'StringLiteral') {
      checkImport(filename, node.source.value);
    }
    if (node.type === 'CallExpression' && node.arguments[0]?.type === 'StringLiteral') {
      const callee = node.callee;
      const requireCall = callee.type === 'Identifier' && callee.name === 'require';
      const importCall = callee.type === 'Import';
      const moduleCall =
        callee.type === 'MemberExpression' &&
        ['require', 'jest'].includes(callee.object?.name) &&
        ['resolve', 'mock', 'doMock', 'unmock', 'requireActual', 'requireMock'].includes(
          callee.property?.name
        );
      if (requireCall || importCall || moduleCall) checkImport(filename, node.arguments[0].value);
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'extra', 'comments', 'tokens'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast);
};

const visitDirectory = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      [
        'node_modules',
        'build',
        'coverage',
        '.git',
        '.venv',
        '__pycache__',
        '.pytest_cache',
        '.ruff_cache',
      ].includes(entry.name)
    )
      continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) visitDirectory(filename);
    else if (/\.(js|jsx|mjs|cjs|css)$/.test(filename)) {
      checkedFiles += 1;
      const source = fs.readFileSync(filename, 'utf8');
      if (/\.(js|jsx|mjs|cjs)$/.test(filename)) inspectJs(filename, source);
      else {
        for (const match of source.matchAll(
          /@import\s+['"]([^'"]+)['"]|url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g
        )) {
          const request = match[1] || match[2];
          if (request.startsWith('.')) checkImport(filename, request);
        }
      }
    }
  }
};

for (const directory of [
  'src/frontend/src',
  'src/backend/src',
  'src/agent',
  'src/shared',
  'src/scripts',
  'src/frontend/scripts',
]) {
  visitDirectory(path.join(root, directory));
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${checkedImports} imports/assets across ${checkedFiles} source files; frontend/backend/agent/shared boundaries are intact.`
  );
}
