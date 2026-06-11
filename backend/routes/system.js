const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();
const fs = require('fs');
const path = require('path');
const { restoreDatabaseFile, dbPath, dbDir } = require('../database');
const { upload } = require('../middleware/upload');
const { DEFAULT_CATEGORIES, subCategoryType } = require('../utils/defaultCategories');

// Download database backup
router.get('/api/system/backup', (req, res) => {
  try {
    res.download(dbPath, `pfm_backup_${new Date().toISOString().split('T')[0]}.sqlite`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore database backup
router.post('/api/system/restore', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a SQLite backup file' });
  }

  // Write uploaded file to a temporary location
  const tempPath = path.join(dbDir, 'temp_restore.sqlite');
  try {
    fs.writeFileSync(tempPath, req.file.buffer);

    // Stop SQLite connection, copy backup database file over active DB, and re-open SQLite
    await restoreDatabaseFile(tempPath);

    // Delete temporary file
    fs.unlinkSync(tempPath);

    res.json({ message: 'Database restored successfully' });
  } catch (error) {
    console.error('Database restore error:', error);
    res.status(500).json({ error: 'Failed to restore database: ' + error.message });
  }
});

// Reset application data to default empty settings
router.post('/api/system/reset', async (req, res) => {
  try {
    await query.exec('BEGIN TRANSACTION');
    
    // Clear all data tables
    await query.run('DELETE FROM transactions');
    await query.run('DELETE FROM accounts');
    await query.run('DELETE FROM budgets');
    await query.run('DELETE FROM installments');
    await query.run('DELETE FROM transfers');
    await query.run('DELETE FROM pdf_passwords');
    await query.run('DELETE FROM categories');
    await query.run('DELETE FROM ai_config');
    await query.run('DELETE FROM import_logs');
    await query.run('DELETE FROM debts_receivables');
    await query.run('DELETE FROM financial_goals');

    // Re-seed default categories
    for (const cat of DEFAULT_CATEGORIES) {
      const parentUuid = generateUUID();
      await query.run('INSERT INTO categories (id, name, parent_id, type) VALUES (?, ?, null, ?)', [parentUuid, cat.name, cat.type]);

      for (const sub of cat.subs) {
        const subUuid = generateUUID();
        await query.run('INSERT INTO categories (id, name, parent_id, type) VALUES (?, ?, ?, ?)', [subUuid, sub, parentUuid, subCategoryType(sub, cat.type)]);
      }
    }

    // Re-seed default AI configuration
    await query.run(
      "INSERT INTO ai_config (id, provider, api_key, model_name, base_url) VALUES ('default', 'gemini', '', 'gemini-1.5-flash', '')"
    );

    await query.exec('COMMIT');
    res.json({ message: 'Application reset successfully to default empty settings.' });
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    console.error('Reset application error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
