const multer = require('multer');

// In-memory storage: uploaded PDFs / backup files are processed and never
// written to disk unencrypted.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = { upload };
