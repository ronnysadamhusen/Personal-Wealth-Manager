const express = require('express');
const { query } = require('../database');
const { generateUUID } = require('../utils/id');

const router = express.Router();
const { upload } = require('../middleware/upload');
const { parseStatement } = require('../pdfParser');

// Get saved passwords
router.get('/api/pdf/passwords', async (req, res) => {
  try {
    const list = await query.all('SELECT * FROM pdf_passwords');
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set/Update PDF password
router.post('/api/pdf/passwords', async (req, res) => {
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
router.post('/api/pdf/parse', upload.single('file'), async (req, res) => {
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

module.exports = router;
