import React, { useState, useEffect } from 'react';
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
  const [editTxType, setEditTxType] = useState<'income' | 'expense' | 'transfer'>(
    tx.is_transfer === 1 ? 'transfer' : tx.amount >= 0 ? 'income' : 'expense'
  );
  const [editTxCategory, setEditTxCategory] = useState<string>(tx.category);
  const [editTxDesc, setEditTxDesc] = useState<string>(tx.description);
  const [editTxAmount, setEditTxAmount] = useState<string>(String(Math.abs(tx.amount)));
  const [editTxNote, setEditTxNote] = useState<string>(tx.note || '');
  const [editTxLocationMerchant, setEditTxLocationMerchant] = useState<string>(tx.location_merchant || '');
  const [editTxProductService, setEditTxProductService] = useState<string>(tx.product_service || '');
  const [editTxDebtReceivableId, setEditTxDebtReceivableId] = useState<string>(tx.debt_receivable_id || '');

  // Transfer conversion state
  const [transferMatches, setTransferMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [autoCreateAccId, setAutoCreateAccId] = useState('');
  const [autoCreateDate, setAutoCreateDate] = useState(tx.date);

  useEffect(() => {
    if (editTxType !== 'transfer' || tx.is_transfer === 1) return;
    setLoadingMatches(true);
    fetch(`${API_URL}/transactions/transfer-match?amount=${Math.abs(tx.amount)}&date=${tx.date}&account_id=${tx.account_id}`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setTransferMatches(list);
        if (list.length === 1) setSelectedMatchId(list[0].id);
      })
      .finally(() => setLoadingMatches(false));
  }, [editTxType]);

  const handleSaveEditedTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    // Transfer conversion path
    if (editTxType === 'transfer') {
      if (tx.is_transfer === 1) { onClose(); return; }
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/transfers/link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tx_id: tx.id,
            counterpart_id: selectedMatchId || undefined,
            counterpart_account_id: !selectedMatchId && autoCreateAccId ? autoCreateAccId : undefined,
            counterpart_date: autoCreateDate !== tx.date ? autoCreateDate : undefined,
          }),
        });
        if (res.ok) {
          onSaved();
        } else {
          const err = await res.json();
          alert(err.error || 'Gagal mengkonversi ke transfer');
        }
      } catch (err: any) {
        alert('Error: ' + err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Normal income/expense path
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

  const isAlreadyTransfer = tx.is_transfer === 1;

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

                {/* Type selector — full width when transfer selected */}
                <div className={editTxType === 'transfer' ? 'form-group' : 'grid-cols-2'}
                  style={editTxType !== 'transfer' ? { gridTemplateColumns: '0.8fr 1.2fr', margin: 0, gap: '1rem' } : {}}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Type</label>
                    <select
                      className="form-control"
                      value={editTxType}
                      onChange={(e) => setEditTxType(e.target.value as any)}
                      disabled={isAlreadyTransfer}
                      style={{ margin: 0 }}
                    >
                      <option value="expense">Expense (-)</option>
                      <option value="income">Income (+)</option>
                      <option value="transfer">🔁 Transfer</option>
                    </select>
                  </div>

                  {/* Category — hidden when transfer */}
                  {editTxType !== 'transfer' && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Category</label>
                      <select
                        className="form-control"
                        value={editTxCategory}
                        onChange={(e) => setEditTxCategory(e.target.value)}
                        required
                        style={{ margin: 0 }}
                      >
                        {groupedCategories.map(group => (
                          <optgroup key={group.parent.id} label={group.parent.name}>
                            <option value={group.parent.name}>{group.parent.name}</option>
                            {group.subs.map(sub => (
                              <option key={sub.id} value={sub.name}>↳ {sub.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Transfer section */}
                {editTxType === 'transfer' && (
                  <div style={{
                    padding: '1rem', borderRadius: '10px',
                    background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex', flexDirection: 'column', gap: '0.75rem',
                  }}>
                    {isAlreadyTransfer ? (
                      // Read-only transfer info
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>🔁</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {tx.transfer_direction === 'out'
                              ? `Transfer to ${tx.transfer_counterpart_account || '—'}`
                              : `Transfer from ${tx.transfer_counterpart_account || '—'}`}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                            Transaksi ini sudah terlink sebagai transfer. Untuk mengubah, hapus transfer terkait terlebih dahulu.
                          </div>
                        </div>
                      </div>
                    ) : loadingMatches ? (
                      <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--color-text-muted)' }}>
                        Mencari transaksi counterpart yang cocok...
                      </p>
                    ) : transferMatches.length > 0 ? (
                      <>
                        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                          Pilih counterpart (transaksi pasangan di akun lain):
                        </div>
                        {transferMatches.map(m => (
                          <label key={m.id} style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.6rem 0.85rem', borderRadius: '8px', cursor: 'pointer',
                            border: `1px solid ${selectedMatchId === m.id ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                            background: selectedMatchId === m.id ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                          }}>
                            <input type="radio" name="match" value={m.id}
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
                          </label>
                        ))}
                        <label style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.45rem 0.85rem', borderRadius: '8px', cursor: 'pointer',
                          border: `1px solid ${selectedMatchId === '' ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
                          fontSize: '0.8rem', color: 'var(--color-text-muted)',
                        }}>
                          <input type="radio" name="match" value=""
                            checked={selectedMatchId === ''}
                            onChange={() => setSelectedMatchId('')}
                          />
                          Tandai transfer tanpa counterpart
                        </label>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                          Tidak ditemukan transaksi counterpart (jumlah sama, ±2 hari, akun berbeda). Pilih akun untuk membuat counterpart otomatis, atau biarkan kosong untuk tandai tanpa counterpart.
                        </div>
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
                        {autoCreateAccId && (
                          <input
                            type="date"
                            className="form-control"
                            value={autoCreateDate}
                            onChange={e => setAutoCreateDate(e.target.value)}
                            style={{ margin: 0, fontSize: '0.85rem' }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Location & Product — hidden when transfer */}
                {editTxType !== 'transfer' && (
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
                )}

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

                {/* Debt/Receivable — hidden when transfer */}
                {editTxType !== 'transfer' && (
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
                )}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  {isAlreadyTransfer ? (
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
                      Tutup
                    </button>
                  ) : (
                    <>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                        {editTxType === 'transfer' ? '🔁 Jadikan Transfer' : 'Save Changes'}
                      </button>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>

              </form>
            </div>
          </div>
  );
}
