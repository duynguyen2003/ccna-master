const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '../..');
const frontendRequire = createRequire(path.join(root, 'src/frontend/package.json'));
const React = frontendRequire('react');
const { renderToStaticMarkup } = frontendRequire('react-dom/server');
const publicIcons = frontendRequire('lucide-react');
const facadePath = path.join(root, 'src/frontend/src/utils/icons.js');
const facade = fs.readFileSync(facadePath, 'utf8');
const exportsByName = new Map(
  [...facade.matchAll(/export \{ default as (\w+) \} from '(lucide-react\/[^']+)';/g)].map(
    ([, name, request]) => [name, request]
  )
);
assert.ok(exportsByName.size > 0, 'The browser icon facade must export individual icons');

// Compare with the public package, including aliases such as ImageIcon and Code2.
for (const [name, request] of exportsByName) {
  const directIcon = frontendRequire(request).default;
  assert.ok(publicIcons[name], `Unknown Lucide export: ${name}`);
  for (const props of [
    {},
    { size: 19, strokeWidth: 1.5, className: 'custom-icon', 'aria-label': name },
  ]) {
    assert.equal(
      renderToStaticMarkup(React.createElement(directIcon, props)),
      renderToStaticMarkup(React.createElement(publicIcons[name], props)),
      `Browser icon ${name} must match the public component`
    );
  }
}

let consumers = 0;
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(filename);
    else if (/\.(js|jsx)$/.test(entry.name)) {
      const source = fs.readFileSync(filename, 'utf8');
      for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g)) {
        consumers++;
        for (const specifier of match[1]
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)) {
          const name = specifier.split(/\s+as\s+/)[0];
          assert.ok(
            exportsByName.has(name),
            `${path.relative(root, filename)}: add ${name} to src/frontend/src/utils/icons.js`
          );
        }
      }
    }
  }
};
visit(path.join(root, 'src/frontend/src'));

// Use Webpack's resolver to check browser mapping without running a full build.
const reactScriptsDirectory = path.dirname(frontendRequire.resolve('react-scripts/package.json'));
const webpackDirectory = path.dirname(
  require.resolve('webpack', { paths: [reactScriptsDirectory] })
);
const resolverPath = require.resolve('enhanced-resolve', { paths: [webpackDirectory] });
const resolveBrowser = require(resolverPath).create.sync({
  extensions: ['.js', '.json'],
  mainFields: ['browser', 'module', 'main'],
  aliasFields: ['browser'],
});
assert.equal(
  resolveBrowser({}, path.join(root, 'src/frontend/src/features/home/pages'), 'lucide-react'),
  facadePath
);
console.log(
  `Verified ${exportsByName.size} icon exports, matching SVG output, ${consumers} imports and browser resolution.`
);
