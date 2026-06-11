import Icons from './components/Icons';
import { AppProvider, useApp } from './context/AppContext';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import TransactionsPage from './pages/TransactionsPage';
import BudgetsPage from './pages/BudgetsPage';
import LiabilitiesPage from './pages/LiabilitiesPage';
import GoalsPage from './pages/GoalsPage';
import InvestmentsPage from './pages/InvestmentsPage';
import AdvisorPage from './pages/AdvisorPage';
import SettingsPage from './pages/SettingsPage';

function AppShell() {
  const {
    activeTab, setActiveTab,
    setTransactionSubTab,
    navOpen, setNavOpen,
    privacyMode, cyclePrivacyMode,
    loading, errorMsg,
  } = useApp();

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header>
        <div className="header-content">
          <div className="brand">
            <span style={{ fontSize: '1.8rem' }}>💰</span>
            <span>Personal Wealth Manager</span>
          </div>

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
                const tab = e.target.value;
                setActiveTab(tab as any);
                if (tab === 'transactions') {
                  setTransactionSubTab('ledger');
                }
                setNavOpen(false);
              }}
            >
              <option value="dashboard">📊 Dashboard Summary</option>
              <option value="accounts">💳 Accounts & Balance</option>
              <option value="transactions">📝 Transactions Ledger</option>
              <option value="budgets">💸 Anggaran / Budgets</option>
              <option value="liabilities">🤝 Liabilities & Receivables</option>
              <option value="goals">🎯 Future Financial Goals</option>
              <option value="investments">📈 Investments Modules</option>
              <option value="ai">🤖 AI Financial Advisor</option>
              <option value="settings">⚙️ Settings & System</option>
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
                boxShadow: privacyMode === 'blur' ? '0 0 8px rgba(239, 68, 68, 0.05)' : privacyMode === 'hover' ? '0 0 8px rgba(245, 158, 11, 0.05)' : '0 0 8px rgba(16, 185, 129, 0.05)'
              }}
              title="Toggle Privacy Masking (Strict Blur -> Display on Hover -> Display All)"
            >
              <span>{privacyMode === 'blur' ? '🔒' : privacyMode === 'hover' ? '🫣' : '🔓'}</span>
              <span>{privacyMode === 'blur' ? 'Strict Blur' : privacyMode === 'hover' ? 'Display on Hover' : 'Display All'}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Body */}
      <main className="main-content">
        {/* Loading Indicator */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '2rem 0', gap: '0.75rem' }}>
            <div style={{
              width: '40px', height: '40px',
              border: '4px solid var(--color-primary-glow)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
          </div>
        )}

        {/* Global Error Banner */}
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

        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'accounts' && <AccountsPage />}
        {activeTab === 'budgets' && <BudgetsPage />}
        {activeTab === 'liabilities' && <LiabilitiesPage />}
        {activeTab === 'goals' && <GoalsPage />}
        {activeTab === 'investments' && <InvestmentsPage />}
        {activeTab === 'ai' && <AdvisorPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
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
