import React, { useState, useEffect, useMemo } from 'react';
import Tesseract from 'tesseract.js';

// API Base URL
const API_URL = 'http://localhost:3000/api';

// Categories List
const CATEGORIES = [
  'Food & Dining',
  'Shopping & Groceries',
  'Utilities',
  'Transportation & Travel',
  'Entertainment',
  'Medical & Health',
  'Credit Card Payment',
  'Transfers & Salary',
  'Fees & Taxes',
  'Others'
];

// Indonesian Banks List
const INDONESIAN_BANKS = [
  'BCA',
  'Mandiri',
  'BNI',
  'BRI',
  'CIMB Niaga',
  'Danamon',
  'Permata',
  'OCBC NISP',
  'Maybank',
  'Mega',
  'BTPN / Jenius',
  'BTN',
  'Panin',
  'BSI (Bank Syariah Indonesia)',
  'Bank Jago',
  'Allo Bank',
  'SeaBank',
  'blu by BCA Digital',
  'Bank Neo Commerce',
  'Commonwealth',
  'UOB',
  'HSBC',
  'KB Bukopin',
  'Other / Custom'
];

// Helper to format currency in IDR (Indonesian Rupiah)
const formatIDR = (value: number) => {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absValue);
  
  return isNegative ? `-${formatted}` : formatted;
};

// Inline SVG Icons
const Icons = {
  Dashboard: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  Accounts: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  Import: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  Budget: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Installment: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Plus: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  Delete: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Alert: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Lock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  Scan: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Ledger: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  AI: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Settings: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
};

interface AutocompleteInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChangeValue: (val: string) => void;
  suggestions: string[];
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChangeValue,
  suggestions,
  style,
  className,
  placeholder,
  ...rest
}) => {
  const [suggestion, setSuggestion] = useState('');

  // Find suggestion that starts with value (case-insensitive)
  useEffect(() => {
    if (!value || value.trim() === '') {
      setSuggestion('');
      return;
    }
    const match = suggestions.find(s => 
      s && s.toLowerCase().startsWith(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
    );
    setSuggestion(match || '');
  }, [value, suggestions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && suggestion) {
      e.preventDefault();
      onChangeValue(suggestion);
      setSuggestion('');
    }
    if (rest.onKeyDown) {
      rest.onKeyDown(e);
    }
  };

  // Extract ghost text part
  const ghostText = suggestion && suggestion.toLowerCase().startsWith(value.toLowerCase())
    ? suggestion.slice(value.length)
    : '';

  return (
    <div style={{ position: 'relative', width: style?.width || '100%', display: 'inline-block' }}>
      {/* Ghost text display layer */}
      {ghostText && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            padding: style?.padding || '0.45rem 0.75rem',
            fontSize: style?.fontSize || '0.85rem',
            fontFamily: 'inherit',
            pointerEvents: 'none',
            whiteSpace: 'pre',
            width: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          <span style={{ color: 'transparent' }}>{value}</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.35)' }}>{ghostText}</span>
        </div>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          ...style,
          background: 'transparent',
          position: 'relative',
          zIndex: 2
        }}
        className={className}
        placeholder={placeholder}
        {...rest}
      />
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'budgets' | 'liabilities' | 'goals' | 'investments' | 'transactions' | 'ai' | 'settings'>('dashboard');
  const [transactionSubTab, setTransactionSubTab] = useState<'ledger' | 'import' | 'ocr'>('ledger');
  const [liabilitiesSubTab, setLiabilitiesSubTab] = useState<'overview' | 'installments' | 'loans'>('overview');
  const [navOpen, setNavOpen] = useState(false);
  
  // Future Goals States
  const [goals, setGoals] = useState<any[]>([]);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTargetAmount, setNewGoalTargetAmount] = useState('');
  const [newGoalCurrentSavings, setNewGoalCurrentSavings] = useState('');
  const [newGoalTargetDate, setNewGoalTargetDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 6, 1).toISOString().split('T')[0]);
  const [newGoalRecurrence, setNewGoalRecurrence] = useState<'one-time' | 'monthly' | 'semester' | 'yearly'>('one-time');
  const [newGoalCategory, setNewGoalCategory] = useState('education');
  const [savingsAdjustGoal, setSavingsAdjustGoal] = useState<any | null>(null);
  const [savingsAdjustAmount, setSavingsAdjustAmount] = useState('');
  
  // Data States
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [projections, setProjections] = useState<any[]>([]);
  const [savedPasswords, setSavedPasswords] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCatParentId, setNewCatParentId] = useState('');
  
  // Debts and Receivables States
  const [debtsReceivables, setDebtsReceivables] = useState<any[]>([]);
  const [loadingDR, setLoadingDR] = useState(false);
  const [showAddDRModal, setShowAddDRModal] = useState(false);
  const [payingDR, setPayingDR] = useState<any | null>(null);
  const [viewDRDetails, setViewDRDetails] = useState<any | null>(null);

  // Add DR form states
  const [drType, setDrType] = useState<'debt' | 'receivable'>('debt');
  const [drPerson, setDrPerson] = useState('');
  const [drAmount, setDrAmount] = useState('');
  const [drDescription, setDrDescription] = useState('');
  const [drDate, setDrDate] = useState(new Date().toISOString().split('T')[0]);
  const [drDueDate, setDrDueDate] = useState('');
  const [drAccountId, setDrAccountId] = useState('');

  // Repayment form states
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payAccountId, setPayAccountId] = useState('');
  const [payNote, setPayNote] = useState('');

  // ── Investments States ──────────────────────────────────────────────────
  const [investments, setInvestments] = useState<any[]>([]);
  const [loadingInvestments, setLoadingInvestments] = useState(false);
  const [showAddInvestmentModal, setShowAddInvestmentModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<any | null>(null);
  const [showAddInvTxModal, setShowAddInvTxModal] = useState(false);
  const [addInvTxTarget, setAddInvTxTarget] = useState<any | null>(null);
  const [showPriceUpdateModal, setShowPriceUpdateModal] = useState(false);
  const [priceUpdateTarget, setPriceUpdateTarget] = useState<any | null>(null);

  // Add/Edit Investment form
  const [invName, setInvName] = useState('');
  const [invType, setInvType] = useState<'gold' | 'stock' | 'mutual_fund' | 'crypto' | 'property' | 'deposit' | 'bond' | 'other'>('gold');
  const [invPlatform, setInvPlatform] = useState('');
  const [invUnit, setInvUnit] = useState('');
  const [invCurrentUnits, setInvCurrentUnits] = useState('');
  const [invCurrentPrice, setInvCurrentPrice] = useState('');
  const [invTotalInvested, setInvTotalInvested] = useState('');
  const [invAccountId, setInvAccountId] = useState('');
  const [invNotes, setInvNotes] = useState('');

  // Add Transaction form
  const [invTxType, setInvTxType] = useState<'buy' | 'sell' | 'dividend' | 'price_update'>('buy');
  const [invTxDate, setInvTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [invTxUnits, setInvTxUnits] = useState('');
  const [invTxPrice, setInvTxPrice] = useState('');
  const [invTxAmount, setInvTxAmount] = useState('');
  const [invTxFee, setInvTxFee] = useState('');
  const [invTxAccountId, setInvTxAccountId] = useState('');
  const [invTxNotes, setInvTxNotes] = useState('');

  // Price update form
  const [priceUpdateValue, setPriceUpdateValue] = useState('');
  
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

  // Dynamic Year-Month state
  const currentMonthYear = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedBudgetMonth, setSelectedBudgetMonth] = useState(currentMonthYear);
  const [budgetType, setBudgetType] = useState<'expense' | 'income'>('expense');
  const [budgetViewPeriod, setBudgetViewPeriod] = useState<'monthly' | 'quarterly' | 'semesterly' | 'yearly'>('monthly');
  const [isAddBudgetModalOpen, setIsAddBudgetModalOpen] = useState(false);
  const [selectedBudgetYear, setSelectedBudgetYear] = useState(new Date().getFullYear());
  const [budgetStartYear, setBudgetStartYear] = useState(new Date().getFullYear());
  const [budgetEndYear, setBudgetEndYear] = useState(new Date().getFullYear());
  
  // Range & Recurrence States
  const [budgetStartDate, setBudgetStartDate] = useState('');
  const [budgetEndDate, setBudgetEndDate] = useState('');
  const [budgetRecurrence, setBudgetRecurrence] = useState<'monthly' | 'weekly' | 'none'>('monthly');
  const [budgetRecurrenceDay, setBudgetRecurrenceDay] = useState('1'); // Date (1-31) or Day of week (1-7)

  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingBudgetAmount, setEditingBudgetAmount] = useState('');
  const [editingBudgetCategory, setEditingBudgetCategory] = useState('');
  const [editingBudgetStartDate, setEditingBudgetStartDate] = useState('');
  const [editingBudgetEndDate, setEditingBudgetEndDate] = useState('');
  const [editingBudgetRecurrence, setEditingBudgetRecurrence] = useState<'monthly' | 'weekly' | 'none'>('monthly');
  const [editingBudgetRecurrenceDay, setEditingBudgetRecurrenceDay] = useState('1');
  const [budgetTxModal, setBudgetTxModal] = useState<{ budget: any; transactions: any[]; loading: boolean; dateRange: string } | null>(null);

  // Transaction Ledger Filters
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [filterAccountId, setFilterAccountId] = useState('All');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

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
      
      return true;
    });

    let income = 0;
    let expense = 0;
    
    list.forEach(tx => {
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
  }, [transactions, filterAccountId, filterPeriod, filterStartDate, filterEndDate, filterSearchQuery, filterCategory]);

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

  // (Dashboard filter states removed — new dashboard is a static wealth summary)



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

  // Edit Transaction States
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [editTxAccountId, setEditTxAccountId] = useState('');
  const [editTxDate, setEditTxDate] = useState('');
  const [editTxBookingDate, setEditTxBookingDate] = useState('');
  const [editTxType, setEditTxType] = useState<'income' | 'expense'>('expense');
  const [editTxCategory, setEditTxCategory] = useState('');
  const [editTxDesc, setEditTxDesc] = useState('');
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxNote, setEditTxNote] = useState('');
  const [editTxLocationMerchant, setEditTxLocationMerchant] = useState('');
  const [editTxProductService, setEditTxProductService] = useState('');
  const [editTxDebtReceivableId, setEditTxDebtReceivableId] = useState('');

  // Bulk Edit States
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [bulkEditCategory, setBulkEditCategory] = useState('');
  const [bulkEditLocation, setBulkEditLocation] = useState('');
  const [bulkEditProduct, setBulkEditProduct] = useState('');

  // Reconciliation States
  const [reconcilingAcc, setReconcilingAcc] = useState<any | null>(null);
  const [reconcileTargetBalance, setReconcileTargetBalance] = useState('');
  const [reconcileDate, setReconcileDate] = useState(new Date().toISOString().split('T')[0]);
  const [reconcileNote, setReconcileNote] = useState('Penyesuaian Saldo (Reconciliation)');

  // Privacy Mode State (blur = strict blur, hover = display on hover, visible = show all)
  const [privacyMode, setPrivacyMode] = useState<'blur' | 'hover' | 'visible'>(() => {
    const saved = localStorage.getItem('pfm_privacy_mode');
    return (saved as 'blur' | 'hover' | 'visible') || 'blur';
  });

  const cyclePrivacyMode = () => {
    setPrivacyMode(prev => {
      let next: 'blur' | 'hover' | 'visible' = 'blur';
      if (prev === 'blur') next = 'hover';
      else if (prev === 'hover') next = 'visible';
      else next = 'blur';
      localStorage.setItem('pfm_privacy_mode', next);
      return next;
    });
  };

  const renderAmount = (value: number) => {
    const text = formatIDR(value);
    const privacyClass = privacyMode === 'blur' ? 'privacy-strict' : privacyMode === 'hover' ? 'privacy-hover' : '';
    return <span className={privacyClass}>{text}</span>;
  };


  // 1. Fetch all essential data
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const accRes = await fetch(`${API_URL}/accounts`);
      const accountsData = await accRes.json();
      setAccounts(accountsData);

      const txRes = await fetch(`${API_URL}/transactions`);
      const txData = await txRes.json();
      setTransactions(txData);

      const instRes = await fetch(`${API_URL}/installments`);
      const instData = await instRes.json();
      setInstallments(instData);

      const projRes = await fetch(`${API_URL}/credit-cards/projection`);
      const projData = await projRes.json();
      setProjections(projData);

      const passRes = await fetch(`${API_URL}/pdf/passwords`);
      const passData = await passRes.json();
      setSavedPasswords(passData);

      const catRes = await fetch(`${API_URL}/categories`);
      const catData = await catRes.json();
      setDbCategories(catData);

      // fetch budgets with period and year parameters
      const bRes = await fetch(`${API_URL}/budgets?month_year=${selectedBudgetMonth}&period=${budgetViewPeriod}&year=${selectedBudgetYear}&start_year=${budgetStartYear}&end_year=${budgetEndYear}`);
      const bData = await bRes.json();
      setBudgets(bData);

      // fetch AI configuration
      const aiConfRes = await fetch(`${API_URL}/ai/config`);
      if (aiConfRes.ok) {
        const aiConf = await aiConfRes.json();
        setAiProvider(aiConf.provider || 'gemini');
        setAiApiKey(aiConf.api_key || '');
        setAiModelName(aiConf.model_name || '');
        setAiBaseUrl(aiConf.base_url || '');
      }

      // fetch Import Logs
      const logsRes = await fetch(`${API_URL}/import/logs`);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setImportLogs(logsData);
      }

      // fetch Debts & Receivables
      await fetchDebtsReceivables();

      // fetch Future Goals
      await fetchGoals();

      // fetch Investments
      await fetchInvestments();
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

  const resetInvestmentForm = () => {
    setInvName(''); setInvType('gold'); setInvPlatform(''); setInvUnit('');
    setInvCurrentUnits(''); setInvCurrentPrice(''); setInvTotalInvested('');
    setInvAccountId(''); setInvNotes('');
  };

  const handleSaveInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        name: invName,
        type: invType,
        platform: invPlatform || null,
        unit: invUnit || null,
        current_units: parseFloat(invCurrentUnits) || 0,
        current_price_per_unit: parseFloat(invCurrentPrice) || 0,
        total_invested: parseFloat(invTotalInvested) || 0,
        account_id: invAccountId || null,
        notes: invNotes || null,
      };
      const url = editingInvestment ? `${API_URL}/investments/${editingInvestment.id}` : `${API_URL}/investments`;
      const method = editingInvestment ? 'PUT' : 'POST';
      const res = await fetch(url, { 
        method, 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body) 
      });
      if (res.ok) {
        await fetchInvestments();
        setShowAddInvestmentModal(false);
        setEditingInvestment(null);
        resetInvestmentForm();
      } else {
        const errJson = await res.json();
        alert(`Gagal menyimpan aset: ${errJson.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Gagal menghubungkan ke server: ${err.message}`);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    if (!confirm('Hapus aset investasi ini beserta semua transaksinya?')) return;
    await fetch(`${API_URL}/investments/${id}`, { method: 'DELETE' });
    await fetchInvestments();
  };

  const resetInvTxForm = () => {
    setInvTxType('buy'); setInvTxDate(new Date().toISOString().split('T')[0]);
    setInvTxUnits(''); setInvTxPrice(''); setInvTxAmount(''); setInvTxFee('');
    setInvTxAccountId(''); setInvTxNotes('');
  };

  const handleAddInvTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInvTxTarget) return;
    try {
      const body = {
        type: invTxType,
        date: invTxDate,
        units: parseFloat(invTxUnits) || 0,
        price_per_unit: parseFloat(invTxPrice) || 0,
        amount: parseFloat(invTxAmount) || 0,
        fee: parseFloat(invTxFee) || 0,
        linked_account_id: invTxAccountId || null,
        notes: invTxNotes || null,
      };
      const res = await fetch(`${API_URL}/investments/${addInvTxTarget.id}/transactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (res.ok) {
        await fetchInvestments();
        setShowAddInvTxModal(false);
        setAddInvTxTarget(null);
        resetInvTxForm();
      } else {
        const errJson = await res.json();
        alert(`Gagal mencatat transaksi: ${errJson.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Gagal menghubungkan ke server: ${err.message}`);
    }
  };

  const handlePriceUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceUpdateTarget) return;
    const newPrice = parseFloat(priceUpdateValue);
    if (isNaN(newPrice) || newPrice <= 0) {
      alert('Masukkan harga terbaru yang valid dan lebih besar dari 0');
      return;
    }
    try {
      // Update investment directly
      const body = { current_price_per_unit: newPrice };
      const res = await fetch(`${API_URL}/investments/${priceUpdateTarget.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (res.ok) {
        await fetchInvestments();
        setShowPriceUpdateModal(false);
        setPriceUpdateTarget(null);
        setPriceUpdateValue('');
      } else {
        const errJson = await res.json();
        alert(`Gagal mengupdate harga: ${errJson.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Gagal menghubungkan ke server: ${err.message}`);
    }
  };

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

  const handleCreateDR = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/debts-receivables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: drType,
          person: drPerson,
          amount: parseFloat(drAmount),
          description: drDescription,
          date: drDate,
          due_date: drDueDate || null,
          account_id: drAccountId || null
        })
      });

      if (res.ok) {
        setShowAddDRModal(false);
        // Reset form
        setDrPerson('');
        setDrAmount('');
        setDrDescription('');
        setDrDate(new Date().toISOString().split('T')[0]);
        setDrDueDate('');
        setDrAccountId('');
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create debt/receivable');
      }
    } catch (error: any) {
      alert('Error creating debt/receivable: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayDR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingDR) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/debts-receivables/${payingDR.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          date: payDate,
          account_id: payAccountId,
          note: payNote
        })
      });

      if (res.ok) {
        setPayingDR(null);
        // Reset form
        setPayAmount('');
        setPayDate(new Date().toISOString().split('T')[0]);
        setPayAccountId('');
        setPayNote('');
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to submit payment');
      }
    } catch (error: any) {
      alert('Error submitting payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDR = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan hutang/piutang ini? Transaksi mutasi bank yang terhubung pada ledger juga akan ikut terhapus.')) {
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/debts-receivables/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        if (viewDRDetails?.id === id) {
          setViewDRDetails(null);
        }
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete record');
      }
    } catch (error: any) {
      alert('Error deleting record: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBudgetMonth, budgetViewPeriod, selectedBudgetYear, budgetStartYear, budgetEndYear]);

  // Calculated Values
  const totals = useMemo(() => {
    let totalCash = 0;
    let totalCcDebt = 0;
    let totalInstallmentDebt = 0;

    accounts.forEach(a => {
      if (a.type === 'bank') {
        totalCash += a.current_balance;
      } else {
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

  // Account creation form
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'bank' | 'credit_card' | 'cash'>('bank');
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

  // Filter categories dynamically for budget setup (based on budgetType)
  const filteredCategoriesForBudget = useMemo(() => {
    const result: typeof groupedCategories = [];
    groupedCategories.forEach(group => {
      const parentMatch = group.parent.type === 'both' || group.parent.type === budgetType;
      const matchedSubs = group.subs.filter(sub => sub.type === 'both' || sub.type === budgetType);
      
      if (parentMatch || matchedSubs.length > 0) {
        result.push({
          parent: group.parent,
          subs: matchedSubs
        });
      }
    });
    return result;
  }, [groupedCategories, budgetType]);



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

  const handleStartEditTransaction = (tx: any) => {
    setEditingTx(tx);
    setEditTxAccountId(tx.account_id);
    setEditTxDate(tx.date);
    setEditTxBookingDate(tx.booking_date || tx.date);
    setEditTxType(tx.amount >= 0 ? 'income' : 'expense');
    setEditTxDesc(tx.description);
    setEditTxAmount(String(Math.abs(tx.amount)));
    setEditTxCategory(tx.category);
    setEditTxNote(tx.note || '');
    setEditTxLocationMerchant(tx.location_merchant || '');
    setEditTxProductService(tx.product_service || '');
    setEditTxDebtReceivableId(tx.debt_receivable_id || '');
  };

  const handleSaveEditedTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editTxAccountId || !editTxDesc || !editTxAmount || !editTxCategory) return;

    setLoading(true);
    try {
      const val = parseFloat(editTxAmount);
      const amountValue = editTxType === 'income' ? val : -val;

      const res = await fetch(`${API_URL}/transactions/${editingTx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: editTxAccountId,
          date: editTxDate,
          booking_date: editTxBookingDate || editTxDate,
          description: editTxDesc,
          amount: amountValue,
          category: editTxCategory,
          note: editTxNote || null,
          location_merchant: editTxLocationMerchant || null,
          product_service: editTxProductService || null,
          debt_receivable_id: editTxDebtReceivableId || null
        })
      });

      if (res.ok) {
        setEditingTx(null);
        fetchData();
        // Refresh budget modal transaction list if it's open
        if (budgetTxModal) {
          const params = new URLSearchParams({ category: budgetTxModal.budget.category, start_date: budgetTxModal.dateRange.split(' s/d ')[0], end_date: budgetTxModal.dateRange.split(' s/d ')[1] });
          fetch(`${API_URL}/transactions?${params}`)
            .then(r => r.json())
            .then(data => setBudgetTxModal(prev => prev ? { ...prev, transactions: data } : null))
            .catch(console.error);
        }
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Failed to update transaction');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error updating transaction: ' + err.message);
    } finally {
      setLoading(false);
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

  const handleGenerateAiAnalysis = async () => {
    setAiLoading(true);
    setAiAnalysis('');
    try {
      const res = await fetch(`${API_URL}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data.analysis);
      } else {
        const errJ = await res.json();
        alert(errJ.error || 'AI analysis failed.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error during AI analysis: ' + err.message);
    } finally {
      setAiLoading(false);
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
        setActiveTab('dashboard');
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

  // Budget setup form
  const [budgetCategory, setBudgetCategory] = useState(CATEGORIES[0]);
  const [budgetAmount, setBudgetAmount] = useState('');

  // Automatically update selected category when filtered categories list changes
  useEffect(() => {
    if (filteredCategoriesForBudget.length > 0) {
      const firstGroup = filteredCategoriesForBudget[0];
      if (firstGroup.subs.length > 0) {
        setBudgetCategory(firstGroup.subs[0].name);
      } else {
        setBudgetCategory(firstGroup.parent.name);
      }
    }
  }, [filteredCategoriesForBudget]);

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetAmount) return;

    // Dynamically calculate month_year from start_date if available
    let targetMonthYear = selectedBudgetMonth;
    if (budgetStartDate) {
      const [y, m] = budgetStartDate.split('-');
      if (y && m) {
        targetMonthYear = `${y}-${m}`;
      }
    }

    try {
      const res = await fetch(`${API_URL}/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: budgetCategory,
          amount: parseFloat(budgetAmount),
          month_year: targetMonthYear,
          start_date: budgetStartDate || null,
          end_date: budgetEndDate || null,
          recurrence: budgetRecurrence,
          recurrence_day: budgetRecurrenceDay ? parseInt(budgetRecurrenceDay) : null
        })
      });
      if (res.ok) {
        setBudgetAmount('');
        setBudgetStartDate('');
        setBudgetEndDate('');
        setBudgetRecurrence('monthly');
        setBudgetRecurrenceDay('1');
        setIsAddBudgetModalOpen(false);
        fetchData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Gagal menyimpan anggaran.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditBudget = (budget: any) => {
    setEditingBudgetId(budget.id);
    setEditingBudgetAmount(String(budget.amount));
    setEditingBudgetCategory(budget.category);
    setEditingBudgetStartDate(budget.start_date || '');
    setEditingBudgetEndDate(budget.end_date || '');
    setEditingBudgetRecurrence(budget.recurrence || 'monthly');
    setEditingBudgetRecurrenceDay(budget.recurrence_day !== null && budget.recurrence_day !== undefined ? String(budget.recurrence_day) : '1');
  };

  const handleSaveEditedBudget = async (budget: any) => {
    if (!editingBudgetAmount || isNaN(parseFloat(editingBudgetAmount)) || !editingBudgetCategory) return;
    try {
      const res = await fetch(`${API_URL}/budgets/${budget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editingBudgetCategory,
          amount: parseFloat(editingBudgetAmount),
          start_date: editingBudgetStartDate || null,
          end_date: editingBudgetEndDate || null,
          recurrence: editingBudgetRecurrence,
          recurrence_day: editingBudgetRecurrenceDay ? parseInt(editingBudgetRecurrenceDay) : null
        })
      });
      if (res.ok) {
        setEditingBudgetId(null);
        setEditingBudgetAmount('');
        setEditingBudgetCategory('');
        setEditingBudgetStartDate('');
        setEditingBudgetEndDate('');
        setEditingBudgetRecurrence('monthly');
        setEditingBudgetRecurrenceDay('1');
        fetchData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Gagal menyimpan perubahan anggaran.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan saat memperbarui anggaran.');
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus anggaran ini?')) return;
    try {
      const params = new URLSearchParams({
        period: budgetViewPeriod,
        month_year: selectedBudgetMonth,
        ...(budgetViewPeriod === 'yearly' ? { year: String(selectedBudgetYear) } : {})
      });
      const res = await fetch(`${API_URL}/budgets/${budgetId}?${params}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menghapus anggaran');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewBudgetTransactions = async (budget: any) => {
    // Compute date range based on current period view
    const [yearStr, monthStr] = selectedBudgetMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    let startDate: string;
    let endDate: string;

    if (budgetViewPeriod === 'yearly') {
      startDate = `${selectedBudgetYear}-01-01`;
      endDate = `${selectedBudgetYear}-12-31`;
    } else if (budgetViewPeriod === 'quarterly') {
      const q = Math.ceil(month / 3);
      const sm = (q - 1) * 3 + 1;
      const em = q * 3;
      startDate = `${year}-${String(sm).padStart(2, '0')}-01`;
      const lastDay = new Date(year, em, 0).getDate();
      endDate = `${year}-${String(em).padStart(2, '0')}-${lastDay}`;
    } else if (budgetViewPeriod === 'semesterly') {
      const s = Math.ceil(month / 6);
      const sm = (s - 1) * 6 + 1;
      const em = s * 6;
      startDate = `${year}-${String(sm).padStart(2, '0')}-01`;
      const lastDay = new Date(year, em, 0).getDate();
      endDate = `${year}-${String(em).padStart(2, '0')}-${lastDay}`;
    } else {
      // monthly
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    }

    const dateRange = `${startDate} s/d ${endDate}`;
    setBudgetTxModal({ budget, transactions: [], loading: true, dateRange });

    try {
      const params = new URLSearchParams({ category: budget.category, start_date: startDate, end_date: endDate });
      const res = await fetch(`${API_URL}/transactions?${params}`);
      const data = await res.json();
      setBudgetTxModal({ budget, transactions: data, loading: false, dateRange });
    } catch (err) {
      console.error(err);
      setBudgetTxModal(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  // Category management handlers
  const [newCatType, setNewCatType] = useState<'expense' | 'income' | 'both'>('expense');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryType, setEditingCategoryType] = useState<'expense' | 'income' | 'both'>('expense');
  const [editingCategoryParentId, setEditingCategoryParentId] = useState('');

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

  const handleEditCategory = async (id: string) => {
    if (!editingCategoryName.trim()) return;

    try {
      const res = await fetch(`${API_URL}/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingCategoryName.trim(),
          type: editingCategoryType,
          parent_id: editingCategoryParentId || null
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

  // PDF IMPORT STATES
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [currentParsingIndex, setCurrentParsingIndex] = useState(0);
  const [parsedTxList, setParsedTxList] = useState<any[]>([]);
  const [pdfPassword, setPdfPassword] = useState('');
  const [savePasswordCheckbox, setSavePasswordCheckbox] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [importLogs, setImportLogs] = useState<any[]>([]);
  
  // Password Locker State
  const [lockerBank, setLockerBank] = useState('BCA');
  const [customLockerBank, setCustomLockerBank] = useState('');
  
  // Stage 2 Verification Grid State
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [importTargetAccId, setImportTargetAccId] = useState('');

  // Split Transaction Modal States
  const [splittingTxIndex, setSplittingTxIndex] = useState<number | null>(null);
  const [splittingLedgerTx, setSplittingLedgerTx] = useState<any | null>(null);
  const [splitRows, setSplitRows] = useState<any[]>([]);

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

  // OCR SCANNER STATES
  const [, setOcrImageFile] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<string>('');
  const [ocrProgressPct, setOcrProgressPct] = useState<number>(0);
  const [ocrRawText, setOcrRawText] = useState<string>('');
  
  // OCR Form States (for edit/verification before saving)
  const [ocrFormAccId, setOcrFormAccId] = useState<string>('');
  const [ocrFormDate, setOcrFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ocrFormMerchant, setOcrFormMerchant] = useState<string>('');
  const [ocrFormAmount, setOcrFormAmount] = useState<string>('');
  const [ocrFormCategory, setOcrFormCategory] = useState<string>('Others');

  // OCR Text Extraction Parser Helper
  const parseReceiptText = (text: string) => {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    
    // Heuristic 1: Store/Merchant Name
    let merchant = 'Unknown Merchant';
    if (lines.length > 0) {
      const candidate = lines[0].replace(/[^a-zA-Z0-9\s&.-]/g, '').trim();
      if (candidate.length > 2) {
        merchant = candidate;
      } else if (lines.length > 1) {
        const candidate2 = lines[1].replace(/[^a-zA-Z0-9\s&.-]/g, '').trim();
        if (candidate2.length > 2) merchant = candidate2;
      }
    }
    
    // Heuristic 2: Total Amount
    let amount = 0;
    const allNumbers: number[] = [];
    
    lines.forEach(line => {
      if (/total|grand|bayar|netto|amount|rp|idr|subtotal/i.test(line)) {
        const match = line.match(/([\d.,\s]+)/);
        if (match) {
          const cleaned = match[0].replace(/[^\d]/g, '');
          const val = parseInt(cleaned, 10);
          if (val > 100 && val < 100000000) {
            allNumbers.push(val);
          }
        }
      }
    });

    if (allNumbers.length === 0) {
      lines.forEach(line => {
        const matches = line.match(/\b\d{1,3}(?:[.,]\d{3})+\b/g) || line.match(/\b\d{4,9}\b/g);
        if (matches) {
          matches.forEach(m => {
            const cleaned = m.replace(/[^\d]/g, '');
            const val = parseInt(cleaned, 10);
            if (val > 100 && val < 100000000) {
              allNumbers.push(val);
            }
          });
        }
      });
    }

    if (allNumbers.length > 0) {
      allNumbers.sort((a, b) => b - a);
      amount = allNumbers[0];
    }
    
    // Heuristic 3: Transaction Date
    let dateStr = new Date().toISOString().split('T')[0];
    const dateRegex = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/;
    const dateRegex2 = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/;
    
    for (const line of lines) {
      let m = line.match(dateRegex);
      if (m) {
        let day = m[1].padStart(2, '0');
        let month = m[2].padStart(2, '0');
        let year = m[3];
        if (parseInt(month) <= 12 && parseInt(day) <= 31) {
          dateStr = `${year}-${month}-${day}`;
          break;
        }
      }
      m = line.match(dateRegex2);
      if (m) {
        dateStr = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        break;
      }
    }

    // Heuristic 4: Category mapping
    let category = 'Others';
    const textLower = text.toLowerCase();
    if (textLower.includes('kopi') || textLower.includes('coffee') || textLower.includes('resto') || textLower.includes('cafe') || textLower.includes('food') || textLower.includes('makan') || textLower.includes('bakery') || textLower.includes('starbucks')) {
      category = 'Food & Dining';
    } else if (textLower.includes('baju') || textLower.includes('kaos') || textLower.includes('cell') || textLower.includes('mall') || textLower.includes('fashion') || textLower.includes('indomaret') || textLower.includes('alfamart') || textLower.includes('supermarket')) {
      category = 'Shopping & Groceries';
    } else if (textLower.includes('bensin') || textLower.includes('pertamina') || textLower.includes('grab') || textLower.includes('gojek') || textLower.includes('taxi') || textLower.includes('travel') || textLower.includes('tiket')) {
      category = 'Transportation & Travel';
    } else if (textLower.includes('apotek') || textLower.includes('obat') || textLower.includes('farmasi') || textLower.includes('doctor') || textLower.includes('clinic') || textLower.includes('sehat')) {
      category = 'Medical & Health';
    } else if (textLower.includes('bioskop') || textLower.includes('cinema') || textLower.includes('game') || textLower.includes('movie')) {
      category = 'Entertainment';
    }

    return { merchant, amount: amount > 0 ? String(amount) : '', date: dateStr, category };
  };

  const handleOcrScan = async (file: File) => {
    setOcrImageFile(file);
    setOcrPreviewUrl(URL.createObjectURL(file));
    setOcrProgress('Initializing OCR Engine...');
    setOcrProgressPct(10);
    setOcrRawText('');

    try {
      const result = await Tesseract.recognize(
        file,
        'eng', // load English language by default for fast in-browser scanning
        {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              setOcrProgress('Scanning receipt screenshot...');
              setOcrProgressPct(Math.round(20 + m.progress * 70));
            }
          }
        }
      );

      const rawText = result.data.text;
      setOcrRawText(rawText);
      setOcrProgressPct(100);
      setOcrProgress('Scan completed successfully!');

      const parsed = parseReceiptText(rawText);
      setOcrFormMerchant(parsed.merchant);
      setOcrFormAmount(parsed.amount);
      setOcrFormDate(parsed.date);
      
      const bestCat = dbCategories.find(c => c.name.toLowerCase() === parsed.category.toLowerCase())?.name || parsed.category;
      setOcrFormCategory(bestCat);

      if (accounts.length > 0 && !ocrFormAccId) {
        setOcrFormAccId(accounts[0].id);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg('Receipt OCR scan failed: ' + err.message);
      setOcrProgress('Error occurred during scanning.');
    }
  };

  const handleSaveOcrTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocrFormAccId || !ocrFormMerchant || !ocrFormAmount || !ocrFormDate) return;

    try {
      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: ocrFormAccId,
          date: ocrFormDate,
          description: `Receipt: ${ocrFormMerchant}`,
          amount: -parseFloat(ocrFormAmount),
          category: ocrFormCategory
        })
      });

      if (res.ok) {
        setOcrImageFile(null);
        setOcrPreviewUrl('');
        setOcrRawText('');
        setOcrFormMerchant('');
        setOcrFormAmount('');
        setOcrProgress('');
        setOcrProgressPct(0);
        setActiveTab('dashboard');
        fetchData();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Failed to save receipt transaction');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const processBatch = async (files: File[], index: number, accumulatedTx: any[], passwordVal = '', accumulatedInstallments: any[] = [], maxCreditLimit: number | null = null) => {
    if (index >= files.length) {
      setLoading(false);
      setPdfPassword('');
      setPasswordRequired(false);
      setParsedData({
        bankName: files.length > 0 ? 'Multiple' : 'Unknown',
        statementType: 'Statement Batch',
        transactionCount: accumulatedTx.length,
        transactions: accumulatedTx,
        detectedInstallments: accumulatedInstallments,
        creditLimit: maxCreditLimit
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

      processBatch(files, index + 1, nextAccumulated, '', nextInstallments, nextCreditLimit);
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

  const handleStartSplit = (index: number) => {
    if (!parsedData) return;
    const tx = parsedData.transactions[index];
    const amountVal = Math.abs(tx.amount);
    
    const half1 = Math.round(amountVal / 2);
    const half2 = amountVal - half1;
    
    setSplittingTxIndex(index);
    setSplitRows([
      {
        category: tx.category || 'Others',
        location_merchant: tx.location_merchant || '',
        product_service: tx.product_service || '',
        amount: String(half1),
        note: tx.note || ''
      },
      {
        category: tx.category || 'Others',
        location_merchant: tx.location_merchant || '',
        product_service: tx.product_service || '',
        amount: String(half2),
        note: tx.note || ''
      }
    ]);
  };

  const handleStartLedgerSplit = (tx: any) => {
    const amountVal = Math.abs(tx.amount);
    const half1 = Math.round(amountVal / 2);
    const half2 = amountVal - half1;
    
    setSplittingLedgerTx(tx);
    setSplitRows([
      {
        category: tx.category || 'Others',
        location_merchant: tx.location_merchant || '',
        product_service: tx.product_service || '',
        amount: String(half1),
        note: tx.note || ''
      },
      {
        category: tx.category || 'Others',
        location_merchant: tx.location_merchant || '',
        product_service: tx.product_service || '',
        amount: String(half2),
        note: tx.note || ''
      }
    ]);
  };

  const handleConfirmSplit = async () => {
    if (splittingTxIndex !== null && parsedData) {
      const tx = parsedData.transactions[splittingTxIndex];
      const isExpense = tx.amount < 0;
      
      const newTxs = splitRows.map((row) => {
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
      
      setParsedData({
        ...parsedData,
        transactions: updatedTransactions
      });
      
      setSplittingTxIndex(null);
      setSplitRows([]);
    } else if (splittingLedgerTx !== null) {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/transactions/${splittingLedgerTx.id}/split`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ splits: splitRows })
        });
        
        if (res.ok) {
          setSplittingLedgerTx(null);
          setSplitRows([]);
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
    }
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
          billing_cycle_date: parsedData.billingCycleDate,
          due_date: parsedData.dueDate
        })
      });

      if (res.ok) {
        setParsedData(null);
        setPdfFile(null);
        setPdfFiles([]);
        setParsedTxList([]);
        setActiveTab('dashboard');
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

  // Installment deletion
  const handleDeleteInstallment = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this installment agreement? This will not delete past transactions.')) return;
    try {
      const res = await fetch(`${API_URL}/installments/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Installment manually
  const [newInstCard, setNewInstCard] = useState('');
  const [newInstDesc, setNewInstDesc] = useState('');
  const [newInstAmount, setNewInstAmount] = useState('');
  const [newInstMonths, setNewInstMonths] = useState('');
  const [newInstDate, setNewInstDate] = useState(new Date().toISOString().split('T')[0]);

  const handleAddInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstCard || !newInstDesc || !newInstAmount || !newInstMonths) return;

    try {
      const res = await fetch(`${API_URL}/installments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: newInstCard,
          description: newInstDesc,
          monthly_amount: parseFloat(newInstAmount),
          total_months: parseInt(newInstMonths),
          start_date: newInstDate
        })
      });
      if (res.ok) {
        setNewInstDesc('');
        setNewInstAmount('');
        setNewInstMonths('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Tick installment month (reducing remaining months)
  const handleTickInstallment = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/installments/${id}/tick`, { method: 'POST' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
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
            onClick={() => setNavOpen(prev => !prev)}
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
            {pdfFiles.length > 1 && (
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Parsing statement ${currentParsingIndex + 1} of ${pdfFiles.length}... (${pdfFiles[currentParsingIndex]?.name})
              </span>
            )}
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

        {/* -------------------------------------------------------------
            TAB: TRANSACTIONS (with sub-tabs: Ledger | Import PDF | Scan Receipt)
            ------------------------------------------------------------- */}
        {activeTab === 'transactions' && (
          <div>
            {/* Sub-tab header */}
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

            {/* ── SUB-TAB: Ledger ── */}
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
                            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                              {tx.is_installment === 1 && (
                                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)', fontSize: '0.6rem', padding: '0.05rem 0.3rem' }}>
                                  INSTALLMENT
                                </span>
                              )}
                              {tx.category === 'Transfers & Salary' && tx.description.toLowerCase().includes('transfer') && (
                                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', fontSize: '0.6rem', padding: '0.05rem 0.3rem' }}>
                                  TRANSFER
                                </span>
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
                              onClick={() => handleStartEditTransaction(tx)}
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
      </div>
    )}

        {/* -------------------------------------------------------------
            TAB 1: DASHBOARD
            ------------------------------------------------------------- */}
        {activeTab === 'dashboard' && (() => {
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
                            onClick={() => setActiveTab('accounts')}>Tambah →</button>
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
                            onClick={() => setActiveTab('investments')}>Tambah →</button>
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
                          <Row key={d.id} label={d.person_name} value={renderAmount(d.remaining_amount)} color="var(--color-warning)" />
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
                          <Row key={d.id} label={d.person_name} value={renderAmount(d.remaining_amount)} color="var(--color-danger)" />
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
                            onClick={() => { setActiveTab(tab); setNavOpen(false); }}
                          >{label}</button>
                        ))}
                      </div>
                    </Panel>
                  </div>
                </div>
              </div>
            );
          })()}



        {/* -------------------------------------------------------------
            TAB 2: ACCOUNTS MANAGEMENT
            ------------------------------------------------------------- */}
        {activeTab === 'accounts' && (
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
                        <span className="badge" style={{ background: a.type === 'bank' ? 'rgba(16, 185, 129, 0.1)' : a.type === 'cash' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.1)', color: a.type === 'bank' ? 'var(--color-success)' : a.type === 'cash' ? 'var(--color-warning)' : 'var(--color-primary)', marginTop: '0.4rem' }}>
                          {a.type === 'bank' ? 'BANK ACCOUNT' : a.type === 'cash' ? 'CASH / WALLET' : 'CREDIT CARD'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => handleStartReconcile(a)}
                          title="Adjust Balance / Reconcile Account"
                        >
                          ⚖️ Reconcile
                        </button>
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
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: (a.type === 'bank' || a.type === 'cash') ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {renderAmount(a.current_balance)}
                        </div>
                      </div>

                      {(a.type === 'bank' || a.type === 'cash') ? (
                        <div className="widget-item">
                          <div className="card-desc">Initial Balance</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                            {renderAmount(a.balance)}
                          </div>
                        </div>
                      ) : (
                        <div className="widget-item">
                          <div className="card-desc">Available Credit Limit</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                            {renderAmount(Math.floor(((a.credit_limit || 0) + a.current_balance - (a.installment_debt || 0)) / 100) * 100)}
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
                          <span style={{ color: 'var(--color-text-muted)' }}>Installment Debt:</span> <strong className="text-warning">{renderAmount(a.installment_debt)}</strong>
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
                  </select>
                </div>

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
                ) : (
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
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                  <Icons.Plus /> Register Account
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Import PDF sub-tab (part of Transactions) */}
        {activeTab === 'transactions' && transactionSubTab === 'import' && (
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
                      onClick={() => setActiveTab('accounts')}
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
        )}

        {/* Scan Receipt sub-tab (part of Transactions) */}
        {activeTab === 'transactions' && transactionSubTab === 'ocr' && (
          <div style={{ paddingTop: '0.5rem' }}><div className="grid-cols-2" style={{ gridTemplateColumns: '1.1fr 1.9fr', gap: '2rem' }}>
                {/* Left Column: Image upload & progress */}
                <div className="glass-panel card-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.5rem' }}>Receipt OCR Scanner</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      Upload a photo or screenshot of your shopping receipt. Our local OCR engine will read it and auto-fill the expense transaction details.
                    </p>
                  </div>

                  {/* Upload area */}
                  {!ocrPreviewUrl ? (
                    <div 
                      className="drag-drop-zone"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleOcrScan(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          if (e.target.files && e.target.files[0]) {
                            handleOcrScan(e.target.files[0]);
                          }
                        };
                        input.click();
                      }}
                      style={{ minHeight: '200px' }}
                    >
                      <div className="drag-icon">📷</div>
                      <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Upload Receipt Screenshot</strong>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>or drag & drop image here</span>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                      <img src={ocrPreviewUrl} alt="Receipt Preview" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '350px', objectFit: 'contain' }} />
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ position: 'absolute', top: '10px', right: '10px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'rgba(20,20,20,0.8)' }}
                        onClick={() => {
                          setOcrImageFile(null);
                          setOcrPreviewUrl('');
                          setOcrRawText('');
                          setOcrFormMerchant('');
                          setOcrFormAmount('');
                          setOcrProgress('');
                          setOcrProgressPct(0);
                        }}
                      >
                        Clear Image
                      </button>
                    </div>
                  )}

                  {/* Scanning progress */}
                  {ocrProgress && (
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        <strong>{ocrProgress}</strong>
                        <span className="text-primary">{ocrProgressPct}%</span>
                      </div>
                      <div className="progress-track" style={{ height: '6px' }}>
                        <div 
                          className="progress-fill success" 
                          style={{ width: `${ocrProgressPct}%`, transition: 'width 0.3s ease' }} 
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Verification Form & Raw Text */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {ocrPreviewUrl && (
                    <div className="glass-panel card-content">
                      <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--color-success)' }}>✓</span> Verify Extracted Expense
                      </h3>

                      <form onSubmit={handleSaveOcrTransaction}>
                        <div className="form-group">
                          <label>Charge to Account / Card</label>
                          <select 
                            className="form-control"
                            value={ocrFormAccId}
                            onChange={(e) => setOcrFormAccId(e.target.value)}
                            required
                          >
                            <option value="">-- Choose Account --</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>{a.name} ({a.type === 'bank' ? 'Bank' : a.type === 'cash' ? 'Cash' : 'CC'})</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid-cols-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', margin: 0, gap: '1rem' }}>
                          <div className="form-group">
                            <label>Merchant / Store Name</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              placeholder="Store Name"
                              value={ocrFormMerchant}
                              onChange={(e) => setOcrFormMerchant(e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Transaction Date</label>
                            <input 
                              type="date" 
                              className="form-control" 
                              value={ocrFormDate}
                              onChange={(e) => setOcrFormDate(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div className="grid-cols-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', margin: 0, gap: '1rem' }}>
                          <div className="form-group">
                            <label>Total Expense Amount (IDR)</label>
                            <input 
                              type="number" 
                              className="form-control" 
                              placeholder="Amount in IDR"
                              value={ocrFormAmount}
                              onChange={(e) => setOcrFormAmount(e.target.value)}
                              style={{ fontWeight: 700, color: 'var(--color-danger)' }}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Category</label>
                            <select 
                              className="form-control"
                              value={ocrFormCategory}
                              onChange={(e) => setOcrFormCategory(e.target.value)}
                              required
                            >
                              {filteredCategoriesForBudget.map(group => (
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

                        <button 
                          type="submit" 
                          className="btn btn-primary" 
                          style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', marginTop: '1rem' }}
                          disabled={loading || !ocrFormAccId}
                        >
                          Save Scanned Expense Transaction
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Raw Extracted Text Reference Panel */}
                  {ocrRawText && (
                    <div className="glass-panel card-content">
                      <h4 style={{ marginBottom: '0.75rem', color: 'var(--color-text-muted)' }}>Raw Extracted Receipt Text</h4>
                      <pre style={{ 
                        whiteSpace: 'pre-wrap', 
                        background: 'rgba(0,0,0,0.3)', 
                        padding: '1rem', 
                        borderRadius: '8px', 
                        fontSize: '0.8rem', 
                        maxHeight: '180px', 
                        overflowY: 'auto',
                        border: '1px solid var(--border-color)',
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)'
                      }}>
                        {ocrRawText}
                      </pre>
                    </div>
                  )}
                </div>
              </div></div>
        )}

        {/* -------------------------------------------------------------
            TAB 4: BUDGETS
            ------------------------------------------------------------- */}
        {activeTab === 'budgets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Pelacakan Anggaran / Budgeting</h2>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ height: '40px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                onClick={() => {
                  // Initialize start date convenience
                  if (selectedBudgetMonth) {
                    setBudgetStartDate(`${selectedBudgetMonth}-01`);
                  }
                  setIsAddBudgetModalOpen(true);
                }}
              >
                ➕ Tambah Anggaran Baru
              </button>
            </div>

            {/* Modal Overlay for Add Budget */}
            {/* Budget Transaction Detail Modal */}
            {budgetTxModal && (
              <div className="modal-overlay" onClick={() => setBudgetTxModal(null)}>
                <div className="modal-content glass-panel" style={{ maxWidth: '700px', width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexShrink: 0 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem' }}>📋 Transaksi: {budgetTxModal.budget.category}</h3>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{budgetTxModal.dateRange}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBudgetTxModal(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', lineHeight: 1 }}
                    >×</button>
                  </div>

                  {/* Summary bar */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1, minWidth: '120px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>Anggaran</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{renderAmount(budgetTxModal.budget.amount)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1, minWidth: '120px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>Terpakai</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: budgetTxModal.budget.spent > budgetTxModal.budget.amount ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {renderAmount(budgetTxModal.budget.spent)}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1, minWidth: '120px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>Jumlah Transaksi</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{budgetTxModal.loading ? '...' : budgetTxModal.transactions.length}</div>
                    </div>
                  </div>

                  {/* Transaction list */}
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {budgetTxModal.loading ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Memuat transaksi...</div>
                    ) : budgetTxModal.transactions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Tidak ada transaksi pada periode ini.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, background: 'var(--color-surface)' }}>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Tanggal</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Keterangan</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Akun</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-muted)' }}>Jumlah</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {budgetTxModal.transactions.map((tx: any) => (
                            <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{tx.date}</td>
                              <td style={{ padding: '0.5rem' }}>
                                <div>{tx.description}</div>
                                {tx.note && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{tx.note}</div>}
                              </td>
                              <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{tx.account_name}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: tx.amount >= 0 ? 'var(--color-income)' : 'var(--color-expense)', whiteSpace: 'nowrap' }}>
                                {renderAmount(tx.amount)}
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditTransaction(tx)}
                                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', cursor: 'pointer', padding: '0.15rem 0.4rem', borderRadius: '4px', whiteSpace: 'nowrap' }}
                                  title="Edit transaksi"
                                >
                                  ✏️ Edit
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

            {isAddBudgetModalOpen && (
              <div className="modal-overlay">
                <div className="modal-content glass-panel" style={{ maxWidth: '500px', width: '90%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>Atur Anggaran Baru</h3>
                    <button
                      type="button"
                      onClick={() => setIsAddBudgetModalOpen(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Selectors for Type, Range, and Recurrence */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', width: '120px' }}>Tipe Anggaran:</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          type="button"
                          className={`btn ${budgetType === 'expense' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => setBudgetType('expense')}
                        >
                          💸 Pengeluaran
                        </button>
                        <button 
                          type="button"
                          className={`btn ${budgetType === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => setBudgetType('income')}
                        >
                          💰 Pemasukan
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Mulai Tanggal:</label>
                        <input 
                          type="date" 
                          className="form-control" 
                          value={budgetStartDate}
                          onChange={(e) => setBudgetStartDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Sampai Tanggal:</label>
                        <input 
                          type="date" 
                          className="form-control" 
                          value={budgetEndDate}
                          onChange={(e) => setBudgetEndDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Frekuensi:</label>
                        <select
                          className="form-control"
                          value={budgetRecurrence}
                          onChange={(e) => setBudgetRecurrence(e.target.value as any)}
                        >
                          <option value="none">Satu Kali Saja</option>
                          <option value="monthly">Bulanan</option>
                          <option value="weekly">Mingguan</option>
                        </select>
                      </div>
                      {budgetRecurrence !== 'none' && (
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {budgetRecurrence === 'weekly' ? 'Hari Pengulangan:' : 'Tanggal Pengulangan:'}
                          </label>
                          <select
                            className="form-control"
                            value={budgetRecurrenceDay}
                            onChange={(e) => setBudgetRecurrenceDay(e.target.value)}
                          >
                            {budgetRecurrence === 'weekly' ? (
                              <>
                                <option value="1">Senin</option>
                                <option value="2">Selasa</option>
                                <option value="3">Rabu</option>
                                <option value="4">Kamis</option>
                                <option value="5">Jumat</option>
                                <option value="6">Sabtu</option>
                                <option value="7">Minggu</option>
                              </>
                            ) : (
                              Array.from({ length: 31 }, (_, idx) => (
                                <option key={idx + 1} value={idx + 1}>Tanggal {idx + 1}</option>
                              ))
                            )}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleAddBudget}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label>Pilih Kategori</label>
                      <select 
                        className="form-control"
                        value={budgetCategory}
                        onChange={(e) => setBudgetCategory(e.target.value)}
                      >
                        {filteredCategoriesForBudget.map(group => (
                          <optgroup key={group.parent.id} label={group.parent.name}>
                            <option value={group.parent.name}>{group.parent.name}</option>
                            {group.subs.map(sub => (
                              <option key={sub.id} value={sub.name}>↳ {sub.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label>Nominal Anggaran Bulanan (IDR)</label>
                      <input 
                        type="number" 
                        className="form-control"
                        placeholder="Contoh: 2000000"
                        value={budgetAmount}
                        onChange={(e) => setBudgetAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ height: '40px', padding: '0 1.5rem' }} 
                        onClick={() => setIsAddBudgetModalOpen(false)}
                      >
                        Batal
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ height: '40px', padding: '0 1.5rem' }}
                      >
                        Pasang Anggaran
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Right: Budgets Progress Bars */}
            <div className="glass-panel card-content">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <h3 style={{ margin: 0 }}>Progress Anggaran</h3>
                  
                  {/* Contextual Selector Controls */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Periode:</span>
                    <select
                      className="form-control"
                      style={{ width: '110px', padding: '0.3rem 0.5rem', margin: 0, height: '30px', fontSize: '0.8rem' }}
                      value={budgetViewPeriod}
                      onChange={(e) => setBudgetViewPeriod(e.target.value as any)}
                    >
                      <option value="monthly">Bulan</option>
                      <option value="quarterly">Quarter</option>
                      <option value="semesterly">Semester</option>
                      <option value="yearly">Tahun</option>
                    </select>

                    {budgetViewPeriod !== 'yearly' ? (
                      <>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Tahun:</span>
                        <select
                          className="form-control"
                          style={{ width: '90px', padding: '0.3rem 0.5rem', margin: 0, height: '30px', fontSize: '0.8rem' }}
                          value={selectedBudgetYear}
                          onChange={(e) => setSelectedBudgetYear(parseInt(e.target.value))}
                        >
                          {Array.from({ length: 7 }, (_, i) => 2023 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>

                        {budgetViewPeriod === 'monthly' && (
                          <>
                            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>Bulan:</span>
                            <select
                              className="form-control"
                              style={{ width: '110px', padding: '0.3rem 0.5rem', margin: 0, height: '30px', fontSize: '0.8rem' }}
                              value={selectedBudgetMonth.split('-')[1] || '01'}
                              onChange={(e) => {
                                setSelectedBudgetMonth(`${selectedBudgetYear}-${e.target.value}`);
                              }}
                            >
                              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                                <option key={m} value={m}>
                                  {new Date(2000, parseInt(m) - 1, 1).toLocaleString('id-ID', { month: 'long' })}
                                </option>
                              ))}
                            </select>
                          </>
                        )}

                        {budgetViewPeriod === 'quarterly' && (
                          <>
                            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>Quarter:</span>
                            <select
                              className="form-control"
                              style={{ width: '90px', padding: '0.3rem 0.5rem', margin: 0, height: '30px', fontSize: '0.8rem' }}
                              value={Math.ceil(parseInt(selectedBudgetMonth.split('-')[1] || '1') / 3)}
                              onChange={(e) => {
                                const q = parseInt(e.target.value);
                                const firstMonthOfQ = String((q - 1) * 3 + 1).padStart(2, '0');
                                setSelectedBudgetMonth(`${selectedBudgetYear}-${firstMonthOfQ}`);
                              }}
                            >
                              <option value="1">Q1 (Jan-Mar)</option>
                              <option value="2">Q2 (Apr-Jun)</option>
                              <option value="3">Q3 (Jul-Sep)</option>
                              <option value="4">Q4 (Oct-Dec)</option>
                            </select>
                          </>
                        )}

                        {budgetViewPeriod === 'semesterly' && (
                          <>
                            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>Semester:</span>
                            <select
                              className="form-control"
                              style={{ width: '110px', padding: '0.3rem 0.5rem', margin: 0, height: '30px', fontSize: '0.8rem' }}
                              value={Math.ceil(parseInt(selectedBudgetMonth.split('-')[1] || '1') / 6)}
                              onChange={(e) => {
                                const sem = parseInt(e.target.value);
                                const firstMonthOfSem = String((sem - 1) * 6 + 1).padStart(2, '0');
                                setSelectedBudgetMonth(`${selectedBudgetYear}-${firstMonthOfSem}`);
                              }}
                            >
                              <option value="1">Semester 1</option>
                              <option value="2">Semester 2</option>
                            </select>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Dari:</span>
                        <select
                          className="form-control"
                          style={{ width: '90px', padding: '0.3rem 0.5rem', margin: 0, height: '30px', fontSize: '0.8rem' }}
                          value={budgetStartYear}
                          onChange={(e) => setBudgetStartYear(parseInt(e.target.value))}
                        >
                          {Array.from({ length: 7 }, (_, i) => 2023 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginLeft: '0.2rem' }}>Hingga:</span>
                        <select
                          className="form-control"
                          style={{ width: '90px', padding: '0.3rem 0.5rem', margin: 0, height: '30px', fontSize: '0.8rem' }}
                          value={budgetEndYear}
                          onChange={(e) => setBudgetEndYear(parseInt(e.target.value))}
                        >
                          {Array.from({ length: 7 }, (_, i) => 2023 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {budgets.length === 0 ? (
                <div style={{ padding: '3rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  Belum ada anggaran yang diatur untuk periode ini. Pasang limit di panel kiri untuk memulai pelacakan.
                </div>
              ) : (() => {
                const incomeBudgets  = budgets.filter(b => b.type === 'income').sort((a, b) => a.category.localeCompare(b.category, 'id'));
                const expenseBudgets = budgets.filter(b => b.type !== 'income').sort((a, b) => a.category.localeCompare(b.category, 'id'));
                const totalIncomeBudget  = incomeBudgets.reduce((s, b) => s + b.amount, 0);
                const totalIncomeSpent   = incomeBudgets.reduce((s, b) => s + b.spent,  0);
                const totalExpenseBudget = expenseBudgets.reduce((s, b) => s + b.amount, 0);
                const totalExpenseSpent  = expenseBudgets.reduce((s, b) => s + b.spent,  0);
                const netBudget = totalIncomeBudget - totalExpenseBudget;
                const netActual = totalIncomeSpent  - totalExpenseSpent;

                const renderCompactRow = (b: any) => {
                  const isIncome  = b.type === 'income';
                  const pct       = Math.min(100, b.amount > 0 ? (b.spent / b.amount) * 100 : 0);
                  const isOver    = !isIncome && b.spent > b.amount;
                  const isNear    = !isIncome && !isOver && pct >= 80;
                  const barColor  = isOver ? 'var(--color-danger)' : isNear ? 'var(--color-warning)' : isIncome ? 'var(--color-success)' : 'var(--color-primary)';
                  const amtColor  = isOver ? 'var(--color-danger)' : isNear ? 'var(--color-warning)' : isIncome ? 'var(--color-income)' : 'var(--color-text)';

                  return (
                    <div key={b.id}>
                      {/* Compact row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '0.6rem', alignItems: 'center', padding: '0.45rem 0.6rem', borderRadius: '6px', background: editingBudgetId === b.id ? 'rgba(255,255,255,0.03)' : 'transparent' }}>

                        {/* Left: name + progress */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getFullCategoryName(b.category)}</span>
                            <span style={{ fontSize: '0.6rem', padding: '0.08rem 0.3rem', borderRadius: '3px', fontWeight: 600, flexShrink: 0, background: isIncome ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)', color: isIncome ? 'var(--color-income)' : 'var(--color-primary)' }}>
                              {isIncome ? 'Income' : 'Expense'}
                            </span>
                            {isOver && <span style={{ fontSize: '0.6rem', color: 'var(--color-danger)', fontWeight: 700, flexShrink: 0 }}>⚠ OVER</span>}
                            {b.start_date && <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>📅 {b.start_date.slice(0,7)}→{b.end_date ? b.end_date.slice(0,7) : '∞'}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '3px', transition: 'width 0.3s ease' }} />
                            </div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', flexShrink: 0, width: '30px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                          </div>
                        </div>

                        {/* Center: amounts */}
                        <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: amtColor }}>{renderAmount(b.spent)}</div>
                          <div style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)' }}>/ {renderAmount(b.amount)}</div>
                        </div>

                        {/* Right: action icons */}
                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}>
                          <button type="button" title="Lihat Transaksi" onClick={() => handleViewBudgetTransactions(b)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0.15rem', opacity: 0.6, lineHeight: 1 }}>📋</button>
                          <button type="button" title="Edit Anggaran" onClick={() => handleStartEditBudget(b)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0.15rem', opacity: 0.6, lineHeight: 1 }}>✏️</button>
                          <button type="button" title="Hapus Anggaran" onClick={() => handleDeleteBudget(b.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0.15rem', opacity: 0.6, lineHeight: 1 }}>🗑️</button>
                        </div>
                      </div>

                      {/* Inline edit form — expands below the row */}
                      {editingBudgetId === b.id && (
                        <div style={{ padding: '0.6rem 0.6rem 0.7rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0 0 6px 6px', marginTop: '-2px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem' }}>
                            <select className="form-control" style={{ height: '26px', fontSize: '0.75rem', padding: '0.1rem 0.4rem', margin: 0, flex: 1.5 }}
                              value={editingBudgetCategory} onChange={(e) => setEditingBudgetCategory(e.target.value)}>
                              {groupedCategories.map(group => (
                                <optgroup key={group.parent.id} label={group.parent.name}>
                                  <option value={group.parent.name}>{group.parent.name}</option>
                                  {group.subs.map(sub => <option key={sub.id} value={sub.name}>↳ {sub.name}</option>)}
                                </optgroup>
                              ))}
                            </select>
                            <input type="number" className="form-control" style={{ height: '26px', fontSize: '0.75rem', padding: '0.1rem 0.4rem', margin: 0, flex: 1 }}
                              value={editingBudgetAmount} onChange={(e) => setEditingBudgetAmount(e.target.value)} placeholder="Nominal" autoFocus />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.3rem', marginBottom: '0.4rem' }}>
                            <div>
                              <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block' }}>Mulai</label>
                              <input type="date" className="form-control" style={{ height: '24px', fontSize: '0.7rem', padding: '0.1rem 0.3rem', margin: 0 }}
                                value={editingBudgetStartDate} onChange={(e) => setEditingBudgetStartDate(e.target.value)} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block' }}>Sampai</label>
                              <input type="date" className="form-control" style={{ height: '24px', fontSize: '0.7rem', padding: '0.1rem 0.3rem', margin: 0 }}
                                value={editingBudgetEndDate} onChange={(e) => setEditingBudgetEndDate(e.target.value)} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block' }}>Frekuensi</label>
                              <select className="form-control" style={{ height: '24px', fontSize: '0.7rem', padding: '0.1rem 0.3rem', margin: 0 }}
                                value={editingBudgetRecurrence} onChange={(e) => setEditingBudgetRecurrence(e.target.value as any)}>
                                <option value="none">Satu Kali</option>
                                <option value="monthly">Bulanan</option>
                                <option value="weekly">Mingguan</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem' }}>
                            <button type="button" className="btn btn-primary" style={{ padding: '0.15rem 0.6rem', fontSize: '0.72rem', height: '24px' }} onClick={() => handleSaveEditedBudget(b)}>💾 Simpan</button>
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.15rem 0.6rem', fontSize: '0.72rem', height: '24px' }}
                              onClick={() => { setEditingBudgetId(null); setEditingBudgetAmount(''); setEditingBudgetCategory(''); setEditingBudgetStartDate(''); setEditingBudgetEndDate(''); setEditingBudgetRecurrence('monthly'); setEditingBudgetRecurrenceDay('1'); }}>
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {/* ── Summary totals ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1.25rem' }}>
                      {/* Income total */}
                      <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '8px', padding: '0.65rem 0.8rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total Pemasukan</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-income)' }}>{renderAmount(totalIncomeSpent)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>dari {renderAmount(totalIncomeBudget)}</div>
                        <div style={{ marginTop: '0.35rem', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, totalIncomeBudget > 0 ? (totalIncomeSpent / totalIncomeBudget) * 100 : 0)}%`, height: '100%', background: 'var(--color-success)', borderRadius: '2px' }} />
                        </div>
                      </div>

                      {/* Expense total */}
                      <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '0.65rem 0.8rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total Pengeluaran</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: totalExpenseSpent > totalExpenseBudget ? 'var(--color-danger)' : 'var(--color-expense, var(--color-danger))' }}>{renderAmount(totalExpenseSpent)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>dari {renderAmount(totalExpenseBudget)}</div>
                        <div style={{ marginTop: '0.35rem', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, totalExpenseBudget > 0 ? (totalExpenseSpent / totalExpenseBudget) * 100 : 0)}%`, height: '100%', background: totalExpenseSpent > totalExpenseBudget ? 'var(--color-danger)' : 'var(--color-primary)', borderRadius: '2px' }} />
                        </div>
                      </div>

                      {/* Net */}
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '0.65rem 0.8rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Selisih Aktual</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: netActual >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{renderAmount(netActual)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>target {renderAmount(netBudget)}</div>
                        <div style={{ marginTop: '0.35rem', fontSize: '0.65rem', color: netActual >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {netActual >= 0 ? '✓ Surplus' : '✗ Defisit'}
                        </div>
                      </div>
                    </div>

                    {/* ── Donut Charts ── */}
                    {(() => {
                      const INCOME_COLORS  = ['#22c55e','#4ade80','#34d399','#16a34a','#86efac','#6ee7b7'];
                      const EXPENSE_COLORS = ['#6366f1','#f97316','#ef4444','#eab308','#06b6d4','#808080'];

                      const getMainCat = (catName: string) => {
                        const cat = dbCategories.find(c => c.name === catName);
                        if (cat?.parent_id) {
                          const parent = dbCategories.find(p => p.id === cat.parent_id);
                          return parent?.name || catName;
                        }
                        return catName;
                      };

                      // Build groups, cap at top-5 + "Lainnya"
                      const buildGroups = (list: any[]): [string, number][] => {
                        const map: Record<string, number> = {};
                        list.forEach(b => {
                          const main = getMainCat(b.category);
                          map[main] = (map[main] || 0) + b.amount;
                        });
                        const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
                        if (sorted.length <= 6) return sorted;
                        const top5 = sorted.slice(0, 5);
                        const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
                        return [...top5, ['Lainnya', rest]];
                      };

                      const DonutChart = ({ groups, colors, total, accentColor, title }: {
                        groups: [string, number][]; colors: string[]; total: number; accentColor: string; title: string;
                      }) => {
                        if (total === 0 || groups.length === 0) return (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                            Tidak ada data
                          </div>
                        );

                        // SVG donut params
                        const R = 38, CX = 48, CY = 48, SW = 14;
                        const CIRC = 2 * Math.PI * R;
                        const GAP  = 2.5; // gap in px between slices

                        let cumulOffset = 0;
                        const slices = groups.map(([name, val], i) => {
                          const pct    = val / total;
                          const arcLen = Math.max(pct * CIRC - GAP, 0);
                          const s = { name, val, pct, arcLen, color: colors[i % colors.length], offset: cumulOffset };
                          cumulOffset += pct * CIRC;
                          return s;
                        });

                        return (
                          <div>
                            {/* Title */}
                            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: accentColor, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                              {title}
                            </div>

                            {/* Chart + Legend side-by-side */}
                            <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>

                              {/* SVG donut */}
                              <div style={{ position: 'relative', flexShrink: 0, width: '96px', height: '96px' }}>
                                <svg viewBox="0 0 96 96" width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
                                  {/* track */}
                                  <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={SW} />
                                  {/* slices */}
                                  {slices.map((s, i) => (
                                    <circle key={i} cx={CX} cy={CY} r={R} fill="none"
                                      stroke={s.color} strokeWidth={SW}
                                      strokeDasharray={`${s.arcLen} ${CIRC}`}
                                      strokeDashoffset={-s.offset}
                                      strokeLinecap="butt"
                                    />
                                  ))}
                                </svg>
                                {/* Center text */}
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                  <span style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.03em' }}>TOTAL</span>
                                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.2 }}>
                                    {total >= 1_000_000
                                      ? `${(total / 1_000_000).toFixed(1)}M`
                                      : total >= 1_000 ? `${(total / 1_000).toFixed(0)}K` : total}
                                  </span>
                                </div>
                              </div>

                              {/* Legend */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.28rem', minWidth: 0 }}>
                                {slices.map((s, i) => (
                                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto auto', gap: '0.3rem', alignItems: 'center' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color, flexShrink: 0, display: 'block' }} />
                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      {s.val >= 1_000_000 ? `${(s.val / 1_000_000).toFixed(1)}M` : s.val >= 1_000 ? `${(s.val / 1_000).toFixed(0)}K` : s.val}
                                    </span>
                                    <span style={{ fontSize: '0.62rem', color: accentColor, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', minWidth: '28px' }}>
                                      {(s.pct * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      };

                      const incomeGroups  = buildGroups(incomeBudgets);
                      const expenseGroups = buildGroups(expenseBudgets);
                      const totalIncome   = incomeBudgets.reduce((s, b) => s + b.amount, 0);
                      const totalExpense  = expenseBudgets.reduce((s, b) => s + b.amount, 0);

                      if (incomeGroups.length === 0 && expenseGroups.length === 0) return null;

                      const hasBoth = incomeGroups.length > 0 && expenseGroups.length > 0;
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: hasBoth ? '1fr 1fr' : '1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                          {incomeGroups.length > 0 && (
                            <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                              <DonutChart groups={incomeGroups} colors={INCOME_COLORS} total={totalIncome} accentColor="var(--color-income)" title="Distribusi Pemasukan" />
                            </div>
                          )}
                          {expenseGroups.length > 0 && (
                            <div style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                              <DonutChart groups={expenseGroups} colors={EXPENSE_COLORS} total={totalExpense} accentColor="var(--color-primary)" title="Distribusi Pengeluaran" />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Income budgets ── */}
                    {incomeBudgets.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-income)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 0.6rem', marginBottom: '0.25rem' }}>
                          Pemasukan · {incomeBudgets.length} kategori
                        </div>
                        <div style={{ background: 'rgba(34,197,94,0.03)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.08)', overflow: 'hidden' }}>
                          {incomeBudgets.map((b, i) => (
                            <div key={b.id} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                              {renderCompactRow(b)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Expense budgets ── */}
                    {expenseBudgets.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 0.6rem', marginBottom: '0.25rem' }}>
                          Pengeluaran · {expenseBudgets.length} kategori
                        </div>
                        <div style={{ background: 'rgba(99,102,241,0.03)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.08)', overflow: 'hidden' }}>
                          {expenseBudgets.map((b, i) => (
                            <div key={b.id} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                              {renderCompactRow(b)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 5: INSTALLMENTS & PROJECTIONS
            ------------------------------------------------------------- */}
        {activeTab === 'liabilities' && (
          <div>
            {/* Sub-Tab Navigation Header */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', paddingBottom: '0.5rem' }}>
              <button 
                className={`tab-btn ${liabilitiesSubTab === 'overview' ? 'active' : ''}`}
                onClick={() => setLiabilitiesSubTab('overview')}
                style={{ background: 'transparent', border: 'none', color: liabilitiesSubTab === 'overview' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: 600, padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: liabilitiesSubTab === 'overview' ? '2px solid var(--color-primary)' : 'none', outline: 'none' }}
              >
                📊 Ringkasan (Overview)
              </button>
              <button 
                className={`tab-btn ${liabilitiesSubTab === 'installments' ? 'active' : ''}`}
                onClick={() => setLiabilitiesSubTab('installments')}
                style={{ background: 'transparent', border: 'none', color: liabilitiesSubTab === 'installments' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: 600, padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: liabilitiesSubTab === 'installments' ? '2px solid var(--color-primary)' : 'none', outline: 'none' }}
              >
                💳 Cicilan Kartu Kredit (CC Installments)
              </button>
              <button 
                className={`tab-btn ${liabilitiesSubTab === 'loans' ? 'active' : ''}`}
                onClick={() => setLiabilitiesSubTab('loans')}
                style={{ background: 'transparent', border: 'none', color: liabilitiesSubTab === 'loans' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: 600, padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: liabilitiesSubTab === 'loans' ? '2px solid var(--color-primary)' : 'none', outline: 'none' }}
              >
                🤝 Pinjaman & Piutang (Debts & Receivables)
              </button>
            </div>

            {/* Sub-Tab Content Rendering */}
            {liabilitiesSubTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h2>Liabilities & Receivables Overview</h2>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    Ringkasan seluruh kewajiban pembayaran (liabilitas) dan tagihan piutang Anda.
                  </p>
                </div>

                {/* Net Worth / Liabilities Summary Cards */}
                <div className="grid-cols-3" style={{ gap: '1.5rem' }}>
                  <div className="glass-panel card-content">
                    <div className="card-desc">Total Outstanding Cicilan CC</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-warning)', marginTop: '0.5rem' }}>
                      {renderAmount(installments.reduce((sum, inst) => sum + (inst.monthly_amount * inst.remaining_months), 0))}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Kewajiban dari cicilan aktif di kartu kredit.
                    </p>
                  </div>

                  <div className="glass-panel card-content">
                    <div className="card-desc">Total Hutang Personal & Bank</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-danger)', marginTop: '0.5rem' }}>
                      {renderAmount(debtsReceivables.filter(d => d.type === 'debt' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0))}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Pinjaman aktif dari pihak ketiga/orang lain.
                    </p>
                  </div>

                  <div className="glass-panel card-content">
                    <div className="card-desc">Total Piutang Aktif</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.5rem' }}>
                      {renderAmount(debtsReceivables.filter(d => d.type === 'receivable' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0))}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Uang Anda yang dipinjam oleh orang lain.
                    </p>
                  </div>
                </div>

                {/* Summary calculation card */}
                <div className="glass-panel card-content" style={{ marginTop: '1rem', padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Net Liability Position (Posisi Kewajiban Bersih)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                      <span>Total Liabilities (Total Kewajiban):</span>
                      <strong className="text-warning">
                        {renderAmount(
                          installments.reduce((sum, inst) => sum + (inst.monthly_amount * inst.remaining_months), 0) +
                          debtsReceivables.filter(d => d.type === 'debt' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0)
                        )}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <span>Total Receivables (Total Piutang):</span>
                      <strong style={{ color: 'var(--color-success)' }}>
                        {renderAmount(debtsReceivables.filter(d => d.type === 'receivable' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0))}
                      </strong>
                    </div>
                    {(() => {
                      const totalLiabilities = installments.reduce((sum, inst) => sum + (inst.monthly_amount * inst.remaining_months), 0) +
                        debtsReceivables.filter(d => d.type === 'debt' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0);
                      const totalReceivables = debtsReceivables.filter(d => d.type === 'receivable' && d.status === 'active').reduce((sum, d) => sum + d.remaining_amount, 0);
                      const netPosition = totalReceivables - totalLiabilities;
                      
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', paddingTop: '0.25rem' }}>
                          <span>Net Position:</span>
                          <span style={{ color: netPosition >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {renderAmount(Math.abs(netPosition))} {netPosition >= 0 ? '(Surplus Aset)' : '(Defisit / Net Debt)'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {liabilitiesSubTab === 'installments' && (
              <div>
                {/* Top Cards for CC Projections */}
            <div className="grid-cols-2" style={{ gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Amortization Info Card */}
              <div className="glass-panel card-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ marginBottom: '0.5rem' }}>Debt Payoff Estimator</h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    Check details of active installments (0% interest or credit cycle charges) imported from statements and estimate when your accounts will be fully paid off.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '10px' }}>
                  {projections.map(proj => (
                    <div key={proj.card_id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <div>
                        <strong>{proj.card_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Debt Free Timeline</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="text-warning" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                          {proj.months_to_debt_free > 0 ? `${proj.months_to_debt_free} Months` : 'Debt-Free'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Remaining: {renderAmount(proj.outstanding_installment_debt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Debt Amortization Chart */}
              <div className="glass-panel card-content">
                <h3 style={{ marginBottom: '0.5rem' }}>Amortization Timeline Projection</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  Projected monthly credit card billing amounts due exclusively to active installments.
                </p>

                {projections.length === 0 || projections[0]?.monthly_schedule?.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No active credit card installment plans to project.
                  </div>
                ) : (
                  <div>
                    {/* Amortization Bar charts using pure HTML/CSS */}
                    <div className="timeline-chart">
                      {projections[0]?.monthly_schedule.map((m: any) => {
                        // find max payment in array to scale heights
                        const maxPayment = Math.max(...projections[0].monthly_schedule.map((item: any) => item.payment), 1);
                        const pctHeight = Math.max(5, (m.payment / maxPayment) * 90); // cap to 90% height max
                        
                        return (
                          <div key={m.monthIndex} className="timeline-bar-wrapper">
                            <div 
                              className="timeline-bar"
                              style={{ height: `${pctHeight}%` }}
                            >
                              <div className="timeline-tooltip">
                                <strong>{renderAmount(m.payment)}</strong><br />
                                <span>{m.activeCount} active plans</span>
                              </div>
                            </div>
                            <div className="timeline-label">{m.label}</div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--color-primary)', borderRadius: '2px' }} />
                        <span>Installment Bill</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Active Installment Grid and Add Manually */}
            <div className="grid-cols-2" style={{ gridTemplateColumns: '1.8fr 1.2fr' }}>
              {/* Active Installments List */}
              <div className="glass-panel card-content">
                <h3 style={{ marginBottom: '1.5rem' }}>Active Installment Plans</h3>
                
                <div className="table-container">
                  {installments.length === 0 ? (
                    <div style={{ padding: '3rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                      No active installments recorded. Tag imported credit card transactions as installments during PDF import, or add them manually in the right panel.
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Card Name</th>
                          <th>Description</th>
                          <th>Monthly Bill</th>
                          <th>Remaining (Mo)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.map(i => (
                          <tr key={i.id}>
                            <td style={{ fontWeight: 600 }}>{i.card_name}</td>
                            <td>
                              <div>{i.description}</div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Started: {i.start_date}</span>
                            </td>
                            <td className="text-danger" style={{ fontWeight: '600' }}>
                              {renderAmount(i.monthly_amount)}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <strong className="text-warning">{i.remaining_months}</strong>
                                <span>/ {i.total_months} months</span>
                                <button 
                                  className="btn btn-secondary"
                                  style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem', borderRadius: '4px' }}
                                  onClick={() => handleTickInstallment(i.id)}
                                  title="Reduce remaining months by 1 (simulating statement cycle)"
                                  disabled={i.remaining_months <= 0}
                                >
                                  Tick
                                </button>
                              </div>
                            </td>
                            <td>
                              <button 
                                className="btn" 
                                style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent' }}
                                onClick={() => handleDeleteInstallment(i.id)}
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

              {/* Add Installment Manually */}
              <div className="glass-panel card-content">
                <h3 style={{ marginBottom: '1.5rem' }}>Add Installment Manually</h3>
                <form onSubmit={handleAddInstallment}>
                  <div className="form-group">
                    <label>Credit Card Account</label>
                    <select 
                      className="form-control"
                      value={newInstCard}
                      onChange={(e) => setNewInstCard(e.target.value)}
                      required
                    >
                      <option value="">-- Select --</option>
                      {accounts.filter(a => a.type === 'credit_card').map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Tokopedia Cicilan Laptop" 
                      value={newInstDesc}
                      onChange={(e) => setNewInstDesc(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1fr', margin: 0, gap: '1rem' }}>
                    <div className="form-group">
                      <label>Monthly Bill (IDR)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="e.g. 500000" 
                        value={newInstAmount}
                        onChange={(e) => setNewInstAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Total Duration (Months)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="e.g. 12" 
                        value={newInstMonths}
                        onChange={(e) => setNewInstMonths(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Start Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={newInstDate}
                      onChange={(e) => setNewInstDate(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                    <Icons.Plus /> Save Installment
                  </button>
                </form>
              </div>
            </div>
          </div>
            )}

            {liabilitiesSubTab === 'loans' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2>🤝 Kelola Hutang & Piutang</h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      Pantau catatan pinjaman uang dari orang lain (Hutang) dan uang yang dipinjamkan ke orang lain (Piutang).
                    </p>
                  </div>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setDrType('debt');
                      setDrPerson('');
                      setDrAmount('');
                      setDrDescription('');
                      setDrDate(new Date().toISOString().split('T')[0]);
                      setDrDueDate('');
                      setDrAccountId('');
                      setShowAddDRModal(true);
                    }}
                  >
                    + Catat Baru
                  </button>
                </div>

                {loadingDR ? (
                  <div className="glass-panel card-content" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Memuat data Hutang & Piutang...</p>
                  </div>
                ) : (
                  <>
                    {/* Summary Cards */}
                    <div className="grid-cols-2" style={{ gap: '1.5rem' }}>
                      <div className="glass-panel card-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--color-danger)' }}>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>TOTAL HUTANG AKTIF (Harus Dibayar)</span>
                        <h2 style={{ color: 'var(--color-danger)', margin: 0 }}>
                          {renderAmount(
                            debtsReceivables
                              .filter(d => d.type === 'debt' && d.status === 'active')
                              .reduce((sum, d) => sum + d.remaining_amount, 0)
                          )}
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Dari {debtsReceivables.filter(d => d.type === 'debt' && d.status === 'active').length} catatan aktif
                        </span>
                      </div>

                      <div className="glass-panel card-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--color-success)' }}>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>TOTAL PIUTANG AKTIF (Harus Ditagih)</span>
                        <h2 style={{ color: 'var(--color-success)', margin: 0 }}>
                          {renderAmount(
                            debtsReceivables
                              .filter(d => d.type === 'receivable' && d.status === 'active')
                              .reduce((sum, d) => sum + d.remaining_amount, 0)
                          )}
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Dari {debtsReceivables.filter(d => d.type === 'receivable' && d.status === 'active').length} catatan aktif
                        </span>
                      </div>
                    </div>

                    {/* Lists Stacking */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      
                      {/* HUTANG PANEL */}
                      <div className="glass-panel card-content" style={{ padding: '1.25rem' }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)' }}>
                          🔴 Daftar Hutang Saya
                        </h3>
                        <div className="table-container">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Pemberi Pinjaman</th>
                                <th>Keterangan / Tujuan</th>
                                <th>Tanggal Pinjam</th>
                                <th>Jatuh Tempo</th>
                                <th style={{ textAlign: 'right' }}>Jumlah Awal</th>
                                <th style={{ textAlign: 'right' }}>Sisa Hutang</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'center', width: '120px' }}>Tindakan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {debtsReceivables.filter(d => d.type === 'debt').length === 0 ? (
                                <tr>
                                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem' }}>
                                    Tidak ada catatan hutang.
                                  </td>
                                </tr>
                              ) : (
                                debtsReceivables.filter(d => d.type === 'debt').map(d => (
                                  <tr key={d.id}>
                                    <td><strong>{d.person}</strong></td>
                                    <td>{d.description}</td>
                                    <td>{d.date}</td>
                                    <td>{d.due_date || '-'}</td>
                                    <td style={{ textAlign: 'right' }}>{renderAmount(d.amount)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: d.status === 'active' ? 'bold' : 'normal', color: d.status === 'active' ? 'var(--color-danger)' : 'inherit' }}>
                                      {renderAmount(d.remaining_amount)}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span className={`badge ${d.status === 'active' ? 'badge-danger' : 'badge-success'}`}>
                                        {d.status === 'active' ? 'Belum Lunas' : 'Lunas'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                        {d.status === 'active' && (
                                          <button
                                            className="btn btn-primary"
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0 }}
                                            onClick={() => {
                                              setPayingDR(d);
                                              setPayAmount(String(d.remaining_amount));
                                              setPayDate(new Date().toISOString().split('T')[0]);
                                              setPayAccountId('');
                                              setPayNote('');
                                            }}
                                            title="Bayar Hutang"
                                          >
                                            💸 Bayar
                                          </button>
                                        )}
                                        <button
                                          className="btn btn-secondary"
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0 }}
                                          onClick={() => setViewDRDetails(d)}
                                          title="Riwayat Detail"
                                        >
                                          👁️
                                        </button>
                                        <button
                                          className="btn"
                                          style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent', margin: 0 }}
                                          onClick={() => handleDeleteDR(d.id)}
                                          title="Hapus"
                                        >
                                          <Icons.Delete />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* PIUTANG PANEL */}
                      <div className="glass-panel card-content" style={{ padding: '1.25rem' }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)' }}>
                          🟢 Daftar Piutang (Uang Saya di Orang Lain)
                        </h3>
                        <div className="table-container">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Peminjam</th>
                                <th>Keterangan / Tujuan</th>
                                <th>Tanggal Pinjam</th>
                                <th>Jatuh Tempo</th>
                                <th style={{ textAlign: 'right' }}>Jumlah Awal</th>
                                <th style={{ textAlign: 'right' }}>Sisa Tagihan</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'center', width: '120px' }}>Tindakan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {debtsReceivables.filter(d => d.type === 'receivable').length === 0 ? (
                                <tr>
                                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem' }}>
                                    Tidak ada catatan piutang.
                                  </td>
                                </tr>
                              ) : (
                                debtsReceivables.filter(d => d.type === 'receivable').map(d => (
                                  <tr key={d.id}>
                                    <td><strong>{d.person}</strong></td>
                                    <td>{d.description}</td>
                                    <td>{d.date}</td>
                                    <td>{d.due_date || '-'}</td>
                                    <td style={{ textAlign: 'right' }}>{renderAmount(d.amount)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: d.status === 'active' ? 'bold' : 'normal', color: d.status === 'active' ? 'var(--color-success)' : 'inherit' }}>
                                      {renderAmount(d.remaining_amount)}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span className={`badge ${d.status === 'active' ? 'badge-warning' : 'badge-success'}`}>
                                        {d.status === 'active' ? 'Belum Tagih' : 'Lunas'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                        {d.status === 'active' && (
                                          <button
                                            className="btn btn-primary"
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, background: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                                            onClick={() => {
                                              setPayingDR(d);
                                              setPayAmount(String(d.remaining_amount));
                                              setPayDate(new Date().toISOString().split('T')[0]);
                                              setPayAccountId('');
                                              setPayNote('');
                                            }}
                                            title="Terima Pembayaran"
                                          >
                                            📥 Terima
                                          </button>
                                        )}
                                        <button
                                          className="btn btn-secondary"
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0 }}
                                          onClick={() => setViewDRDetails(d)}
                                          title="Riwayat Detail"
                                        >
                                          👁️
                                        </button>
                                        <button
                                          className="btn"
                                          style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent', margin: 0 }}
                                          onClick={() => handleDeleteDR(d.id)}
                                          title="Hapus"
                                        >
                                          <Icons.Delete />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 5B: FUTURE GOALS (SAVINGS TARGETS)
            ------------------------------------------------------------- */}
        {activeTab === 'goals' && (
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
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '0.5rem' }}>
                      {renderAmount(totalTarget)}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Kebutuhan dana untuk {activeGoals.length} rencana aktif.
                    </p>
                  </div>

                  <div className="glass-panel card-content" style={{ borderLeft: '4px solid var(--color-success)' }}>
                    <div className="card-desc">Total Dana Terkumpul</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.5rem' }}>
                      {renderAmount(totalSaved)}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Sudah terkumpul ({totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(1) : 0}%).
                    </p>
                  </div>

                  <div className="glass-panel card-content" style={{ borderLeft: '4px solid var(--color-warning)' }}>
                    <div className="card-desc">Total Kekurangan Dana</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-warning)', marginTop: '0.5rem' }}>
                      {renderAmount(totalShortfall)}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Kekurangan yang masih harus dikumpulkan.
                    </p>
                  </div>

                  <div className="glass-panel card-content" style={{ borderLeft: '4px solid #8b5cf6', background: 'rgba(139, 92, 246, 0.03)' }}>
                    <div className="card-desc" style={{ color: '#a78bfa' }}>Target Tabungan Bulanan</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#c084fc', marginTop: '0.5rem' }}>
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
        )}

        {/* -------------------------------------------------------------
            TAB: INVESTMENTS TRACKER
            ------------------------------------------------------------- */}
        {activeTab === 'investments' && (() => {
          const activeInv = investments.filter(i => i.status === 'active');
          const totalValue = activeInv.reduce((s, i) => s + (i.current_value || 0), 0);
          const totalInvested = activeInv.reduce((s, i) => s + (i.total_invested || 0), 0);
          const unrealizedGain = totalValue - totalInvested;
          const unrealizedPct = totalInvested > 0 ? ((unrealizedGain / totalInvested) * 100) : 0;
          const typeLabels: Record<string, string> = {
            gold: '🥇 Emas', stock: '📊 Saham', mutual_fund: '📦 Reksa Dana',
            crypto: '₿ Kripto', property: '🏠 Properti', deposit: '🏦 Deposito',
            bond: '📜 Obligasi', other: '🗂️ Lainnya'
          };
          const byType = activeInv.reduce((acc: Record<string, number>, i) => {
            acc[i.type] = (acc[i.type] || 0) + (i.current_value || 0);
            return acc;
          }, {});

          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0 }}>📈 Investments Tracker</h2>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: 0 }}>
                    Pantau aset investasi: emas, saham, reksa dana, dan lainnya. Update harga kapan saja secara manual.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetInvestmentForm(); setEditingInvestment(null); setShowAddInvestmentModal(true); }}>
                  + Tambah Aset
                </button>
              </div>

              {/* Portfolio Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="glass-panel card-content" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>TOTAL NILAI PORTOFOLIO</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {renderAmount(totalValue)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{activeInv.length} aset aktif</div>
                </div>
                <div className="glass-panel card-content" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>TOTAL MODAL DIINVESTASIKAN</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{renderAmount(totalInvested)}</div>
                </div>
                <div className="glass-panel card-content" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>UNREALIZED GAIN / LOSS</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: unrealizedGain >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
                    {unrealizedGain >= 0 ? '+' : ''}{renderAmount(unrealizedGain)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: unrealizedGain >= 0 ? 'var(--color-income)' : 'var(--color-expense)', marginTop: '0.25rem' }}>
                    <span className={privacyMode === 'blur' ? 'privacy-strict' : privacyMode === 'hover' ? 'privacy-hover' : ''}>
                      {unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Alokasi per Jenis */}
              {Object.keys(byType).length > 0 && (
                <div className="glass-panel card-content" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alokasi Aset</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, val]) => {
                      const pct = totalValue > 0 ? (val / totalValue * 100) : 0;
                      return (
                        <div key={type}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                            <span>{typeLabels[type] || type}</span>
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              <span className={privacyMode === 'blur' ? 'privacy-strict' : privacyMode === 'hover' ? 'privacy-hover' : ''}>{pct.toFixed(1)}%</span> &nbsp; {renderAmount(val)}
                            </span>
                          </div>
                          <div style={{ height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Investment Cards */}
              {loadingInvestments ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Memuat...</div>
              ) : investments.length === 0 ? (
                <div className="glass-panel card-content" style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</div>
                  <h3>Belum Ada Aset Investasi</h3>
                  <p style={{ color: 'var(--color-text-muted)' }}>Tambahkan aset investasi seperti tabungan emas Pegadaian, saham, atau reksa dana Bibit secara manual.</p>
                  <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => { resetInvestmentForm(); setShowAddInvestmentModal(true); }}>+ Tambah Aset Pertama</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                  {investments.map(inv => {
                    const gain = (inv.current_value || 0) - (inv.total_invested || 0);
                    const gainPct = inv.total_invested > 0 ? (gain / inv.total_invested * 100) : 0;
                    return (
                      <div key={inv.id} className="glass-panel card-content" style={{ padding: '1.25rem', position: 'relative' }}>
                        {inv.status !== 'active' && (
                          <span style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '99px' }}>
                            {inv.status}
                          </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                          <div style={{ fontSize: '1.75rem', lineHeight: 1 }}>{typeLabels[inv.type]?.split(' ')[0] || '🗂️'}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.name}</div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                              {typeLabels[inv.type]?.split(' ').slice(1).join(' ')} {inv.platform ? `• ${inv.platform}` : ''}
                            </div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                              Terakhir Update: {inv.last_tx_date ? inv.last_tx_date : inv.created_at ? inv.created_at.split(' ')[0] || inv.created_at : '-'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.1rem' }}>NILAI SAAT INI</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{renderAmount(inv.current_value || 0)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.1rem' }}>MODAL</div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{renderAmount(inv.total_invested || 0)}</div>
                          </div>
                        </div>

                        {inv.current_units > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.1rem' }}>UNIT / JUMLAH</div>
                              <div style={{ fontSize: '0.85rem' }} className={privacyMode === 'blur' ? 'privacy-strict' : privacyMode === 'hover' ? 'privacy-hover' : ''}>
                                {inv.current_units.toLocaleString('id-ID', {maximumFractionDigits: 6})} {inv.unit || ''}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.1rem' }}>HARGA/UNIT</div>
                              <div style={{ fontSize: '0.85rem' }}>{renderAmount(inv.current_price_per_unit || 0)}</div>
                            </div>
                          </div>
                        )}

                        <div style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', background: gain >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', marginBottom: '1rem' }}>
                          <span style={{ color: gain >= 0 ? 'var(--color-income)' : 'var(--color-expense)', fontWeight: 600, fontSize: '0.9rem' }} className={privacyMode === 'blur' ? 'privacy-strict' : privacyMode === 'hover' ? 'privacy-hover' : ''}>
                            {gain >= 0 ? '▲' : '▼'} {gain >= 0 ? '+' : ''}Rp {gain.toLocaleString('id-ID')} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', fontWeight: 600 }}
                            onClick={() => { setPriceUpdateTarget(inv); setPriceUpdateValue(String(inv.current_price_per_unit || '')); setShowPriceUpdateModal(true); }}
                          >
                            🔄 Update Harga
                          </button>
                          <button
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#c084fc', fontWeight: 600 }}
                            onClick={() => {
                              setAddInvTxTarget(inv);
                              resetInvTxForm();
                              setInvTxPrice(String(inv.current_price_per_unit || ''));
                              setShowAddInvTxModal(true);
                            }}
                          >
                            ➕ Transaksi
                          </button>
                          <button
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', fontWeight: 600 }}
                            onClick={() => {
                              setEditingInvestment(inv);
                              setInvName(inv.name); setInvType(inv.type);
                              setInvPlatform(inv.platform || ''); setInvUnit(inv.unit || '');
                              setInvCurrentUnits(String(inv.current_units || ''));
                              setInvCurrentPrice(String(inv.current_price_per_unit || ''));
                              setInvTotalInvested(String(inv.total_invested || ''));
                              setInvAccountId(inv.account_id || ''); setInvNotes(inv.notes || '');
                              setShowAddInvestmentModal(true);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fda4af', fontWeight: 600 }}
                            onClick={() => handleDeleteInvestment(inv.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Modal: Add/Edit Investment ── */}
              {showAddInvestmentModal && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="glass-panel modal-content" style={{ maxWidth: '540px', width: '95%', padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📈</span> {editingInvestment ? 'Edit Aset Investasi' : 'Tambah Aset Investasi'}
                      </h3>
                      <button 
                        type="button" 
                        onClick={() => { setShowAddInvestmentModal(false); setEditingInvestment(null); resetInvestmentForm(); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                      >
                        ✕
                      </button>
                    </div>
                    <form onSubmit={handleSaveInvestment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                          <label>Nama Aset *</label>
                          <input className="form-control" required value={invName} onChange={e => setInvName(e.target.value)} placeholder="mis. Tabungan Emas Pegadaian, BBCA, Reksa Dana XYZ" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Jenis *</label>
                          <select className="form-control" value={invType} onChange={e => setInvType(e.target.value as any)}>
                            <option value="gold">🥇 Emas</option>
                            <option value="stock">📊 Saham</option>
                            <option value="mutual_fund">📦 Reksa Dana</option>
                            <option value="crypto">₿ Kripto</option>
                            <option value="property">🏠 Properti</option>
                            <option value="deposit">🏦 Deposito</option>
                            <option value="bond">📜 Obligasi</option>
                            <option value="other">🗂️ Lainnya</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Platform / Broker</label>
                          <input className="form-control" value={invPlatform} onChange={e => setInvPlatform(e.target.value)} placeholder="mis. Pegadaian, Bibit, Stockbit" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Satuan Unit</label>
                          <input className="form-control" value={invUnit} onChange={e => setInvUnit(e.target.value)} placeholder="mis. gram, lembar, unit" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Jumlah Unit Saat Ini</label>
                          <input className="form-control" type="number" step="any" value={invCurrentUnits} onChange={e => setInvCurrentUnits(e.target.value)} placeholder="0" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Harga per Unit (Rp)</label>
                          <input className="form-control" type="number" step="any" value={invCurrentPrice} onChange={e => setInvCurrentPrice(e.target.value)} placeholder="0" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Total Modal Diinvestasikan (Rp)</label>
                          <input className="form-control" type="number" step="any" value={invTotalInvested} onChange={e => setInvTotalInvested(e.target.value)} placeholder="Total uang disetor" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                          <label>Linked Account (opsional)</label>
                          <select className="form-control" value={invAccountId} onChange={e => setInvAccountId(e.target.value)}>
                            <option value="">— Tidak ada —</option>
                            {accounts.filter(a => a.type === 'bank' || a.type === 'ewallet' || a.type === 'cash').map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                          <label>Catatan</label>
                          <textarea className="form-control" rows={2} value={invNotes} onChange={e => setInvNotes(e.target.value)} placeholder="Catatan tambahan..." style={{ resize: 'vertical' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => { setShowAddInvestmentModal(false); setEditingInvestment(null); resetInvestmentForm(); }}>Batal</button>
                        <button type="submit" className="btn btn-primary">{editingInvestment ? 'Simpan Perubahan' : 'Tambah Aset'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ── Modal: Update Harga ── */}
              {showPriceUpdateModal && priceUpdateTarget && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="glass-panel modal-content" style={{ maxWidth: '420px', width: '95%', padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🔄</span> Update Harga
                      </h3>
                      <button 
                        type="button" 
                        onClick={() => setShowPriceUpdateModal(false)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>{priceUpdateTarget.name}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        Harga lama: <span style={{ color: 'var(--color-warning)', fontWeight: 500 }}>Rp {(priceUpdateTarget.current_price_per_unit || 0).toLocaleString('id-ID')}</span> / {priceUpdateTarget.unit || 'unit'}
                      </div>
                    </div>
                    <form onSubmit={handlePriceUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Harga Terbaru per {priceUpdateTarget.unit || 'unit'} (Rp) *</label>
                        <input className="form-control" type="number" step="any" required value={priceUpdateValue} onChange={e => setPriceUpdateValue(e.target.value)} placeholder="Masukkan harga terbaru" autoFocus />
                        {priceUpdateValue && priceUpdateTarget.current_units > 0 && (
                          <small style={{ color: 'var(--color-success)', fontSize: '0.75rem', display: 'block', marginTop: '0.5rem', fontWeight: 500 }}>
                            Nilai baru: Rp {(parseFloat(priceUpdateValue) * priceUpdateTarget.current_units).toLocaleString('id-ID')}
                          </small>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowPriceUpdateModal(false)}>Batal</button>
                        <button type="submit" className="btn btn-primary">Update</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ── Modal: Tambah Transaksi ── */}
              {showAddInvTxModal && addInvTxTarget && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="glass-panel modal-content" style={{ maxWidth: '500px', width: '95%', padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                        <span>➕</span> Catat Transaksi — {addInvTxTarget.name}
                      </h3>
                      <button 
                        type="button" 
                        onClick={() => { setShowAddInvTxModal(false); setAddInvTxTarget(null); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                      >
                        ✕
                      </button>
                    </div>
                    <form onSubmit={handleAddInvTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Jenis Transaksi *</label>
                          <select className="form-control" value={invTxType} onChange={e => setInvTxType(e.target.value as any)}>
                            <option value="buy">🛒 Beli</option>
                            <option value="sell">💰 Jual</option>
                            <option value="dividend">💵 Dividen</option>
                            <option value="price_update">🔄 Update Harga</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Tanggal *</label>
                          <input className="form-control" type="date" required value={invTxDate} onChange={e => setInvTxDate(e.target.value)} />
                        </div>
                        
                        {(invTxType === 'buy' || invTxType === 'sell') && (
                          <>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>Jumlah Unit</label>
                              <input className="form-control" type="number" step="any" value={invTxUnits} onChange={e => setInvTxUnits(e.target.value)} placeholder="0" />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>Harga per Unit (Rp)</label>
                              <input className="form-control" type="number" step="any" value={invTxPrice} onChange={e => setInvTxPrice(e.target.value)} placeholder="0" />
                            </div>
                          </>
                        )}
                        
                        {invTxType === 'price_update' && (
                          <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                            <label>Harga per Unit Terbaru (Rp)</label>
                            <input className="form-control" type="number" step="any" value={invTxPrice} onChange={e => setInvTxPrice(e.target.value)} placeholder="0" />
                          </div>
                        )}
                        
                        <div className="form-group" style={{ gridColumn: (invTxType === 'dividend' || invTxType === 'price_update') ? '1 / -1' : 'auto', margin: 0 }}>
                          <label>
                            {invTxType === 'buy' ? 'Total Pembelian (Rp) *' : invTxType === 'sell' ? 'Total Penjualan (Rp) *' : invTxType === 'dividend' ? 'Jumlah Dividen (Rp) *' : 'Nilai (Rp) *'}
                          </label>
                          <input className="form-control" type="number" step="any" required value={invTxAmount} onChange={e => setInvTxAmount(e.target.value)} placeholder="0" />
                        </div>
                        
                        {(invTxType === 'buy' || invTxType === 'sell') && (
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Biaya / Fee (Rp)</label>
                            <input className="form-control" type="number" step="any" value={invTxFee} onChange={e => setInvTxFee(e.target.value)} placeholder="0" />
                          </div>
                        )}
                        
                        {(invTxType === 'buy' || invTxType === 'sell') && (
                          <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                            <label>Potong dari Akun (opsional)</label>
                            <select className="form-control" value={invTxAccountId} onChange={e => setInvTxAccountId(e.target.value)}>
                              <option value="">— Tidak potong kas —</option>
                              {accounts.filter(a => a.type === 'bank' || a.type === 'ewallet' || a.type === 'cash').map(a => (
                                <option key={a.id} value={a.id}>{a.name} — Rp {(a.current_balance || 0).toLocaleString('id-ID')}</option>
                              ))}
                            </select>
                            <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>Jika dipilih, transaksi keluar/masuk akan otomatis dicatat di akun tersebut.</small>
                          </div>
                        )}
                        
                        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                          <label>Catatan</label>
                          <input className="form-control" value={invTxNotes} onChange={e => setInvTxNotes(e.target.value)} placeholder="Catatan transaksi..." />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => { setShowAddInvTxModal(false); setAddInvTxTarget(null); }}>Batal</button>
                        <button type="submit" className="btn btn-primary">Catat Transaksi</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* -------------------------------------------------------------
            TAB 6: AI FINANCIAL HEALTH ADVISOR & SYSTEM SETTINGS
            ------------------------------------------------------------- */}
        {activeTab === 'ai' && (

          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h2>AI Financial Health Advisor</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Evaluate your overall fiscal metrics, identify spending leakages, and query budget optimization directives.
              </p>
            </div>

            {/* AI Health Advisor Report Renders */}
            <div className="glass-panel card-content" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🛡️</span> AI Financial Health Advisor
                  </h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.25rem', margin: 0 }}>
                    Receive a full financial health diagnostic score and tactical action recommendations.
                  </p>
                </div>

                <button
                  onClick={handleGenerateAiAnalysis}
                  className="btn btn-primary"
                  disabled={aiLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {aiLoading ? 'Analyzing...' : 'Generate New Report'}
                </button>
              </div>

              {aiLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '3rem 0' }}>
                  <div style={{
                    width: '50px', height: '50px',
                    border: '4px solid var(--color-primary-glow)',
                    borderTopColor: 'var(--color-primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '1rem'
                  }} />
                  <strong style={{ color: 'var(--color-primary)' }}>AI is gathering current database metrics...</strong>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    Evaluating budget caps, credit card limits, installments payload, and cash flows.
                  </span>
                </div>
              ) : aiAnalysis ? (
                <div style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.02)',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  overflowY: 'auto',
                  maxHeight: '700px',
                  lineHeight: '1.6',
                  color: '#e2e8f0',
                  fontSize: '0.95rem'
                }}>
                  {/* We render standard markdown with pre-wrap or styled components */}
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}>
                    {aiAnalysis}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '4rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</span>
                  <strong>No Report Generated Yet</strong>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', maxWidth: '400px' }}>
                    Ensure your AI Provider settings are configured correctly under the **Settings** tab, and then click **Generate New Report** to begin.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 7: SETTINGS
            ------------------------------------------------------------- */}
        {activeTab === 'settings' && (
          <div>
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
                        <th style={{ width: '35%', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedCategories.map(group => (
                        <React.Fragment key={group.parent.id}>
                          {/* Parent row edit or view */}
                          {editingCategoryId === group.parent.id ? (
                            <tr>
                              <td colSpan={2}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.25rem 0', flexWrap: 'wrap' }}>
                                  <input 
                                    type="text" 
                                    className="form-control" 
                                    value={editingCategoryName} 
                                    onChange={(e) => setEditingCategoryName(e.target.value)}
                                    style={{ flex: 2, margin: 0, padding: '0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '150px' }}
                                    required
                                  />
                                  <select
                                    className="form-control"
                                    value={editingCategoryType}
                                    onChange={(e) => setEditingCategoryType(e.target.value as any)}
                                    style={{ flex: 1, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '100px' }}
                                  >
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                    <option value="both">Both</option>
                                  </select>
                                  <select
                                    className="form-control"
                                    value={editingCategoryParentId}
                                    onChange={(e) => setEditingCategoryParentId(e.target.value)}
                                    style={{ flex: 1.5, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '150px' }}
                                  >
                                    <option value="">None (Parent Category)</option>
                                    {dbCategories
                                      .filter(c => !c.parent_id && c.id !== group.parent.id)
                                      .map(p => (
                                        <option key={p.id} value={p.id}>Move under: {p.name}</option>
                                      ))
                                    }
                                  </select>
                                  <button type="button" className="btn btn-primary" onClick={() => handleEditCategory(group.parent.id)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', margin: 0 }}>Save</button>
                                  <button type="button" className="btn btn-secondary" onClick={() => setEditingCategoryId(null)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', margin: 0 }}>Cancel</button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr>
                              <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                📁 {group.parent.name}
                                <span className="badge" style={{
                                  marginLeft: '0.5rem',
                                  fontSize: '0.65rem',
                                  padding: '0.1rem 0.35rem',
                                  background: group.parent.type === 'income' ? 'rgba(16, 185, 129, 0.1)' : group.parent.type === 'both' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  color: group.parent.type === 'income' ? 'var(--color-success)' : group.parent.type === 'both' ? 'var(--color-warning)' : 'var(--color-danger)'
                                }}>
                                  {(group.parent.type || 'expense').toUpperCase()}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button 
                                  type="button"
                                  className="btn" 
                                  style={{ padding: '0.25rem', color: 'var(--color-primary)', background: 'transparent', marginRight: '0.5rem' }}
                                  onClick={() => {
                                    setEditingCategoryId(group.parent.id);
                                    setEditingCategoryName(group.parent.name);
                                    setEditingCategoryType(group.parent.type || 'expense');
                                    setEditingCategoryParentId(group.parent.parent_id || '');
                                  }}
                                  title="Rename / Change Category Type"
                                >
                                  ✏️
                                </button>
                                <button 
                                  type="button"
                                  className="btn" 
                                  style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent' }}
                                  onClick={() => handleDeleteCategory(group.parent.id)}
                                >
                                  <Icons.Delete />
                                </button>
                              </td>
                            </tr>
                          )}

                          {/* Subcategory rows edit or view */}
                          {group.subs.map(sub => (
                            <React.Fragment key={sub.id}>
                              {editingCategoryId === sub.id ? (
                                <tr>
                                  <td colSpan={2}>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.25rem 0 0.25rem 2rem', flexWrap: 'wrap' }}>
                                      <input 
                                        type="text" 
                                        className="form-control" 
                                        value={editingCategoryName} 
                                        onChange={(e) => setEditingCategoryName(e.target.value)}
                                        style={{ flex: 2, margin: 0, padding: '0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '150px' }}
                                        required
                                      />
                                      <select
                                        className="form-control"
                                        value={editingCategoryType}
                                        onChange={(e) => setEditingCategoryType(e.target.value as any)}
                                        style={{ flex: 1, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '100px' }}
                                      >
                                        <option value="expense">Expense</option>
                                        <option value="income">Income</option>
                                        <option value="both">Both</option>
                                      </select>
                                      <select
                                        className="form-control"
                                        value={editingCategoryParentId}
                                        onChange={(e) => setEditingCategoryParentId(e.target.value)}
                                        style={{ flex: 1.5, margin: 0, padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '150px' }}
                                      >
                                        <option value="">None (Parent Category)</option>
                                        {dbCategories
                                          .filter(c => !c.parent_id && c.id !== sub.id)
                                          .map(p => (
                                            <option key={p.id} value={p.id}>Move under: {p.name}</option>
                                          ))
                                        }
                                      </select>
                                      <button type="button" className="btn btn-primary" onClick={() => handleEditCategory(sub.id)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', margin: 0 }}>Save</button>
                                      <button type="button" className="btn btn-secondary" onClick={() => setEditingCategoryId(null)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', margin: 0 }}>Cancel</button>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                <tr>
                                  <td style={{ paddingLeft: '2rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                    ↳ {sub.name}
                                    <span className="badge" style={{
                                      marginLeft: '0.5rem',
                                      fontSize: '0.6rem',
                                      padding: '0.05rem 0.25rem',
                                      background: sub.type === 'income' ? 'rgba(16, 185, 129, 0.1)' : sub.type === 'both' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                      color: sub.type === 'income' ? 'var(--color-success)' : sub.type === 'both' ? 'var(--color-warning)' : 'var(--color-danger)'
                                    }}>
                                      {(sub.type || 'expense').toUpperCase()}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button 
                                      type="button"
                                      className="btn" 
                                      style={{ padding: '0.25rem', color: 'var(--color-primary)', background: 'transparent', marginRight: '0.5rem' }}
                                      onClick={() => {
                                        setEditingCategoryId(sub.id);
                                        setEditingCategoryName(sub.name);
                                        setEditingCategoryType(sub.type || 'expense');
                                        setEditingCategoryParentId(sub.parent_id || '');
                                      }}
                                      title="Rename / Change Subcategory Type"
                                    >
                                      ✏️
                                    </button>
                                    <button 
                                      type="button"
                                      className="btn" 
                                      style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent' }}
                                      onClick={() => handleDeleteCategory(sub.id)}
                                    >
                                      <Icons.Delete />
                                    </button>
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
        )}


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

        {/* Edit Transaction Modal Overlay */}
        {editingTx && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '550px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>✏️</span> Edit Transaction Details
                </h3>
                <button 
                  type="button" 
                  onClick={() => setEditingTx(null)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditedTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <div className="form-group">
                  <label>Account / Credit Card</label>
                  <select 
                    className="form-control"
                    value={editTxAccountId}
                    onChange={(e) => setEditTxAccountId(e.target.value)}
                    required
                  >
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
                      value={editTxDate} 
                      onChange={(e) => {
                        setEditTxDate(e.target.value);
                        if (!editTxBookingDate || editTxBookingDate === editTxDate) {
                          setEditTxBookingDate(e.target.value);
                        }
                      }}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Booking Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={editTxBookingDate} 
                      onChange={(e) => setEditTxBookingDate(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '0.8fr 1.2fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Type</label>
                    <select 
                      className="form-control" 
                      value={editTxType} 
                      onChange={(e) => setEditTxType(e.target.value as any)}
                    >
                      <option value="expense">Expense (-)</option>
                      <option value="income">Income (+)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select 
                      className="form-control" 
                      value={editTxCategory} 
                      onChange={(e) => setEditTxCategory(e.target.value)}
                      required
                    >
                      {groupedCategories.map(group => {
                        const matchedSubs = group.subs;
                        return (
                          <optgroup key={group.parent.id} label={group.parent.name}>
                            <option value={group.parent.name}>{group.parent.name}</option>
                            {matchedSubs.map(sub => (
                              <option key={sub.id} value={sub.name}>↳ {sub.name}</option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 1fr', margin: '0 0 1rem 0', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Location/Merchant</label>
                    <AutocompleteInput 
                      className="form-control" 
                      placeholder="e.g. Starbucks, Mal Kelapa Gading" 
                      value={editTxLocationMerchant}
                      onChangeValue={setEditTxLocationMerchant}
                      suggestions={locationSuggestions}
                    />
                  </div>
                  <div className="form-group">
                    <label>Product/Service</label>
                    <AutocompleteInput 
                      className="form-control" 
                      placeholder="e.g. Coffee, Taxi Service" 
                      value={editTxProductService}
                      onChangeValue={setEditTxProductService}
                      suggestions={productSuggestions}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <AutocompleteInput 
                    className="form-control" 
                    placeholder="e.g. Starbucks, Transfer salary" 
                    value={editTxDesc}
                    onChangeValue={setEditTxDesc}
                    suggestions={descSuggestions}
                    required 
                  />
                </div>

                <div className="grid-cols-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', margin: 0, gap: '1rem' }}>
                  <div className="form-group">
                    <label>Amount (IDR)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder="e.g. 50000"
                      value={editTxAmount}
                      onChange={(e) => setEditTxAmount(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Note (Optional)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Keterangan..."
                      value={editTxNote}
                      onChange={(e) => setEditTxNote(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Hubungkan ke Hutang / Piutang (Koneksi Ledger)</label>
                  <select
                    className="form-control"
                    value={editTxDebtReceivableId}
                    onChange={(e) => setEditTxDebtReceivableId(e.target.value)}
                  >
                    <option value="">-- Tidak Terhubung (Mutasi Biasa) --</option>
                    {debtsReceivables.map(dr => (
                      <option key={dr.id} value={dr.id}>
                        [{dr.type === 'debt' ? 'HUTANG' : 'PIUTANG'}] {dr.person} - {dr.description} (Sisa: {formatIDR(dr.remaining_amount)})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Save Changes
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => setEditingTx(null)}
                  >
                    Cancel
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* Split Transaction Modal */}
        {((splittingTxIndex !== null && parsedData) || splittingLedgerTx !== null) && (() => {
          const targetTx = splittingLedgerTx !== null ? splittingLedgerTx : (splittingTxIndex !== null && parsedData ? parsedData.transactions[splittingTxIndex] : null);
          if (!targetTx) return null;
          
          const targetAmount = Math.abs(targetTx.amount);
          const allocatedAmount = splitRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
          const remainingAmount = targetAmount - allocatedAmount;
          const isBalanced = Math.abs(remainingAmount) < 0.01;

          return (
            <div className="modal-overlay">
              <div className="glass-panel modal-content" style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ✂️ Pecah Kategori Transaksi (Split)
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  Pecah transaksi <strong>"{targetTx.description}"</strong> sebesar <strong>{formatIDR(targetAmount)}</strong> menjadi beberapa sub-kategori.
                </p>

                <div className="table-container" style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>Kategori</th>
                        <th style={{ width: '18%' }}>Lokasi/Merchant</th>
                        <th style={{ width: '18%' }}>Produk/Layanan</th>
                        <th style={{ width: '15%' }}>Nominal (IDR)</th>
                        <th>Catatan</th>
                        <th style={{ width: '8%', textAlign: 'center' }}>Hapus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {splitRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td>
                            <select 
                              className="form-control"
                              value={row.category}
                              onChange={(e) => {
                                    const updated = [...splitRows];
                                    updated[rIdx].category = e.target.value;
                                    setSplitRows(updated);
                              }}
                              style={{ padding: '0.35rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', margin: 0 }}
                            >
                              {groupedCategories.map(group => {
                                    const rowType = targetTx.amount >= 0 ? 'income' : 'expense';
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
                          <td>
                            <AutocompleteInput 
                              className="form-control"
                              placeholder="Merchant..."
                              value={row.location_merchant}
                              onChangeValue={(val) => {
                                    const updated = [...splitRows];
                                    updated[rIdx].location_merchant = val;
                                    setSplitRows(updated);
                              }}
                              suggestions={locationSuggestions}
                              style={{ padding: '0.35rem', fontSize: '0.8rem', margin: 0 }}
                            />
                          </td>
                          <td>
                            <AutocompleteInput 
                              className="form-control"
                              placeholder="Produk..."
                              value={row.product_service}
                              onChangeValue={(val) => {
                                    const updated = [...splitRows];
                                    updated[rIdx].product_service = val;
                                    setSplitRows(updated);
                              }}
                              suggestions={productSuggestions}
                              style={{ padding: '0.35rem', fontSize: '0.8rem', margin: 0 }}
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              className="form-control"
                              placeholder="Nominal"
                              value={row.amount}
                              onChange={(e) => {
                                    const updated = [...splitRows];
                                    updated[rIdx].amount = e.target.value;
                                    setSplitRows(updated);
                              }}
                              style={{ padding: '0.35rem', fontSize: '0.8rem', margin: 0 }}
                              required
                            />
                          </td>
                          <td>
                            <input 
                              type="text"
                              className="form-control"
                              placeholder="Catatan..."
                              value={row.note}
                              onChange={(e) => {
                                    const updated = [...splitRows];
                                    updated[rIdx].note = e.target.value;
                                    setSplitRows(updated);
                              }}
                              style={{ padding: '0.35rem', fontSize: '0.8rem', margin: 0 }}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => {
                                    const updated = splitRows.filter((_, i) => i !== rIdx);
                                    setSplitRows(updated);
                              }}
                              disabled={splitRows.length <= 2}
                              style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent' }}
                            >
                              <Icons.Delete />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'rgba(255,255,255,0.01)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <div>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                            setSplitRows([...splitRows, {
                              category: targetTx.category || 'Others',
                              location_merchant: targetTx.location_merchant || '',
                              product_service: targetTx.product_service || '',
                              amount: '',
                              note: ''
                            }]);
                      }}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', margin: 0 }}
                    >
                      + Tambah Baris Pecahan
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', fontWeight: 600 }}>
                    <div>
                      Target: <span style={{ color: 'var(--color-text-main)' }}>{formatIDR(targetAmount)}</span>
                    </div>
                    <div>
                      Teralokasi: <span style={{ color: 'var(--color-primary)' }}>
                        {formatIDR(allocatedAmount)}
                      </span>
                    </div>
                    <div>
                      Sisa: <span style={{ color: isBalanced ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {formatIDR(remainingAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    onClick={handleConfirmSplit}
                    disabled={!isBalanced}
                  >
                    Konfirmasi Split ({splitRows.length} Pecahan)
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => {
                      setSplittingTxIndex(null);
                      setSplittingLedgerTx(null);
                      setSplitRows([]);
                    }}
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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
        {/* Add Debt/Receivable Modal */}
        {showAddDRModal && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>Catat Baru Hutang / Piutang</h3>
                <button 
                  type="button" 
                  onClick={() => setShowAddDRModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateDR} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Tipe Catatan</label>
                  <select
                    className="form-control"
                    value={drType}
                    onChange={(e) => setDrType(e.target.value as any)}
                    required
                  >
                    <option value="debt">Hutang (Saya Meminjam Uang)</option>
                    <option value="receivable">Piutang (Saya Meminjamkan Uang)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>{drType === 'debt' ? 'Pemberi Pinjaman' : 'Peminjam'}</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nama Orang/Pihak Terkait"
                    value={drPerson}
                    onChange={(e) => setDrPerson(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Nominal Jumlah Awal (IDR)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Nominal"
                    value={drAmount}
                    onChange={(e) => setDrAmount(e.target.value)}
                    min="1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Deskripsi / Keperluan</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Pinjaman modal usaha, Beli handphone"
                    value={drDescription}
                    onChange={(e) => setDrDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Tanggal Pinjam</label>
                    <input
                      type="date"
                      className="form-control"
                      value={drDate}
                      onChange={(e) => setDrDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Jatuh Tempo (Opsional)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={drDueDate}
                      onChange={(e) => setDrDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Akun Sumber / Tujuan (Opsional)</label>
                  <select
                    className="form-control"
                    value={drAccountId}
                    onChange={(e) => setDrAccountId(e.target.value)}
                  >
                    <option value="">-- Tanpa Akun Ledger (Mencatat Diluar App) --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type === 'bank' ? 'Bank' : acc.type === 'cash' ? 'Cash/Wallet' : 'Kartu Kredit'})
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '0.25rem' }}>
                    {drType === 'debt' 
                      ? 'Jika dipilih, saldo akun akan otomatis BERTAMBAH karena menerima uang pinjaman.' 
                      : 'Jika dipilih, saldo akun akan otomatis BERKURANG karena meminjamkan uang.'
                    }
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Simpan Catatan
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => setShowAddDRModal(false)}
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Repay / Collect Loan Modal */}
        {payingDR && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '450px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>
                  {payingDR.type === 'debt' ? 'Bayar Cicilan Hutang' : 'Terima Pembayaran Piutang'}
                </h3>
                <button 
                  type="button" 
                  onClick={() => setPayingDR(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Pihak Terkait:</span>
                  <strong>{payingDR.person}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Keterangan:</span>
                  <span>{payingDR.description}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Sisa Saldo:</span>
                  <strong style={{ color: payingDR.type === 'debt' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {renderAmount(payingDR.remaining_amount)}
                  </strong>
                </div>
              </div>

              <form onSubmit={handlePayDR} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Pilih Akun Rekening / Kas</label>
                  <select
                    className="form-control"
                    value={payAccountId}
                    onChange={(e) => setPayAccountId(e.target.value)}
                    required
                  >
                    <option value="">-- Pilih Rekening --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({renderAmount(acc.current_balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Nominal Pembayaran (IDR)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Nominal"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    max={payingDR.remaining_amount}
                    min="1"
                    required
                  />
                  <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '0.25rem' }}>
                    Maksimal pembayaran: {formatIDR(payingDR.remaining_amount)}
                  </small>
                </div>

                <div className="form-group">
                  <label>Tanggal Transaksi</label>
                  <input
                    type="date"
                    className="form-control"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Catatan Tambahan (Opsional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Pembayaran cicilan 1, Pelunasan"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, background: payingDR.type === 'debt' ? 'var(--color-danger)' : 'var(--color-success)', borderColor: payingDR.type === 'debt' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    Konfirmasi
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => setPayingDR(null)}
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Debt/Receivable Details & History Modal */}
        {viewDRDetails && (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel modal-content" style={{ width: '95%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>
                  🔍 Riwayat Transaksi: {viewDRDetails.type === 'debt' ? 'Hutang' : 'Piutang'} - {viewDRDetails.person}
                </h3>
                <button 
                  type="button" 
                  onClick={() => setViewDRDetails(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* DR Card Info */}
              <div className="grid-cols-3" style={{ gap: '1rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Keperluan / Deskripsi:</div>
                  <strong style={{ fontSize: '0.95rem' }}>{viewDRDetails.description}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Tanggal Pinjam:</div>
                  <strong style={{ fontSize: '0.95rem' }}>{viewDRDetails.date}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Status Kelunasan:</div>
                  <span className={`badge ${viewDRDetails.status === 'active' ? 'badge-danger' : 'badge-success'}`}>
                    {viewDRDetails.status === 'active' ? 'Belum Lunas' : 'Lunas'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Jumlah Nominal Awal:</div>
                  <strong>{formatIDR(viewDRDetails.amount)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Total Sisa Tagihan:</div>
                  <strong style={{ color: viewDRDetails.type === 'debt' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {formatIDR(viewDRDetails.remaining_amount)}
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Jatuh Tempo:</div>
                  <strong>{viewDRDetails.due_date || '-'}</strong>
                </div>
              </div>

              <h4 style={{ marginBottom: '0.75rem' }}>Daftar Mutasi / Aliran Dana Terkait</h4>
              <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Akun Rekening</th>
                      <th>Keterangan Mutasi</th>
                      <th style={{ textAlign: 'right' }}>Nominal (IDR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!viewDRDetails.payments || viewDRDetails.payments.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem' }}>
                          Belum ada transaksi pembayaran yang tercatat di ledger.
                        </td>
                      </tr>
                    ) : (
                      viewDRDetails.payments.map((p: any) => {
                        const accName = accounts.find((a: any) => a.id === p.account_id)?.name || 'Unknown Account';
                        return (
                          <tr key={p.id}>
                            <td>{p.date}</td>
                            <td>{accName}</td>
                            <td>{p.description}</td>
                            <td style={{ textAlign: 'right', fontWeight: '600', color: p.amount < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                              {p.amount < 0 ? '-' : '+'}{formatIDR(Math.abs(p.amount))}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setViewDRDetails(null)}
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
