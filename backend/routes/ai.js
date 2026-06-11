const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();

// Get current AI Configuration
router.get('/api/ai/config', async (req, res) => {
  try {
    const config = await query.get("SELECT * FROM ai_config WHERE id = 'default'");
    res.json(config || { provider: 'gemini', api_key: '', model_name: 'gemini-1.5-flash', base_url: '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update AI Configuration
router.post('/api/ai/config', async (req, res) => {
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
router.post('/api/ai/analyze', async (req, res) => {
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
      const bal = (acc.type === 'bank' || acc.type === 'cash') ? acc.balance + txSum.total : txSum.total;
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

module.exports = router;
