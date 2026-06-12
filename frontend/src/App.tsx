import { useState } from 'react';
import Icons from './components/Icons';
import { AppProvider, useApp } from './context/AppContext';
import ChangelogModal from './components/ChangelogModal';
import { APP_VERSION } from './changelog';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import TransactionsPage from './pages/TransactionsPage';
import BudgetsPage from './pages/BudgetsPage';
import LiabilitiesPage from './pages/LiabilitiesPage';
import GoalsPage from './pages/GoalsPage';
import InvestmentsPage from './pages/InvestmentsPage';
import AdvisorPage from './pages/AdvisorPage';
import SettingsPage from './pages/SettingsPage';

const NAV_ITEMS = [
  { id: 'dashboard',    icon: '📊', label: 'Dashboard' },
  { id: 'accounts',     icon: '💳', label: 'Accounts' },
  { id: 'transactions', icon: '📝', label: 'Transactions' },
  { id: 'budgets',      icon: '💸', label: 'Budgets' },
  { id: 'liabilities',  icon: '🤝', label: 'Liabilities' },
  { id: 'goals',        icon: '🎯', label: 'Goals' },
  { id: 'investments',  icon: '📈', label: 'Investments' },
  { id: 'ai',           icon: '🤖', label: 'AI Advisor' },
  { id: 'settings',     icon: '⚙️', label: 'Settings' },
] as const;

function AppShell() {
  const [showChangelog, setShowChangelog] = useState(false);
  const {
    activeTab, navigateTo,
    switchTxSubTab,
    navOpen, setNavOpen,
    privacyMode, cyclePrivacyMode,
    loading, errorMsg,
  } = useApp();

  return (
    <div className="app-container">
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}

      {/* Header Bar */}
      <header>
        <div className="header-content">
          <div className="brand">
            <span className="brand-icon">💰</span>
            <span className="brand-text">Personal Wealth Manager</span>
            <button
              onClick={() => setShowChangelog(true)}
              title="Lihat changelog"
              style={{
                background: 'transparent', border: 'none', padding: 0,
                cursor: 'pointer', lineHeight: 1,
              }}
            >
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em',
                padding: '0.15rem 0.5rem', borderRadius: '999px',
                background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)',
                border: '1px solid rgba(255,255,255,0.12)',
                transition: 'all 0.15s',
              }}>
                v{APP_VERSION}
              </span>
            </button>
            {import.meta.env.VITE_APP_MODE === 'dev' && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
                padding: '0.15rem 0.5rem', borderRadius: '999px',
                background: 'rgba(245,158,11,0.15)', color: '#fbbf24',
                border: '1px solid rgba(245,158,11,0.35)',
                textTransform: 'uppercase',
              }}>DEV</span>
            )}
          </div>

          {/* Mobile-only privacy toggle */}
          <button
            type="button"
            className="mobile-privacy-btn"
            onClick={cyclePrivacyMode}
            title="Toggle Privacy Masking"
          >
            <span>{privacyMode === 'blur' ? '🔒' : privacyMode === 'hover' ? '🫣' : '🔓'}</span>
          </button>

          <button
            className="nav-hamburger"
            onClick={() => setNavOpen((prev: boolean) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={navOpen}
          >
            {navOpen ? '✕' : '☰'}
          </button>

          <nav className={`nav-links${navOpen ? ' open' : ''}`} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Menu:</span>
            <select
              className="form-control"
              style={{
                width: '210px',
                padding: '0.35rem 1.8rem 0.35rem 0.75rem',
                margin: 0,
                height: '34px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'var(--border-color)',
                color: 'var(--color-text-main)',
                cursor: 'pointer',
                borderRadius: '6px'
              }}
              value={activeTab}
              onChange={(e) => {
                const tab = e.target.value as typeof activeTab;
                navigateTo(tab);
                if (tab === 'transactions') switchTxSubTab('ledger');
                setNavOpen(false);
              }}
            >
              {NAV_ITEMS.map(item => (
                <option key={item.id} value={item.id}>{item.icon} {item.label}</option>
              ))}
            </select>
            <span style={{ borderLeft: '1px solid var(--border-color)', margin: '0 0.25rem', alignSelf: 'center', height: '20px' }} />
            <button
              type="button"
              onClick={cyclePrivacyMode}
              style={{
                background: privacyMode === 'blur' ? 'rgba(239, 68, 68, 0.12)' : privacyMode === 'hover' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                color: privacyMode === 'blur' ? '#ef4444' : privacyMode === 'hover' ? '#f59e0b' : '#10b981',
                border: '1px solid',
                borderColor: privacyMode === 'blur' ? 'rgba(239, 68, 68, 0.25)' : privacyMode === 'hover' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                padding: '0.45rem 0.85rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.25s ease',
              }}
              title="Toggle Privacy Masking"
            >
              <span>{privacyMode === 'blur' ? '🔒' : privacyMode === 'hover' ? '🫣' : '🔓'}</span>
              <span>{privacyMode === 'blur' ? 'Strict Blur' : privacyMode === 'hover' ? 'Display on Hover' : 'Display All'}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Body */}
      <main className="main-content">
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '2rem 0', gap: '0.75rem' }}>
            <div style={{
              width: '40px', height: '40px',
              border: '4px solid var(--color-primary-glow)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {errorMsg && (
          <div className="glass-panel text-danger" style={{ display: 'flex', gap: '0.75rem', padding: '1.25rem', marginBottom: '2rem', background: 'rgba(244, 63, 94, 0.08)', borderColor: 'var(--color-danger)' }}>
            <Icons.Alert />
            <div>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>An error occurred</strong>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Transactions stays mounted (hidden) so in-progress PDF imports, OCR
            scans, and ledger filters survive switching tabs. */}
        <div style={activeTab === 'transactions' ? undefined : { display: 'none' }}>
          <TransactionsPage />
        </div>

        {activeTab === 'dashboard'    && <DashboardPage />}
        {activeTab === 'accounts'     && <AccountsPage />}
        {activeTab === 'budgets'      && <BudgetsPage />}
        {activeTab === 'liabilities'  && <LiabilitiesPage />}
        {activeTab === 'goals'        && <GoalsPage />}
        {activeTab === 'investments'  && <InvestmentsPage />}
        {activeTab === 'ai'           && <AdvisorPage />}
        {activeTab === 'settings'     && <SettingsPage />}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav" aria-label="Bottom navigation">
        <div className="mobile-bottom-nav-inner">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              className={`mobile-nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => {
                navigateTo(item.id);
                if (item.id === 'transactions') switchTxSubTab('ledger');
              }}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
