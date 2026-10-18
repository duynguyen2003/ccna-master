import { calculateZigzagPositions, generatePathSegments } from './learningPathGeometry';

describe('learningPathGeometry', () => {
  const sampleCourses = [
    { id: 'c1', title: 'Course 1', status: 'completed' },
    { id: 'c2', title: 'Course 2', status: 'current' },
    { id: 'c3', title: 'Course 3', status: 'locked' },
  ];

  describe('calculateZigzagPositions', () => {
    it('returns empty array when count is 0', () => {
      const result = calculateZigzagPositions({ containerWidth: 1200, courses: [] });
      expect(result.nodes).toEqual([]);
      expect(result.isDesktop).toBe(true);
    });

    it('positions single node at center when count is 1', () => {
      const result = calculateZigzagPositions({
        containerWidth: 1200,
        courses: [{ id: 'c1', title: 'Course 1' }],
      });
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].x).toBe(result.canvasWidth / 2);
      expect(Number.isFinite(result.nodes[0].y)).toBe(true);
      expect(result.nodes[0].labelPlacement).toBeDefined();
    });

    it('alternates Y coordinates on desktop (>= 1024px)', () => {
      const result = calculateZigzagPositions({
        containerWidth: 1200,
        courses: sampleCourses,
      });

      expect(result.isDesktop).toBe(true);
      expect(result.nodes.length).toBe(3);

      const [n0, n1, n2] = result.nodes;

      // X must strictly increase
      expect(n0.x).toBeLessThan(n1.x);
      expect(n1.x).toBeLessThan(n2.x);

      // Even nodes (0, 2) have lower position (greater Y) than odd node (1)
      expect(n0.y).toBe(n2.y);
      expect(n0.y).toBeGreaterThan(n1.y);

      // Label placements are alternating
      expect(n0.labelPlacement).toBe('top');
      expect(n1.labelPlacement).toBe('bottom');
      expect(n2.labelPlacement).toBe('top');

      // No NaN values
      result.nodes.forEach((n) => {
        expect(Number.isFinite(n.x)).toBe(true);
        expect(Number.isFinite(n.y)).toBe(true);
      });
    });

    it('alternates X coordinates on mobile (< 1024px)', () => {
      const result = calculateZigzagPositions({
        containerWidth: 500,
        courses: sampleCourses,
      });

      expect(result.isDesktop).toBe(false);
      expect(result.nodes.length).toBe(3);

      const [n0, n1, n2] = result.nodes;

      // Y must strictly increase vertically
      expect(n0.y).toBeLessThan(n1.y);
      expect(n1.y).toBeLessThan(n2.y);

      // Node 0 and 2 are on left (lower X), Node 1 is on right (higher X)
      expect(n0.x).toBeLessThan(n1.x);
      expect(n2.x).toBeLessThan(n1.x);

      // Label placements: left node -> right, right node -> left
      expect(n0.labelPlacement).toBe('right');
      expect(n1.labelPlacement).toBe('left');
      expect(n2.labelPlacement).toBe('right');
    });

    it('supports explicit horizontal and vertical layout modes', () => {
      const courses = sampleCourses;
      const horizontal = calculateZigzagPositions({
        containerWidth: 375,
        courses,
        layoutMode: 'horizontal',
      });
      const vertical = calculateZigzagPositions({
        containerWidth: 1280,
        courses,
        layoutMode: 'vertical',
      });

      expect(horizontal.isDesktop).toBe(true);
      expect(horizontal.nodes[0].x).not.toBe(horizontal.nodes[1].x);
      expect(vertical.isDesktop).toBe(false);
      expect(vertical.nodes[0].y).not.toBe(vertical.nodes[1].y);
    });

    it('guards narrow mobile (320px) with bottom label placement', () => {
      const result = calculateZigzagPositions({
        containerWidth: 320,
        courses: sampleCourses,
      });

      expect(result.isDesktop).toBe(false);
      result.nodes.forEach((node) => {
        expect(node.labelPlacement).toBe('bottom');
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      });
    });

    it('handles NaN or 0 containerWidth safely without crashing or NaN coordinates', () => {
      const resultNaN = calculateZigzagPositions({
        containerWidth: NaN,
        courses: sampleCourses,
      });
      expect(resultNaN.nodes.length).toBe(3);
      resultNaN.nodes.forEach((node) => {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      });

      const resultZero = calculateZigzagPositions({
        containerWidth: 0,
        courses: sampleCourses,
      });
      expect(resultZero.nodes.length).toBe(3);
      resultZero.nodes.forEach((node) => {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      });
    });

    it('does not mutate input courses array', () => {
      const clone = JSON.parse(JSON.stringify(sampleCourses));
      calculateZigzagPositions({ containerWidth: 1200, courses: sampleCourses });
      expect(sampleCourses).toEqual(clone);
    });
  });

  describe('generatePathSegments', () => {
    it('returns empty array when nodes length < 2', () => {
      expect(generatePathSegments([])).toEqual([]);
      expect(generatePathSegments([{ id: 'c1', x: 100, y: 100 }])).toEqual([]);
    });

    it('generates max(0, n - 1) segments with valid Bezier path strings', () => {
      const layout = calculateZigzagPositions({
        containerWidth: 1200,
        courses: sampleCourses,
      });

      const segments = generatePathSegments(layout.nodes, layout.isDesktop);
      expect(segments.length).toBe(2);

      // Verify path format M x y C cp1x cp1y, cp2x cp2y, x y
      segments.forEach((seg) => {
        expect(seg.pathData).toMatch(/^M \d+ \d+ C [\d.]+ [\d.]+, [\d.]+ [\d.]+, \d+ \d+$/);
      });

      // Segment 1 (to current) should be active
      expect(segments[0].status).toBe('active');
      // Segment 2 (to locked) should be locked
      expect(segments[1].status).toBe('locked');
    });

    it('sets segment status to completed if destination node is completed', () => {
      const coursesAllDone = [
        { id: 'c1', status: 'completed' },
        { id: 'c2', status: 'completed' },
      ];
      const layout = calculateZigzagPositions({
        containerWidth: 1200,
        courses: coursesAllDone,
      });
      const segments = generatePathSegments(layout.nodes, layout.isDesktop);
      expect(segments[0].status).toBe('completed');
    });
  });
});
