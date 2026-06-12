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

// Link existing transactions as a transfer (convert suspected transfer tx)
router.post('/api/transfers/link', async (req, res) => {
  const { tx_id, counterpart_id, counterpart_account_id, counterpart_date, description } = req.body;
  if (!tx_id) return res.status(400).json({ error: 'tx_id is required' });

  try {
    const mainTx = await query.get(
      'SELECT t.*, a.name as account_name, a.type as account_type FROM transactions t JOIN accounts a ON t.account_id = a.id WHERE t.id = ?',
      [tx_id]
    );
    if (!mainTx) return res.status(404).json({ error: 'Transaction not found' });

    let counterpartTx = null;
    let balancerTxId = null;

    if (counterpart_id) {
      counterpartTx = await query.get(
        'SELECT t.*, a.type as account_type FROM transactions t JOIN accounts a ON t.account_id = a.id WHERE t.id = ?',
        [counterpart_id]
      );
      if (!counterpartTx) return res.status(404).json({ error: 'Counterpart transaction not found' });
    } else if (counterpart_account_id) {
      // No existing counterpart — auto-create outflow + balancer income in the specified account
      const cDate = counterpart_date || mainTx.date;
      const cAmount = mainTx.amount >= 0 ? -Math.abs(mainTx.amount) : Math.abs(mainTx.amount);
      const cDesc = mainTx.amount >= 0
        ? `Transfer to ${mainTx.account_name}`
        : `Transfer from ${mainTx.account_name}`;

      const newTxId = generateUUID();
      balancerTxId = generateUUID();

      await query.exec('BEGIN TRANSACTION');

      await query.run(
        'INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newTxId, counterpart_account_id, cDate, cDate, cDesc, cAmount, 'Transfers & Salary']
      );

      // Balancer income: neutralises the balance impact so the debit account net = 0
      const balancerDesc = `Balance Adjustment (${cDesc})`;
      await query.run(
        'INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [balancerTxId, counterpart_account_id, cDate, cDate, balancerDesc, Math.abs(mainTx.amount), 'Transfers & Salary']
      );

      await query.exec('COMMIT');

      counterpartTx = await query.get(
        'SELECT t.*, a.type as account_type FROM transactions t JOIN accounts a ON t.account_id = a.id WHERE t.id = ?',
        [newTxId]
      );
    }

    // Determine source (outflow, negative) and destination (inflow, positive)
    const srcTx  = mainTx.amount < 0 ? mainTx        : counterpartTx;
    const destTx = mainTx.amount < 0 ? counterpartTx : mainTx;

    const srcAccountId  = srcTx?.account_id  || mainTx.account_id;
    const destAccountId = destTx?.account_id || mainTx.account_id;
    const amount = Math.abs(mainTx.amount);
    const date   = mainTx.date;
    const desc   = description || mainTx.description;
    const transferId = generateUUID();

    await query.exec('BEGIN TRANSACTION');

    // Update source tx category
    if (srcTx) {
      await query.run(`UPDATE transactions SET category = 'Transfers & Salary' WHERE id = ?`, [srcTx.id]);
    }

    // Update destination tx category
    if (destTx) {
      const destCategory = destTx.account_type === 'credit_card' ? 'Credit Card Payment' : 'Transfers & Salary';
      await query.run(`UPDATE transactions SET category = ? WHERE id = ?`, [destCategory, destTx.id]);
    }

    await query.run(
      `INSERT INTO transfers (id, source_account_id, destination_account_id, amount, fee, date, description, source_transaction_id, destination_transaction_id, fee_transaction_id, balancer_transaction_id)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, NULL, ?)`,
      [transferId, srcAccountId, destAccountId, amount, date, desc, srcTx?.id || null, destTx?.id || null, balancerTxId]
    );

    await query.exec('COMMIT');
    res.status(201).json({ id: transferId, message: 'Transfer linked successfully' });
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
    if (transfer.balancer_transaction_id) {
      await query.run('DELETE FROM transactions WHERE id = ?', [transfer.balancer_transaction_id]);
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
