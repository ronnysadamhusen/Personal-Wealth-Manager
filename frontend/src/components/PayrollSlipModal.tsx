import { useState, useRef } from 'react';
import { API_URL } from '../constants';
import { useApp } from '../context/AppContext';

interface PayrollItem {
  label: string;
  amount: string;
  type: 'income' | 'deduction';
}

interface Props {
  account: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function PayrollSlipModal({ account, onClose, onSaved }: Props) {
  const { accounts, renderAmount, savedPasswords } = useApp();

  // Step 1: upload
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState('');
  const [rawText, setRawText] = useState('');

  // Step 2: review
  const [period, setPeriod] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [destAccountId, setDestAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const step = items.length > 0 ? 2 : 1;

  const bankAccounts = accounts.filter(a => a.type === 'bank' || a.type === 'cash');

  const incomeItems = items.filter(i => i.type === 'income');
  const deductionItems = items.filter(i => i.type === 'deduction');
  const parseAmt = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  const grossIncome = incomeItems.reduce((s, i) => s + parseAmt(i.amount), 0);
  const totalDeductions = deductionItems.reduce((s, i) => s + parseAmt(i.amount), 0);
  const netIncome = grossIncome - totalDeductions;

  const handleFileSelect = (f: File) => {
    setFile(f);
    setParseError('');
    setRawText('');
    setItems([]);
  };

  const handleParse = async () => {
    if (!file) return;
    setParseLoading(true);
    setParseError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (password) formData.append('password', password);

      const res = await fetch(`${API_URL}/payroll/parse`, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'PASSWORD_REQUIRED_OR_INCORRECT') {
          setParseError('PDF terenkripsi. Masukkan password slip gaji Anda.');
        } else {
          setParseError(data.error || 'Gagal memproses PDF');
        }
        return;
      }

      setRawText(data.raw_text || '');

      if (data.extracted) {
        const ext = data.extracted;
        if (ext.period) setPeriod(ext.period);
        if (ext.date) setDate(ext.date);
        if (ext.items && Array.isArray(ext.items)) {
          setItems(ext.items.map((i: any) => ({
            label: i.label,
            amount: Number(i.amount).toLocaleString('id-ID'),
            type: i.type
          })));
        }
      } else {
        // AI not available — go to manual mode with empty table
        setItems([{ label: 'Gaji Pokok', amount: '', type: 'income' }]);
        setParseError('AI tidak tersedia. Silakan isi komponen gaji secara manual.');
      }
    } catch (err: any) {
      setParseError('Error: ' + err.message);
    } finally {
      setParseLoading(false);
    }
  };

  const updateItem = (idx: number, field: keyof PayrollItem, val: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = (type: 'income' | 'deduction') => {
    setItems(prev => [...prev, { label: '', amount: '', type }]);
  };

  const handleSave = async () => {
    if (!period || !date || items.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        account_id: account.id,
        period,
        date,
        items: items.map(i => ({ label: i.label, amount: parseAmt(i.amount), type: i.type })),
        destination_account_id: destAccountId || null
      };
      const res = await fetch(`${API_URL}/payroll/slips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const err = await res.json();
        setParseError(err.error || 'Gagal menyimpan');
      }
    } catch (err: any) {
      setParseError('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>
            Input Slip Gaji — <span style={{ color: 'var(--color-primary)' }}>{account.name}</span>
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
        </div>

        {parseError && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '0.88rem' }}>
            {parseError}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 1 && (
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Upload file PDF slip gaji. AI akan mengekstrak komponen pendapatan dan potongan secara otomatis.
            </p>

            {!file ? (
              <div
                className="drag-drop-zone"
                style={{ minHeight: '160px', cursor: 'pointer' }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]); }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📄</div>
                <strong>Upload Slip Gaji PDF</strong>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', display: 'block', marginTop: '0.3rem' }}>atau drag & drop di sini</span>
                <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{file.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }} onClick={() => { setFile(null); setParseError(''); }}>Ganti</button>
              </div>
            )}

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Password PDF <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>(kosongkan jika tidak ada)</span></label>
              <input
                type="password"
                className="form-control"
                placeholder="Password slip gaji..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {savedPasswords.length > 0 && (
                <small style={{ color: 'var(--color-text-muted)' }}>Password tersimpan ({savedPasswords.length}) akan dicoba otomatis.</small>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={!file || parseLoading}
                onClick={handleParse}
              >
                {parseLoading ? '⏳ Memproses PDF...' : '🤖 Parse dengan AI'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setItems([{ label: 'Gaji Pokok', amount: '', type: 'income' }]); setPeriod(new Date().toISOString().substring(0, 7)); }}
              >
                Input Manual
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <div>
            <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label>Periode Gaji</label>
                <input type="month" className="form-control" value={period} onChange={(e) => setPeriod(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Tanggal Gajian</label>
                <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>

            {/* Income Items */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, color: 'var(--color-success)' }}>Pendapatan</h4>
                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.7rem' }} onClick={() => addItem('income')}>+ Tambah</button>
              </div>
              {incomeItems.map((item) => {
                const globalIdx = items.indexOf(item);
                return (
                  <div key={globalIdx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nama komponen"
                      value={item.label}
                      onChange={(e) => updateItem(globalIdx, 'label', e.target.value)}
                      style={{ flex: 2 }}
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nominal"
                      value={item.amount}
                      onFocus={(e) => { const raw = String(parseAmt(e.target.value) || ''); updateItem(globalIdx, 'amount', raw); }}
                      onBlur={(e) => { const n = parseAmt(e.target.value); if (n) updateItem(globalIdx, 'amount', n.toLocaleString('id-ID')); }}
                      onChange={(e) => updateItem(globalIdx, 'amount', e.target.value)}
                      style={{ flex: 1.5, color: 'var(--color-success)' }}
                    />
                    <button type="button" onClick={() => removeItem(globalIdx)} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.3rem' }}>✕</button>
                  </div>
                );
              })}
            </div>

            {/* Deduction Items */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, color: 'var(--color-danger)' }}>Potongan</h4>
                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.7rem' }} onClick={() => addItem('deduction')}>+ Tambah</button>
              </div>
              {deductionItems.map((item) => {
                const globalIdx = items.indexOf(item);
                return (
                  <div key={globalIdx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nama potongan"
                      value={item.label}
                      onChange={(e) => updateItem(globalIdx, 'label', e.target.value)}
                      style={{ flex: 2 }}
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nominal"
                      value={item.amount}
                      onFocus={(e) => { const raw = String(parseAmt(e.target.value) || ''); updateItem(globalIdx, 'amount', raw); }}
                      onBlur={(e) => { const n = parseAmt(e.target.value); if (n) updateItem(globalIdx, 'amount', n.toLocaleString('id-ID')); }}
                      onChange={(e) => updateItem(globalIdx, 'amount', e.target.value)}
                      style={{ flex: 1.5, color: 'var(--color-danger)' }}
                    />
                    <button type="button" onClick={() => removeItem(globalIdx)} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.3rem' }}>✕</button>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Gaji Kotor</span>
                <strong style={{ color: 'var(--color-success)' }}>{renderAmount(grossIncome)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Potongan</span>
                <strong style={{ color: 'var(--color-danger)' }}>-{renderAmount(totalDeductions)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem', fontSize: '1.1rem' }}>
                <strong>Gaji Bersih</strong>
                <strong style={{ color: 'var(--color-primary)', fontSize: '1.2rem' }}>{renderAmount(netIncome)}</strong>
              </div>
            </div>

            {/* Destination Account */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label>Transfer Gaji Bersih ke Rekening</label>
              <select className="form-control" value={destAccountId} onChange={(e) => setDestAccountId(e.target.value)}>
                <option value="">— Tidak ada transfer otomatis —</option>
                {bankAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {destAccountId && (
                <small style={{ color: 'var(--color-text-muted)' }}>
                  Sistem akan membuat transfer {renderAmount(netIncome)} ke rekening terpilih secara otomatis.
                </small>
              )}
            </div>

            {rawText && (
              <div style={{ marginBottom: '1rem' }}>
                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }} onClick={() => setShowRaw(!showRaw)}>
                  {showRaw ? '▲ Sembunyikan' : '▼ Lihat'} Teks PDF Mentah
                </button>
                {showRaw && (
                  <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', maxHeight: '200px', overflowY: 'auto', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                    {rawText}
                  </pre>
                )}
              </div>
            )}

            {parseError && (
              <div style={{ marginBottom: '1rem', color: 'var(--color-warning)', fontSize: '0.85rem' }}>{parseError}</div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setItems([])}>← Kembali</button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={saving || !period || items.length === 0}
                onClick={handleSave}
              >
                {saving ? '⏳ Menyimpan...' : '💾 Simpan Slip Gaji'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
