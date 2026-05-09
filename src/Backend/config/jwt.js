/**
 * ============================================================
 * FILE: config/jwt.js
 * PURPOSE: JWT (JSON Web Token) configuration
 * SECURITY: Tokens stored in environment variables
 * ============================================================
 */

const JWT_CONFIG = {
  // Access token: short-lived (15 minutes)
  ACCESS_TOKEN: {
    secret: process.env.JWT_SECRET || 'netmastery_secret_key_2026',
    expiresIn: '15m'
  },

  // Refresh token: long-lived (7 days)
  REFRESH_TOKEN: {
    secret: process.env.JWT_REFRESH_SECRET || 'netmastery_refresh_2026',
    expiresIn: '7d'
  }
};

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
