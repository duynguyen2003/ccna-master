// Compatibility entry point for backend callers. The actual contract lives in
// src/shared so the browser form can validate the same shapes before submit.
module.exports = require('../../shared/cliLabSchema');
