const fs = require('fs');
const path = require('path');

// Disable pdfjs workers to run smoothly in a single thread node server
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

/**
 * Extracts raw text from PDF buffer, handling password encryption.
 */
async function extractTextFromPDF(pdfBuffer, password = '') {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      password: password,
      verbosity: 0,
      useSystemFonts: false,
      disableFontFace: true
    });

    const pdfDocument = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `\n--- PAGE ${i} ---\n` + pageText;
    }

    return fullText;
  } catch (error) {
    if (error.name === 'PasswordException' || error.message.includes('password') || error.code === 1) {
      throw new Error('PASSWORD_REQUIRED_OR_INCORRECT');
    }
    throw error;
  }
}

/**
 * Normalizes Indonesian currency formats to standard float numbers
 * e.g., "1.500.000,00" -> 1500000.00
 * e.g., "50.000" -> 50000.00
 */
function parseAmount(amountStr) {
  if (!amountStr) return 0;
  let cleanStr = amountStr.trim().replace(/\s/g, '');
  
  // If format is like 1.234.567,89 (Indonesian standard)
  if (cleanStr.includes('.') && cleanStr.includes(',')) {
    cleanStr = cleanStr.replace(/\./g, '').replace(/,/g, '.');
  } 
  // If format is like 1,234,567.89 (US standard)
  else if (cleanStr.includes(',') && cleanStr.includes('.')) {
    cleanStr = cleanStr.replace(/,/g, '');
  } 
  // If it has only comma (often Indonesian integer divider e.g. 50.000 but scanned as 50,000 or decimal 1500,50)
  else if (cleanStr.includes(',')) {
    // If it looks like decimals (e.g. 2 digits after comma: 1500,50), replace with dot
    const parts = cleanStr.split(',');
    if (parts[parts.length - 1].length === 2) {
      cleanStr = cleanStr.replace(/,/g, '.');
    } else {
      // Treat as thousands separator
      cleanStr = cleanStr.replace(/,/g, '');
    }
  } 
  // If it has only dot (Indonesian thousands separator e.g., 50.000)
  else if (cleanStr.includes('.')) {
    // Check if it's a decimal (e.g. 150.50) or thousand separator (150.000)
    const parts = cleanStr.split('.');
    if (parts[parts.length - 1].length === 2) {
      // Decimal
    } else {
      // Thousands separator
      cleanStr = cleanStr.replace(/\./g, '');
    }
  }

  const amount = parseFloat(cleanStr);
  return isNaN(amount) ? 0 : amount;
}

/**
 * Guesses transaction category based on description keywords.
 */
function autoCategorize(description) {
  const desc = description.toUpperCase();
  
  if (/PLN|PULSA|TELKOM|PAM|BPJS|INTERNET|INDIHOME|WIFI|LISTRIK|AIR/i.test(desc)) {
    return 'Utilities';
  }
  if (/KEDAI|KOPI|CAFE|RESTO|FOOD|GOFOOD|GRABFOOD|STARBUCKS|MCD|KFC|BURGER|BAKSO|WARUNG|DINING|RESTAURANT/i.test(desc)) {
    return 'Food & Dining';
  }
  if (/GOJEK|GRAB|MRT|LRT|COMMUTER|TRANSJAKARTA|PERTAMINA|SHELL|OVO|GOPAY|TIKET|TRAVELOKA|TICKET|KAI|AIRASIA|GARUDA/i.test(desc)) {
    return 'Transportation & Travel';
  }
  if (/TOKOPEDIA|SHOPEE|LAZADA|BLIBLI|AMAZON|ALFAMART|INDOMARET|SUPERMARKET|HYPERMART|GIANT|TRANSMART|FASHION|MALL|RETAIL|CLOTHES/i.test(desc)) {
    return 'Shopping & Groceries';
  }
  if (/NETFLIX|SPOTIFY|DISNEY|CINEMA|XXI|CGV|GAME|STEAM|PLAYSTATION|BILLIARD|TOYS/i.test(desc)) {
    return 'Entertainment';
  }
  if (/ADMIN|BIAYA|BUNGA|INTEREST|DENDA|LATE|MATERAI|TAX|PAJAK/i.test(desc)) {
    return 'Fees & Taxes';
  }
  if (/PEMBAYARAN|PAYMENT|AUTODEBET|TRANSFER TO|TRSF|TRANSFER FROM|DEPOSIT|BUNGA TABUNGAN/i.test(desc)) {
    if (/KARTU KREDIT|CREDIT CARD/i.test(desc)) {
      return 'Credit Card Payment';
    }
    return 'Transfers & Salary';
  }
  if (/DOKTER|APOTEK|CLINIC|RUMAH SAKIT|HOSPITAL|HALODOC|OBAT|MEDIS|HEALTH|BPJS KESEHATAN/i.test(desc)) {
    return 'Medical & Health';
  }

  return 'Others';
}

/**
 * Clean up extra whitespace and structure bank transactions.
 */
function cleanDescription(desc) {
  return desc.replace(/\s+/g, ' ').trim();
}

/**
 * Deduce year from PDF context or fallback to current year
 */
function extractYear(text) {
  const currentYear = new Date().getFullYear();
  // Search for patterns like "2026" or "26" in statement dates
  const yearMatch = text.match(/\b20\d{2}\b/);
  if (yearMatch) {
    return parseInt(yearMatch[0]);
  }
  return currentYear;
}

/**
 * Individual statement parsers.
 */
const Parsers = {
  // 1. BCA Bank Statement (Tahapan)
  bcaBank(text) {
    const transactions = [];
    const year = extractYear(text);
    
    // Look for date pattern: DD/MM (e.g. 05/06)
    // Followed by description, amount, and optionally CR/DB indicator
    // E.g., "05/06 TRSF E-BANKING 100.000,00 CR" or "06/06 TARIKAN ATM 500.000,00"
    const lines = text.split('\n');
    
    // A regular expression that captures:
    // Group 1: Date (DD/MM)
    // Group 2: Description (including intermediate text)
    // Group 3: Amount (e.g. 100.000,00 or 150.000)
    // Group 4: DB/CR marker
    const regex = /(\b\d{2}\/\d{2}\b)\s+(.+?)\s+([\d.,]+)\s*(CR|DB)?$/i;

    // Sometimes the PDF output merges everything into single line or splits multi-line descriptions
    // Let's iterate lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(regex);
      
      if (match) {
        const [_, dateStr, descRaw, amountStr, indicator] = match;
        const [day, month] = dateStr.split('/');
        const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        const amountValue = parseAmount(amountStr);
        // BCA standard: CR is Credit (incoming/income), no marker or DB is Debit (outgoing/expense)
        const isCredit = indicator && indicator.toUpperCase() === 'CR';
        const finalAmount = isCredit ? amountValue : -amountValue;
        
        const cleanDesc = cleanDescription(descRaw);
        
        transactions.push({
          date: formattedDate,
          description: cleanDesc,
          amount: finalAmount,
          category: autoCategorize(cleanDesc)
        });
      }
    }
    
    return transactions;
  },

  // 2. BCA Credit Card Statement
  // Supports both old format (DD MMM DD MMM) and new "REKENING KARTU KREDIT" multi-card format (DD-MMM DD-MMM)
  // NOTE: pdfjs-dist extracts all text items joined by spaces into one long string per page,
  // so we use a global regex with lookahead instead of line-by-line matching.
  bcaCreditCard(text) {
    const transactions = [];
    const year = extractYear(text);

    // Strip page number markers (e.g. "1/3", "2/3") and repeated page headers
    // that appear at page boundaries and break the transaction regex lookahead.
    text = text
      .replace(/\b\d+\/\d+\b/g, ' ')
      .replace(/REKENING\s+KARTU\s+KREDIT\s+\d+/gi, ' ')
      .replace(/TANGGAL\s+KETERANGAN\s+JUMLAH\s*\(RP\)\s+TRANSAKSI\s+PEMBUKUAN/gi, ' ')
      .replace(/\s{2,}/g, ' ');

    const months = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MEI': '05', 'MAY': '05',
      'JUN': '06', 'JUL': '07', 'AGS': '08', 'AUG': '08', 'SEP': '09', 'OKT': '10', 'OCT': '10',
      'NOV': '11', 'DES': '12', 'DEC': '12'
    };

    // Extract metadata from header
    const dueDateMatch = text.match(/TANGGAL JATUH TEMPO\s*[:\-]\s*(\d{1,2})/i);
    const dueDate = dueDateMatch ? parseInt(dueDateMatch[1]) : null;
    const billingMatch = text.match(/TANGGAL REKENING\s*[:\-]\s*(\d{1,2})\s+([A-Z]+)\s+(\d{4})/i);
    const billingCycleDate = billingMatch ? parseInt(billingMatch[1]) : null;
    const stmtMonths = { JANUARI:'01',FEBRUARI:'02',MARET:'03',APRIL:'04',MEI:'05',JUNI:'06',JULI:'07',AGUSTUS:'08',SEPTEMBER:'09',OKTOBER:'10',NOVEMBER:'11',DESEMBER:'12' };
    const statementDate = billingMatch
      ? `${billingMatch[3]}-${stmtMonths[billingMatch[2].toUpperCase()] || '01'}-${billingMatch[1].padStart(2,'0')}`
      : null;
    console.log('[BCA CC] billingMatch raw:', billingMatch ? billingMatch[0] : 'NULL', '| statementDate:', statementDate);
    // PDF layout: all column headers first, then all values.
    // "SISA KREDIT LIMIT" is the last header; first value after it = KREDIT LIMIT GABUNGAN,
    // then 4 more values, then SISA TAGIHAN CICILAN.
    const creditTableMatch = text.match(/SISA\s+KREDIT\s+LIMIT\s+([\d.]+)(?:\s+[\d.,]+){4}\s+([\d.]+)/i);
    const creditLimit = creditTableMatch ? parseFloat(creditTableMatch[1].replace(/\./g, '')) : null;
    const installmentCommitment = creditTableMatch ? parseFloat(creditTableMatch[2].replace(/\./g, '')) : null;
    console.log('[BCA CC] creditTableMatch:', creditTableMatch ? creditTableMatch[0].substring(0, 80) : 'NULL');
    console.log('[BCA CC] creditLimit:', creditLimit, '| installmentCommitment:', installmentCommitment);
    // Primary: "TAGIHAN BARU   :   RP 3.092.670" (labeled format)
    // Fallback: table format where all headers precede all values — after "TAGIHAN BARU"
    //   (no colon) the first number is the TAGIHAN SEBELUMNYA value, used as initial billing.
    const billMatch = text.match(/TAGIHAN BARU\s*:\s*RP\s*([\d.,]+)/i)
                   || text.match(/TAGIHAN BARU\s+([\d.,]+)/i);
    const currentBill = billMatch ? parseAmount(billMatch[1]) : null;
    console.log('[BCA CC] currentBill:', currentBill);

    // Global regex: matches DD-MMM DD-MMM DESCRIPTION AMOUNT [CR]
    // Lookahead stops the description before the next transaction, section header, or end of string.
    // This handles the case where all transactions on a page are concatenated into one long string.
    const regex = /(\d{2})[-\s]([A-Z]{3})\s+(\d{2})[-\s]([A-Z]{3})\s+(.+?)\s+([\d.,]+)\s*(CR)?\s*(?=\d{2}[-\s][A-Z]{3}|\bSUBTOTAL\b|\bTOTAL\b|\bSALDO\b|\bINFORMASI\b|$)/gi;

    let match;
    while ((match = regex.exec(text)) !== null) {
      const [_, dayStr, monthName, postDay, postMonthName, descRaw, amountStr, crMarker] = match;
      const monthNum = months[monthName.toUpperCase()] || '01';
      const formattedDate = `${year}-${monthNum}-${dayStr.padStart(2, '0')}`;

      const amountValue = parseAmount(amountStr);
      // CC charges = expense (negative). Payments/refunds marked CR = positive.
      const isCredit = crMarker && crMarker.toUpperCase() === 'CR';
      const finalAmount = isCredit ? amountValue : -amountValue;

      const cleanDesc = cleanDescription(descRaw);

      // Detect BCA installment format: "CICILAN BCA KE 03 DARI 06, ACE HARDWARE"
      const installmentMatch = cleanDesc.match(/CICILAN\s+\S+\s+KE\s+0*(\d+)\s+DARI\s+0*(\d+)[,\s]+(.+)/i);
      const isInstallment = installmentMatch && parseInt(installmentMatch[1]) === 1;

      transactions.push({
        date: formattedDate,
        description: cleanDesc,
        amount: finalAmount,
        category: autoCategorize(cleanDesc),
        ...(isInstallment && {
          is_installment: 1,
          installment_months: parseInt(installmentMatch[2]),
        }),
      });
    }

    // Build detectedInstallments from active CICILAN transactions (same as BNI CC logic).
    // Each CICILAN row tells us current month/total, so we infer start date and remaining months.
    const detectedInstallments = [];
    for (const tx of transactions) {
      const m = tx.description.match(/CICILAN\s+\S+\s+KE\s+0*(\d+)\s+DARI\s+0*(\d+)[,\s]+(.+)/i);
      if (!m) continue;
      const currentMonth = parseInt(m[1]);
      const totalMonths  = parseInt(m[2]);
      const merchantName = m[3].trim();
      const monthlyAmount = Math.abs(tx.amount);
      const alreadyTracked = detectedInstallments.some(inst =>
        inst.description.toLowerCase().substring(0, 10) === merchantName.toLowerCase().substring(0, 10) &&
        Math.abs(inst.monthly_amount - monthlyAmount) < 10
      );
      if (!alreadyTracked) {
        const txDate = new Date(tx.date);
        txDate.setMonth(txDate.getMonth() - (currentMonth - 1));
        detectedInstallments.push({
          description: merchantName,
          total_amount: monthlyAmount * totalMonths,
          monthly_amount: monthlyAmount,
          total_months: totalMonths,
          start_date: txDate.toISOString().split('T')[0]
        });
      }
    }

    return { transactions, dueDate, billingCycleDate, creditLimit, currentBill, installmentCommitment, statementDate, detectedInstallments };
  },

  // 3. Mandiri Bank Statement
  mandiriBank(text) {
    const transactions = [];
    const lines = text.split('\n');
    // Pattern matches typical Mandiri statement dates: DD/MM/YY or DD-MM-YYYY
    // E.g., "05/06/26 TRANSFER DARI BUDI 500,000.00 DB" or Column splits
    const regex = /(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(.+?)\s+([\d.,]+)\s*(CR|DB|D|K)?$/i;

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(regex);
      if (match) {
        const [_, rawDate, descRaw, amountStr, indicator] = match;
        
        // Parse date
        const parts = rawDate.split(/[\/\-]/);
        let day = parts[0];
        let month = parts[1];
        let yearStr = parts[2];
        if (yearStr.length === 2) {
          yearStr = '20' + yearStr;
        }
        const formattedDate = `${yearStr}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        const amountValue = parseAmount(amountStr);
        // K or CR is Credit (income), D or DB is Debit (expense)
        const isCredit = indicator && (indicator.toUpperCase() === 'CR' || indicator.toUpperCase() === 'K');
        const finalAmount = isCredit ? amountValue : -amountValue;
        
        const cleanDesc = cleanDescription(descRaw);
        
        transactions.push({
          date: formattedDate,
          description: cleanDesc,
          amount: finalAmount,
          category: autoCategorize(cleanDesc)
        });
      }
    }
    return transactions;
  },

  // 4. Mandiri Credit Card
  mandiriCreditCard(text) {
    // Mandiri Credit Card has very similar DD-MM-YYYY structure to BCA CC but dates separated by dash
    const transactions = [];
    const lines = text.split('\n');
    const regex = /(\d{2}-\d{2}-\d{4})\s+(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d.,]+)\s*(CR|DB|-)?$/i;

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(regex);
      if (match) {
        const [_, transDate, postDate, descRaw, amountStr, crMarker] = match;
        
        const parts = transDate.split('-');
        const formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        
        const amountValue = parseAmount(amountStr);
        // Charges are negative (expenses), payments are positive
        const isCredit = crMarker && (crMarker.toUpperCase() === 'CR' || crMarker === '-');
        const finalAmount = isCredit ? amountValue : -amountValue;
        
        const cleanDesc = cleanDescription(descRaw);
        
        transactions.push({
          date: formattedDate,
          description: cleanDesc,
          amount: finalAmount,
          category: autoCategorize(cleanDesc)
        });
      }
    }
    return transactions;
  },

  // 5. BNI Bank Statement (Mutasi Rekening)
  bniBank(text) {
    const transactions = [];
    const months = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MEI': '05', 'MAY': '05',
      'JUN': '06', 'JUL': '07', 'AGS': '08', 'AGU': '08', 'AUG': '08', 'SEP': '09',
      'OKT': '10', 'OCT': '10', 'NOV': '11', 'DES': '12', 'DEC': '12'
    };

    // Clean text from page numbers, headers, and noise to make transactions contiguous
    let cleanedText = text
      .replace(/--- PAGE \d+ ---/gi, '')
      .replace(/Laporan Mutasi Rekening\s+Periode:.*?\d{4}/gi, '')
      .replace(/PT Bank Negara Indonesia.*?\bLPS\b\)?\.?/gi, '')
      .replace(/\d+\s+dari\s+\d+/g, '')
      .replace(/Tanggal & Waktu\s+Rincian Transaksi\s+Nominal \(IDR\)\s+Saldo \(IDR\)/gi, '')
      .replace(/Saldo Awal\s+[\d,.]+/gi, '')
      .replace(/Total Pemasukan\s+[+-]?[\d,.]+/gi, '')
      .replace(/Total Pengeluaran\s+[+-]?[\d,.]+/gi, '')
      .replace(/Saldo Akhir\s+[\d,.]+/gi, '')
      .replace(/\s+/g, ' ');

    const regex = /(\d{2})\s+([A-Za-z]{3})\s+(\d{4})\s+\d{2}:\d{2}:\d{2}\s+WIB\s+(.+?)\s+([+-][\d,.]+)\s+([\d,.]+)(?=\s+\d{2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+WIB|[\s\S]*$)/gi;

    let match;
    while ((match = regex.exec(cleanedText)) !== null) {
      const [_, day, monthName, year, descRaw, amountStr, balanceStr] = match;
      const monthNum = months[monthName.toUpperCase()] || '01';
      const formattedDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
      const parsedAmt = parseAmount(amountStr);
      
      transactions.push({
        date: formattedDate,
        description: descRaw.trim(),
        amount: parsedAmt,
        category: autoCategorize(descRaw)
      });
    }

    return transactions;
  },

  // 5b. BNI Credit Card
  bniCreditCard(text) {
    const transactions = [];
    let creditLimit = null;
    const limitMatch = text.match(/BATAS\s+KREDIT\s*(?:\||\s)*\s*([\d.]+)/i);
    if (limitMatch) {
      creditLimit = parseFloat(limitMatch[1].replace(/\./g, ''));
      console.log(`[pdfParser] Detected credit limit: ${creditLimit}`);
    }

    let billingCycleDate = null;
    let dueDate = null;

    const dueMatch = text.match(/TANGGAL\s+JATUH\s+TEMPO\s*(?:\||\s)*\s*(\d{2})-\d{2}-\d{4}/i);
    if (dueMatch) {
      dueDate = parseInt(dueMatch[1], 10);
      console.log(`[pdfParser] Detected due date: ${dueDate}`);
    }

    const billingMatch = text.match(/Tanggal\s+Cetak[\s\S]{1,100}?(\d{2})-\d{2}-\d{4}/i);
    if (billingMatch) {
      billingCycleDate = parseInt(billingMatch[1], 10);
      console.log(`[pdfParser] Detected billing cycle date: ${billingCycleDate}`);
    }

    // Global match with lookahead
    const regex = /(\d{2}-\d{2}-\d{4})\s+(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d.,]+)\s*(CR|DB|-)?(?=\s+\d{2}-\d{2}-\d{4}\s+\d{2}-\d{2}-\d{4}\b|\s+BATAS\s+KREDIT|\s+TOTAL\s+TAGIHAN|\s+SUB\s+TOTAL|$)/gi;

    let match;
    while ((match = regex.exec(text)) !== null) {
      const [_, transDate, postDate, descRaw, amountStr, crMarker] = match;
      const parts = transDate.split('-');
      const formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      const amountValue = parseAmount(amountStr);
      const isCredit = crMarker && (crMarker.toUpperCase() === 'CR' || crMarker === '-');
      const finalAmount = isCredit ? amountValue : -amountValue;
      const cleanDesc = cleanDescription(descRaw);
      transactions.push({
        date: formattedDate,
        description: cleanDesc,
        amount: finalAmount,
        category: autoCategorize(cleanDesc)
      });
    }

    // -----------------------------------------------------------------------
    // Post-processing: Handle installment origin rows (X : 0/N Rp.)
    //
    // When a purchase is converted to installments:
    //   (a) "MERCHANT : 0/12 Rp."  ← original purchase total, informational
    //   (b) "MERCHANT : 01/12"...   ← monthly charges, the real expenses
    //   (c) "TRANSFER KE SMART SPENDING" (positive) ← bank offset cancels (a)
    //
    // Bank-side conversion: (a) + (c) = 0, so (a) is harmless → keep both.
    // Third-party conversion (Tokopedia, Traveloka, etc.): (c) is absent.
    //   → (a) would double-count expense vs (b). Solution: DON'T import (a)
    //     as a transaction, but DO record it as an installment commitment so
    //     future monthly charges reduce the available credit limit correctly.
    // -----------------------------------------------------------------------
    const smartSpendingOffsets = transactions
      .filter(tx => tx.description.toUpperCase().includes('TRANSFER KE SMART SPENDING'))
      .map(tx => Math.abs(tx.amount));

    // Pattern: ends with ": 0/N Rp." — the installment origin marker
    const installmentOriginPattern = /^(.+?)\s*:\s*0\/(\d+)\s+Rp\.?\s*$/i;

    // Pattern for active in-progress installments like: TOKOPEDIA : 02/06 INT 462.93 or TOKOPEDIA : 02/06
    const activeInstallmentPattern = /^(.+?)\s*:\s*(\d{2})\/(\d{2})/i;

    const detectedInstallments = [];

    // 1. Process explicit 0/N setup rows
    const filteredTransactions = transactions.filter(tx => {
      const originMatch = tx.description.match(installmentOriginPattern);
      if (!originMatch) return true; // Not an installment origin, keep

      const merchantPrefix = originMatch[1].trim();
      const totalMonths = parseInt(originMatch[2]);

      // Bank-side conversion → offset exists. 
      // We still want to EXCLUDE the informational 0/N row from the transactions list 
      // because it is not a real ledger-posted charge, but we do NOT want to auto-track 
      // it as a new installment record if it is a bank-side conversion (since the bank
      // has an offset and will post monthly charges that are already tracked).
      // Actually, bank-side conversions (with TRANSFER KE SMART SPENDING offset) are
      // handled by the bank and we don't track them as separate commitments, or we do.
      // Wait, BNI CC bank-side conversions DO post monthly charges (e.g. SS SPEC LIBURAN : 16/24).
      // So yes, we still exclude the 0/N row from transactions to avoid double-counting.
      const hasOffset = smartSpendingOffsets.some(offset => Math.abs(offset - Math.abs(tx.amount)) < 1);
      
      // Third-party or Bank-side: find monthly amount from matching "01/N" entry
      const firstMonthEntry = transactions.find(t =>
        t.amount < 0 &&
        !/\bINT\b/i.test(t.description) &&
        new RegExp(merchantPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').substring(0, 15), 'i').test(t.description) &&
        new RegExp(`:\\s*01\\/${totalMonths}\\b`).test(t.description)
      );

      const monthlyAmount = firstMonthEntry
        ? Math.abs(firstMonthEntry.amount)
        : Math.round(Math.abs(tx.amount) / totalMonths);
      const startDate = firstMonthEntry ? firstMonthEntry.date : tx.date;

      detectedInstallments.push({
        description: merchantPrefix,
        total_amount: Math.abs(tx.amount),
        monthly_amount: monthlyAmount,
        total_months: totalMonths,
        start_date: startDate
      });

      console.log(`[pdfParser] Installment detected (no bank offset): "${merchantPrefix}" ${totalMonths}x Rp${monthlyAmount.toLocaleString()} start ${startDate}`);
      return false; // Exclude from transactions
    });

    // 2. Process active installments where the 0/N setup row is not in this PDF (i.e. already running)
    filteredTransactions.forEach(tx => {
      if (tx.amount >= 0) return; // Must be a charge
      
      const activeMatch = tx.description.match(activeInstallmentPattern);
      if (activeMatch) {
        // Skip interest lines (e.g. TOKOPEDIA : 02/06 INT 462.93)
        if (/\bINT\b/i.test(tx.description)) return;

        const merchantPrefix = activeMatch[1].trim();
        const currentMonth = parseInt(activeMatch[2]);
        const totalMonths = parseInt(activeMatch[3]);

        if (currentMonth > 0 && totalMonths > 0) {
          // Check if we already detected this installment based on description AND monthly amount
          const monthlyAmount = Math.abs(tx.amount);
          const isAlreadyTracked = detectedInstallments.some(inst => 
            inst.description.toLowerCase().substring(0, 10) === merchantPrefix.toLowerCase().substring(0, 10) &&
            Math.abs(inst.monthly_amount - monthlyAmount) < 10
          );

          if (!isAlreadyTracked) {
            // Deduce start_date based on currentMonth (currentMonth = 2 means started 1 month ago)
            const txDateObj = new Date(tx.date);
            txDateObj.setMonth(txDateObj.getMonth() - (currentMonth - 1));
            const inferredStartDate = txDateObj.toISOString().split('T')[0];
            
            detectedInstallments.push({
              description: merchantPrefix,
              total_amount: monthlyAmount * totalMonths,
              monthly_amount: monthlyAmount,
              total_months: totalMonths,
              start_date: inferredStartDate
            });
            console.log(`[pdfParser] Active Running Installment auto-detected: "${merchantPrefix}" (${currentMonth}/${totalMonths}) monthly: Rp${monthlyAmount.toLocaleString()} inferred start: ${inferredStartDate}`);
          }
        }
      }
    });

      return { transactions: filteredTransactions, detectedInstallments, creditLimit, billingCycleDate, dueDate };
  },

  // 6. Generic Parser / Fallback
  generic(text) {
    const transactions = [];
    const lines = text.split('\n');
    const year = extractYear(text);
    
    // Look for lines containing a date format and numbers that resemble transaction values
    // DD/MM or DD-MM or DD-MM-YYYY
    const dateRegex = /(\b\d{2}[\/\-]\d{2}(?:[\/\-]\d{2,4})?\b)/;
    const amountRegex = /(\b\d{1,3}(?:\.\d{3})+(?:\,\d{2})?\b|\b\d{1,3}(?:\,\d{3})+(?:\.\d{2})?\b|[\d.]+\,\d{2}(?!\d)|[\d,]+\.\d{2}(?!\d))/g;

    for (const line of lines) {
      const trimmed = line.trim();
      const dateMatch = trimmed.match(dateRegex);
      
      if (dateMatch) {
        // Find all numbers in the line that could be amounts
        const amounts = trimmed.match(amountRegex);
        if (amounts && amounts.length > 0) {
          // Take the last amount found as the transaction amount (often balance is last, let's take the first or second)
          const amountStr = amounts[0];
          const amountValue = parseAmount(amountStr);
          
          if (amountValue > 100) { // filter out tiny amounts or wrong matches
            // Clean up the text by removing date and amount to get the description
            let descRaw = trimmed.replace(dateMatch[0], '').replace(amountStr, '');
            
            // Deduce date
            let formattedDate = `${year}-01-01`;
            const dateParts = dateMatch[0].split(/[\/\-]/);
            if (dateParts.length >= 2) {
              let day = dateParts[0];
              let month = dateParts[1];
              let yr = dateParts[2] ? (dateParts[2].length === 2 ? '20' + dateParts[2] : dateParts[2]) : year;
              formattedDate = `${yr}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            
            // Check for negative indicator in desc
            const isNegative = /DEBET|DEBIT|DB|MINUS|BIAYA|PEMBELIAN/i.test(trimmed) || (!/CREDIT|KREDIT|CR|PEMBAYARAN|SALDO DITERIMA/i.test(trimmed));
            const finalAmount = isNegative ? -amountValue : amountValue;
            
            const cleanDesc = cleanDescription(descRaw);
            
            transactions.push({
              date: formattedDate,
              description: cleanDesc,
              amount: finalAmount,
              category: autoCategorize(cleanDesc)
            });
          }
        }
      }
    }
    return transactions;
  }
};

/**
 * Main parse statement function
 */
async function parseStatement(pdfBuffer, password = '') {
  const text = await extractTextFromPDF(pdfBuffer, password);
  
  const textUpper = text.toUpperCase();
  let parsedTransactions = [];
  let detectedInstallments = [];
  let creditLimit = null;
  let currentBill = null;
  let installmentCommitment = null;
  let statementDate = null;
  let billingCycleDate = null;
  let dueDate = null;
  let bankName = 'Unknown';
  let statementType = 'Generic';

  if (textUpper.includes('TAHAPAN') && textUpper.includes('BCA')) {
    bankName = 'BCA';
    statementType = 'Bank Account';
    parsedTransactions = Parsers.bcaBank(text);
  } else if (
    textUpper.includes('KARTU KREDIT BCA') ||
    textUpper.includes('CREDIT CARD BCA') ||
    textUpper.includes('REKENING KARTU KREDIT') ||
    (textUpper.includes('BCA') && textUpper.includes('TAGIHAN') && textUpper.includes('PEMBAYARAN MINIMUM'))
  ) {
    bankName = 'BCA';
    statementType = 'Credit Card';
    const bcaResult = Parsers.bcaCreditCard(text);
    parsedTransactions = bcaResult.transactions;
    dueDate = bcaResult.dueDate;
    billingCycleDate = bcaResult.billingCycleDate;
    creditLimit = bcaResult.creditLimit;
    currentBill = bcaResult.currentBill;
    installmentCommitment = bcaResult.installmentCommitment;
    statementDate = bcaResult.statementDate;
    detectedInstallments = bcaResult.detectedInstallments || [];
  } else if (textUpper.includes('BNI') && (textUpper.includes('MUTASI REKENING') || textUpper.includes('LAPORAN MUTASI'))) {
    bankName = 'BNI';
    statementType = 'Bank Account';
    parsedTransactions = Parsers.bniBank(text);
  } else if (textUpper.includes('BNI') && (textUpper.includes('KARTU KREDIT') || textUpper.includes('BILLING STATEMENT') || textUpper.includes('EBILLING') || textUpper.includes('TAGIHAN') || textUpper.includes('CREDIT CARD'))) {
    bankName = 'BNI';
    statementType = 'Credit Card';
    // bniCreditCard returns { transactions, detectedInstallments }
    const bniCcResult = Parsers.bniCreditCard(text);
    parsedTransactions = bniCcResult.transactions;
    detectedInstallments = bniCcResult.detectedInstallments || [];
    creditLimit = bniCcResult.creditLimit;
    billingCycleDate = bniCcResult.billingCycleDate;
    dueDate = bniCcResult.dueDate;
  } else if (textUpper.includes('MANDIRI') && (textUpper.includes('REKENING KORAN') || textUpper.includes('MUTASI REKENING'))) {
    bankName = 'Mandiri';
    statementType = 'Bank Account';
    parsedTransactions = Parsers.mandiriBank(text);
  } else if (textUpper.includes('MANDIRI') && (textUpper.includes('KARTU KREDIT') || textUpper.includes('BILLING STATEMENT'))) {
    bankName = 'Mandiri';
    statementType = 'Credit Card';
    parsedTransactions = Parsers.mandiriCreditCard(text);
  } else {
    // Try other keywords or generic fallback
    if (textUpper.includes('JENIUS') || textUpper.includes('BTPN')) {
      bankName = 'Jenius';
      statementType = 'Bank Account';
    }
    parsedTransactions = Parsers.generic(text);
  }

  // Filter out any duplicates and invalid amounts
  const validTransactions = parsedTransactions.filter(tx => tx.amount !== 0 && tx.description.length > 2);

  return {
    bankName,
    statementType,
    transactionCount: validTransactions.length,
    transactions: validTransactions,
    detectedInstallments,
    creditLimit,
    currentBill,
    installmentCommitment,
    statementDate,
    billingCycleDate,
    dueDate
  };
}

module.exports = {
  extractTextFromPDF,
  parseStatement,
  parseAmount,
  autoCategorize
};
