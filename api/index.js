// Vercel serverless entry point
const app = require('./dist/index.cjs');

module.exports = app.default || app;
