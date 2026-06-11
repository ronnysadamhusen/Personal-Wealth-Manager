import React, { useState } from 'react';
import { API_URL } from '../constants';
import { formatIDR } from '../utils/format';
import AutocompleteInput from './AutocompleteInput';
import { useApp } from '../context/AppContext';

interface TransactionEditModalProps {
  tx: any;
  onClose: () => void;
  onSaved: () => void;
}

// Shared edit dialog: opened from the transactions ledger and from the budget
// detail modal. Mount with key={tx.id} so the form re-initializes per transaction.
export default function TransactionEditModal({ tx, onClose, onSaved }: TransactionEditModalProps) {
  const { accounts, groupedCategories, debtsReceivables, locationSuggestions, productSuggestions, descSuggestions, setLoading } = useApp();

  const [editTxAccountId, setEditTxAccountId] = useState<string>(tx.account_id);
  const [editTxDate, setEditTxDate] = useState<string>(tx.date);
  const [editTxBookingDate, setEditTxBookingDate] = useState<string>(tx.booking_date || tx.date);
  const [editTxType, setEditTxType] = useState<'income' | 'expense'>(tx.amount >= 0 ? 'income' : 'expense');
  const [editTxCategory, setEditTxCategory] = useState<string>(tx.category);
  const [editTxDesc, setEditTxDesc] = useState<string>(tx.description);
  const [editTxAmount, setEditTxAmount] = useState<string>(String(Math.abs(tx.amount)));
  const [editTxNote, setEditTxNote] = useState<string>(tx.note || '');
  const [editTxLocationMerchant, setEditTxLocationMerchant] = useState<string>(tx.location_merchant || '');
  const [editTxProductService, setEditTxProductService] = useState<string>(tx.product_service || '');
  const [editTxDebtReceivableId, setEditTxDebtReceivableId] = useState<string>(tx.debt_receivable_id || '');

  const handleSaveEditedTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTxAccountId || !editTxDesc || !editTxAmount || !editTxCategory) return;

    setLoading(true);
    try {
      const val = parseFloat(editTxAmount);
      const amountValue = editTxType === 'income' ? val : -val;

      const res = await fetch(`${API_URL}/transactions/${tx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: editTxAccountId,
          date: editTxDate,
          booking_date: editTxBookingDate || editTxDate,
          description: editTxDesc,
          amount: amountValue,
          category: editTxCategory,
          note: editTxNote || null,
          location_merchant: editTxLocationMerchant || null,
          product_service: editTxProductService || null,
          debt_receivable_id: editTxDebtReceivableId || null
        })
      });

      if (res.ok) {
        onSaved();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Failed to update transaction');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error updating transaction: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '550px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>✏️</span> Edit Transaction Details
                </h3>
                <button 
                  type="button" 
                  onClick={onClose} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditedTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <div className="form-group">
                  <label>Account / Credit Card</label>
                  <select 
                    className="form-control"
                    value={editTxAccountId}
                    onChange={(e) => setEditTxAccountId(e.target.value)}
                    required
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type === 'bank' ? 'Bank' : a.type === 'cash' ? 'Cash/Wallet' : 'Credit Card'})</option>
                    ))}
                  </select>
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Transaction Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={editTxDate} 
                      onChange={(e) => {
                        setEditTxDate(e.target.value);
                        if (!editTxBookingDate || editTxBookingDate === editTxDate) {
                          setEditTxBookingDate(e.target.value);
                        }
                      }}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Booking Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={editTxBookingDate} 
                      onChange={(e) => setEditTxBookingDate(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '0.8fr 1.2fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Type</label>
                    <select 
                      className="form-control" 
                      value={editTxType} 
                      onChange={(e) => setEditTxType(e.target.value as any)}
                    >
                      <option value="expense">Expense (-)</option>
                      <option value="income">Income (+)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select 
                      className="form-control" 
                      value={editTxCategory} 
                      onChange={(e) => setEditTxCategory(e.target.value)}
                      required
                    >
                      {groupedCategories.map(group => {
                        const matchedSubs = group.subs;
                        return (
                          <optgroup key={group.parent.id} label={group.parent.name}>
                            <option value={group.parent.name}>{group.parent.name}</option>
                            {matchedSubs.map(sub => (
                              <option key={sub.id} value={sub.name}>↳ {sub.name}</option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1fr', margin: '0 0 1rem 0', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Location/Merchant</label>
                    <AutocompleteInput 
                      className="form-control" 
                      placeholder="e.g. Starbucks, Mal Kelapa Gading" 
                      value={editTxLocationMerchant}
                      onChangeValue={setEditTxLocationMerchant}
                      suggestions={locationSuggestions}
                    />
                  </div>
                  <div className="form-group">
                    <label>Product/Service</label>
                    <AutocompleteInput 
                      className="form-control" 
                      placeholder="e.g. Coffee, Taxi Service" 
                      value={editTxProductService}
                      onChangeValue={setEditTxProductService}
                      suggestions={productSuggestions}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <AutocompleteInput 
                    className="form-control" 
                    placeholder="e.g. Starbucks, Transfer salary" 
                    value={editTxDesc}
                    onChangeValue={setEditTxDesc}
                    suggestions={descSuggestions}
                    required 
                  />
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Amount (IDR)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder="e.g. 50000"
                      value={editTxAmount}
                      onChange={(e) => setEditTxAmount(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Note (Optional)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Keterangan..."
                      value={editTxNote}
                      onChange={(e) => setEditTxNote(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Hubungkan ke Hutang / Piutang (Koneksi Ledger)</label>
                  <select
                    className="form-control"
                    value={editTxDebtReceivableId}
                    onChange={(e) => setEditTxDebtReceivableId(e.target.value)}
                  >
                    <option value="">-- Tidak Terhubung (Mutasi Biasa) --</option>
                    {debtsReceivables.map(dr => (
                      <option key={dr.id} value={dr.id}>
                        [{dr.type === 'debt' ? 'HUTANG' : 'PIUTANG'}] {dr.person} - {dr.description} (Sisa: {formatIDR(dr.remaining_amount)})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Save Changes
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                </div>

              </form>
            </div>
          </div>
  );
}
