import React, { useState, useMemo, useEffect } from 'react';
import { API_URL, CATEGORIES } from '../constants';
import Icons from '../components/Icons';
import AutocompleteInput from '../components/AutocompleteInput';
import TransactionEditModal from '../components/TransactionEditModal';
import SplitTransactionModal from '../components/SplitTransactionModal';
import ConvertToTransferModal from '../components/ConvertToTransferModal';
import ImportView from './ImportView';
import OcrView from './OcrView';
import { useApp } from '../context/AppContext';

export default function TransactionsPage() {
  const {
    accounts, transactions, dbCategories, groupedCategories,
    transactionSubTab, setTransactionSubTab,
    renderAmount, getTransactionPath,
    locationSuggestions, productSuggestions, descSuggestions,
    setLoading, setErrorMsg, fetchData,
  } = useApp();

  // Transaction Ledger Filters
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [filterAccountId, setFilterAccountId] = useState('All');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');

  // Transaction Ledger Filtering and Aggregation Engine
  const filteredAndAggregatedTx = useMemo(() => {
    const today = new Date();
    
    // Start of week (Monday)
    const day = today.getDay();
    const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Start of month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Start of year
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const list = transactions.filter(tx => {
      // 1. Account Filter
      if (filterAccountId !== 'All' && tx.account_id !== filterAccountId) {
        return false;
      }
      
      // 2. Category Filter
      if (filterCategory !== 'All' && tx.category !== filterCategory) {
        return false;
      }
      
      // 3. Search Query
      if (filterSearchQuery.trim()) {
        const query = filterSearchQuery.toLowerCase();
        const descMatch = tx.description ? tx.description.toLowerCase().includes(query) : false;
        const catMatch = tx.category ? tx.category.toLowerCase().includes(query) : false;
        const accMatch = tx.account_name ? tx.account_name.toLowerCase().includes(query) : false;
        if (!descMatch && !catMatch && !accMatch) {
          return false;
        }
      }
      
      // 4. Period Filter
      if (filterPeriod !== 'all') {
        const txDate = new Date(tx.date);
        txDate.setHours(0, 0, 0, 0);
        
        if (filterPeriod === 'week') {
          if (txDate < startOfWeek) return false;
        } else if (filterPeriod === 'month') {
          if (txDate < startOfMonth) return false;
        } else if (filterPeriod === 'year') {
          if (txDate < startOfYear) return false;
        } else if (filterPeriod === 'custom') {
          if (filterStartDate) {
            const start = new Date(filterStartDate);
            start.setHours(0, 0, 0, 0);
            if (txDate < start) return false;
          }
          if (filterEndDate) {
            const end = new Date(filterEndDate);
            end.setHours(23, 59, 59, 999);
            if (txDate > end) return false;
          }
        }
      }
      
      // 5. Type Filter
      if (filterType === 'income')   return tx.is_transfer !== 1 && tx.amount > 0;
      if (filterType === 'expense')  return tx.is_transfer !== 1 && tx.amount < 0;
      if (filterType === 'transfer') return tx.is_transfer === 1;

      return true;
    });

    let income = 0;
    let expense = 0;
    
    list.forEach(tx => {
      if (tx.is_transfer === 1) return;
      if (tx.amount > 0) {
        income += tx.amount;
      } else {
        expense += tx.amount;
      }
    });

    return {
      list,
      totalIncome: income,
      totalExpense: Math.abs(expense),
      netFlow: income + expense
    };
  }, [transactions, filterAccountId, filterPeriod, filterStartDate, filterEndDate, filterSearchQuery, filterCategory, filterType]);

  // Bulk Edit States
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [bulkEditCategory, setBulkEditCategory] = useState('');
  const [bulkEditLocation, setBulkEditLocation] = useState('');
  const [bulkEditProduct, setBulkEditProduct] = useState('');

  // Transaction form manually
  const [txAccId, setTxAccId] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txBookingDate, setTxBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState(CATEGORIES[0]);
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txNote, setTxNote] = useState('');
  const [txLocationMerchant, setTxLocationMerchant] = useState('');
  const [txProductService, setTxProductService] = useState('');

  // Filter categories dynamically based on transaction type (income / expense)
  const filteredCategoriesForTx = useMemo(() => {
    const result: typeof groupedCategories = [];
    groupedCategories.forEach(group => {
      const parentMatch = group.parent.type === 'both' || group.parent.type === txType;
      const matchedSubs = group.subs.filter(sub => sub.type === 'both' || sub.type === txType);
      
      if (parentMatch || matchedSubs.length > 0) {
        result.push({
          parent: group.parent,
          subs: matchedSubs
        });
      }
    });
    return result;
  }, [groupedCategories, txType]);

  // Transfer detection
  const [transferSuspectIds, setTransferSuspectIds] = useState<Set<string>>(new Set());
  const [convertingTx, setConvertingTx] = useState<any | null>(null);

  const fetchTransferSuspects = () => {
    fetch(`${API_URL}/transactions/transfer-suspects`)
      .then(r => r.json())
      .then(data => setTransferSuspectIds(new Set(Array.isArray(data) ? data.map((t: any) => t.id) : [])))
      .catch(() => {});
  };

  useEffect(() => { fetchTransferSuspects(); }, []);

  // Edit / split dialogs (shared modal components)
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [splittingLedgerTx, setSplittingLedgerTx] = useState<any | null>(null);

  const handleStartLedgerSplit = (tx: any) => setSplittingLedgerTx(tx);

  const handleConfirmLedgerSplit = async (rows: any[]) => {
    if (!splittingLedgerTx) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/transactions/${splittingLedgerTx.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splits: rows })
      });

      if (res.ok) {
        setSplittingLedgerTx(null);
        fetchData();
      } else {
        const errJ = await res.json();
        alert(errJ.error || 'Failed to split transaction');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error splitting transaction: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAccId || !txDesc || !txAmount) return;

    try {
      const value = parseFloat(txAmount);
      const amountValue = txType === 'income' ? value : -value;

      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: txAccId,
          date: txDate,
          booking_date: txBookingDate || txDate,
          description: txDesc,
          amount: amountValue,
          category: txCategory,
          note: txNote || null,
          location_merchant: txLocationMerchant || null,
          product_service: txProductService || null
        })
      });
      if (res.ok) {
        setTxDesc('');
        setTxAmount('');
        setTxNote('');
        setTxLocationMerchant('');
        setTxProductService('');
        setIsAddTxModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveBulkEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTxIds.length === 0) return;
    if (!bulkEditCategory && !bulkEditLocation && !bulkEditProduct) {
      alert('Please choose at least one field to bulk edit');
      return;
    }

    setLoading(true);
    try {
      const payload: any = { ids: selectedTxIds };
      if (bulkEditCategory) payload.category = bulkEditCategory;
      if (bulkEditLocation) payload.location_merchant = bulkEditLocation;
      if (bulkEditProduct) payload.product_service = bulkEditProduct;

      const res = await fetch(`${API_URL}/transactions/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSelectedTxIds([]);
        setBulkEditCategory('');
        setBulkEditLocation('');
        setBulkEditProduct('');
        fetchData();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Failed to bulk update transactions');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error during bulk update: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction permanently?')) return;
    try {
      const res = await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTxIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedTxIds.length} selected transaction(s)? This action cannot be undone.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/transactions/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedTxIds })
      });
      if (res.ok) {
        setSelectedTxIds([]);
        fetchData();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to delete transactions');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error deleting transactions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '4px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <button
                  onClick={() => setTransactionSubTab('ledger')}
                  style={{
                    padding: '0.4rem 1rem', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
                    background: transactionSubTab === 'ledger' ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: transactionSubTab === 'ledger' ? 'var(--color-text)' : 'var(--color-text-muted)',
                    boxShadow: transactionSubTab === 'ledger' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  <Icons.Ledger /> Ledger
                </button>
                <button
                  onClick={() => setTransactionSubTab('import')}
                  style={{
                    padding: '0.4rem 1rem', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
                    background: transactionSubTab === 'import' ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: transactionSubTab === 'import' ? 'var(--color-text)' : 'var(--color-text-muted)',
                    boxShadow: transactionSubTab === 'import' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  <Icons.Import /> Import PDF
                </button>
                <button
                  onClick={() => setTransactionSubTab('ocr')}
                  style={{
                    padding: '0.4rem 1rem', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
                    background: transactionSubTab === 'ocr' ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: transactionSubTab === 'ocr' ? 'var(--color-text)' : 'var(--color-text-muted)',
                    boxShadow: transactionSubTab === 'ocr' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  <Icons.Scan /> Scan Receipt
                </button>
              </div>
              {transactionSubTab === 'ledger' && (
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setTxAccId(accounts[0]?.id || '');
                    setTxDate(new Date().toISOString().split('T')[0]);
                    setTxBookingDate(new Date().toISOString().split('T')[0]);
                    setTxType('expense');
                    setTxCategory(dbCategories[0]?.name || 'Food & Dining');
                    setTxLocationMerchant('');
                    setTxProductService('');
                    setTxDesc('');
                    setTxAmount('');
                    setTxNote('');
                    setIsAddTxModalOpen(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span>➕</span> Add Transaction
                </button>
              )}
            </div>

            {transactionSubTab === 'ledger' && (<div>

            {/* Filter Panel */}
            <div className="glass-panel card-content" style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1.25rem' }}>Search & Filters</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Account / Card</label>
                  <select 
                    className="form-control"
                    value={filterAccountId}
                    onChange={(e) => setFilterAccountId(e.target.value)}
                    style={{ margin: 0 }}
                  >
                    <option value="All">All Accounts</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type === 'bank' ? 'Bank' : a.type === 'cash' ? 'Cash' : 'CC'})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Category</label>
                  <select 
                    className="form-control"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{ margin: 0 }}
                  >
                    <option value="All">All Categories</option>
                    {groupedCategories.map(group => (
                      <React.Fragment key={group.parent.id}>
                        <option value={group.parent.name}>{group.parent.name}</option>
                        {group.subs.map(sub => (
                          <option key={sub.id} value={sub.name}>&nbsp;&nbsp;↳ {sub.name}</option>
                        ))}
                      </React.Fragment>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Tipe</label>
                  <select
                    className="form-control"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    style={{ margin: 0 }}
                  >
                    <option value="all">Semua Tipe</option>
                    <option value="income">📈 Income</option>
                    <option value="expense">📉 Expense</option>
                    <option value="transfer">🔁 Transfer</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Period</label>
                  <select 
                    className="form-control"
                    value={filterPeriod}
                    onChange={(e) => setFilterPeriod(e.target.value as any)}
                    style={{ margin: 0 }}
                  >
                    <option value="all">All Time</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Search Description</label>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="Search desc, cat, account..."
                    value={filterSearchQuery}
                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                    style={{ margin: 0 }}
                  />
                </div>
              </div>

              {filterPeriod === 'custom' && (
                <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem' }}>
                  <div className="form-group" style={{ margin: 0, flex: 1 }}>
                    <label>Start Date</label>
                    <input 
                      type="date"
                      className="form-control"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      style={{ margin: 0 }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: 1 }}>
                    <label>End Date</label>
                    <input 
                      type="date"
                      className="form-control"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      style={{ margin: 0 }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Aggregates Summary */}
            <div className="grid-cols-3" style={{ marginBottom: '2rem' }}>
              <div className="glass-panel card-content">
                <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Total Inflow (Income)</span>
                  <span style={{ fontSize: '1.2rem' }}>📈</span>
                </div>
                <div className="card-value text-success">
                  {renderAmount(filteredAndAggregatedTx.totalIncome)}
                </div>
                <div className="card-desc">Total positive cash flow in selected period</div>
              </div>

              <div className="glass-panel card-content">
                <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Total Outflow (Expenses)</span>
                  <span style={{ fontSize: '1.2rem' }}>📉</span>
                </div>
                <div className="card-value text-danger">
                  {renderAmount(filteredAndAggregatedTx.totalExpense)}
                </div>
                <div className="card-desc">Total negative cash flow in selected period</div>
              </div>

              <div className="glass-panel card-content">
                <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Net Cash Flow</span>
                  <span style={{ fontSize: '1.2rem' }}>📊</span>
                </div>
                <div className={`card-value ${filteredAndAggregatedTx.netFlow >= 0 ? 'text-success' : 'text-danger'}`}>
                  {renderAmount(filteredAndAggregatedTx.netFlow)}
                </div>
                <div className="card-desc">Remaining net surplus or deficit</div>
              </div>
            </div>

            {/* Ledger List */}
            <div className="glass-panel card-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>Transaction Ledger</h3>
                <span className="badge" style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  Showing {filteredAndAggregatedTx.list.length} transactions
                </span>
              </div>

              {/* Bulk Edit Action Bar */}
              {selectedTxIds.length > 0 && (
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: '1rem 1.25rem', 
                    marginBottom: '1.25rem', 
                    background: 'rgba(99, 102, 241, 0.08)', 
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    flexWrap: 'wrap', 
                    gap: '1rem',
                    borderRadius: '12px',
                    boxShadow: '0 0 15px rgba(99, 102, 241, 0.08)',
                    animation: 'slideDown 0.25s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>⚡</span>
                    <div>
                      <strong style={{ color: 'var(--color-primary)', fontSize: '0.95rem' }}>Bulk Editing Mode</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                        Selected <strong>{selectedTxIds.length}</strong> transactions. Choose fields to apply:
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSaveBulkEdit} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                    {/* Category Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <select 
                        className="form-control"
                        value={bulkEditCategory}
                        onChange={(e) => setBulkEditCategory(e.target.value)}
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '200px', margin: 0 }}
                      >
                        <option value="">-- Change Category (No Change) --</option>
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

                    {/* Location Input */}
                    <AutocompleteInput 
                      className="form-control" 
                      placeholder="New Location/Merchant"
                      value={bulkEditLocation}
                      onChangeValue={setBulkEditLocation}
                      suggestions={locationSuggestions}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '180px', margin: 0 }}
                    />

                    {/* Product Input */}
                    <AutocompleteInput 
                      className="form-control" 
                      placeholder="New Product/Service"
                      value={bulkEditProduct}
                      onChangeValue={setBulkEditProduct}
                      suggestions={productSuggestions}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '180px', margin: 0 }}
                    />

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', margin: 0 }}>
                        Apply
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => setSelectedTxIds([])}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', margin: 0 }}
                      >
                        Cancel
                      </button>
                      <button 
                        type="button"
                        className="btn"
                        onClick={handleBulkDelete}
                        style={{ 
                          padding: '0.4rem 1rem', 
                          fontSize: '0.85rem', 
                          margin: 0,
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: 'var(--color-danger)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '8px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                        title={`Delete ${selectedTxIds.length} selected transactions`}
                      >
                        🗑️ Delete Selected ({selectedTxIds.length})
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {filteredAndAggregatedTx.list.length === 0 ? (
                  <div style={{ padding: '4rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    No transactions match your current filtering criteria.
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '4%', textAlign: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={filteredAndAggregatedTx.list.length > 0 && filteredAndAggregatedTx.list.every((t: any) => selectedTxIds.includes(t.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTxIds(filteredAndAggregatedTx.list.map((t: any) => t.id));
                              } else {
                                setSelectedTxIds([]);
                              }
                            }}
                            title="Toggle All"
                          />
                        </th>
                        <th style={{ width: '12%' }}>Date</th>
                        <th style={{ width: '15%' }}>Account</th>
                        <th>Description</th>
                        <th style={{ width: '18%' }}>Category</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
                        <th style={{ width: '8%', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndAggregatedTx.list.map((tx) => (
                        <tr key={tx.id} style={{ background: selectedTxIds.includes(tx.id) ? 'rgba(99, 102, 241, 0.04)' : 'transparent' }}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox"
                              checked={selectedTxIds.includes(tx.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTxIds(prev => [...prev, tx.id]);
                                } else {
                                  setSelectedTxIds(prev => prev.filter(id => id !== tx.id));
                                }
                              }}
                            />
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{tx.date}</td>
                          <td style={{ fontWeight: 500 }}>{tx.account_name}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{tx.description}</div>
                            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                              {tx.is_installment === 1 && (
                                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)', fontSize: '0.6rem', padding: '0.05rem 0.3rem' }}>
                                  INSTALLMENT
                                </span>
                              )}
                              {tx.is_transfer === 1 && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                  background: 'rgba(16,185,129,0.1)', color: '#6ee7b7',
                                  border: '1px solid rgba(16,185,129,0.25)', borderRadius: '4px',
                                  fontSize: '0.6rem', fontWeight: 700, padding: '0.05rem 0.35rem',
                                  letterSpacing: '0.02em', whiteSpace: 'nowrap',
                                }}>
                                  🔁 {tx.transfer_direction === 'out'
                                    ? `Transfer to ${tx.transfer_counterpart_account || '—'}`
                                    : `Transfer from ${tx.transfer_counterpart_account || '—'}`}
                                </span>
                              )}
                              {transferSuspectIds.has(tx.id) && (
                                <button
                                  onClick={() => setConvertingTx(tx)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                    background: 'rgba(245,158,11,0.12)', color: '#fbbf24',
                                    border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px',
                                    fontSize: '0.6rem', fontWeight: 700, padding: '0.05rem 0.35rem',
                                    cursor: 'pointer', lineHeight: 1.4, letterSpacing: '0.02em',
                                  }}
                                  title="Terdeteksi sebagai transfer — klik untuk mengkonversi"
                                >
                                  ⚡ Transfer?
                                </button>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)' }}>
                              {getTransactionPath(tx)}
                            </span>
                          </td>
                          <td className={tx.amount >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: '600', textAlign: 'right' }}>
                            {renderAmount(tx.amount)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              className="btn" 
                              style={{ padding: '0.25rem', color: 'var(--color-primary)', background: 'transparent', marginRight: '0.5rem' }}
                              onClick={() => setEditingTx(tx)}
                              title="Edit Transaction"
                            >
                              ✏️
                            </button>
                            <button 
                              className="btn" 
                              style={{ padding: '0.25rem', color: 'var(--color-primary)', background: 'transparent', marginRight: '0.5rem' }}
                              onClick={() => handleStartLedgerSplit(tx)}
                              title="Split Transaction"
                            >
                              ✂️
                            </button>
                            <button 
                              className="btn" 
                              style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent' }}
                              onClick={() => handleDeleteTransaction(tx.id)}
                              title="Delete Transaction"
                            >
                              <Icons.Delete />
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

      {transactionSubTab === 'import' && <ImportView />}
      {transactionSubTab === 'ocr' && <OcrView />}

        {/* Add Transaction Modal Overlay */}
        {isAddTxModalOpen && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '550px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>➕</span> Add New Transaction
                </h3>
                <button 
                  type="button" 
                  onClick={() => setIsAddTxModalOpen(false)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <div className="form-group">
                  <label>Account / Credit Card</label>
                  <select 
                    className="form-control"
                    value={txAccId}
                    onChange={(e) => setTxAccId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Account --</option>
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
                      value={txDate} 
                      onChange={(e) => {
                        setTxDate(e.target.value);
                        setTxBookingDate(e.target.value);
                      }}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Booking Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={txBookingDate} 
                      onChange={(e) => setTxBookingDate(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '0.8fr 1.2fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Type</label>
                    <select 
                      className="form-control" 
                      value={txType} 
                      onChange={(e) => setTxType(e.target.value as any)}
                    >
                      <option value="expense">Expense (-)</option>
                      <option value="income">Income (+)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select 
                      className="form-control" 
                      value={txCategory} 
                      onChange={(e) => setTxCategory(e.target.value)}
                    >
                      {filteredCategoriesForTx.map(group => (
                        <optgroup key={group.parent.id} label={group.parent.name}>
                          <option value={group.parent.name}>{group.parent.name}</option>
                          {group.subs.map(sub => (
                            <option key={sub.id} value={sub.name}>↳ {sub.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Location/Merchant</label>
                    <AutocompleteInput 
                      className="form-control" 
                      placeholder="e.g. Starbucks" 
                      value={txLocationMerchant}
                      onChangeValue={setTxLocationMerchant}
                      suggestions={locationSuggestions}
                    />
                  </div>
                  <div className="form-group">
                    <label>Product/Service</label>
                    <AutocompleteInput 
                      className="form-control" 
                      placeholder="e.g. Coffee" 
                      value={txProductService}
                      onChangeValue={setTxProductService}
                      suggestions={productSuggestions}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <AutocompleteInput 
                    className="form-control" 
                    placeholder="e.g. Starbucks coffee" 
                    value={txDesc}
                    onChangeValue={setTxDesc}
                    suggestions={descSuggestions}
                    required
                  />
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Amount (IDR)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-control" 
                      placeholder="e.g. 50000" 
                      value={txAmount} 
                      onChange={(e) => setTxAmount(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Note (Optional)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Treat for friend" 
                      value={txNote} 
                      onChange={(e) => setTxNote(e.target.value)} 
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setIsAddTxModalOpen(false)}
                    style={{ margin: 0 }}
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ margin: 0 }}
                  >
                    Simpan Transaksi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {editingTx && (
        <TransactionEditModal
          key={editingTx.id}
          tx={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => { setEditingTx(null); fetchData(); }}
        />
      )}

      {splittingLedgerTx && (
        <SplitTransactionModal
          targetTx={splittingLedgerTx}
          onConfirm={handleConfirmLedgerSplit}
          onCancel={() => setSplittingLedgerTx(null)}
        />
      )}

      {convertingTx && (
        <ConvertToTransferModal
          tx={convertingTx}
          onClose={() => setConvertingTx(null)}
          onConverted={() => {
            setConvertingTx(null);
            fetchTransferSuspects();
            fetchData();
          }}
        />
      )}
    </div>
  );
}
