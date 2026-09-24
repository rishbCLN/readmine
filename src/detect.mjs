// Project detection: read package.json + lockfiles and infer everything render()
// needs. The parsing/inference helpers are PURE so they can be unit-tested with
// fixtures; detectProject() is the thin, defensive filesystem orchestration and
// never throws — a missing or malformed package.json degrades to sensible defaults.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

/** Lockfiles we know how to map to a package manager. */
export const LOCKFILES = [
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
];

/**
 * Pick a package manager from the lockfiles present in a directory.
 * Priority (when several exist): bun > pnpm > yarn > npm. Defaults to npm.
 * @param {string[]} files filenames present in the project directory
 * @returns {'npm'|'pnpm'|'yarn'|'bun'}
 */
export function detectPackageManager(files) {
  const set = new Set((files || []).map((f) => String(f).toLowerCase()));
  if (set.has('bun.lockb') || set.has('bun.lock')) return 'bun';
  if (set.has('pnpm-lock.yaml')) return 'pnpm';
  if (set.has('yarn.lock')) return 'yarn';
  if (set.has('package-lock.json') || set.has('npm-shrinkwrap.json')) return 'npm';
  return 'npm';
}

/**
 * The family of commands for a package manager (install, add, run, exec, ...).
 * @param {string} pm
 */
export function pmCommands(pm) {
  switch (pm) {
    case 'pnpm':
      return { pm: 'pnpm', install: 'pnpm install', add: 'pnpm add', addDev: 'pnpm add -D', addGlobal: 'pnpm add -g', run: 'pnpm', exec: 'pnpm dlx' };
    case 'yarn':
      return { pm: 'yarn', install: 'yarn', add: 'yarn add', addDev: 'yarn add -D', addGlobal: 'yarn global add', run: 'yarn', exec: 'yarn dlx' };
    case 'bun':
      return { pm: 'bun', install: 'bun install', add: 'bun add', addDev: 'bun add -d', addGlobal: 'bun add -g', run: 'bun run', exec: 'bunx' };
    case 'npm':
    default:
      return { pm: 'npm', install: 'npm install', add: 'npm install', addDev: 'npm install -D', addGlobal: 'npm install -g', run: 'npm run', exec: 'npx' };
  }
}

/** The bare "install dependencies" command for a package manager. */
export function installCommand(pm) {
  return pmCommands(pm).install;
}

function finalizeSlug(host, owner, repo) {
  const cleanOwner = String(owner || '').trim();
  const cleanRepo = String(repo || '').trim().replace(/\.git$/i, '');
  if (!cleanOwner || !cleanRepo) return null;
  return { host: String(host || '').trim().toLowerCase(), owner: cleanOwner, repo: cleanRepo };
}

/**
 * Parse a repository field (string or the many git URL forms) into a slug.
 * Handles: https/git/ssh URLs, "git+" prefixes, scp syntax (git@host:owner/repo),
 * npm shorthands (github:owner/repo) and bare "owner/repo".
 * @param {unknown} input
 * @returns {{ host: string, owner: string, repo: string }|null}
 */
export function parseRepoSlug(input) {
  if (!input || typeof input !== 'string') return null;
  let url = input.trim();
  if (!url) return null;

  // npm host shorthands: "github:owner/repo", "gitlab:owner/repo", "bitbucket:owner/repo".
  const shorthand = /^(github|gitlab|bitbucket):([^/\s]+)\/([^/\s#]+)$/i.exec(url);
  if (shorthand) {
    const hosts = { github: 'github.com', gitlab: 'gitlab.com', bitbucket: 'bitbucket.org' };
    return finalizeSlug(hosts[shorthand[1].toLowerCase()], shorthand[2], shorthand[3]);
  }

  // Bare "owner/repo" → assume GitHub.
  const bare = /^([^/\s:@]+)\/([^/\s#]+)$/.exec(url);
  if (bare) return finalizeSlug('github.com', bare[1], bare[2]);

  // Drop a leading VCS prefix like "git+".
  url = url.replace(/^git\+/i, '');

  // scp-like syntax: git@github.com:owner/repo.git
  const scp = /^[^@\s]+@([^:\s]+):([^/\s]+)\/([^\s#]+)$/.exec(url);
  if (scp) return finalizeSlug(scp[1], scp[2], scp[3]);

  // Anything with a scheme (https://, git://, ssh://).
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
    if (parts.length >= 2) return finalizeSlug(u.hostname, parts[0], parts[1]);
  } catch {
    /* not a parseable URL — fall through */
  }

  return null;
}

/**
 * Infer the project "type" from package.json fields.
 * bin → cli, main/exports/module/types → lib, otherwise → app.
 * @param {Record<string, unknown>|null} pkg
 * @returns {'cli'|'lib'|'app'}
 */
export function inferType(pkg) {
  if (!pkg || typeof pkg !== 'object') return 'app';
  if (pkg.bin) return 'cli';
  if (pkg.exports || pkg.main || pkg.module || pkg.types || pkg.typings) return 'lib';
  return 'app';
}

/** Strip an npm scope, e.g. "@acme/widget" → "widget". */
function unscope(name) {
  return String(name || '').replace(/^@[^/]+\//, '');
}

/**
 * Work out the command name a CLI exposes.
 * @param {Record<string, unknown>|null} pkg
 * @returns {string}
 */
export function binName(pkg) {
  if (!pkg || typeof pkg !== 'object') return '';
  const bin = pkg.bin;
  if (typeof bin === 'string') return unscope(pkg.name) || 'cli';
  if (bin && typeof bin === 'object') {
    const keys = Object.keys(bin);
    if (keys.length) return keys[0];
  }
  return unscope(pkg.name);
}

/**
 * Decide where to write output, honoring the "never clobber a README" rule.
 * @param {string} outPath the requested output path
 * @param {boolean} force
 * @param {((p: string) => boolean)|boolean} existsFn does the path already exist?
 * @returns {{ path: string, usedAlternate: boolean }}
 */
export function chooseOutputPath(outPath, force, existsFn) {
  const exists = typeof existsFn === 'function' ? Boolean(existsFn(outPath)) : Boolean(existsFn);
  if (force || !exists) return { path: outPath, usedAlternate: false };
  const base = basename(outPath);
  const dot = base.lastIndexOf('.');
  const alt = dot > 0 ? `${base.slice(0, dot)}.generated${base.slice(dot)}` : `${base}.generated`;
  return { path: join(dirname(outPath), alt), usedAlternate: true };
}

/**
 * Read a project directory and infer everything we can. Never throws.
 * @param {string} dir
 */
export function detectProject(dir) {
  const result = {
    ok: false,
    warning: null,
    dir,
    pkg: null,
    name: '',
    description: '',
    version: '',
    license: '',
    type: 'app',
    binName: '',
    scripts: {},
    node: null,
    packageManager: 'npm',
    installCommand: 'npm install',
    repo: null,
    hasReadme: false,
  };

  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    entries = [];
  }
  const present = new Set(entries.map((e) => String(e).toLowerCase()));
  result.hasReadme = present.has('readme.md');
  result.packageManager = detectPackageManager(entries);
  result.installCommand = installCommand(result.packageManager);

  let raw = null;
  try {
    raw = readFileSync(join(dir, 'package.json'), 'utf8');
  } catch {
    result.warning = 'no package.json found — falling back to defaults';
    return result;
  }

  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch {
    result.warning = 'package.json is malformed — ignoring it and using defaults';
    return result;
  }
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    result.warning = 'package.json is not an object — using defaults';
    return result;
  }

  result.ok = true;
  result.pkg = pkg;
  result.name = typeof pkg.name === 'string' ? pkg.name : '';
  result.description = typeof pkg.description === 'string' ? pkg.description : '';
  result.version = typeof pkg.version === 'string' ? pkg.version : '';
  result.license = typeof pkg.license === 'string' ? pkg.license : '';
  result.type = inferType(pkg);
  result.binName = binName(pkg);
  result.scripts = pkg.scripts && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts)
    ? { ...pkg.scripts }
    : {};
  result.node = pkg.engines && typeof pkg.engines === 'object' && typeof pkg.engines.node === 'string'
    ? pkg.engines.node
    : null;

  const repoUrl = typeof pkg.repository === 'string'
    ? pkg.repository
    : pkg.repository && typeof pkg.repository === 'object'
      ? pkg.repository.url
      : null;
  result.repo = parseRepoSlug(repoUrl);

  return result;
}

/**
 * Turn a detection result into a fully-populated answers object with sensible
 * defaults. Used directly by `--yes` and as the pre-filled defaults for the wizard.
 * @param {ReturnType<typeof detectProject>} detected
 * @param {string|null} [template] explicit template override
 */
export function defaultAnswers(detected, template = null) {
  const d = detected || {};
  const name = d.name || 'my-project';
  const type = template || d.type || 'app';
  const description = d.description || '';
  return {
    name,
    tagline: description || `A ${type} project.`,
    description,
    template: type,
    license: d.license || 'MIT',
    packageManager: d.packageManager || 'npm',
    binName: d.binName || unscope(name) || name,
    scripts: d.scripts || {},
    repo: d.repo || null,
    node: d.node || null,
    badges: true,
    contributing: true,
    toc: false,
  };
}
