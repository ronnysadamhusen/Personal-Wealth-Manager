const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();

// Get all bank accounts and credit cards, including calculated current balance
router.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await query.all('SELECT * FROM accounts');

    // Aggregate per-account sums in two queries instead of one pair per account.
    const txSums = await query.all(
      'SELECT account_id, COALESCE(SUM(amount), 0) AS total FROM transactions GROUP BY account_id'
    );
    // Subtract 1 from remaining_months to avoid double-counting the current billed
    // month (already included in current_balance as a transaction).
    const instSums = await query.all(
      'SELECT account_id, SUM(monthly_amount * MAX(0, remaining_months - 1)) AS totalDebt FROM installments GROUP BY account_id'
    );

    const txMap = {};
    txSums.forEach(r => { txMap[r.account_id] = r.total; });
    const instMap = {};
    instSums.forEach(r => { instMap[r.account_id] = r.totalDebt || 0; });

    const accountDetails = accounts.map(account => {
      const txTotal = txMap[account.id] || 0;
      // Bank/cash: initial balance + transactions.
      // Credit card: balance is just the sum of charges (negative) and payments (positive).
      const currentBalance = (account.type === 'bank' || account.type === 'cash' || account.type === 'payroll')
        ? account.balance + txTotal
        : txTotal;

      return {
        ...account,
        current_balance: currentBalance,
        installment_debt: account.type === 'credit_card' ? (instMap[account.id] || 0) : 0
      };
    });

    res.json(accountDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new account
router.post('/api/accounts', async (req, res) => {
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
router.delete('/api/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query.run('DELETE FROM accounts WHERE id = ?', [id]);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
