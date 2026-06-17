import React, { useState } from 'react';
import { API_URL } from '../constants';
import { useApp } from '../context/AppContext';

export default function InvestmentsPage() {
  const { accounts, investments, loadingInvestments, fetchInvestments, renderAmount, privacyMode } = useApp();

  // Modal & form state
  const [showAddInvestmentModal, setShowAddInvestmentModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<any | null>(null);
  const [showAddInvTxModal, setShowAddInvTxModal] = useState(false);
  const [addInvTxTarget, setAddInvTxTarget] = useState<any | null>(null);
  const [showPriceUpdateModal, setShowPriceUpdateModal] = useState(false);
  const [priceUpdateTarget, setPriceUpdateTarget] = useState<any | null>(null);

  // Add/Edit Investment form
  const [invName, setInvName] = useState('');
  const [invType, setInvType] = useState<'gold' | 'stock' | 'mutual_fund' | 'crypto' | 'property' | 'deposit' | 'bond' | 'other'>('gold');
  const [invPlatform, setInvPlatform] = useState('');
  const [invUnit, setInvUnit] = useState('');
  const [invCurrentUnits, setInvCurrentUnits] = useState('');
  const [invCurrentPrice, setInvCurrentPrice] = useState('');
  const [invTotalInvested, setInvTotalInvested] = useState('');
  const [invAccountId, setInvAccountId] = useState('');
  const [invNotes, setInvNotes] = useState('');

  // Add Transaction form
  const [invTxType, setInvTxType] = useState<'buy' | 'sell' | 'dividend' | 'price_update'>('buy');
  const [invTxDate, setInvTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [invTxUnits, setInvTxUnits] = useState('');
  const [invTxPrice, setInvTxPrice] = useState('');
  const [invTxAmount, setInvTxAmount] = useState('');
  const [invTxFee, setInvTxFee] = useState('');
  const [invTxAccountId, setInvTxAccountId] = useState('');
  const [invTxNotes, setInvTxNotes] = useState('');

  // Price update form
  const [priceUpdateValue, setPriceUpdateValue] = useState('');

  const resetInvestmentForm = () => {
    setInvName(''); setInvType('gold'); setInvPlatform(''); setInvUnit('');
    setInvCurrentUnits(''); setInvCurrentPrice(''); setInvTotalInvested('');
    setInvAccountId(''); setInvNotes('');
  };

  const handleSaveInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        name: invName,
        type: invType,
        platform: invPlatform || null,
        unit: invUnit || null,
        current_units: parseFloat(invCurrentUnits) || 0,
        current_price_per_unit: parseFloat(invCurrentPrice) || 0,
        total_invested: parseFloat(invTotalInvested) || 0,
        account_id: invAccountId || null,
        notes: invNotes || null,
      };
      const url = editingInvestment ? `${API_URL}/investments/${editingInvestment.id}` : `${API_URL}/investments`;
      const method = editingInvestment ? 'PUT' : 'POST';
      const res = await fetch(url, { 
        method, 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body) 
      });
      if (res.ok) {
        await fetchInvestments();
        setShowAddInvestmentModal(false);
        setEditingInvestment(null);
        resetInvestmentForm();
      } else {
        const errJson = await res.json();
        alert(`Gagal menyimpan aset: ${errJson.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Gagal menghubungkan ke server: ${err.message}`);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    if (!confirm('Hapus aset investasi ini beserta semua transaksinya?')) return;
    await fetch(`${API_URL}/investments/${id}`, { method: 'DELETE' });
    await fetchInvestments();
  };

  const resetInvTxForm = () => {
    setInvTxType('buy'); setInvTxDate(new Date().toISOString().split('T')[0]);
    setInvTxUnits(''); setInvTxPrice(''); setInvTxAmount(''); setInvTxFee('');
    setInvTxAccountId(''); setInvTxNotes('');
  };

  const handleAddInvTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInvTxTarget) return;
    try {
      const body = {
        type: invTxType,
        date: invTxDate,
        units: parseFloat(invTxUnits) || 0,
        price_per_unit: parseFloat(invTxPrice) || 0,
        amount: parseFloat(invTxAmount) || 0,
        fee: parseFloat(invTxFee) || 0,
        linked_account_id: invTxAccountId || null,
        notes: invTxNotes || null,
      };
      const res = await fetch(`${API_URL}/investments/${addInvTxTarget.id}/transactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (res.ok) {
        await fetchInvestments();
        setShowAddInvTxModal(false);
        setAddInvTxTarget(null);
        resetInvTxForm();
      } else {
        const errJson = await res.json();
        alert(`Gagal mencatat transaksi: ${errJson.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Gagal menghubungkan ke server: ${err.message}`);
    }
  };

  const handlePriceUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceUpdateTarget) return;
    const newPrice = parseFloat(priceUpdateValue);
    if (isNaN(newPrice) || newPrice <= 0) {
      alert('Masukkan harga terbaru yang valid dan lebih besar dari 0');
      return;
    }
    try {
      // Update investment directly
      const body = { current_price_per_unit: newPrice };
      const res = await fetch(`${API_URL}/investments/${priceUpdateTarget.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (res.ok) {
        await fetchInvestments();
        setShowPriceUpdateModal(false);
        setPriceUpdateTarget(null);
        setPriceUpdateValue('');
      } else {
        const errJson = await res.json();
        alert(`Gagal mengupdate harga: ${errJson.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Gagal menghubungkan ke server: ${err.message}`);
    }
  };

          const activeInv = investments.filter(i => i.status === 'active');
          const totalValue = activeInv.reduce((s, i) => s + (i.current_value || 0), 0);
          const totalInvested = activeInv.reduce((s, i) => s + (i.total_invested || 0), 0);
          const unrealizedGain = totalValue - totalInvested;
          const unrealizedPct = totalInvested > 0 ? ((unrealizedGain / totalInvested) * 100) : 0;
          const typeLabels: Record<string, string> = {
            gold: '🥇 Emas', stock: '📊 Saham', mutual_fund: '📦 Reksa Dana',
            crypto: '₿ Kripto', property: '🏠 Properti', deposit: '🏦 Deposito',
            bond: '📜 Obligasi', other: '🗂️ Lainnya'
          };
          const byType = activeInv.reduce((acc: Record<string, number>, i) => {
            acc[i.type] = (acc[i.type] || 0) + (i.current_value || 0);
            return acc;
          }, {});

          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0 }}>📈 Investments Tracker</h2>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: 0 }}>
                    Pantau aset investasi: emas, saham, reksa dana, dan lainnya. Update harga kapan saja secara manual.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetInvestmentForm(); setEditingInvestment(null); setShowAddInvestmentModal(true); }}>
                  + Tambah Aset
                </button>
              </div>

              {/* Portfolio Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="glass-panel card-content" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>TOTAL NILAI PORTOFOLIO</div>
                  <div className="card-value" style={{ color: 'var(--color-primary)' }}>
                    {renderAmount(totalValue)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{activeInv.length} aset aktif</div>
                </div>
                <div className="glass-panel card-content" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>TOTAL MODAL DIINVESTASIKAN</div>
                  <div className="card-value">{renderAmount(totalInvested)}</div>
                </div>
                <div className="glass-panel card-content" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>UNREALIZED GAIN / LOSS</div>
                  <div className="card-value" style={{ color: unrealizedGain >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
                    {unrealizedGain >= 0 ? '+' : ''}{renderAmount(unrealizedGain)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: unrealizedGain >= 0 ? 'var(--color-income)' : 'var(--color-expense)', marginTop: '0.25rem' }}>
                    <span className={privacyMode === 'blur' ? 'privacy-strict' : privacyMode === 'hover' ? 'privacy-hover' : ''}>
                      {unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Alokasi per Jenis */}
              {Object.keys(byType).length > 0 && (
                <div className="glass-panel card-content" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alokasi Aset</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, val]) => {
                      const pct = totalValue > 0 ? (val / totalValue * 100) : 0;
                      return (
                        <div key={type}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                            <span>{typeLabels[type] || type}</span>
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              <span className={privacyMode === 'blur' ? 'privacy-strict' : privacyMode === 'hover' ? 'privacy-hover' : ''}>{pct.toFixed(1)}%</span> &nbsp; {renderAmount(val)}
                            </span>
                          </div>
                          <div style={{ height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Investment Cards */}
              {loadingInvestments ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Memuat...</div>
              ) : investments.length === 0 ? (
                <div className="glass-panel card-content" style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</div>
                  <h3>Belum Ada Aset Investasi</h3>
                  <p style={{ color: 'var(--color-text-muted)' }}>Tambahkan aset investasi seperti tabungan emas Pegadaian, saham, atau reksa dana Bibit secara manual.</p>
                  <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => { resetInvestmentForm(); setShowAddInvestmentModal(true); }}>+ Tambah Aset Pertama</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: '1rem' }}>
                  {investments.map(inv => {
                    const gain = (inv.current_value || 0) - (inv.total_invested || 0);
                    const gainPct = inv.total_invested > 0 ? (gain / inv.total_invested * 100) : 0;
                    return (
                      <div key={inv.id} className="glass-panel card-content" style={{ padding: '1.25rem', position: 'relative' }}>
                        {inv.status !== 'active' && (
                          <span style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '99px' }}>
                            {inv.status}
                          </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                          <div style={{ fontSize: '1.75rem', lineHeight: 1 }}>{typeLabels[inv.type]?.split(' ')[0] || '🗂️'}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.name}</div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                              {typeLabels[inv.type]?.split(' ').slice(1).join(' ')} {inv.platform ? `• ${inv.platform}` : ''}
                            </div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                              Terakhir Update: {inv.last_tx_date ? inv.last_tx_date : inv.created_at ? inv.created_at.split(' ')[0] || inv.created_at : '-'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.1rem' }}>NILAI SAAT INI</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{renderAmount(inv.current_value || 0)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.1rem' }}>MODAL</div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{renderAmount(inv.total_invested || 0)}</div>
                          </div>
                        </div>

                        {inv.current_units > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.1rem' }}>UNIT / JUMLAH</div>
                              <div style={{ fontSize: '0.85rem' }} className={privacyMode === 'blur' ? 'privacy-strict' : privacyMode === 'hover' ? 'privacy-hover' : ''}>
                                {inv.current_units.toLocaleString('id-ID', {maximumFractionDigits: 6})} {inv.unit || ''}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.1rem' }}>HARGA/UNIT</div>
                              <div style={{ fontSize: '0.85rem' }}>{renderAmount(inv.current_price_per_unit || 0)}</div>
                            </div>
                          </div>
                        )}

                        <div style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', background: gain >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', marginBottom: '1rem' }}>
                          <span style={{ color: gain >= 0 ? 'var(--color-income)' : 'var(--color-expense)', fontWeight: 600, fontSize: '0.9rem' }} className={privacyMode === 'blur' ? 'privacy-strict' : privacyMode === 'hover' ? 'privacy-hover' : ''}>
                            {gain >= 0 ? '▲' : '▼'} {gain >= 0 ? '+' : ''}Rp {gain.toLocaleString('id-ID')} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', fontWeight: 600 }}
                            onClick={() => { setPriceUpdateTarget(inv); setPriceUpdateValue(String(inv.current_price_per_unit || '')); setShowPriceUpdateModal(true); }}
                          >
                            🔄 Update Harga
                          </button>
                          <button
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#c084fc', fontWeight: 600 }}
                            onClick={() => {
                              setAddInvTxTarget(inv);
                              resetInvTxForm();
                              setInvTxPrice(String(inv.current_price_per_unit || ''));
                              setShowAddInvTxModal(true);
                            }}
                          >
                            ➕ Transaksi
                          </button>
                          <button
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', fontWeight: 600 }}
                            onClick={() => {
                              setEditingInvestment(inv);
                              setInvName(inv.name); setInvType(inv.type);
                              setInvPlatform(inv.platform || ''); setInvUnit(inv.unit || '');
                              setInvCurrentUnits(String(inv.current_units || ''));
                              setInvCurrentPrice(String(inv.current_price_per_unit || ''));
                              setInvTotalInvested(String(inv.total_invested || ''));
                              setInvAccountId(inv.account_id || ''); setInvNotes(inv.notes || '');
                              setShowAddInvestmentModal(true);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fda4af', fontWeight: 600 }}
                            onClick={() => handleDeleteInvestment(inv.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Modal: Add/Edit Investment ── */}
              {showAddInvestmentModal && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="glass-panel modal-content" style={{ maxWidth: '540px', width: '95%', padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📈</span> {editingInvestment ? 'Edit Aset Investasi' : 'Tambah Aset Investasi'}
                      </h3>
                      <button 
                        type="button" 
                        onClick={() => { setShowAddInvestmentModal(false); setEditingInvestment(null); resetInvestmentForm(); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                      >
                        ✕
                      </button>
                    </div>
                    <form onSubmit={handleSaveInvestment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                          <label>Nama Aset *</label>
                          <input className="form-control" required value={invName} onChange={e => setInvName(e.target.value)} placeholder="mis. Tabungan Emas Pegadaian, BBCA, Reksa Dana XYZ" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Jenis *</label>
                          <select className="form-control" value={invType} onChange={e => setInvType(e.target.value as any)}>
                            <option value="gold">🥇 Emas</option>
                            <option value="stock">📊 Saham</option>
                            <option value="mutual_fund">📦 Reksa Dana</option>
                            <option value="crypto">₿ Kripto</option>
                            <option value="property">🏠 Properti</option>
                            <option value="deposit">🏦 Deposito</option>
                            <option value="bond">📜 Obligasi</option>
                            <option value="other">🗂️ Lainnya</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Platform / Broker</label>
                          <input className="form-control" value={invPlatform} onChange={e => setInvPlatform(e.target.value)} placeholder="mis. Pegadaian, Bibit, Stockbit" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Satuan Unit</label>
                          <input className="form-control" value={invUnit} onChange={e => setInvUnit(e.target.value)} placeholder="mis. gram, lembar, unit" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Jumlah Unit Saat Ini</label>
                          <input className="form-control" type="number" step="any" value={invCurrentUnits} onChange={e => setInvCurrentUnits(e.target.value)} placeholder="0" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Harga per Unit (Rp)</label>
                          <input className="form-control" type="number" step="any" value={invCurrentPrice} onChange={e => setInvCurrentPrice(e.target.value)} placeholder="0" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Total Modal Diinvestasikan (Rp)</label>
                          <input className="form-control" type="number" step="any" value={invTotalInvested} onChange={e => setInvTotalInvested(e.target.value)} placeholder="Total uang disetor" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                          <label>Linked Account (opsional)</label>
                          <select className="form-control" value={invAccountId} onChange={e => setInvAccountId(e.target.value)}>
                            <option value="">— Tidak ada —</option>
                            {accounts.filter(a => a.type === 'bank' || a.type === 'ewallet' || a.type === 'cash').map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                          <label>Catatan</label>
                          <textarea className="form-control" rows={2} value={invNotes} onChange={e => setInvNotes(e.target.value)} placeholder="Catatan tambahan..." style={{ resize: 'vertical' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => { setShowAddInvestmentModal(false); setEditingInvestment(null); resetInvestmentForm(); }}>Batal</button>
                        <button type="submit" className="btn btn-primary">{editingInvestment ? 'Simpan Perubahan' : 'Tambah Aset'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ── Modal: Update Harga ── */}
              {showPriceUpdateModal && priceUpdateTarget && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="glass-panel modal-content" style={{ maxWidth: '420px', width: '95%', padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🔄</span> Update Harga
                      </h3>
                      <button 
                        type="button" 
                        onClick={() => setShowPriceUpdateModal(false)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>{priceUpdateTarget.name}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        Harga lama: <span style={{ color: 'var(--color-warning)', fontWeight: 500 }}>Rp {(priceUpdateTarget.current_price_per_unit || 0).toLocaleString('id-ID')}</span> / {priceUpdateTarget.unit || 'unit'}
                      </div>
                    </div>
                    <form onSubmit={handlePriceUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Harga Terbaru per {priceUpdateTarget.unit || 'unit'} (Rp) *</label>
                        <input className="form-control" type="number" step="any" required value={priceUpdateValue} onChange={e => setPriceUpdateValue(e.target.value)} placeholder="Masukkan harga terbaru" autoFocus />
                        {priceUpdateValue && priceUpdateTarget.current_units > 0 && (
                          <small style={{ color: 'var(--color-success)', fontSize: '0.75rem', display: 'block', marginTop: '0.5rem', fontWeight: 500 }}>
                            Nilai baru: Rp {(parseFloat(priceUpdateValue) * priceUpdateTarget.current_units).toLocaleString('id-ID')}
                          </small>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowPriceUpdateModal(false)}>Batal</button>
                        <button type="submit" className="btn btn-primary">Update</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ── Modal: Tambah Transaksi ── */}
              {showAddInvTxModal && addInvTxTarget && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="glass-panel modal-content" style={{ maxWidth: '500px', width: '95%', padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                        <span>➕</span> Catat Transaksi — {addInvTxTarget.name}
                      </h3>
                      <button 
                        type="button" 
                        onClick={() => { setShowAddInvTxModal(false); setAddInvTxTarget(null); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                      >
                        ✕
                      </button>
                    </div>
                    <form onSubmit={handleAddInvTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Jenis Transaksi *</label>
                          <select className="form-control" value={invTxType} onChange={e => setInvTxType(e.target.value as any)}>
                            <option value="buy">🛒 Beli</option>
                            <option value="sell">💰 Jual</option>
                            <option value="dividend">💵 Dividen</option>
                            <option value="price_update">🔄 Update Harga</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Tanggal *</label>
                          <input className="form-control" type="date" required value={invTxDate} onChange={e => setInvTxDate(e.target.value)} />
                        </div>
                        
                        {(invTxType === 'buy' || invTxType === 'sell') && (
                          <>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>Jumlah Unit</label>
                              <input className="form-control" type="number" step="any" value={invTxUnits} onChange={e => setInvTxUnits(e.target.value)} placeholder="0" />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>Harga per Unit (Rp)</label>
                              <input className="form-control" type="number" step="any" value={invTxPrice} onChange={e => setInvTxPrice(e.target.value)} placeholder="0" />
                            </div>
                          </>
                        )}
                        
                        {invTxType === 'price_update' && (
                          <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                            <label>Harga per Unit Terbaru (Rp)</label>
                            <input className="form-control" type="number" step="any" value={invTxPrice} onChange={e => setInvTxPrice(e.target.value)} placeholder="0" />
                          </div>
                        )}
                        
                        <div className="form-group" style={{ gridColumn: (invTxType === 'dividend' || invTxType === 'price_update') ? '1 / -1' : 'auto', margin: 0 }}>
                          <label>
                            {invTxType === 'buy' ? 'Total Pembelian (Rp) *' : invTxType === 'sell' ? 'Total Penjualan (Rp) *' : invTxType === 'dividend' ? 'Jumlah Dividen (Rp) *' : 'Nilai (Rp) *'}
                          </label>
                          <input className="form-control" type="number" step="any" required value={invTxAmount} onChange={e => setInvTxAmount(e.target.value)} placeholder="0" />
                        </div>
                        
                        {(invTxType === 'buy' || invTxType === 'sell') && (
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Biaya / Fee (Rp)</label>
                            <input className="form-control" type="number" step="any" value={invTxFee} onChange={e => setInvTxFee(e.target.value)} placeholder="0" />
                          </div>
                        )}
                        
                        {(invTxType === 'buy' || invTxType === 'sell') && (
                          <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                            <label>Potong dari Akun (opsional)</label>
                            <select className="form-control" value={invTxAccountId} onChange={e => setInvTxAccountId(e.target.value)}>
                              <option value="">— Tidak potong kas —</option>
                              {accounts.filter(a => a.type === 'bank' || a.type === 'ewallet' || a.type === 'cash').map(a => (
                                <option key={a.id} value={a.id}>{a.name} — Rp {(a.current_balance || 0).toLocaleString('id-ID')}</option>
                              ))}
                            </select>
                            <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>Jika dipilih, transaksi keluar/masuk akan otomatis dicatat di akun tersebut.</small>
                          </div>
                        )}
                        
                        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                          <label>Catatan</label>
                          <input className="form-control" value={invTxNotes} onChange={e => setInvTxNotes(e.target.value)} placeholder="Catatan transaksi..." />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => { setShowAddInvTxModal(false); setAddInvTxTarget(null); }}>Batal</button>
                        <button type="submit" className="btn btn-primary">Catat Transaksi</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
}
