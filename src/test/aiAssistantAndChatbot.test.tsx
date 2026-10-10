import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import {
  ChatIntentService,
  chatIntentService,
  normalizeRoute,
  formatCompactCurrency,
} from '../services/chatIntentService';
import { AiAssistantPage, renderFormattedText } from '../pages/AiAssistantPage';
import { apiService } from '../services/apiService';
import { supabase } from '../lib/supabase';
import { ToastProvider } from '../context/ToastContext';
import { ThemeProvider } from '../context/ThemeContext';

// Helper for rendering with MemoryRouter, ThemeProvider, and ToastProvider
function renderWithContext(ui: React.ReactElement, { route = '/ai-assistant' }: { route?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>
        <ToastProvider>{ui}</ToastProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('TASK 11 — AI Assistant (/ai-assistant) & Chatbot Intent Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    apiService.clearAllAppCache();
    ChatIntentService.clearCache();

    // Default mock for market signal tables to prevent network timeouts
    vi.spyOn(supabase, 'schema').mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as any);

    (window as any).__MOCK_PLAN__ = {
      isPro: false,
      isFeatureAccessible: true,
      trialDaysRemaining: 7,
      plan: 'b2c',
    };
  });

  afterEach(() => {
    delete (window as any).__MOCK_PLAN__;
    ChatIntentService.clearCache();
  });

  // ---------------------------------------------------------------------------
  // 1. Table-Driven Intent Tests (All 16 Intents, >= 2 Utterances Each + Whole Word Protection)
  // ---------------------------------------------------------------------------
  describe('1. Table-Driven Intent Tests (16 Intents, Whole-Word Matching, Out-of-Domain)', () => {
    const intentTestCases = [
      {
        intent: '1. Greetings & Bot Capabilities',
        utterances: ['hi assistant', 'hello there', 'namaste bot', 'what can you do for me'],
        expectedFragment: 'Hi! I am your **MoneyMapper Assistant**!',
        expectedRoute: '/dashboard',
      },
      {
        intent: '2. Profile & Account Settings',
        utterances: ['view my profile', 'i want to edit name', 'reset password please', 'where to logout'],
        expectedFragment: 'Manage your **personal details**',
        expectedRoute: '/profile',
      },
      {
        intent: '3. Master Data & Raw Vault',
        utterances: ['open my master data', 'show raw data vault', 'where are my salary slips'],
        expectedFragment: 'Access your **master financial records**',
        expectedRoute: '/master-data',
      },
      {
        intent: '4. Emergency Fund & Savings Pillar',
        utterances: ['how is my emergency fund', 'check my emergency savings', 'what is my liquidity cushion'],
        expectedFragment: 'Emergency Fund',
        expectedRoute: '/pillars/emergency',
      },
      {
        intent: '5. Income Pillar & Earnings',
        utterances: ['how is my active income', 'analyze my salary cashflow', 'show my passive income score'],
        expectedFragment: 'income sources',
        expectedRoute: '/pillars/income',
      },
      {
        intent: '6. Expenses & Budgeting (50/30/20)',
        utterances: ['analyze my spending habits', 'how is my fixed spend budget', 'explain the 50/30/20 rule'],
        expectedFragment: 'spending habits',
        expectedRoute: '/dashboard',
      },
      {
        intent: '7. Protection & Insurance Pillar',
        utterances: ['what is my protection pillar score', 'review my term insurance cover', 'check health insurance policy'],
        expectedFragment: 'insurance coverage',
        expectedRoute: '/pillars/insurance',
      },
      {
        intent: '8. Investments & Asset Allocation',
        utterances: ['show my investment score', 'how is my portfolio asset allocation', 'what is my wealth building status'],
        expectedFragment: 'investment portfolio',
        expectedRoute: '/pillars/investments',
      },
      {
        intent: '9. Mutual Funds & Market Schemes',
        utterances: ['show top mutual funds', 'tell me about elss schemes', 'where is the index fund'],
        expectedFragment: 'top-rated **Mutual Funds**',
        expectedRoute: '/pillars/investments',
      },
      {
        intent: '10. AI Recommendations & Advisory Engine',
        utterances: ['give me ai advice', 'show advisor recommendations', 'any financial suggestions for me'],
        expectedFragment: 'AI Advisory Engine',
        expectedRoute: '/insights',
      },
      {
        intent: '11. Weekly Expense Log & Tracker',
        utterances: ['open weekly tracker', 'spend log', 'track this week'],
        expectedFragment: 'log your **weekly expenses**',
        expectedRoute: '/weekly',
      },
      {
        intent: '12. Achievements, Badges & Rewards',
        utterances: ['show my achievements', 'what streak badge do i have', 'check gamification points'],
        expectedFragment: 'financial streak badges',
        expectedRoute: '/achievements',
      },
      {
        intent: '13. Corporate Wellness & Employer Benefits',
        utterances: ['show corporate wellness program', 'what are my employer benefits', 'open workforce analytics'],
        expectedFragment: 'corporate wellness program',
        expectedRoute: '/corporate-dashboard',
      },
      {
        intent: '14. Privacy & Data Security',
        utterances: ['how is my data encrypted', 'view privacy details', 'is screen recording blocked for safety'],
        expectedFragment: 'enterprise-grade security',
        expectedRoute: '/privacy',
      },
      {
        intent: '15. Onboarding & App Setup',
        utterances: ['restart my onboarding guide', 're-visit setup walkthrough', 'start initial financial baseline'],
        expectedFragment: 'onboarding setup',
        expectedRoute: '/onboarding',
      },
      {
        intent: '16. Main Dashboard & Financial Fitness Score',
        utterances: ['take me to dashboard overview', 'what is my overall fitness score', 'show main score summary'],
        expectedFragment: 'Financial',
        expectedRoute: '/dashboard',
      },
    ];

    intentTestCases.forEach(({ intent, utterances, expectedFragment, expectedRoute }) => {
      it(`correctly resolves ${intent} for multiple utterances`, async () => {
        for (const query of utterances) {
          const res = await chatIntentService.processMessage(query, { skipDelay: true });
          expect(res.text).toContain(expectedFragment);
          expect(normalizeRoute(res.redirectTo!)).toBe(expectedRoute);
        }
      });
    });

    it('ensures whole-word regex prevents short keywords from mis-firing and refined patterns work', async () => {
      // "hi" inside "achievements" must NOT trigger Greetings
      const achieveRes = await chatIntentService.processMessage('check my achievements', { skipDelay: true });
      expect(achieveRes.text).toContain('financial streak badges');
      expect(achieveRes.text).not.toContain('Hi! I am your **MoneyMapper Assistant**!');

      // "hi" inside "which" must NOT trigger Greetings
      const whichRes = await chatIntentService.processMessage('which expense category is high', { skipDelay: true });
      expect(whichRes.text).toContain('spending habits');
      expect(whichRes.text).not.toContain('Hi! I am your **MoneyMapper Assistant**!');

      // "ai" inside "explain" must NOT trigger AI Advisory
      const explainRes = await chatIntentService.processMessage('explain my dashboard score', { skipDelay: true });
      expect(explainRes.text).toContain('Financial Dashboard');
      expect(explainRes.text).not.toContain('Our **AI Advisory Engine**');

      // "ai" inside "main" must NOT trigger AI Advisory
      const mainRes = await chatIntentService.processMessage('show main dashboard', { skipDelay: true });
      expect(mainRes.text).toContain('Financial Dashboard');
      expect(mainRes.text).not.toContain('Our **AI Advisory Engine**');

      // "my sips" matches SIP in Investment
      const sipRes = await chatIntentService.processMessage('how are my sips performing', { skipDelay: true });
      expect(sipRes.text).toContain('investment portfolio');

      // "which MFs are good" matches MF
      const mfRes = await chatIntentService.processMessage('which MFs are good', { skipDelay: true });
      expect(mfRes.text).toContain('top-rated **Mutual Funds**');

      // "emergency fund" must NOT be swallowed by the mutual fund gate
      const efRes = await chatIntentService.processMessage('how is my emergency fund', { skipDelay: true });
      expect(efRes.text).toContain('Emergency Fund');
      expect(efRes.redirectTo).toBe('/pillars/emergency');
    });

    it('catches out-of-domain queries and redirects to dashboard with domain guidance', async () => {
      const outOfDomainQueries = [
        'what is the weather today in mumbai?',
        'who won the cricket match yesterday?',
        'can you write python code for bubble sort?',
        'give me a delicious dinner recipe for pizza',
      ];

      for (const query of outOfDomainQueries) {
        const res = await chatIntentService.processMessage(query, { skipDelay: true });
        expect(res.text).toContain('That topic is outside my domain!');
        expect(res.text).toContain('Personal Finance, Wealth Management');
        expect(res.redirectTo).toBe('/dashboard');
        expect(res.quickActions.length).toBeGreaterThan(0);
      }
    });

    it('returns generic financial fallback for unrecognized financial queries', async () => {
      const res = await chatIntentService.processMessage('xyz random gibberish query 123', { skipDelay: true });
      expect(res.text).toContain("I'm specialized in **Personal Finance & MoneyMapper App Features**!");
      expect(res.text).toContain("I couldn't find a direct match for that query");
      expect(res.quickActions).toEqual([
        { label: 'Stock Screener', route: '/stock-screener' },
        { label: 'MF Screener', route: '/mf-screener' },
        { label: 'Insurance Screener', route: '/insurance-screener' },
      ]);
    });

    it('formatCompactCurrency matches Dart 1:1 across tiers', () => {
      expect(formatCompactCurrency(99999)).toBe('₹100K');
      expect(formatCompactCurrency(100000)).toBe('₹1.0 Lakhs');
      expect(formatCompactCurrency(150000)).toBe('₹1.5 Lakhs');
      expect(formatCompactCurrency(9999999)).toBe('₹100.0 Lakhs');
      expect(formatCompactCurrency(10000000)).toBe('₹1.0 Cr');
      expect(formatCompactCurrency(25000000)).toBe('₹2.5 Cr');
      expect(formatCompactCurrency(0)).toBe('₹0');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Dashboard & Profile Fixtures vs Fallback Message
  // ---------------------------------------------------------------------------
  describe('2. Dashboard & Profile Fixtures vs Missing Data Fallbacks', () => {
    it('populates live Emergency Fund data from dashboard fixture; falls back cleanly when missing', async () => {
      // 1. With populated fixture
      vi.spyOn(apiService, 'getDashboard').mockResolvedValue({
        savings_scores: {
          ef_current_estimated: 150000,
          ef_target_amount: 300000,
        },
      } as any);

      const resPopulated = await chatIntentService.processMessage('emergency fund status', { skipDelay: true });
      expect(resPopulated.text).toContain('• Current Balance: **₹150000**');
      expect(resPopulated.text).toContain('• Target Cushion: **₹300000**');
      expect(resPopulated.text).toContain('• Shortfall: **₹150000**');

      // 2. With missing fixture (null)
      vi.spyOn(apiService, 'getDashboard').mockResolvedValue(null as any);
      const resFallback = await chatIntentService.processMessage('emergency fund status', { skipDelay: true });
      expect(resFallback.text).toBe(
        'Check your **Emergency Fund** status, savings readiness, and liquidity targets.'
      );
    });

    it('populates live Income data from dashboard fixture; falls back cleanly when missing', async () => {
      // 1. Populated
      vi.spyOn(apiService, 'getDashboard').mockResolvedValue({
        income_scores: {
          active_income_score: 85,
          passive_income_score: 40,
        },
      } as any);

      const resPopulated = await chatIntentService.processMessage('analyze my income cashflow', { skipDelay: true });
      expect(resPopulated.text).toContain('• Active Income Score: **85**');
      expect(resPopulated.text).toContain('• Passive Income Score: **40**');

      // 2. Missing
      vi.spyOn(apiService, 'getDashboard').mockResolvedValue(null as any);
      const resFallback = await chatIntentService.processMessage('analyze my income cashflow', { skipDelay: true });
      expect(resFallback.text).toBe(
        'Analyze your **income sources**, active vs passive earnings, and cashflow health.'
      );
    });

    it('populates live Expense data with custom tip from fixture; falls back cleanly when missing', async () => {
      // 1. Populated
      vi.spyOn(apiService, 'getDashboard').mockResolvedValue({
        expense_scores: {
          fixed_score: 65,
          flexible_score: 55,
          discipline_message: 'Limit online food orders on weekends.',
        },
      } as any);

      const resPopulated = await chatIntentService.processMessage('check spending and budget', { skipDelay: true });
      expect(resPopulated.text).toContain('• Fixed Spend Score: **65**');
      expect(resPopulated.text).toContain('• Flexible Spend Score: **55**');
      expect(resPopulated.text).toContain('• Tip: **Limit online food orders on weekends.**');

      // 2. Missing
      vi.spyOn(apiService, 'getDashboard').mockResolvedValue(null as any);
      const resFallback = await chatIntentService.processMessage('check spending and budget', { skipDelay: true });
      expect(resFallback.text).toBe(
        'Track your **spending habits**, fixed & flexible costs using the 50/30/20 budget framework.'
      );
    });

    it('populates Protection & Investment scores; falls back cleanly when missing', async () => {
      // 1. Protection populated
      vi.spyOn(apiService, 'getDashboard').mockResolvedValue({
        protection_scores: { term_score: 90, health_score: 80 },
        investment_scores: { equity_score: 75, sip_score: 85, asset_balance_score: 70 },
      } as any);

      const resProt = await chatIntentService.processMessage('my protection cover score', { skipDelay: true });
      expect(resProt.text).toContain('• Term Insurance Score: **90**');
      expect(resProt.text).toContain('• Health Insurance Score: **80**');

      const resInv = await chatIntentService.processMessage('my portfolio investment asset allocation', { skipDelay: true });
      expect(resInv.text).toContain('• Equity Score: **75**');
      expect(resInv.text).toContain('• SIP Score: **85**');
      expect(resInv.text).toContain('• Asset Balance Score: **70**');

      // 2. Missing
      vi.spyOn(apiService, 'getDashboard').mockResolvedValue(null as any);
      const resProtFb = await chatIntentService.processMessage('my protection cover score', { skipDelay: true });
      expect(resProtFb.text).toBe('Review your **insurance coverage**, term life plans, and health policies.');

      const resInvFb = await chatIntentService.processMessage('my portfolio investment asset allocation', { skipDelay: true });
      expect(resInvFb.text).toBe('Explore your **investment portfolio**, SIP allocations, and wealth building.');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Featured AI Questions & No Fabricated Defaults
  // ---------------------------------------------------------------------------
  describe('3. Featured AI Questions with Deterministic RNG & No Fabricated Numbers', () => {
    it("Today's best stock: deterministic RNG selection, omits missing fields without inventing numbers", async () => {
      // Mock Supabase stock signals
      const mockStocks = [
        {
          company_name: 'Tata Consultancy Services',
          symbol: 'TCS',
          score: 84,
          signal: 'BUY',
          sector: 'Information Technology',
          one_year_return: '28.4%',
        },
        {
          company_name: 'Reliance Industries',
          symbol: 'RELIANCE',
          score: 78,
          signal: 'BUY',
          // Notice: sector and return are intentionally null to test no-fabricated-defaults rule
          sector: null,
          one_year_return: null,
        },
      ];

      vi.spyOn(supabase, 'schema').mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: mockStocks, error: null }),
        }),
      } as any);

      // Deterministic RNG selector: choose index 1 (Reliance)
      ChatIntentService.stockIndexProvider = () => 1;

      const res = await chatIntentService.processMessage("What's today's best stock for me?", { skipDelay: true });
      expect(res.text).toContain('• **Company**: **Reliance Industries**');
      expect(res.text).toContain('• **Stock Score**: **78 / 100** ⭐');
      expect(res.text).toContain('• **Signal**: **BUY** 🚀');

      // Strictly verify NO fabricated defaults: sector and 1-year return lines must be omitted!
      expect(res.text).not.toContain('• **Sector**: Growth Sector');
      expect(res.text).not.toContain('• **1-Year Return**: 24.5%');
      expect(res.redirectTo).toBe('/stock-screener');
    });

    it('Which mutual fund suits my long-term goals: respects profile risk appetite and omits fabricated funds', async () => {
      vi.spyOn(apiService, 'getMasterProfile').mockResolvedValue({
        data: { riskAppetite: 'High' },
      });

      const mockFunds = [
        {
          scheme_name: 'Quant Small Cap Fund',
          category: 'Small Cap',
          cluster: 'High',
          score: 91,
        },
        {
          scheme_name: 'Nippon India Growth Fund',
          category: 'Mid Cap',
          cluster: 'High',
          score: 87,
        },
      ];

      vi.spyOn(supabase, 'schema').mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: mockFunds, error: null }),
        }),
      } as any);

      const res = await chatIntentService.processMessage('Which mutual fund suits my long-term goals?', { skipDelay: true });
      expect(res.text).toContain('Based on your profile risk appetite (**High**)');
      expect(res.text).toContain('1️⃣ **Quant Small Cap Fund**');
      expect(res.text).toContain('• **Score**: **91 / 100** ⭐');
      expect(res.text).toContain('2️⃣ **Nippon India Growth Fund**');

      // Omitted fabricated default funds
      expect(res.text).not.toContain('Parag Parikh Flexi Cap Fund');
      expect(res.text).not.toContain('SBI Bluechip Fund');
    });

    it('Best liquid fund: prints real category and labels 1-Year Return or Yield accurately', async () => {
      // Fund with one_year_return
      const mockFunds1 = [
        {
          scheme_name: 'Aditya Birla Sun Life Liquid Fund',
          category: 'Overnight Fund',
          score: 89,
          one_year_return: '6.9%',
        },
      ];
      vi.spyOn(supabase, 'schema').mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: mockFunds1, error: null }),
        }),
      } as any);

      const res1 = await chatIntentService.processMessage('Best liquid fund for my emergency needs?', { skipDelay: true });
      expect(res1.text).toContain('• **Category**: Overnight Fund');
      expect(res1.text).toContain('• **1-Year Return**: **6.9%**');
      expect(res1.text).not.toContain('Est. Annual Yield');

      // Fund with yield
      ChatIntentService.clearCache();
      const mockFunds2 = [
        {
          scheme_name: 'SBI Liquid Fund',
          category: 'Liquid Scheme',
          score: 88,
          yield: '7.2% p.a.',
        },
      ];
      vi.spyOn(supabase, 'schema').mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: mockFunds2, error: null }),
        }),
      } as any);

      const res2 = await chatIntentService.processMessage('Best liquid fund for my emergency needs?', { skipDelay: true });
      expect(res2.text).toContain('• **Category**: Liquid Scheme');
      expect(res2.text).toContain('• **Yield**: **7.2% p.a.**');
      expect(res2.text).not.toContain('Est. Annual Yield');
    });

    it('Which insurance fits my budget: missing or zero income omits cover figures and prompts for Master Data', async () => {
      const mockPlans = [
        { plan_name: 'HDFC Ergo Optima Secure', category: 'Health' },
        { plan_name: 'ICICI Pru iProtect Term Life', category: 'Life' },
      ];

      vi.spyOn(supabase, 'schema').mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: mockPlans, error: null }),
        }),
      } as any);

      // 1. Missing income
      vi.spyOn(apiService, 'getMasterProfile').mockResolvedValue({
        data: { monthlyActiveIncome: null },
      });
      const resMissing = await chatIntentService.processMessage('Which insurance fits my budget?', { skipDelay: true });
      expect(resMissing.text).toContain('Add your monthly income in Master Data to get tailored cover limits');
      expect(resMissing.text).not.toContain('Recommended Health Cover');
      expect(resMissing.text).not.toContain('Recommended Life Cover');
      expect(resMissing.redirectTo).toBe('/master-data?target=income');

      // 2. Zero income
      vi.spyOn(apiService, 'getMasterProfile').mockResolvedValue({
        data: { monthlyActiveIncome: 0 },
      });
      const resZero = await chatIntentService.processMessage('Which insurance fits my budget?', { skipDelay: true });
      expect(resZero.text).toContain('Add your monthly income in Master Data to get tailored cover limits');
      expect(resZero.redirectTo).toBe('/master-data?target=income');

      // 3. Populated income 50000 (yearly 6,00,000 -> health 60 Lakhs, life 90 Lakhs)
      vi.spyOn(apiService, 'getMasterProfile').mockResolvedValue({
        data: { monthlyActiveIncome: 50000 },
      });
      const res50k = await chatIntentService.processMessage('Which insurance fits my budget?', { skipDelay: true });
      expect(res50k.text).toContain('annual income of **₹6.0 Lakhs**');
      expect(res50k.text).toContain('• **Recommended Health Cover (10x)**: **₹60.0 Lakhs**');
      expect(res50k.text).toContain('• **Recommended Life Cover (15x)**: **₹90.0 Lakhs**');
      expect(res50k.redirectTo).toBe('/insurance-screener');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Score Card Gates & Fuzzy Matching
  // ---------------------------------------------------------------------------
  describe('4. Score Card Gates & Fuzzy Matching Delegation', () => {
    it('Stock Score Card: finds best match and delegates to ScoreCardAdvisor.generateStockAdvice', async () => {
      vi.spyOn(supabase, 'schema').mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [
              {
                company_name: 'Infosys Limited',
                symbol: 'INFY',
                score: 82,
                sector: 'IT Services',
                pe_ratio: '25.4',
                market_cap: 650000000000,
                signal: 'BUY',
              },
            ],
            error: null,
          }),
        }),
      } as any);

      const res = await chatIntentService.processMessage('tell me about Infosys share', { skipDelay: true });
      expect(res.text).toContain('### 📊 **Stock Score Card: Infosys Limited (INFY)**');
      expect(res.text).toContain('• **MoneyMapper Score:** **82/100**');
      expect(res.redirectTo).toBe('/stock-screener');
    });

    it('Mutual Fund Score Card: finds best match and delegates to ScoreCardAdvisor.generateMfAdvice', async () => {
      vi.spyOn(supabase, 'schema').mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [
              {
                scheme_name: 'SBI Bluechip Fund Direct Growth',
                category: 'Large Cap',
                final_score: 79,
                cagr_3yr: 18.5,
                aum_crores: 45000,
                risk_level: 'Very High',
              },
            ],
            error: null,
          }),
        }),
      } as any);

      const res = await chatIntentService.processMessage('give me details on sbi bluechip scheme', { skipDelay: true });
      expect(res.text).toContain('### 📈 **Mutual Fund Score Card: SBI Bluechip Fund Direct Growth**');
      expect(res.text).toContain('• **MoneyMapper Score:** **79/100**');
      expect(res.redirectTo).toBe('/mf-screener');
    });

    it('Insurance Score Card: finds best match and delegates to ScoreCardAdvisor.generateInsuranceDetails', async () => {
      vi.spyOn(supabase, 'schema').mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [
              {
                plan_name: 'Star Comprehensive Insurance Plan',
                company_name: 'Star Health',
                smart_score: 85,
                csr: 92.5,
                cover_amount: 1000000,
                annual_premium: 14500,
              },
            ],
            error: null,
          }),
        }),
      } as any);

      const res = await chatIntentService.processMessage('show star health policy details', { skipDelay: true });
      expect(res.text).toContain('### 🛡️ **Insurance Score Card: Star Comprehensive Insurance Plan**');
      expect(res.text).toContain('• **Claim Settlement Ratio (CSR):** **92.5%**');
      expect(res.redirectTo).toBe('/insurance-screener');
    });

    it('IPO Score Card: finds best match and delegates to ScoreCardAdvisor.generateIpoDetails', async () => {
      vi.spyOn(supabase, 'schema').mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [
              {
                company_name: 'Swiggy Limited',
                score: 76,
                price_band: '₹371 - ₹390',
                issue_size: 113270000000,
                bidding_dates: 'Nov 6 - Nov 8, 2024',
                gmp: '+₹12 (3.1%)',
              },
            ],
            error: null,
          }),
        }),
      } as any);

      const res = await chatIntentService.processMessage('tell me about upcoming Swiggy ipo', { skipDelay: true });
      expect(res.text).toContain('### 🚀 **IPO Score Card: Swiggy Limited**');
      expect(res.text).toContain('• **MoneyMapper Score:** **76/100**');
      expect(res.text).toContain('• **Price Band:** ₹371 - ₹390');
      expect(res.text).toContain('• **Grey Market Premium (GMP):** +₹12 (3.1%)');
    });

    it('Upcoming IPO score query does not fall through to the dashboard score intent', async () => {
      const res = await chatIntentService.processMessage('Upcoming IPO score', { skipDelay: true });

      expect(res.text).toContain("couldn't find active IPO score card details");
      expect(res.text).not.toContain('Financial Fitness Score');
      expect(res.redirectTo).toBe('/dashboard');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Safe Rendering, XSS & Storage Immunity
  // ---------------------------------------------------------------------------
  describe('5. Safe Tokenizer, XSS Defense, and Memory-Only Storage', () => {
    it('renderFormattedText parses **bold** into <strong> and protects against XSS injection', () => {
      const xssString = 'Check stock **Tata Motors** <img src=x onerror=alert(1)> now';
      const { container } = render(<div>{renderFormattedText(xssString)}</div>);

      // Strong element exists for bold
      const strongEl = container.querySelector('strong');
      expect(strongEl).not.toBeNull();
      expect(strongEl?.textContent).toBe('Tata Motors');

      // The malicious tag MUST NOT be rendered as a DOM element
      const imgEl = container.querySelector('img');
      expect(imgEl).toBeNull();

      // Malicious payload is safely rendered as escaped text
      expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    });

    it('audits storage: chat messages are strictly kept in memory, zero writes to localStorage / sessionStorage', async () => {
      renderWithContext(<AiAssistantPage />);

      const input = screen.getByTestId('ai-query-input');
      const sendBtn = screen.getByTestId('ai-send-button');

      fireEvent.change(input, { target: { value: 'explain my budget' } });
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(screen.getAllByTestId('chat-bubble-user').length).toBeGreaterThan(0);
      });

      // Assert no chat keys or message text in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        const val = localStorage.getItem(key)!;
        expect(val).not.toContain('explain my budget');
      }

      // Assert no chat keys or message text in sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)!;
        const val = sessionStorage.getItem(key)!;
        expect(val).not.toContain('explain my budget');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 6. UI Interaction & Dynamic Trial Lifecycle
  // ---------------------------------------------------------------------------
  describe('6. UI Interaction, Suggestion Chips, Quick Actions & Dynamic Trial', () => {
    it('renders initial welcome bubble with the 4 featured question quick actions', () => {
      renderWithContext(<AiAssistantPage />);

      expect(screen.getByTestId('ai-header')).toBeInTheDocument();
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.getByTestId('chat-bubble-bot')).toHaveTextContent("Hi! I'm your AI Assistant");

      // Verify the 4 quick action chips in welcome message
      expect(screen.getByText("What's today's best stock for me?")).toBeInTheDocument();
      expect(screen.getByText('Which mutual fund suits my long-term goals?')).toBeInTheDocument();
      expect(screen.getByText('Best liquid fund for my emergency needs?')).toBeInTheDocument();
      expect(screen.getByText('Which insurance fits my budget?')).toBeInTheDocument();
    });

    it('clicking a suggestion chip triggers query execution and renders user bubble', async () => {
      vi.spyOn(chatIntentService, 'processMessage').mockResolvedValue({
        id: 'reply-1',
        sender: 'bot',
        text: 'Here is your emergency fund status.',
        redirectTo: '/pillars/emergency',
        redirectLabel: 'Check Emergency Fund',
        quickActions: [],
        timestamp: '10:00 AM',
      });

      renderWithContext(<AiAssistantPage />);

      const efChip = screen.getByTestId('suggestion-chip-4'); // Emergency Fund chip
      fireEvent.click(efChip);

      await waitFor(() => {
        expect(screen.getByTestId('chat-bubble-user')).toHaveTextContent('Emergency Fund');
        expect(screen.getByText('Here is your emergency fund status.')).toBeInTheDocument();
      });
    });

    it('displays dynamic trial badges for n = 7, 3, 1', () => {
      // 1. n = 7
      (window as any).__MOCK_PLAN__ = { isPro: false, isFeatureAccessible: true, trialDaysRemaining: 7, plan: 'b2c' };
      const { rerender } = renderWithContext(<AiAssistantPage />);
      expect(screen.getByTestId('ai-trial-badge')).toHaveTextContent('TRIAL: 7D LEFT');
      expect(screen.getByTestId('free-trial-banner')).toHaveTextContent('⚡ FREE TRIAL: 7-Day AI Assistant Access Active');

      // 2. n = 3
      (window as any).__MOCK_PLAN__ = { isPro: false, isFeatureAccessible: true, trialDaysRemaining: 3, plan: 'b2c' };
      rerender(
        <MemoryRouter initialEntries={['/ai-assistant']}>
          <ThemeProvider>
            <ToastProvider>
              <AiAssistantPage />
            </ToastProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
      expect(screen.getByTestId('ai-trial-badge')).toHaveTextContent('TRIAL: 3D LEFT');
      expect(screen.getByTestId('free-trial-banner')).toHaveTextContent('⚡ FREE TRIAL: 3-Day AI Assistant Access Active');

      // 3. n = 1
      (window as any).__MOCK_PLAN__ = { isPro: false, isFeatureAccessible: true, trialDaysRemaining: 1, plan: 'b2c' };
      rerender(
        <MemoryRouter initialEntries={['/ai-assistant']}>
          <ThemeProvider>
            <ToastProvider>
              <AiAssistantPage />
            </ToastProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
      expect(screen.getByTestId('ai-trial-badge')).toHaveTextContent('TRIAL: 1D LEFT');
      expect(screen.getByTestId('free-trial-banner')).toHaveTextContent('⚡ FREE TRIAL: 1-Day AI Assistant Access Active');
    });

    it('renders locked view when trial has ended (n = 0, isPro = false)', () => {
      (window as any).__MOCK_PLAN__ = {
        isPro: false,
        isFeatureAccessible: false,
        trialDaysRemaining: 0,
        plan: 'b2c',
      };

      renderWithContext(<AiAssistantPage />);

      expect(screen.getByTestId('locked-ai-view')).toBeInTheDocument();
      expect(screen.getByText('Unlock MoneyMapper AI Assistant 🚀')).toBeInTheDocument();
      expect(screen.getByTestId('upgrade-to-pro-btn')).toBeInTheDocument();

      // Chat container and input bar must be locked / not rendered
      expect(screen.queryByTestId('chat-messages-container')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ai-input-bar')).not.toBeInTheDocument();
    });

    it('PRO users do NOT see trial badges or banners, and have full access', () => {
      (window as any).__MOCK_PLAN__ = {
        isPro: true,
        isFeatureAccessible: true,
        trialDaysRemaining: 0,
        plan: 'b2c_pro',
      };

      renderWithContext(<AiAssistantPage />);

      expect(screen.queryByTestId('ai-trial-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('free-trial-banner')).not.toBeInTheDocument();
      expect(screen.queryByTestId('locked-ai-view')).not.toBeInTheDocument();
      expect(screen.getByTestId('chat-messages-container')).toBeInTheDocument();
    });
  });
});
