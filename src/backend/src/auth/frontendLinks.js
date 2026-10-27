function buildResetPasswordUrl(token, frontendUrl = 'http://localhost:3000') {
  const base = new URL(frontendUrl);
  base.hash = '';
  base.search = '';
  base.pathname = base.pathname.replace(/\/$/, '') + '/reset-password/' + encodeURIComponent(token);
  return base.toString();
}

module.exports = { buildResetPasswordUrl };
