// Node-backed web API setup for Jest's older jsdom; never imported by the app.
const { TextDecoder, TextEncoder } = require('node:util');

module.exports = { TextDecoder, TextEncoder };
