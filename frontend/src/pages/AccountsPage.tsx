import React, { useState, useEffect } from 'react';
import { API_URL } from '../constants';
import Icons from '../components/Icons';
import { useApp } from '../context/AppContext';
import PayrollSlipModal from '../components/PayrollSlipModal';
import ImportView from './ImportView';

export default function AccountsPage() {
  const { accounts, renderAmount, fetchData, setLoading } = useApp();
  const [importModalAccId, setImportModalAccId] = useState<string | null>(null);

  // Reconciliation States
  const [reconcilingAcc, setReconcilingAcc] = useState<any | null>(null);
  const [reconcileTargetBalance, setReconcileTargetBalance] = useState('');
  const [reconcileDate, setReconcileDate] = useState(new Date().toISOString().split('T')[0]);
  const [reconcileNote, setReconcileNote] = useState('Penyesuaian Saldo (Reconciliation)');

  // Payroll slip modal
  const [payrollModalAcc, setPayrollModalAcc] = useState<any | null>(null);
  const [payrollSlips, setPayrollSlips] = useState<any[]>([]);

  const fetchPayrollSlips = async () => {
    try {
      const res = await fetch(`${API_URL}/payroll/slips`);
      if (res.ok) setPayrollSlips(await res.json());
    } catch (_) {}
  };

  useEffect(() => { fetchPayrollSlips(); }, []);

  // Account creation form
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'bank' | 'credit_card' | 'cash' | 'payroll'>('bank');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccCcLimit, setNewAccCcLimit] = useState('');
  const [newAccCycleDate, setNewAccCycleDate] = useState('');
  const [newAccDueDate, setNewAccDueDate] = useState('');

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName) return;

    try {
      const payload = {
        name: newAccName,
        type: newAccType,
        balance: (newAccType === 'bank' || newAccType === 'cash') ? parseFloat(newAccBalance) || 0 : 0,
        credit_limit: newAccType === 'credit_card' ? parseFloat(newAccCcLimit) || null : null,
        billing_cycle_date: newAccType === 'credit_card' ? parseInt(newAccCycleDate) || null : null,
        due_date: newAccType === 'credit_card' ? parseInt(newAccDueDate) || null : null
      };
      // payroll type: balance always 0, no credit limit

      const res = await fetch(`${API_URL}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewAccName('');
        setNewAccBalance('');
        setNewAccCcLimit('');
        setNewAccCycleDate('');
        setNewAccDueDate('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account? All associated transactions will be deleted!')) return;
    try {
      const res = await fetch(`${API_URL}/accounts/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartReconcile = (acc: any) => {
    setReconcilingAcc(acc);
    setReconcileTargetBalance(String(acc.current_balance));
    setReconcileDate(new Date().toISOString().split('T')[0]);
    setReconcileNote('Penyesuaian Saldo (Reconciliation)');
  };

  const handleSaveReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcilingAcc || !reconcileTargetBalance) return;

    setLoading(true);
    try {
      const targetVal = parseFloat(reconcileTargetBalance);
      const diff = targetVal - reconcilingAcc.current_balance;

      if (diff === 0) {
        setReconcilingAcc(null);
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: reconcilingAcc.id,
          date: reconcileDate,
          booking_date: reconcileDate,
          description: reconcileNote || 'Penyesuaian Saldo (Reconciliation)',
          amount: diff,
          category: 'Others',
          note: 'Reconciliation Adjustment'
        })
      });

      if (res.ok) {
        setReconcilingAcc(null);
        fetchData();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Failed to save reconciliation');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error during reconciliation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
          <div className="grid-cols-2">
            {/* Left Column: List Accounts */}
            <div className="glass-panel card-content">
              <h3 style={{ marginBottom: '1.5rem' }}>Registered Accounts</h3>
              
              {accounts.length === 0 ? (
                <div style={{ padding: '3rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  No accounts found. Use the form to register bank accounts and credit cards.
                </div>
              ) : (
                accounts.map(a => (
                  <div key={a.id} className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{a.name}</h4>
                        <span className="badge" style={{ background: a.type === 'bank' ? 'rgba(16, 185, 129, 0.1)' : a.type === 'cash' ? 'rgba(245, 158, 11, 0.1)' : a.type === 'payroll' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)', color: a.type === 'bank' ? 'var(--color-success)' : a.type === 'cash' ? 'var(--color-warning)' : a.type === 'payroll' ? '#a78bfa' : 'var(--color-primary)', marginTop: '0.4rem' }}>
                          {a.type === 'bank' ? 'BANK ACCOUNT' : a.type === 'cash' ? 'CASH / WALLET' : a.type === 'payroll' ? 'PAYROLL' : 'CREDIT CARD'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {a.type === 'payroll' && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem' }}
                            onClick={() => setPayrollModalAcc(a)}
                          >
                            📋 Input Slip Gaji
                          </button>
                        )}
                        {(a.type === 'credit_card' || a.type === 'bank') && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => setImportModalAccId(a.id)}
                          >
                            <Icons.Import /> Import PDF
                          </button>
                        )}
                        {a.type !== 'payroll' && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => handleStartReconcile(a)}
                          title="Adjust Balance / Reconcile Account"
                        >
                          ⚖️ Reconcile
                        </button>
                        )}
                        <button 
                          type="button"
                          className="btn btn-secondary" 
                          style={{ padding: '0.4rem', borderRadius: '8px', color: 'var(--color-danger)' }}
                          onClick={() => handleDeleteAccount(a.id)}
                          title="Delete Account"
                        >
                          <Icons.Delete />
                        </button>
                      </div>
                    </div>

                    <div className="summary-widget">
                      <div className="widget-item">
                        <div className="card-desc">Current Balance</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: (a.type === 'bank' || a.type === 'cash' || a.type === 'payroll') ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {renderAmount(a.type === 'credit_card' && a.current_bill != null ? -a.current_bill : a.current_balance)}
                        </div>
                      </div>

                      {(a.type === 'bank' || a.type === 'cash') ? (
                        <div className="widget-item">
                          <div className="card-desc">Initial Balance</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                            {renderAmount(a.balance)}
                          </div>
                        </div>
                      ) : a.type === 'payroll' ? (
                        <div className="widget-item">
                          <div className="card-desc">Slip Terakhir</div>
                          <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                            {(() => {
                              const lastSlip = payrollSlips.filter(s => s.account_id === a.id).sort((x, y) => y.period.localeCompare(x.period))[0];
                              return lastSlip ? <span style={{ color: 'var(--color-text-muted)' }}>{lastSlip.period} · {renderAmount(lastSlip.net_income)}</span> : <span style={{ color: 'var(--color-text-muted)' }}>Belum ada slip</span>;
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className="widget-item">
                          <div className="card-desc">Available Credit Limit</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                            {renderAmount(
                            a.available_credit != null
                              ? a.available_credit
                              : a.current_bill != null
                                ? Math.max(0, (a.credit_limit || 0) - a.current_bill - (a.current_installment_debt ?? a.installment_debt ?? 0))
                                : Math.floor(((a.credit_limit || 0) + a.current_balance - (a.installment_debt || 0)) / 100) * 100
                          )}
                          </div>
                        </div>
                      )}
                    </div>

                    {a.type === 'credit_card' && (
                      <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Billing Date:</span> <strong>Day {a.billing_cycle_date}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Payment Due:</span> <strong>Day {a.due_date}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Installment Debt:</span> <strong className="text-warning">{renderAmount(a.current_installment_debt ?? a.installment_debt)}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Right Column: Register Account Form */}
            <div className="glass-panel card-content">
              <h3 style={{ marginBottom: '1.5rem' }}>Register New Bank/Credit Card</h3>
              <form onSubmit={handleAddAccount}>
                <div className="form-group">
                  <label>Account Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. BCA Tahapan, Mandiri Visa Card" 
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Account Type</label>
                  <select 
                    className="form-control" 
                    value={newAccType} 
                    onChange={(e) => setNewAccType(e.target.value as any)}
                  >
                    <option value="bank">🏦 Bank Account / Savings</option>
                    <option value="cash">💵 Cash / Dompet</option>
                    <option value="credit_card">💳 Credit Card</option>
                    <option value="payroll">📋 Payroll / Slip Gaji</option>
                  </select>
                </div>

                {newAccType === 'payroll' && (
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(139,92,246,0.08)', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.2)', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                    Akun payroll adalah virtual account untuk mencatat penerimaan gaji. Saldo awal selalu 0. Gaji bersih akan otomatis di-transfer ke rekening bank pilihanmu saat input slip gaji.
                  </div>
                )}

                {(newAccType === 'bank' || newAccType === 'cash') ? (
                  <div className="form-group">
                    <label>Initial Balance (IDR)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g. 5000000"
                      value={newAccBalance}
                      onChange={(e) => setNewAccBalance(e.target.value)}
                    />
                  </div>
                ) : newAccType === 'credit_card' ? (
                  <div>
                    <div className="form-group">
                      <label>Credit Limit (IDR)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="e.g. 20000000" 
                        value={newAccCcLimit}
                        onChange={(e) => setNewAccCcLimit(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1fr', margin: 0, gap: '1rem' }}>
                      <div className="form-group">
                        <label>Billing Cycle Date (Day of Month)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          placeholder="e.g. 15" 
                          min="1" max="31"
                          value={newAccCycleDate}
                          onChange={(e) => setNewAccCycleDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Due Date (Day of Month)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          placeholder="e.g. 5" 
                          min="1" max="31"
                          value={newAccDueDate}
                          onChange={(e) => setNewAccDueDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                  <Icons.Plus /> Register Account
                </button>
              </form>
            </div>
          </div>

        {/* Payroll Slip Modal */}
        {payrollModalAcc && (
          <PayrollSlipModal
            account={payrollModalAcc}
            onClose={() => setPayrollModalAcc(null)}
            onSaved={() => { fetchData(); fetchPayrollSlips(); }}
          />
        )}

        {/* Reconcile Account Modal Overlay */}
        {reconcilingAcc && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '450px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⚖️</span> Reconcile Account Balance
                </h3>
                <button 
                  type="button" 
                  onClick={() => setReconcilingAcc(null)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Account Name:</span>
                  <strong>{reconcilingAcc.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Current App Balance:</span>
                  <strong style={{ color: reconcilingAcc.type === 'bank' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {renderAmount(reconcilingAcc.current_balance)}
                  </strong>
                </div>
              </div>

              <form onSubmit={handleSaveReconcile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <div className="form-group">
                  <label>Target Actual Balance (IDR)</label>
                  <input 
                    type="number" 
                    className="form-control"
                    placeholder="Enter the actual real balance"
                    value={reconcileTargetBalance}
                    onChange={(e) => setReconcileTargetBalance(e.target.value)}
                    required
                    autoFocus
                  />
                  <small style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    We will automatically calculate the discrepancy and insert a Penyesuaian Saldo transaction in the ledger.
                  </small>
                </div>

                <div className="form-group">
                  <label>Reconciliation Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={reconcileDate} 
                    onChange={(e) => setReconcileDate(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Adjustment Description</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Penyesuaian Saldo (Reconciliation)"
                    value={reconcileNote}
                    onChange={(e) => setReconcileNote(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Adjust Balance
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => setReconcilingAcc(null)}
                  >
                    Cancel
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* Import PDF Modal */}
        {importModalAccId && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '1rem' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '1500px', padding: '1.25rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icons.Import /> Import PDF Statement
                </h3>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.85rem' }}
                  onClick={() => setImportModalAccId(null)}
                >
                  ✕ Tutup
                </button>
              </div>
              <ImportView
                initialAccountId={importModalAccId}
                onClose={() => setImportModalAccId(null)}
              />
            </div>
          </div>
        )}
    </>
  );
}
