# readmine

[![CI](https://github.com/YOUR_USERNAME/readmine/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/readmine/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/readmine.svg)](https://www.npmjs.com/package/readmine)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node->=18-brightgreen.svg)](https://nodejs.org)

**Generate a beautiful README for your project in seconds.**

A blank `README.md` is where projects go to die. Writing badges, install and usage
sections, a scripts table, and a license blurb by hand is boring and easy to get
wrong. `readmine` asks a couple of questions — pre-filled from your `package.json` —
and writes a polished, professional README for you. No dependencies, no config, no
account, no network. Just Node 18+.

<!-- Add a short demo GIF of the wizard here once recorded: ![demo](docs/demo.gif) -->

```text
$ npx readmine
Detected: cli project "portkill" (MIT, pnpm)
Project name (portkill): ⏎
Template [lib / cli / app / minimal] (cli): ⏎
One-line description (Kill whatever's hogging a port): ⏎
Include badges? (Y/n) Y
Add a Contributing section? (Y/n) Y
✓ wrote README.md (45 lines) — preview it and tweak away.
```

...and out comes a ready-to-commit README, complete with badges, the right install
commands for your package manager, a usage block, and a scripts table:

```markdown
# portkill

[![CI](https://github.com/octocat/portkill/actions/workflows/ci.yml/badge.svg)](…)
[![npm](https://img.shields.io/npm/v/portkill.svg)](…)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Kill whatever's hogging a port.**

## Install

Run it once with no install:

    npx portkill
...
```

## Quick start

```bash
# one-off, no install (recommended)
npx readmine

# skip the questions and infer everything
npx readmine --yes

# or install globally
npm install -g readmine
readmine
```

Run it from the root of your project (next to `package.json`). readmine reads the
manifest and any lockfile to pre-fill sensible defaults.

## Templates

readmine ships four layouts. It auto-detects the right one from your `package.json`
(`bin` → **cli**, `main`/`exports` → **lib**, otherwise **app**), or you can force one
with `--template`.

| Template | Best for | Highlights |
| --- | --- | --- |
| `cli` | command-line tools (has a `bin`) | `npx`/global install, `--help` usage, scripts table |
| `lib` | packages you `import` | install as a dependency, import example, API section |
| `app` | apps and services | clone + install + run, dev/start usage |
| `minimal` | tiny repos | title, badges, one install command, license |

## Options

```
readmine [options]
```

| Option | Description |
| --- | --- |
| `--yes` | Non-interactive; infer everything and skip the prompts |
| `--template <t>` | `lib` \| `cli` \| `app` \| `minimal` (default: auto-detected) |
| `--out <file>` | Output path (default: `README.md`) |
| `--force` | Overwrite an existing `README.md` instead of writing a copy |
| `-h, --help` | Show help |
| `-v, --version` | Show the version |

Exit codes: `0` success, `1` a runtime failure (e.g. could not write the file),
`2` bad usage.

## Safety

readmine writes exactly one file and is careful never to destroy your work:

- **Never clobbers an existing README.** If `README.md` already exists and you didn't
  pass `--force`, readmine writes `README.generated.md` instead and tells you — so you
  can diff and merge at your leisure.
- **Degrades gracefully.** A missing or malformed `package.json` won't crash it; it
  falls back to prompts and sensible defaults.
- **Deterministic and offline.** No AI, no network calls. The same answers always
  produce the same markdown.
- **Sanitized output.** Interpolated values can't break your code fences, tables, or
  badge URLs.

## How it works

- `src/detect.mjs` reads `package.json`, spots your package manager from the lockfile
  (`npm` / `pnpm` / `yarn` / `bun`), infers the project type, and parses the repository
  URL into a badge slug.
- `src/render.mjs` is a **pure** function — `render(answers) → markdown` — with no I/O.
  That purity is what makes it easy to snapshot-test.
- `src/templates/*.mjs` decide the section ordering per project type.
- `src/prompt.mjs` is a tiny `readline` wizard, pre-filled with the detected defaults
  and skipped entirely under `--yes`.

## Development

```bash
node --test                      # run the test suite (Node built-in, zero deps)
node bin/readmine.mjs --help     # try the CLI
node bin/readmine.mjs --yes      # generate a README in the current project
```

There's nothing to install — no `npm install` step. The renderer is covered by
snapshot-style tests, and detection is tested against temp-dir fixtures for each
project type and lockfile.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The golden rules:
keep it **zero-dependency**, and keep `render()` **pure** and well-tested.

## License

MIT. See [LICENSE](LICENSE).

---

<sub>Meta note: the first draft of this README was generated by readmine itself
(`readmine --yes`), then expanded by hand with the templates and options tables.
Dogfooding — it's what's for dinner.</sub>
