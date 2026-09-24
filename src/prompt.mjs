// Interactive wizard built on node:readline/promises. It is pre-filled with the
// values detected from package.json, so most answers are a single <Enter>.
//
// This module is never exercised by the test suite (tests drive render/detect
// directly), and it is skipped entirely in --yes / non-interactive runs.
import { createInterface } from 'node:readline/promises';
import { defaultAnswers, parseRepoSlug } from './detect.mjs';
import { TEMPLATES } from './args.mjs';

async function ask(rl, label, def) {
  const hint = def ? ` \x1b[2m(${def})\x1b[22m` : '';
  const answer = (await rl.question(`${label}${hint}: `)).trim();
  return answer || def || '';
}

async function askYesNo(rl, label, def) {
  const answer = (await rl.question(`${label} ${def ? '(Y/n)' : '(y/N)'} `)).trim().toLowerCase();
  if (!answer) return def;
  return answer === 'y' || answer === 'yes';
}

async function askChoice(rl, label, choices, def) {
  const answer = (await rl.question(`${label} [${choices.join(' / ')}] (${def}): `)).trim().toLowerCase();
  if (!answer) return def;
  return choices.includes(answer) ? answer : def;
}

/**
 * Run the interactive wizard.
 * @param {object} detected result of detectProject()
 * @param {{ input?: NodeJS.ReadStream, output?: NodeJS.WriteStream, template?: string|null }} [opts]
 * @returns {Promise<object>} a complete answers object for render()
 */
export async function runWizard(detected, opts = {}) {
  const input = opts.input || process.stdin;
  const output = opts.output || process.stdout;
  const base = defaultAnswers(detected, opts.template || null);
  const rl = createInterface({ input, output });

  try {
    const name = await ask(rl, 'Project name', base.name);
    const template = opts.template || (await askChoice(rl, 'Template', TEMPLATES, base.template));
    const tagline = await ask(rl, 'One-line description', base.tagline);
    const badges = await askYesNo(rl, 'Include badges?', base.badges);

    let repo = base.repo;
    if (badges && !repo) {
      const slug = await ask(rl, 'GitHub repo for badges (owner/repo, optional)', '');
      if (slug) repo = parseRepoSlug(slug);
    }

    const contributing = await askYesNo(rl, 'Add a Contributing section?', base.contributing);

    return { ...base, name, template, tagline, badges, repo, contributing };
  } finally {
    rl.close();
  }
}
