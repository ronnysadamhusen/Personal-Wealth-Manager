import React, { useState, useEffect } from 'react';
import { API_URL, INDONESIAN_BANKS } from '../constants';
import Icons from '../components/Icons';
import SplitTransactionModal from '../components/SplitTransactionModal';
import { useApp } from '../context/AppContext';

export default function ImportView() {
  const {
    accounts, savedPasswords, importLogs, groupedCategories,
    renderAmount, loading, setLoading, setErrorMsg, fetchData, switchTxSubTab,
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
        setParsedData(null);
        setPdfFile(null);
        setPdfFiles([]);
        setParsedTxList([]);
        switchTxSubTab('ledger');
        fetchData();
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

            {!parsedData ? (
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
                        <label style={{ fontWeight: 600 }}>Choose Destination Account for Import</label>
                        <select 
                          className="form-control"
                          value={importTargetAccId}
                          onChange={(e) => setImportTargetAccId(e.target.value)}
                          required
                          style={{ borderColor: !importTargetAccId ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)', background: 'rgba(255,255,255,0.01)' }}
                        >
                          <option value="">-- Choose Account --</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.type === 'bank' ? 'Bank' : a.type === 'cash' ? 'Cash/Wallet' : 'Credit Card'})</option>
                          ))}
                        </select>
                        {!importTargetAccId && (
                          <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 500 }}>
                            * Destination account selection is required before statement upload is enabled.
                          </div>
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
                              <tr>
                                <td colSpan={2} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No passwords saved yet.</td>
                              </tr>
                            ) : (
                              savedPasswords.map(p => (
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
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setLoading(false);
                        }
                      }}>
                        <div className="grid-cols-2" style={{ gridTemplateColumns: lockerBank === 'Other / Custom' ? '1fr 1fr 1.2fr' : '1fr 1.2fr', margin: 0, gap: '1rem' }}>
                          <div className="form-group">
                            <label>Bank Name</label>
                            <select 
                              className="form-control"
                              value={lockerBank}
                              onChange={(e) => setLockerBank(e.target.value)}
                            >
                              {INDONESIAN_BANKS.map(bank => (
                                <option key={bank} value={bank}>{bank}</option>
                              ))}
                            </select>
                          </div>
                          {lockerBank === 'Other / Custom' && (
                            <div className="form-group">
                              <label>Custom Bank Name</label>
                              <input 
                                type="text" 
                                className="form-control" 
                                placeholder="Enter bank name" 
                                value={customLockerBank}
                                onChange={(e) => setCustomLockerBank(e.target.value)}
                                required 
                              />
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
                    </div>
                  </div>
                )}

              {/* Import History Logs */}
              <div className="glass-panel card-content" style={{ marginTop: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Import Statement History Log</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  A chronological history of all bank statement or credit card files uploaded, parsed, and successfully integrated.
                </p>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Import Date & Time</th>
                        <th>File Name</th>
                        <th>Target Account</th>
                        <th style={{ textAlign: 'right' }}>Transactions Imported</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                            No statement files have been imported yet.
                          </td>
                        </tr>
                      ) : (
                        importLogs.map((log: any) => {
                          const fileNames = (log.file_name || '').split(',').map((f: string) => f.trim()).filter(Boolean);
                          return (
                            <tr key={log.id}>
                              <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.imported_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                  {fileNames.map((name: string, idx: number) => (
                                    <span key={idx} style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.4rem',
                                      fontWeight: 600,
                                      fontSize: '0.85rem'
                                    }}>
                                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', minWidth: '1rem' }}>📄</span>
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text)' }}>
                                  {log.account_name}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>
                                {log.transaction_count}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
            ) : (
              /* Stage 2: Verification and Editing Grid */
              <div className="glass-panel card-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--color-success)' }}>✓</span> Verify Parsed Transactions
                    </h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      We detected a **{parsedData.bankName} {parsedData.statementType}** statement with **{parsedData.transactionCount} transactions**. Please review, edit, or tag installments below before saving.
                    </p>
                    {parsedData.creditLimit && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-success)', fontWeight: 'bold' }}>
                        ℹ Batas kredit terdeteksi di PDF: {renderAmount(parsedData.creditLimit)} (akan di-update otomatis setelah disimpan)
                      </div>
                    )}
                    {(parsedData.billingCycleDate || parsedData.dueDate) && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--color-success)' }}>
                        ℹ Siklus tagihan/Jatuh tempo terdeteksi: 
                        {parsedData.billingCycleDate && ` Tanggal Cetak: Hari ${parsedData.billingCycleDate}`}
                        {parsedData.dueDate && ` | Jatuh Tempo: Hari ${parsedData.dueDate}`} (akan di-update otomatis)
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ marginBottom: '0.25rem' }}>Save to Account</label>
                      <select 
                        className="form-control"
                        value={importTargetAccId}
                        onChange={(e) => setImportTargetAccId(e.target.value)}
                        required
                        style={{ padding: '0.5rem 2rem 0.5rem 1rem' }}
                      >
                        <option value="">-- Choose Account --</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.type === 'bank' ? 'Bank' : a.type === 'cash' ? 'Cash' : 'CC'})</option>
                        ))}
                      </select>
                    </div>

                    <button className="btn btn-primary" onClick={handleSaveImportedData} disabled={!importTargetAccId}>
                      Save All to Database ({parsedData.transactions.length})
                    </button>
                    
                    <button className="btn btn-secondary" onClick={() => setParsedData(null)}>
                      Cancel
                    </button>
                  </div>
                </div>

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
            )}



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
