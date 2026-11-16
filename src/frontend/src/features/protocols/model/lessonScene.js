import scene from '../data/lessons/scene.json';

// Explicit physical links take priority for switched topologies; otherwise use
// the source's route table. Never add a direct edge to fill a missing route.
export function lessonLinks(lesson) {
  const edges = lesson.links
    ? lesson.links.map((link) => link.replace('-', '>'))
    : Object.values(scene.routes).flat();
  return [...new Set(edges.map((edge) => edge.split('>').sort().join('>')))].filter((edge) =>
    edge.split('>').every((id) => lesson.nodes.includes(id))
  );
}

export function lessonRoute(raw, lesson) {
  if (!lesson?.links) return scene.routes[`${raw.from}>${raw.to}`] || [];
  const edges = lessonLinks(lesson).map((edge) => edge.split('>'));
  const queue = [[raw.from]],
    visited = new Set([raw.from]);
  for (const path of queue) {
    const last = path[path.length - 1];
    if (last === raw.to) return path.slice(1).map((node, i) => `${path[i]}>${node}`);
    for (const edge of edges) {
      const next = edge[0] === last ? edge[1] : edge[1] === last ? edge[0] : null;
      if (next && !visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}

export function compactLessonPositions(visible) {
  const servers = visible.filter((id) => !['client', 'router', 'internet'].includes(id));
  const rows = Math.ceil(servers.length / 2);
  const positions = {
    ...scene.positions,
    client: [100, rows * 180 + 160],
    router: [260, rows * 180 + 160],
    internet: [420, rows * 180 + 160],
  };
  servers.forEach((id, i) => {
    positions[id] = [150 + (i % 2) * 230, 100 + Math.floor(i / 2) * 180];
  });
  return positions;
}

export function lessonCamera(frame, visible, positions = scene.positions) {
  const points = (visible.length ? visible : scene.frames[frame] || ['client'])
    .map((id) => positions[id])
    .filter(Boolean);
  if (!points.length) points.push(scene.positions.client);
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const width = Math.max(380, Math.max(...xs) - Math.min(...xs) + 320);
  const height = Math.max(300, Math.max(...ys) - Math.min(...ys) + 280);
  return [
    (Math.max(...xs) + Math.min(...xs) - width) / 2,
    (Math.max(...ys) + Math.min(...ys) - height) / 2 + 18,
    width,
    height,
  ].join(' ');
}

export function lessonFlight(raw, positions = scene.positions, lesson) {
  const edges = lessonRoute(raw, lesson);
  const segments = [];
  let offset = raw.quick ? 0.14 : 0.22;
  for (let i = 0; i < edges.length; i++) {
    const [from, to] = edges[i].split('>');
    const a = positions[from],
      b = positions[to];
    const lost = raw.lost && edges[i].includes('internet');
    const end = lost ? [a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55] : b;
    const duration = Math.hypot(end[0] - a[0], end[1] - a[1]) / (raw.quick ? 504 : 210);
    segments.push({ from, to, a, b: end, start: offset, duration });
    offset += duration;
    if (lost) break;
    if (i < edges.length - 1) offset += raw.quick ? 0.04 : 0.14;
  }
  return { segments, arrival: offset, duration: offset + (raw.lost ? 0.77 : 0.33) };
}
