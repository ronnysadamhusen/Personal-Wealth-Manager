const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();

// Get transaction count per category name
router.get('/api/categories/transaction-counts', async (req, res) => {
  try {
    const rows = await query.all(
      `SELECT category AS name, COUNT(*) AS count FROM transactions WHERE category IS NOT NULL AND category != '' GROUP BY category`
    );
    const counts = {};
    rows.forEach(r => { counts[r.name] = r.count; });
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all custom categories
router.get('/api/categories', async (req, res) => {
  try {
    const list = await query.all('SELECT * FROM categories ORDER BY name ASC');
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a custom category
router.post('/api/categories', async (req, res) => {
  const { name, parent_id = null, type = 'expense', importance = null, urgency = null } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const id = generateUUID();
  try {
    await query.run('INSERT INTO categories (id, name, parent_id, type, importance, urgency) VALUES (?, ?, ?, ?, ?, ?)', [id, name.trim(), parent_id, type, importance, urgency]);
    const created = await query.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, parent_id, importance, urgency } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const newName = name.trim();

  try {
    const existing = await query.get('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    let finalParentId = existing.parent_id;
    if (parent_id !== undefined) {
      finalParentId = (parent_id === null || parent_id === '' || parent_id === 'none') ? null : parent_id;
    }

    if (finalParentId === id) {
      return res.status(400).json({ error: 'A category cannot be its own parent' });
    }

    const oldName = existing.name;
    const finalType = type || existing.type;
    const finalImportance = importance !== undefined ? (importance || null) : existing.importance;
    const finalUrgency    = urgency    !== undefined ? (urgency    || null) : existing.urgency;

    // Start database transaction
    await query.exec('BEGIN TRANSACTION');

    // 1. Update the categories table
    await query.run('UPDATE categories SET name = ?, type = ?, parent_id = ?, importance = ?, urgency = ? WHERE id = ?', [newName, finalType, finalParentId, finalImportance, finalUrgency, id]);

    // 2. Cascade changes to transactions table
    await query.run('UPDATE transactions SET category = ? WHERE category = ?', [newName, oldName]);

    // 3. Cascade changes to budgets table
    await query.run('UPDATE budgets SET category = ? WHERE category = ?', [newName, oldName]);

    // Commit changes
    await query.exec('COMMIT');

    const updated = await query.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a custom category
router.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
