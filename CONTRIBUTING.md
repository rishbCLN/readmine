# Contributing to readmine

Thanks for helping! readmine is a small, **zero-dependency** Node CLI, and the goal is
to keep it that way: fast, obvious, deterministic, and cross-platform.

## Principles

- **No runtime dependencies.** Everything uses Node built-ins (`node:fs`, `node:path`,
  `node:readline/promises`). PRs that add a runtime dependency will be asked to remove
  it — no template engines, no markdown libraries, no prompt libraries.
- **`render()` is pure.** `src/render.mjs` turns an `answers` object into a markdown
  string with **no I/O** and no reliance on the environment. Given the same input it
  must always produce the same output. This is what makes it snapshot-testable — please
  keep it that way, and add a test for any change to the output.
- **Detection is isolated.** All filesystem/manifest reading lives in `src/detect.mjs`
  and never throws — a missing or malformed `package.json` degrades to sensible defaults.
- **Safe by default.** readmine writes exactly one file and never overwrites an existing
  `README.md` without `--force`.

## Getting started

```bash
git clone https://github.com/rishbCLN/readmine.git
cd readmine
node --test                    # run the suite
node bin/readmine.mjs --yes    # try it in this repo (writes README.generated.md)
```

There's nothing to install — no `npm install` step.

## Where things live

```
bin/readmine.mjs      # arg parsing → detect → prompt/infer → render → write
src/args.mjs          # manual, dependency-free argument parser
src/detect.mjs        # read package.json + lockfile, infer type/pm/repo (pure helpers)
src/render.mjs        # THE HEART: pure render(answers) -> markdown + sanitizers
src/templates/*.mjs   # per-type section ordering (lib/cli/app/minimal)
src/prompt.mjs        # readline wizard (skipped under --yes; never run in tests)
src/ui.mjs            # tiny ANSI styler (honors NO_COLOR / non-TTY)
test/*.test.mjs       # node:test + node:assert/strict
```

## Adding or changing output

1. If you're changing the generated markdown, update or add a case in
   `test/render.test.mjs`. Assert on the sections/badges and, where order matters, on
   the order they appear in.
2. If you're teaching readmine about a new lockfile or manifest shape, add a temp-dir
   fixture in `test/detect.test.mjs`.
3. Keep interpolated values sanitized so they can't break code fences, tables, or badge
   URLs.

## Before you open a PR

- Run `node --test` — CI runs the same on Windows, macOS, and Linux across Node 18/20/22.
- Keep the change focused, and update the README if you touch the CLI surface.
- Tests must never launch the interactive wizard or hang, and any filesystem writes must
  go to a temp dir and be cleaned up.

## Ideas / good first issues

- More templates (e.g. `action` for GitHub Actions, `monorepo`).
- Detect non-Node ecosystems (`pyproject.toml`, `Cargo.toml`).
- A `--dry-run` flag that prints to stdout instead of writing a file.
- A short demo GIF of the wizard for the README.
