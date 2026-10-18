const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'unit-test-secret';
const database = require('../config/database');
let user;
let failure;
mock.method(database, 'getPrisma', () => ({
  user: {
    findUnique: async () => {
      if (failure) throw failure;
      return user;
    },
  },
}));
const { verifyToken, optionalAuth, checkRole } = require('../middleware/auth');
const { createAccessToken } = require('./session');
const { validateRuntime, trustProxy } = require('../config/runtime');

const invoke = async (handler, token) => {
  const req = { headers: token ? { authorization: 'Bearer ' + token } : {}, query: {} };
  const result = { req, status: 200 };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
    },
  };
  await handler(req, res, (error) => {
    result.next = true;
    result.error = error;
  });
  return result;
};
test('middleware uses current DB role and revokes inactive, deleted, stale and legacy tokens', async () => {
  user = { id: 1, role: 'STUDENT', isActive: true, deletedAt: null, sessionVersion: 2 };
  const token = createAccessToken(user);
  let result = await invoke(verifyToken, token);
  assert.equal(result.req.user.role, 'STUDENT');
  const forgedRole = jwt.sign({ id: 1, role: 'ADMIN', sessionVersion: 2 }, process.env.JWT_SECRET);
  result = await invoke(verifyToken, forgedRole);
  assert.equal(result.req.user.role, 'STUDENT');
  let denied;
  checkRole(['ADMIN'])(
    result.req,
    {
      status() {
        return this;
      },
      json() {
        denied = true;
      },
    },
    () => {}
  );
  assert.equal(denied, true);
  for (const change of [{ isActive: false }, { deletedAt: new Date() }, { sessionVersion: 3 }]) {
    const previous = user;
    user = { ...user, ...change };
    assert.equal((await invoke(verifyToken, token)).status, 401);
    assert.equal((await invoke(optionalAuth, token)).req.user, null);
    user = previous;
  }
  assert.equal(
    (await invoke(verifyToken, jwt.sign({ id: 1, role: 'ADMIN' }, process.env.JWT_SECRET))).status,
    401
  );
  user = null;
  assert.equal((await invoke(verifyToken, token)).status, 401);
  failure = new Error('database unavailable');
  assert.equal((await invoke(optionalAuth, token)).error, failure);
  failure = null;
});
test('production requires secrets and proxy trust is explicit', () => {
  assert.throws(() => validateRuntime({ NODE_ENV: 'production' }), /DATABASE_URL/);
  const env = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://db/test',
    JWT_SECRET: 'change-this-secret',
    FRONTEND_URL: 'https://app.test',
    CORS_ORIGIN: 'https://app.test',
  };
  assert.throws(() => validateRuntime(env), /JWT_SECRET/);
  assert.doesNotThrow(() => validateRuntime({ ...env, JWT_SECRET: 'a'.repeat(40) }));
  assert.equal(trustProxy('0'), false);
  assert.equal(trustProxy('1'), 1);
  assert.throws(() => trustProxy('true'));
});
