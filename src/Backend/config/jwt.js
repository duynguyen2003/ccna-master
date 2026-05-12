/**
 * ============================================================
 * FILE: config/jwt.js
 * PURPOSE: JWT (JSON Web Token) configuration
 * SECURITY: Tokens stored in environment variables
 * ============================================================
 */

const JWT_CONFIG = {
  // Access token: short-lived (15 minutes or from .env)
  ACCESS_TOKEN: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  },

  // Refresh token: long-lived (7 days)
  REFRESH_TOKEN: {
    secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, // Fallback to main secret if refresh secret is missing
    expiresIn: '7d'
  }
};

if (!JWT_CONFIG.ACCESS_TOKEN.secret) {
  console.error('FATAL ERROR: JWT_SECRET is not defined.');
  process.exit(1);
}

/**
 * Get JWT secret (access token)
 * @returns {string}
 */
const getJWTSecret = () => JWT_CONFIG.ACCESS_TOKEN.secret;

/**
 * Get JWT refresh secret
 * @returns {string}
 */
const getRefreshSecret = () => JWT_CONFIG.REFRESH_TOKEN.secret;

/**
 * Get JWT expiration time (access token)
 * @returns {string}
 */
const getJWTExpiration = () => JWT_CONFIG.ACCESS_TOKEN.expiresIn;

/**
 * Get refresh token expiration time
 * @returns {string}
 */
const getRefreshExpiration = () => JWT_CONFIG.REFRESH_TOKEN.expiresIn;

module.exports = {
  JWT_CONFIG,
  getJWTSecret,
  getRefreshSecret,
  getJWTExpiration,
  getRefreshExpiration
};
