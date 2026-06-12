import React, { useState, useEffect } from 'react';
import { API_URL } from '../constants';
import Icons from '../components/Icons';
import { useApp } from '../context/AppContext';
import CategoryTransactionsModal from '../components/CategoryTransactionsModal';

export default function SettingsPage() {
  const {
    dbCategories, groupedCategories, fetchData, navigateTo, setLoading,
    aiProvider, setAiProvider, aiApiKey, setAiApiKey, aiModelName, setAiModelName, aiBaseUrl, setAiBaseUrl,
  } = useApp();

  const [txCounts, setTxCounts] = useState<Record<string, number>>({});
  const [viewTxCategory, setViewTxCategory] = useState<string | null>(null);

  const fetchTxCounts = () => {
    fetch(`${API_URL}/categories/transaction-counts`)
      .then(r => r.json())
      .then(data => setTxCounts(data))
      .catch(() => {});
  };

  useEffect(() => { fetchTxCounts(); }, []);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCatParentId, setNewCatParentId] = useState('');

  // Category management handlers
  const [newCatType, setNewCatType] = useState<'expense' | 'income' | 'both'>('expense');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryType, setEditingCategoryType] = useState<'expense' | 'income' | 'both'>('expense');
  const [editingCategoryParentId, setEditingCategoryParentId] = useState('');
  const [editingCategoryImportance, setEditingCategoryImportance] = useState<string>('');
  const [editingCategoryUrgency, setEditingCategoryUrgency] = useState<string>('');

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      const res = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newCategoryName.trim(),
          parent_id: newCatParentId || null,
          type: newCatType
        })
      });
      if (res.ok) {
        setNewCategoryName('');
        setNewCatParentId('');
        setNewCatType('expense');
        fetchData();
      } else {
        const errJ = await res.json();
        alert(errJ.error || 'Failed to add category');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const cycleImportance = (cat: any) => {
    const next = cat.importance === null || cat.importance === '' ? 'penting'
      : cat.importance === 'penting' ? 'tidak_penting'
      : null;
    handleQuickUpdateCategoryMatrix(cat, next, cat.urgency || null);
  };

  const cycleUrgency = (cat: any) => {
    const next = cat.urgency === null || cat.urgency === '' ? 'mendesak'
      : cat.urgency === 'mendesak' ? 'tidak_mendesak'
      : null;
    handleQuickUpdateCategoryMatrix(cat, cat.importance || null, next);
  };

  const ImportancePill = ({ cat }: { cat: any }) => {
    const v = cat.importance;
    const styles: React.CSSProperties = {
      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
      fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px',
      cursor: 'pointer', userSelect: 'none', transition: 'opacity 0.15s',
      border: '1px solid',
      ...(v === 'penting'
        ? { background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.4)', color: '#a5b4fc' }
        : v === 'tidak_penting'
        ? { background: 'rgba(107,114,128,0.1)', borderColor: 'rgba(107,114,128,0.3)', color: 'var(--color-text-muted)' }
        : { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' })
    };
    return (
      <span style={styles} onClick={() => cycleImportance(cat)} title="Klik untuk ubah kepentingan">
        {v === 'penting' ? '⭐ Penting' : v === 'tidak_penting' ? '◌ Tdk Penting' : '· Kepentingan'}
      </span>
    );
  };

  const UrgencyPill = ({ cat }: { cat: any }) => {
    const v = cat.urgency;
    const styles: React.CSSProperties = {
      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
      fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px',
      cursor: 'pointer', userSelect: 'none', transition: 'opacity 0.15s',
      border: '1px solid',
      ...(v === 'mendesak'
        ? { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }
        : v === 'tidak_mendesak'
        ? { background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }
        : { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' })
    };
    return (
      <span style={styles} onClick={() => cycleUrgency(cat)} title="Klik untuk ubah urgensi">
        {v === 'mendesak' ? '🔴 Mendesak' : v === 'tidak_mendesak' ? '🟢 Tdk Mendesak' : '· Urgensi'}
      </span>
    );
  };

  const handleQuickUpdateCategoryMatrix = async (cat: any, importance: string | null, urgency: string | null) => {
    try {
      await fetch(`${API_URL}/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cat.name,
          type: cat.type,
          parent_id: cat.parent_id || null,
          importance: importance,
          urgency: urgency,
        })
      });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleEditCategory = async (id: string) => {
    if (!editingCategoryName.trim()) return;

    try {
      const res = await fetch(`${API_URL}/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingCategoryName.trim(),
          type: editingCategoryType,
          parent_id: editingCategoryParentId || null,
          importance: editingCategoryImportance || null,
          urgency: editingCategoryUrgency || null,
        })
      });
      if (res.ok) {
        setEditingCategoryId(null);
        setEditingCategoryName('');
        setEditingCategoryParentId('');
        fetchData();
      } else {
        const errJ = await res.json();
        alert(errJ.error || 'Failed to edit category');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Past transactions of this category will not be altered, but new transactions cannot select it.')) return;
    try {
      const res = await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // AI Configuration & System Administrative Handlers
  const [backupFile, setBackupFile] = useState<File | null>(null);

  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/ai/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiProvider,
          api_key: aiApiKey,
          model_name: aiModelName,
          base_url: aiBaseUrl
        })
      });
      if (res.ok) {
        alert('AI Configuration saved successfully!');
        fetchData();
      } else {
        alert('Failed to save AI configuration.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupFile) return;
    if (!confirm('WARNING: Restoring a backup will overwrite your current active database! All current data will be replaced. Are you sure you want to proceed?')) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', backupFile);

    try {
      const res = await fetch(`${API_URL}/system/restore`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        alert('Database restored successfully! Reloading data...');
        setBackupFile(null);
        fetchData();
      } else {
        const errJ = await res.json();
        alert(errJ.error || 'Failed to restore database.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error restoring database: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetApplication = async () => {
    if (!confirm('DANGER WARNING: This will permanently delete ALL transactions, bank accounts, credit cards, budgets, and saved statement passwords! This will restore the application to a completely blank slate. Are you sure you want to do this?')) return;
    if (!confirm('FINAL CONFIRMATION: Are you absolutely 100% sure? There is no undo!')) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/system/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        alert('Application data reset successfully!');
        fetchData();
        navigateTo('dashboard');
      } else {
        const errJ = await res.json();
        alert(errJ.error || 'Failed to reset application.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error resetting application: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
          <div>
            {viewTxCategory && (
              <CategoryTransactionsModal
                categoryName={viewTxCategory}
                onClose={() => setViewTxCategory(null)}
                onCategoryChanged={() => { fetchTxCounts(); fetchData(); }}
              />
            )}
            <div style={{ marginBottom: '2rem' }}>
              <h2>Application Settings</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Configure transaction categories, AI integration keys, database backups, and maintenance options.
              </p>
            </div>

            <div className="grid-cols-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', alignItems: 'start' }}>
              
              {/* Left Column: Manage Categories */}
              <div className="glass-panel card-content">
                <h3 style={{ marginBottom: '0.5rem' }}>Manage Categories</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Add custom categories or nest subcategories under existing parents. Renaming categories will automatically update all past transactions and budgets.
                </p>

                <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <select
                      className="form-control"
                      value={newCatParentId}
                      onChange={(e) => setNewCatParentId(e.target.value)}
                      style={{ flex: 1.2, margin: 0 }}
                    >
                      <option value="">None (Create Parent Category)</option>
                      {dbCategories.filter(c => !c.parent_id).map(p => (
                        <option key={p.id} value={p.id}>Under: {p.name}</option>
                      ))}
                    </select>
                    <select
                      className="form-control"
                      value={newCatType}
                      onChange={(e) => setNewCatType(e.target.value as any)}
                      style={{ flex: 0.8, margin: 0 }}
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                      <option value="both">Both</option>
                    </select>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Category Name" 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      required
                      style={{ flex: 1.5, margin: 0 }}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    <Icons.Plus /> Save Category / Subcategory
                  </button>
                </form>

                <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Category Hierarchy</th>
                        <th style={{ width: '15%', textAlign: 'center' }}>Kepentingan</th>
                        <th style={{ width: '15%', textAlign: 'center' }}>Urgensi</th>
                        <th style={{ width: '9%', textAlign: 'center' }}>Transaksi</th>
                        <th style={{ width: '18%', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedCategories.map(group => (
                        <React.Fragment key={group.parent.id}>
                          {/* Parent row edit or view */}
                          {editingCategoryId === group.parent.id ? (
                            <tr>
                              <td colSpan={5}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.25rem 0', flexWrap: 'wrap' }}>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={editingCategoryName}
                                    onChange={(e) => setEditingCategoryName(e.target.value)}
                                    style={{ flex: 2, margin: 0, padding: '0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '150px' }}
                                    required
                                  />
                                  <select className="form-control" value={editingCategoryType} onChange={(e) => setEditingCategoryType(e.target.value as any)} style={{ flex: 1, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '100px' }}>
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                    <option value="both">Both</option>
                                  </select>
                                  <select className="form-control" value={editingCategoryImportance} onChange={(e) => setEditingCategoryImportance(e.target.value)} style={{ flex: 1, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '120px' }}>
                                    <option value="">— Kepentingan —</option>
                                    <option value="penting">Penting</option>
                                    <option value="tidak_penting">Tidak Penting</option>
                                  </select>
                                  <select className="form-control" value={editingCategoryUrgency} onChange={(e) => setEditingCategoryUrgency(e.target.value)} style={{ flex: 1, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '120px' }}>
                                    <option value="">— Urgensi —</option>
                                    <option value="mendesak">Mendesak</option>
                                    <option value="tidak_mendesak">Tidak Mendesak</option>
                                  </select>
                                  <select className="form-control" value={editingCategoryParentId} onChange={(e) => setEditingCategoryParentId(e.target.value)} style={{ flex: 1.5, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '150px' }}>
                                    <option value="">None (Parent Category)</option>
                                    {dbCategories.filter(c => !c.parent_id && c.id !== group.parent.id).map(p => (
                                      <option key={p.id} value={p.id}>Move under: {p.name}</option>
                                    ))}
                                  </select>
                                  <button type="button" className="btn btn-primary" onClick={() => handleEditCategory(group.parent.id)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', margin: 0 }}>Save</button>
                                  <button type="button" className="btn btn-secondary" onClick={() => setEditingCategoryId(null)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', margin: 0 }}>Cancel</button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr>
                              <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span>📁 {group.parent.name}</span>
                                  <span className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', background: group.parent.type === 'income' ? 'rgba(16,185,129,0.1)' : group.parent.type === 'both' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: group.parent.type === 'income' ? 'var(--color-success)' : group.parent.type === 'both' ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                    {(group.parent.type || 'expense').toUpperCase()}
                                  </span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}><ImportancePill cat={group.parent} /></td>
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}><UrgencyPill cat={group.parent} /></td>
                              <td style={{ textAlign: 'center' }}>
                                {(txCounts[group.parent.name] ?? 0) > 0 ? (
                                  <button type="button" onClick={() => setViewTxCategory(group.parent.name)}
                                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: 'var(--color-primary)', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                    title="Lihat daftar transaksi">
                                    {txCounts[group.parent.name]}
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                                  <button type="button" className="btn"
                                    style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem', color: 'var(--color-primary)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px' }}
                                    onClick={() => { setEditingCategoryId(group.parent.id); setEditingCategoryName(group.parent.name); setEditingCategoryType(group.parent.type || 'expense'); setEditingCategoryParentId(group.parent.parent_id || ''); setEditingCategoryImportance(group.parent.importance || ''); setEditingCategoryUrgency(group.parent.urgency || ''); }}
                                    title="Edit kategori">✏️ Edit
                                  </button>
                                  <button type="button" className="btn"
                                    style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem', color: 'var(--color-danger)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px' }}
                                    onClick={() => handleDeleteCategory(group.parent.id)}
                                    title="Hapus kategori">🗑️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* Subcategory rows edit or view */}
                          {group.subs.map(sub => (
                            <React.Fragment key={sub.id}>
                              {editingCategoryId === sub.id ? (
                                <tr>
                                  <td colSpan={5}>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.25rem 0 0.25rem 2rem', flexWrap: 'wrap' }}>
                                      <input type="text" className="form-control" value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} style={{ flex: 2, margin: 0, padding: '0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '150px' }} required />
                                      <select className="form-control" value={editingCategoryType} onChange={(e) => setEditingCategoryType(e.target.value as any)} style={{ flex: 1, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '100px' }}>
                                        <option value="expense">Expense</option>
                                        <option value="income">Income</option>
                                        <option value="both">Both</option>
                                      </select>
                                      <select className="form-control" value={editingCategoryImportance} onChange={(e) => setEditingCategoryImportance(e.target.value)} style={{ flex: 1, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '120px' }}>
                                        <option value="">— Kepentingan —</option>
                                        <option value="penting">Penting</option>
                                        <option value="tidak_penting">Tidak Penting</option>
                                      </select>
                                      <select className="form-control" value={editingCategoryUrgency} onChange={(e) => setEditingCategoryUrgency(e.target.value)} style={{ flex: 1, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '120px' }}>
                                        <option value="">— Urgensi —</option>
                                        <option value="mendesak">Mendesak</option>
                                        <option value="tidak_mendesak">Tidak Mendesak</option>
                                      </select>
                                      <select className="form-control" value={editingCategoryParentId} onChange={(e) => setEditingCategoryParentId(e.target.value)} style={{ flex: 1.5, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '150px' }}>
                                        <option value="">None (Parent Category)</option>
                                        {dbCategories.filter(c => !c.parent_id && c.id !== sub.id).map(p => (
                                          <option key={p.id} value={p.id}>Move under: {p.name}</option>
                                        ))}
                                      </select>
                                      <button type="button" className="btn btn-primary" onClick={() => handleEditCategory(sub.id)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', margin: 0 }}>Save</button>
                                      <button type="button" className="btn btn-secondary" onClick={() => setEditingCategoryId(null)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', margin: 0 }}>Cancel</button>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                <tr>
                                  <td style={{ paddingLeft: '2rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <span>↳ {sub.name}</span>
                                      <span className="badge" style={{ fontSize: '0.6rem', padding: '0.05rem 0.25rem', background: sub.type === 'income' ? 'rgba(16,185,129,0.1)' : sub.type === 'both' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: sub.type === 'income' ? 'var(--color-success)' : sub.type === 'both' ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                        {(sub.type || 'expense').toUpperCase()}
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center' }}><ImportancePill cat={sub} /></td>
                                  <td style={{ textAlign: 'center' }}><UrgencyPill cat={sub} /></td>
                                  <td style={{ textAlign: 'center' }}>
                                    {(txCounts[sub.name] ?? 0) > 0 ? (
                                      <button type="button" onClick={() => setViewTxCategory(sub.name)}
                                        style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: 'var(--color-primary)', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                        title="Lihat daftar transaksi">
                                        {txCounts[sub.name]}
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                                      <button type="button" className="btn"
                                        style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem', color: 'var(--color-primary)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px' }}
                                        onClick={() => { setEditingCategoryId(sub.id); setEditingCategoryName(sub.name); setEditingCategoryType(sub.type || 'expense'); setEditingCategoryParentId(sub.parent_id || ''); setEditingCategoryImportance(sub.importance || ''); setEditingCategoryUrgency(sub.urgency || ''); }}
                                        title="Edit subkategori">✏️ Edit
                                      </button>
                                      <button type="button" className="btn"
                                        style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem', color: 'var(--color-danger)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px' }}
                                        onClick={() => handleDeleteCategory(sub.id)}
                                        title="Hapus subkategori">🗑️
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: AI Provider Config & Admin settings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* AI Config Panel */}
                <div className="glass-panel card-content">
                  <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🤖</span> AI Config Provider
                  </h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Configure your preferred AI Provider to generate deep insights and real-time financial planning recommendations.
                  </p>

                  <form onSubmit={handleSaveAiConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                      <label>AI Provider</label>
                      <select
                        className="form-control"
                        value={aiProvider}
                        onChange={(e) => setAiProvider(e.target.value as any)}
                        required
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI (ChatGPT)</option>
                        <option value="openrouter">OpenRouter API</option>
                        <option value="lm_studio">LM Studio (Local)</option>
                        <option value="ollama">Ollama (Local)</option>
                        <option value="custom">Custom API Endpoint</option>
                      </select>
                    </div>

                    {aiProvider !== 'lm_studio' && aiProvider !== 'ollama' && (
                      <div className="form-group">
                        <label>API Key / Secret Token</label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder="Enter API key"
                          value={aiApiKey}
                          onChange={(e) => setAiApiKey(e.target.value)}
                          required={aiProvider !== 'custom'}
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label>AI Model Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={
                          aiProvider === 'gemini' ? 'e.g. gemini-1.5-flash' :
                          aiProvider === 'openai' ? 'e.g. gpt-4o-mini' :
                          'e.g. llama3, mistral'
                        }
                        value={aiModelName}
                        onChange={(e) => setAiModelName(e.target.value)}
                        required={aiProvider === 'gemini' || aiProvider === 'openai' || aiProvider === 'openrouter'}
                      />
                    </div>

                    {(aiProvider === 'lm_studio' || aiProvider === 'ollama' || aiProvider === 'custom') && (
                      <div className="form-group">
                        <label>API Base URL</label>
                        <input
                          type="url"
                          className="form-control"
                          placeholder={
                            aiProvider === 'lm_studio' ? 'e.g. http://localhost:1234' :
                            aiProvider === 'ollama' ? 'e.g. http://localhost:11434' :
                            'e.g. https://api.yourprovider.com'
                          }
                          value={aiBaseUrl}
                          onChange={(e) => setAiBaseUrl(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                      Save AI Configuration
                    </button>
                  </form>
                </div>

                {/* Administrative Backup & Restore Panel */}
                <div className="glass-panel card-content">
                  <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>⚙️</span> Database & System Settings
                  </h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Backup or restore your transactions database, or reset the app to its original factory state.
                  </p>

                  {/* Backup */}
                  <div style={{ paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.25rem' }}>
                    <h4 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Data Backup</h4>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                      Download a secure copy of your SQLite database file (`.sqlite`) which can be restored anytime.
                    </p>
                    <a
                      href={`${API_URL}/system/backup`}
                      download
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', width: '100%', justifyContent: 'center' }}
                    >
                      💾 Download Backup File
                    </a>
                  </div>

                  {/* Restore */}
                  <div style={{ paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.25rem' }}>
                    <h4 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Data Restore</h4>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                      Upload a previously backed-up SQLite file. Warning: This overrides all your current data!
                    </p>
                    <form onSubmit={handleRestoreBackup} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <input
                        type="file"
                        accept=".sqlite"
                        className="form-control"
                        style={{ padding: '0.4rem' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setBackupFile(e.target.files[0]);
                          }
                        }}
                        required
                      />
                      <button type="submit" className="btn btn-secondary" style={{ width: '100%' }} disabled={!backupFile}>
                        🔄 Restore Database File
                      </button>
                    </form>
                  </div>

                  {/* Reset Application */}
                  <div>
                    <h4 className="text-danger" style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Danger Zone</h4>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                      Permanently delete all accounts, transactions, budget records, installments, and settings.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        width: '100%',
                        background: 'rgba(239, 68, 68, 0.08)',
                        borderColor: 'var(--color-danger)',
                        color: 'var(--color-danger)'
                      }}
                      onClick={handleResetApplication}
                    >
                      ⚠️ Reset Application Data
                    </button>
                  </div>

                </div>

              </div>

            </div>
          </div>
  );
}
