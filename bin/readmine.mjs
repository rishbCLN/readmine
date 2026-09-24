#!/usr/bin/env node
// readmine — generate a beautiful README for your project in seconds (zero deps).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

import { parseArgs, HELP } from '../src/args.mjs';
import { detectProject, defaultAnswers, chooseOutputPath } from '../src/detect.mjs';
import { render } from '../src/render.mjs';
import { runWizard } from '../src/prompt.mjs';
import { makeStyler, colorEnabled } from '../src/ui.mjs';

function getVersion() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function countLines(text) {
  return text.replace(/\n+$/, '').split('\n').length;
}

async function main(argv) {
  const opts = parseArgs(argv);
  const c = makeStyler(colorEnabled());

  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (opts.version) {
    process.stdout.write(`readmine ${getVersion()}\n`);
    return 0;
  }
  if (opts.errors.length) {
    for (const e of opts.errors) process.stderr.write(`${c.red('error:')} ${e}\n`);
    process.stderr.write(`\nRun ${c.cyan('readmine --help')} for usage.\n`);
    return 2;
  }

  const cwd = process.cwd();

  // 1. Detect what we can from the project (never throws).
  const detected = detectProject(cwd);
  if (detected.warning) {
    process.stderr.write(`${c.yellow('note:')} ${detected.warning}\n`);
  }
  if (detected.ok) {
    const name = detected.name || 'this project';
    process.stdout.write(
      `${c.dim('Detected:')} ${c.bold(detected.type)} project ${c.cyan(`"${name}"`)} ` +
        `(${detected.license || 'no license'}, ${detected.packageManager})\n`,
    );
  }

  // 2. Gather answers — interactive wizard, or pure inference for --yes / non-TTY.
  const interactive = !opts.yes && Boolean(process.stdin.isTTY && process.stdout.isTTY);
  let answers;
  if (interactive) {
    answers = await runWizard(detected, { template: opts.template });
  } else {
    if (!opts.yes) {
      process.stderr.write(`${c.yellow('note:')} no interactive terminal — inferring everything (like --yes)\n`);
    }
    answers = defaultAnswers(detected, opts.template);
  }

  // 3. Render the markdown (pure).
  const markdown = render(answers);

  // 4. Resolve the output path, honoring the never-clobber-a-README rule.
  const outPath = resolve(cwd, opts.out || 'README.md');
  const { path: finalPath, usedAlternate } = chooseOutputPath(outPath, opts.force, existsSync);

  // 5. Write exactly one file.
  try {
    const dir = dirname(finalPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(finalPath, markdown, 'utf8');
  } catch (err) {
    process.stderr.write(`${c.red('error:')} could not write ${finalPath}: ${err.message || err}\n`);
    return 1;
  }

  const shown = relative(cwd, finalPath) || finalPath;
  const lines = countLines(markdown);
  if (usedAlternate) {
    process.stdout.write(
      `${c.yellow('!')} ${c.bold(relative(cwd, outPath) || 'README.md')} already exists — wrote ${c.bold(shown)} instead (${lines} lines).\n`,
    );
    process.stdout.write(`  Review it, then re-run with ${c.cyan('--force')} to overwrite the original.\n`);
  } else {
    process.stdout.write(`${c.green('\u2713')} wrote ${c.bold(shown)} (${lines} lines) — preview it and tweak away.\n`);
  }

  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`unexpected error: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  });
