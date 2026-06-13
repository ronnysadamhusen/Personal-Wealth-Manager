const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');
const { upload } = require('../middleware/upload');
const { extractTextFromPDF } = require('../pdfParser');

const router = express.Router();

// Call AI provider to extract payroll components from raw text
async function extractWithAI(rawText) {
  const config = await query.get("SELECT * FROM ai_config WHERE id = 'default'");
  if (!config || !config.api_key) return null;

  const prompt = `Kamu adalah parser slip gaji Indonesia. Ekstrak semua komponen pendapatan dan potongan dari teks slip gaji berikut.

Kembalikan HANYA JSON valid (tanpa markdown, tanpa penjelasan):
{
  "period": "YYYY-MM",
  "date": "YYYY-MM-DD",
  "items": [
    {"label": "Gaji Pokok", "amount": 6500000, "type": "income"},
    {"label": "Total tax", "amount": 134750, "type": "deduction"}
  ],
  "gross_income": 9571350,
  "total_deductions": 1558380,
  "net_income": 8012970
}

Aturan:
- type = "income" untuk semua pendapatan/tunjangan/bonus
- type = "deduction" untuk semua potongan (pajak, BPJS, angsuran, dll)
- Abaikan baris "Total Pendapatan", "Total Potongan", "Pendapatan Bersih" (sudah dihitung dari items)
- Jangan sertakan item dengan amount = 0
- Format tanggal: gunakan hari 1 bulan tersebut jika tanggal tidak diketahui (mis: "2025-12-01")
- Format period: "YYYY-MM"

Teks slip gaji:
${rawText.substring(0, 4000)}`;

  let responseText = '';

  if (config.provider === 'gemini') {
    const model = config.model_name || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.api_key}`;
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!apiRes.ok) throw new Error(`Gemini API error: ${apiRes.status}`);
    const json = await apiRes.json();
    responseText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    let url = config.base_url || 'https://api.openai.com/v1/chat/completions';
    if (config.provider === 'openai') url = 'https://api.openai.com/v1/chat/completions';
    else if (config.provider === 'openrouter') url = 'https://openrouter.ai/api/v1/chat/completions';

    const apiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.api_key ? { 'Authorization': `Bearer ${config.api_key}` } : {})
      },
      body: JSON.stringify({
        model: config.model_name || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      })
    });
    if (!apiRes.ok) throw new Error(`AI API error: ${apiRes.status}`);
    const json = await apiRes.json();
    responseText = json?.choices?.[0]?.message?.content || '';
  }

  // Extract JSON from response (strip markdown if present)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return JSON.parse(jsonMatch[0]);
}

// POST /api/payroll/parse — extract payroll slip from PDF
router.post('/api/payroll/parse', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { password = '' } = req.body;
  let rawText = '';

  // Try extraction with provided password first, then all saved passwords
  const passwords = [''];
  if (password) passwords.unshift(password);

  const savedPwds = await query.all('SELECT password FROM pdf_passwords');
  savedPwds.forEach(p => { if (!passwords.includes(p.password)) passwords.push(p.password); });

  let lastError = null;
  for (const pwd of passwords) {
    try {
      rawText = await extractTextFromPDF(req.file.buffer, pwd);
      break;
    } catch (err) {
      if (err.message === 'PASSWORD_REQUIRED_OR_INCORRECT') {
        lastError = err;
        continue;
      }
      return res.status(500).json({ error: err.message });
    }
  }

  if (!rawText) {
    return res.status(400).json({ error: 'PASSWORD_REQUIRED_OR_INCORRECT', raw_text: '' });
  }

  // Try AI extraction
  let extracted = null;
  let method = 'manual';
  try {
    extracted = await extractWithAI(rawText);
    if (extracted) method = 'ai';
  } catch (err) {
    console.error('AI payroll extraction failed:', err.message);
  }

  res.json({ raw_text: rawText, extracted, method });
});

// POST /api/payroll/slips — create payroll slip + transactions + transfer
router.post('/api/payroll/slips', async (req, res) => {
  const { account_id, period, date, items, destination_account_id } = req.body;
  if (!account_id || !period || !date || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'account_id, period, date, items are required' });
  }

  const incomeItems = items.filter(i => i.type === 'income');
  const deductionItems = items.filter(i => i.type === 'deduction');
  const gross_income = incomeItems.reduce((s, i) => s + Number(i.amount), 0);
  const total_deductions = deductionItems.reduce((s, i) => s + Number(i.amount), 0);
  const net_income = gross_income - total_deductions;

  const slipId = generateUUID();

  try {
    const payrollAcc = await query.get('SELECT name FROM accounts WHERE id = ?', [account_id]);
    if (!payrollAcc) return res.status(404).json({ error: 'Payroll account not found' });

    await query.exec('BEGIN TRANSACTION');

    // Insert payroll slip record
    await query.run(
      `INSERT INTO payroll_slips (id, account_id, period, date, gross_income, total_deductions, net_income, destination_account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [slipId, account_id, period, date, gross_income, total_deductions, net_income, destination_account_id || null]
    );

    // Insert a transaction per item into the payroll account
    for (const item of items) {
      const txId = generateUUID();
      const amount = item.type === 'income' ? Number(item.amount) : -Number(item.amount);
      const category = item.type === 'income' ? 'Transfers & Salary' : 'Fees & Taxes';
      await query.run(
        `INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category, payroll_slip_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, account_id, date, date, item.label, amount, category, slipId]
      );
    }

    // Auto-create transfer of net_income to destination account
    if (destination_account_id && net_income > 0) {
      const destAcc = await query.get('SELECT name, type FROM accounts WHERE id = ?', [destination_account_id]);
      if (destAcc) {
        const transferId = generateUUID();
        const srcTxId = generateUUID();
        const destTxId = generateUUID();

        await query.run(
          `INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category, payroll_slip_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [srcTxId, account_id, date, date, `Transfer Gaji ke ${destAcc.name}`, -net_income, 'Transfers & Salary', slipId]
        );

        const destCategory = destAcc.type === 'credit_card' ? 'Credit Card Payment' : 'Transfers & Salary';
        await query.run(
          `INSERT INTO transactions (id, account_id, date, booking_date, description, amount, category)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [destTxId, destination_account_id, date, date, `Gaji dari ${payrollAcc.name}`, net_income, destCategory]
        );

        await query.run(
          `INSERT INTO transfers (id, source_account_id, destination_account_id, amount, fee, date, description, source_transaction_id, destination_transaction_id)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [transferId, account_id, destination_account_id, net_income, date, `Gaji ${period}`, srcTxId, destTxId]
        );
      }
    }

    await query.exec('COMMIT');
    res.status(201).json({ id: slipId, gross_income, total_deductions, net_income });
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payroll/slips?account_id=xxx — list slips
router.get('/api/payroll/slips', async (req, res) => {
  const { account_id } = req.query;
  try {
    const slips = account_id
      ? await query.all('SELECT * FROM payroll_slips WHERE account_id = ? ORDER BY period DESC', [account_id])
      : await query.all('SELECT * FROM payroll_slips ORDER BY period DESC');
    res.json(slips);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payroll/slips/:id — slip detail with items
router.get('/api/payroll/slips/:id', async (req, res) => {
  try {
    const slip = await query.get('SELECT * FROM payroll_slips WHERE id = ?', [req.params.id]);
    if (!slip) return res.status(404).json({ error: 'Slip not found' });

    const items = await query.all(
      'SELECT * FROM transactions WHERE payroll_slip_id = ? ORDER BY amount DESC',
      [req.params.id]
    );
    res.json({ ...slip, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/payroll/slips/:id — delete slip and its transactions
router.delete('/api/payroll/slips/:id', async (req, res) => {
  try {
    const slip = await query.get('SELECT * FROM payroll_slips WHERE id = ?', [req.params.id]);
    if (!slip) return res.status(404).json({ error: 'Slip not found' });

    await query.exec('BEGIN TRANSACTION');
    // Delete associated transfer first
    if (slip.destination_account_id) {
      const transfer = await query.get(
        `SELECT id FROM transfers WHERE source_account_id = ? AND date = ? AND amount = ?`,
        [slip.account_id, slip.date, slip.net_income]
      );
      if (transfer) {
        const t = await query.get('SELECT * FROM transfers WHERE id = ?', [transfer.id]);
        if (t?.source_transaction_id) await query.run('DELETE FROM transactions WHERE id = ?', [t.source_transaction_id]);
        if (t?.destination_transaction_id) await query.run('DELETE FROM transactions WHERE id = ?', [t.destination_transaction_id]);
        await query.run('DELETE FROM transfers WHERE id = ?', [transfer.id]);
      }
    }
    await query.run('DELETE FROM transactions WHERE payroll_slip_id = ?', [req.params.id]);
    await query.run('DELETE FROM payroll_slips WHERE id = ?', [req.params.id]);
    await query.exec('COMMIT');
    res.json({ message: 'Payroll slip deleted' });
  } catch (error) {
    await query.exec('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
