import React, { useState, useMemo } from 'react';
import Tesseract from 'tesseract.js';
import { API_URL } from '../constants';
import { useApp } from '../context/AppContext';

export default function OcrView() {
  const { accounts, dbCategories, groupedCategories, loading, setErrorMsg, fetchData, setActiveTab } = useApp();

  // Expense-capable categories for the verification form's category dropdown.
  const expenseCategories = useMemo(() => {
    const result: { parent: any; subs: any[] }[] = [];
    groupedCategories.forEach((group: any) => {
      const parentMatch = group.parent.type === 'both' || group.parent.type === 'expense';
      const matchedSubs = group.subs.filter((sub: any) => sub.type === 'both' || sub.type === 'expense');
      if (parentMatch || matchedSubs.length > 0) {
        result.push({ parent: group.parent, subs: matchedSubs });
      }
    });
    return result;
  }, [groupedCategories]);

  // OCR SCANNER STATES
  const [, setOcrImageFile] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<string>('');
  const [ocrProgressPct, setOcrProgressPct] = useState<number>(0);
  const [ocrRawText, setOcrRawText] = useState<string>('');
  
  // OCR Form States (for edit/verification before saving)
  const [ocrFormAccId, setOcrFormAccId] = useState<string>('');
  const [ocrFormDate, setOcrFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ocrFormMerchant, setOcrFormMerchant] = useState<string>('');
  const [ocrFormAmount, setOcrFormAmount] = useState<string>('');
  const [ocrFormCategory, setOcrFormCategory] = useState<string>('Others');

  // OCR Text Extraction Parser Helper
  const parseReceiptText = (text: string) => {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    
    // Heuristic 1: Store/Merchant Name
    let merchant = 'Unknown Merchant';
    if (lines.length > 0) {
      const candidate = lines[0].replace(/[^a-zA-Z0-9\s&.-]/g, '').trim();
      if (candidate.length > 2) {
        merchant = candidate;
      } else if (lines.length > 1) {
        const candidate2 = lines[1].replace(/[^a-zA-Z0-9\s&.-]/g, '').trim();
        if (candidate2.length > 2) merchant = candidate2;
      }
    }
    
    // Heuristic 2: Total Amount
    let amount = 0;
    const allNumbers: number[] = [];
    
    lines.forEach(line => {
      if (/total|grand|bayar|netto|amount|rp|idr|subtotal/i.test(line)) {
        const match = line.match(/([\d.,\s]+)/);
        if (match) {
          const cleaned = match[0].replace(/[^\d]/g, '');
          const val = parseInt(cleaned, 10);
          if (val > 100 && val < 100000000) {
            allNumbers.push(val);
          }
        }
      }
    });

    if (allNumbers.length === 0) {
      lines.forEach(line => {
        const matches = line.match(/\b\d{1,3}(?:[.,]\d{3})+\b/g) || line.match(/\b\d{4,9}\b/g);
        if (matches) {
          matches.forEach(m => {
            const cleaned = m.replace(/[^\d]/g, '');
            const val = parseInt(cleaned, 10);
            if (val > 100 && val < 100000000) {
              allNumbers.push(val);
            }
          });
        }
      });
    }

    if (allNumbers.length > 0) {
      allNumbers.sort((a, b) => b - a);
      amount = allNumbers[0];
    }
    
    // Heuristic 3: Transaction Date
    let dateStr = new Date().toISOString().split('T')[0];
    const dateRegex = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/;
    const dateRegex2 = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/;
    
    for (const line of lines) {
      let m = line.match(dateRegex);
      if (m) {
        const day = m[1].padStart(2, '0');
        const month = m[2].padStart(2, '0');
        const year = m[3];
        if (parseInt(month) <= 12 && parseInt(day) <= 31) {
          dateStr = `${year}-${month}-${day}`;
          break;
        }
      }
      m = line.match(dateRegex2);
      if (m) {
        dateStr = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        break;
      }
    }

    // Heuristic 4: Category mapping
    let category = 'Others';
    const textLower = text.toLowerCase();
    if (textLower.includes('kopi') || textLower.includes('coffee') || textLower.includes('resto') || textLower.includes('cafe') || textLower.includes('food') || textLower.includes('makan') || textLower.includes('bakery') || textLower.includes('starbucks')) {
      category = 'Food & Dining';
    } else if (textLower.includes('baju') || textLower.includes('kaos') || textLower.includes('cell') || textLower.includes('mall') || textLower.includes('fashion') || textLower.includes('indomaret') || textLower.includes('alfamart') || textLower.includes('supermarket')) {
      category = 'Shopping & Groceries';
    } else if (textLower.includes('bensin') || textLower.includes('pertamina') || textLower.includes('grab') || textLower.includes('gojek') || textLower.includes('taxi') || textLower.includes('travel') || textLower.includes('tiket')) {
      category = 'Transportation & Travel';
    } else if (textLower.includes('apotek') || textLower.includes('obat') || textLower.includes('farmasi') || textLower.includes('doctor') || textLower.includes('clinic') || textLower.includes('sehat')) {
      category = 'Medical & Health';
    } else if (textLower.includes('bioskop') || textLower.includes('cinema') || textLower.includes('game') || textLower.includes('movie')) {
      category = 'Entertainment';
    }

    return { merchant, amount: amount > 0 ? String(amount) : '', date: dateStr, category };
  };

  const handleOcrScan = async (file: File) => {
    setOcrImageFile(file);
    setOcrPreviewUrl(URL.createObjectURL(file));
    setOcrProgress('Initializing OCR Engine...');
    setOcrProgressPct(10);
    setOcrRawText('');

    try {
      const result = await Tesseract.recognize(
        file,
        'eng', // load English language by default for fast in-browser scanning
        {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              setOcrProgress('Scanning receipt screenshot...');
              setOcrProgressPct(Math.round(20 + m.progress * 70));
            }
          }
        }
      );

      const rawText = result.data.text;
      setOcrRawText(rawText);
      setOcrProgressPct(100);
      setOcrProgress('Scan completed successfully!');

      const parsed = parseReceiptText(rawText);
      setOcrFormMerchant(parsed.merchant);
      setOcrFormAmount(parsed.amount);
      setOcrFormDate(parsed.date);
      
      const bestCat = dbCategories.find(c => c.name.toLowerCase() === parsed.category.toLowerCase())?.name || parsed.category;
      setOcrFormCategory(bestCat);

      if (accounts.length > 0 && !ocrFormAccId) {
        setOcrFormAccId(accounts[0].id);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg('Receipt OCR scan failed: ' + err.message);
      setOcrProgress('Error occurred during scanning.');
    }
  };

  const handleSaveOcrTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocrFormAccId || !ocrFormMerchant || !ocrFormAmount || !ocrFormDate) return;

    try {
      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: ocrFormAccId,
          date: ocrFormDate,
          description: `Receipt: ${ocrFormMerchant}`,
          amount: -parseFloat(ocrFormAmount),
          category: ocrFormCategory
        })
      });

      if (res.ok) {
        setOcrImageFile(null);
        setOcrPreviewUrl('');
        setOcrRawText('');
        setOcrFormMerchant('');
        setOcrFormAmount('');
        setOcrProgress('');
        setOcrProgressPct(0);
        setActiveTab('dashboard');
        fetchData();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Failed to save receipt transaction');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
          <div style={{ paddingTop: '0.5rem' }}><div className="grid-cols-2" style={{ gridTemplateColumns: '1.1fr 1.9fr', gap: '2rem' }}>
                {/* Left Column: Image upload & progress */}
                <div className="glass-panel card-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.5rem' }}>Receipt OCR Scanner</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      Upload a photo or screenshot of your shopping receipt. Our local OCR engine will read it and auto-fill the expense transaction details.
                    </p>
                  </div>

                  {/* Upload area */}
                  {!ocrPreviewUrl ? (
                    <div 
                      className="drag-drop-zone"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleOcrScan(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          if (e.target.files && e.target.files[0]) {
                            handleOcrScan(e.target.files[0]);
                          }
                        };
                        input.click();
                      }}
                      style={{ minHeight: '200px' }}
                    >
                      <div className="drag-icon">📷</div>
                      <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Upload Receipt Screenshot</strong>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>or drag & drop image here</span>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                      <img src={ocrPreviewUrl} alt="Receipt Preview" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '350px', objectFit: 'contain' }} />
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ position: 'absolute', top: '10px', right: '10px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'rgba(20,20,20,0.8)' }}
                        onClick={() => {
                          setOcrImageFile(null);
                          setOcrPreviewUrl('');
                          setOcrRawText('');
                          setOcrFormMerchant('');
                          setOcrFormAmount('');
                          setOcrProgress('');
                          setOcrProgressPct(0);
                        }}
                      >
                        Clear Image
                      </button>
                    </div>
                  )}

                  {/* Scanning progress */}
                  {ocrProgress && (
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        <strong>{ocrProgress}</strong>
                        <span className="text-primary">{ocrProgressPct}%</span>
                      </div>
                      <div className="progress-track" style={{ height: '6px' }}>
                        <div 
                          className="progress-fill success" 
                          style={{ width: `${ocrProgressPct}%`, transition: 'width 0.3s ease' }} 
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Verification Form & Raw Text */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {ocrPreviewUrl && (
                    <div className="glass-panel card-content">
                      <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--color-success)' }}>✓</span> Verify Extracted Expense
                      </h3>

                      <form onSubmit={handleSaveOcrTransaction}>
                        <div className="form-group">
                          <label>Charge to Account / Card</label>
                          <select 
                            className="form-control"
                            value={ocrFormAccId}
                            onChange={(e) => setOcrFormAccId(e.target.value)}
                            required
                          >
                            <option value="">-- Choose Account --</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>{a.name} ({a.type === 'bank' ? 'Bank' : a.type === 'cash' ? 'Cash' : 'CC'})</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid-cols-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', margin: 0, gap: '1rem' }}>
                          <div className="form-group">
                            <label>Merchant / Store Name</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              placeholder="Store Name"
                              value={ocrFormMerchant}
                              onChange={(e) => setOcrFormMerchant(e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Transaction Date</label>
                            <input 
                              type="date" 
                              className="form-control" 
                              value={ocrFormDate}
                              onChange={(e) => setOcrFormDate(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div className="grid-cols-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', margin: 0, gap: '1rem' }}>
                          <div className="form-group">
                            <label>Total Expense Amount (IDR)</label>
                            <input 
                              type="number" 
                              className="form-control" 
                              placeholder="Amount in IDR"
                              value={ocrFormAmount}
                              onChange={(e) => setOcrFormAmount(e.target.value)}
                              style={{ fontWeight: 700, color: 'var(--color-danger)' }}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Category</label>
                            <select 
                              className="form-control"
                              value={ocrFormCategory}
                              onChange={(e) => setOcrFormCategory(e.target.value)}
                              required
                            >
                              {expenseCategories.map(group => (
                                <optgroup key={group.parent.id} label={group.parent.name}>
                                  <option value={group.parent.name}>{group.parent.name}</option>
                                  {group.subs.map(sub => (
                                    <option key={sub.id} value={sub.name}>↳ {sub.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                        </div>

                        <button 
                          type="submit" 
                          className="btn btn-primary" 
                          style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', marginTop: '1rem' }}
                          disabled={loading || !ocrFormAccId}
                        >
                          Save Scanned Expense Transaction
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Raw Extracted Text Reference Panel */}
                  {ocrRawText && (
                    <div className="glass-panel card-content">
                      <h4 style={{ marginBottom: '0.75rem', color: 'var(--color-text-muted)' }}>Raw Extracted Receipt Text</h4>
                      <pre style={{ 
                        whiteSpace: 'pre-wrap', 
                        background: 'rgba(0,0,0,0.3)', 
                        padding: '1rem', 
                        borderRadius: '8px', 
                        fontSize: '0.8rem', 
                        maxHeight: '180px', 
                        overflowY: 'auto',
                        border: '1px solid var(--border-color)',
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)'
                      }}>
                        {ocrRawText}
                      </pre>
                    </div>
                  )}
                </div>
              </div></div>
  );
}
