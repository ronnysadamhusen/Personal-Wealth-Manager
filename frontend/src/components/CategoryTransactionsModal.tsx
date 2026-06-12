import { useEffect, useState } from 'react';
import { API_URL } from '../constants';
import { formatIDR } from '../utils/format';
import { useApp } from '../context/AppContext';

interface Props {
  categoryName: string;
  onClose: () => void;
  onCategoryChanged: () => void;
}

export default function CategoryTransactionsModal({ categoryName, onClose, onCategoryChanged }: Props) {
  const { groupedCategories, dbCategories } = useApp();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [changedCount, setChangedCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/transactions?category=${encodeURIComponent(categoryName)}`)
      .then(r => r.json())
      .then(data => { setTransactions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [categoryName]);

  const startEdit = (tx: any) => {
    setEditingTxId(tx.id);
    setNewCategory(tx.category);
  };

  const cancelEdit = () => setEditingTxId(null);

  const handleSaveCategory = async (tx: any) => {
    if (!newCategory || newCategory === tx.category) { cancelEdit(); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/transactions/${tx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: tx.account_id,
          date: tx.date,
          booking_date: tx.booking_date || tx.date,
          description: tx.description,
          amount: tx.amount,
          category: newCategory,
          note: tx.note || null,
          location_merchant: tx.location_merchant || null,
          product_service: tx.product_service || null,
          debt_receivable_id: tx.debt_receivable_id || null,
        }),
      });
      if (res.ok) {
        setTransactions(prev => prev.filter(t => t.id !== tx.id));
        setEditingTxId(null);
        setChangedCount(c => c + 1);
        onCategoryChanged();
      }
    } finally {
      setSaving(false);
    }
  };

  const totalOriginal = transactions.length + changedCount;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#1e1f2e',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px', width: '100%', maxWidth: '860px',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              Transaksi: <span style={{ color: 'var(--color-primary)' }}>{categoryName}</span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
              {!loading && (
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  {transactions.length} transaksi tersisa dari {totalOriginal}
                </span>
              )}
              {changedCount > 0 && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.5rem',
                  borderRadius: '999px', background: 'rgba(16,185,129,0.12)',
                  color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)',
                }}>
                  {changedCount} dipindahkan
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: 'var(--color-text-muted)', fontSize: '1.2rem',
            cursor: 'pointer', padding: '0.25rem', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Memuat transaksi...
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✅</div>
              <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.9rem' }}>
                {changedCount > 0
                  ? `Semua ${changedCount} transaksi berhasil dipindahkan ke kategori lain.`
                  : 'Tidak ada transaksi untuk kategori ini.'}
              </p>
            </div>
          ) : (
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '95px' }}>Tanggal</th>
                  <th>Deskripsi</th>
                  <th style={{ width: '130px' }}>Akun</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Jumlah</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <>
                    {/* Main row */}
                    <tr
                      key={tx.id}
                      style={{
                        background: editingTxId === tx.id
                          ? 'rgba(99,102,241,0.06)'
                          : undefined,
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {tx.date}
                      </td>
                      <td style={{
                        fontSize: '0.85rem', maxWidth: '260px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {tx.description}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {tx.account_name}
                      </td>
                      <td style={{
                        textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap',
                        color: tx.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                      }}>
                        {formatIDR(tx.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {editingTxId === tx.id ? (
                          <button
                            className="btn"
                            style={{
                              padding: '0.25rem 0.6rem', fontSize: '0.75rem', margin: 0,
                              color: 'var(--color-text-muted)',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '6px',
                            }}
                            onClick={cancelEdit}
                          >
                            Batal
                          </button>
                        ) : (
                          <button
                            className="btn"
                            style={{
                              padding: '0.25rem 0.6rem', fontSize: '0.75rem', margin: 0,
                              color: 'var(--color-primary)',
                              background: 'rgba(99,102,241,0.08)',
                              border: '1px solid rgba(99,102,241,0.2)',
                              borderRadius: '6px',
                            }}
                            onClick={() => startEdit(tx)}
                          >
                            ✏️ Pindah
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Accordion edit row */}
                    {editingTxId === tx.id && (
                      <tr key={`${tx.id}-edit`} style={{ background: 'rgba(99,102,241,0.04)' }}>
                        <td colSpan={5} style={{ padding: '0.75rem 1.25rem 1rem' }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            flexWrap: 'wrap',
                          }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                              Pindahkan ke:
                            </span>
                            <select
                              className="form-control"
                              value={newCategory}
                              onChange={e => setNewCategory(e.target.value)}
                              style={{ flex: 1, minWidth: '200px', maxWidth: '360px', margin: 0, fontSize: '0.85rem' }}
                              autoFocus
                            >
                              {groupedCategories.map(g => (
                                <optgroup key={g.parent.id} label={g.parent.name}>
                                  <option value={g.parent.name}>{g.parent.name}</option>
                                  {g.subs.map(s => (
                                    <option key={s.id} value={s.name}>↳ {s.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                              {!dbCategories.some(c => c.name === newCategory) && newCategory && (
                                <option value={newCategory}>{newCategory}</option>
                              )}
                            </select>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', margin: 0, whiteSpace: 'nowrap' }}
                              onClick={() => handleSaveCategory(tx)}
                              disabled={saving || !newCategory || newCategory === tx.category}
                            >
                              {saving ? 'Menyimpan...' : 'Simpan'}
                            </button>
                          </div>
                          {newCategory === tx.category && (
                            <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'rgba(245,158,11,0.8)' }}>
                              ⚠ Pilih kategori yang berbeda untuk memindahkan transaksi ini.
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
