const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();

// Get all debts & receivables, along with payment history
router.get('/api/debts-receivables', async (req, res) => {
  try {
    const rows = await query.all('SELECT * FROM debts_receivables ORDER BY date DESC');
    const result = [];
    for (const row of rows) {
      const txs = await query.all('SELECT * FROM transactions WHERE debt_receivable_id = ? ORDER BY date DESC', [row.id]);
      
      // Calculate remaining amount dynamically based on initial loan amount and opposite-sign linked transactions
      const initialAmt = row.amount;
      let repaidAmt = 0;
      for (const tx of txs) {
        if (row.type === 'debt') {
          // Repayments of debts are negative amounts (expenses)
          if (tx.amount < 0) {
            repaidAmt += Math.abs(tx.amount);
          }
        } else {
          // Collections of receivables are positive amounts (income)
          if (tx.amount > 0) {
            repaidAmt += tx.amount;
          }
        }
      }

      const remainingAmount = Math.max(0, initialAmt - repaidAmt);
      const status = remainingAmount < 0.01 ? 'paid' : 'active';

      // Keep DB synchronized
      if (row.remaining_amount !== remainingAmount || row.status !== status) {
        await query.run('UPDATE debts_receivables SET remaining_amount = ?, status = ? WHERE id = ?', [remainingAmount, status, row.id]);
      }

      result.push({
        ...row,
        remaining_amount: remainingAmount,
        status: status,
        payments: txs
      });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new debt/receivable
router.post('/api/debts-receivables', async (req, res) => {
  const { type, person, amount, description, date, due_date = null, account_id = null } = req.body;
  if (!type || !person || !amount || !description || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (type !== 'debt' && type !== 'receivable') {
    return res.status(400).json({ error: 'Type must be debt or receivable' });
  }

  const drId = generateUUID();
  const amtVal = parseFloat(amount) || 0;

  try {
    await query.exec('BEGIN TRANSACTION');

    // Check/create category if not exists
    const categoryName = type === 'debt' ? 'Hutang/Pinjaman' : 'Piutang';
    const catRow = await query.get('SELECT * FROM categories WHERE name = ?', [categoryName]);
    if (!catRow) {
      const catUuid = generateUUID();
      const catType = type === 'debt' ? 'income' : 'expense';
      await query.run('INSERT INTO categories (id, name, parent_id, type) VALUES (?, ?, null, ?)', [catUuid, categoryName, catType]);
    }

    if (account_id) {
      // Verify account exists
      const acc = await query.get('SELECT * FROM accounts WHERE id = ?', [account_id]);
      if (!acc) {
        await query.exec('ROLLBACK').catch(() => {});
        return res.status(400).json({ error: 'Target account not found' });
      }

      const txId = generateUUID();
      const txAmt = type === 'debt' ? amtVal : -amtVal;
      const txDesc = type === 'debt' ? `Pinjaman dari ${person} (${description})` : `Pinjaman ke ${person} (${description})`;

      await query.run(
        'INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category, debt_receivable_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [txId, account_id, date, date, txDesc, txAmt, categoryName, drId]
      );
    }

    await query.run(
      'INSERT INTO debts_receivables (id, type, person, amount, remaining_amount, description, date, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [drId, type, person, amtVal, amtVal, description, date, due_date, 'active']
    );

    await query.exec('COMMIT');

    const created = await query.get('SELECT * FROM debts_receivables WHERE id = ?', [drId]);
    res.status(201).json(created);
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// Pay debt or collect receivable amount
router.post('/api/debts-receivables/:id/pay', async (req, res) => {
  const { id } = req.params;
  const { amount, date, account_id, note = '' } = req.body;
  if (!amount || !date || !account_id) {
    return res.status(400).json({ error: 'Amount, date, and account_id are required' });
  }

  const payAmt = parseFloat(amount) || 0;
  if (payAmt <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0' });
  }

  try {
    await query.exec('BEGIN TRANSACTION');

    const dr = await query.get('SELECT * FROM debts_receivables WHERE id = ?', [id]);
    if (!dr) {
      await query.exec('ROLLBACK').catch(() => {});
      return res.status(404).json({ error: 'Debt/Receivable record not found' });
    }

    if (dr.status === 'paid') {
      await query.exec('ROLLBACK').catch(() => {});
      return res.status(400).json({ error: 'This loan is already fully paid' });
    }

    if (payAmt > dr.remaining_amount + 0.01) {
      await query.exec('ROLLBACK').catch(() => {});
      return res.status(400).json({ error: `Payment amount (${payAmt}) exceeds remaining balance (${dr.remaining_amount})` });
    }

    const newRemaining = Math.max(0, dr.remaining_amount - payAmt);
    const newStatus = newRemaining < 0.01 ? 'paid' : 'active';

    const txId = generateUUID();
    const txAmt = dr.type === 'debt' ? -payAmt : payAmt;
    const txDesc = dr.type === 'debt' 
      ? `Pembayaran Hutang ke ${dr.person}${note ? ' - ' + note : ''}`
      : `Penerimaan Piutang dari ${dr.person}${note ? ' - ' + note : ''}`;
    
    const categoryName = dr.type === 'debt' ? 'Hutang/Pinjaman' : 'Piutang';

    // Check/create category if not exists
    const catRow = await query.get('SELECT * FROM categories WHERE name = ?', [categoryName]);
    if (!catRow) {
      const catUuid = generateUUID();
      const catType = dr.type === 'debt' ? 'expense' : 'income';
      await query.run('INSERT INTO categories (id, name, parent_id, type) VALUES (?, ?, null, ?)', [catUuid, categoryName, catType]);
    }

    await query.run(
      'INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category, debt_receivable_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, account_id, date, date, txDesc, txAmt, categoryName, id]
    );

    await query.run(
      'UPDATE debts_receivables SET remaining_amount = ?, status = ? WHERE id = ?',
      [newRemaining, newStatus, id]
    );

    await query.exec('COMMIT');

    const updated = await query.get('SELECT * FROM debts_receivables WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// Delete debt/receivable record and all associated payments in transactions ledger
router.delete('/api/debts-receivables/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query.exec('BEGIN TRANSACTION');
    
    // Delete associated transactions
    await query.run('DELETE FROM transactions WHERE debt_receivable_id = ?', [id]);
    // Delete the record itself
    await query.run('DELETE FROM debts_receivables WHERE id = ?', [id]);

    await query.exec('COMMIT');
    res.json({ message: 'Debt/Receivable record and associated ledger transactions deleted successfully' });
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
