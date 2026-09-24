import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/render.mjs';

/** Assert that each needle appears, in the given order, within haystack. */
function assertOrder(haystack, needles) {
  let cursor = -1;
  for (const needle of needles) {
    const idx = haystack.indexOf(needle, cursor + 1);
    assert.ok(idx > cursor, `expected "${needle}" to appear after the previous section`);
    cursor = idx;
  }
}

const CLI_ANSWERS = {
  name: 'portkill',
  tagline: "Kill whatever's hogging a port",
  description: 'Find and kill the process holding a TCP port, on any OS.',
  template: 'cli',
  license: 'MIT',
  packageManager: 'npm',
  binName: 'portkill',
  scripts: { test: 'node --test', start: 'node bin/portkill.mjs' },
  repo: { host: 'github.com', owner: 'octocat', repo: 'portkill' },
  node: '>=18',
  badges: true,
  contributing: true,
};

test('render: is pure/deterministic for the same input', () => {
  assert.equal(render(CLI_ANSWERS), render(CLI_ANSWERS));
});

test('render: ends with exactly one trailing newline', () => {
  const out = render(CLI_ANSWERS);
  assert.ok(out.endsWith('\n'));
  assert.ok(!out.endsWith('\n\n'));
});

test('render (cli): sections and badges appear in the expected order', () => {
  const out = render(CLI_ANSWERS);
  assertOrder(out, [
    '# portkill',
    '[![CI](https://github.com/octocat/portkill/actions/workflows/ci.yml/badge.svg)]',
    '[![npm](https://img.shields.io/npm/v/portkill.svg)]',
    '[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)',
    '[![node](https://img.shields.io/badge/node-',
    "**Kill whatever's hogging a port**",
    'Find and kill the process holding a TCP port, on any OS.',
    '## Install',
    'npx portkill',
    'npm install -g portkill',
    '## Usage',
    '## Scripts',
    '`npm run test`',
    '## Contributing',
    '## License',
    'MIT. See [LICENSE](LICENSE).',
  ]);
});

test('render (cli): title is the first line', () => {
  assert.ok(render(CLI_ANSWERS).startsWith('# portkill\n'));
});

test('render (lib): shows an import example, install as a dependency, and an API section', () => {
  const out = render({ ...CLI_ANSWERS, template: 'lib' });
  assert.match(out, /npm install portkill/);
  assert.match(out, /import portkill from 'portkill';/);
  assert.match(out, /## API/);
  assert.match(out, /## Development/); // scripts heading is "Development" for libs
  assert.doesNotMatch(out, /npm install -g/);
});

test('render (app): getting started clones the repo and installs', () => {
  const out = render({ ...CLI_ANSWERS, template: 'app', scripts: { dev: 'vite' } });
  assert.match(out, /## Getting started/);
  assert.match(out, /git clone https:\/\/github\.com\/octocat\/portkill\.git/);
  assert.match(out, /npm install/);
  assert.match(out, /npm run dev/);
});

test('render (minimal): only the essentials, no Usage/Contributing', () => {
  const out = render({ ...CLI_ANSWERS, template: 'minimal' });
  assert.match(out, /# portkill/);
  assert.match(out, /## Install/);
  assert.match(out, /## License/);
  assert.doesNotMatch(out, /## Usage/);
  assert.doesNotMatch(out, /## Contributing/);
  assert.doesNotMatch(out, /## Scripts/);
});

test('render: package manager flavors the commands (pnpm)', () => {
  const out = render({ ...CLI_ANSWERS, packageManager: 'pnpm' });
  assert.match(out, /pnpm dlx portkill/);
  assert.match(out, /pnpm add -g portkill/);
  assert.match(out, /`pnpm test`/);
});

test('render: package manager flavors the commands (yarn + bun)', () => {
  assert.match(render({ ...CLI_ANSWERS, packageManager: 'yarn' }), /yarn dlx portkill/);
  assert.match(render({ ...CLI_ANSWERS, packageManager: 'bun' }), /bunx portkill/);
});

test('render: badges can be turned off', () => {
  const out = render({ ...CLI_ANSWERS, badges: false });
  assert.doesNotMatch(out, /img\.shields\.io/);
  assert.doesNotMatch(out, /badge\.svg/);
});

test('render: no CI badge when there is no github repo', () => {
  const out = render({ ...CLI_ANSWERS, repo: null });
  assert.doesNotMatch(out, /actions\/workflows\/ci\.yml\/badge\.svg/);
  // npm + license badges still render
  assert.match(out, /img\.shields\.io\/npm\/v\/portkill/);
});

test('render: scoped npm name keeps the scope in the badge and install', () => {
  const out = render({ ...CLI_ANSWERS, name: '@acme/portkill', binName: 'portkill' });
  assert.match(out, /img\.shields\.io\/npm\/v\/@acme\/portkill\.svg/);
  assert.match(out, /npx @acme\/portkill/);
});

test('render: table of contents (stretch) links each heading', () => {
  const out = render({ ...CLI_ANSWERS, toc: true });
  assert.match(out, /## Contents/);
  assert.match(out, /- \[Install\]\(#install\)/);
  assert.match(out, /- \[License\]\(#license\)/);
});

// --- sanitization ---------------------------------------------------------

test('render: a description with a code fence cannot break the markdown', () => {
  const nasty = 'This has ```js\nrogue()\n``` fences inside.';
  const out = render({ ...CLI_ANSWERS, description: nasty });
  // Every remaining ``` must be part of a balanced pair (our own code blocks).
  const fences = (out.match(/```/g) || []).length;
  assert.equal(fences % 2, 0, 'code fences should stay balanced');
  assert.doesNotMatch(out, /```js\s*\nrogue/); // the injected fence opener was neutralized
  assert.match(out, /rogue\(\)/); // its text survives, just no longer as a real fence
});

test('render: pipes in a script are escaped inside the table', () => {
  const out = render({ ...CLI_ANSWERS, scripts: { build: 'tsc | tee log' } });
  assert.match(out, /tsc \\\| tee log/);
});

test('render: newlines in the tagline are collapsed to one line', () => {
  const out = render({ ...CLI_ANSWERS, tagline: 'line one\nline two' });
  assert.match(out, /\*\*line one line two\*\*/);
});

test('render: license badge escapes dashes (BSD-3-Clause)', () => {
  const out = render({ ...CLI_ANSWERS, license: 'BSD-3-Clause' });
  assert.match(out, /badge\/license-BSD--3--Clause-blue\.svg/);
});

test('render: tolerates a bare/empty answers object without throwing', () => {
  const out = render({});
  assert.ok(out.startsWith('# my-project'));
  assert.match(out, /## License/);
});

test('render: an unknown template falls back to app', () => {
  const out = render({ ...CLI_ANSWERS, template: 'nonsense' });
  assert.match(out, /## Getting started/);
});
