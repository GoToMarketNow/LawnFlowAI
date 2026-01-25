// Vercel serverless entry point
// Simple handler that just imports and exports the Express app

module.exports = require('../dist/index.cjs').default;
