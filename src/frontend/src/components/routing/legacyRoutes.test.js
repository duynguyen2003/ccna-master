import { legacyLocationPath } from './legacyRoutes';

test('preserves old route links and their query without rewriting ordinary anchors', () => {
  expect(legacyLocationPath({ pathname: '/', hash: '#/lesson?course=1&lesson=12' })).toBe(
    '/lesson?course=1&lesson=12'
  );
  expect(legacyLocationPath({ hash: '#/reset-password/synthetic' })).toBe(
    '/reset-password/synthetic'
  );
  expect(legacyLocationPath({ pathname: '/tools/subnet', hash: '#/profile' })).toBe('/profile');
  expect(legacyLocationPath({ hash: '#/profile' }, '/ccna')).toBe('/ccna/profile');
  expect(legacyLocationPath({ hash: '#main-content' })).toBeNull();
  expect(legacyLocationPath({ hash: '#//example.invalid/path' })).toBe('/example.invalid/path');
  expect(
    legacyLocationPath({ search: '?from=email&course=old', hash: '#/lesson?course=1&lesson=12' })
  ).toBe('/lesson?course=1&lesson=12&from=email');
});
