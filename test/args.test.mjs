import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, TEMPLATES } from '../src/args.mjs';

test('parseArgs: sensible defaults with no args', () => {
  const r = parseArgs([]);
  assert.deepEqual(r, {
    yes: false,
    template: null,
    out: null,
    force: false,
    help: false,
    version: false,
    errors: [],
  });
});

test('parseArgs: --yes toggles non-interactive mode', () => {
  assert.equal(parseArgs(['--yes']).yes, true);
  assert.equal(parseArgs(['-y']).yes, true);
});

test('parseArgs: --force', () => {
  assert.equal(parseArgs(['--force']).force, true);
  assert.equal(parseArgs(['-f']).force, true);
});

test('parseArgs: --template accepts each known template', () => {
  for (const t of TEMPLATES) {
    const r = parseArgs(['--template', t]);
    assert.equal(r.template, t);
    assert.deepEqual(r.errors, []);
  }
});

test('parseArgs: --template rejects an unknown value', () => {
  const r = parseArgs(['--template', 'bogus']);
  assert.equal(r.template, null);
  assert.ok(r.errors.some((e) => /invalid template/.test(e)));
});

test('parseArgs: --template=value inline form', () => {
  assert.equal(parseArgs(['--template=cli']).template, 'cli');
});

test('parseArgs: --out with a following value', () => {
  const r = parseArgs(['--out', 'docs/READ.md']);
  assert.equal(r.out, 'docs/READ.md');
  assert.deepEqual(r.errors, []);
});

test('parseArgs: --out=value inline form', () => {
  assert.equal(parseArgs(['--out=READ.md']).out, 'READ.md');
});

test('parseArgs: --template with no value is an error', () => {
  const r = parseArgs(['--template']);
  assert.ok(r.errors.some((e) => /requires a value/.test(e)));
});

test('parseArgs: --out followed by another flag is an error (missing value)', () => {
  const r = parseArgs(['--out', '--force']);
  assert.ok(r.errors.some((e) => /requires a value/.test(e)));
  // --force should NOT be consumed as the value
  assert.equal(r.force, true);
});

test('parseArgs: combined flags', () => {
  const r = parseArgs(['--yes', '--template', 'lib', '--out', 'README.md', '--force']);
  assert.equal(r.yes, true);
  assert.equal(r.template, 'lib');
  assert.equal(r.out, 'README.md');
  assert.equal(r.force, true);
  assert.deepEqual(r.errors, []);
});

test('parseArgs: help and version', () => {
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-v']).version, true);
  assert.equal(parseArgs(['--version']).version, true);
});

test('parseArgs: unknown option becomes an error', () => {
  const r = parseArgs(['--bogus']);
  assert.ok(r.errors.some((e) => /unknown option/.test(e)));
});

test('parseArgs: stray positional becomes an error', () => {
  const r = parseArgs(['whoops']);
  assert.ok(r.errors.some((e) => /unexpected argument/.test(e)));
});
