const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();

// Get all goals
router.get('/api/goals', async (req, res) => {
  try {
    const goals = await query.all('SELECT * FROM financial_goals ORDER BY target_date ASC');
    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new goal
router.post('/api/goals', async (req, res) => {
  const { name, target_amount, current_savings = 0, target_date, recurrence = 'one-time', category = 'general' } = req.body;
  if (!name || target_amount === undefined || !target_date) {
    return res.status(400).json({ error: 'Required fields: name, target_amount, target_date' });
  }

  const id = generateUUID();
  try {
    await query.run(
      'INSERT INTO financial_goals (id, name, target_amount, current_savings, target_date, recurrence, category, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, target_amount, current_savings, target_date, recurrence, category, 'active']
    );
    const createdGoal = await query.get('SELECT * FROM financial_goals WHERE id = ?', [id]);
    res.status(201).json(createdGoal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a goal
router.put('/api/goals/:id', async (req, res) => {
  const { id } = req.params;
  const { name, target_amount, current_savings, target_date, recurrence, category, status } = req.body;

  try {
    const currentGoal = await query.get('SELECT * FROM financial_goals WHERE id = ?', [id]);
    if (!currentGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const updatedName = name !== undefined ? name : currentGoal.name;
    const updatedTargetAmount = target_amount !== undefined ? target_amount : currentGoal.target_amount;
    const updatedSavings = current_savings !== undefined ? current_savings : currentGoal.current_savings;
    const updatedDate = target_date !== undefined ? target_date : currentGoal.target_date;
    const updatedRecurrence = recurrence !== undefined ? recurrence : currentGoal.recurrence;
    const updatedCategory = category !== undefined ? category : currentGoal.category;
    const updatedStatus = status !== undefined ? status : currentGoal.status;

    await query.run(
      `UPDATE financial_goals 
       SET name = ?, target_amount = ?, current_savings = ?, target_date = ?, recurrence = ?, category = ?, status = ?
       WHERE id = ?`,
      [updatedName, updatedTargetAmount, updatedSavings, updatedDate, updatedRecurrence, updatedCategory, updatedStatus, id]
    );

    const updatedGoal = await query.get('SELECT * FROM financial_goals WHERE id = ?', [id]);
    res.json(updatedGoal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a goal
router.delete('/api/goals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM financial_goals WHERE id = ?', [id]);
    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
