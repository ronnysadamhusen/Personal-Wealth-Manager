import React, { useState, useMemo } from 'react';
import { API_URL } from '../constants';
import Icons from '../components/Icons';
import { useApp } from '../context/AppContext';

export default function GoalsPage() {
  const { goals, renderAmount, fetchGoals, setLoading } = useApp();

  // Goal form & savings-adjust modal state
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTargetAmount, setNewGoalTargetAmount] = useState('');
  const [newGoalCurrentSavings, setNewGoalCurrentSavings] = useState('');
  const [newGoalTargetDate, setNewGoalTargetDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 6, 1).toISOString().split('T')[0]);
  const [newGoalRecurrence, setNewGoalRecurrence] = useState<'one-time' | 'monthly' | 'semester' | 'yearly'>('one-time');
  const [newGoalCategory, setNewGoalCategory] = useState('education');
  const [savingsAdjustGoal, setSavingsAdjustGoal] = useState<any | null>(null);
  const [savingsAdjustAmount, setSavingsAdjustAmount] = useState('');

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGoalName,
          target_amount: parseFloat(newGoalTargetAmount),
          current_savings: parseFloat(newGoalCurrentSavings || '0'),
          target_date: newGoalTargetDate,
          recurrence: newGoalRecurrence,
          category: newGoalCategory
        })
      });
      if (res.ok) {
        setNewGoalName('');
        setNewGoalTargetAmount('');
        setNewGoalCurrentSavings('');
        setNewGoalTargetDate(new Date(new Date().getFullYear(), new Date().getMonth() + 6, 1).toISOString().split('T')[0]);
        setNewGoalRecurrence('one-time');
        setNewGoalCategory('education');
        await fetchGoals();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create goal');
      }
    } catch (error: any) {
      alert('Error creating goal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savingsAdjustGoal) return;
    try {
      setLoading(true);
      const updatedSavings = savingsAdjustGoal.current_savings + parseFloat(savingsAdjustAmount);
      const isAchieved = updatedSavings >= savingsAdjustGoal.target_amount;
      const res = await fetch(`${API_URL}/goals/${savingsAdjustGoal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_savings: updatedSavings,
          status: isAchieved ? 'achieved' : savingsAdjustGoal.status
        })
      });
      if (res.ok) {
        setSavingsAdjustGoal(null);
        setSavingsAdjustAmount('');
        await fetchGoals();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to adjust savings');
      }
    } catch (error: any) {
      alert('Error adjusting savings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus rencana dana ini?')) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/goals/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchGoals();
      } else {
        alert('Gagal menghapus rencana dana');
      }
    } catch (error: any) {
      alert('Error deleting goal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Future Goals timeline projection
  const timelineProjection = useMemo(() => {
    const today = new Date();
    const months: { year: number; month: number; label: string; needed: number; goals: string[] }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
        needed: 0,
        goals: [] as any[]
      });
    }

    goals.filter(g => g.status === 'active').forEach(g => {
      const targetDate = new Date(g.target_date);
      const idx = months.findIndex(m => m.year === targetDate.getFullYear() && m.month === targetDate.getMonth());
      if (idx !== -1) {
        months[idx].needed += (g.target_amount - g.current_savings);
        months[idx].goals.push(g.name);
      }
    });

    return months;
  }, [goals]);

  const calculateRemainingMonths = (targetDateStr: string) => {
    const today = new Date();
    const target = new Date(targetDateStr);
    const yearsDiff = target.getFullYear() - today.getFullYear();
    const monthsDiff = target.getMonth() - today.getMonth();
    const totalMonths = yearsDiff * 12 + monthsDiff;
    return Math.max(1, totalMonths);
  };

  return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>🎯 Future Goals & Savings Targets</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  Rencanakan pengumpulan dana untuk kebutuhan masa depan (Uang kuliah, sekolah anak, liburan, dsb).
                </p>
              </div>
            </div>

            {/* Metrik Ringkasan Utama */}
            {(() => {
              const activeGoals = goals.filter(g => g.status === 'active');
              const totalTarget = activeGoals.reduce((sum, g) => sum + g.target_amount, 0);
              const totalSaved = activeGoals.reduce((sum, g) => sum + g.current_savings, 0);
              const totalShortfall = Math.max(0, totalTarget - totalSaved);
              
              const totalMonthlySavingsRequired = activeGoals.reduce((sum, g) => {
                const remaining = calculateRemainingMonths(g.target_date);
                const needed = Math.max(0, g.target_amount - g.current_savings);
                return sum + (needed / remaining);
              }, 0);

              return (
                <div className="grid-cols-4" style={{ gap: '1.5rem' }}>
                  <div className="glass-panel card-content" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div className="card-desc">Total Rencana Dana</div>
                    <div className="card-value" style={{ color: 'var(--color-text)', marginTop: '0.5rem' }}>
                      {renderAmount(totalTarget)}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Kebutuhan dana untuk {activeGoals.length} rencana aktif.
                    </p>
                  </div>

                  <div className="glass-panel card-content" style={{ borderLeft: '4px solid var(--color-success)' }}>
                    <div className="card-desc">Total Dana Terkumpul</div>
                    <div className="card-value" style={{ color: 'var(--color-success)', marginTop: '0.5rem' }}>
                      {renderAmount(totalSaved)}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Sudah terkumpul ({totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(1) : 0}%).
                    </p>
                  </div>

                  <div className="glass-panel card-content" style={{ borderLeft: '4px solid var(--color-warning)' }}>
                    <div className="card-desc">Total Kekurangan Dana</div>
                    <div className="card-value" style={{ color: 'var(--color-warning)', marginTop: '0.5rem' }}>
                      {renderAmount(totalShortfall)}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Kekurangan yang masih harus dikumpulkan.
                    </p>
                  </div>

                  <div className="glass-panel card-content" style={{ borderLeft: '4px solid #8b5cf6', background: 'rgba(139, 92, 246, 0.03)' }}>
                    <div className="card-desc" style={{ color: '#a78bfa' }}>Target Tabungan Bulanan</div>
                    <div className="card-value" style={{ color: '#c084fc', marginTop: '0.5rem' }}>
                      {renderAmount(totalMonthlySavingsRequired)} / bln
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Estimasi tabungan bulanan yang harus disisihkan.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Garis Waktu Proyeksi Dana */}
            <div className="glass-panel card-content">
              <h3 style={{ marginBottom: '0.5rem' }}>Proyeksi Kebutuhan Dana (12 Bulan ke Depan)</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Perkiraan pengeluaran dana bersih yang jatuh tempo di setiap bulan mendatang berdasarkan rencana dana Anda.
              </p>

              {timelineProjection.every(m => m.needed === 0) ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  Tidak ada rencana dana jatuh tempo dalam 12 bulan mendatang.
                </div>
              ) : (
                <div>
                  <div className="timeline-chart" style={{ height: '180px' }}>
                    {timelineProjection.map((m, idx) => {
                      const maxNeeded = Math.max(...timelineProjection.map(item => item.needed), 1);
                      const pctHeight = Math.max(5, (m.needed / maxNeeded) * 90);
                      
                      return (
                        <div key={idx} className="timeline-bar-wrapper">
                          <div 
                            className="timeline-bar"
                            style={{ height: `${pctHeight}%`, background: 'linear-gradient(180deg, #8b5cf6 0%, var(--color-primary) 100%)' }}
                          >
                            <div className="timeline-tooltip" style={{ width: '180px' }}>
                              <strong>{renderAmount(m.needed)}</strong><br />
                              <span style={{ fontSize: '0.75rem' }}>{m.goals.join(', ') || 'No deadlines'}</span>
                            </div>
                          </div>
                          <div className="timeline-label">{m.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Layout Grid: Daftar Rencana (Kiri) & Form Rencana Baru (Kanan) */}
            <div className="grid-cols-2" style={{ gridTemplateColumns: '1.7fr 1.3fr', gap: '2rem', alignItems: 'start' }}>
              {/* Daftar Target Rencana Dana */}
              <div className="glass-panel card-content">
                <h3 style={{ marginBottom: '1.5rem' }}>Daftar Rencana Dana</h3>
                
                {goals.length === 0 ? (
                  <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎯</span>
                    <strong>Belum ada target dana yang dibuat.</strong>
                    <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                      Gunakan formulir di sebelah kanan untuk membuat target rencana dana pertama Anda.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {goals.map(g => {
                      const remaining = calculateRemainingMonths(g.target_date);
                      const shortfall = Math.max(0, g.target_amount - g.current_savings);
                      const pct = Math.min(100, Math.max(0, (g.current_savings / g.target_amount) * 100));
                      const monthlyReq = shortfall / remaining;

                      // Category Icon selector
                      let categoryEmoji = '🎯';
                      if (g.category === 'education') categoryEmoji = '🎓';
                      else if (g.category === 'travel') categoryEmoji = '✈️';
                      else if (g.category === 'child') categoryEmoji = '👶';
                      else if (g.category === 'asset') categoryEmoji = '🏠';

                      return (
                        <div 
                          key={g.id} 
                          className="glass-panel" 
                          style={{ 
                            padding: '1.25rem', 
                            background: g.status === 'achieved' ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255,255,255,0.01)',
                            borderLeft: `4px solid ${g.status === 'achieved' ? 'var(--color-success)' : 'var(--color-primary)'}`,
                            opacity: g.status === 'cancelled' ? 0.6 : 1
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <span style={{ fontSize: '1.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '10px' }}>
                                {categoryEmoji}
                              </span>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{g.name}</h4>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                                  Target: <strong>{g.target_date}</strong> ({g.recurrence === 'one-time' ? 'Sekali saja' : g.recurrence === 'semester' ? 'Semesteran' : g.recurrence === 'yearly' ? 'Tahunan' : 'Bulanan'})
                                </div>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              {g.status === 'active' && (
                                <button 
                                  className="btn btn-secondary"
                                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                  onClick={() => {
                                    setSavingsAdjustGoal(g);
                                    setSavingsAdjustAmount('');
                                  }}
                                >
                                  💰 Tambah Tabungan
                                </button>
                              )}
                              <button 
                                className="btn"
                                style={{ padding: '0.35rem', color: 'var(--color-danger)', background: 'transparent' }}
                                onClick={() => handleDeleteGoal(g.id)}
                              >
                                <Icons.Delete />
                              </button>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div style={{ marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{renderAmount(g.current_savings)}</span>
                              <span style={{ color: 'var(--color-text-muted)' }}>{pct.toFixed(0)}% terkumpul dari {renderAmount(g.target_amount)}</span>
                            </div>
                            <div className="progress-track" style={{ height: '8px', background: 'rgba(255,255,255,0.05)' }}>
                              <div 
                                className="progress-fill" 
                                style={{ 
                                  width: `${pct}%`, 
                                  height: '100%', 
                                  borderRadius: '4px',
                                  background: g.status === 'achieved' ? 'var(--color-success)' : 'linear-gradient(90deg, var(--color-primary-glow) 0%, var(--color-primary) 100%)' 
                                }}
                              />
                            </div>
                          </div>

                          {/* Detail Estimasi & Kekurangan */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.03)', fontSize: '0.8rem' }}>
                            <div>
                              Sisa Waktu: <strong className="text-warning">{remaining} Bulan lagi</strong>
                            </div>
                            {g.status === 'active' && shortfall > 0 ? (
                              <div style={{ textAlign: 'right' }}>
                                Butuh: <strong style={{ color: '#c084fc' }}>{renderAmount(monthlyReq)} / bln</strong>
                              </div>
                            ) : (
                              <div style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
                                🎉 Target Tercapai!
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Form Tambah Target Baru */}
              <div className="glass-panel card-content">
                <h3 style={{ marginBottom: '1.5rem' }}>Buat Rencana Baru</h3>
                <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label>Nama Rencana / Tujuan</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Contoh: Kuliah Semester 3 Budi, Dana Liburan Bali" 
                      value={newGoalName}
                      onChange={(e) => setNewGoalName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid-cols-2" style={{ margin: 0, gap: '1rem' }}>
                    <div className="form-group">
                      <label>Target Nominal Dana (IDR)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Contoh: 9000000" 
                        value={newGoalTargetAmount}
                        onChange={(e) => setNewGoalTargetAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Dana Awal Terkumpul (IDR)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Opsional, contoh: 2000000" 
                        value={newGoalCurrentSavings}
                        onChange={(e) => setNewGoalCurrentSavings(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid-cols-2" style={{ margin: 0, gap: '1rem' }}>
                    <div className="form-group">
                      <label>Tanggal Target Dibutuhkan</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={newGoalTargetDate}
                        onChange={(e) => setNewGoalTargetDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Siklus Pengulangan</label>
                      <select 
                        className="form-control"
                        value={newGoalRecurrence}
                        onChange={(e) => setNewGoalRecurrence(e.target.value as any)}
                        required
                      >
                        <option value="one-time">Sekali Saja (One-time)</option>
                        <option value="monthly">Setiap Bulan (Monthly)</option>
                        <option value="semester">Setiap Semester (6 Bulanan)</option>
                        <option value="yearly">Setiap Tahun (Yearly)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Kategori Rencana</label>
                    <select 
                      className="form-control"
                      value={newGoalCategory}
                      onChange={(e) => setNewGoalCategory(e.target.value)}
                      required
                    >
                      <option value="education">🎓 Pendidikan (Sekolah/Kuliah)</option>
                      <option value="travel">✈️ Liburan & Perjalanan</option>
                      <option value="child">👶 Kebutuhan Anak</option>
                      <option value="asset">🏠 Aset / Properti</option>
                      <option value="general">🎯 Umum / Lain-lain</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', height: '45px', fontSize: '1rem' }}>
                    <Icons.Plus /> Simpan Rencana Dana
                  </button>
                </form>
              </div>
            </div>

            {/* Modal Tambah Tabungan */}
            {savingsAdjustGoal && (
              <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '450px', padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0 }}>💰 Tambah Tabungan Rencana</h3>
                    <button 
                      type="button" 
                      onClick={() => setSavingsAdjustGoal(null)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleAdjustSavings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Rencana Target:</span>
                      <h4 style={{ margin: '0.25rem 0 0 0' }}>{savingsAdjustGoal.name}</h4>
                    </div>

                    <div className="form-group">
                      <label>Jumlah Dana yang Disisihkan (IDR)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Masukkan nominal, misal: 1000000" 
                        value={savingsAdjustAmount}
                        onChange={(e) => setSavingsAdjustAmount(e.target.value)}
                        required
                        autoFocus
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                        Dana ini akan ditambahkan ke total tabungan saat ini ({renderAmount(savingsAdjustGoal.current_savings)}).
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ flex: 1 }}
                        onClick={() => setSavingsAdjustGoal(null)}
                      >
                        Batal
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ flex: 1 }}
                      >
                        Simpan
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
  );
}
