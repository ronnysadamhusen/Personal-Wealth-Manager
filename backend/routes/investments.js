const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();

// Get all investments with summary
router.get('/api/investments', async (req, res) => {
  try {
    const investments = await query.all(`
      SELECT i.*, a.name as account_name,
             (SELECT MAX(date) FROM investment_transactions WHERE investment_id = i.id) as last_tx_date
      FROM investments i
      LEFT JOIN accounts a ON i.account_id = a.id
      ORDER BY i.created_at DESC
    `);
    res.json(investments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single investment with transactions
router.get('/api/investments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const investment = await query.get(`
      SELECT i.*, a.name as account_name,
             (SELECT MAX(date) FROM investment_transactions WHERE investment_id = i.id) as last_tx_date
      FROM investments i
      LEFT JOIN accounts a ON i.account_id = a.id
      WHERE i.id = ?
    `, [id]);
    if (!investment) return res.status(404).json({ error: 'Investment not found' });

    const transactions = await query.all(
      'SELECT * FROM investment_transactions WHERE investment_id = ? ORDER BY date DESC',
      [id]
    );
    res.json({ ...investment, transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new investment
router.post('/api/investments', async (req, res) => {
  try {
    const { name, type, platform, currency = 'IDR', unit, current_units = 0, current_price_per_unit = 0, total_invested = 0, account_id, notes, status = 'active' } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });

    const id = generateUUID();
    const current_value = current_units * current_price_per_unit;
    await query.run(
      `INSERT INTO investments (id, name, type, platform, currency, unit, current_units, current_price_per_unit, current_value, total_invested, account_id, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, type, platform || null, currency, unit || null, current_units, current_price_per_unit, current_value, total_invested, account_id || null, notes || null, status]
    );
    const investment = await query.get('SELECT * FROM investments WHERE id = ?', [id]);
    res.status(201).json(investment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an investment (name, platform, notes, status, price update)
router.put('/api/investments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, platform, currency, unit, current_units, current_price_per_unit, total_invested, account_id, notes, status } = req.body;

    const existing = await query.get('SELECT * FROM investments WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Investment not found' });

    const new_units = current_units !== undefined ? current_units : existing.current_units;
    const new_price = current_price_per_unit !== undefined ? current_price_per_unit : existing.current_price_per_unit;

    await query.run(
      `UPDATE investments SET
        name = ?, type = ?, platform = ?, currency = ?, unit = ?,
        current_units = ?, current_price_per_unit = ?, current_value = ?,
        total_invested = ?, account_id = ?, notes = ?, status = ?
       WHERE id = ?`,
      [
        name ?? existing.name,
        type ?? existing.type,
        platform !== undefined ? platform : existing.platform,
        currency ?? existing.currency,
        unit !== undefined ? unit : existing.unit,
        new_units,
        new_price,
        new_units * new_price,
        total_invested !== undefined ? total_invested : existing.total_invested,
        account_id !== undefined ? account_id : existing.account_id,
        notes !== undefined ? notes : existing.notes,
        status ?? existing.status,
        id
      ]
    );
    const updated = await query.get('SELECT * FROM investments WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an investment
router.delete('/api/investments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM investments WHERE id = ?', [id]);
    res.json({ message: 'Investment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a transaction to an investment (buy/sell/dividend/price_update)
router.post('/api/investments/:id/transactions', async (req, res) => {
  try {
    const { id: investment_id } = req.params;
    const { type, date, units = 0, price_per_unit = 0, amount, fee = 0, linked_account_id, notes } = req.body;
    if (!type || !date || amount === undefined) return res.status(400).json({ error: 'type, date, amount are required' });

    const investment = await query.get('SELECT * FROM investments WHERE id = ?', [investment_id]);
    if (!investment) return res.status(404).json({ error: 'Investment not found' });

    const txId = generateUUID();
    await query.run(
      `INSERT INTO investment_transactions (id, investment_id, type, date, units, price_per_unit, amount, fee, linked_account_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [txId, investment_id, type, date, units, price_per_unit, amount, fee, linked_account_id || null, notes || null]
    );

    // Recalculate totals based on transaction type
    let new_units = investment.current_units;
    let new_total_invested = investment.total_invested;

    if (type === 'buy') {
      new_units += Number(units);
      new_total_invested += Number(amount) + Number(fee);
    } else if (type === 'sell') {
      new_units -= Number(units);
      const avg_cost = new_total_invested / (investment.current_units || 1);
      new_total_invested -= avg_cost * Number(units);
      if (new_total_invested < 0) new_total_invested = 0;
    } else if (type === 'price_update') {
      // Only update the price, not units/invested
    }

    const new_price = price_per_unit > 0 ? price_per_unit : investment.current_price_per_unit;
    const new_value = new_units * new_price;

    await query.run(
      'UPDATE investments SET current_units = ?, current_price_per_unit = ?, current_value = ?, total_invested = ? WHERE id = ?',
      [new_units, new_price, new_value, new_total_invested, investment_id]
    );

    // If linked_account_id provided (buy/sell), create a corresponding cash transaction
    if (linked_account_id && (type === 'buy' || type === 'sell')) {
      const cashTxId = generateUUID();
      const cashAmount = type === 'buy' ? -(Number(amount) + Number(fee)) : Number(amount);
      const cashDesc = type === 'buy'
        ? `Beli investasi: ${investment.name}`
        : `Jual investasi: ${investment.name}`;
      await query.run(
        `INSERT INTO transactions (id, account_id, date, description, amount, category, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cashTxId, linked_account_id, date, cashDesc, cashAmount, 'Investasi', notes || null]
      );
      await query.run(
        'UPDATE investment_transactions SET linked_transaction_id = ? WHERE id = ?',
        [cashTxId, txId]
      );
    }

    const updatedInvestment = await query.get('SELECT * FROM investments WHERE id = ?', [investment_id]);
    const tx = await query.get('SELECT * FROM investment_transactions WHERE id = ?', [txId]);
    res.status(201).json({ investment: updatedInvestment, transaction: tx });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all transactions for an investment
router.get('/api/investments/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params;
    const txs = await query.all(
      'SELECT * FROM investment_transactions WHERE investment_id = ? ORDER BY date DESC',
      [id]
    );
    res.json(txs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an investment transaction
router.delete('/api/investments/:id/transactions/:txId', async (req, res) => {
  try {
    const { txId } = req.params;
    await query.run('DELETE FROM investment_transactions WHERE id = ?', [txId]);
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Portfolio summary
router.get('/api/investments/summary/portfolio', async (req, res) => {
  try {
    const investments = await query.all("SELECT * FROM investments WHERE status = 'active'");
    const total_value = investments.reduce((s, i) => s + (i.current_value || 0), 0);
    const total_invested = investments.reduce((s, i) => s + (i.total_invested || 0), 0);
    const unrealized_gain = total_value - total_invested;
    const unrealized_pct = total_invested > 0 ? ((unrealized_gain / total_invested) * 100).toFixed(2) : 0;
    const by_type = investments.reduce((acc, i) => {
      acc[i.type] = (acc[i.type] || 0) + (i.current_value || 0);
      return acc;
    }, {});
    res.json({ total_value, total_invested, unrealized_gain, unrealized_pct, by_type, count: investments.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
