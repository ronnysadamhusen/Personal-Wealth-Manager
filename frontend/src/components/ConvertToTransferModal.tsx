import { useEffect, useState } from 'react';
import { API_URL } from '../constants';
import { formatIDR } from '../utils/format';
import { useApp } from '../context/AppContext';

interface Props {
  tx: any;
  onClose: () => void;
  onConverted: () => void;
}

export default function ConvertToTransferModal({ tx, onClose, onConverted }: Props) {
  const { accounts } = useApp();
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [autoCreateAccId, setAutoCreateAccId] = useState('');
  const [autoCreateDate, setAutoCreateDate] = useState(tx.date);

  useEffect(() => {
    setLoadingMatches(true);
    fetch(`${API_URL}/transactions/transfer-match?amount=${Math.abs(tx.amount)}&date=${tx.date}&account_id=${tx.account_id}`)
      .then(r => r.json())
      .then(data => {
        setMatches(Array.isArray(data) ? data : []);
        if (data.length === 1) setSelectedMatchId(data[0].id);
      })
      .finally(() => setLoadingMatches(false));
  }, [tx]);

  const isDebit = tx.amount < 0;

  const handleConvert = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/transfers/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx_id: tx.id,
          counterpart_id: selectedMatchId || undefined,
          counterpart_account_id: !selectedMatchId && autoCreateAccId ? autoCreateAccId : undefined,
          counterpart_date: autoCreateDate !== tx.date ? autoCreateDate : undefined,
          description: description || undefined,
        }),
      });
      if (res.ok) {
        onConverted();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal mengkonversi ke transfer');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#1e1f2e',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px', width: '100%', maxWidth: '560px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>🔁 Tandai sebagai Transfer</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Transaksi ini terdeteksi sebagai kemungkinan transfer antar akun
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: 'var(--color-text-muted)', fontSize: '1.2rem', cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Detected transaction */}
          <div style={{
            padding: '0.85rem 1rem', borderRadius: '8px',
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Transaksi yang terdeteksi
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{tx.description}</div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              <span>{tx.date}</span>
              <span>{tx.account_name}</span>
              <span style={{ fontWeight: 600, color: tx.amount < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {formatIDR(tx.amount)}
              </span>
            </div>
          </div>

          {/* Counterpart */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              {isDebit ? 'Transaksi masuk di akun tujuan (counterpart):' : 'Transaksi keluar di akun sumber (counterpart):'}
            </label>

            {loadingMatches ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: 0 }}>Mencari transaksi yang cocok...</p>
            ) : matches.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {matches.map(m => (
                  <label key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.65rem 0.85rem', borderRadius: '8px', cursor: 'pointer',
                    border: `1px solid ${selectedMatchId === m.id ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    background: selectedMatchId === m.id ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.15s',
                  }}>
                    <input
                      type="radio" name="match" value={m.id}
                      checked={selectedMatchId === m.id}
                      onChange={() => setSelectedMatchId(m.id)}
                      style={{ accentColor: 'var(--color-success)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{m.description}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.1rem' }}>
                        <span>{m.date}</span>
                        <span>{m.account_name}</span>
                        <span style={{ fontWeight: 600, color: m.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {formatIDR(m.amount)}
                        </span>
                      </div>
                    </div>
                    {selectedMatchId === m.id && <span style={{ color: 'var(--color-success)', fontSize: '1rem' }}>✓</span>}
                  </label>
                ))}
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 0.85rem', borderRadius: '8px', cursor: 'pointer',
                  border: `1px solid ${selectedMatchId === '' ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  background: selectedMatchId === '' ? 'rgba(245,158,11,0.06)' : 'transparent',
                  fontSize: '0.8rem', color: 'var(--color-text-muted)',
                }}>
                  <input type="radio" name="match" value=""
                    checked={selectedMatchId === ''}
                    onChange={() => setSelectedMatchId('')}
                  />
                  Tidak ada yang cocok — tandai tanpa counterpart
                </label>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{
                  padding: '0.65rem 0.85rem', borderRadius: '8px',
                  background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                  fontSize: '0.82rem', color: 'var(--color-text-muted)',
                }}>
                  Tidak ditemukan transaksi dengan jumlah sama di akun lain (±2 hari). Pilih akun asal untuk membuat transaksi counterpart secara otomatis — atau biarkan kosong untuk tandai tanpa counterpart.
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    {isDebit ? 'Akun tujuan (buat counterpart otomatis):' : 'Akun sumber (buat counterpart otomatis):'}
                  </label>
                  <select
                    className="form-control"
                    value={autoCreateAccId}
                    onChange={e => setAutoCreateAccId(e.target.value)}
                    style={{ margin: 0, fontSize: '0.85rem' }}
                  >
                    <option value="">-- Biarkan kosong (tandai tanpa counterpart) --</option>
                    {accounts
                      .filter(a => a.id !== tx.account_id)
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type === 'bank' ? 'Bank' : a.type === 'cash' ? 'Cash/Wallet' : 'Credit Card'})
                        </option>
                      ))}
                  </select>
                </div>
                {autoCreateAccId && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                      Tanggal transaksi counterpart:
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={autoCreateDate}
                      onChange={e => setAutoCreateDate(e.target.value)}
                      style={{ margin: 0, fontSize: '0.85rem' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description override */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>
              Keterangan transfer (opsional)
            </label>
            <input
              type="text"
              className="form-control"
              placeholder={tx.description}
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ margin: 0, fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: '0.75rem', justifyContent: 'flex-end',
          padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ margin: 0 }}>Batal</button>
          <button
            className="btn btn-primary"
            onClick={handleConvert}
            disabled={saving}
            style={{ margin: 0 }}
          >
            {saving ? 'Memproses...' : '🔁 Jadikan Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
