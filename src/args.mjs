// Zero-dependency argument parsing. Kept pure so it is fully unit-testable.

export const TEMPLATES = ['lib', 'cli', 'app', 'minimal'];

export const HELP = `readmine — generate a beautiful README for your project in seconds

Usage:
  readmine [options]

Options:
      --yes         Non-interactive; infer everything, skip the prompts
      --template <t> lib | cli | app | minimal   (default: auto-detected)
      --out <file>  Output path (default: README.md)
      --force       Overwrite an existing README.md instead of writing a copy
  -h, --help        Show this help
  -v, --version     Show the version

Examples:
  readmine                     # interactive wizard, pre-filled from package.json
  readmine --yes               # no questions asked, infer everything
  readmine --template cli      # force the "cli" section layout
  readmine --yes --force       # regenerate README.md in place

Notes:
  * readmine never overwrites an existing README.md unless you pass --force;
    otherwise it writes README.generated.md and tells you.
  * Everything runs offline with zero dependencies — Node built-ins only.
`;

/** Options that consume the following token as their value. */
const VALUE_FLAGS = new Set(['--template', '--out']);

/**
 * Parse the full argv (excluding node + script).
 * @param {string[]} argv
 * @returns {{ yes: boolean, template: string|null, out: string|null,
 *             force: boolean, help: boolean, version: boolean, errors: string[] }}
 */
export function parseArgs(argv) {
  const result = {
    yes: false,
    template: null,
    out: null,
    force: false,
    help: false,
    version: false,
    errors: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // Support --flag=value as well as --flag value.
    let name = arg;
    let inlineValue = null;
    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      name = arg.slice(0, eq);
      inlineValue = arg.slice(eq + 1);
    }

    switch (name) {
      case '-h':
      case '--help':
        result.help = true;
        break;
      case '-v':
      case '--version':
        result.version = true;
        break;
      case '-y':
      case '--yes':
        result.yes = true;
        break;
      case '-f':
      case '--force':
        result.force = true;
        break;
      case '--template':
      case '--out': {
        let value = inlineValue;
        if (value == null) {
          value = argv[i + 1];
          if (value == null || (value.startsWith('-') && value.length > 1)) {
            result.errors.push(`option ${name} requires a value`);
            break;
          }
          i += 1; // consume the value token
        }
        if (name === '--template') {
          if (!TEMPLATES.includes(value)) {
            result.errors.push(
              `invalid template "${value}" (expected one of: ${TEMPLATES.join(', ')})`,
            );
          } else {
            result.template = value;
          }
        } else {
          if (value === '') {
            result.errors.push('option --out requires a non-empty value');
          } else {
            result.out = value;
          }
        }
        break;
      }
      default: {
        if (name.length > 1 && name.startsWith('-')) {
          result.errors.push(`unknown option: ${arg}`);
        } else {
          result.errors.push(`unexpected argument: ${arg}`);
        }
      }
    }
  }

  return result;
}
