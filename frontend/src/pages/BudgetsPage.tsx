import React, { useState, useEffect, useMemo } from 'react';
import { API_URL, CATEGORIES } from '../constants';
import TransactionEditModal from '../components/TransactionEditModal';
import { useApp } from '../context/AppContext';

export default function BudgetsPage() {
  const {
    budgets, dbCategories, groupedCategories, getFullCategoryName, renderAmount, fetchData,
    selectedBudgetMonth, budgetViewPeriod,
    selectedBudgetYear, setSelectedBudgetYear, setBudgetStartYear, setBudgetEndYear,
  } = useApp();

  const [budgetType, setBudgetType] = useState<'expense' | 'income'>('expense');
  const [isAddBudgetModalOpen, setIsAddBudgetModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<any | null>(null);

  // Range & Recurrence States
  const [budgetStartDate, setBudgetStartDate] = useState('');
  const [budgetEndDate, setBudgetEndDate] = useState('');
  const [budgetRecurrence, setBudgetRecurrence] = useState<'monthly' | 'weekly' | 'none'>('monthly');
  const [budgetRecurrenceDay, setBudgetRecurrenceDay] = useState('1'); // Date (1-31) or Day of week (1-7)

  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingBudgetAmount, setEditingBudgetAmount] = useState('');
  const [editingBudgetCategory, setEditingBudgetCategory] = useState('');
  const [editingBudgetStartDate, setEditingBudgetStartDate] = useState('');
  const [editingBudgetEndDate, setEditingBudgetEndDate] = useState('');
  const [editingBudgetRecurrence, setEditingBudgetRecurrence] = useState<'monthly' | 'weekly' | 'none'>('monthly');
  const [editingBudgetRecurrenceDay, setEditingBudgetRecurrenceDay] = useState('1');
  const [budgetTxModal, setBudgetTxModal] = useState<{ budget: any; transactions: any[]; loading: boolean; dateRange: string } | null>(null);

  // Filter categories dynamically for budget setup (based on budgetType)
  const filteredCategoriesForBudget = useMemo(() => {
    const result: typeof groupedCategories = [];
    groupedCategories.forEach(group => {
      const parentMatch = group.parent.type === 'both' || group.parent.type === budgetType;
      const matchedSubs = group.subs.filter(sub => sub.type === 'both' || sub.type === budgetType);
      
      if (parentMatch || matchedSubs.length > 0) {
        result.push({
          parent: group.parent,
          subs: matchedSubs
        });
      }
    });
    return result;
  }, [groupedCategories, budgetType]);

  // Budget setup form
  const [budgetCategory, setBudgetCategory] = useState(CATEGORIES[0]);
  const [budgetAmount, setBudgetAmount] = useState('');

  // Automatically update selected category when filtered categories list changes
  useEffect(() => {
    if (filteredCategoriesForBudget.length > 0) {
      const firstGroup = filteredCategoriesForBudget[0];
      if (firstGroup.subs.length > 0) {
        setBudgetCategory(firstGroup.subs[0].name);
      } else {
        setBudgetCategory(firstGroup.parent.name);
      }
    }
  }, [filteredCategoriesForBudget]);

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetAmount) return;

    // Dynamically calculate month_year from start_date if available
    let targetMonthYear = selectedBudgetMonth;
    if (budgetStartDate) {
      const [y, m] = budgetStartDate.split('-');
      if (y && m) {
        targetMonthYear = `${y}-${m}`;
      }
    }

    try {
      const res = await fetch(`${API_URL}/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: budgetCategory,
          amount: parseFloat(budgetAmount),
          month_year: targetMonthYear,
          start_date: budgetStartDate || null,
          end_date: budgetEndDate || null,
          recurrence: budgetRecurrence,
          recurrence_day: budgetRecurrenceDay ? parseInt(budgetRecurrenceDay) : null
        })
      });
      if (res.ok) {
        setBudgetAmount('');
        setBudgetStartDate('');
        setBudgetEndDate('');
        setBudgetRecurrence('monthly');
        setBudgetRecurrenceDay('1');
        setIsAddBudgetModalOpen(false);
        fetchData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Gagal menyimpan anggaran.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditBudget = (budget: any) => {
    setEditingBudgetId(budget.id);
    setEditingBudgetAmount(String(budget.amount));
    setEditingBudgetCategory(budget.category);
    setEditingBudgetStartDate(budget.start_date || '');
    setEditingBudgetEndDate(budget.end_date || '');
    setEditingBudgetRecurrence(budget.recurrence || 'monthly');
    setEditingBudgetRecurrenceDay(budget.recurrence_day !== null && budget.recurrence_day !== undefined ? String(budget.recurrence_day) : '1');
  };

  const handleSaveEditedBudget = async (budget: any) => {
    if (!editingBudgetAmount || isNaN(parseFloat(editingBudgetAmount)) || !editingBudgetCategory) return;
    try {
      const res = await fetch(`${API_URL}/budgets/${budget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editingBudgetCategory,
          amount: parseFloat(editingBudgetAmount),
          start_date: editingBudgetStartDate || null,
          end_date: editingBudgetEndDate || null,
          recurrence: editingBudgetRecurrence,
          recurrence_day: editingBudgetRecurrenceDay ? parseInt(editingBudgetRecurrenceDay) : null
        })
      });
      if (res.ok) {
        setEditingBudgetId(null);
        setEditingBudgetAmount('');
        setEditingBudgetCategory('');
        setEditingBudgetStartDate('');
        setEditingBudgetEndDate('');
        setEditingBudgetRecurrence('monthly');
        setEditingBudgetRecurrenceDay('1');
        fetchData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Gagal menyimpan perubahan anggaran.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan saat memperbarui anggaran.');
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus anggaran ini?')) return;
    try {
      const params = new URLSearchParams({
        period: budgetViewPeriod,
        month_year: selectedBudgetMonth,
        ...(budgetViewPeriod === 'yearly' ? { year: String(selectedBudgetYear) } : {})
      });
      const res = await fetch(`${API_URL}/budgets/${budgetId}?${params}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menghapus anggaran');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewBudgetTransactions = async (budget: any) => {
    // Compute date range based on current period view
    const [yearStr, monthStr] = selectedBudgetMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    let startDate: string;
    let endDate: string;

    if (budgetViewPeriod === 'yearly') {
      startDate = `${selectedBudgetYear}-01-01`;
      endDate = `${selectedBudgetYear}-12-31`;
    } else if (budgetViewPeriod === 'quarterly') {
      const q = Math.ceil(month / 3);
      const sm = (q - 1) * 3 + 1;
      const em = q * 3;
      startDate = `${year}-${String(sm).padStart(2, '0')}-01`;
      const lastDay = new Date(year, em, 0).getDate();
      endDate = `${year}-${String(em).padStart(2, '0')}-${lastDay}`;
    } else if (budgetViewPeriod === 'semesterly') {
      const s = Math.ceil(month / 6);
      const sm = (s - 1) * 6 + 1;
      const em = s * 6;
      startDate = `${year}-${String(sm).padStart(2, '0')}-01`;
      const lastDay = new Date(year, em, 0).getDate();
      endDate = `${year}-${String(em).padStart(2, '0')}-${lastDay}`;
    } else {
      // monthly
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    }

    const dateRange = `${startDate} s/d ${endDate}`;
    setBudgetTxModal({ budget, transactions: [], loading: true, dateRange });

    try {
      const params = new URLSearchParams({ category: budget.category, start_date: startDate, end_date: endDate });
      const res = await fetch(`${API_URL}/transactions?${params}`);
      const data = await res.json();
      setBudgetTxModal({ budget, transactions: data, loading: false, dateRange });
    } catch (err) {
      console.error(err);
      setBudgetTxModal(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  return (
    <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Pelacakan Anggaran / Budgeting</h2>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ height: '40px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                onClick={() => {
                  // Initialize start date convenience
                  if (selectedBudgetMonth) {
                    setBudgetStartDate(`${selectedBudgetMonth}-01`);
                  }
                  setIsAddBudgetModalOpen(true);
                }}
              >
                ➕ Tambah Anggaran Baru
              </button>
            </div>

            {/* Modal Overlay for Add Budget */}
            {/* Budget Transaction Detail Modal */}
            {budgetTxModal && (
              <div className="modal-overlay" onClick={() => setBudgetTxModal(null)}>
                <div className="modal-content glass-panel" style={{ maxWidth: '700px', width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexShrink: 0 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem' }}>📋 Transaksi: {budgetTxModal.budget.category}</h3>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{budgetTxModal.dateRange}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBudgetTxModal(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', lineHeight: 1 }}
                    >×</button>
                  </div>

                  {/* Summary bar */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1, minWidth: '120px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>Anggaran</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{renderAmount(budgetTxModal.budget.amount)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1, minWidth: '120px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>Terpakai</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: budgetTxModal.budget.spent > budgetTxModal.budget.amount ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {renderAmount(budgetTxModal.budget.spent)}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1, minWidth: '120px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>Jumlah Transaksi</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{budgetTxModal.loading ? '...' : budgetTxModal.transactions.length}</div>
                    </div>
                  </div>

                  {/* Transaction list */}
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {budgetTxModal.loading ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Memuat transaksi...</div>
                    ) : budgetTxModal.transactions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Tidak ada transaksi pada periode ini.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, background: 'var(--color-surface)' }}>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Tanggal</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Keterangan</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Akun</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-muted)' }}>Jumlah</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {budgetTxModal.transactions.map((tx: any) => (
                            <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{tx.date}</td>
                              <td style={{ padding: '0.5rem' }}>
                                <div>{tx.description}</div>
                                {tx.note && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{tx.note}</div>}
                              </td>
                              <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{tx.account_name}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: tx.amount >= 0 ? 'var(--color-income)' : 'var(--color-expense)', whiteSpace: 'nowrap' }}>
                                {renderAmount(tx.amount)}
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => setEditingTx(tx)}
                                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', cursor: 'pointer', padding: '0.15rem 0.4rem', borderRadius: '4px', whiteSpace: 'nowrap' }}
                                  title="Edit transaksi"
                                >
                                  ✏️ Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isAddBudgetModalOpen && (
              <div className="modal-overlay">
                <div className="modal-content glass-panel" style={{ maxWidth: '500px', width: '90%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>Atur Anggaran Baru</h3>
                    <button
                      type="button"
                      onClick={() => setIsAddBudgetModalOpen(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Selectors for Type, Range, and Recurrence */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', width: '120px' }}>Tipe Anggaran:</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          type="button"
                          className={`btn ${budgetType === 'expense' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => setBudgetType('expense')}
                        >
                          💸 Pengeluaran
                        </button>
                        <button 
                          type="button"
                          className={`btn ${budgetType === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => setBudgetType('income')}
                        >
                          💰 Pemasukan
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Mulai Tanggal:</label>
                        <input 
                          type="date" 
                          className="form-control" 
                          value={budgetStartDate}
                          onChange={(e) => setBudgetStartDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Sampai Tanggal:</label>
                        <input 
                          type="date" 
                          className="form-control" 
                          value={budgetEndDate}
                          onChange={(e) => setBudgetEndDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Frekuensi:</label>
                        <select
                          className="form-control"
                          value={budgetRecurrence}
                          onChange={(e) => setBudgetRecurrence(e.target.value as any)}
                        >
                          <option value="none">Satu Kali Saja</option>
                          <option value="monthly">Bulanan</option>
                          <option value="weekly">Mingguan</option>
                        </select>
                      </div>
                      {budgetRecurrence !== 'none' && (
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {budgetRecurrence === 'weekly' ? 'Hari Pengulangan:' : 'Tanggal Pengulangan:'}
                          </label>
                          <select
                            className="form-control"
                            value={budgetRecurrenceDay}
                            onChange={(e) => setBudgetRecurrenceDay(e.target.value)}
                          >
                            {budgetRecurrence === 'weekly' ? (
                              <>
                                <option value="1">Senin</option>
                                <option value="2">Selasa</option>
                                <option value="3">Rabu</option>
                                <option value="4">Kamis</option>
                                <option value="5">Jumat</option>
                                <option value="6">Sabtu</option>
                                <option value="7">Minggu</option>
                              </>
                            ) : (
                              Array.from({ length: 31 }, (_, idx) => (
                                <option key={idx + 1} value={idx + 1}>Tanggal {idx + 1}</option>
                              ))
                            )}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleAddBudget}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label>Pilih Kategori</label>
                      <select 
                        className="form-control"
                        value={budgetCategory}
                        onChange={(e) => setBudgetCategory(e.target.value)}
                      >
                        {filteredCategoriesForBudget.map(group => (
                          <optgroup key={group.parent.id} label={group.parent.name}>
                            <option value={group.parent.name}>{group.parent.name}</option>
                            {group.subs.map(sub => (
                              <option key={sub.id} value={sub.name}>↳ {sub.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label>Nominal Anggaran Bulanan (IDR)</label>
                      <input 
                        type="number" 
                        className="form-control"
                        placeholder="Contoh: 2000000"
                        value={budgetAmount}
                        onChange={(e) => setBudgetAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ height: '40px', padding: '0 1.5rem' }} 
                        onClick={() => setIsAddBudgetModalOpen(false)}
                      >
                        Batal
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ height: '40px', padding: '0 1.5rem' }}
                      >
                        Pasang Anggaran
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Right: Budgets Progress Bars */}
            <div className="glass-panel card-content">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <h3 style={{ margin: 0 }}>Progress Anggaran</h3>
                  
                  {/* Year selector + MTD info */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Tahun:</span>
                    <select
                      className="form-control"
                      style={{ width: '90px', padding: '0.3rem 0.5rem', margin: 0, height: '30px', fontSize: '0.8rem' }}
                      value={selectedBudgetYear}
                      onChange={(e) => { const y = parseInt(e.target.value); setSelectedBudgetYear(y); setBudgetStartYear(y); setBudgetEndYear(y); }}
                    >
                      {Array.from({ length: 7 }, (_, i) => 2023 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    {/* MTD badge — only meaningful for current year */}
                    {selectedBudgetYear === new Date().getFullYear() && (() => {
                      const now = new Date();
                      const start = new Date(selectedBudgetYear, 0, 1);
                      const end   = new Date(selectedBudgetYear, 11, 31, 23, 59, 59);
                      const mtdPct = Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
                      return (
                        <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.12)', color: 'var(--color-primary)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '5px', padding: '0.2rem 0.5rem', fontWeight: 600 }}>
                          MTD {mtdPct}% hari terlewati
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
              
              {budgets.length === 0 ? (
                <div style={{ padding: '3rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  Belum ada anggaran yang diatur untuk periode ini. Pasang limit di panel kiri untuk memulai pelacakan.
                </div>
              ) : (() => {
                const incomeBudgets  = budgets.filter(b => b.type === 'income').sort((a, b) => getFullCategoryName(a.category).localeCompare(getFullCategoryName(b.category), 'id'));
                const expenseBudgets = budgets.filter(b => b.type !== 'income').sort((a, b) => getFullCategoryName(a.category).localeCompare(getFullCategoryName(b.category), 'id'));
                const totalIncomeBudget  = incomeBudgets.reduce((s, b) => s + b.amount, 0);
                const totalIncomeSpent   = incomeBudgets.reduce((s, b) => s + b.spent,  0);
                const totalExpenseBudget = expenseBudgets.reduce((s, b) => s + b.amount, 0);
                const totalExpenseSpent  = expenseBudgets.reduce((s, b) => s + b.spent,  0);
                const netBudget = totalIncomeBudget - totalExpenseBudget;
                const netActual = totalIncomeSpent  - totalExpenseSpent;

                // MTD progress (% of year elapsed) — used to draw the pace marker
                const mtdPct = (() => {
                  const now   = new Date();
                  const start = new Date(selectedBudgetYear, 0, 1);
                  const end   = new Date(selectedBudgetYear, 11, 31, 23, 59, 59);
                  if (now.getFullYear() !== selectedBudgetYear) return null;
                  return Math.min(100, Math.max(0, ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100));
                })();

                const renderCompactRow = (b: any) => {
                  const isIncome  = b.type === 'income';
                  const pct       = Math.min(100, b.amount > 0 ? (b.spent / b.amount) * 100 : 0);
                  const isOver    = !isIncome && b.spent > b.amount;
                  const isNear    = !isIncome && !isOver && pct >= 80;
                  const barColor  = isOver ? 'var(--color-danger)' : isNear ? 'var(--color-warning)' : isIncome ? 'var(--color-success)' : 'var(--color-primary)';
                  const amtColor  = isOver ? 'var(--color-danger)' : isNear ? 'var(--color-warning)' : isIncome ? 'var(--color-income)' : 'var(--color-text)';

                  return (
                    <div key={b.id}>
                      {/* Compact row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '0.6rem', alignItems: 'center', padding: '0.45rem 0.6rem', borderRadius: '6px', background: editingBudgetId === b.id ? 'rgba(255,255,255,0.03)' : 'transparent' }}>

                        {/* Left: name + progress */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getFullCategoryName(b.category)}</span>
                            <span style={{ fontSize: '0.6rem', padding: '0.08rem 0.3rem', borderRadius: '3px', fontWeight: 600, flexShrink: 0, background: isIncome ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)', color: isIncome ? 'var(--color-income)' : 'var(--color-primary)' }}>
                              {isIncome ? 'Income' : 'Expense'}
                            </span>
                            {isOver && <span style={{ fontSize: '0.6rem', color: 'var(--color-danger)', fontWeight: 700, flexShrink: 0 }}>⚠ OVER</span>}
                            {b.start_date && <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>📅 {b.start_date.slice(0,7)}→{b.end_date ? b.end_date.slice(0,7) : '∞'}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {/* Progress bar with MTD marker */}
                            <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', position: 'relative', overflow: 'visible' }}>
                              {/* Filled bar */}
                              <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '3px', transition: 'width 0.3s ease', overflow: 'hidden' }} />
                              {/* MTD pace marker — vertical tick */}
                              {mtdPct !== null && (
                                <div title={`Batas MTD: ${mtdPct.toFixed(0)}% waktu terlewati`} style={{
                                  position: 'absolute', top: '-3px', bottom: '-3px',
                                  left: `${mtdPct}%`, transform: 'translateX(-50%)',
                                  width: '2px', borderRadius: '1px',
                                  background: pct >= mtdPct
                                    ? (isIncome ? 'rgba(34,197,94,0.9)' : 'rgba(255,255,255,0.35)')
                                    : 'rgba(239,68,68,0.85)',
                                  zIndex: 2,
                                }} />
                              )}
                            </div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', flexShrink: 0, width: '30px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                          </div>
                        </div>

                        {/* Center: amounts */}
                        <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: amtColor }}>{renderAmount(b.spent)}</div>
                          <div style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)' }}>/ {renderAmount(b.amount)}</div>
                        </div>

                        {/* Right: action icons */}
                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}>
                          <button type="button" title="Lihat Transaksi" onClick={() => handleViewBudgetTransactions(b)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0.15rem', opacity: 0.6, lineHeight: 1 }}>📋</button>
                          <button type="button" title="Edit Anggaran" onClick={() => handleStartEditBudget(b)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0.15rem', opacity: 0.6, lineHeight: 1 }}>✏️</button>
                          <button type="button" title="Hapus Anggaran" onClick={() => handleDeleteBudget(b.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0.15rem', opacity: 0.6, lineHeight: 1 }}>🗑️</button>
                        </div>
                      </div>

                      {/* Inline edit form — expands below the row */}
                      {editingBudgetId === b.id && (
                        <div style={{ padding: '0.6rem 0.6rem 0.7rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0 0 6px 6px', marginTop: '-2px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem' }}>
                            <select className="form-control" style={{ height: '26px', fontSize: '0.75rem', padding: '0.1rem 0.4rem', margin: 0, flex: 1.5 }}
                              value={editingBudgetCategory} onChange={(e) => setEditingBudgetCategory(e.target.value)}>
                              {groupedCategories.map(group => (
                                <optgroup key={group.parent.id} label={group.parent.name}>
                                  <option value={group.parent.name}>{group.parent.name}</option>
                                  {group.subs.map(sub => <option key={sub.id} value={sub.name}>↳ {sub.name}</option>)}
                                </optgroup>
                              ))}
                            </select>
                            <input type="number" className="form-control" style={{ height: '26px', fontSize: '0.75rem', padding: '0.1rem 0.4rem', margin: 0, flex: 1 }}
                              value={editingBudgetAmount} onChange={(e) => setEditingBudgetAmount(e.target.value)} placeholder="Nominal" autoFocus />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.3rem', marginBottom: '0.4rem' }}>
                            <div>
                              <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block' }}>Mulai</label>
                              <input type="date" className="form-control" style={{ height: '24px', fontSize: '0.7rem', padding: '0.1rem 0.3rem', margin: 0 }}
                                value={editingBudgetStartDate} onChange={(e) => setEditingBudgetStartDate(e.target.value)} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block' }}>Sampai</label>
                              <input type="date" className="form-control" style={{ height: '24px', fontSize: '0.7rem', padding: '0.1rem 0.3rem', margin: 0 }}
                                value={editingBudgetEndDate} onChange={(e) => setEditingBudgetEndDate(e.target.value)} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block' }}>Frekuensi</label>
                              <select className="form-control" style={{ height: '24px', fontSize: '0.7rem', padding: '0.1rem 0.3rem', margin: 0 }}
                                value={editingBudgetRecurrence} onChange={(e) => setEditingBudgetRecurrence(e.target.value as any)}>
                                <option value="none">Satu Kali</option>
                                <option value="monthly">Bulanan</option>
                                <option value="weekly">Mingguan</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem' }}>
                            <button type="button" className="btn btn-primary" style={{ padding: '0.15rem 0.6rem', fontSize: '0.72rem', height: '24px' }} onClick={() => handleSaveEditedBudget(b)}>💾 Simpan</button>
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.15rem 0.6rem', fontSize: '0.72rem', height: '24px' }}
                              onClick={() => { setEditingBudgetId(null); setEditingBudgetAmount(''); setEditingBudgetCategory(''); setEditingBudgetStartDate(''); setEditingBudgetEndDate(''); setEditingBudgetRecurrence('monthly'); setEditingBudgetRecurrenceDay('1'); }}>
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {/* ── Summary totals ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1.25rem' }}>
                      {/* Income total */}
                      <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '8px', padding: '0.65rem 0.8rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total Pemasukan</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-income)' }}>{renderAmount(totalIncomeSpent)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>dari {renderAmount(totalIncomeBudget)}</div>
                        <div style={{ marginTop: '0.35rem', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, totalIncomeBudget > 0 ? (totalIncomeSpent / totalIncomeBudget) * 100 : 0)}%`, height: '100%', background: 'var(--color-success)', borderRadius: '2px' }} />
                        </div>
                      </div>

                      {/* Expense total */}
                      <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '0.65rem 0.8rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total Pengeluaran</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: totalExpenseSpent > totalExpenseBudget ? 'var(--color-danger)' : 'var(--color-expense, var(--color-danger))' }}>{renderAmount(totalExpenseSpent)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>dari {renderAmount(totalExpenseBudget)}</div>
                        <div style={{ marginTop: '0.35rem', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, totalExpenseBudget > 0 ? (totalExpenseSpent / totalExpenseBudget) * 100 : 0)}%`, height: '100%', background: totalExpenseSpent > totalExpenseBudget ? 'var(--color-danger)' : 'var(--color-primary)', borderRadius: '2px' }} />
                        </div>
                      </div>

                      {/* Net */}
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '0.65rem 0.8rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Selisih Aktual</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: netActual >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{renderAmount(netActual)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>target {renderAmount(netBudget)}</div>
                        <div style={{ marginTop: '0.35rem', fontSize: '0.65rem', color: netActual >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {netActual >= 0 ? '✓ Surplus' : '✗ Defisit'}
                        </div>
                      </div>
                    </div>

                    {/* ── Donut Charts ── */}
                    {(() => {
                      const INCOME_COLORS  = ['#22c55e','#4ade80','#34d399','#16a34a','#86efac','#6ee7b7'];
                      const EXPENSE_COLORS = ['#6366f1','#f97316','#ef4444','#eab308','#06b6d4','#808080'];

                      const getMainCat = (catName: string) => {
                        const cat = dbCategories.find(c => c.name === catName);
                        if (cat?.parent_id) {
                          const parent = dbCategories.find(p => p.id === cat.parent_id);
                          return parent?.name || catName;
                        }
                        return catName;
                      };

                      // Build groups, cap at top-5 + "Lainnya"
                      const buildGroups = (list: any[]): [string, number][] => {
                        const map: Record<string, number> = {};
                        list.forEach(b => {
                          const main = getMainCat(b.category);
                          map[main] = (map[main] || 0) + b.amount;
                        });
                        const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
                        if (sorted.length <= 5) return sorted;
                        const top5 = sorted.slice(0, 5);
                        const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
                        return [...top5, ['Lainnya', rest]];
                      };

                      const DonutChart = ({ groups, colors, total, accentColor, title }: {
                        groups: [string, number][]; colors: string[]; total: number; accentColor: string; title: string;
                      }) => {
                        if (total === 0 || groups.length === 0) return (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                            Tidak ada data
                          </div>
                        );

                        // SVG donut params
                        const R = 38, CX = 48, CY = 48, SW = 14;
                        const CIRC = 2 * Math.PI * R;
                        const GAP  = 2.5; // gap in px between slices

                        let cumulOffset = 0;
                        const slices = groups.map(([name, val], i) => {
                          const pct    = val / total;
                          const arcLen = Math.max(pct * CIRC - GAP, 0);
                          const s = { name, val, pct, arcLen, color: colors[i % colors.length], offset: cumulOffset };
                          cumulOffset += pct * CIRC;
                          return s;
                        });

                        return (
                          <div>
                            {/* Title */}
                            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: accentColor, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                              {title}
                            </div>

                            {/* Chart + Legend side-by-side */}
                            <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>

                              {/* SVG donut */}
                              <div style={{ position: 'relative', flexShrink: 0, width: '96px', height: '96px' }}>
                                <svg viewBox="0 0 96 96" width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
                                  {/* track */}
                                  <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={SW} />
                                  {/* slices */}
                                  {slices.map((s, i) => (
                                    <circle key={i} cx={CX} cy={CY} r={R} fill="none"
                                      stroke={s.color} strokeWidth={SW}
                                      strokeDasharray={`${s.arcLen} ${CIRC}`}
                                      strokeDashoffset={-s.offset}
                                      strokeLinecap="butt"
                                    />
                                  ))}
                                </svg>
                                {/* Center text */}
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                  <span style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.03em' }}>TOTAL</span>
                                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.2 }}>
                                    {total >= 1_000_000
                                      ? `${(total / 1_000_000).toFixed(1)}M`
                                      : total >= 1_000 ? `${(total / 1_000).toFixed(0)}K` : total}
                                  </span>
                                </div>
                              </div>

                              {/* Bar chart legend */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.32rem', minWidth: 0 }}>
                                {slices.map((s, i) => (
                                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                    {/* Label row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.3rem' }}>
                                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.name}</span>
                                      <span style={{ fontSize: '0.63rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                                        {s.val >= 1_000_000 ? `${(s.val / 1_000_000).toFixed(1)}M` : s.val >= 1_000 ? `${(s.val / 1_000).toFixed(0)}K` : s.val}
                                        <span style={{ color: accentColor, fontWeight: 600, marginLeft: '0.25rem' }}>{(s.pct * 100).toFixed(0)}%</span>
                                      </span>
                                    </div>
                                    {/* Bar track */}
                                    <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', borderRadius: '3px', background: s.color, width: `${(s.pct * 100).toFixed(1)}%`, transition: 'width 0.4s ease' }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      };

                      const incomeGroups  = buildGroups(incomeBudgets);
                      const expenseGroups = buildGroups(expenseBudgets);
                      const totalIncome   = incomeBudgets.reduce((s, b) => s + b.amount, 0);
                      const totalExpense  = expenseBudgets.reduce((s, b) => s + b.amount, 0);

                      if (incomeGroups.length === 0 && expenseGroups.length === 0) return null;

                      const hasBoth = incomeGroups.length > 0 && expenseGroups.length > 0;
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: hasBoth ? '1fr 1fr' : '1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                          {incomeGroups.length > 0 && (
                            <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                              <DonutChart groups={incomeGroups} colors={INCOME_COLORS} total={totalIncome} accentColor="var(--color-income)" title="Distribusi Pemasukan" />
                            </div>
                          )}
                          {expenseGroups.length > 0 && (
                            <div style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                              <DonutChart groups={expenseGroups} colors={EXPENSE_COLORS} total={totalExpense} accentColor="var(--color-primary)" title="Distribusi Pengeluaran" />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Income budgets ── */}
                    {incomeBudgets.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-income)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 0.6rem', marginBottom: '0.25rem' }}>
                          Pemasukan · {incomeBudgets.length} kategori
                        </div>
                        <div style={{ background: 'rgba(34,197,94,0.03)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.08)', overflow: 'hidden' }}>
                          {incomeBudgets.map((b, i) => (
                            <div key={b.id} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                              {renderCompactRow(b)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Expense budgets ── */}
                    {expenseBudgets.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 0.6rem', marginBottom: '0.25rem' }}>
                          Pengeluaran · {expenseBudgets.length} kategori
                        </div>
                        <div style={{ background: 'rgba(99,102,241,0.03)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.08)', overflow: 'hidden' }}>
                          {expenseBudgets.map((b, i) => (
                            <div key={b.id} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                              {renderCompactRow(b)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

      {editingTx && (
        <TransactionEditModal
          key={editingTx.id}
          tx={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => {
            setEditingTx(null);
            fetchData();
            // Refresh the budget transaction modal list if it is open
            if (budgetTxModal) {
              const [start, end] = budgetTxModal.dateRange.split(' s/d ');
              const params = new URLSearchParams({ category: budgetTxModal.budget.category, start_date: start, end_date: end });
              fetch(`${API_URL}/transactions?${params}`)
                .then(r => r.json())
                .then(data => setBudgetTxModal(prev => prev ? { ...prev, transactions: data } : null))
                .catch(console.error);
            }
          }}
        />
      )}
    </>
  );
}
