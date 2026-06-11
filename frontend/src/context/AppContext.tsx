import React, { createContext, useContext, useState, useEffect, useMemo, memo } from 'react';
import { API_URL } from '../constants';
import { formatIDR } from '../utils/format';

export type TabId = 'dashboard' | 'accounts' | 'budgets' | 'liabilities' | 'goals' | 'investments' | 'transactions' | 'ai' | 'settings';
export type TransactionSubTab = 'ledger' | 'import' | 'ocr';
export type LiabilitiesSubTab = 'overview' | 'installments' | 'loans';
export type PrivacyMode = 'blur' | 'hover' | 'visible';

// Defined outside AppProvider so its identity stays stable across re-renders,
// preserving the tapped state when the provider re-renders.
const PrivacySpan = memo(({ text, privacyMode }: { text: string; privacyMode: PrivacyMode }) => {
  const style: React.CSSProperties = { whiteSpace: 'nowrap' };
  const [tapped, setTapped] = useState(false);

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setTapped(t => !t);
  };

  if (privacyMode !== 'hover') {
    return <span style={style} className={privacyMode === 'blur' ? 'privacy-strict' : ''}>{text}</span>;
  }
  return (
    <span
      style={style}
      className={`privacy-hover${tapped ? ' privacy-revealed' : ''}`}
      onTouchEnd={handleTouchEnd}
      onClick={() => setTapped(t => !t)}
    >
      {text}
    </span>
  );
});

// Shared application state: API data collections, privacy masking, category
// helpers, and cross-page navigation. Feature pages own their local form and
// modal state and consume this context for everything that is shared.
export interface AppContextValue {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  navigateTo: (tab: TabId) => void;
  transactionSubTab: TransactionSubTab;
  setTransactionSubTab: (sub: TransactionSubTab) => void;
  switchTxSubTab: (sub: TransactionSubTab) => void;
  navOpen: boolean;
  setNavOpen: React.Dispatch<React.SetStateAction<boolean>>;

  accounts: any[];
  transactions: any[];
  budgets: any[];
  installments: any[];
  projections: any[];
  savedPasswords: any[];
  dbCategories: any[];
  debtsReceivables: any[];
  loadingDR: boolean;
  goals: any[];
  investments: any[];
  loadingInvestments: boolean;
  importLogs: any[];

  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  errorMsg: string;
  setErrorMsg: React.Dispatch<React.SetStateAction<string>>;

  aiProvider: string;
  setAiProvider: (v: any) => void;
  aiApiKey: string;
  setAiApiKey: React.Dispatch<React.SetStateAction<string>>;
  aiModelName: string;
  setAiModelName: React.Dispatch<React.SetStateAction<string>>;
  aiBaseUrl: string;
  setAiBaseUrl: React.Dispatch<React.SetStateAction<string>>;
  aiAnalysis: string;
  setAiAnalysis: React.Dispatch<React.SetStateAction<string>>;
  aiLoading: boolean;
  setAiLoading: React.Dispatch<React.SetStateAction<boolean>>;

  privacyMode: PrivacyMode;
  cyclePrivacyMode: () => void;
  renderAmount: (value: number) => React.ReactElement;
  getFullCategoryName: (catName: string) => string;
  getTransactionPath: (tx: any) => string;
  groupedCategories: { parent: any; subs: any[] }[];
  locationSuggestions: string[];
  productSuggestions: string[];
  descSuggestions: string[];

  selectedBudgetMonth: string;
  budgetViewPeriod: string;
  selectedBudgetYear: number;
  setSelectedBudgetYear: React.Dispatch<React.SetStateAction<number>>;
  budgetStartYear: number;
  setBudgetStartYear: React.Dispatch<React.SetStateAction<number>>;
  budgetEndYear: number;
  setBudgetEndYear: React.Dispatch<React.SetStateAction<number>>;

  fetchData: () => Promise<void>;
  fetchGoals: () => Promise<void>;
  fetchInvestments: () => Promise<void>;
  fetchDebtsReceivables: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabId>(
    () => (localStorage.getItem('pfm_active_tab') as TabId) || 'dashboard'
  );
  const [transactionSubTab, setTransactionSubTab] = useState<TransactionSubTab>(
    () => (localStorage.getItem('pfm_tx_sub_tab') as TransactionSubTab) || 'ledger'
  );
  const [navOpen, setNavOpen] = useState(false);

  const navigateTo = (tab: TabId) => {
    setActiveTab(tab);
    localStorage.setItem('pfm_active_tab', tab);
  };
  const switchTxSubTab = (sub: TransactionSubTab) => {
    setTransactionSubTab(sub);
    localStorage.setItem('pfm_tx_sub_tab', sub);
  };

  const [goals, setGoals] = useState<any[]>([]);

  // Data States
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [projections, setProjections] = useState<any[]>([]);
  const [savedPasswords, setSavedPasswords] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  // Debts and Receivables States
  const [debtsReceivables, setDebtsReceivables] = useState<any[]>([]);
  const [loadingDR, setLoadingDR] = useState(false);

  // ── Investments States ──────────────────────────────────────────────────
  const [investments, setInvestments] = useState<any[]>([]);
  const [loadingInvestments, setLoadingInvestments] = useState(false);
  const [importLogs, setImportLogs] = useState<any[]>([]);

  // Helper to resolve parent/sub category display name (e.g. "Personal / Gadget" or just "Others")
  const getFullCategoryName = (catName: string) => {
    if (!catName) return '';
    const cat = dbCategories.find(c => c.name === catName);
    if (cat && cat.parent_id) {
      const parent = dbCategories.find(p => p.id === cat.parent_id);
      if (parent) {
        return `${parent.name} / ${cat.name}`;
      }
    }
    return catName;
  };

  // Helper to resolve full hierarchy path: Category > Sub Category > Location/Merchant > Product/Service
  const getTransactionPath = (tx: any) => {
    if (!tx) return '';
    let path = getFullCategoryName(tx.category);
    if (tx.location_merchant) {
      path += ` > ${tx.location_merchant}`;
    }
    if (tx.product_service) {
      path += ` > ${tx.product_service}`;
    }
    return path;
  };

  // Group categories hierarchically for selects and management
  const groupedCategories = useMemo(() => {
    const parents = dbCategories.filter(c => !c.parent_id);
    const subMap: { [parentId: string]: any[] } = {};
    
    dbCategories.forEach(c => {
      if (c.parent_id) {
        if (!subMap[c.parent_id]) subMap[c.parent_id] = [];
        subMap[c.parent_id].push(c);
      }
    });

    const result: { parent: any; subs: any[] }[] = [];
    parents.forEach(parent => {
      result.push({
        parent,
        subs: subMap[parent.id] || []
      });
    });
    
    return result;
  }, [dbCategories]);

  // Budget period parameters drive the /api/budgets fetch inside fetchData.
  // Dynamic Year-Month state
  const currentMonthYear = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const selectedBudgetMonth = currentMonthYear;
  const budgetViewPeriod = 'yearly';
  const [selectedBudgetYear, setSelectedBudgetYear] = useState(new Date().getFullYear());
  const [budgetStartYear, setBudgetStartYear] = useState(new Date().getFullYear());
  const [budgetEndYear, setBudgetEndYear] = useState(new Date().getFullYear());

  // Auto-complete suggestion maps based on existing transaction records
  const locationSuggestions = useMemo(() => {
    const list = transactions.map(t => t.location_merchant).filter(Boolean);
    return Array.from(new Set(list));
  }, [transactions]);

  const productSuggestions = useMemo(() => {
    const list = transactions.map(t => t.product_service).filter(Boolean);
    return Array.from(new Set(list));
  }, [transactions]);

  const descSuggestions = useMemo(() => {
    const list = transactions.map(t => t.description).filter(Boolean);
    return Array.from(new Set(list));
  }, [transactions]);

  // loading/error status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // AI Configuration States
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'openrouter' | 'lm_studio' | 'ollama' | 'custom'>('gemini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModelName, setAiModelName] = useState('gemini-1.5-flash');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Privacy Mode State (blur = strict blur, hover = display on hover, visible = show all)
  const [privacyMode, setPrivacyMode] = useState<'blur' | 'hover' | 'visible'>(() => {
    const saved = localStorage.getItem('pfm_privacy_mode');
    return (saved as 'blur' | 'hover' | 'visible') || 'blur';
  });

  const cyclePrivacyMode = () => {
    setPrivacyMode(prev => {
      const next: PrivacyMode = prev === 'blur' ? 'hover' : prev === 'hover' ? 'visible' : 'blur';
      localStorage.setItem('pfm_privacy_mode', next);
      return next;
    });
  };

  const renderAmount = (value: number) => <PrivacySpan text={formatIDR(value)} privacyMode={privacyMode} />;

  // 1. Fetch all essential data
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // All endpoints are independent — fetch them in parallel.
      const getJson = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${url} returned ${res.status}`);
        return res.json();
      };

      const [accountsData, txData, instData, projData, passData, catData, bData] = await Promise.all([
        getJson(`${API_URL}/accounts`),
        getJson(`${API_URL}/transactions`),
        getJson(`${API_URL}/installments`),
        getJson(`${API_URL}/credit-cards/projection`),
        getJson(`${API_URL}/pdf/passwords`),
        getJson(`${API_URL}/categories`),
        getJson(`${API_URL}/budgets?month_year=${selectedBudgetMonth}&period=${budgetViewPeriod}&year=${selectedBudgetYear}&start_year=${budgetStartYear}&end_year=${budgetEndYear}`),
      ]);

      setAccounts(accountsData);
      setTransactions(txData);
      setInstallments(instData);
      setProjections(projData);
      setSavedPasswords(passData);
      setDbCategories(catData);
      setBudgets(bData);

      // AI configuration and import logs are optional — failures are non-fatal.
      const [aiConfRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/ai/config`),
        fetch(`${API_URL}/import/logs`),
      ]);
      if (aiConfRes.ok) {
        const aiConf = await aiConfRes.json();
        setAiProvider(aiConf.provider || 'gemini');
        setAiApiKey(aiConf.api_key || '');
        setAiModelName(aiConf.model_name || '');
        setAiBaseUrl(aiConf.base_url || '');
      }
      if (logsRes.ok) {
        setImportLogs(await logsRes.json());
      }

      // Debts & receivables, goals, and investments handle their own errors.
      await Promise.all([fetchDebtsReceivables(), fetchGoals(), fetchInvestments()]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to communicate with API backend. Check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    try {
      const res = await fetch(`${API_URL}/goals`);
      if (res.ok) {
        const data = await res.json();
        setGoals(data);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
  };

  const fetchInvestments = async () => {
    try {
      setLoadingInvestments(true);
      const res = await fetch(`${API_URL}/investments`);
      if (res.ok) {
        const data = await res.json();
        setInvestments(data);
      }
    } catch (error) {
      console.error('Error fetching investments:', error);
    } finally {
      setLoadingInvestments(false);
    }
  };

  const fetchDebtsReceivables = async () => {
    setLoadingDR(true);
    try {
      const res = await fetch(`${API_URL}/debts-receivables`);
      if (res.ok) {
        const data = await res.json();
        setDebtsReceivables(data);
      }
    } catch (error) {
      console.error('Error fetching debts & receivables:', error);
    } finally {
      setLoadingDR(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBudgetMonth, budgetViewPeriod, selectedBudgetYear, budgetStartYear, budgetEndYear]);

  const value = {
    activeTab, setActiveTab, navigateTo,
    transactionSubTab, setTransactionSubTab, switchTxSubTab,
    navOpen, setNavOpen,
    accounts, transactions, budgets, installments, projections, savedPasswords, dbCategories,
    debtsReceivables, loadingDR,
    goals, investments, loadingInvestments,
    importLogs,
    loading, setLoading, errorMsg, setErrorMsg,
    aiProvider, setAiProvider, aiApiKey, setAiApiKey, aiModelName, setAiModelName, aiBaseUrl, setAiBaseUrl,
    aiAnalysis, setAiAnalysis, aiLoading, setAiLoading,
    privacyMode, cyclePrivacyMode, renderAmount,
    getFullCategoryName, getTransactionPath, groupedCategories,
    locationSuggestions, productSuggestions, descSuggestions,
    selectedBudgetMonth, budgetViewPeriod,
    selectedBudgetYear, setSelectedBudgetYear,
    budgetStartYear, setBudgetStartYear,
    budgetEndYear, setBudgetEndYear,
    fetchData, fetchGoals, fetchInvestments, fetchDebtsReceivables,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
