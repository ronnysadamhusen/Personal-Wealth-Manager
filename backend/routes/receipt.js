const express = require('express');
const Tesseract = require('tesseract.js');
const { upload } = require('../middleware/upload');
const { query } = require('../database');
const router = express.Router();

// Rule-based parser for raw receipt OCR text
function parseReceiptText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Merchant: first non-empty line with enough alpha chars
  let merchant = 'Unknown Merchant';
  for (const line of lines.slice(0, 3)) {
    const cleaned = line.replace(/[^a-zA-Z0-9\s&.'/-]/g, '').trim();
    if (cleaned.length > 2) { merchant = cleaned; break; }
  }

  // Amount: look for total-related line first, then largest number
  let amount = 0;
  const allNums = [];
  lines.forEach(line => {
    if (/total|grand|bayar|netto|amount|rp|idr|subtotal/i.test(line)) {
      const m = line.match(/([\d.,\s]+)/);
      if (m) {
        const val = parseInt(m[0].replace(/[^\d]/g, ''), 10);
        if (val > 100 && val < 100_000_000) allNums.unshift(val); // priority
      }
    } else {
      const matches = line.match(/\b\d{1,3}(?:[.,]\d{3})+\b/g) || line.match(/\b\d{4,9}\b/g) || [];
      matches.forEach(m => {
        const val = parseInt(m.replace(/[^\d]/g, ''), 10);
        if (val > 100 && val < 100_000_000) allNums.push(val);
      });
    }
  });
  if (allNums.length > 0) {
    allNums.sort((a, b) => b - a);
    amount = allNums[0];
  }

  // Date
  let dateStr = new Date().toISOString().split('T')[0];
  for (const line of lines) {
    let m = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
    if (m && parseInt(m[2]) <= 12 && parseInt(m[1]) <= 31) {
      dateStr = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; break;
    }
    m = line.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) { dateStr = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; break; }
  }

  // Category
  const t = text.toLowerCase();
  let category = 'Others';
  if (/kopi|coffee|resto|cafe|food|makan|bakery|starbucks|warung|restoran/.test(t)) category = 'Food & Dining';
  else if (/baju|kaos|cell|mall|fashion|indomaret|alfamart|supermarket|minimarket/.test(t)) category = 'Shopping & Groceries';
  else if (/bensin|pertamina|grab|gojek|taxi|travel|tiket|parkir|toll/.test(t)) category = 'Transportation & Travel';
  else if (/apotek|obat|farmasi|doctor|clinic|sehat|rumah sakit|rs /.test(t)) category = 'Medical & Health';
  else if (/bioskop|cinema|game|movie|hiburan/.test(t)) category = 'Entertainment';

  // Detect bank from header lines
  const header = lines.slice(0, 5).join(' ').toLowerCase();
  let bank = '';
  if (/bca/.test(header)) bank = 'BCA';
  else if (/bni/.test(header)) bank = 'BNI';
  else if (/mandiri/.test(header)) bank = 'Mandiri';
  else if (/bri/.test(header)) bank = 'BRI';
  else if (/cimb/.test(header)) bank = 'CIMB';

  // Reference number
  const refMatch = text.match(/(?:ref(?:erence)?|no\.?|nomor)\s*[:#]?\s*([A-Z0-9]{6,20})/i);
  const reference_number = refMatch ? refMatch[1] : '';

  return { merchant, amount: amount > 0 ? amount : null, date: dateStr, category, bank, reference_number };
}

// POST /api/receipt/parse
// Accepts multipart/form-data with a single `file` image field.
// Returns extracted { merchant, amount, date, category, bank, reference_number, raw_text, method }.
router.post('/api/receipt/parse', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    // Use Tesseract.js to extract raw text from the image buffer
    const { data } = await Tesseract.recognize(req.file.buffer, 'eng+ind');
    const rawText = data.text || '';

    const parsed = parseReceiptText(rawText);

    // Optionally enhance with AI if configured
    let method = 'rule-based';
    try {
      const aiConf = await query.get('SELECT * FROM settings WHERE key = ?', ['ai_config']);
      if (aiConf && aiConf.value) {
        const cfg = JSON.parse(aiConf.value);
        if (cfg.api_key && cfg.provider === 'gemini') {
          // Could call AI here — for now, rule-based is sufficient
        }
      }
    } catch (_) { /* non-fatal */ }

    res.json({ ...parsed, raw_text: rawText, method });
  } catch (err) {
    console.error('Receipt parse error:', err);
    res.status(500).json({ error: 'Failed to parse receipt: ' + err.message });
  }
});

module.exports = router;
