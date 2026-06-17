import React, { useState } from 'react';
import { API_URL } from '../constants';
import { formatIDR } from '../utils/format';
import Icons from '../components/Icons';
import { useApp } from '../context/AppContext';

export default function LiabilitiesPage() {
  const {
    accounts, installments, projections, debtsReceivables, loadingDR,
    renderAmount, fetchData, setLoading,
  } = useApp();

  const [liabilitiesSubTab, setLiabilitiesSubTab] = useState<'overview' | 'installments' | 'loans'>('overview');

  const [showAddDRModal, setShowAddDRModal] = useState(false);
  const [payingDR, setPayingDR] = useState<any | null>(null);
  const [viewDRDetails, setViewDRDetails] = useState<any | null>(null);

  // Add DR form states
  const [drType, setDrType] = useState<'debt' | 'receivable'>('debt');
  const [drPerson, setDrPerson] = useState('');
  const [drAmount, setDrAmount] = useState('');
  const [drDescription, setDrDescription] = useState('');
  const [drDate, setDrDate] = useState(new Date().toISOString().split('T')[0]);
  const [drDueDate, setDrDueDate] = useState('');
  const [drAccountId, setDrAccountId] = useState('');

  // Repayment form states
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payAccountId, setPayAccountId] = useState('');
  const [payNote, setPayNote] = useState('');

  const handleCreateDR = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/debts-receivables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: drType,
          person: drPerson,
          amount: parseFloat(drAmount),
          description: drDescription,
          date: drDate,
          due_date: drDueDate || null,
          account_id: drAccountId || null
        })
      });

      if (res.ok) {
        setShowAddDRModal(false);
        // Reset form
        setDrPerson('');
        setDrAmount('');
        setDrDescription('');
        setDrDate(new Date().toISOString().split('T')[0]);
        setDrDueDate('');
        setDrAccountId('');
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create debt/receivable');
      }
    } catch (error: any) {
      alert('Error creating debt/receivable: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayDR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingDR) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/debts-receivables/${payingDR.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          date: payDate,
          account_id: payAccountId,
          note: payNote
        })
      });

      if (res.ok) {
        setPayingDR(null);
        // Reset form
        setPayAmount('');
        setPayDate(new Date().toISOString().split('T')[0]);
        setPayAccountId('');
        setPayNote('');
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to submit payment');
      }
    } catch (error: any) {
      alert('Error submitting payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDR = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan hutang/piutang ini? Transaksi mutasi bank yang terhubung pada ledger juga akan ikut terhapus.')) {
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/debts-receivables/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        if (viewDRDetails?.id === id) {
          setViewDRDetails(null);
        }
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete record');
      }
    } catch (error: any) {
      alert('Error deleting record: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Installment deletion
  const handleDeleteInstallment = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this installment agreement? This will not delete past transactions.')) return;
    try {
      const res = await fetch(`${API_URL}/installments/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Archived installments
  const [archivedInsts, setArchivedInsts] = useState<any[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const fetchArchivedInstallments = async () => {
    try {
      const res = await fetch(`${API_URL}/installments?status=archived`);
      if (res.ok) setArchivedInsts(await res.json());
    } catch { /* ignore */ }
  };

  const handleArchiveInstallment = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/installments/${id}/archive`, { method: 'POST' });
      if (res.ok) {
        fetchData();
        if (showArchived) fetchArchivedInstallments();
      }
    } catch (err) { console.error(err); }
  };

  const handleUnarchiveInstallment = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/installments/${id}/unarchive`, { method: 'POST' });
      if (res.ok) { fetchData(); fetchArchivedInstallments(); }
    } catch (err) { console.error(err); }
  };

  const toggleShowArchived = () => {
    if (!showArchived) fetchArchivedInstallments();
    setShowArchived(prev => !prev);
  };

  // Edit installment modal
  const [editingInst, setEditingInst] = useState<any | null>(null);
  const [editInstDesc, setEditInstDesc] = useState('');
  const [editInstMerchant, setEditInstMerchant] = useState('');
  const [editInstProduct, setEditInstProduct] = useState('');

  const openEditInstallment = (i: any) => {
    setEditingInst(i);
    setEditInstDesc(i.description || '');
    setEditInstMerchant(i.merchant_name || '');
    setEditInstProduct(i.product_name || '');
  };

  const handleEditInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;
    try {
      const res = await fetch(`${API_URL}/installments/${editingInst.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editInstDesc,
          merchant_name: editInstMerchant || null,
          product_name: editInstProduct || null,
        })
      });
      if (res.ok) {
        setEditingInst(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Installment modal
  const [showAddInstModal, setShowAddInstModal] = useState(false);
  const [newInstCard, setNewInstCard] = useState('');
  const [newInstDesc, setNewInstDesc] = useState('');
  const [newInstMerchant, setNewInstMerchant] = useState('');
  const [newInstProduct, setNewInstProduct] = useState('');
  const [newInstAmount, setNewInstAmount] = useState('');
  const [newInstMonths, setNewInstMonths] = useState('');
  const [newInstDate, setNewInstDate] = useState(new Date().toISOString().split('T')[0]);

  // View Installment Transactions modal
  const [viewingInstTx, setViewingInstTx] = useState<any | null>(null);
  const [instTransactions, setInstTransactions] = useState<any[]>([]);
  const [loadingInstTx, setLoadingInstTx] = useState(false);

  const openInstTransactions = async (inst: any) => {
    setViewingInstTx(inst);
    setLoadingInstTx(true);
    setInstTransactions([]);
    try {
      const res = await fetch(`${API_URL}/installments/${inst.id}/transactions`);
      if (res.ok) setInstTransactions(await res.json());
    } catch { /* ignore */ } finally {
      setLoadingInstTx(false);
    }
  };

  const handleAddInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstCard || !newInstDesc || !newInstAmount || !newInstMonths) return;

    try {
      const res = await fetch(`${API_URL}/installments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: newInstCard,
          description: newInstDesc,
          merchant_name: newInstMerchant || null,
          product_name: newInstProduct || null,
          monthly_amount: parseFloat(newInstAmount),
          total_months: parseInt(newInstMonths),
          start_date: newInstDate
        })
      });
      if (res.ok) {
        setShowAddInstModal(false);
        setNewInstCard('');
        setNewInstDesc('');
        setNewInstMerchant('');
        setNewInstProduct('');
        setNewInstAmount('');
        setNewInstMonths('');
        setNewInstDate(new Date().toISOString().split('T')[0]);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Tick installment month (reducing remaining months)
  const handleTickInstallment = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/installments/${id}/tick`, { method: 'POST' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
          <div>
            {/* Sub-Tab Navigation Header */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', paddingBottom: '0.5rem' }}>
              <button 
                className={`tab-btn ${liabilitiesSubTab === 'overview' ? 'active' : ''}`}
                onClick={() => setLiabilitiesSubTab('overview')}
                style={{ background: 'transparent', border: 'none', color: liabilitiesSubTab === 'overview' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: 600, padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: liabilitiesSubTab === 'overview' ? '2px solid var(--color-primary)' : 'none', outline: 'none' }}
              >
                📊 Ringkasan (Overview)
              </button>
              <button 
                className={`tab-btn ${liabilitiesSubTab === 'installments' ? 'active' : ''}`}
                onClick={() => setLiabilitiesSubTab('installments')}
                style={{ background: 'transparent', border: 'none', color: liabilitiesSubTab === 'installments' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: 600, padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: liabilitiesSubTab === 'installments' ? '2px solid var(--color-primary)' : 'none', outline: 'none' }}
              >
                💳 Cicilan Kartu Kredit (CC Installments)
              </button>
              <button 
                className={`tab-btn ${liabilitiesSubTab === 'loans' ? 'active' : ''}`}
                onClick={() => setLiabilitiesSubTab('loans')}
                style={{ background: 'transparent', border: 'none', color: liabilitiesSubTab === 'loans' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: 600, padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: liabilitiesSubTab === 'loans' ? '2px solid var(--color-primary)' : 'none', outline: 'none' }}
              >
                🤝 Pinjaman & Piutang (Debts & Receivables)
              </button>
            </div>

            {/* Sub-Tab Content Rendering */}
            {liabilitiesSubTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h2>Liabilities & Receivables Overview</h2>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    Ringkasan seluruh kewajiban pembayaran (liabilitas) dan tagihan piutang Anda.
                  </p>
                </div>

                {/* Net Worth / Liabilities Summary Cards */}
                <div className="grid-cols-3" style={{ gap: '1.5rem' }}>
                  <div className="glass-panel card-content">
                    <div className="card-desc">Total Outstanding Cicilan CC</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-warning)', marginTop: '0.5rem' }}>
                      {renderAmount(installments.reduce((sum, inst) => sum + (inst.monthly_amount * inst.remaining_months), 0))}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Kewajiban dari cicilan aktif di kartu kredit.
                    </p>
                  </div>

                  <div className="glass-panel card-content">
                    <div className="card-desc">Total Hutang Personal & Bank</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-danger)', marginTop: '0.5rem' }}>
                      {renderAmount(debtsReceivables.filter(d => d.type === 'debt' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0))}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Pinjaman aktif dari pihak ketiga/orang lain.
                    </p>
                  </div>

                  <div className="glass-panel card-content">
                    <div className="card-desc">Total Piutang Aktif</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.5rem' }}>
                      {renderAmount(debtsReceivables.filter(d => d.type === 'receivable' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0))}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Uang Anda yang dipinjam oleh orang lain.
                    </p>
                  </div>
                </div>

                {/* Summary calculation card */}
                <div className="glass-panel card-content" style={{ marginTop: '1rem', padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Net Liability Position (Posisi Kewajiban Bersih)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                      <span>Total Liabilities (Total Kewajiban):</span>
                      <strong className="text-warning">
                        {renderAmount(
                          installments.reduce((sum, inst) => sum + (inst.monthly_amount * inst.remaining_months), 0) +
                          debtsReceivables.filter(d => d.type === 'debt' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0)
                        )}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <span>Total Receivables (Total Piutang):</span>
                      <strong style={{ color: 'var(--color-success)' }}>
                        {renderAmount(debtsReceivables.filter(d => d.type === 'receivable' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0))}
                      </strong>
                    </div>
                    {(() => {
                      const totalLiabilities = installments.reduce((sum, inst) => sum + (inst.monthly_amount * inst.remaining_months), 0) +
                        debtsReceivables.filter(d => d.type === 'debt' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0);
                      const totalReceivables = debtsReceivables.filter(d => d.type === 'receivable' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0);
                      const netPosition = totalReceivables - totalLiabilities;
                      
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', paddingTop: '0.25rem' }}>
                          <span>Net Position:</span>
                          <span style={{ color: netPosition >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {renderAmount(Math.abs(netPosition))} {netPosition >= 0 ? '(Surplus Aset)' : '(Defisit / Net Debt)'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {liabilitiesSubTab === 'installments' && (
              <div>
                {/* Top Cards for CC Projections */}
            <div className="grid-cols-2" style={{ gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Amortization Info Card */}
              <div className="glass-panel card-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ marginBottom: '0.5rem' }}>Debt Payoff Estimator</h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    Check details of active installments (0% interest or credit cycle charges) imported from statements and estimate when your accounts will be fully paid off.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '10px' }}>
                  {projections.map(proj => (
                    <div key={proj.card_id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <div>
                        <strong>{proj.card_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Debt Free Timeline</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="text-warning" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                          {proj.months_to_debt_free > 0 ? `${proj.months_to_debt_free} Months` : 'Debt-Free'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Remaining: {renderAmount(proj.outstanding_installment_debt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Debt Amortization Chart */}
              <div className="glass-panel card-content">
                <h3 style={{ marginBottom: '0.5rem' }}>Amortization Timeline Projection</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  Projected monthly credit card billing amounts due exclusively to active installments.
                </p>

                {projections.length === 0 || projections[0]?.monthly_schedule?.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No active credit card installment plans to project.
                  </div>
                ) : (
                  <div>
                    {/* Amortization Bar charts using pure HTML/CSS */}
                    <div className="timeline-chart">
                      {projections[0]?.monthly_schedule.map((m: any) => {
                        // find max payment in array to scale heights
                        const maxPayment = Math.max(...projections[0].monthly_schedule.map((item: any) => item.payment), 1);
                        const pctHeight = Math.max(5, (m.payment / maxPayment) * 90); // cap to 90% height max
                        
                        return (
                          <div key={m.monthIndex} className="timeline-bar-wrapper">
                            <div 
                              className="timeline-bar"
                              style={{ height: `${pctHeight}%` }}
                            >
                              <div className="timeline-tooltip">
                                <strong>{renderAmount(m.payment)}</strong><br />
                                <span>{m.activeCount} active plans</span>
                              </div>
                            </div>
                            <div className="timeline-label">{m.label}</div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--color-primary)', borderRadius: '2px' }} />
                        <span>Installment Bill</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Active Installment Plans - Full Width */}
            <div className="glass-panel card-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Active Installment Plans</h3>
                <button
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  onClick={() => setShowAddInstModal(true)}
                >
                  <Icons.Plus /> Add Installment
                </button>
              </div>

              <div className="table-container">
                {installments.length === 0 ? (
                  <div style={{ padding: '3rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    Belum ada cicilan aktif. Import transaksi kartu kredit dari PDF atau klik <strong>Add Installment</strong> untuk menambah manual.
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Card Name</th>
                        <th>Description</th>
                        <th>Merchant</th>
                        <th>Product</th>
                        <th>Start Date</th>
                        <th style={{ textAlign: 'right' }}>Monthly Bill</th>
                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                        <th>Remaining (Mo)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map(i => (
                        <tr key={i.id}>
                          <td style={{ fontWeight: 600 }}>{i.card_name}</td>
                          <td>{i.description}</td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {i.merchant_name || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {i.product_name || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{i.start_date}</td>
                          <td className="text-danger" style={{ fontWeight: 600, textAlign: 'right' }}>
                            {renderAmount(i.monthly_amount)}
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--color-warning)', textAlign: 'right' }}>
                            {renderAmount(i.monthly_amount * i.remaining_months)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <strong className="text-warning">{i.remaining_months}</strong>
                              <span>/ {i.total_months} mo</span>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem', borderRadius: '4px' }}
                                onClick={() => handleTickInstallment(i.id)}
                                title="Kurangi sisa bulan sebanyak 1 (simulasi siklus tagihan)"
                                disabled={i.remaining_months <= 0}
                              >
                                Tick
                              </button>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                                onClick={() => openInstTransactions(i)}
                                title="Lihat transaksi terkait cicilan ini"
                              >
                                <Icons.Ledger />
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                                onClick={() => openEditInstallment(i)}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', opacity: i.remaining_months === 0 ? 1 : 0.6 }}
                                onClick={() => handleArchiveInstallment(i.id)}
                                title={i.remaining_months === 0 ? 'Arsipkan (Lunas)' : 'Arsipkan'}
                              >
                                📦
                              </button>
                              <button
                                className="btn"
                                style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent' }}
                                onClick={() => handleDeleteInstallment(i.id)}
                              >
                                <Icons.Delete />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Archived Installments */}
            <div className="glass-panel card-content" style={{ marginTop: '1.5rem' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={toggleShowArchived}
              >
                <h3 style={{ margin: 0 }}>📦 Arsip Cicilan</h3>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  {showArchived ? '▲ Sembunyikan' : '▼ Tampilkan'}
                </span>
              </div>

              {showArchived && (
                <div style={{ marginTop: '1rem' }}>
                  {archivedInsts.length === 0 ? (
                    <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                      Belum ada cicilan yang diarsipkan.
                    </p>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Card Name</th>
                            <th>Description</th>
                            <th>Merchant</th>
                            <th>Product</th>
                            <th>Monthly Bill</th>
                            <th>Duration</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {archivedInsts.map(i => (
                            <tr key={i.id} style={{ opacity: 0.7 }}>
                              <td style={{ fontWeight: 600 }}>{i.card_name}</td>
                              <td>
                                <div>{i.description}</div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Started: {i.start_date}</span>
                              </td>
                              <td style={{ fontSize: '0.85rem' }}>{i.merchant_name || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>}</td>
                              <td style={{ fontSize: '0.85rem' }}>{i.product_name || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>}</td>
                              <td style={{ fontWeight: 600 }}>{renderAmount(i.monthly_amount)}</td>
                              <td style={{ color: 'var(--color-text-muted)' }}>{i.total_months} bulan</td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                    onClick={() => handleUnarchiveInstallment(i.id)}
                                    title="Kembalikan ke aktif"
                                  >
                                    ↩️ Aktifkan
                                  </button>
                                  <button
                                    className="btn"
                                    style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent' }}
                                    onClick={() => handleDeleteInstallment(i.id)}
                                    title="Hapus permanen"
                                  >
                                    <Icons.Delete />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
            )}

            {liabilitiesSubTab === 'loans' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2>🤝 Kelola Hutang & Piutang</h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      Pantau catatan pinjaman uang dari orang lain (Hutang) dan uang yang dipinjamkan ke orang lain (Piutang).
                    </p>
                  </div>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setDrType('debt');
                      setDrPerson('');
                      setDrAmount('');
                      setDrDescription('');
                      setDrDate(new Date().toISOString().split('T')[0]);
                      setDrDueDate('');
                      setDrAccountId('');
                      setShowAddDRModal(true);
                    }}
                  >
                    + Catat Baru
                  </button>
                </div>

                {loadingDR ? (
                  <div className="glass-panel card-content" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Memuat data Hutang & Piutang...</p>
                  </div>
                ) : (
                  <>
                    {/* Summary Cards */}
                    <div className="grid-cols-2" style={{ gap: '1.5rem' }}>
                      <div className="glass-panel card-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--color-danger)' }}>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>TOTAL HUTANG AKTIF (Harus Dibayar)</span>
                        <h2 style={{ color: 'var(--color-danger)', margin: 0 }}>
                          {renderAmount(
                            debtsReceivables
                              .filter(d => d.type === 'debt' && d.status === 'active')
                              .reduce((sum, d) => sum + d.remaining_amount, 0)
                          )}
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Dari {debtsReceivables.filter(d => d.type === 'debt' && d.status === 'active').length} catatan aktif
                        </span>
                      </div>

                      <div className="glass-panel card-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--color-success)' }}>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>TOTAL PIUTANG AKTIF (Harus Ditagih)</span>
                        <h2 style={{ color: 'var(--color-success)', margin: 0 }}>
                          {renderAmount(
                            debtsReceivables
                              .filter(d => d.type === 'receivable' && d.status === 'active')
                              .reduce((sum, d) => sum + d.remaining_amount, 0)
                          )}
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Dari {debtsReceivables.filter(d => d.type === 'receivable' && d.status === 'active').length} catatan aktif
                        </span>
                      </div>
                    </div>

                    {/* Lists Stacking */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      
                      {/* HUTANG PANEL */}
                      <div className="glass-panel card-content" style={{ padding: '1.25rem' }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)' }}>
                          🔴 Daftar Hutang Saya
                        </h3>
                        <div className="table-container">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Pemberi Pinjaman</th>
                                <th>Keterangan / Tujuan</th>
                                <th>Tanggal Pinjam</th>
                                <th>Jatuh Tempo</th>
                                <th style={{ textAlign: 'right' }}>Jumlah Awal</th>
                                <th style={{ textAlign: 'right' }}>Sisa Hutang</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'center', width: '120px' }}>Tindakan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {debtsReceivables.filter(d => d.type === 'debt').length === 0 ? (
                                <tr>
                                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem' }}>
                                    Tidak ada catatan hutang.
                                  </td>
                                </tr>
                              ) : (
                                debtsReceivables.filter(d => d.type === 'debt').map(d => (
                                  <tr key={d.id}>
                                    <td><strong>{d.person}</strong></td>
                                    <td>{d.description}</td>
                                    <td>{d.date}</td>
                                    <td>{d.due_date || '-'}</td>
                                    <td style={{ textAlign: 'right' }}>{renderAmount(d.amount)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: d.status === 'active' ? 'bold' : 'normal', color: d.status === 'active' ? 'var(--color-danger)' : 'inherit' }}>
                                      {renderAmount(d.remaining_amount)}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span className={`badge ${d.status === 'active' ? 'badge-danger' : 'badge-success'}`}>
                                        {d.status === 'active' ? 'Belum Lunas' : 'Lunas'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                        {d.status === 'active' && (
                                          <button
                                            className="btn btn-primary"
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0 }}
                                            onClick={() => {
                                              setPayingDR(d);
                                              setPayAmount(String(d.remaining_amount));
                                              setPayDate(new Date().toISOString().split('T')[0]);
                                              setPayAccountId('');
                                              setPayNote('');
                                            }}
                                            title="Bayar Hutang"
                                          >
                                            💸 Bayar
                                          </button>
                                        )}
                                        <button
                                          className="btn btn-secondary"
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0 }}
                                          onClick={() => setViewDRDetails(d)}
                                          title="Riwayat Detail"
                                        >
                                          👁️
                                        </button>
                                        <button
                                          className="btn"
                                          style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent', margin: 0 }}
                                          onClick={() => handleDeleteDR(d.id)}
                                          title="Hapus"
                                        >
                                          <Icons.Delete />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* PIUTANG PANEL */}
                      <div className="glass-panel card-content" style={{ padding: '1.25rem' }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)' }}>
                          🟢 Daftar Piutang (Uang Saya di Orang Lain)
                        </h3>
                        <div className="table-container">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Peminjam</th>
                                <th>Keterangan / Tujuan</th>
                                <th>Tanggal Pinjam</th>
                                <th>Jatuh Tempo</th>
                                <th style={{ textAlign: 'right' }}>Jumlah Awal</th>
                                <th style={{ textAlign: 'right' }}>Sisa Tagihan</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'center', width: '120px' }}>Tindakan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {debtsReceivables.filter(d => d.type === 'receivable').length === 0 ? (
                                <tr>
                                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem' }}>
                                    Tidak ada catatan piutang.
                                  </td>
                                </tr>
                              ) : (
                                debtsReceivables.filter(d => d.type === 'receivable').map(d => (
                                  <tr key={d.id}>
                                    <td><strong>{d.person}</strong></td>
                                    <td>{d.description}</td>
                                    <td>{d.date}</td>
                                    <td>{d.due_date || '-'}</td>
                                    <td style={{ textAlign: 'right' }}>{renderAmount(d.amount)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: d.status === 'active' ? 'bold' : 'normal', color: d.status === 'active' ? 'var(--color-success)' : 'inherit' }}>
                                      {renderAmount(d.remaining_amount)}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span className={`badge ${d.status === 'active' ? 'badge-warning' : 'badge-success'}`}>
                                        {d.status === 'active' ? 'Belum Tagih' : 'Lunas'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                        {d.status === 'active' && (
                                          <button
                                            className="btn btn-primary"
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, background: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                                            onClick={() => {
                                              setPayingDR(d);
                                              setPayAmount(String(d.remaining_amount));
                                              setPayDate(new Date().toISOString().split('T')[0]);
                                              setPayAccountId('');
                                              setPayNote('');
                                            }}
                                            title="Terima Pembayaran"
                                          >
                                            📥 Terima
                                          </button>
                                        )}
                                        <button
                                          className="btn btn-secondary"
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0 }}
                                          onClick={() => setViewDRDetails(d)}
                                          title="Riwayat Detail"
                                        >
                                          👁️
                                        </button>
                                        <button
                                          className="btn"
                                          style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent', margin: 0 }}
                                          onClick={() => handleDeleteDR(d.id)}
                                          title="Hapus"
                                        >
                                          <Icons.Delete />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  </>
                )}
              </div>
            )}
          </div>

        {/* Add Debt/Receivable Modal */}
        {showAddDRModal && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>Catat Baru Hutang / Piutang</h3>
                <button 
                  type="button" 
                  onClick={() => setShowAddDRModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateDR} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Tipe Catatan</label>
                  <select
                    className="form-control"
                    value={drType}
                    onChange={(e) => setDrType(e.target.value as any)}
                    required
                  >
                    <option value="debt">Hutang (Saya Meminjam Uang)</option>
                    <option value="receivable">Piutang (Saya Meminjamkan Uang)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>{drType === 'debt' ? 'Pemberi Pinjaman' : 'Peminjam'}</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nama Orang/Pihak Terkait"
                    value={drPerson}
                    onChange={(e) => setDrPerson(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Nominal Jumlah Awal (IDR)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Nominal"
                    value={drAmount}
                    onChange={(e) => setDrAmount(e.target.value)}
                    min="1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Deskripsi / Keperluan</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Pinjaman modal usaha, Beli handphone"
                    value={drDescription}
                    onChange={(e) => setDrDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Tanggal Pinjam</label>
                    <input
                      type="date"
                      className="form-control"
                      value={drDate}
                      onChange={(e) => setDrDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Jatuh Tempo (Opsional)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={drDueDate}
                      onChange={(e) => setDrDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Akun Sumber / Tujuan (Opsional)</label>
                  <select
                    className="form-control"
                    value={drAccountId}
                    onChange={(e) => setDrAccountId(e.target.value)}
                  >
                    <option value="">-- Tanpa Akun Ledger (Mencatat Diluar App) --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type === 'bank' ? 'Bank' : acc.type === 'cash' ? 'Cash/Wallet' : 'Kartu Kredit'})
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '0.25rem' }}>
                    {drType === 'debt' 
                      ? 'Jika dipilih, saldo akun akan otomatis BERTAMBAH karena menerima uang pinjaman.' 
                      : 'Jika dipilih, saldo akun akan otomatis BERKURANG karena meminjamkan uang.'
                    }
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Simpan Catatan
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => setShowAddDRModal(false)}
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Repay / Collect Loan Modal */}
        {payingDR && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '450px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>
                  {payingDR.type === 'debt' ? 'Bayar Cicilan Hutang' : 'Terima Pembayaran Piutang'}
                </h3>
                <button 
                  type="button" 
                  onClick={() => setPayingDR(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Pihak Terkait:</span>
                  <strong>{payingDR.person}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Keterangan:</span>
                  <span>{payingDR.description}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Sisa Saldo:</span>
                  <strong style={{ color: payingDR.type === 'debt' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {renderAmount(payingDR.remaining_amount)}
                  </strong>
                </div>
              </div>

              <form onSubmit={handlePayDR} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Pilih Akun Rekening / Kas</label>
                  <select
                    className="form-control"
                    value={payAccountId}
                    onChange={(e) => setPayAccountId(e.target.value)}
                    required
                  >
                    <option value="">-- Pilih Rekening --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({renderAmount(acc.current_balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Nominal Pembayaran (IDR)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Nominal"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    max={payingDR.remaining_amount}
                    min="1"
                    required
                  />
                  <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '0.25rem' }}>
                    Maksimal pembayaran: {formatIDR(payingDR.remaining_amount)}
                  </small>
                </div>

                <div className="form-group">
                  <label>Tanggal Transaksi</label>
                  <input
                    type="date"
                    className="form-control"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Catatan Tambahan (Opsional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Pembayaran cicilan 1, Pelunasan"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, background: payingDR.type === 'debt' ? 'var(--color-danger)' : 'var(--color-success)', borderColor: payingDR.type === 'debt' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    Konfirmasi
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => setPayingDR(null)}
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Installment Modal */}
        {editingInst && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>Edit Cicilan</h3>
                <button
                  type="button"
                  onClick={() => setEditingInst(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                <strong style={{ color: 'var(--color-text)' }}>{editingInst.card_name}</strong>
                {' · '}Started: {editingInst.start_date}
                {' · '}<span className="text-danger">{renderAmount(editingInst.monthly_amount)}/bln</span>
              </div>

              <form onSubmit={handleEditInstallment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editInstDesc}
                    onChange={(e) => setEditInstDesc(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nama Merchant <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(Opsional)</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Tokopedia, Shopee"
                    value={editInstMerchant}
                    onChange={(e) => setEditInstMerchant(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Nama Produk <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(Opsional)</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. iPhone 15, Laptop Asus"
                    value={editInstProduct}
                    onChange={(e) => setEditInstProduct(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Simpan
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setEditingInst(null)}
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Installment Modal */}
        {showAddInstModal && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '95%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>Tambah Cicilan Manual</h3>
                <button
                  type="button"
                  onClick={() => setShowAddInstModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleAddInstallment}>
                <div className="form-group">
                  <label>Credit Card Account</label>
                  <select
                    className="form-control"
                    value={newInstCard}
                    onChange={(e) => setNewInstCard(e.target.value)}
                    required
                  >
                    <option value="">-- Select --</option>
                    {accounts.filter(a => a.type === 'credit_card').map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Tokopedia Cicilan Laptop"
                    value={newInstDesc}
                    onChange={(e) => setNewInstDesc(e.target.value)}
                    required
                  />
                </div>
                <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Nama Merchant <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(Opsional)</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Tokopedia, Shopee"
                      value={newInstMerchant}
                      onChange={(e) => setNewInstMerchant(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nama Produk <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(Opsional)</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. iPhone 15, Laptop Asus"
                      value={newInstProduct}
                      onChange={(e) => setNewInstProduct(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Monthly Bill (IDR)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g. 500000"
                      value={newInstAmount}
                      onChange={(e) => setNewInstAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Total Duration (Months)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g. 12"
                      value={newInstMonths}
                      onChange={(e) => setNewInstMonths(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={newInstDate}
                    onChange={(e) => setNewInstDate(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    <Icons.Plus /> Save Installment
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setShowAddInstModal(false)}
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Installment Transactions Modal */}
        {viewingInstTx && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '95%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>
                  🧾 Transaksi Terkait: {viewingInstTx.description}
                </h3>
                <button
                  type="button"
                  onClick={() => setViewingInstTx(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Installment Summary */}
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Kartu Kredit</div>
                  <strong>{viewingInstTx.card_name}</strong>
                </div>
                {viewingInstTx.merchant_name && (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Merchant</div>
                    <strong>{viewingInstTx.merchant_name}</strong>
                  </div>
                )}
                {viewingInstTx.product_name && (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Produk</div>
                    <strong>{viewingInstTx.product_name}</strong>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Tagihan / Bulan</div>
                  <strong className="text-danger">{renderAmount(viewingInstTx.monthly_amount)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Sisa Bulan</div>
                  <strong className="text-warning">{viewingInstTx.remaining_months} / {viewingInstTx.total_months} bulan</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Start Date</div>
                  <strong>{viewingInstTx.start_date}</strong>
                </div>
              </div>

              {loadingInstTx ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                  Memuat transaksi...
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Akun</th>
                        <th>Deskripsi</th>
                        <th>Kategori</th>
                        <th style={{ textAlign: 'right' }}>Nominal</th>
                        <th>Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                            Belum ada transaksi yang dikaitkan dengan cicilan ini. Transaksi akan muncul di sini jika di-tag sebagai bagian dari cicilan ini saat import PDF.
                          </td>
                        </tr>
                      ) : (
                        instTransactions.map((tx: any) => (
                          <tr key={tx.id}>
                            <td style={{ fontSize: '0.85rem' }}>{tx.date}</td>
                            <td style={{ fontSize: '0.85rem' }}>{tx.account_name}</td>
                            <td style={{ fontSize: '0.85rem' }}>{tx.description}</td>
                            <td style={{ fontSize: '0.85rem' }}>{tx.category}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: tx.amount < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                              {tx.amount < 0 ? '-' : '+'}{formatIDR(Math.abs(tx.amount))}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{tx.note || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setViewingInstTx(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Debt/Receivable Details & History Modal */}
        {viewDRDetails && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '95%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>
                  🔍 Riwayat Transaksi: {viewDRDetails.type === 'debt' ? 'Hutang' : 'Piutang'} - {viewDRDetails.person}
                </h3>
                <button 
                  type="button" 
                  onClick={() => setViewDRDetails(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* DR Card Info */}
              <div className="grid-cols-3" style={{ gap: '1rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Keperluan / Deskripsi:</div>
                  <strong style={{ fontSize: '0.95rem' }}>{viewDRDetails.description}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Tanggal Pinjam:</div>
                  <strong style={{ fontSize: '0.95rem' }}>{viewDRDetails.date}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Status Kelunasan:</div>
                  <span className={`badge ${viewDRDetails.status === 'active' ? 'badge-danger' : 'badge-success'}`}>
                    {viewDRDetails.status === 'active' ? 'Belum Lunas' : 'Lunas'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Jumlah Nominal Awal:</div>
                  <strong>{formatIDR(viewDRDetails.amount)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Total Sisa Tagihan:</div>
                  <strong style={{ color: viewDRDetails.type === 'debt' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {formatIDR(viewDRDetails.remaining_amount)}
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Jatuh Tempo:</div>
                  <strong>{viewDRDetails.due_date || '-'}</strong>
                </div>
              </div>

              <h4 style={{ marginBottom: '0.75rem' }}>Daftar Mutasi / Aliran Dana Terkait</h4>
              <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Akun Rekening</th>
                      <th>Keterangan Mutasi</th>
                      <th style={{ textAlign: 'right' }}>Nominal (IDR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!viewDRDetails.payments || viewDRDetails.payments.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem' }}>
                          Belum ada transaksi pembayaran yang tercatat di ledger.
                        </td>
                      </tr>
                    ) : (
                      viewDRDetails.payments.map((p: any) => {
                        const accName = accounts.find((a: any) => a.id === p.account_id)?.name || 'Unknown Account';
                        return (
                          <tr key={p.id}>
                            <td>{p.date}</td>
                            <td>{accName}</td>
                            <td>{p.description}</td>
                            <td style={{ textAlign: 'right', fontWeight: '600', color: p.amount < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                              {p.amount < 0 ? '-' : '+'}{formatIDR(Math.abs(p.amount))}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setViewDRDetails(null)}
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
