const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();

// Get all installments
router.get('/api/installments', async (req, res) => {
  try {
    const list = await query.all(`
      SELECT i.*, a.name as card_name
      FROM installments i
      JOIN accounts a ON i.account_id = a.id
      ORDER BY i.start_date DESC
    `);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create installment manually
router.post('/api/installments', async (req, res) => {
  const { account_id, description, monthly_amount, total_months, start_date, interest_rate = 0, merchant_name = null, product_name = null } = req.body;
  if (!account_id || !description || !monthly_amount || !total_months || !start_date) {
    return res.status(400).json({ error: 'Required fields: account_id, description, monthly_amount, total_months, start_date' });
  }

  const id = generateUUID();
  try {
    await query.run(
      `INSERT INTO installments (id, account_id, description, monthly_amount, total_months, remaining_months, start_date, interest_rate, merchant_name, product_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, account_id, description, monthly_amount, total_months, total_months, start_date, interest_rate, merchant_name, product_name]
    );
    const created = await query.get('SELECT * FROM installments WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete/payoff an installment
router.delete('/api/installments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM installments WHERE id = ?', [id]);
    res.json({ message: 'Installment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update installment remaining months (e.g. when monthly cycle ticks)
router.post('/api/installments/:id/tick', async (req, res) => {
  try {
    const { id } = req.params;
    const inst = await query.get('SELECT * FROM installments WHERE id = ?', [id]);
    if (!inst) return res.status(404).json({ error: 'Installment not found' });
    
    const newRemaining = Math.max(0, inst.remaining_months - 1);
    await query.run('UPDATE installments SET remaining_months = ? WHERE id = ?', [newRemaining, id]);
    res.json({ ...inst, remaining_months: newRemaining });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Amortization projection showing when card will be debt free
router.get('/api/credit-cards/projection', async (req, res) => {
  try {
    // Get all credit cards
    const cards = await query.all("SELECT * FROM accounts WHERE type = 'credit_card'");
    const projection = [];

    for (const card of cards) {
      // Get all active installments for this card
      const list = await query.all('SELECT * FROM installments WHERE account_id = ? AND remaining_months > 0', [card.id]);
      
      // We will project over the next 36 months
      const monthlyProjections = [];
      const totalOutstanding = list.reduce((sum, item) => sum + (item.monthly_amount * item.remaining_months), 0);
      
      let monthsToDebtFree = 0;
      
      for (let m = 0; m < 36; m++) {
        let monthlyTotal = 0;
        let activeItems = 0;
        
        list.forEach(item => {
          if (m < item.remaining_months) {
            monthlyTotal += item.monthly_amount * (1 + (item.interest_rate / 100));
            activeItems++;
          }
        });

        if (activeItems > 0) {
          monthsToDebtFree = m + 1;
        }

        // Only push months that actually have active installments, or the first 12 months for consistency
        if (m < 12 || activeItems > 0) {
          const date = new Date();
          date.setMonth(date.getMonth() + m);
          const label = date.toLocaleString('default', { month: 'short', year: 'numeric' });
          monthlyProjections.push({
            monthIndex: m,
            label,
            payment: monthlyTotal,
            activeCount: activeItems
          });
        }
      }

      projection.push({
        card_id: card.id,
        card_name: card.name,
        credit_limit: card.credit_limit,
        outstanding_installment_debt: totalOutstanding,
        months_to_debt_free: monthsToDebtFree,
        monthly_schedule: monthlyProjections
      });
    }

    res.json(projection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
