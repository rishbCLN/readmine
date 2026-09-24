// render.mjs — THE HEART of readmine.
//
// `render(answers)` is a PURE, deterministic function: the same answers object
// always produces the exact same markdown string, with no I/O and no reliance on
// the environment. That purity is what makes it trivial to snapshot-test.
//
// Everything interpolated from the user / package.json is sanitized so it can't
// break a code fence, a markdown table, or a badge URL.
import { pmCommands } from './detect.mjs';

import * as cli from './templates/cli.mjs';
import * as lib from './templates/lib.mjs';
import * as app from './templates/app.mjs';
import * as minimal from './templates/minimal.mjs';

const TEMPLATES = { cli, lib, app, minimal };

// ---------------------------------------------------------------------------
// Sanitizers — keep interpolated values from breaking the markdown around them.
// ---------------------------------------------------------------------------

/** Collapse all whitespace (including newlines) to single spaces and trim. */
function oneLine(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

/** A value safe to drop inside inline code / a code fence / a URL: no backticks, no newlines. */
function codeToken(s) {
  return oneLine(s).replace(/[`\r\n]/g, '');
}

/** Escape a value for use inside a markdown table cell. */
function cell(s) {
  return oneLine(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

/** Escape a value used as a markdown link/image LABEL so `[`/`]` can't break out of the brackets. */
function labelText(s) {
  return oneLine(s).replace(/[\\[\]]/g, '\\$&');
}

/** Inline code inside a table cell: fenced in backticks with pipes escaped. */
function codeCell(s) {
  return '`' + codeToken(s).replace(/\|/g, '\\|') + '`';
}

/** Multi-line body text: normalize newlines, neutralize stray fences, trim. */
function blockText(s) {
  return String(s == null ? '' : s)
    .replace(/\r\n?/g, '\n')
    .replace(/```/g, "'''")
    .replace(/~{3,}/g, (m) => m.replace(/~/g, '\\~')) // defang ~~~ tilde code fences
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/**
 * Percent-encode a value for use inside a markdown link/image URL. `encodeURIComponent`
 * deliberately leaves `(`/`)` untouched, but a literal `)` closes the `](...)` early and
 * breaks (or lets someone inject into) the surrounding markdown — so we encode them too.
 * This matters for real, valid inputs like the SPDX license expression `(MIT OR Apache-2.0)`.
 */
function urlEncode(s) {
  return encodeURIComponent(oneLine(s)).replace(/\(/g, '%28').replace(/\)/g, '%29');
}

/** Escape a value for a shields.io badge label (dash/underscore/space rules). */
function shieldsLabel(s) {
  return urlEncode(oneLine(s).replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '_'));
}

/** A single URL path segment (owner, repo, ...). */
function seg(s) {
  return urlEncode(s);
}

/** npm names are URL-safe already (incl. @scope/name); only encode if something odd sneaks in. */
function npmBadgeName(name) {
  const n = oneLine(name);
  return /^(@[a-z0-9-._~]+\/)?[a-z0-9-._~]+$/i.test(n) ? n : urlEncode(n);
}

/** Strip an npm scope: "@acme/widget" → "widget". */
function unscope(name) {
  return oneLine(name).replace(/^@[^/]+\//, '');
}

/** Turn a package name into a JS identifier for import examples. */
function identifier(name) {
  const base = unscope(name).replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!base) return 'lib';
  const camel = base
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
  return /^[a-zA-Z_$]/.test(camel) ? camel : `_${camel}`;
}

// ---------------------------------------------------------------------------
// Markdown primitives.
// ---------------------------------------------------------------------------

function h2(t) {
  return `## ${oneLine(t)}`;
}

function code(lang, body) {
  return '```' + oneLine(lang) + '\n' + String(body).replace(/```/g, "'''") + '\n```';
}

function table(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

// ---------------------------------------------------------------------------
// Shared section builders (used by every template via the `ctx` kit).
// ---------------------------------------------------------------------------

function title(a) {
  return `# ${oneLine(a.name) || 'project'}`;
}

function badges(a) {
  if (!a.badges) return '';
  const lines = [];
  const repo = a.repo;
  if (repo && repo.host === 'github.com' && repo.owner && repo.repo) {
    const o = seg(repo.owner);
    const r = seg(repo.repo);
    lines.push(`[![CI](https://github.com/${o}/${r}/actions/workflows/ci.yml/badge.svg)](https://github.com/${o}/${r}/actions/workflows/ci.yml)`);
  }
  if (a.name) {
    const nm = npmBadgeName(a.name);
    lines.push(`[![npm](https://img.shields.io/npm/v/${nm}.svg)](https://www.npmjs.com/package/${nm})`);
  }
  if (a.license) {
    lines.push(`[![license: ${labelText(a.license)}](https://img.shields.io/badge/license-${shieldsLabel(a.license)}-blue.svg)](LICENSE)`);
  }
  if (a.node) {
    lines.push(`[![node](https://img.shields.io/badge/node-${shieldsLabel(a.node)}-brightgreen.svg)](https://nodejs.org)`);
  }
  return lines.join('\n');
}

function lead(a) {
  const tagline = oneLine(a.tagline);
  const desc = blockText(a.description);
  const out = [];
  if (tagline) out.push(`**${tagline}**`);
  if (desc && desc !== tagline) out.push(desc);
  return out.join('\n\n');
}

function scripts(a, opts = {}) {
  const table_ = a.scripts && typeof a.scripts === 'object' ? a.scripts : {};
  const names = Object.keys(table_).filter((k) => typeof table_[k] === 'string' && table_[k].trim());
  if (names.length === 0) return '';
  const run = pmCommands(a.packageManager).run;
  const rows = names.map((n) => [codeCell(`${run} ${n}`), codeCell(table_[n])]);
  return [h2(opts.heading || 'Scripts'), '', table(['Script', 'Runs'], rows)].join('\n');
}

function contributing(a) {
  if (!a.contributing) return '';
  return [
    h2('Contributing'),
    '',
    'Contributions are welcome! Please open an issue to discuss significant changes before',
    'submitting a pull request, and make sure the test suite passes.',
  ].join('\n');
}

function license(a) {
  const lic = oneLine(a.license) || 'MIT';
  return `${h2('License')}\n\n${lic}. See [LICENSE](LICENSE).`;
}

function slug(text) {
  return oneLine(text).toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
}

/** Build a table of contents from the H2 headings already present in the sections. */
function buildToc(sections) {
  const titles = [];
  for (const s of sections) {
    const first = String(s).split('\n', 1)[0];
    const m = /^##\s+(.+)$/.exec(first);
    if (m) titles.push(m[1].trim());
  }
  if (titles.length === 0) return '';
  return [h2('Contents'), '', ...titles.map((t) => `- [${t}](#${slug(t)})`)].join('\n');
}

// ---------------------------------------------------------------------------
// The kit handed to every template. Templates stay dependency-free and pure:
// they only compose the primitives + shared builders provided here.
// ---------------------------------------------------------------------------

function makeCtx(a) {
  return {
    pm: pmCommands(a.packageManager),
    oneLine,
    codeToken,
    cell,
    codeCell,
    blockText,
    unscope,
    identifier,
    h2,
    code,
    table,
    title,
    badges,
    lead,
    scripts,
    contributing,
    license,
  };
}

function normalize(answers) {
  const a = answers && typeof answers === 'object' ? answers : {};
  const template = TEMPLATES[a.template] ? a.template : 'app';
  return {
    name: a.name || 'my-project',
    tagline: a.tagline || '',
    description: a.description || '',
    template,
    license: a.license || 'MIT',
    packageManager: a.packageManager || 'npm',
    binName: a.binName || '',
    scripts: a.scripts && typeof a.scripts === 'object' ? a.scripts : {},
    repo: a.repo && typeof a.repo === 'object' ? a.repo : null,
    node: a.node || null,
    badges: a.badges !== false,
    contributing: a.contributing !== false,
    toc: Boolean(a.toc),
  };
}

/**
 * Render a README from an answers object. Pure and deterministic.
 * @param {object} answers
 * @returns {string} markdown
 */
export function render(answers) {
  const a = normalize(answers);
  const ctx = makeCtx(a);
  const tpl = TEMPLATES[a.template] || TEMPLATES.app;

  let sections = tpl.build(a, ctx).filter((s) => typeof s === 'string' && s.trim() !== '');

  if (a.toc) {
    const toc = buildToc(sections);
    if (toc) {
      const idx = sections.findIndex((s) => /^##\s+/.test(s));
      if (idx === -1) sections.push(toc);
      else sections.splice(idx, 0, toc);
    }
  }

  return sections.join('\n\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

// Exported for focused unit tests.
export { buildToc, normalize };
