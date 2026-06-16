import React, { useState, useEffect } from 'react';
import { API_URL, INDONESIAN_BANKS } from '../constants';
import Icons from '../components/Icons';
import SplitTransactionModal from '../components/SplitTransactionModal';
import { useApp } from '../context/AppContext';

interface ImportViewProps {
  /** When provided, ImportView runs in modal mode (no nav side-effects). */
  initialAccountId?: string;
  onClose?: () => void;
}

export default function ImportView({ initialAccountId, onClose }: ImportViewProps = {}) {
  const {
    accounts, savedPasswords, importLogs, groupedCategories,
    renderAmount, loading, setLoading, setErrorMsg, fetchData, navigateTo, switchTxSubTab,
    pendingImportAccountId, setPendingImportAccountId,
  } = useApp();

  // PDF IMPORT STATES
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [currentParsingIndex, setCurrentParsingIndex] = useState(0);
  const [parsedTxList, setParsedTxList] = useState<any[]>([]);
  const [pdfPassword, setPdfPassword] = useState('');
  const [savePasswordCheckbox, setSavePasswordCheckbox] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  
  // Password Locker State
  const [lockerBank, setLockerBank] = useState('BCA');
  const [customLockerBank, setCustomLockerBank] = useState('');
  
  // Stage 2 Verification Grid State
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [importTargetAccId, setImportTargetAccId] = useState('');

  // Split Transaction Modal States
  const [splittingTxIndex, setSplittingTxIndex] = useState<number | null>(null);

  // Save result summary
  const [saveResult, setSaveResult] = useState<{ currentBill: number | null; availableCredit: number | null; creditLimit: number | null; accountName: string } | null>(null);

  // Pre-select account via prop (modal mode) or legacy context state
  useEffect(() => {
    if (initialAccountId) {
      setImportTargetAccId(initialAccountId);
    } else if (pendingImportAccountId) {
      setImportTargetAccId(pendingImportAccountId);
      setPendingImportAccountId('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Duplicate Check State Guards
  const [lastCheckedAccId, setLastCheckedAccId] = useState('');
  const [lastCheckedTxCount, setLastCheckedTxCount] = useState(0);

  // Trigger duplicate check when target account changes or a new PDF is parsed
  useEffect(() => {
    const triggerDuplicateCheck = async () => {
      if (!importTargetAccId || !parsedData || !parsedData.transactions || parsedData.transactions.length === 0) return;
      if (importTargetAccId === lastCheckedAccId && parsedData.transactions.length === lastCheckedTxCount) return;

      try {
        const res = await fetch(`${API_URL}/transactions/check-duplicates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: importTargetAccId,
            transactions: parsedData.transactions.map((tx: any) => ({
              date: tx.date,
              amount: tx.amount,
              description: tx.description
            }))
          })
        });

        if (res.ok) {
          const { duplicateIndices } = await res.json();
          const updatedTxs = parsedData.transactions.map((tx: any, idx: number) => {
            const isDup = duplicateIndices.includes(idx);
            return {
              ...tx,
              is_duplicate: isDup,
              exclude: isDup // uncheck by default if duplicate
            };
          });

          setLastCheckedAccId(importTargetAccId);
          setLastCheckedTxCount(parsedData.transactions.length);
          
          setParsedData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              transactions: updatedTxs
            };
          });
        }
      } catch (err) {
        console.error('Failed to check duplicates:', err);
      }
    };

    triggerDuplicateCheck();
  }, [importTargetAccId, parsedData?.transactions?.length, lastCheckedAccId, lastCheckedTxCount]);

  const processBatch = async (files: File[], index: number, accumulatedTx: any[], passwordVal = '', accumulatedInstallments: any[] = [], maxCreditLimit: number | null = null, latestCurrentBill: number | null = null, latestInstallmentCommitment: number | null = null, latestStatementDate: string | null = null, latestAvailableCreditLimit: number | null = null) => {
    if (index >= files.length) {
      setLoading(false);
      setPdfPassword('');
      setPasswordRequired(false);
      const sortedTx = [...accumulatedTx].sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        return da < db ? -1 : da > db ? 1 : 0;
      });
      setParsedData({
        bankName: files.length > 0 ? 'Multiple' : 'Unknown',
        statementType: 'Statement Batch',
        transactionCount: sortedTx.length,
        transactions: sortedTx,
        detectedInstallments: accumulatedInstallments,
        creditLimit: maxCreditLimit,
        availableCreditLimit: latestAvailableCreditLimit,
        currentBill: latestCurrentBill,
        installmentCommitment: latestInstallmentCommitment
      });
      return;
    }

    setLoading(true);
    setCurrentParsingIndex(index);
    setParsedTxList(accumulatedTx);
    const file = files[index];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', passwordVal);

    try {
      const res = await fetch(`${API_URL}/pdf/parse`, {
        method: 'POST',
        body: formData
      });

      if (res.status === 401) {
        setPasswordRequired(true);
        setPdfFile(file);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(`[${file.name}] failed: ${errJson.message || 'Parsing error'}`);
      }

      const result = await res.json();
      const enriched = result.transactions.map((tx: any) => ({
        ...tx,
        booking_date: tx.date,
        note: '',
        is_installment: false,
        installment_months: 12,
        file_name: file.name
      }));

      const nextAccumulated = [...accumulatedTx, ...enriched];
      
      if (!importTargetAccId) {
        const matchingAcc = accounts.find(a => 
          (result.statementType === 'Credit Card' && a.type === 'credit_card') ||
          (result.statementType === 'Bank Account' && a.type === 'bank')
        );
        if (matchingAcc) {
          setImportTargetAccId(matchingAcc.id);
        } else if (accounts.length > 0) {
          setImportTargetAccId(accounts[0].id);
        }
      }

      if (savePasswordCheckbox && passwordVal && result.bankName) {
        await fetch(`${API_URL}/pdf/passwords`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bank_name: result.bankName, password: passwordVal })
        });
      }

      const detectedInsts = result.detectedInstallments || [];
      const nextInstallments = [...accumulatedInstallments, ...detectedInsts];
      const nextCreditLimit = result.creditLimit && (!maxCreditLimit || result.creditLimit > maxCreditLimit)
        ? result.creditLimit
        : maxCreditLimit;
      // Only update currentBill/installmentCommitment if this statement is newer (compare ISO date strings)
      const isNewer = result.statementDate != null &&
        (latestStatementDate == null || result.statementDate > latestStatementDate);
      const nextStatementDate = isNewer ? result.statementDate : latestStatementDate;
      const nextCurrentBill = isNewer ? result.currentBill : latestCurrentBill;
      const nextInstallmentCommitment = isNewer ? result.installmentCommitment : latestInstallmentCommitment;
      const nextAvailableCreditLimit = isNewer ? result.availableCreditLimit : latestAvailableCreditLimit;

      processBatch(files, index + 1, nextAccumulated, '', nextInstallments, nextCreditLimit, nextCurrentBill, nextInstallmentCommitment, nextStatementDate, nextAvailableCreditLimit);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error parsing statement');
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
      if (files.length > 0) {
        setPdfFiles(files);
        setParsedTxList([]);
        processBatch(files, 0, [], '');
      } else {
        setErrorMsg('Please upload PDF files only.');
      }
    }
  };

  // Change specific values in Stage 2 review grid
  const handleGridChange = (index: number, key: string, value: any) => {
    if (!parsedData) return;
    const newTx = [...parsedData.transactions];
    newTx[index][key] = value;
    setParsedData({ ...parsedData, transactions: newTx });
  };

  const handleGridDelete = (index: number) => {
    if (!parsedData) return;
    const newTx = parsedData.transactions.filter((_: any, i: number) => i !== index);
    setParsedData({ ...parsedData, transactions: newTx });
  };

  const handleStartSplit = (index: number) => setSplittingTxIndex(index);

  // Replace the original grid row with the split rows (local only; nothing is
  // persisted until "Save All to Database").
  const handleConfirmImportSplit = (rows: any[]) => {
    if (splittingTxIndex === null || !parsedData) return;
    const tx = parsedData.transactions[splittingTxIndex];
    const isExpense = tx.amount < 0;

    const newTxs = rows.map((row) => {
      const amtNum = parseFloat(row.amount) || 0;
      return {
        ...tx,
        category: row.category,
        location_merchant: row.location_merchant || null,
        product_service: row.product_service || null,
        amount: isExpense ? -amtNum : amtNum,
        note: row.note || null,
        is_installment: false,
        installment_id: null
      };
    });

    const updatedTransactions = [...parsedData.transactions];
    updatedTransactions.splice(splittingTxIndex, 1, ...newTxs);
    setParsedData({ ...parsedData, transactions: updatedTransactions });
    setSplittingTxIndex(null);
  };

  // Save the stage 2 data to DB
  const handleSaveImportedData = async () => {
    if (!importTargetAccId || !parsedData) return;

    setLoading(true);
    const fileNames = pdfFiles.length > 0 ? pdfFiles.map(f => f.name).join(', ') : (pdfFile ? pdfFile.name : 'Statement_Import.pdf');
    try {
      const res = await fetch(`${API_URL}/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: importTargetAccId,
          transactions: parsedData.transactions.filter((tx: any) => !tx.exclude),
          file_name: fileNames,
          detected_installments: parsedData.detectedInstallments || [],
          credit_limit: parsedData.creditLimit,
          available_credit: parsedData.availableCreditLimit ?? null,
          current_bill: parsedData.currentBill ?? null,
          installment_commitment: parsedData.installmentCommitment ?? null,
          billing_cycle_date: parsedData.billingCycleDate,
          due_date: parsedData.dueDate
        })
      });

      if (res.ok) {
        const acc = accounts.find(a => a.id === importTargetAccId);
        const creditLimit = parsedData.creditLimit ?? acc?.credit_limit ?? null;
        const currentBill = parsedData.currentBill ?? null;
        const availableCredit = parsedData.availableCreditLimit != null
          ? parsedData.availableCreditLimit
          : (currentBill != null && creditLimit != null ? Math.max(0, creditLimit - currentBill) : null);
        const hasCcSummary = acc?.type === 'credit_card' && (currentBill != null || availableCredit != null);
        setParsedData(null);
        setPdfFile(null);
        setPdfFiles([]);
        setParsedTxList([]);
        fetchData();
        if (hasCcSummary) {
          setSaveResult({ currentBill, availableCredit, creditLimit, accountName: acc!.name });
        } else if (onClose) {
          onClose();
        } else {
          switchTxSubTab('ledger');
        }
      } else {
        const errJ = await res.json();
        setErrorMsg(errJ.error || 'Failed to save transactions');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving transactions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && pdfFiles.length > 1 && (
        <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          Parsing statement {currentParsingIndex + 1} of {pdfFiles.length}... ({pdfFiles[currentParsingIndex]?.name})
        </div>
      )}
          <div>

            {saveResult && (
              <div className="glass-panel card-content" style={{ maxWidth: '520px', margin: '2rem auto', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
                <h3 style={{ marginBottom: '0.25rem' }}>Transaksi Berhasil Disimpan</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{saveResult.accountName}</p>
                <div className="summary-widget" style={{ marginBottom: '1.5rem' }}>
                  {saveResult.currentBill != null && (
                    <div className="widget-item">
                      <div className="card-desc">Tagihan Berjalan</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-danger)' }}>
                        {renderAmount(saveResult.currentBill)}
                      </div>
                    </div>
                  )}
                  {saveResult.availableCredit != null && (
                    <div className="widget-item">
                      <div className="card-desc">Sisa Limit Kredit</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-success)' }}>
                        {renderAmount(saveResult.availableCredit)}
                      </div>
                    </div>
                  )}
                  {saveResult.creditLimit != null && (
                    <div className="widget-item">
                      <div className="card-desc">Total Limit</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                        {renderAmount(saveResult.creditLimit)}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={() => { setSaveResult(null); if (onClose) { onClose(); } switchTxSubTab('ledger'); navigateTo('transactions'); }}>
                    Lihat Transaksi
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setSaveResult(null); if (onClose) { onClose(); } else { navigateTo('accounts'); } }}>
                    {onClose ? 'Tutup' : 'Kembali ke Akun'}
                  </button>
                </div>
              </div>
            )}

            {!saveResult && (!parsedData ? (
              <>
                {accounts.length === 0 ? (
                  <div className="glass-panel card-content" style={{ textAlign: 'center', padding: '3rem', maxWidth: '600px', margin: '2rem auto' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                    <h3 style={{ marginBottom: '0.75rem' }}>No Target Account Registered</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                      To import transactional history from a bank or credit card PDF statement, you must first register a corresponding financial account or card in the system.
                    </p>
                    <button 
                      type="button"
                      className="btn btn-primary" 
                      onClick={() => navigateTo('accounts')}
                      style={{ padding: '0.6rem 1.5rem', fontWeight: 600, display: 'inline-flex', alignSelf: 'center' }}
                    >
                      🏦 Register Account Now
                    </button>
                  </div>
                ) : (
                  <div className="grid-cols-2">
                    <div className="glass-panel card-content">
                      <h3 style={{ marginBottom: '0.5rem' }}>Upload Statement PDF</h3>
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                        Select or drag your bank statement or credit card statement PDF. Password-protected PDFs are processed entirely in the local container sandbox.
                      </p>

                      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label style={{ fontWeight: 600 }}>Destination Account</label>
                        {onClose ? (
                          /* Modal mode: account locked to the one that was clicked */
                          <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🏦 {accounts.find(a => a.id === importTargetAccId)?.name ?? '—'}
                          </div>
                        ) : (
                          <>
                            <select
                              className="form-control"
                              value={importTargetAccId}
                              onChange={(e) => setImportTargetAccId(e.target.value)}
                              required
                              style={{ borderColor: !importTargetAccId ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)', background: 'rgba(255,255,255,0.01)' }}
                            >
                              <option value="">-- Choose Account --</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.type === 'bank' ? 'Bank' : a.type === 'cash' ? 'Cash/Wallet' : a.type === 'payroll' ? 'Payroll' : 'Credit Card'})</option>
                              ))}
                            </select>
                            {!importTargetAccId && (
                              <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 500 }}>
                                * Destination account selection is required before statement upload is enabled.
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div 
                        className="drag-drop-zone"
                        style={{ 
                          opacity: !importTargetAccId ? 0.4 : 1, 
                          cursor: !importTargetAccId ? 'not-allowed' : 'pointer',
                          pointerEvents: !importTargetAccId ? 'none' : 'auto',
                          borderColor: !importTargetAccId ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.1)'
                        }}
                        onDragOver={(e) => {
                          if (importTargetAccId) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          if (!importTargetAccId) return;
                          handleDrop(e);
                        }}
                        onClick={() => {
                          if (!importTargetAccId) return;
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'application/pdf';
                          input.multiple = true;
                          input.onchange = (e: any) => {
                            if (e.target.files && e.target.files.length > 0) {
                              const files = Array.from(e.target.files as FileList);
                              setPdfFiles(files);
                              setParsedTxList([]);
                              processBatch(files, 0, [], '');
                            }
                          };
                          input.click();
                        }}
                      >
                        <div className="drag-icon">📄</div>
                        {importTargetAccId ? (
                          <>
                            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Drag & Drop PDF Here</strong>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>or click to browse local files</span>
                          </>
                        ) : (
                          <>
                            <strong style={{ display: 'block', color: '#ef4444', marginBottom: '0.5rem' }}>Upload Locked</strong>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Select destination account above first</span>
                          </>
                        )}
                      </div>


                    </div>

                    {/* Password Locker Card */}
                    <div className="glass-panel card-content">
                      <h3 style={{ marginBottom: '1rem' }}>PDF Password Setup</h3>
                      {(() => {
                        // In modal mode: derive bank name from account name
                        const acc = onClose ? accounts.find(a => a.id === importTargetAccId) : null;
                        const modalBankName = acc
                          ? (INDONESIAN_BANKS.find(b => b !== 'Other / Custom' && acc.name.toUpperCase().includes(b.toUpperCase())) ?? acc.name.split(' ')[0])
                          : null;
                        const modalSavedPw = modalBankName
                          ? savedPasswords.find((p: any) => p.bank_name.toUpperCase() === modalBankName.toUpperCase())
                          : null;

                        if (onClose && modalBankName) {
                          // Simplified modal mode: show bank + password field only
                          return (
                            <>
                              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                                Password PDF untuk <strong>{modalBankName}</strong> digunakan untuk membuka file statement yang terenkripsi.
                              </p>
                              {modalSavedPw && (
                                <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>🔒</span> Password sudah tersimpan untuk <strong>{modalBankName}</strong>
                                </div>
                              )}
                              <form onSubmit={async (e) => {
                                e.preventDefault();
                                const passwordInput = (e.target as any).elements.pLockWord.value;
                                if (!passwordInput) return;
                                setLoading(true);
                                try {
                                  await fetch(`${API_URL}/pdf/passwords`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ bank_name: modalBankName, password: passwordInput })
                                  });
                                  (e.target as any).reset();
                                  fetchData();
                                } catch (err) { console.error(err); } finally { setLoading(false); }
                              }}>
                                <div className="form-group">
                                  <label>{modalSavedPw ? 'Ganti Password' : 'Simpan Password'}</label>
                                  <input name="pLockWord" type="password" className="form-control" placeholder="Masukkan password PDF" required />
                                </div>
                                <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
                                  🔒 {modalSavedPw ? 'Perbarui Password' : 'Simpan Password'}
                                </button>
                              </form>
                            </>
                          );
                        }

                        // Full mode (standalone ImportView tab)
                        return (
                          <>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                              Setup and save passwords for statements (e.g. BCA statements are usually encrypted with date of birth or tax numbers). Saved passwords will be used to decrypt statements automatically during future uploads.
                            </p>
                            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Bank Name</th>
                                    <th>Password (Saved)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {savedPasswords.length === 0 ? (
                                    <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No passwords saved yet.</td></tr>
                                  ) : (
                                    savedPasswords.map((p: any) => (
                                      <tr key={p.id}>
                                        <td style={{ fontWeight: 600 }}>{p.bank_name}</td>
                                        <td style={{ color: 'var(--color-text-muted)' }}>•••••••• (Stored)</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <form onSubmit={async (e) => {
                              e.preventDefault();
                              const passwordInput = (e.target as any).elements.pLockWord.value;
                              const finalBank = lockerBank === 'Other / Custom' ? customLockerBank : lockerBank;
                              if (!passwordInput || !finalBank) return;
                              setLoading(true);
                              try {
                                await fetch(`${API_URL}/pdf/passwords`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ bank_name: finalBank, password: passwordInput })
                                });
                                (e.target as any).reset();
                                setLockerBank('BCA');
                                setCustomLockerBank('');
                                fetchData();
                              } catch (err) { console.error(err); } finally { setLoading(false); }
                            }}>
                              <div className="grid-cols-2" style={{ gridTemplateColumns: lockerBank === 'Other / Custom' ? '1fr 1fr 1.2fr' : '1fr 1.2fr', margin: 0, gap: '1rem' }}>
                                <div className="form-group">
                                  <label>Bank Name</label>
                                  <select className="form-control" value={lockerBank} onChange={(e) => setLockerBank(e.target.value)}>
                                    {INDONESIAN_BANKS.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                                  </select>
                                </div>
                                {lockerBank === 'Other / Custom' && (
                                  <div className="form-group">
                                    <label>Custom Bank Name</label>
                                    <input type="text" className="form-control" placeholder="Enter bank name" value={customLockerBank} onChange={(e) => setCustomLockerBank(e.target.value)} required />
                                  </div>
                                )}
                                <div className="form-group">
                                  <label>Document Password</label>
                                  <input name="pLockWord" type="password" className="form-control" placeholder="Enter password" required />
                                </div>
                              </div>
                              <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
                                🔒 Save Password Key
                              </button>
                            </form>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

              {/* Import History Logs */}
              <div className="glass-panel card-content" style={{ marginTop: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Import Statement History Log</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  {onClose
                    ? 'Riwayat import statement untuk akun ini.'
                    : 'A chronological history of all bank statement or credit card files uploaded, parsed, and successfully integrated.'}
                </p>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tanggal Import</th>
                        <th>File</th>
                        {!onClose && <th>Akun</th>}
                        <th style={{ textAlign: 'right' }}>Tx</th>
                        <th style={{ textAlign: 'right' }}>Total Pemasukan</th>
                        <th style={{ textAlign: 'right' }}>Total Pengeluaran</th>
                        <th style={{ textAlign: 'right' }}>Saldo Awal</th>
                        <th style={{ textAlign: 'right' }}>Saldo Akhir / Tagihan</th>
                        <th style={{ textAlign: 'right' }}>Sisa Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const visibleLogs = onClose
                          ? importLogs.filter((l: any) => l.account_id === importTargetAccId)
                          : importLogs;
                        const colSpan = (onClose ? 8 : 9);
                        if (visibleLogs.length === 0) return (
                          <tr>
                            <td colSpan={colSpan} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                              {onClose ? 'Belum ada statement yang diimport untuk akun ini.' : 'No statement files have been imported yet.'}
                            </td>
                          </tr>
                        );
                        const fmt = (v: number | null) => v != null ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v) : '—';
                        return visibleLogs.map((log: any) => {
                          const fileNames = (log.file_name || '').split(',').map((f: string) => f.trim()).filter(Boolean);
                          return (
                            <tr key={log.id}>
                              <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{new Date(log.imported_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {fileNames.map((name: string, idx: number) => (
                                    <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, fontSize: '0.82rem' }}>
                                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>📄</span>{name}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              {!onClose && (
                                <td><span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text)' }}>{log.account_name}</span></td>
                              )}
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>{log.transaction_count}</td>
                              <td style={{ textAlign: 'right', color: 'var(--color-success)', fontSize: '0.85rem' }}>{fmt(log.total_income)}</td>
                              <td style={{ textAlign: 'right', color: 'var(--color-danger)', fontSize: '0.85rem' }}>{fmt(log.total_expense)}</td>
                              <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>{fmt(log.opening_balance)}</td>
                              <td style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>{fmt(log.closing_balance)}</td>
                              <td style={{ textAlign: 'right', fontSize: '0.85rem', color: log.available_credit != null ? 'var(--color-primary)' : undefined }}>{fmt(log.available_credit)}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
            ) : (
              /* Stage 2: Verification and Editing Grid */
              <div className="glass-panel card-content">
                {/* Compact header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '1rem' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--color-success)' }}>✓</span> Verifikasi Transaksi
                    <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>
                      — {parsedData.bankName} · {parsedData.transactionCount} transaksi
                    </span>
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                    {!onClose && (
                      <select
                        className="form-control"
                        value={importTargetAccId}
                        onChange={(e) => setImportTargetAccId(e.target.value)}
                        required
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                      >
                        <option value="">-- Pilih Akun --</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    )}
                    <button className="btn btn-primary" onClick={handleSaveImportedData} disabled={!importTargetAccId} style={{ whiteSpace: 'nowrap', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
                      Simpan ({parsedData.transactions.filter((t: any) => !t.exclude).length}/{parsedData.transactions.length})
                    </button>
                    <button className="btn btn-secondary" onClick={() => setParsedData(null)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                      Batal
                    </button>
                  </div>
                </div>

                {/* Notes row — only billing cycle/due date, not limit (already in summary bar) */}
                {(parsedData.billingCycleDate || parsedData.dueDate) && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginBottom: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {parsedData.billingCycleDate && <span>ℹ Tgl Cetak: Hari {parsedData.billingCycleDate}</span>}
                    {parsedData.dueDate && <span>ℹ Jatuh Tempo: Hari {parsedData.dueDate}</span>}
                  </div>
                )}

                {/* Summary bar — shows totals from ALL transactions in the PDF */}
                {(() => {
                  const allTxs = parsedData.transactions;
                  const selectedTxs = allTxs.filter((t: any) => !t.exclude);
                  const totalIncome  = allTxs.reduce((s: number, t: any) => t.amount > 0 ? s + t.amount : s, 0);
                  const totalExpense = allTxs.reduce((s: number, t: any) => t.amount < 0 ? s + Math.abs(t.amount) : s, 0);
                  const targetAcc = accounts.find((a: any) => a.id === importTargetAccId);
                  const isCC = targetAcc?.type === 'credit_card';
                  const saldoAwal = targetAcc ? (isCC ? (targetAcc.current_bill ?? 0) : (targetAcc.balance ?? 0)) : null;
                  const sisaLimit = parsedData.availableCreditLimit ?? (targetAcc as any)?.available_credit ?? null;
                  const tagihanBaru = parsedData.currentBill ?? null;
                  const fmt = (v: number | null) => v != null ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v) : '—';
                  const items: { label: string; value: string; color?: string; sub?: string }[] = [
                    { label: 'Pemasukan', value: fmt(totalIncome), color: 'var(--color-success)', sub: `${allTxs.filter((t: any) => t.amount > 0).length} tx di PDF · ${selectedTxs.filter((t: any) => t.amount > 0).length} dipilih` },
                    { label: 'Pengeluaran', value: fmt(totalExpense), color: 'var(--color-danger)', sub: `${allTxs.filter((t: any) => t.amount < 0).length} tx di PDF · ${selectedTxs.filter((t: any) => t.amount < 0).length} dipilih` },
                    ...(saldoAwal != null ? [{ label: isCC ? 'Tagihan Saat Ini' : 'Saldo Saat Ini', value: fmt(saldoAwal), sub: 'sebelum import' }] : []),
                    ...(isCC && tagihanBaru != null ? [{ label: 'Tagihan Baru', value: fmt(tagihanBaru), color: 'var(--color-danger)', sub: 'dari PDF' }] : []),
                    ...(sisaLimit != null ? [{ label: 'Sisa Limit', value: fmt(sisaLimit), color: 'var(--color-primary)', sub: 'dari PDF' }] : []),
                    ...(parsedData.creditLimit != null ? [{ label: 'Total Limit', value: fmt(parsedData.creditLimit), sub: 'dari PDF' }] : []),
                  ];
                  return (
                    <div style={{ display: 'flex', gap: '0', marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      {items.map((item, i) => (
                        <div key={i} style={{ flex: 1, padding: '0.6rem 0.75rem', textAlign: 'center', borderRight: i < items.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.2rem' }}>{item.label}</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: item.color ?? 'var(--color-text)' }}>{item.value}</div>
                          {item.sub && <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>{item.sub}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '6%', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={parsedData.transactions.length > 0 && parsedData.transactions.every((t: any) => !t.exclude)} 
                            onChange={(e) => {
                              const checkVal = e.target.checked;
                              const updated = parsedData.transactions.map((t: any) => ({
                                ...t,
                                exclude: !checkVal
                              }));
                              setParsedData({ ...parsedData, transactions: updated });
                            }}
                            title="Toggle All"
                          />
                        </th>
                        <th style={{ width: '10%' }}>Tx Date</th>
                        <th style={{ width: '10%' }}>Booking Date</th>
                        <th>Description</th>
                        <th style={{ width: '16%' }}>Category</th>
                        <th style={{ width: '12%' }}>Location/Merchant</th>
                        <th style={{ width: '12%' }}>Product/Service</th>
                        <th style={{ width: '10%' }}>Amount (IDR)</th>
                        <th style={{ width: '15%' }}>Note (Optional)</th>
                        <th style={{ width: '12%' }}>CC Installment?</th>
                        <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.transactions.map((tx: any, index: number) => (
                        <tr key={index} style={{ opacity: tx.exclude ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                          {/* Import? Checkbox */}
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={!tx.exclude} 
                              onChange={(e) => handleGridChange(index, 'exclude', !e.target.checked)}
                            />
                          </td>
                          {/* Transaction Date Input */}
                          <td>
                            <input 
                              type="text" 
                              className="grid-input" 
                              value={tx.date} 
                              onChange={(e) => {
                                handleGridChange(index, 'date', e.target.value);
                                if (!tx.booking_date || tx.booking_date === tx.date) {
                                  handleGridChange(index, 'booking_date', e.target.value);
                                }
                              }}
                            />
                          </td>
                          {/* Booking Date Input */}
                          <td>
                            <input 
                              type="text" 
                              className="grid-input" 
                              value={tx.booking_date || tx.date} 
                              onChange={(e) => handleGridChange(index, 'booking_date', e.target.value)}
                            />
                          </td>
                          {/* Description Input */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <input 
                                type="text" 
                                className="grid-input" 
                                value={tx.description} 
                                onChange={(e) => handleGridChange(index, 'description', e.target.value)}
                              />
                              {tx.is_duplicate && (
                                <span className="badge" style={{ alignSelf: 'flex-start', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)', fontSize: '0.7rem', padding: '0.1rem 0.4rem', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '4px' }}>
                                  ⚠️ Potential Duplicate
                                </span>
                              )}
                              {tx.file_name && (
                                <span className="badge" style={{ alignSelf: 'flex-start', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--color-text-muted)', fontSize: '0.65rem', padding: '0.05rem 0.25rem', borderRadius: '4px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '180px' }} title={tx.file_name}>
                                  📄 {tx.file_name}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Category Selector */}
                          <td>
                            <select 
                              className="form-control"
                              value={tx.category}
                              onChange={(e) => handleGridChange(index, 'category', e.target.value)}
                              style={{ padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}
                            >
                              {groupedCategories.map(group => {
                                const rowType = tx.amount >= 0 ? 'income' : 'expense';
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
                          {/* Location/Merchant Input */}
                          <td>
                            <input 
                              type="text" 
                              className="grid-input" 
                              placeholder="e.g. Starbucks"
                              value={tx.location_merchant || ''} 
                              onChange={(e) => handleGridChange(index, 'location_merchant', e.target.value)}
                            />
                          </td>
                          {/* Product/Service Input */}
                          <td>
                            <input 
                              type="text" 
                              className="grid-input" 
                              placeholder="e.g. Coffee"
                              value={tx.product_service || ''} 
                              onChange={(e) => handleGridChange(index, 'product_service', e.target.value)}
                            />
                          </td>
                          {/* Amount Input */}
                          <td>
                            <input 
                              type="number" 
                              className="grid-input" 
                              value={tx.amount} 
                              onChange={(e) => handleGridChange(index, 'amount', parseFloat(e.target.value) || 0)}
                              style={{ fontWeight: 600, color: tx.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
                            />
                          </td>
                          {/* Note Input */}
                          <td>
                            <input 
                              type="text" 
                              className="grid-input" 
                              placeholder="Keterangan..."
                              value={tx.note || ''} 
                              onChange={(e) => handleGridChange(index, 'note', e.target.value)}
                            />
                          </td>
                          {/* CC Installment Tags */}
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              {tx.amount < 0 ? ( // Only expenses can be installments
                                <>
                                  <input 
                                    type="checkbox" 
                                    checked={tx.is_installment}
                                    onChange={(e) => handleGridChange(index, 'is_installment', e.target.checked)}
                                  />
                                  {tx.is_installment && (
                                    <input 
                                      type="number" 
                                      className="grid-input" 
                                      value={tx.installment_months}
                                      onChange={(e) => handleGridChange(index, 'installment_months', parseInt(e.target.value) || 12)}
                                      style={{ width: '50px', background: 'var(--bg-input)', textAlign: 'center', padding: '0.1rem' }}
                                      min="2"
                                      max="60"
                                      title="Installment Months"
                                    />
                                  )}
                                </>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Income/Cc Pymt</span>
                              )}
                            </div>
                          </td>
                          {/* Actions (Split/Delete) */}
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button 
                              type="button"
                              className="btn" 
                              style={{ padding: '0.25rem', color: 'var(--color-primary)', background: 'transparent', marginRight: '0.5rem' }}
                              onClick={() => handleStartSplit(index)}
                              title="Split Transaction Category/Amount"
                            >
                              ✂️
                            </button>
                            <button 
                              className="btn" 
                              style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent' }}
                              onClick={() => handleGridDelete(index)}
                              title="Delete Row"
                            >
                              <Icons.Delete />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Password Modal (Triggered when PDF throws encryption error) */}
            {passwordRequired && pdfFile && (
              <div className="modal-overlay">
                <div className="glass-panel modal-content">
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem', color: 'var(--color-warning)' }}>
                    <Icons.Lock />
                  </div>
                  
                  <h3 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Password Protected PDF</h3>
                  <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    The statement file **{pdfFile.name}** requires a password to decrypt.
                  </p>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    processBatch(pdfFiles, currentParsingIndex, parsedTxList, pdfPassword);
                  }}>
                    <div className="form-group">
                      <label>Enter Statement Password</label>
                      <input 
                        type="password" 
                        className="form-control" 
                        placeholder="PDF decryption password"
                        value={pdfPassword}
                        onChange={(e) => setPdfPassword(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                      <input 
                        type="checkbox" 
                        id="save-pass-box" 
                        checked={savePasswordCheckbox}
                        onChange={(e) => setSavePasswordCheckbox(e.target.checked)}
                      />
                      <label htmlFor="save-pass-box" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                        Remember password for future uploads
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                        Decrypt & Import
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ flex: 1 }}
                        onClick={() => {
                          setPdfFile(null);
                          setPasswordRequired(false);
                          setPdfPassword('');
                          setPdfFiles([]);
                          setParsedTxList([]);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>

      {splittingTxIndex !== null && parsedData && parsedData.transactions[splittingTxIndex] && (
        <SplitTransactionModal
          targetTx={parsedData.transactions[splittingTxIndex]}
          onConfirm={handleConfirmImportSplit}
          onCancel={() => setSplittingTxIndex(null)}
        />
      )}
    </>
  );
}
