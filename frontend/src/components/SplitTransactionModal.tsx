import { useState } from 'react';
import { formatIDR } from '../utils/format';
import AutocompleteInput from './AutocompleteInput';
import Icons from './Icons';
import { useApp } from '../context/AppContext';

interface SplitTransactionModalProps {
  targetTx: any;
  onConfirm: (rows: any[]) => void | Promise<void>;
  onCancel: () => void;
}

// Shared split dialog: the ledger splits via the API, while the PDF import
// verification grid splits rows locally before saving.
export default function SplitTransactionModal({ targetTx, onConfirm, onCancel }: SplitTransactionModalProps) {
  const { groupedCategories, locationSuggestions, productSuggestions } = useApp();

  const [splitRows, setSplitRows] = useState<any[]>(() => {
    const amountVal = Math.abs(targetTx.amount);
    const half1 = Math.round(amountVal / 2);
    const half2 = amountVal - half1;
    const base = {
      category: targetTx.category || 'Others',
      location_merchant: targetTx.location_merchant || '',
      product_service: targetTx.product_service || '',
      note: targetTx.note || ''
    };
    return [
      { ...base, amount: String(half1) },
      { ...base, amount: String(half2) }
    ];
  });

          const targetAmount = Math.abs(targetTx.amount);
          const allocatedAmount = splitRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
          const remainingAmount = targetAmount - allocatedAmount;
          const isBalanced = Math.abs(remainingAmount) < 0.01;

  return (
            <div className="modal-overlay">
              <div className="glass-panel modal-content" style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ✂️ Pecah Kategori Transaksi (Split)
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  Pecah transaksi <strong>"{targetTx.description}"</strong> sebesar <strong>{formatIDR(targetAmount)}</strong> menjadi beberapa sub-kategori.
                </p>

                <div className="table-container" style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>Kategori</th>
                        <th style={{ width: '18%' }}>Lokasi/Merchant</th>
                        <th style={{ width: '18%' }}>Produk/Layanan</th>
                        <th style={{ width: '15%' }}>Nominal (IDR)</th>
                        <th>Catatan</th>
                        <th style={{ width: '8%', textAlign: 'center' }}>Hapus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {splitRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td>
                            <select 
                              className="form-control"
                              value={row.category}
                              onChange={(e) => {
                                    const updated = [...splitRows];
                                    updated[rIdx].category = e.target.value;
                                    setSplitRows(updated);
                              }}
                              style={{ padding: '0.35rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', margin: 0 }}
                            >
                              {groupedCategories.map(group => {
                                    const rowType = targetTx.amount >= 0 ? 'income' : 'expense';
                                    const parentMatch = group.parent.type === 'both' || group.parent.type === rowType;
                                    const matchedSubs = group.subs.filter(sub => sub.type === 'both' || sub.type === rowType);
                                    if (!parentMatch && matchedSubs.length === 0) return null;
                                    return (
                                      <optgroup key={group.parent.id} label={group.parent.name}>
                                        {parentMatch && <option value={group.parent.name}>{group.parent.name}</option>}
                                        {matchedSubs.map(sub => (
                                          <option key={sub.id} value={sub.name}>↳ {sub.name}</option>
                                        ))}
                                      </optgroup>
                                    );
                              })}
                            </select>
                          </td>
                          <td>
                            <AutocompleteInput 
                              className="form-control"
                              placeholder="Merchant..."
                              value={row.location_merchant}
                              onChangeValue={(val) => {
                                    const updated = [...splitRows];
                                    updated[rIdx].location_merchant = val;
                                    setSplitRows(updated);
                              }}
                              suggestions={locationSuggestions}
                              style={{ padding: '0.35rem', fontSize: '0.8rem', margin: 0 }}
                            />
                          </td>
                          <td>
                            <AutocompleteInput 
                              className="form-control"
                              placeholder="Produk..."
                              value={row.product_service}
                              onChangeValue={(val) => {
                                    const updated = [...splitRows];
                                    updated[rIdx].product_service = val;
                                    setSplitRows(updated);
                              }}
                              suggestions={productSuggestions}
                              style={{ padding: '0.35rem', fontSize: '0.8rem', margin: 0 }}
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              className="form-control"
                              placeholder="Nominal"
                              value={row.amount}
                              onChange={(e) => {
                                    const updated = [...splitRows];
                                    updated[rIdx].amount = e.target.value;
                                    setSplitRows(updated);
                              }}
                              style={{ padding: '0.35rem', fontSize: '0.8rem', margin: 0 }}
                              required
                            />
                          </td>
                          <td>
                            <input 
                              type="text"
                              className="form-control"
                              placeholder="Catatan..."
                              value={row.note}
                              onChange={(e) => {
                                    const updated = [...splitRows];
                                    updated[rIdx].note = e.target.value;
                                    setSplitRows(updated);
                              }}
                              style={{ padding: '0.35rem', fontSize: '0.8rem', margin: 0 }}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => {
                                    const updated = splitRows.filter((_, i) => i !== rIdx);
                                    setSplitRows(updated);
                              }}
                              disabled={splitRows.length <= 2}
                              style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent' }}
                            >
                              <Icons.Delete />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'rgba(255,255,255,0.01)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <div>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                            setSplitRows([...splitRows, {
                              category: targetTx.category || 'Others',
                              location_merchant: targetTx.location_merchant || '',
                              product_service: targetTx.product_service || '',
                              amount: '',
                              note: ''
                            }]);
                      }}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', margin: 0 }}
                    >
                      + Tambah Baris Pecahan
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', fontWeight: 600 }}>
                    <div>
                      Target: <span style={{ color: 'var(--color-text-main)' }}>{formatIDR(targetAmount)}</span>
                    </div>
                    <div>
                      Teralokasi: <span style={{ color: 'var(--color-primary)' }}>
                        {formatIDR(allocatedAmount)}
                      </span>
                    </div>
                    <div>
                      Sisa: <span style={{ color: isBalanced ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {formatIDR(remainingAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    onClick={() => onConfirm(splitRows)}
                    disabled={!isBalanced}
                  >
                    Konfirmasi Split ({splitRows.length} Pecahan)
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={onCancel}
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
  );
}
