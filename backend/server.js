const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { query, restoreDatabaseFile } = require('./database');
const { parseStatement } = require('./pdfParser');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files (will compile frontend to standard output folder in Docker)
app.use(express.static(require('path').join(__dirname, 'public')));

// Configure Multer in-memory storage for PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper for generating UUIDs
function generateUUID() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// -------------------------------------------------------------------
// 1. ACCOUNTS ENDPOINTS
// -------------------------------------------------------------------

// Get all bank accounts and credit cards, including calculated current balance
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await query.all('SELECT * FROM accounts');
    
    // Calculate actual balances: initial balance + sum of transaction amounts
    const accountDetails = [];
    for (const account of accounts) {
      const txSumRow = await query.get(
        'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ?',
        [account.id]
      );
      
      let currentBalance = 0;
      if (account.type === 'bank' || account.type === 'cash') {
        currentBalance = account.balance + txSumRow.total;
      } else {
        // Credit Card balance: transactions represent charges (negative) and payments (positive)
        // Usually, negative balance means you have outstanding charges.
        // Let's return balance as the sum of transactions.
        currentBalance = txSumRow.total;
      }

      // If it's a credit card, also calculate remaining installments
      // Subtract 1 from remaining_months to avoid double-counting the current billed month 
      // (which is already included in current_balance as a transaction).
      let totalInstallmentsDebt = 0;
      if (account.type === 'credit_card') {
        const instSumRow = await query.get(
          'SELECT SUM(monthly_amount * MAX(0, remaining_months - 1)) as totalDebt FROM installments WHERE account_id = ?',
          [account.id]
        );
        totalInstallmentsDebt = instSumRow.totalDebt || 0;
      }

      accountDetails.push({
        ...account,
        current_balance: currentBalance,
        installment_debt: totalInstallmentsDebt
      });
    }

    res.json(accountDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new account
app.post('/api/accounts', async (req, res) => {
  const { name, type, balance = 0, credit_limit = null, billing_cycle_date = null, due_date = null } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  const id = generateUUID();
  try {
    await query.run(
      'INSERT INTO accounts (id, name, type, balance, credit_limit, billing_cycle_date, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, type, balance, credit_limit, billing_cycle_date, due_date]
    );
    const createdAccount = await query.get('SELECT * FROM accounts WHERE id = ?', [id]);
    res.status(201).json(createdAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an account
app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM accounts WHERE id = ?', [id]);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------------
// 2. TRANSACTIONS ENDPOINTS
// -------------------------------------------------------------------

// Get all transactions
app.get('/api/transactions', async (req, res) => {
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
      SELECT t.*, a.name as account_name, a.type as account_type
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      ${where}
      ORDER BY t.date DESC, t.created_at DESC
    `;
    const transactions = await query.all(sql, params);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a transaction
app.post('/api/transactions', async (req, res) => {
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
app.post('/api/transactions/bulk', async (req, res) => {
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
    await query.exec('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});


// Get list of all import history logs
app.get('/api/import/logs', async (req, res) => {
  try {
    const logs = await query.all('SELECT * FROM import_logs ORDER BY imported_at DESC');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM transactions WHERE id = ?', [id]);
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete transactions
app.post('/api/transactions/bulk-delete', async (req, res) => {
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
    await query.exec('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});


// Update a transaction
app.put('/api/transactions/:id', async (req, res) => {
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
app.post('/api/transactions/:id/split', async (req, res) => {
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
    await query.exec('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// Bulk update multiple transactions
app.post('/api/transactions/bulk-update', async (req, res) => {
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
    await query.exec('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// Check potential duplicates for statement transactions before import
app.post('/api/transactions/check-duplicates', async (req, res) => {
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


// -------------------------------------------------------------------
// 2.5. TRANSFERS ENDPOINTS
// -------------------------------------------------------------------

// Get all transfers
app.get('/api/transfers', async (req, res) => {
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
app.post('/api/transfers', async (req, res) => {
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
    await query.exec('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// Delete a transfer
app.delete('/api/transfers/:id', async (req, res) => {
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
    await query.exec('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------------
// 3. BUDGETS ENDPOINTS
// -------------------------------------------------------------------

// Get budgets summary for a specific period (monthly, quarterly, semesterly, or yearly)
app.get('/api/budgets', async (req, res) => {
  const { period = 'monthly', month_year, year, start_year, end_year } = req.query; 

  try {
    let monthList = [];

    if (period === 'yearly') {
      const sYr = start_year ? parseInt(start_year) : new Date().getFullYear();
      const eYr = end_year ? parseInt(end_year) : sYr;
      for (let y = sYr; y <= eYr; y++) {
        for (let m = 1; m <= 12; m++) {
          monthList.push(`${y}-${String(m).padStart(2, '0')}`);
        }
      }
    } else {
      const activeYear = year ? parseInt(year) : new Date().getFullYear();
      if (period === 'monthly') {
        const month = month_year ? parseInt(month_year.split('-')[1] || month_year) : (new Date().getMonth() + 1);
        monthList.push(`${activeYear}-${String(month).padStart(2, '0')}`);
      } else if (period === 'quarterly') {
        const month = month_year ? parseInt(month_year.split('-')[1] || month_year) : (new Date().getMonth() + 1);
        const q = Math.ceil(month / 3);
        const startMonth = (q - 1) * 3 + 1;
        const endMonth = q * 3;
        for (let m = startMonth; m <= endMonth; m++) {
          monthList.push(`${activeYear}-${String(m).padStart(2, '0')}`);
        }
      } else if (period === 'semesterly') {
        const month = month_year ? parseInt(month_year.split('-')[1] || month_year) : (new Date().getMonth() + 1);
        const s = Math.ceil(month / 6);
        const startMonth = (s - 1) * 6 + 1;
        const endMonth = s * 6;
        for (let m = startMonth; m <= endMonth; m++) {
          monthList.push(`${activeYear}-${String(m).padStart(2, '0')}`);
        }
      }
    }

    if (monthList.length === 0) {
      return res.json([]);
    }

    // Prepare SQL placeholder
    const placeholders = monthList.map(() => '?').join(',');

    // Fetch budget aggregates grouped by category for target months
    const sqlBudgets = `
      SELECT MAX(id) as id, category, SUM(amount) as amount, MAX(recurrence) as recurrence, MAX(recurrence_day) as recurrence_day, MAX(start_date) as start_date, MAX(end_date) as end_date
      FROM budgets
      WHERE month_year IN (${placeholders})
      GROUP BY category
    `;
    const budgets = await query.all(sqlBudgets, monthList);

    // Get categories to determine type (income vs expense) and parent-child relationships
    const dbCategories = await query.all('SELECT id, name, type, parent_id FROM categories');
    const categoryTypeMap = {};
    const childrenMap = {}; // parentName -> [childName, ...]
    dbCategories.forEach(c => {
      categoryTypeMap[c.name] = c.type;
    });
    dbCategories.forEach(c => {
      if (c.parent_id) {
        const parent = dbCategories.find(p => p.id === c.parent_id);
        if (parent) {
          if (!childrenMap[parent.name]) childrenMap[parent.name] = [];
          childrenMap[parent.name].push(c.name);
        }
      }
    });

    // We fetch matching transactions for all months in the target period
    const transactionMonthPatterns = monthList.map(m => `${m}-%`);
    const transactionMonthPlaceholders = monthList.map(() => 'date LIKE ?').join(' OR ');

    // Get actual expense aggregates per category (exact category name)
    const sqlExpenses = `
      SELECT category, SUM(-amount) as spent
      FROM transactions
      WHERE (${transactionMonthPlaceholders}) AND amount < 0
      GROUP BY category
    `;
    const expenses = await query.all(sqlExpenses, transactionMonthPatterns);

    // Get actual income aggregates per category (exact category name)
    const sqlIncome = `
      SELECT category, SUM(amount) as received
      FROM transactions
      WHERE (${transactionMonthPlaceholders}) AND amount > 0
      GROUP BY category
    `;
    const income = await query.all(sqlIncome, transactionMonthPatterns);

    // Maps keyed by exact category name
    const expenseMap = {};
    expenses.forEach(e => { expenseMap[e.category] = e.spent; });

    const incomeMap = {};
    income.forEach(i => { incomeMap[i.category] = i.received; });

    // Helper: sum a map for a category AND all its sub-categories
    const sumWithChildren = (map, categoryName) => {
      const cats = [categoryName, ...(childrenMap[categoryName] || [])];
      return cats.reduce((total, cat) => total + (map[cat] || 0), 0);
    };

    const budgetSummary = budgets.map(b => {
      const catType = categoryTypeMap[b.category] || 'expense';
      const isIncome = catType === 'income';
      return {
        ...b,
        type: catType,
        spent: isIncome ? sumWithChildren(incomeMap, b.category) : sumWithChildren(expenseMap, b.category)
      };
    });

    res.json(budgetSummary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to expand dates between start_date and end_date into month list
function getMonthsInRange(startDateStr, endDateStr) {
  const months = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [];
  }
  
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  const finalLimit = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= finalLimit) {
    const yStr = current.getFullYear();
    const mStr = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${yStr}-${mStr}`);
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

// Create/Update a budget (supports start_date, end_date range, recurrence frequency and interval day/date)
app.post('/api/budgets', async (req, res) => {
  const { category, amount, month_year, start_date, end_date, recurrence, recurrence_day } = req.body;
  if (!category || amount === undefined) {
    return res.status(400).json({ error: 'Required: category, amount' });
  }

  try {
    let targetMonths = [];
    const recType = recurrence || 'none';
    const recDay = recurrence_day !== undefined ? parseInt(recurrence_day) : null;

    if (start_date && end_date) {
      targetMonths = getMonthsInRange(start_date, end_date);
    } else if (month_year) {
      targetMonths = [month_year];
    } else {
      // Default to current month if nothing provided
      const d = new Date();
      targetMonths = [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`];
    }

    if (targetMonths.length === 0) {
      return res.status(400).json({ error: 'Range tanggal start_date dan end_date tidak valid.' });
    }

    const refMonthYear = targetMonths[0];

    await query.exec('BEGIN TRANSACTION');
    
    for (const mStr of targetMonths) {
      const id = generateUUID();
      await query.run(
        `INSERT INTO budgets (id, category, amount, month_year, start_date, end_date, recurrence, recurrence_day)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(category, month_year)
         DO UPDATE SET 
            amount = excluded.amount,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            recurrence = excluded.recurrence,
            recurrence_day = excluded.recurrence_day`,
        [id, category, amount, mStr, start_date || null, end_date || null, recType, recDay]
      );
    }

    await query.exec('COMMIT');

    const saved = await query.get('SELECT * FROM budgets WHERE category = ? AND month_year = ?', [category, refMonthYear]);
    res.json(saved);
  } catch (error) {
    await query.exec('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// Update an existing budget (allows editing category, amount, range, recurrence, and interval day)
app.put('/api/budgets/:id', async (req, res) => {
  const { id } = req.params;
  const { category, amount, start_date, end_date, recurrence, recurrence_day } = req.body;
  if (!category || amount === undefined) {
    return res.status(400).json({ error: 'category and amount are required' });
  }

  try {
    const existing = await query.get('SELECT * FROM budgets WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const recType = recurrence || 'none';
    const recDay = recurrence_day !== undefined ? parseInt(recurrence_day) : null;

    let targetMonths = [];
    if (start_date && end_date) {
      targetMonths = getMonthsInRange(start_date, end_date);
    } else {
      targetMonths = [existing.month_year];
    }

    if (targetMonths.length === 0) {
      return res.status(400).json({ error: 'Range tanggal start_date dan end_date tidak valid.' });
    }

    await query.exec('BEGIN TRANSACTION');

    // First delete matching budgets of this category in target months to prevent constraints violation
    for (const mStr of targetMonths) {
      const duplicate = await query.get(
        'SELECT * FROM budgets WHERE category = ? AND month_year = ? AND id != ?',
        [category, mStr, id]
      );
      if (duplicate) {
        // If another budget with same category exists in target month, delete it so we can overwrite/update it clean
        await query.run('DELETE FROM budgets WHERE id = ?', [duplicate.id]);
      }
    }

    // Now update existing or insert new ones
    for (const mStr of targetMonths) {
      // If it is the current edited month_year, update this specific ID
      if (mStr === existing.month_year) {
        await query.run(
          `UPDATE budgets SET 
            category = ?, 
            amount = ?, 
            start_date = ?, 
            end_date = ?, 
            recurrence = ?, 
            recurrence_day = ? 
           WHERE id = ?`,
          [category, amount, start_date || null, end_date || null, recType, recDay, id]
        );
      } else {
        // Else upsert/insert for other months in range
        const newId = generateUUID();
        await query.run(
          `INSERT INTO budgets (id, category, amount, month_year, start_date, end_date, recurrence, recurrence_day)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(category, month_year)
           DO UPDATE SET 
              amount = excluded.amount,
              start_date = excluded.start_date,
              end_date = excluded.end_date,
              recurrence = excluded.recurrence,
              recurrence_day = excluded.recurrence_day`,
          [newId, category, amount, mStr, start_date || null, end_date || null, recType, recDay]
        );
      }
    }

    await query.exec('COMMIT');

    const updated = await query.get('SELECT * FROM budgets WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    await query.exec('ROLLBACK');
    res.status(400).json({ error: error.message });
  }
});

// Delete a budget
app.delete('/api/budgets/:id', async (req, res) => {
  const { id } = req.params;
  const { period = 'monthly', month_year } = req.query; // optional context to delete from range
  try {
    const existing = await query.get('SELECT * FROM budgets WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    if (month_year) {
      const [yearStr, monthStr] = month_year.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr); // 1-12

      let startMonth = month;
      let endMonth = month;

      if (period === 'quarterly') {
        const q = Math.ceil(month / 3);
        startMonth = (q - 1) * 3 + 1;
        endMonth = q * 3;
      } else if (period === 'semesterly') {
        const s = Math.ceil(month / 6);
        startMonth = (s - 1) * 6 + 1;
        endMonth = s * 6;
      } else if (period === 'yearly') {
        startMonth = 1;
        endMonth = 12;
      }

      const monthList = [];
      for (let m = startMonth; m <= endMonth; m++) {
        monthList.push(`${year}-${String(m).padStart(2, '0')}`);
      }

      const placeholders = monthList.map(() => '?').join(',');
      await query.run(
        `DELETE FROM budgets WHERE category = ? AND month_year IN (${placeholders})`,
        [existing.category, ...monthList]
      );
    } else {
      // Fallback: Delete all budgets of this category
      await query.run('DELETE FROM budgets WHERE category = ?', [existing.category]);
    }
    
    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------------
// 4. INSTALLMENT & CC PROJECTION ENDPOINTS
// -------------------------------------------------------------------

// Get all installments
app.get('/api/installments', async (req, res) => {
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
app.post('/api/installments', async (req, res) => {
  const { account_id, description, monthly_amount, total_months, start_date, interest_rate = 0 } = req.body;
  if (!account_id || !description || !monthly_amount || !total_months || !start_date) {
    return res.status(400).json({ error: 'Required fields: account_id, description, monthly_amount, total_months, start_date' });
  }

  const id = generateUUID();
  try {
    await query.run(
      `INSERT INTO installments (id, account_id, description, monthly_amount, total_months, remaining_months, start_date, interest_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, account_id, description, monthly_amount, total_months, total_months, start_date, interest_rate]
    );
    const created = await query.get('SELECT * FROM installments WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete/payoff an installment
app.delete('/api/installments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM installments WHERE id = ?', [id]);
    res.json({ message: 'Installment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update installment remaining months (e.g. when monthly cycle ticks)
app.post('/api/installments/:id/tick', async (req, res) => {
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
app.get('/api/credit-cards/projection', async (req, res) => {
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

// -------------------------------------------------------------------
// 4.5. CATEGORY MANAGEMENT ENDPOINTS
// -------------------------------------------------------------------

// Get all custom categories
app.get('/api/categories', async (req, res) => {
  try {
    const list = await query.all('SELECT * FROM categories ORDER BY name ASC');
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a custom category
app.post('/api/categories', async (req, res) => {
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

app.put('/api/categories/:id', async (req, res) => {
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
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------------
// 5. PDF STATEMENT EXTRACTION & PASSWORD ENDPOINTS
// -------------------------------------------------------------------

// Get saved passwords
app.get('/api/pdf/passwords', async (req, res) => {
  try {
    const list = await query.all('SELECT * FROM pdf_passwords');
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set/Update PDF password
app.post('/api/pdf/passwords', async (req, res) => {
  const { bank_name, password } = req.body;
  if (!bank_name || !password) {
    return res.status(400).json({ error: 'bank_name and password are required' });
  }

  const id = generateUUID();
  try {
    await query.run(
      `INSERT INTO pdf_passwords (id, bank_name, password)
       VALUES (?, ?, ?)
       ON CONFLICT(bank_name)
       DO UPDATE SET password = excluded.password`,
      [id, bank_name, password]
    );
    res.json({ message: `Password for ${bank_name} saved` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-learn and categorize statement transactions using past transaction history
async function autoCategorizeTransactions(transactions) {
  if (!transactions || !Array.isArray(transactions)) return;
  for (const tx of transactions) {
    const desc = (tx.description || '').trim();
    if (!desc) continue;

    // 1. Try exact match (case-insensitive and trimmed)
    let match = await query.get(
      'SELECT category FROM transactions WHERE LOWER(TRIM(description)) = LOWER(TRIM(?)) ORDER BY date DESC, created_at DESC LIMIT 1',
      [desc]
    );

    // 2. If no exact match, try prefix match (first 12 characters)
    if (!match && desc.length >= 6) {
      const prefix = desc.substring(0, 12);
      match = await query.get(
        'SELECT category FROM transactions WHERE description LIKE ? ORDER BY date DESC, created_at DESC LIMIT 1',
        [`${prefix}%`]
      );
    }

    // 3. If no prefix match, try matching first 2 words
    if (!match) {
      const words = desc.split(/\s+/).filter(w => w.length > 2);
      if (words.length >= 2) {
        const searchPattern = `%${words[0]}%${words[1]}%`;
        match = await query.get(
          'SELECT category FROM transactions WHERE description LIKE ? ORDER BY date DESC, created_at DESC LIMIT 1',
          [searchPattern]
        );
      }
    }

    if (match && match.category) {
      tx.category = match.category;
    }
  }
}

// Parse PDF statement
app.post('/api/pdf/parse', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a PDF file' });
  }

  const { password: userPassword, bank_hint = '' } = req.body;
  
  try {
    let parseResult = null;
    let passwordUsed = userPassword || '';
    
    // If no password provided, look up in database using bank_hint
    if (!passwordUsed && bank_hint) {
      const savedPass = await query.get('SELECT password FROM pdf_passwords WHERE bank_name = ?', [bank_hint]);
      if (savedPass) {
        passwordUsed = savedPass.password;
      }
    }

    // Attempt to parse PDF
    try {
      parseResult = await parseStatement(req.file.buffer, passwordUsed);
    } catch (parseError) {
      // If error is password required/incorrect and we haven't tried saved passwords yet,
      // check if any other saved password works (try all saved passwords as a fallback)
      if (parseError.message === 'PASSWORD_REQUIRED_OR_INCORRECT') {
        const allPasswords = await query.all('SELECT password FROM pdf_passwords');
        let success = false;
        
        for (const entry of allPasswords) {
          if (entry.password === passwordUsed) continue; // skip the one we already tried
          
          try {
            parseResult = await parseStatement(req.file.buffer, entry.password);
            passwordUsed = entry.password;
            success = true;
            break;
          } catch (e) {
            // keep trying
          }
        }
        
        if (!success) {
          throw parseError; // rethrow password error
        }
      } else {
        throw parseError;
      }
    }

    // Automatically categorize imported transactions using past entries
    if (parseResult && parseResult.transactions) {
      await autoCategorizeTransactions(parseResult.transactions);
    }

    // Add info on password used
    res.json({
      ...parseResult,
      password_validated: passwordUsed ? true : false
    });

  } catch (error) {
    if (error.message === 'PASSWORD_REQUIRED_OR_INCORRECT') {
      res.status(401).json({
        error: 'PASSWORD_REQUIRED',
        message: 'This PDF is encrypted. Please provide a password.'
      });
    } else {
      res.status(500).json({
        error: 'PARSING_ERROR',
        message: 'Could not parse the PDF file format: ' + error.message
      });
    }
  }
});

// -------------------------------------------------------------------
// 6. AI FINANCIAL ADVISOR ENDPOINTS
// -------------------------------------------------------------------

// Get current AI Configuration
app.get('/api/ai/config', async (req, res) => {
  try {
    const config = await query.get("SELECT * FROM ai_config WHERE id = 'default'");
    res.json(config || { provider: 'gemini', api_key: '', model_name: 'gemini-1.5-flash', base_url: '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update AI Configuration
app.post('/api/ai/config', async (req, res) => {
  const { provider, api_key = '', model_name = '', base_url = '' } = req.body;
  if (!provider) {
    return res.status(400).json({ error: 'provider is required' });
  }
  try {
    await query.run(
      `INSERT INTO ai_config (id, provider, api_key, model_name, base_url)
       VALUES ('default', ?, ?, ?, ?)
       ON CONFLICT(id)
       DO UPDATE SET provider=excluded.provider, api_key=excluded.api_key, model_name=excluded.model_name, base_url=excluded.base_url`,
      [provider, api_key, model_name, base_url]
    );
    const updated = await query.get("SELECT * FROM ai_config WHERE id = 'default'");
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate AI Financial Review Report
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const config = await query.get("SELECT * FROM ai_config WHERE id = 'default'");
    if (!config) {
      return res.status(400).json({ error: 'AI is not configured. Please save settings in the Advisor tab.' });
    }

    // Fetch accounts
    const accounts = await query.all('SELECT * FROM accounts');
    const accountDetails = [];
    for (const acc of accounts) {
      const txSum = await query.get('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ?', [acc.id]);
      const bal = acc.type === 'bank' ? acc.balance + txSum.total : txSum.total;
      accountDetails.push({ name: acc.name, type: acc.type, balance: bal, limit: acc.credit_limit || 0 });
    }

    // Fetch budgets
    const budgets = await query.all('SELECT * FROM budgets');
    const budgetDetails = [];
    for (const b of budgets) {
      const expSum = await query.get('SELECT COALESCE(SUM(-amount), 0) as total FROM transactions WHERE category = ? AND date LIKE ? AND amount < 0', [b.category, `${b.month_year}-%`]);
      budgetDetails.push({ category: b.category, limit: b.amount, spent: expSum.total, month: b.month_year });
    }

    // Fetch active CC installments
    const installments = await query.all('SELECT * FROM installments WHERE remaining_months > 0');

    // Fetch recent transaction logs (last 50)
    const recentTx = await query.all(`
      SELECT t.*, a.name as account_name 
      FROM transactions t 
      JOIN accounts a ON t.account_id = a.id 
      ORDER BY t.date DESC, t.created_at DESC 
      LIMIT 50
    `);

    // Construct Context Prompt
    const prompt = `Kamu adalah Asisten Perencana Keuangan AI yang handal. Berikan analisis kesehatan keuangan mendalam dan rekomendasi taktis dalam Bahasa Indonesia.
Berikut adalah data keuangan pengguna saat ini:

### DAFTAR AKUN & REKENING:
${accountDetails.map(a => `- ${a.name} (${a.type === 'bank' ? 'Tabungan' : 'Kartu Kredit'}): Saldo ${a.balance >= 0 ? '' : '-'}${Math.abs(a.balance)} IDR${a.type === 'credit_card' ? ` (Limit: ${a.limit} IDR)` : ''}`).join('\n')}

### ANGGARAN BULANAN (BUDGETS):
${budgetDetails.map(b => `- Kategori "${b.category}" (${b.month}): Terpakai ${b.spent} IDR dari limit ${b.limit} IDR ${b.spent > b.limit ? '(OVER BUDGET!)' : ''}`).join('\n')}

### UTANG CICILAN AKTIF (CC INSTALLMENTS):
${installments.map(i => `- ${i.description}: Cicilan bulanan ${i.monthly_amount} IDR, Sisa ${i.remaining_months}/${i.total_months} bulan`).join('\n')}

### 50 TRANSAKSI TERAKHIR:
${recentTx.map(t => `- [${t.date}] ${t.account_name} | ${t.description} (${t.category}): ${t.amount >= 0 ? '+' : ''}${t.amount} IDR${t.note ? ` [Catatan: ${t.note}]` : ''}${t.booking_date && t.booking_date !== t.date ? ` (Tgl Pembukuan: ${t.booking_date})` : ''}`).join('\n')}

Berikan ulasan Anda yang terstruktur secara profesional dengan format Markdown:
1. **Ringkasan Kesehatan Keuangan (Financial Health Summary)**: Berikan skor kesehatan dari 1-10 beserta penjelasannya.
2. **Ulasan Pengeluaran & Anggaran (Expense & Budget Review)**: Soroti kategori pengeluaran terbesar, kebocoran anggaran (over-budget), dan efisiensi.
3. **Analisis Cicilan & Utang**: Berikan evaluasi tentang beban cicilan bulanan pengguna.
4. **Rekomendasi Aksi Nyata (Actionable Recommendations)**: Berikan minimal 3 saran konkret dan terjadwal yang bisa langsung dilakukan pengguna untuk meningkatkan tabungan atau melunasi utang kartu kredit.
`;

    const sysPrompt = "Kamu adalah Konsultan Keuangan AI profesional. Jawablah secara objektif, taktis, dan mendukung keuangan pengguna dengan format markdown.";
    
    let responseText = '';

    if (config.provider === 'gemini') {
      const apiKey = config.api_key;
      if (!apiKey) {
        return res.status(400).json({ error: 'Gemini API Key is required. Please set it in AI Configuration settings.' });
      }
      const model = config.model_name || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${sysPrompt}\n\n${prompt}` }]
          }]
        })
      });

      if (!apiRes.ok) {
        const errJ = await apiRes.json().catch(() => ({}));
        throw new Error(errJ?.error?.message || `Gemini API returned status ${apiRes.status}`);
      }

      const json = await apiRes.json();
      responseText = json?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini';

    } else {
      // OpenAI-compatible Chat Completions API
      let url = '';
      let apiKey = config.api_key;
      let model = config.model_name || 'gpt-4o-mini';

      if (config.provider === 'openai') {
        url = 'https://api.openai.com/v1/chat/completions';
        if (!apiKey) {
          return res.status(400).json({ error: 'OpenAI API Key is required.' });
        }
      } else if (config.provider === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/chat/completions';
        if (!apiKey) {
          return res.status(400).json({ error: 'OpenRouter API Key is required.' });
        }
      } else if (config.provider === 'lm_studio') {
        url = `${config.base_url || 'http://localhost:1234'}/v1/chat/completions`;
      } else if (config.provider === 'ollama') {
        url = `${config.base_url || 'http://localhost:11434'}/v1/chat/completions`;
      } else {
        // Custom or local provider
        url = config.base_url;
        if (!url) {
          return res.status(400).json({ error: 'Custom API Base URL is required.' });
        }
      }

      const apiRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        })
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text().catch(() => '');
        throw new Error(`API returned status ${apiRes.status}: ${errText.substring(0, 150)}`);
      }

      const json = await apiRes.json();
      responseText = json?.choices?.[0]?.message?.content || 'No response from OpenAI-compatible provider';
    }

    res.json({ analysis: responseText });
  } catch (error) {
    console.error('AI Analysis Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------------
// 6.5. DEBTS & RECEIVABLES ENDPOINTS
// -------------------------------------------------------------------

// Get all debts & receivables, along with payment history
app.get('/api/debts-receivables', async (req, res) => {
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
app.post('/api/debts-receivables', async (req, res) => {
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
        await query.exec('ROLLBACK');
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
    await query.exec('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// Pay debt or collect receivable amount
app.post('/api/debts-receivables/:id/pay', async (req, res) => {
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
      await query.exec('ROLLBACK');
      return res.status(404).json({ error: 'Debt/Receivable record not found' });
    }

    if (dr.status === 'paid') {
      await query.exec('ROLLBACK');
      return res.status(400).json({ error: 'This loan is already fully paid' });
    }

    if (payAmt > dr.remaining_amount + 0.01) {
      await query.exec('ROLLBACK');
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
    await query.exec('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// Delete debt/receivable record and all associated payments in transactions ledger
app.delete('/api/debts-receivables/:id', async (req, res) => {
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
    await query.exec('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------------
// 7. SYSTEM BACKUP, RESTORE & RESET ENDPOINTS
// -------------------------------------------------------------------

// Download database backup
app.get('/api/system/backup', (req, res) => {
  try {
    const dbFile = require('path').join(__dirname, 'data', 'database.sqlite');
    res.download(dbFile, `pfm_backup_${new Date().toISOString().split('T')[0]}.sqlite`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore database backup
app.post('/api/system/restore', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a SQLite backup file' });
  }

  // Write uploaded file to a temporary location
  const tempPath = require('path').join(__dirname, 'data', 'temp_restore.sqlite');
  try {
    require('fs').writeFileSync(tempPath, req.file.buffer);

    // Stop SQLite connection, copy backup database file over active DB, and re-open SQLite
    await restoreDatabaseFile(tempPath);

    // Delete temporary file
    require('fs').unlinkSync(tempPath);

    res.json({ message: 'Database restored successfully' });
  } catch (error) {
    console.error('Database restore error:', error);
    res.status(500).json({ error: 'Failed to restore database: ' + error.message });
  }
});

// Reset application data to default empty settings
app.post('/api/system/reset', async (req, res) => {
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
    const defaultCategories = [
      { name: 'Food & Dining', type: 'expense', subs: ['Restaurants', 'Cafe & Coffee', 'Groceries'] },
      { name: 'Shopping & Groceries', type: 'expense', subs: ['Clothing', 'Electronics', 'Supermarket'] },
      { name: 'Utilities', type: 'expense', subs: ['Electricity & Water', 'Internet & Phone'] },
      { name: 'Transportation & Travel', type: 'expense', subs: ['Fuel & Gas', 'Public Transport', 'Flights & Lodging'] },
      { name: 'Entertainment', type: 'expense', subs: ['Movies & Streaming', 'Gaming & Hobbies'] },
      { name: 'Medical & Health', type: 'expense', subs: ['Pharmacy & Meds', 'Doctor & Clinic'] },
      { name: 'Credit Card Payment', type: 'both', subs: [] },
      { name: 'Transfers & Salary', type: 'both', subs: ['Salary & Bonus', 'Investment Income'] },
      { name: 'Fees & Taxes', type: 'expense', subs: ['Bank Fees', 'Late Fees & Taxes'] },
      { name: 'Others', type: 'both', subs: [] }
    ];

    for (const cat of defaultCategories) {
      const parentUuid = generateUUID();
      await query.run('INSERT INTO categories (id, name, parent_id, type) VALUES (?, ?, null, ?)', [parentUuid, cat.name, cat.type]);
      
      for (const sub of cat.subs) {
        const subUuid = generateUUID();
        let subType = 'expense';
        if (sub === 'Salary & Bonus' || sub === 'Investment Income') {
          subType = 'income';
        } else if (cat.type === 'expense') {
          subType = 'expense';
        } else {
          subType = cat.type;
        }
        await query.run('INSERT INTO categories (id, name, parent_id, type) VALUES (?, ?, ?, ?)', [subUuid, sub, parentUuid, subType]);
      }
    }

    // Re-seed default AI configuration
    await query.run(
      "INSERT INTO ai_config (id, provider, api_key, model_name, base_url) VALUES ('default', 'gemini', '', 'gemini-1.5-flash', '')"
    );

    await query.exec('COMMIT');
    res.json({ message: 'Application reset successfully to default empty settings.' });
  } catch (error) {
    await query.exec('ROLLBACK');
    console.error('Reset application error:', error);
    res.status(500).json({ error: error.message });
  }
});


// -------------------------------------------------------------------
// 10. FINANCIAL GOALS ENDPOINTS
// -------------------------------------------------------------------

// Get all goals
app.get('/api/goals', async (req, res) => {
  try {
    const goals = await query.all('SELECT * FROM financial_goals ORDER BY target_date ASC');
    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new goal
app.post('/api/goals', async (req, res) => {
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
app.put('/api/goals/:id', async (req, res) => {
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
app.delete('/api/goals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM financial_goals WHERE id = ?', [id]);
    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// INVESTMENTS API
// ============================================================

// Get all investments with summary
app.get('/api/investments', async (req, res) => {
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
app.get('/api/investments/:id', async (req, res) => {
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
app.post('/api/investments', async (req, res) => {
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
app.put('/api/investments/:id', async (req, res) => {
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
app.delete('/api/investments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM investments WHERE id = ?', [id]);
    res.json({ message: 'Investment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a transaction to an investment (buy/sell/dividend/price_update)
app.post('/api/investments/:id/transactions', async (req, res) => {
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
app.get('/api/investments/:id/transactions', async (req, res) => {
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
app.delete('/api/investments/:id/transactions/:txId', async (req, res) => {
  try {
    const { txId } = req.params;
    await query.run('DELETE FROM investment_transactions WHERE id = ?', [txId]);
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Portfolio summary
app.get('/api/investments/summary/portfolio', async (req, res) => {
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

// All other requests get served the index.html from Vite built frontend

app.get('*', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Personal Financial Manager API server running on port ${port}`);
});
