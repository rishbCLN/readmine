// CLI project layout: lead with how to run the command (npx + global install),
// then usage, scripts, contributing, license.
export function build(a, ctx) {
  const { pm } = ctx;
  const cmd = ctx.codeToken(a.binName || ctx.unscope(a.name)) || 'cli';
  const name = ctx.codeToken(a.name) || 'my-cli';

  const install = [
    ctx.h2('Install'),
    '',
    'Run it once with no install:',
    '',
    ctx.code('bash', `${pm.exec} ${name}`),
    '',
    'Or install it globally:',
    '',
    ctx.code('bash', `${pm.addGlobal} ${name}\n${cmd} --help`),
  ].join('\n');

  const usage = [
    ctx.h2('Usage'),
    '',
    ctx.code('bash', `${cmd} --help`),
  ].join('\n');

  return [
    ctx.title(a),
    ctx.badges(a),
    ctx.lead(a),
    install,
    usage,
    ctx.scripts(a),
    ctx.contributing(a),
    ctx.license(a),
  ];
}
