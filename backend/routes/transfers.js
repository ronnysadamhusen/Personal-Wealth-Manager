const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();

// Get all transfers
router.get('/api/transfers', async (req, res) => {
  try {
    const sql = `
      SELECT t.*, 
             a1.name as source_account_name, 
             a2.name as destination_account_name
      FROM transfers t
      JOIN accounts a1 ON t.source_account_id = a1.id
      JOIN accounts a2 ON t.destination_account_id = a2.id
      ORDER BY t.date DESC, t.created_at DESC
    `;
    const transfers = await query.all(sql);
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a transfer
router.post('/api/transfers', async (req, res) => {
  const { source_account_id, destination_account_id, amount, fee = 0, date, description } = req.body;
  if (!source_account_id || !destination_account_id || !amount || !date) {
    return res.status(400).json({ error: 'Required fields: source_account_id, destination_account_id, amount, date' });
  }

  const transferId = generateUUID();
  const sourceTxId = generateUUID();
  const destTxId = generateUUID();
  const feeTxId = fee > 0 ? generateUUID() : null;

  try {
    const srcAcc = await query.get('SELECT name FROM accounts WHERE id = ?', [source_account_id]);
    const destAcc = await query.get('SELECT name, type FROM accounts WHERE id = ?', [destination_account_id]);

    if (!srcAcc || !destAcc) {
      return res.status(404).json({ error: 'Source or destination account not found' });
    }

    await query.exec('BEGIN TRANSACTION');

    // 1. Source Account outflow (negative)
    const srcDesc = `Transfer to ${destAcc.name}${description ? ': ' + description : ''}`;
    await query.run(
      'INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sourceTxId, source_account_id, date, date, srcDesc, -amount, 'Transfers & Salary', description || null]
    );

    // 2. Destination Account inflow (positive)
    const destDesc = `Transfer from ${srcAcc.name}${description ? ': ' + description : ''}`;
    const destCategory = destAcc.type === 'credit_card' ? 'Credit Card Payment' : 'Transfers & Salary';
    await query.run(
      'INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [destTxId, destination_account_id, date, date, destDesc, amount, destCategory, description || null]
    );

    // 3. Fee transaction if fee > 0
    if (fee > 0 && feeTxId) {
      const feeDesc = `Transfer fee for transfer to ${destAcc.name}`;
      await query.run(
        'INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [feeTxId, source_account_id, date, date, feeDesc, -fee, 'Fees & Taxes']
      );
    }

    // 4. Insert transfer link
    await query.run(
      `INSERT INTO transfers (id, source_account_id, destination_account_id, amount, fee, date, description, source_transaction_id, destination_transaction_id, fee_transaction_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [transferId, source_account_id, destination_account_id, amount, fee, date, description || null, sourceTxId, destTxId, feeTxId]
    );

    await query.exec('COMMIT');
    res.status(201).json({ id: transferId, message: 'Transfer processed successfully' });
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// Delete a transfer
router.delete('/api/transfers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const transfer = await query.get('SELECT * FROM transfers WHERE id = ?', [id]);
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    await query.exec('BEGIN TRANSACTION');

    if (transfer.source_transaction_id) {
      await query.run('DELETE FROM transactions WHERE id = ?', [transfer.source_transaction_id]);
    }
    if (transfer.destination_transaction_id) {
      await query.run('DELETE FROM transactions WHERE id = ?', [transfer.destination_transaction_id]);
    }
    if (transfer.fee_transaction_id) {
      await query.run('DELETE FROM transactions WHERE id = ?', [transfer.fee_transaction_id]);
    }

    await query.run('DELETE FROM transfers WHERE id = ?', [id]);

    await query.exec('COMMIT');
    res.json({ message: 'Transfer and associated transactions deleted successfully' });
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
