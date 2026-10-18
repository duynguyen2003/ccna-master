const jwt = require('jsonwebtoken');

const isAccountActive = (user) => Boolean(user && user.isActive && !user.deletedAt);
const createAccessToken = (user) =>
  jwt.sign({ id: user.id, sessionVersion: user.sessionVersion }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });

module.exports = { isAccountActive, createAccessToken };
