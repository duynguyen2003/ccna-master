// Shared by validation and grading so malformed graphs cannot silently award points.
const orderedChecks = (checks) => {
  const byId = new Map(checks.map((check) => [check.id, check]));
  if (byId.size !== checks.length) throw new Error('Duplicate check ID');
  const visiting = new Set();
  const done = new Set();
  const ordered = [];
  const visit = (id) => {
    if (done.has(id)) return;
    if (visiting.has(id)) throw new Error(`Circular check dependency: ${id}`);
    const check = byId.get(id);
    if (!check) throw new Error(`Unknown check dependency: ${id}`);
    visiting.add(id);
    for (const dependency of check.dependsOn || []) visit(dependency);
    visiting.delete(id);
    done.add(id);
    ordered.push(check);
  };
  checks.forEach((check) => visit(check.id));
  return ordered;
};
module.exports = { orderedChecks };
