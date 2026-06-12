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

  const handleSaveCategory = async (tx: any) => {
    if (!newCategory || newCategory === tx.category) { setEditingTxId(null); return; }
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
        setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, category: newCategory } : t));
        setEditingTxId(null);
        onCategoryChanged();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#1e1f2e', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px', width: '100%', maxWidth: '820px',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              Transaksi: <span style={{ color: 'var(--color-primary)' }}>{categoryName}</span>
            </h3>
            {!loading && (
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {transactions.length} transaksi ditemukan
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem' }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Memuat transaksi...
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Tidak ada transaksi untuk kategori ini.
            </div>
          ) : (
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Tanggal</th>
                  <th>Deskripsi</th>
                  <th style={{ width: '130px' }}>Akun</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Jumlah</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Kategori</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {tx.date}
                    </td>
                    <td style={{ fontSize: '0.85rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.description}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {tx.account_name}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap',
                      color: tx.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {formatIDR(tx.amount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {editingTxId === tx.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'stretch' }}>
                          <select
                            className="form-control"
                            value={newCategory}
                            onChange={e => setNewCategory(e.target.value)}
                            style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.75rem', minWidth: '120px' }}
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
                            {/* fallback: kategori yang tidak ada di tree */}
                            {!dbCategories.some(c => c.name === newCategory) && newCategory && (
                              <option value={newCategory}>{newCategory}</option>
                            )}
                          </select>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              className="btn btn-primary"
                              style={{ flex: 1, padding: '0.2rem', fontSize: '0.72rem', margin: 0 }}
                              onClick={() => handleSaveCategory(tx)}
                              disabled={saving}
                            >
                              {saving ? '...' : 'Simpan'}
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ flex: 1, padding: '0.2rem', fontSize: '0.72rem', margin: 0 }}
                              onClick={() => setEditingTxId(null)}
                              disabled={saving}
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', margin: 0 }}
                          onClick={() => startEdit(tx)}
                          title="Ganti kategori transaksi ini"
                        >
                          ✏️ Kategori
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
