const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();

// Get budgets summary for a specific period (monthly, quarterly, semesterly, or yearly)
router.get('/api/budgets', async (req, res) => {
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
router.post('/api/budgets', async (req, res) => {
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
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// Update an existing budget (allows editing category, amount, range, recurrence, and interval day)
router.put('/api/budgets/:id', async (req, res) => {
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
    await query.exec('ROLLBACK').catch(() => {});
    res.status(400).json({ error: error.message });
  }
});

// Delete a budget
router.delete('/api/budgets/:id', async (req, res) => {
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

module.exports = router;
