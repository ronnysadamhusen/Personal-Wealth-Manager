import React, { useMemo } from 'react';
import { formatIDR } from '../utils/format';
import { useApp } from '../context/AppContext';

export default function DashboardPage() {
  const {
    accounts, transactions, dbCategories, debtsReceivables, goals, investments,
    renderAmount, navigateTo, setNavOpen,
  } = useApp();

  // Calculated Values
  const totals = useMemo(() => {
    let totalCash = 0;
    let totalCcDebt = 0;
    let totalInstallmentDebt = 0;

    accounts.forEach(a => {
      if (a.type === 'bank' || a.type === 'cash') {
        totalCash += a.current_balance;
      } else if (a.type === 'credit_card') {
        totalCcDebt += a.current_balance; // spent amounts are negative in database
        totalInstallmentDebt += a.installment_debt;
      }
    });

    const netWorth = totalCash + totalCcDebt; // cc debt is negative, so this subtracts it

    return {
      totalCash,
      totalCcDebt: Math.abs(totalCcDebt),
      totalInstallmentDebt,
      netWorth
    };
  }, [accounts]);

            /* ── derived values ── */
            const totalInvestmentValue = investments.reduce((s: number, inv: any) =>
              s + (inv.current_units > 0 ? inv.current_units * (inv.current_price_per_unit || 0) : inv.total_invested || 0), 0);
            const totalInvestmentCost  = investments.reduce((s: number, inv: any) => s + (inv.total_invested || 0), 0);
            const investmentPnL        = totalInvestmentValue - totalInvestmentCost;
            const totalGoalTarget      = goals.filter((g: any) => g.status === 'active').reduce((s: number, g: any) => s + g.target_amount, 0);
            const totalGoalSaved       = goals.filter((g: any) => g.status === 'active').reduce((s: number, g: any) => s + g.current_savings, 0);
            const totalPersonalDebt    = debtsReceivables.filter((d: any) => d.type === 'debt' && d.status === 'active').reduce((s: number, d: any) => s + d.remaining_amount, 0);
            const totalReceivable      = debtsReceivables.filter((d: any) => d.type === 'receivable' && d.status === 'active').reduce((s: number, d: any) => s + d.remaining_amount, 0);
            const totalAssets          = totals.totalCash + totalInvestmentValue + totalGoalSaved + totalReceivable;
            const totalLiabilities     = totals.totalCcDebt + totals.totalInstallmentDebt + totalPersonalDebt;
            const trueNetWorth         = totalAssets - totalLiabilities;
            const bankAccounts         = accounts.filter((a: any) => a.type === 'bank' || a.type === 'cash');
            const ccAccounts           = accounts.filter((a: any) => a.type === 'credit_card');
            const activeGoals          = goals.filter((g: any) => g.status === 'active');

            const Row = ({ label, value, sub, color }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; color?: string }) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{label}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: color || 'var(--color-text-main)' }}>{value}</span>
                  {sub && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>{sub}</div>}
                </div>
              </div>
            );

            const SectionTitle = ({ icon, label }: { icon: string; label: string }) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.85rem' }}>{icon}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</span>
              </div>
            );

            const Panel = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
              <div className="glass-panel" style={{ padding: '1rem', ...style }}>{children}</div>
            );

            return (
              <div>
                {/* ── Hero: Net Worth ── */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)',
                  border: '1px solid rgba(99,102,241,0.18)',
                  borderRadius: '10px',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                      Total Net Worth
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', color: trueNetWorth >= 0 ? 'var(--color-success)' : 'var(--color-danger)', lineHeight: 1 }}>
                      {renderAmount(trueNetWorth)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
                      Aset <strong style={{ color: 'var(--color-success)' }}>{renderAmount(totalAssets)}</strong>
                      &nbsp;—&nbsp;Kewajiban <strong style={{ color: 'var(--color-danger)' }}>{renderAmount(totalLiabilities)}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Kas & Tabungan', val: totals.totalCash, color: 'var(--color-success)' },
                      { label: 'Portofolio Investasi', val: totalInvestmentValue, color: 'var(--color-primary)' },
                      { label: 'Total Kewajiban', val: -totalLiabilities, color: 'var(--color-danger)' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', letterSpacing: '0.5px', marginBottom: '0.2rem', textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color }}>{renderAmount(Math.abs(val))}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Eisenhower Matrix ── */}
                {(() => {
                  // Build category lookup: name → {importance, urgency}
                  const catMap: Record<string, { importance: string | null; urgency: string | null; parent_id: string | null }> = {};
                  dbCategories.forEach((c: any) => { catMap[c.name] = { importance: c.importance, urgency: c.urgency, parent_id: c.parent_id }; });

                  const getEffective = (catName: string) => {
                    const cat = catMap[catName];
                    if (!cat) return { importance: null, urgency: null };
                    // inherit from parent if own is null
                    if ((!cat.importance || !cat.urgency) && cat.parent_id) {
                      const parent = dbCategories.find((c: any) => c.id === cat.parent_id);
                      if (parent) return { importance: cat.importance || parent.importance, urgency: cat.urgency || parent.urgency };
                    }
                    return { importance: cat.importance, urgency: cat.urgency };
                  };

                  const currentYear = new Date().getFullYear();
                  const expenseTx = transactions.filter((t: any) => t.amount < 0 && t.date?.startsWith(String(currentYear)));

                  // Quadrant totals & top cats
                  const quadrants: Record<string, { total: number; cats: Record<string, number> }> = {
                    'penting-mendesak':      { total: 0, cats: {} },
                    'penting-tidak_mendesak':{ total: 0, cats: {} },
                    'tidak_penting-mendesak':{ total: 0, cats: {} },
                    'tidak_penting-tidak_mendesak': { total: 0, cats: {} },
                  };
                  let classified = 0;

                  expenseTx.forEach((t: any) => {
                    const { importance, urgency } = getEffective(t.category);
                    if (!importance || !urgency) return;
                    const key = `${importance}-${urgency}`;
                    if (!quadrants[key]) return;
                    quadrants[key].total += Math.abs(t.amount);
                    quadrants[key].cats[t.category] = (quadrants[key].cats[t.category] || 0) + Math.abs(t.amount);
                    classified++;
                  });

                  if (classified === 0) return null; // hide if nothing classified yet

                  const grandTotal = Object.values(quadrants).reduce((s, q) => s + q.total, 0);

                  const QCard = ({ qKey, title, subtitle, border, bg, titleColor }: { qKey: string; title: string; subtitle: string; border: string; bg: string; titleColor: string }) => {
                    const q = quadrants[qKey];
                    const pct = grandTotal > 0 ? (q.total / grandTotal * 100) : 0;
                    const topCats = Object.entries(q.cats).sort((a, b) => b[1] - a[1]).slice(0, 3);
                    return (
                      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: titleColor, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{title}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>{subtitle}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: titleColor, lineHeight: 1 }}>{renderAmount(q.total)}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>{pct.toFixed(1)}% dari total pengeluaran</div>
                        {topCats.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {topCats.map(([cat, amt]) => (
                              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                                <span style={{ color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '0.4rem' }}>{cat}</span>
                                <span style={{ fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{renderAmount(amt)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>⊞ Eisenhower Matrix · Pengeluaran {currentYear}</span>
                        <button type="button" onClick={() => navigateTo('settings')} style={{ fontSize: '0.65rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          Atur kategori →
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <QCard qKey="penting-mendesak"           title="Penting · Mendesak"           subtitle="Lakukan Sekarang — kebutuhan mendesak"         border="rgba(239,68,68,0.3)"   bg="rgba(239,68,68,0.05)"   titleColor="#f87171" />
                        <QCard qKey="penting-tidak_mendesak"     title="Penting · Tidak Mendesak"     subtitle="Rencanakan — investasi jangka panjang"          border="rgba(99,102,241,0.3)"  bg="rgba(99,102,241,0.05)"  titleColor="#818cf8" />
                        <QCard qKey="tidak_penting-mendesak"     title="Tidak Penting · Mendesak"     subtitle="Pertimbangkan ulang — bisa dikurangi"           border="rgba(245,158,11,0.3)"  bg="rgba(245,158,11,0.05)"  titleColor="#fbbf24" />
                        <QCard qKey="tidak_penting-tidak_mendesak" title="Tidak Penting · Tidak Mendesak" subtitle="Eliminasi — kandidat penghematan terbesar" border="rgba(107,114,128,0.3)" bg="rgba(107,114,128,0.05)" titleColor="#9ca3af" />
                      </div>

                      {/* ── Analysis Panel ── */}
                      {(() => {
                        const q1 = quadrants['penting-mendesak'].total;
                        const q2 = quadrants['penting-tidak_mendesak'].total;
                        const q3 = quadrants['tidak_penting-mendesak'].total;
                        const q4 = quadrants['tidak_penting-tidak_mendesak'].total;
                        const pct = (v: number) => grandTotal > 0 ? (v / grandTotal * 100) : 0;
                        const fmt = (v: number) => `${pct(v).toFixed(0)}%`;

                        // Health score: productive = Q1+Q2, unproductive = Q3+Q4
                        const unproductivePct = pct(q3 + q4);
                        const q2Pct = pct(q2);
                        const q4Pct = pct(q4);
                        const q3Pct = pct(q3);
                        const q1Pct = pct(q1);

                        let healthLabel: string;
                        let healthColor: string;
                        let healthScore: number; // 0-100
                        if (unproductivePct < 10) { healthLabel = 'Sangat Baik'; healthColor = '#22c55e'; healthScore = 92; }
                        else if (unproductivePct < 20) { healthLabel = 'Baik'; healthColor = '#4ade80'; healthScore = 75; }
                        else if (unproductivePct < 35) { healthLabel = 'Perlu Perhatian'; healthColor = '#fbbf24'; healthScore = 50; }
                        else { healthLabel = 'Perlu Evaluasi'; healthColor = '#f87171'; healthScore = 25; }

                        // Generate insights
                        const insights: { icon: string; color: string; text: string }[] = [];

                        // Q4 insight — eliminate zone
                        if (q4 > 0) {
                          const topQ4 = Object.entries(quadrants['tidak_penting-tidak_mendesak'].cats).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([c])=>c).join(', ');
                          if (q4Pct >= 20) {
                            insights.push({ icon: '🚨', color: '#f87171', text: `${fmt(q4)} pengeluaranmu (${formatIDR(q4)}) masuk zona <strong>Eliminasi</strong> — tidak penting dan tidak mendesak. Kategori terbesar: ${topQ4}. Ini kandidat paling potensial untuk dihemat.` });
                          } else if (q4Pct >= 10) {
                            insights.push({ icon: '⚠️', color: '#fbbf24', text: `${fmt(q4)} pengeluaran di zona Eliminasi (${formatIDR(q4)}). Pertimbangkan untuk mengurangi kategori: ${topQ4}.` });
                          } else {
                            insights.push({ icon: '✅', color: '#22c55e', text: `Zona Eliminasi hanya ${fmt(q4)} dari total pengeluaran — sudah sangat terkontrol.` });
                          }
                        }

                        // Q3 insight — not important but urgent
                        if (q3 > 0 && q3Pct >= 10) {
                          const topQ3 = Object.entries(quadrants['tidak_penting-mendesak'].cats).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([c])=>c).join(', ');
                          insights.push({ icon: '💡', color: '#fbbf24', text: `${fmt(q3)} dialokasikan untuk hal <strong>Tidak Penting tapi Mendesak</strong> (${topQ3}). Pertimbangkan renegotiasi, cari alternatif lebih murah, atau kurangi frekuensinya.` });
                        }

                        // Q2 insight — important, not urgent (planning zone)
                        if (q2Pct < 15 && (q1 + q2 + q3 + q4) > 0) {
                          insights.push({ icon: '📌', color: '#818cf8', text: `Alokasi untuk hal <strong>Penting tapi Tidak Mendesak</strong> (tabungan, investasi, pengembangan diri, kesehatan preventif) baru ${fmt(q2)}. Kuadran ini adalah kunci kebebasan finansial jangka panjang — idealnya di atas 20%.` });
                        } else if (q2Pct >= 20) {
                          insights.push({ icon: '🌱', color: '#818cf8', text: `Bagus! ${fmt(q2)} dialokasikan untuk hal Penting tapi Tidak Mendesak. Ini menunjukkan kamu sudah berinvestasi untuk masa depan.` });
                        }

                        // Q1 dominance insight
                        if (q1Pct > 70) {
                          insights.push({ icon: '⏱️', color: '#f87171', text: `${fmt(q1)} pengeluaran bersifat mendesak dan penting — artinya sebagian besar uang habis untuk kebutuhan reaktif. Pastikan ada ruang untuk perencanaan (Q2) agar tidak selalu dalam mode "pemadam kebakaran".` });
                        }

                        // Overall positive if small unproductive
                        if (unproductivePct < 10 && insights.length === 0) {
                          insights.push({ icon: '🏆', color: '#22c55e', text: `Distribusi pengeluaranmu sangat sehat. Kurang dari ${fmt(q3+q4)} masuk zona tidak produktif. Pertahankan dan terus tingkatkan alokasi untuk perencanaan (Q2).` });
                        }

                        return (
                          <div style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
                            {/* Health Score */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>💊 Skor Kesehatan Pengeluaran</span>
                              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: healthColor }}>{healthLabel}</span>
                            </div>
                            {/* Score bar */}
                            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '0.75rem' }}>
                              <div style={{ height: '100%', borderRadius: '3px', width: `${healthScore}%`, background: `linear-gradient(90deg, #6366f1, ${healthColor})`, transition: 'width 0.6s ease' }} />
                            </div>
                            {/* Distribution bar */}
                            <div style={{ marginBottom: '0.75rem' }}>
                              <div style={{ fontSize: '0.63rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Distribusi pengeluaran</div>
                              <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', gap: '1px' }}>
                                {[
                                  { val: q1, color: '#f87171', label: 'Q1' },
                                  { val: q2, color: '#818cf8', label: 'Q2' },
                                  { val: q3, color: '#fbbf24', label: 'Q3' },
                                  { val: q4, color: '#6b7280', label: 'Q4' },
                                ].filter(s => s.val > 0).map(s => (
                                  <div key={s.label} title={`${s.label}: ${pct(s.val).toFixed(1)}%`}
                                    style={{ width: `${pct(s.val)}%`, background: s.color, transition: 'width 0.6s ease' }} />
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                                {[
                                  { label: 'Penting+Mendesak', val: q1, color: '#f87171' },
                                  { label: 'Penting+Tidak Mendesak', val: q2, color: '#818cf8' },
                                  { label: 'Tidak Penting+Mendesak', val: q3, color: '#fbbf24' },
                                  { label: 'Tidak Penting+Tidak Mendesak', val: q4, color: '#6b7280' },
                                ].filter(s => s.val > 0).map(s => (
                                  <span key={s.label} style={{ fontSize: '0.6rem', color: s.color, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: s.color, flexShrink: 0 }} />
                                    {s.label} {fmt(s.val)}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {/* Insights */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                              {insights.map((ins, i) => (
                                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.4rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${ins.color}` }}>
                                  <span style={{ fontSize: '0.8rem', flexShrink: 0, lineHeight: 1.4 }}>{ins.icon}</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: ins.text }} />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* ── Main Grid: 2 columns ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

                  {/* ═══ COLUMN 1: ASSETS ═══ */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                    {/* Cash & Bank Accounts */}
                    <Panel>
                      <SectionTitle icon="🏦" label="Kas & Rekening Bank" />
                      {bankAccounts.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>
                          Belum ada rekening.{' '}
                          <button style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                            onClick={() => navigateTo('accounts')}>Tambah →</button>
                        </div>
                      ) : (
                        <>
                          {bankAccounts.map((a: any) => (
                            <Row
                              key={a.id}
                              label={`${a.type === 'cash' ? '💵' : '🏦'} ${a.name}`}
                              value={renderAmount(a.current_balance)}
                              color="var(--color-success)"
                            />
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Total</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-success)' }}>{renderAmount(totals.totalCash)}</span>
                          </div>
                        </>
                      )}
                    </Panel>

                    {/* Investment Portfolio */}
                    <Panel>
                      <SectionTitle icon="📈" label="Portofolio Investasi" />
                      {investments.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>
                          Belum ada investasi.{' '}
                          <button style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                            onClick={() => navigateTo('investments')}>Tambah →</button>
                        </div>
                      ) : (
                        <>
                           {investments.map((inv: any) => {
                             const mktVal = inv.current_units > 0 ? inv.current_units * (inv.current_price_per_unit || 0) : inv.total_invested || 0;
                             const pnl = mktVal - (inv.total_invested || 0);
                             const pnlPct = inv.total_invested > 0 ? (pnl / inv.total_invested) * 100 : 0;
                             return (
                               <Row
                                 key={inv.id}
                                 label={inv.name}
                                 value={renderAmount(mktVal)}
                                 sub={pnl !== 0 ? `${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% (${pnl >= 0 ? '+' : ''}${formatIDR(pnl)})` : undefined}
                                 color={pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
                               />
                             );
                           })}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Total Portfolio</span>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-primary)' }}>{renderAmount(totalInvestmentValue)}</div>
                              {investmentPnL !== 0 && (
                                <div style={{ fontSize: '0.7rem', color: investmentPnL >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                  {investmentPnL >= 0 ? '+' : ''}{renderAmount(investmentPnL)} unrealized P&L
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </Panel>

                    {/* Future Goals */}
                    {activeGoals.length > 0 && (
                      <Panel>
                        <SectionTitle icon="🎯" label="Dana Tujuan (Goals)" />
                        {activeGoals.map((g: any) => {
                          const pct = g.target_amount > 0 ? Math.min(100, (g.current_savings / g.target_amount) * 100) : 0;
                          return (
                            <div key={g.id} style={{ marginBottom: '0.6rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem' }}>
                                <span style={{ fontWeight: 500 }}>{g.name}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>{pct.toFixed(0)}%</span>
                              </div>
                              <div className="progress-track">
                                <div className={`progress-fill ${pct >= 100 ? 'success' : pct >= 60 ? 'warning' : 'danger'}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                                <span>{renderAmount(g.current_savings)}</span>
                                <span>{renderAmount(g.target_amount)}</span>
                              </div>
                            </div>
                          );
                        })}
                        {totalGoalTarget > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Total Tersimpan</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-warning)' }}>{renderAmount(totalGoalSaved)}</span>
                          </div>
                        )}
                      </Panel>
                    )}

                    {/* Receivables */}
                    {totalReceivable > 0 && (
                      <Panel>
                        <SectionTitle icon="💸" label="Piutang (Receivables)" />
                        {debtsReceivables.filter((d: any) => d.type === 'receivable' && d.status === 'active').map((d: any) => (
                          <Row key={d.id} label={d.person} value={renderAmount(d.remaining_amount)} color="var(--color-warning)" />
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Total Piutang</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-warning)' }}>{renderAmount(totalReceivable)}</span>
                        </div>
                      </Panel>
                    )}
                  </div>

                  {/* ═══ COLUMN 2: LIABILITIES ═══ */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                    {/* Credit Cards */}
                    <Panel>
                      <SectionTitle icon="💳" label="Kartu Kredit" />
                      {ccAccounts.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>Tidak ada kartu kredit.</div>
                      ) : (
                        <>
                          {ccAccounts.map((a: any) => {
                            const usedPct = a.credit_limit > 0 ? Math.min(100, (Math.abs(a.current_balance) / a.credit_limit) * 100) : 0;
                            return (
                              <div key={a.id} style={{ marginBottom: '0.6rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                                  <span style={{ fontWeight: 500 }}>💳 {a.name}</span>
                                  <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{renderAmount(Math.abs(a.current_balance))}</span>
                                </div>
                                {a.credit_limit > 0 && (
                                  <>
                                    <div className="progress-track">
                                      <div className={`progress-fill ${usedPct >= 80 ? 'danger' : usedPct >= 50 ? 'warning' : 'success'}`}
                                        style={{ width: `${usedPct}%` }} />
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                                      {usedPct.toFixed(0)}% dari limit {renderAmount(a.credit_limit)}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Total CC Debt</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-danger)' }}>{renderAmount(totals.totalCcDebt)}</span>
                          </div>
                        </>
                      )}
                    </Panel>

                    {/* Installments */}
                    {totals.totalInstallmentDebt > 0 && (
                      <Panel>
                        <SectionTitle icon="🔄" label="Cicilan Aktif" />
                        {ccAccounts.map((a: any) => a.installment_debt > 0 && (
                          <Row key={a.id} label={a.name} value={renderAmount(a.installment_debt)} color="var(--color-warning)" />
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Total Cicilan</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-warning)' }}>{renderAmount(totals.totalInstallmentDebt)}</span>
                        </div>
                      </Panel>
                    )}

                    {/* Personal Debts */}
                    {totalPersonalDebt > 0 && (
                      <Panel>
                        <SectionTitle icon="🤝" label="Utang Pribadi" />
                        {debtsReceivables.filter((d: any) => d.type === 'debt' && d.status === 'active').map((d: any) => (
                          <Row key={d.id} label={d.person} value={renderAmount(d.remaining_amount)} color="var(--color-danger)" />
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Total Utang Pribadi</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-danger)' }}>{renderAmount(totalPersonalDebt)}</span>
                        </div>
                      </Panel>
                    )}

                    {/* Wealth Allocation Summary */}
                    {totalAssets > 0 && (
                      <Panel>
                        <SectionTitle icon="📊" label="Alokasi Aset" />
                        {[
                          { label: 'Kas & Tabungan', val: totals.totalCash, color: 'var(--color-success)' },
                          { label: 'Investasi',       val: totalInvestmentValue, color: 'var(--color-primary)' },
                          { label: 'Dana Goals',      val: totalGoalSaved,        color: 'var(--color-warning)' },
                          { label: 'Piutang',         val: totalReceivable,       color: '#a78bfa' },
                        ].filter(x => x.val > 0).map(({ label, val, color }) => {
                          const pct = totalAssets > 0 ? (val / totalAssets) * 100 : 0;
                          return (
                            <div key={label} style={{ marginBottom: '0.55rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                                <span style={{ fontWeight: 600, color }}>{pct.toFixed(1)}%</span>
                              </div>
                              <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.6s ease' }} />
                              </div>
                            </div>
                          );
                        })}
                      </Panel>
                    )}

                    {/* Quick Links */}
                    <Panel>
                      <SectionTitle icon="⚡" label="Navigasi Cepat" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                        {[
                          { label: '📊 Transactions', tab: 'transactions' as const },
                          { label: '📈 Investments', tab: 'investments' as const },
                          { label: '💰 Budgets', tab: 'budgets' as const },
                          { label: '🎯 Goals', tab: 'goals' as const },
                          { label: '🤝 Liabilities', tab: 'liabilities' as const },
                          { label: '🤖 AI Advisor', tab: 'ai' as const },
                        ].map(({ label, tab }) => (
                          <button key={tab} type="button"
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              color: 'var(--color-text-muted)',
                              padding: '0.5rem 0.6rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              textAlign: 'left'
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.08)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.2)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'; }}
                            onClick={() => { navigateTo(tab as any); setNavOpen(false); }}
                          >{label}</button>
                        ))}
                      </div>
                    </Panel>
                  </div>
                </div>
              </div>
            );
}
