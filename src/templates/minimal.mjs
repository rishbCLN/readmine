// Minimal layout: just the essentials — title, badges, a lead paragraph, a
// single install command, and the license.
export function build(a, ctx) {
  const { pm } = ctx;

  const install = [
    ctx.h2('Install'),
    '',
    ctx.code('bash', pm.install),
  ].join('\n');

  return [
    ctx.title(a),
    ctx.badges(a),
    ctx.lead(a),
    install,
    ctx.license(a),
  ];
}
