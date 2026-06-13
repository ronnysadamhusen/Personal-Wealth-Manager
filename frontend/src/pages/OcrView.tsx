import React, { useState, useMemo } from 'react';
import { API_URL } from '../constants';
import { useApp } from '../context/AppContext';

export default function OcrView() {
  const { accounts, dbCategories, groupedCategories, loading, setErrorMsg, fetchData, navigateTo } = useApp();

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

  const [, setOcrImageFile] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<string>('');
  const [ocrProgressPct, setOcrProgressPct] = useState<number>(0);
  const [ocrRawText, setOcrRawText] = useState<string>('');
  const [ocrParseMethod, setOcrParseMethod] = useState<string>('');
  const [ocrDetectedBank, setOcrDetectedBank] = useState<string>('');
  const [ocrReferenceNumber, setOcrReferenceNumber] = useState<string>('');

  const [ocrFormAccId, setOcrFormAccId] = useState<string>('');
  const [ocrFormDate, setOcrFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ocrFormMerchant, setOcrFormMerchant] = useState<string>('');
  const [ocrFormAmount, setOcrFormAmount] = useState<string>('');
  const [ocrFormCategory, setOcrFormCategory] = useState<string>('Others');

  const handleOcrScan = async (file: File) => {
    setOcrImageFile(file);
    setOcrPreviewUrl(URL.createObjectURL(file));
    setOcrProgress('Uploading and scanning receipt...');
    setOcrProgressPct(20);
    setOcrRawText('');
    setOcrParseMethod('');
    setOcrDetectedBank('');
    setOcrReferenceNumber('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      setOcrProgress('Analyzing receipt...');
      setOcrProgressPct(50);

      const res = await fetch(`${API_URL}/receipt/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Parsing failed');
      }

      const data = await res.json();

      setOcrProgressPct(100);
      setOcrProgress(data.method === 'llm' ? 'Analyzed with AI' : 'Analyzed with smart parser');
      setOcrParseMethod(data.method || 'rule-based');
      setOcrDetectedBank(data.bank || '');
      setOcrReferenceNumber(data.reference_number || '');
      setOcrRawText(data.raw_text || '');

      setOcrFormMerchant(data.merchant || '');
      setOcrFormAmount(data.amount ? String(data.amount) : '');
      setOcrFormDate(data.date || new Date().toISOString().split('T')[0]);

      const bestCat = dbCategories.find(c => c.name.toLowerCase() === (data.category || '').toLowerCase())?.name || data.category || 'Others';
      setOcrFormCategory(bestCat);

      if (accounts.length > 0 && !ocrFormAccId) {
        setOcrFormAccId(accounts[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Receipt scan failed: ' + err.message);
      setOcrProgress('Error occurred during scanning.');
      setOcrProgressPct(0);
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
          description: ocrFormMerchant,
          amount: -parseFloat(ocrFormAmount),
          category: ocrFormCategory,
          note: ocrReferenceNumber ? `Ref: ${ocrReferenceNumber}` : '',
        }),
      });

      if (res.ok) {
        setOcrImageFile(null);
        setOcrPreviewUrl('');
        setOcrRawText('');
        setOcrFormMerchant('');
        setOcrFormAmount('');
        setOcrProgress('');
        setOcrProgressPct(0);
        setOcrParseMethod('');
        setOcrDetectedBank('');
        setOcrReferenceNumber('');
        navigateTo('transactions');
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
    <div style={{ paddingTop: '0.5rem' }}>
      <div className="grid-cols-2" style={{ gridTemplateColumns: '1.1fr 1.9fr', gap: '2rem' }}>
        {/* Left Column: Image upload & progress */}
        <div className="glass-panel card-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ marginBottom: '0.5rem' }}>Receipt OCR Scanner</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Upload a photo or screenshot of your receipt. The server will read it and auto-fill the expense details.
            </p>
            {ocrDetectedBank && (
              <p style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--color-primary)' }}>
                Detected: {ocrDetectedBank}
                {ocrParseMethod === 'llm' && <span style={{ marginLeft: '0.5rem', color: 'var(--color-success)' }}>· AI-enhanced</span>}
              </p>
            )}
          </div>

          {!ocrPreviewUrl ? (
            <div
              className="drag-drop-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handleOcrScan(e.dataTransfer.files[0]);
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e: any) => {
                  if (e.target.files?.[0]) handleOcrScan(e.target.files[0]);
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

          {ocrProgress && (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <strong>{ocrProgress}</strong>
                <span style={{ color: 'var(--color-primary)' }}>{ocrProgressPct}%</span>
              </div>
              <div className="progress-track" style={{ height: '6px' }}>
                <div className="progress-fill success" style={{ width: `${ocrProgressPct}%`, transition: 'width 0.3s ease' }} />
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
                  <select className="form-control" value={ocrFormAccId} onChange={(e) => setOcrFormAccId(e.target.value)} required>
                    <option value="">-- Choose Account --</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type === 'bank' ? 'Bank' : a.type === 'cash' ? 'Cash' : 'CC'})</option>
                    ))}
                  </select>
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Merchant / Store Name</label>
                    <input type="text" className="form-control" placeholder="Store Name" value={ocrFormMerchant} onChange={(e) => setOcrFormMerchant(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Transaction Date</label>
                    <input type="date" className="form-control" value={ocrFormDate} onChange={(e) => setOcrFormDate(e.target.value)} required />
                  </div>
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Total Expense Amount (IDR)</label>
                    <input type="number" className="form-control" placeholder="Amount in IDR" value={ocrFormAmount} onChange={(e) => setOcrFormAmount(e.target.value)} style={{ fontWeight: 700, color: 'var(--color-danger)' }} required />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select className="form-control" value={ocrFormCategory} onChange={(e) => setOcrFormCategory(e.target.value)} required>
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

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', marginTop: '1rem' }} disabled={loading || !ocrFormAccId}>
                  Save Scanned Expense Transaction
                </button>
              </form>
            </div>
          )}

          {ocrRawText && (
            <div className="glass-panel card-content">
              <h4 style={{ marginBottom: '0.75rem', color: 'var(--color-text-muted)' }}>Raw Extracted Receipt Text</h4>
              <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
                {ocrRawText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
