import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectPackageManager,
  installCommand,
  pmCommands,
  parseRepoSlug,
  inferType,
  binName,
  chooseOutputPath,
  detectProject,
  defaultAnswers,
} from '../src/detect.mjs';

// --- package manager detection -------------------------------------------

test('detectPackageManager: each lockfile maps to its manager', () => {
  assert.equal(detectPackageManager(['package-lock.json']), 'npm');
  assert.equal(detectPackageManager(['pnpm-lock.yaml']), 'pnpm');
  assert.equal(detectPackageManager(['yarn.lock']), 'yarn');
  assert.equal(detectPackageManager(['bun.lockb']), 'bun');
});

test('detectPackageManager: defaults to npm when nothing is present', () => {
  assert.equal(detectPackageManager([]), 'npm');
  assert.equal(detectPackageManager(['README.md', 'index.js']), 'npm');
});

test('detectPackageManager: priority is bun > pnpm > yarn > npm', () => {
  assert.equal(
    detectPackageManager(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb']),
    'bun',
  );
  assert.equal(detectPackageManager(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']), 'pnpm');
  assert.equal(detectPackageManager(['package-lock.json', 'yarn.lock']), 'yarn');
});

test('installCommand: correct bare install command per manager', () => {
  assert.equal(installCommand('npm'), 'npm install');
  assert.equal(installCommand('pnpm'), 'pnpm install');
  assert.equal(installCommand('yarn'), 'yarn');
  assert.equal(installCommand('bun'), 'bun install');
});

test('pmCommands: exec/global differ per manager', () => {
  assert.equal(pmCommands('npm').exec, 'npx');
  assert.equal(pmCommands('pnpm').exec, 'pnpm dlx');
  assert.equal(pmCommands('yarn').exec, 'yarn dlx');
  assert.equal(pmCommands('bun').exec, 'bunx');
  assert.equal(pmCommands('npm').addGlobal, 'npm install -g');
  assert.equal(pmCommands('yarn').addGlobal, 'yarn global add');
});

// --- repo slug parsing ----------------------------------------------------

test('parseRepoSlug: https URL with .git', () => {
  assert.deepEqual(parseRepoSlug('https://github.com/octocat/portkill.git'), {
    host: 'github.com',
    owner: 'octocat',
    repo: 'portkill',
  });
});

test('parseRepoSlug: git+https prefix', () => {
  assert.deepEqual(parseRepoSlug('git+https://github.com/octocat/portkill.git'), {
    host: 'github.com',
    owner: 'octocat',
    repo: 'portkill',
  });
});

test('parseRepoSlug: scp syntax', () => {
  assert.deepEqual(parseRepoSlug('git@github.com:octocat/portkill.git'), {
    host: 'github.com',
    owner: 'octocat',
    repo: 'portkill',
  });
});

test('parseRepoSlug: npm shorthand', () => {
  assert.deepEqual(parseRepoSlug('github:octocat/portkill'), {
    host: 'github.com',
    owner: 'octocat',
    repo: 'portkill',
  });
});

test('parseRepoSlug: bare owner/repo assumes github', () => {
  assert.deepEqual(parseRepoSlug('octocat/portkill'), {
    host: 'github.com',
    owner: 'octocat',
    repo: 'portkill',
  });
});

test('parseRepoSlug: non-github host is preserved', () => {
  assert.deepEqual(parseRepoSlug('https://gitlab.com/group/proj'), {
    host: 'gitlab.com',
    owner: 'group',
    repo: 'proj',
  });
});

test('parseRepoSlug: junk returns null', () => {
  assert.equal(parseRepoSlug(''), null);
  assert.equal(parseRepoSlug(null), null);
  assert.equal(parseRepoSlug('not a url'), null);
});

// --- type / bin inference -------------------------------------------------

test('inferType: bin -> cli, main/exports -> lib, otherwise app', () => {
  assert.equal(inferType({ bin: { foo: 'bin/foo.js' } }), 'cli');
  assert.equal(inferType({ bin: 'bin/foo.js' }), 'cli');
  assert.equal(inferType({ main: 'index.js' }), 'lib');
  assert.equal(inferType({ exports: './index.js' }), 'lib');
  assert.equal(inferType({}), 'app');
  assert.equal(inferType(null), 'app');
});

test('binName: object bin uses the first key, string bin uses (unscoped) name', () => {
  assert.equal(binName({ name: 'x', bin: { mycli: 'bin/x.js' } }), 'mycli');
  assert.equal(binName({ name: '@acme/tool', bin: 'bin/x.js' }), 'tool');
  assert.equal(binName({ name: '@acme/tool' }), 'tool');
});

// --- overwrite guard ------------------------------------------------------

test('chooseOutputPath: writes the target when it does not exist', () => {
  const r = chooseOutputPath('/proj/README.md', false, () => false);
  assert.deepEqual(r, { path: '/proj/README.md', usedAlternate: false });
});

test('chooseOutputPath: existing README + no force -> README.generated.md', () => {
  const r = chooseOutputPath(join('/proj', 'README.md'), false, () => true);
  assert.equal(r.usedAlternate, true);
  assert.equal(r.path, join('/proj', 'README.generated.md'));
});

test('chooseOutputPath: --force overwrites the original', () => {
  const r = chooseOutputPath(join('/proj', 'README.md'), true, () => true);
  assert.deepEqual(r, { path: join('/proj', 'README.md'), usedAlternate: false });
});

test('chooseOutputPath: alternate keeps a custom extension', () => {
  const r = chooseOutputPath(join('/proj', 'docs.markdown'), false, () => true);
  assert.equal(r.path, join('/proj', 'docs.generated.markdown'));
});

// --- detectProject on temp-dir fixtures -----------------------------------

function withTempProject(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'readmine-detect-'));
  try {
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(join(dir, name), contents);
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('detectProject: a cli project with a pnpm lockfile', () => {
  withTempProject(
    {
      'package.json': JSON.stringify({
        name: 'portkill',
        description: 'kill a port',
        license: 'MIT',
        bin: { portkill: 'bin/portkill.mjs' },
        scripts: { test: 'node --test' },
        engines: { node: '>=18' },
        repository: 'github:octocat/portkill',
      }),
      'pnpm-lock.yaml': 'lockfileVersion: 6',
    },
    (dir) => {
      const d = detectProject(dir);
      assert.equal(d.ok, true);
      assert.equal(d.type, 'cli');
      assert.equal(d.name, 'portkill');
      assert.equal(d.binName, 'portkill');
      assert.equal(d.packageManager, 'pnpm');
      assert.equal(d.installCommand, 'pnpm install');
      assert.deepEqual(d.repo, { host: 'github.com', owner: 'octocat', repo: 'portkill' });
      assert.equal(d.node, '>=18');
      assert.deepEqual(d.scripts, { test: 'node --test' });
    },
  );
});

test('detectProject: a library with yarn.lock', () => {
  withTempProject(
    {
      'package.json': JSON.stringify({ name: 'tiny-lib', main: 'index.js' }),
      'yarn.lock': '# yarn',
    },
    (dir) => {
      const d = detectProject(dir);
      assert.equal(d.type, 'lib');
      assert.equal(d.packageManager, 'yarn');
      assert.equal(d.installCommand, 'yarn');
    },
  );
});

test('detectProject: an app with npm lockfile', () => {
  withTempProject(
    {
      'package.json': JSON.stringify({ name: 'my-app', scripts: { dev: 'vite' } }),
      'package-lock.json': '{}',
    },
    (dir) => {
      const d = detectProject(dir);
      assert.equal(d.type, 'app');
      assert.equal(d.packageManager, 'npm');
      assert.equal(d.installCommand, 'npm install');
    },
  );
});

test('detectProject: malformed package.json degrades gracefully', () => {
  withTempProject(
    { 'package.json': '{ not valid json ', 'yarn.lock': '# yarn' },
    (dir) => {
      const d = detectProject(dir);
      assert.equal(d.ok, false);
      assert.match(d.warning, /malformed/);
      // lockfile detection still works even though the manifest is broken
      assert.equal(d.packageManager, 'yarn');
    },
  );
});

test('detectProject: missing package.json is fine', () => {
  withTempProject({}, (dir) => {
    const d = detectProject(dir);
    assert.equal(d.ok, false);
    assert.match(d.warning, /no package\.json/);
  });
});

test('detectProject: notices an existing README', () => {
  withTempProject(
    { 'package.json': JSON.stringify({ name: 'x' }), 'README.md': '# x' },
    (dir) => {
      assert.equal(detectProject(dir).hasReadme, true);
    },
  );
});

// --- defaultAnswers -------------------------------------------------------

test('defaultAnswers: fills a complete answers object with template override', () => {
  const detected = {
    name: 'portkill',
    description: 'kill a port',
    license: 'MIT',
    type: 'cli',
    binName: 'portkill',
    scripts: {},
    packageManager: 'npm',
    repo: null,
    node: '>=18',
  };
  const a = defaultAnswers(detected, 'minimal');
  assert.equal(a.template, 'minimal');
  assert.equal(a.name, 'portkill');
  assert.equal(a.tagline, 'kill a port');
  assert.equal(a.badges, true);
  assert.equal(a.contributing, true);
});
