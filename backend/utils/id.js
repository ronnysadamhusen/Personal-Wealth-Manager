const crypto = require('crypto');

// Collision-safe IDs (previously Math.random-based strings).
function generateUUID() {
  return crypto.randomUUID();
}

module.exports = { generateUUID };
