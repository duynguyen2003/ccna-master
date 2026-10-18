const validateRuntime = (env = process.env) => {
  if (env.NODE_ENV !== 'production') return;
  for (const key of ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL', 'CORS_ORIGIN']) {
    if (!env[key]?.trim()) throw new Error(`${key} is required in production`);
  }
  if (env.JWT_SECRET.length < 32 || /your_|change-this|placeholder/i.test(env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a unique secret with at least 32 characters');
  }
};

const trustProxy = (value) => {
  if (!value || value === '0' || value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true')
    throw new Error('TRUST_PROXY must name trusted IP ranges or an exact hop count');
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};
module.exports = { validateRuntime, trustProxy };
