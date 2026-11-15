import { packetGlyphPlacement, packetGlyphScreenScale } from './packetGlyphLayout';

const box = { x: -50, y: -40, width: 100, height: 44 };
const viewport = { left: 200, top: 100, width: 400, height: 300 };
const bounds = (box, matrix, placement) => ({
  left: matrix.e + (box.x * placement.scale + placement.x) * matrix.a,
  top: matrix.f + (box.y * placement.scale + placement.y) * matrix.d,
  right: matrix.e + ((box.x + box.width) * placement.scale + placement.x) * matrix.a,
  bottom: matrix.f + ((box.y + box.height) * placement.scale + placement.y) * matrix.d,
});

test('large cards stay inside every canvas edge without changing the packet anchor', () => {
  for (const [e, f] of [
    [205, 105],
    [595, 105],
    [205, 395],
    [595, 395],
  ]) {
    const matrix = { a: 1, d: 1, e, f };
    const placement = packetGlyphPlacement(box, viewport, matrix, 1.65);
    const card = bounds(box, matrix, placement);
    expect(placement.scale).toBe(1.65);
    expect(card.left).toBeGreaterThanOrEqual(208);
    expect(card.top).toBeGreaterThanOrEqual(108);
    expect(card.right).toBeLessThanOrEqual(592);
    expect(card.bottom).toBeLessThanOrEqual(392);
    expect(matrix).toEqual({ a: 1, d: 1, e, f });
  }
});

test('roomy cards keep their natural placement; long cards fit narrow mobile canvases', () => {
  const matrix = { a: 0.7, d: 0.7, e: 400, f: 300 };
  expect(packetGlyphPlacement(box, viewport, matrix, 1.65)).toEqual({
    x: 0,
    y: -22,
    scale: 1.65,
  });
  const mobile = { left: 0, top: 0, width: 276, height: 320 };
  const long = { x: -150, y: -88, width: 300, height: 92 };
  const transform = { a: 0.7, d: 0.7, e: 30, f: 30 };
  const placement = packetGlyphPlacement(long, mobile, transform, 2.1);
  const card = bounds(long, transform, placement);
  expect(placement.scale).toBeGreaterThan(1);
  expect(placement.scale).toBeLessThan(2.1);
  expect(card.left).toBeCloseTo(8);
  expect(card.right).toBeCloseTo(268);
  expect(card.top).toBeCloseTo(8);
  expect(card.bottom).toBeLessThanOrEqual(312);
});

test('camera zoom cannot inflate packet text beyond the screen-size cap', () => {
  for (const zoom of [0.25, 0.6, 1, 1.8, 3]) {
    const fieldPixels = 11 * packetGlyphScreenScale(11, zoom, 1.5, true);
    const titlePixels = 12 * packetGlyphScreenScale(12, zoom, 1.25, false);
    expect(fieldPixels).toBeGreaterThanOrEqual(11);
    expect(fieldPixels).toBeLessThanOrEqual(12);
    expect(titlePixels).toBeGreaterThanOrEqual(12);
    expect(titlePixels).toBeLessThanOrEqual(14);
  }
});

test('cards clear the device area above their anchor when there is canvas space', () => {
  const matrix = { a: 1, d: 1, e: 400, f: 330 };
  const placement = packetGlyphPlacement(box, viewport, matrix, 1.1, { clearance: 60 });
  expect(bounds(box, matrix, placement).bottom).toBeCloseTo(matrix.f - 60);
});
