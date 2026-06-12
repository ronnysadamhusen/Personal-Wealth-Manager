const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();

// Get all transactions
router.get('/api/transactions', async (req, res) => {
  const { category, start_date, end_date } = req.query;
  try {
    const conditions = [];
    const params = [];

    if (category) {
      conditions.push('t.category = ?');
      params.push(category);
    }
    if (start_date) {
      conditions.push('t.date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('t.date <= ?');
      params.push(end_date);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT t.*, a.name as account_name, a.type as account_type,
        CASE WHEN tr_src.id IS NOT NULL OR tr_dst.id IS NOT NULL THEN 1 ELSE 0 END as is_transfer,
        CASE WHEN tr_src.id IS NOT NULL THEN 'out'
             WHEN tr_dst.id IS NOT NULL THEN 'in'
             ELSE NULL END as transfer_direction,
        CASE WHEN tr_src.id IS NOT NULL THEN a_dst.name
             WHEN tr_dst.id IS NOT NULL THEN a_src.name
             ELSE NULL END as transfer_counterpart_account
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN transfers tr_src ON tr_src.source_transaction_id = t.id
      LEFT JOIN transfers tr_dst ON tr_dst.destination_transaction_id = t.id
      LEFT JOIN accounts a_dst ON a_dst.id = tr_src.destination_account_id
      LEFT JOIN accounts a_src ON a_src.id = tr_dst.source_account_id
      ${where}
      ORDER BY t.date DESC, t.created_at DESC
    `;
    const transactions = await query.all(sql, params);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Detect transactions that look like unlinked transfers
router.get('/api/transactions/transfer-suspects', async (req, res) => {
  try {
    const sql = `
      SELECT t.*, a.name as account_name, a.type as account_type
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.id NOT IN (
        SELECT source_transaction_id      FROM transfers WHERE source_transaction_id IS NOT NULL
        UNION
        SELECT destination_transaction_id FROM transfers WHERE destination_transaction_id IS NOT NULL
      )
      AND (
        t.category IN ('Transfers & Salary', 'Credit Card Payment')
        OR LOWER(t.description) LIKE '%transfer%'
        OR LOWER(t.description) LIKE '% trf %'
        OR LOWER(t.description) LIKE 'trf %'
        OR LOWER(t.description) LIKE '%trsf%'
        OR LOWER(t.description) LIKE '%top up%'
        OR LOWER(t.description) LIKE '%topup%'
        OR LOWER(t.description) LIKE '%top-up%'
      )
      AND EXISTS (
        SELECT 1 FROM transactions t2
        WHERE t2.account_id != t.account_id
          AND ABS(t2.amount) = ABS(t.amount)
          AND t2.date BETWEEN date(t.date, '-2 days') AND date(t.date, '+2 days')
          AND t2.id NOT IN (
            SELECT source_transaction_id      FROM transfers WHERE source_transaction_id IS NOT NULL
            UNION
            SELECT destination_transaction_id FROM transfers WHERE destination_transaction_id IS NOT NULL
          )
      )
      ORDER BY t.date DESC, t.created_at DESC
    `;
    const suspects = await query.all(sql);
    res.json(suspects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find matching counterpart for a suspected transfer
router.get('/api/transactions/transfer-match', async (req, res) => {
  const { amount, date, account_id } = req.query;
  if (!amount || !date) return res.status(400).json({ error: 'amount and date required' });
  try {
    const sql = `
      SELECT t.*, a.name as account_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.account_id != ?
        AND ABS(t.amount) = ABS(?)
        AND t.date BETWEEN date(?, '-2 days') AND date(?, '+2 days')
        AND t.id NOT IN (
          SELECT source_transaction_id      FROM transfers WHERE source_transaction_id IS NOT NULL
          UNION
          SELECT destination_transaction_id FROM transfers WHERE destination_transaction_id IS NOT NULL
        )
      ORDER BY ABS(julianday(t.date) - julianday(?)) ASC
      LIMIT 5
    `;
    const matches = await query.all(sql, [account_id, amount, date, date, date]);
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a transaction
router.post('/api/transactions', async (req, res) => {
  const { account_id, date, booking_date = null, description, amount, category, is_installment = 0, installment_id = null, note = null, location_merchant = null, product_service = null } = req.body;
  if (!account_id || !date || !description || amount === undefined || !category) {
    return res.status(400).json({ error: 'Required fields: account_id, date, description, amount, category' });
  }

  const id = generateUUID();
  const finalBookingDate = booking_date || date;
  try {
    await query.run(
      'INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category, is_installment, installment_id, note, location_merchant, product_service) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, account_id, date, finalBookingDate, description, amount, category, is_installment, installment_id, note, location_merchant, product_service]
    );
    const createdTx = await query.get('SELECT * FROM transactions WHERE id = ?', [id]);
    res.status(201).json(createdTx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk add transactions (from verification grid)
router.post('/api/transactions/bulk', async (req, res) => {
  const { account_id, transactions, file_name, detected_installments = [], credit_limit, billing_cycle_date, due_date } = req.body;
  if (!account_id || !transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ error: 'Account ID and transactions array are required' });
  }

  try {
    const acc = await query.get('SELECT name FROM accounts WHERE id = ?', [account_id]);
    const accountName = acc ? acc.name : 'Unknown Account';

    await query.exec('BEGIN TRANSACTION');

    if (credit_limit) {
      await query.run('UPDATE accounts SET credit_limit = ? WHERE id = ?', [credit_limit, account_id]);
      console.log(`[bulk] Automatically updated credit_limit to ${credit_limit} for account ID ${account_id}`);
    }

    if (billing_cycle_date || due_date) {
      const updates = [];
      const params = [];
      if (billing_cycle_date) {
        updates.push('billing_cycle_date = ?');
        params.push(billing_cycle_date);
      }
      if (due_date) {
        updates.push('due_date = ?');
        params.push(due_date);
      }
      params.push(account_id);
      await query.run(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`, params);
      console.log(`[bulk] Updated cycle/due dates for account ID ${account_id}: billing=${billing_cycle_date}, due=${due_date}`);
    }
    
    for (const tx of transactions) {
      const txId = generateUUID();
      let installmentId = null;

      // If tagged as a new installment in the grid, create the installment record
      if (tx.is_installment && tx.installment_months > 1) {
        installmentId = generateUUID();
        // Since credit card transaction amounts are expenses (negative),
        // we store the positive monthly installment value.
        const monthlyAmount = Math.abs(tx.amount) / tx.installment_months;
        
        await query.run(
          `INSERT INTO installments (id, account_id, description, monthly_amount, total_months, remaining_months, start_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            installmentId,
            account_id,
            tx.description,
            monthlyAmount,
            tx.installment_months,
            tx.installment_months, // initially all months remaining
            tx.date
          ]
        );
      }

      const finalBookingDate = tx.booking_date || tx.date;
      await query.run(
        `INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category, is_installment, installment_id, note, location_merchant, product_service)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          account_id,
          tx.date,
          finalBookingDate,
          tx.description,
          tx.amount,
          tx.category,
          tx.is_installment ? 1 : 0,
          installmentId,
          tx.note || null,
          tx.location_merchant || null,
          tx.product_service || null
        ]
      );
    }

    // -----------------------------------------------------------------------
    // Process auto-detected installment commitments (from 0/N Rp. entries)
    // These are third-party installments (Tokopedia, Traveloka, etc.) where
    // the bank records the full amount as informational but we need to track
    // future monthly payments as committed credit limit reductions.
    // -----------------------------------------------------------------------
    // Determine the reference date: use the latest transaction date in this batch
    // to represent the statement's current timeline.
    let referenceDate = new Date();
    if (transactions && transactions.length > 0) {
      const dates = transactions.map(t => new Date(t.date).getTime()).filter(t => !isNaN(t));
      if (dates.length > 0) {
        referenceDate = new Date(Math.max(...dates));
      }
    }

    for (const inst of detected_installments) {
      // Calculate how many months have passed since the first monthly charge
      const startDate = new Date(inst.start_date);
      const monthsElapsed = Math.max(0,
        (referenceDate.getFullYear() - startDate.getFullYear()) * 12 +
        (referenceDate.getMonth() - startDate.getMonth())
      );
      // remaining = total - months already elapsed (month 01/N is in start_date month)
      const remainingMonths = Math.max(0, inst.total_months - monthsElapsed);

      if (remainingMonths <= 0) {
        console.log(`[bulk] Installment fully paid relative to ${referenceDate.toISOString().split('T')[0]}, skipping: "${inst.description}" (${inst.total_months} months, started ${inst.start_date})`);
        continue;
      }

      // Check for duplicate: same account + similar description + similar monthly_amount
      const existing = await query.get(
        `SELECT id FROM installments 
         WHERE account_id = ? 
           AND LOWER(TRIM(description)) = LOWER(TRIM(?)) 
           AND ABS(monthly_amount - ?) < 10`,
        [account_id, inst.description, inst.monthly_amount]
      );

      if (existing) {
        console.log(`[bulk] Installment already tracked, updating remaining_months to ${remainingMonths} for: "${inst.description}"`);
        await query.run(
          `UPDATE installments 
           SET remaining_months = ? 
           WHERE id = ?`,
          [remainingMonths, existing.id]
        );
        continue;
      }

      const instId = generateUUID();
      await query.run(
        `INSERT INTO installments (id, account_id, description, monthly_amount, total_months, remaining_months, start_date, interest_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [instId, account_id, inst.description, inst.monthly_amount, inst.total_months, remainingMonths, inst.start_date]
      );
      console.log(`[bulk] Auto-created installment: "${inst.description}" remaining ${remainingMonths}/${inst.total_months} months × Rp${inst.monthly_amount.toLocaleString()}`);
    }

    // Save import log history if file name is provided
    if (file_name) {
      const logId = generateUUID();
      await query.run(
        `INSERT INTO import_logs (id, file_name, account_id, account_name, transaction_count)
         VALUES (?, ?, ?, ?, ?)`,
        [logId, file_name, account_id, accountName, transactions.length]
      );
    }

    // Update all existing installments for this account using the referenceDate to handle aging/ending installments
    const existingInstallments = await query.all('SELECT * FROM installments WHERE account_id = ?', [account_id]);
    for (const inst of existingInstallments) {
      const startDate = new Date(inst.start_date);
      const monthsElapsed = Math.max(0,
        (referenceDate.getFullYear() - startDate.getFullYear()) * 12 +
        (referenceDate.getMonth() - startDate.getMonth())
      );
      const remainingMonths = Math.max(0, inst.total_months - monthsElapsed);
      await query.run(
        'UPDATE installments SET remaining_months = ? WHERE id = ?',
        [remainingMonths, inst.id]
      );
      console.log(`[bulk] Updated aging installment "${inst.description}" to remaining_months = ${remainingMonths} based on referenceDate ${referenceDate.toISOString().split('T')[0]}`);
    }

    await query.exec('COMMIT');
    const autoInstallmentsCreated = detected_installments.filter(inst => {
      const startDate = new Date(inst.start_date);
      const monthsElapsed = Math.max(0,
        (referenceDate.getFullYear() - startDate.getFullYear()) * 12 +
        (referenceDate.getMonth() - startDate.getMonth())
      );
      return Math.max(0, inst.total_months - monthsElapsed) > 0;
    }).length;

    res.json({ 
      message: `${transactions.length} transactions processed successfully`,
      auto_installments_created: autoInstallmentsCreated
    });
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});


// Get list of all import history logs
router.get('/api/import/logs', async (req, res) => {
  try {
    const logs = await query.all('SELECT * FROM import_logs ORDER BY imported_at DESC');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a transaction
router.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM transactions WHERE id = ?', [id]);
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete transactions
router.post('/api/transactions/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required and must not be empty' });
  }
  try {
    await query.exec('BEGIN TRANSACTION');
    const placeholders = ids.map(() => '?').join(', ');
    const result = await query.run(
      `DELETE FROM transactions WHERE id IN (${placeholders})`,
      ids
    );
    await query.exec('COMMIT');
    res.json({ message: `${result.changes} transactions deleted successfully`, deleted: result.changes });
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});


// Update a transaction
router.put('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  const { account_id, date, booking_date = null, description, amount, category, note = null, location_merchant = null, product_service = null, debt_receivable_id = null } = req.body;
  if (!account_id || !date || !description || amount === undefined || !category) {
    return res.status(400).json({ error: 'Required fields: account_id, date, description, amount, category' });
  }

  const finalBookingDate = booking_date || date;
  try {
    const existing = await query.get('SELECT id FROM transactions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await query.run(
      `UPDATE transactions 
       SET account_id = ?, date = ?, booking_date = ?, description = ?, amount = ?, category = ?, note = ?, location_merchant = ?, product_service = ?, debt_receivable_id = ? 
       WHERE id = ?`,
      [account_id, date, finalBookingDate, description, amount, category, note, location_merchant, product_service, debt_receivable_id, id]
    );

    const updatedTx = await query.get('SELECT * FROM transactions WHERE id = ?', [id]);
    res.json(updatedTx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Split an existing transaction into multiple transactions
router.post('/api/transactions/:id/split', async (req, res) => {
  const { id } = req.params;
  const { splits } = req.body;
  
  if (!splits || !Array.isArray(splits) || splits.length < 2) {
    return res.status(400).json({ error: 'At least 2 split rows are required' });
  }

  try {
    const parent = await query.get('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!parent) {
      return res.status(404).json({ error: 'Original transaction not found' });
    }

    const parentAbsAmt = Math.abs(parent.amount);
    const splitSum = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

    if (Math.abs(parentAbsAmt - splitSum) > 0.01) {
      return res.status(400).json({ 
        error: `Sum of split amounts (${splitSum}) must equal the original transaction amount (${parentAbsAmt})` 
      });
    }

    const isExpense = parent.amount < 0;

    await query.exec('BEGIN TRANSACTION');

    await query.run('DELETE FROM transactions WHERE id = ?', [id]);

    for (const split of splits) {
      const splitId = generateUUID();
      const splitAmt = parseFloat(split.amount) || 0;
      const finalAmount = isExpense ? -splitAmt : splitAmt;

      await query.run(
        `INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category, is_installment, installment_id, note, location_merchant, product_service)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, null, ?, ?, ?)`,
        [
          splitId,
          parent.account_id,
          parent.date,
          parent.booking_date || parent.date,
          parent.description,
          finalAmount,
          split.category,
          split.note || null,
          split.location_merchant || null,
          split.product_service || null
        ]
      );
    }

    await query.exec('COMMIT');
    res.json({ message: `Successfully split transaction into ${splits.length} records.` });

  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// Bulk update multiple transactions
router.post('/api/transactions/bulk-update', async (req, res) => {
  const { ids, category, location_merchant, product_service } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Transaction IDs are required' });
  }

  try {
    await query.exec('BEGIN TRANSACTION');
    
    const sets = [];
    const params = [];
    
    if (category !== undefined && category !== null) {
      sets.push('category = ?');
      params.push(category);
    }
    if (location_merchant !== undefined) {
      sets.push('location_merchant = ?');
      params.push(location_merchant);
    }
    if (product_service !== undefined) {
      sets.push('product_service = ?');
      params.push(product_service);
    }

    if (sets.length === 0) {
      await query.exec('COMMIT');
      return res.json({ success: true, message: 'No fields to update' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const sql = `UPDATE transactions SET ${sets.join(', ')} WHERE id IN (${placeholders})`;
    const finalParams = [...params, ...ids];

    await query.run(sql, finalParams);
    await query.exec('COMMIT');
    
    res.json({ success: true, updatedCount: ids.length });
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// Check potential duplicates for statement transactions before import
router.post('/api/transactions/check-duplicates', async (req, res) => {
  const { account_id, transactions } = req.body;
  if (!account_id || !transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ error: 'account_id and transactions array are required' });
  }

  try {
    const duplicateIndices = [];
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      // Check if duplicate transaction with same date, amount, and description (case-insensitive and trimmed) exists
      const existing = await query.get(
        `SELECT id FROM transactions 
         WHERE account_id = ? AND date = ? AND amount = ? AND LOWER(TRIM(description)) = LOWER(TRIM(?))`,
        [account_id, tx.date, tx.amount, tx.description]
      );
      if (existing) {
        duplicateIndices.push(i);
      }
    }
    res.json({ duplicateIndices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
