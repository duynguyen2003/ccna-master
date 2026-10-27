export const routerBasename = new URL(
  process.env.PUBLIC_URL || '/',
  window.location.origin
).pathname.replace(/\/$/, '');

export function legacyLocationPath({ search = '', hash = '' }, basePath = '') {
  if (!hash.startsWith('#/')) return null;
  const route = '/' + hash.slice(1).replace(/^\/+/, '');
  const target = new URL(route, 'https://legacy.invalid');
  const originalQuery = new URLSearchParams(search);
  for (const [key, value] of originalQuery)
    if (!target.searchParams.has(key)) target.searchParams.append(key, value);
  return basePath.replace(/\/$/, '') + target.pathname + target.search + target.hash;
}

export function upgradeLegacyLocation() {
  const target = legacyLocationPath(window.location, routerBasename);
  if (target) window.history.replaceState(window.history.state, '', target);
}
