// Library layout: install as a dependency, then an import/usage example and an
// API placeholder, followed by development scripts, contributing, license.
export function build(a, ctx) {
  const { pm } = ctx;
  const name = ctx.codeToken(a.name) || 'my-lib';
  const ident = ctx.identifier(a.name);

  const install = [
    ctx.h2('Install'),
    '',
    ctx.code('bash', `${pm.add} ${name}`),
  ].join('\n');

  const usage = [
    ctx.h2('Usage'),
    '',
    ctx.code('js', `import ${ident} from '${name}';\n\n// TODO: a short, runnable example goes here\nconsole.log(${ident});`),
  ].join('\n');

  const api = [
    ctx.h2('API'),
    '',
    'Document your exported functions and types here.',
  ].join('\n');

  return [
    ctx.title(a),
    ctx.badges(a),
    ctx.lead(a),
    install,
    usage,
    api,
    ctx.scripts(a, { heading: 'Development' }),
    ctx.contributing(a),
    ctx.license(a),
  ];
}
