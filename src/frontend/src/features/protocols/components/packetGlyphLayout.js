export function packetGlyphScreenScale(fontSize, diagramScale, requestedScale, hasPayload) {
  const min = hasPayload ? 11 : 12;
  const max = hasPayload ? 12 : 14;
  return Math.min(max, Math.max(min, fontSize * requestedScale * diagramScale)) / fontSize;
}

// SVG packet heads use translation and positive axis-aligned scale.
// Return a local tag transform; the packet's point and route never move.
export function packetGlyphPlacement(
  box,
  viewport,
  matrix,
  requestedScale,
  { inset = 8, clearance = 0 } = {}
) {
  const scale = Math.min(
    requestedScale,
    Math.max(1, viewport.width - inset * 2) / (box.width * matrix.a),
    Math.max(1, viewport.height - inset * 2) / (box.height * matrix.d)
  );
  const offsetY = clearance ? -(box.y + box.height) * scale - clearance / matrix.d : -22;
  const left = matrix.e + box.x * scale * matrix.a;
  const top = matrix.f + (box.y * scale + offsetY) * matrix.d;
  const width = box.width * scale * matrix.a;
  const height = box.height * scale * matrix.d;
  const x = Math.max(
    viewport.left + inset,
    Math.min(left, viewport.left + viewport.width - inset - width)
  );
  const y = Math.max(
    viewport.top + inset,
    Math.min(top, viewport.top + viewport.height - inset - height)
  );
  return { x: (x - left) / matrix.a, y: offsetY + (y - top) / matrix.d, scale };
}
