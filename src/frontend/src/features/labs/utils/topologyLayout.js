// Display-only layout: authored positions and simulator topology stay immutable.
const PADDING_X = 80;
const ROW_GAP = 164;
const MIN_GAP = 184;
export function layoutTopology(devices, links, viewport, fit) {
  const original = Object.fromEntries(
    devices.map((d, i) => [d.id, d.position || { x: 100 + i * 180, y: 100 }])
  );
  if (!fit)
    return { positions: original, viewBox: '0 0 1000 600', width: 1000, height: 600, minWidth: 0 };
  const peers = Object.fromEntries(devices.map((d) => [d.id, []]));
  const validLinks = links.filter((l) => peers[l.a.deviceId] && peers[l.b.deviceId]);
  validLinks.forEach(({ a, b }) => {
    peers[a.deviceId].push(b.deviceId);
    peers[b.deviceId].push(a.deviceId);
  });
  const ordered = [];
  let current = devices.find((d) => peers[d.id].length === 1)?.id;
  if (
    validLinks.length === devices.length - 1 &&
    Object.values(peers).every((p) => p.length <= 2)
  ) {
    while (current && !ordered.includes(current)) {
      ordered.push(current);
      current = peers[current].find((id) => !ordered.includes(id));
    }
  }
  const points = Object.values(original);
  const rangeX = points.length
    ? Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))
    : 0;
  const rangeY = points.length
    ? Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))
    : 0;
  const chain = ordered.length === devices.length && devices.length > 1;
  const keepRows =
    devices.every((d) => d.position) && rangeY > 60 && (devices.length > 4 || rangeX < 1);
  const bounds = devices.map((device) => nodeBounds(device, { x: 0, y: 0 }));
  const maxNodeHeight = Math.max(85, ...bounds.map((box) => box.height));
  if (devices.length < 2 || (chain && !keepRows)) {
    const padding = Math.ceil(Math.max(64, ...bounds.map((box) => box.width / 2 + 8)));
    const sequence = devices.length < 2 ? devices.map((d) => d.id) : ordered;
    const columns =
      sequence.length <= 4
        ? Math.max(1, sequence.length)
        : Math.min(6, Math.max(3, Math.floor((viewport.width - 128) / MIN_GAP) + 1));
    const rows = Math.max(1, Math.ceil(sequence.length / columns));
    const minWidth = Math.max(
      280,
      (columns - 1) * (columns <= 4 && rows === 1 ? 140 : MIN_GAP) + padding * 2
    );
    const width = Math.max(viewport.width, minWidth);
    const rowGap = Math.max(ROW_GAP, maxNodeHeight + 48);
    const height =
      rows === 1
        ? Math.max(210, maxNodeHeight * 2 - 40)
        : Math.max(176, maxNodeHeight + 80) + (rows - 1) * rowGap;
    const span = Math.min(width - padding * 2, (columns - 1) * 228);
    const positions = {};
    sequence.forEach((id, i) => {
      const row = Math.floor(i / columns);
      const col = row % 2 ? columns - 1 - (i % columns) : i % columns;
      positions[id] = {
        x: (width - span) / 2 + (columns > 1 ? (col * span) / (columns - 1) : 0),
        y: rows === 1 ? height / 2 - 10 : 76 + row * rowGap,
      };
    });
    return {
      positions,
      width,
      height,
      minWidth,
      linear: rows === 1,
      rows,
      viewBox: `0 0 ${width} ${height}`,
    };
  }
  let authored = points;
  let minimum = Infinity;
  points.forEach((a, i) =>
    points.slice(i + 1).forEach((b) => {
      minimum = Math.min(minimum, Math.hypot(a.x - b.x, a.y - b.y));
    })
  );
  // Missing or coincident positions need a readable deterministic grid.
  if (minimum < 1 || !devices.some((d) => d.position)) {
    const columns = Math.min(6, Math.max(2, Math.floor((viewport.width - 144) / MIN_GAP) + 1));
    authored = devices.map((_, i) => ({
      x: (i % columns) * 200,
      y: Math.floor(i / columns) * ROW_GAP,
    }));
    minimum = ROW_GAP;
  }
  const minX = Math.min(...authored.map((p) => p.x)),
    minY = Math.min(...authored.map((p) => p.y));
  const dx = Math.max(...authored.map((p) => p.x)) - minX,
    dy = Math.max(...authored.map((p) => p.y)) - minY;
  const scale = Number.isFinite(minimum) ? MIN_GAP / minimum : 1;
  const minWidth = Math.max(440, Math.ceil(dx * scale) + PADDING_X * 2);
  const width = Math.max(viewport.width, minWidth);
  const bottomPadding = Math.max(100, maxNodeHeight - 15);
  const height = Math.max(260, Math.ceil(dy * scale) + 72 + bottomPadding);
  const sx = dx ? (width - PADDING_X * 2) / dx : 1;
  const positions = Object.fromEntries(
    devices.map((d, i) => [
      d.id,
      {
        x: dx ? PADDING_X + (authored[i].x - minX) * sx : width / 2,
        y: (height - dy * scale - 72 - bottomPadding) / 2 + 72 + (authored[i].y - minY) * scale,
      },
    ])
  );
  return { positions, width, height, minWidth, linear: false, viewBox: `0 0 ${width} ${height}` };
}
export const devicePort = (device, name) =>
  Array.isArray(device?.interfaces)
    ? device.interfaces.find((p) => p.name === name)
    : device?.interfaces?.[name];
export const shortPort = (name = '') =>
  name
    .replace(/^GigabitEthernet/i, 'Gi')
    .replace(/^FastEthernet/i, 'Fa')
    .replace(/^Ethernet/i, 'Et')
    .replace(/^Serial/i, 'Se');
export const labelLines = (text = '', length = 18) =>
  String(text).match(new RegExp(`.{1,${length}}`, 'gu')) || [];
export const nodeBounds = (device, position) => {
  const width =
    Math.max(
      66,
      ...labelLines(device.id).map((line) => line.length * 7.7),
      ...labelLines(device.hostname).map((line) => line.length * 6.9)
    ) + 6;
  return {
    x: position.x - width / 2,
    y: position.y - 35,
    width,
    height:
      85 +
      Math.max(0, labelLines(device.id).length - 1) * 15 +
      (device.hostname && device.hostname !== device.id
        ? labelLines(device.hostname).length * 15
        : 0),
  };
};
