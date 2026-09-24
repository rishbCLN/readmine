// Application layout: focus on getting the project running locally (clone +
// install + run), then scripts, contributing, license.
export function build(a, ctx) {
  const { pm } = ctx;

  const clone = a.repo
    ? `git clone https://${ctx.codeToken(a.repo.host)}/${ctx.codeToken(a.repo.owner)}/${ctx.codeToken(a.repo.repo)}.git\ncd ${ctx.codeToken(a.repo.repo)}\n${pm.install}`
    : `# clone your repository, then install dependencies:\n${pm.install}`;

  const getting = [
    ctx.h2('Getting started'),
    '',
    ctx.code('bash', clone),
  ].join('\n');

  const scriptNames = a.scripts && typeof a.scripts === 'object' ? a.scripts : {};
  const runName = scriptNames.dev ? 'dev' : scriptNames.start ? 'start' : null;
  const usage = runName
    ? [ctx.h2('Usage'), '', ctx.code('bash', `${pm.run} ${runName}`)].join('\n')
    : '';

  return [
    ctx.title(a),
    ctx.badges(a),
    ctx.lead(a),
    getting,
    usage,
    ctx.scripts(a),
    ctx.contributing(a),
    ctx.license(a),
  ];
}
