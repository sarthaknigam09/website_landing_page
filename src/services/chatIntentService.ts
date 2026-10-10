import { supabase } from '../lib/supabase';
import { apiService } from './apiService';
import { ScoreCardAdvisor } from './marketAdvisor';

export interface QuickAction {
  label: string;
  route: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  redirectTo?: string | null;
  redirectLabel?: string | null;
  quickActions: QuickAction[];
  timestamp: string; // "hh:mm a" format
}

interface IntentRule {
  keywords: string[];
  route: string;
  redirectLabel: string;
  responseBuilder: (data: Record<string, any> | null) => string;
}

export function normalizeRoute(route: string): string {
  const map: Record<string, string> = {
    '/emergency_fund_p': '/pillars/emergency',
    '/income_p': '/pillars/income',
    '/mutual_fund_p': '/pillars/investments',
    '/insurance_p': '/pillars/insurance',
    '/weekly_expense_p': '/pillars/expenses',
    '/ai': '/insights',
    '/stock_screener': '/stock-screener',
    '/mf_screener': '/mf-screener',
    '/insurance_screener': '/insurance-screener',
    '/master_data': '/master-data',
    '/corporate_dashboard': '/corporate-dashboard',
  };
  return map[route] ?? route;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Port of chat_intent_service.dart _formatCompactCurrency:
 * >= 10000000 -> "₹{x.toStringAsFixed(1)} Cr"
 * >= 100000 -> "₹{x.toStringAsFixed(1)} Lakhs"
 * >= 1000 -> "₹{(x / 1000).round()}K"
 * else -> "₹{x.round()}"
 */
export function formatCompactCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} Lakhs`;
  if (amount >= 1000) return `₹${Math.round(amount / 1000)}K`;
  return `₹${Math.round(amount)}`;
}

/**
 * Word-boundary matching refinement:
 * - hi and hey: \b(hi|hey)\b
 * - ai: \bai\b
 * - bot: \bbot\b
 * - sip: \bsips?\b
 * - mf: \bmfs?\b
 * - short out-of-domain keywords (<= 3 chars): \b<kw>\b
 * - longer keywords: substring includes
 */
export function matchesKeyword(query: string, keyword: string): boolean {
  const kw = keyword.toLowerCase().trim();
  if (!kw) return false;

  if (kw === 'hi' || kw === 'hey') {
    return /\b(hi|hey)\b/i.test(query);
  }
  if (kw === 'ai') {
    return /\bai\b/i.test(query);
  }
  if (kw === 'bot') {
    return /\bbot\b/i.test(query);
  }
  if (kw === 'sip') {
    return /\bsips?\b/i.test(query);
  }
  if (kw === 'mf') {
    return /\bmfs?\b/i.test(query);
  }
  if (kw.length <= 3) {
    const regex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i');
    return regex.test(query);
  }
  return query.includes(kw);
}

export class ChatIntentService {
  // In-Memory Local Caches for Market Signals
  private static _cachedStocks: Record<string, any>[] | null = null;
  private static _cachedFunds: Record<string, any>[] | null = null;
  private static _cachedPlans: Record<string, any>[] | null = null;
  private static _cachedIpos: Record<string, any>[] | null = null;

  // Optional clock/RNG override for deterministic testing
  public static stockIndexProvider: (() => number) | null = null;

  public static clearCache(): void {
    this._cachedStocks = null;
    this._cachedFunds = null;
    this._cachedPlans = null;
    this._cachedIpos = null;
    this.stockIndexProvider = null;
  }

  private readonly _intentRules: IntentRule[] = [
    // 1. Greetings & Bot Capabilities
    {
      keywords: [
        'hi',
        'hello',
        'hey',
        'namaste',
        'who are you',
        'help',
        'what can you do',
        'options',
        'menu',
        'bot',
      ],
      route: '/dashboard',
      redirectLabel: 'Go to Dashboard',
      responseBuilder: () =>
        'Hi! I am your **MoneyMapper Assistant**!\n\n' +
        'I can answer questions about all app features, your 5 financial health pillars, emergency reserves, mutual funds, weekly budgets, and redirect you anywhere in the app.\n\n' +
        'Try asking about your **Emergency Fund**, **Income**, **Mutual Funds**, **Achievements**, or **Profile**!',
    },

    // 2. Profile & Account Settings
    {
      keywords: [
        'profile',
        'user settings',
        'edit name',
        'my info',
        'account',
        'personal details',
        'password',
        'reset password',
        'login',
        'logout',
      ],
      route: '/profile',
      redirectLabel: 'View Profile',
      responseBuilder: () =>
        'Manage your **personal details**, account settings, security preferences, and profile information in the Profile section.',
    },

    // 3. Master Data & Raw Vault
    {
      keywords: [
        'master data',
        'raw data',
        'documents',
        'records',
        'bank accounts',
        'salary slips',
        'data vault',
      ],
      route: '/master_data',
      redirectLabel: 'Open Master Data',
      responseBuilder: () =>
        'Access your **master financial records**, uploaded salary slips, bank account details, and raw data profile.',
    },

    // 4. Emergency Fund & Emergency Savings Pillar
    {
      keywords: [
        'emergency fund',
        'emergency savings',
        'emergency savings pillar',
        'savings pillar',
        'liquidity',
        'shortfall',
        'months covered',
        'emergency',
        'savings',
      ],
      route: '/emergency_fund_p',
      redirectLabel: 'Check Emergency Fund',
      responseBuilder: (data) => {
        const savings = data?.savings_scores;
        if (savings) {
          const current = Number(savings.ef_current_estimated ?? 0);
          const target = Number(savings.ef_target_amount ?? 0);
          const shortfall = target - current > 0 ? target - current : 0;
          return (
            'Your **Emergency Fund** status:\n' +
            `• Current Balance: **₹${current.toFixed(0)}**\n` +
            `• Target Cushion: **₹${target.toFixed(0)}**\n` +
            `• Shortfall: **₹${shortfall.toFixed(0)}**\n\n` +
            'Keep at least 6 months of expenses liquid for safety!'
          );
        }
        return 'Check your **Emergency Fund** status, savings readiness, and liquidity targets.';
      },
    },

    // 5. Income Pillar & Earnings
    {
      keywords: [
        'income',
        'salary',
        'passive income',
        'active income',
        'earning',
        'cashflow',
      ],
      route: '/income_p',
      redirectLabel: 'Analyze Income',
      responseBuilder: (data) => {
        const income = data?.income_scores;
        if (income) {
          const active = income.active_income_score ?? 0;
          const passive = income.passive_income_score ?? 0;
          return (
            'Here is your **Income Pillar** breakdown:\n' +
            `• Active Income Score: **${active}**\n` +
            `• Passive Income Score: **${passive}**\n\n` +
            'Track cashflow and build passive streams to grow your wealth!'
          );
        }
        return 'Analyze your **income sources**, active vs passive earnings, and cashflow health.';
      },
    },

    // 6. Expenses & Budgeting (50/30/20 Rule)
    {
      keywords: [
        'expense',
        'spending',
        'fixed spend',
        'flexible spend',
        '50/30/20',
        'budget',
      ],
      route: '/dashboard',
      redirectLabel: 'View Dashboard',
      responseBuilder: (data) => {
        const expense = data?.expense_scores;
        if (expense) {
          const fixed = expense.fixed_score ?? 0;
          const flex = expense.flexible_score ?? 0;
          const tip = expense.discipline_message ?? 'Keep tracking expenses daily.';
          return (
            'Your **Expense & Budget** Breakdown:\n' +
            `• Fixed Spend Score: **${fixed}**\n` +
            `• Flexible Spend Score: **${flex}**\n` +
            `• Tip: **${tip}**`
          );
        }
        return 'Track your **spending habits**, fixed & flexible costs using the 50/30/20 budget framework.';
      },
    },

    // 7. Protection & Insurance Pillar
    {
      keywords: [
        'protection',
        'insurance',
        'term insurance',
        'health insurance',
        'cover',
        'floater',
        'policy',
      ],
      route: '/insurance_p',
      redirectLabel: 'Insurance Review',
      responseBuilder: (data) => {
        const prot = data?.protection_scores;
        if (prot) {
          const term = prot.term_score ?? 0;
          const health = prot.health_score ?? 0;
          return (
            'Your **Protection Pillar** status:\n' +
            `• Term Insurance Score: **${term}**\n` +
            `• Health Insurance Score: **${health}**`
          );
        }
        return 'Review your **insurance coverage**, term life plans, and health policies.';
      },
    },

    // 8. Investments & Asset Allocation
    {
      keywords: [
        'investment',
        'wealth',
        'sip',
        'equity',
        'debt',
        'gold',
        'portfolio',
        'asset allocation',
      ],
      route: '/mutual_fund_p',
      redirectLabel: 'Explore Investments',
      responseBuilder: (data) => {
        const inv = data?.investment_scores;
        if (inv) {
          const equity = inv.equity_score ?? 0;
          const sip = inv.sip_score ?? 0;
          const asset = inv.asset_balance_score ?? 0;
          return (
            'Your **Investment Pillar** status:\n' +
            `• Equity Score: **${equity}**\n` +
            `• SIP Score: **${sip}**\n` +
            `• Asset Balance Score: **${asset}**`
          );
        }
        return 'Explore your **investment portfolio**, SIP allocations, and wealth building.';
      },
    },

    // 9. Mutual Funds & Market Schemes
    {
      keywords: [
        'mutual fund',
        'funds',
        'elss',
        'nifty 50',
        'index fund',
        'sip calculator',
        'invest',
        'mf',
        'mfs',
      ],
      route: '/mutual_fund_p',
      redirectLabel: 'Explore Mutual Funds',
      responseBuilder: () =>
        'Explore top-rated **Mutual Funds**, ELSS tax saving schemes, and SIP calculators tailored for your risk profile.',
    },

    // 10. AI Recommendations & Advisory Engine
    {
      keywords: [
        'ai',
        'recommendation',
        'advisor',
        'insights',
        'advice',
        'suggestions',
      ],
      route: '/ai',
      redirectLabel: 'Open AI Advisory',
      responseBuilder: () =>
        'Our **AI Advisory Engine** analyzes your 5 financial pillars to give personalized action items, savings optimization, and smart wealth strategies.',
    },

    // 11. Weekly Expense Log & Tracker
    {
      keywords: [
        'weekly',
        'tracker',
        'log expense',
        'this week',
        'weekly budget',
        'weekly tracker',
        'spend log',
      ],
      route: '/weekly',
      redirectLabel: 'Log Weekly Expenses',
      responseBuilder: () =>
        'Track and log your **weekly expenses** against your target monthly budget to build spending discipline.',
    },

    // 12. Achievements, Badges & Rewards
    {
      keywords: [
        'achievement',
        'badge',
        'streak',
        'level',
        'rewards',
        'points',
        'leaderboard',
        'gamification',
      ],
      route: '/achievements',
      redirectLabel: 'View Badges',
      responseBuilder: () =>
        'Check out your **achievements**, financial streak badges, reward levels, and community rank!',
    },

    // 13. Corporate Wellness & Employer Benefits
    {
      keywords: [
        'corporate',
        'company',
        'employer',
        'benefits',
        'wellness program',
        'hr',
        'workforce',
      ],
      route: '/corporate_dashboard',
      redirectLabel: 'Corporate Dashboard',
      responseBuilder: () =>
        'Access your **corporate wellness program**, employer-sponsored benefits, and workforce analytics.',
    },

    // 14. Privacy & Data Security
    {
      keywords: [
        'privacy',
        'security',
        'data protection',
        'screen recording',
        'encrypted',
        'privacy policy',
        'safety',
      ],
      route: '/privacy',
      redirectLabel: 'View Privacy Policy',
      responseBuilder: () =>
        'Your financial data is protected with **enterprise-grade security**, automatic screen blur on app switch, screenshot prevention, and AES encryption.',
    },

    // 15. Onboarding & App Setup
    {
      keywords: ['onboard', 'setup', 'walkthrough', 'guide', 'start'],
      route: '/onboarding',
      redirectLabel: 'Start Onboarding',
      responseBuilder: () =>
        'Re-visit the **onboarding setup** to update your primary financial baseline and initial preferences.',
    },

    // 16. Main Dashboard & Financial Fitness Score
    {
      keywords: [
        'dashboard',
        'home',
        'overview',
        'main',
        'score',
        'overall',
        'fitness score',
      ],
      route: '/dashboard',
      redirectLabel: 'Go to Dashboard',
      responseBuilder: (data) => {
        const fitness = data?.financial_fitness_scores;
        if (fitness) {
          const score = fitness.global_fitness_score ?? 0;
          return (
            `Your overall **Financial Fitness Score** is **${score}**.\n` +
            'Navigate to the dashboard for a full overview of all 5 pillars.'
          );
        }
        return 'View your main **Financial Dashboard** and overall 5-pillar health score.';
      },
    },
  ];

  private async _getStocks(): Promise<Record<string, any>[]> {
    if (ChatIntentService._cachedStocks && ChatIntentService._cachedStocks.length > 0) {
      return ChatIntentService._cachedStocks;
    }
    try {
      const { data } = await supabase.schema('bse_data').from('stock_signals').select();
      ChatIntentService._cachedStocks = (data as Record<string, any>[]) || [];
      return ChatIntentService._cachedStocks;
    } catch {
      return ChatIntentService._cachedStocks ?? [];
    }
  }

  private async _getFunds(): Promise<Record<string, any>[]> {
    if (ChatIntentService._cachedFunds && ChatIntentService._cachedFunds.length > 0) {
      return ChatIntentService._cachedFunds;
    }
    try {
      const { data } = await supabase.schema('bse_data').from('mutual_fund_signals').select();
      ChatIntentService._cachedFunds = (data as Record<string, any>[]) || [];
      return ChatIntentService._cachedFunds;
    } catch {
      return ChatIntentService._cachedFunds ?? [];
    }
  }

  private async _getPlans(): Promise<Record<string, any>[]> {
    if (ChatIntentService._cachedPlans && ChatIntentService._cachedPlans.length > 0) {
      return ChatIntentService._cachedPlans;
    }
    try {
      const { data } = await supabase.schema('bse_data').from('insurance_plans').select();
      ChatIntentService._cachedPlans = (data as Record<string, any>[]) || [];
      return ChatIntentService._cachedPlans;
    } catch {
      return ChatIntentService._cachedPlans ?? [];
    }
  }

  private async _getIpos(): Promise<Record<string, any>[]> {
    if (ChatIntentService._cachedIpos && ChatIntentService._cachedIpos.length > 0) {
      return ChatIntentService._cachedIpos;
    }
    try {
      const { data } = await supabase.schema('bse_data').from('ipo_signals').select();
      ChatIntentService._cachedIpos = (data as Record<string, any>[]) || [];
      return ChatIntentService._cachedIpos;
    } catch {
      return ChatIntentService._cachedIpos ?? [];
    }
  }

  private _formatTimestamp(date: Date): string {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    const hoursStr = hours < 10 ? '0' + hours : hours;
    return `${hoursStr}:${minutesStr} ${ampm}`;
  }

  /**
   * Main processor for incoming user messages
   */
  async processMessage(queryText: string, options?: { skipDelay?: boolean }): Promise<ChatMessage> {
    const timestamp = this._formatTimestamp(new Date());

    // 1. Check if query matches a Score Card entry (Stock, MF, Insurance, IPO, or Featured Questions)
    const scoreCardMsg = await this._tryResolveScoreCardQuery(queryText, timestamp);
    if (scoreCardMsg) return scoreCardMsg;

    // Artificial 300ms delay for natural typing feel unless skipped (in tests)
    if (!options?.skipDelay) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    let dashboardData: Record<string, any> | null = null;
    try {
      dashboardData = await apiService.getDashboard();
    } catch {
      dashboardData = null;
    }

    const normalizedQuery = queryText.toLowerCase().trim();

    // 2. Evaluate Intent Rules 1..16 in order
    for (const rule of this._intentRules) {
      for (const keyword of rule.keywords) {
        if (matchesKeyword(normalizedQuery, keyword)) {
          let responseText: string;
          try {
            responseText = rule.responseBuilder(dashboardData);
          } catch {
            responseText =
              'View your **Financial Health Dashboard** for detailed insights on this category.';
          }

          return {
            id: Date.now().toString(),
            sender: 'bot',
            text: responseText,
            redirectTo: normalizeRoute(rule.route),
            redirectLabel: rule.redirectLabel,
            quickActions: [],
            timestamp,
          };
        }
      }
    }

    // 3. Out-of-Domain Query Detector
    const outOfDomainKeywords = [
      'weather',
      'rain',
      'temperature',
      'forecast',
      'climate',
      'recipe',
      'cook',
      'food',
      'pizza',
      'burger',
      'restaurant',
      'dinner',
      'movie',
      'film',
      'song',
      'music',
      'game',
      'cricket',
      'football',
      'actor',
      'netflix',
      'python',
      'java',
      'javascript',
      'code',
      'html',
      'css',
      'debug',
      'president',
      'capital',
      'planet',
      'space',
      'quantum',
      'politics',
      'joke',
      'sing',
      'dance',
      'love',
      'relationship',
      'who won',
    ];

    for (const kw of outOfDomainKeywords) {
      if (matchesKeyword(normalizedQuery, kw)) {
        return {
          id: Date.now().toString(),
          sender: 'bot',
          text:
            'That topic is outside my domain! I am **MoneyMapper Assistant**, specialized exclusively in **Personal Finance, Wealth Management & MoneyMapper App Features**.\n\n' +
            'I can help you with:\n' +
            '• 📊 **Financial Fitness Score** & 5-Pillar Analysis\n' +
            '• 🚨 **Emergency Reserve** & Liquidity Cushion\n' +
            '• 📈 **Mutual Funds**, SIPs & Asset Allocation\n' +
            '• 💼 **Income & Expense Budgeting** (50/30/20 Rule)\n' +
            '• 🛡️ **Insurance & Term/Health Cover**\n' +
            '• 🏆 **Achievements**, Rewards & Badges',
          redirectTo: '/dashboard',
          redirectLabel: 'Explore MoneyMapper Dashboard',
          quickActions: [
            { label: 'Financial Score', route: '/dashboard' },
            { label: 'Emergency Fund', route: '/pillars/emergency' },
            { label: 'Mutual Funds', route: '/pillars/investments' },
            { label: 'Profile', route: '/profile' },
          ],
          timestamp,
        };
      }
    }

    // 4. Generic fallback for unrecognized financial queries
    return {
      id: Date.now().toString(),
      sender: 'bot',
      text:
        "I'm specialized in **Personal Finance & MoneyMapper App Features**!\n\n" +
        "I couldn't find a direct match for that query. Try asking about **Reliance Stock**, **SBI Mutual Fund**, **Health Insurance**, or **Upcoming IPOs**.",
      redirectTo: '/dashboard',
      redirectLabel: 'Go to Dashboard',
      quickActions: [
        { label: 'Stock Screener', route: '/stock-screener' },
        { label: 'MF Screener', route: '/mf-screener' },
        { label: 'Insurance Screener', route: '/insurance-screener' },
      ],
      timestamp,
    };
  }

  private async _tryResolveFeaturedAiQuestions(
    norm: string,
    timestamp: string
  ): Promise<ChatMessage | null> {
    // Question 1: "What's today's best stock for me?"
    if (
      norm.includes("today's best stock") ||
      norm.includes('best stock for me') ||
      (norm.includes('best stock') && norm.includes('today'))
    ) {
      const stocks = await this._getStocks();

      const buyStocks = stocks.filter((s) => {
        const rawScore = s.score ?? s.stock_score ?? s.score_card ?? 0;
        const score = parseFloat(rawScore.toString()) || 0;
        const signal = (s.signal ?? s.buy_signal ?? '').toString().toUpperCase();
        return score >= 70 || signal === 'BUY';
      });

      if (buyStocks.length === 0 && stocks.length === 0) {
        return {
          id: Date.now().toString(),
          sender: 'bot',
          text: 'Stock Score Card data is currently unavailable. Please explore active signals in our Stock Screener!',
          redirectTo: '/stock-screener',
          redirectLabel: 'Explore Stock Screener',
          quickActions: [{ label: 'Stock Screener', route: '/stock-screener' }],
          timestamp,
        };
      }

      // Injectable RNG / clock index for deterministic testing
      const index = ChatIntentService.stockIndexProvider
        ? ChatIntentService.stockIndexProvider() % (buyStocks.length || stocks.length)
        : new Date().getSeconds() % (buyStocks.length || stocks.length);

      const selectedStock = buyStocks.length > 0 ? buyStocks[index] : stocks[0];

      if (selectedStock) {
        const name =
          selectedStock.company_name ??
          selectedStock.stock_name ??
          selectedStock.symbol ??
          selectedStock.name;
        const rawScore =
          selectedStock.score ?? selectedStock.stock_score ?? selectedStock.score_card;
        const score =
          rawScore !== null && rawScore !== undefined
            ? Math.round(parseFloat(rawScore.toString()) || 0)
            : null;
        const signal = selectedStock.signal ?? selectedStock.buy_signal;
        const sector = selectedStock.sector ?? selectedStock.industry;
        const return1Y = selectedStock.one_year_return ?? selectedStock.cagr;

        const lines: string[] = ["📊 **Today's Top Recommended Stock for You**:\n"];
        if (name) lines.push(`• **Company**: **${name}**`);
        if (score !== null) lines.push(`• **Stock Score**: **${score} / 100** ⭐`);
        if (signal) lines.push(`• **Signal**: **${signal}** 🚀`);
        if (sector) lines.push(`• **Sector**: ${sector}`);
        if (return1Y) lines.push(`• **1-Year Return**: ${return1Y}`);
        lines.push(
          '\n💡 *This stock is selected from our score card engine with a high score (≥70) and positive momentum.*'
        );

        return {
          id: Date.now().toString(),
          sender: 'bot',
          text: lines.join('\n'),
          redirectTo: '/stock-screener',
          redirectLabel: 'Explore Stock Screener',
          quickActions: [{ label: 'Stock Screener', route: '/stock-screener' }],
          timestamp,
        };
      }
    }

    // Question 2: "Which mutual fund suits my long-term goals?"
    if (
      norm.includes('mutual fund suits') ||
      norm.includes('long-term goals') ||
      (norm.includes('suits') && norm.includes('goals'))
    ) {
      let profile: Record<string, any> | null = null;
      try {
        const res = await apiService.getMasterProfile();
        profile = res?.data ?? {};
      } catch {
        profile = {};
      }

      const riskAppetite = (profile?.riskAppetite ?? 'Moderate').toString();
      const funds = await this._getFunds();

      if (funds.length === 0) {
        return {
          id: Date.now().toString(),
          sender: 'bot',
          text: 'Mutual Fund Score Card data is currently unavailable. Please explore rated funds in our Mutual Fund Screener!',
          redirectTo: '/mf-screener',
          redirectLabel: 'Explore Mutual Funds',
          quickActions: [{ label: 'MF Screener', route: '/mf-screener' }],
          timestamp,
        };
      }

      // Filter funds by risk cluster or category
      let clusterFunds = funds.filter((f) => {
        const cluster = (f.cluster ?? f.category ?? f.risk_tier ?? '').toString().toLowerCase();
        return cluster.includes(riskAppetite.toLowerCase());
      });

      if (clusterFunds.length === 0) clusterFunds = [...funds];

      // Sort by score descending
      clusterFunds.sort((a, b) => {
        const scoreA = parseFloat((a.score ?? a.fund_score ?? a.final_score ?? 0).toString()) || 0;
        const scoreB = parseFloat((b.score ?? b.fund_score ?? b.final_score ?? 0).toString()) || 0;
        return scoreB - scoreA;
      });

      const fund1 = clusterFunds.length > 0 ? clusterFunds[0] : null;
      let fund2: Record<string, any> | null = null;
      if (fund1) {
        const cat1 = (fund1.category ?? fund1.type ?? '').toString();
        fund2 =
          clusterFunds.find((f) => (f.category ?? f.type ?? '').toString() !== cat1) ||
          (clusterFunds.length > 1 ? clusterFunds[1] : fund1);
      }

      const f1Name = fund1?.scheme_name ?? fund1?.fund_name;
      const f1Cat = fund1?.category ?? fund1?.cluster;
      const rawScore1 = fund1?.score ?? fund1?.fund_score ?? fund1?.final_score;
      const f1Score =
        rawScore1 !== null && rawScore1 !== undefined
          ? Math.round(parseFloat(rawScore1.toString()) || 0)
          : null;

      const f2Name = fund2?.scheme_name ?? fund2?.fund_name;
      const f2Cat = fund2?.category ?? fund2?.cluster;
      const rawScore2 = fund2?.score ?? fund2?.fund_score ?? fund2?.final_score;
      const f2Score =
        rawScore2 !== null && rawScore2 !== undefined
          ? Math.round(parseFloat(rawScore2.toString()) || 0)
          : null;

      const lines: string[] = [
        '🎯 **Mutual Funds Suited for Your Long-Term Goals**',
        `Based on your profile risk appetite (**${riskAppetite}**), here are 2 top-ranked funds from different categories:\n`,
      ];

      if (f1Name) {
        lines.push(`1️⃣ **${f1Name}**`);
        if (f1Cat) lines.push(`   • **Category**: ${f1Cat}`);
        if (f1Score !== null) lines.push(`   • **Score**: **${f1Score} / 100** ⭐`);
        lines.push('');
      }

      if (f2Name && f2Name !== f1Name) {
        lines.push(`2️⃣ **${f2Name}**`);
        if (f2Cat) lines.push(`   • **Category**: ${f2Cat}`);
        if (f2Score !== null) lines.push(`   • **Score**: **${f2Score} / 100** ⭐`);
        lines.push('');
      }

      lines.push(
        '💡 *These funds diversify your portfolio across growth and stability for long-term compounding.*'
      );

      return {
        id: Date.now().toString(),
        sender: 'bot',
        text: lines.join('\n'),
        redirectTo: '/mf-screener',
        redirectLabel: 'Explore Mutual Funds',
        quickActions: [{ label: 'MF Screener', route: '/mf-screener' }],
        timestamp,
      };
    }

    // Question 3: "Best liquid fund for my emergency needs?"
    if (
      norm.includes('liquid fund') ||
      norm.includes('emergency needs') ||
      (norm.includes('liquid') && norm.includes('emergency'))
    ) {
      const funds = await this._getFunds();

      const liquidFunds = funds.filter((f) => {
        const cat = (f.category ?? f.scheme_type ?? f.cluster ?? '').toString().toLowerCase();
        return cat.includes('liquid') || cat.includes('debt') || cat.includes('overnight');
      });

      if (liquidFunds.length === 0 && funds.length === 0) {
        return {
          id: Date.now().toString(),
          sender: 'bot',
          text: 'Liquid fund recommendations are currently unavailable. Check back soon or explore our Emergency Fund Pillar!',
          redirectTo: '/pillars/emergency',
          redirectLabel: 'Check Emergency Fund',
          quickActions: [{ label: 'Emergency Fund', route: '/pillars/emergency' }],
          timestamp,
        };
      }

      const selectedLiquid = liquidFunds.length > 0 ? liquidFunds[0] : funds[0];

      const lName = selectedLiquid?.scheme_name ?? selectedLiquid?.fund_name;
      const lCat =
        selectedLiquid?.category ??
        selectedLiquid?.scheme_type ??
        selectedLiquid?.cluster ??
        'Debt - Liquid Scheme';
      const rawLScore =
        selectedLiquid?.score ?? selectedLiquid?.fund_score ?? selectedLiquid?.final_score;
      const lScore =
        rawLScore !== null && rawLScore !== undefined
          ? Math.round(parseFloat(rawLScore.toString()) || 0)
          : null;

      const lines: string[] = ['🛡️ **Best Liquid Fund for Your Emergency Needs**:\n'];
      if (lName) lines.push(`• **Fund Name**: **${lName}**`);
      lines.push(`• **Category**: ${lCat}`);
      if (lScore !== null) lines.push(`• **Score**: **${lScore} / 100** ⭐`);

      if (selectedLiquid?.one_year_return) {
        lines.push(`• **1-Year Return**: **${selectedLiquid.one_year_return}**`);
      } else if (selectedLiquid?.yield) {
        lines.push(`• **Yield**: **${selectedLiquid.yield}**`);
      }

      lines.push(
        '\n💡 *Liquid funds offer T+1 instant liquidity with zero lock-in, making them ideal for parking your emergency reserves safely.*'
      );

      return {
        id: Date.now().toString(),
        sender: 'bot',
        text: lines.join('\n'),
        redirectTo: '/pillars/emergency',
        redirectLabel: 'Check Emergency Fund',
        quickActions: [{ label: 'Emergency Fund', route: '/pillars/emergency' }],
        timestamp,
      };
    }

    // Question 4: "Which insurance fits my budget?"
    if (
      norm.includes('insurance fits') ||
      norm.includes('fits my budget') ||
      (norm.includes('insurance') && norm.includes('budget'))
    ) {
      let profile: Record<string, any> | null = null;
      try {
        const res = await apiService.getMasterProfile();
        profile = res?.data ?? {};
      } catch {
        profile = {};
      }

      const monthlyIncome =
        parseFloat((profile?.monthlyActiveIncome ?? '0').toString()) || 0;

      const plans = await this._getPlans();

      const healthPlans = plans.filter((p) =>
        (p.category ?? p.type ?? p.plan_type ?? '').toString().toLowerCase().includes('health')
      );
      const lifePlans = plans.filter(
        (p) =>
          (p.category ?? p.type ?? p.plan_type ?? '').toString().toLowerCase().includes('life') ||
          (p.category ?? '').toString().toLowerCase().includes('term')
      );

      const hPlan = healthPlans.length > 0 ? healthPlans[0] : plans[0];
      const lPlan = lifePlans.length > 0 ? lifePlans[0] : plans.length > 1 ? plans[1] : null;

      const hName = hPlan?.plan_name ?? hPlan?.provider_name;
      const lName = lPlan?.plan_name ?? lPlan?.provider_name;

      if (monthlyIncome <= 0) {
        const lines: string[] = [
          '💳 **Insurance Cover Tailored for Your Income & Budget**\n',
          'Add your monthly income in Master Data to get tailored cover limits.\n',
        ];
        if (hName || lName) {
          lines.push('📋 **Available Recommended Plans**:');
          if (hName) lines.push(`   • **Health Plan**: ${hName}`);
          if (lName) lines.push(`   • **Life / Term Plan**: ${lName}`);
          lines.push('');
        }
        lines.push('💡 *Update your income in Master Data to compute optimal coverage for your family.*');

        return {
          id: Date.now().toString(),
          sender: 'bot',
          text: lines.join('\n'),
          redirectTo: '/master-data?target=income',
          redirectLabel: 'Update Income in Master Data',
          quickActions: [
            { label: 'Update Income', route: '/master-data?target=income' },
            { label: 'Insurance Screener', route: '/insurance-screener' },
          ],
          timestamp,
        };
      }

      // Limits: Health Cover = 10x yearly income, Life Cover = 15x yearly income
      const yearlyIncome = monthlyIncome * 12;
      const healthMaxCover = yearlyIncome * 10;
      const lifeMaxCover = yearlyIncome * 15;

      const healthCoverFmt = formatCompactCurrency(healthMaxCover);
      const lifeCoverFmt = formatCompactCurrency(lifeMaxCover);

      const lines: string[] = [
        '💳 **Insurance Cover Tailored for Your Income & Budget**',
        `Based on your calculated annual income of **${formatCompactCurrency(yearlyIncome)}**:\n`,
      ];

      lines.push('🏥 **Recommended Health Insurance**:');
      if (hName) lines.push(`   • **Plan**: ${hName}`);
      lines.push(`   • **Recommended Health Cover (10x)**: **${healthCoverFmt}**\n`);

      lines.push('🛡️ **Recommended Life / Term Insurance**:');
      if (lName) lines.push(`   • **Plan**: ${lName}`);
      lines.push(`   • **Recommended Life Cover (15x)**: **${lifeCoverFmt}**\n`);

      lines.push(
        '💡 *These coverage limits protect your family against medical emergencies and secure long-term financial stability within your budget.*'
      );

      return {
        id: Date.now().toString(),
        sender: 'bot',
        text: lines.join('\n'),
        redirectTo: '/insurance-screener',
        redirectLabel: 'Explore Insurance Plans',
        quickActions: [{ label: 'Insurance Screener', route: '/insurance-screener' }],
        timestamp,
      };
    }

    return null;
  }

  private async _tryResolveScoreCardQuery(
    queryText: string,
    timestamp: string
  ): Promise<ChatMessage | null> {
    const norm = queryText.toLowerCase().trim();

    // 0. Featured AI Questions
    const featuredAiMsg = await this._tryResolveFeaturedAiQuestions(norm, timestamp);
    if (featuredAiMsg) return featuredAiMsg;

    // Gate collision prevention: if user asks specifically about emergency fund or emergency savings,
    // do not let generic mutual fund gate keywords ('fund', 'funds') swallow the query.
    const isEmergencyQuery =
      norm.includes('emergency fund') ||
      norm.includes('emergency savings') ||
      (norm.includes('emergency') && !norm.includes('mutual'));

    // 1. MUTUAL FUND SCORE CARD QUERY (Evaluated FIRST)
    const mfKeywords = [
      'mutual fund',
      'mf',
      'sip',
      'elss',
      'bluechip',
      'small cap',
      'mid cap',
      'flexi cap',
      'large cap',
      'index fund',
      'debt fund',
      'hybrid',
      'fund',
      'funds',
      'cagr',
      'aum',
      'sbi bluechip',
      'nippon',
      'parag parikh',
      'mirae',
      'quant',
      'axis long term',
      'hdfc balanced',
      'kotak emerging',
      'uti nifty',
      'icici pru',
    ];

    const isMfQuery =
      !isEmergencyQuery && mfKeywords.some((kw) => matchesKeyword(norm, kw));

    if (isMfQuery) {
      try {
        const funds = await this._getFunds();
        const matchedFund = this._findBestMatch(norm, funds, [
          'scheme_name',
          'fund_name',
          'category',
          'cluster',
        ]);

        if (matchedFund) {
          const text = ScoreCardAdvisor.generateMfAdvice(matchedFund);
          return {
            id: Date.now().toString(),
            sender: 'bot',
            text,
            redirectTo: '/mf-screener',
            redirectLabel: 'Explore Mutual Fund Screener',
            quickActions: [
              { label: 'MF Screener', route: '/mf-screener' },
              { label: 'Stock Screener', route: '/stock-screener' },
            ],
            timestamp,
          };
        } else if (!this._matchesAnyIntent(norm) && !norm.includes('screener') && !norm.includes('overall')) {
          return {
            id: Date.now().toString(),
            sender: 'bot',
            text:
              "Sorry! I couldn't identify that mutual fund scheme in our Score Card dataset.\n\n" +
              "Try searching with specific scheme names (e.g. **'SBI Small Cap Fund'**, **'Parag Parikh Flexi Cap'**) or explore all rated schemes in our **Mutual Fund Screener**!",
            redirectTo: '/mf-screener',
            redirectLabel: 'Open MF Screener',
            quickActions: [{ label: 'MF Screener', route: '/mf-screener' }],
            timestamp,
          };
        }
      } catch {
        // ignore
      }
    }

    // 2. INSURANCE SCORE CARD QUERY (Evaluated SECOND)
    const insKeywords = [
      'insurance',
      'policy',
      'health plan',
      'term plan',
      'cover',
      'csr',
      'claim',
      'health cover',
      'term cover',
      'life cover',
      'sum assured',
      'premium',
      'hdfc ergo',
      'optima',
      'star health',
      'care health',
      'max bupa',
      'icici lombard',
      'tata aia',
      'lic',
      'niva bupa',
      'aditya birla',
    ];

    const isInsQuery = insKeywords.some((kw) => matchesKeyword(norm, kw));
    if (isInsQuery) {
      try {
        const plans = await this._getPlans();
        const matchedPlan = this._findBestMatch(norm, plans, [
          'plan_name',
          'company_name',
          'plan_type',
        ]);

        if (matchedPlan) {
          const text = ScoreCardAdvisor.generateInsuranceDetails(matchedPlan);
          return {
            id: Date.now().toString(),
            sender: 'bot',
            text,
            redirectTo: '/insurance-screener',
            redirectLabel: 'Explore Insurance Screener',
            quickActions: [{ label: 'Insurance Screener', route: '/insurance-screener' }],
            timestamp,
          };
        } else if (!this._matchesAnyIntent(norm) && !norm.includes('screener') && !norm.includes('overall')) {
          return {
            id: Date.now().toString(),
            sender: 'bot',
            text:
              "Sorry! I couldn't find that specific insurance plan in our dataset.\n\n" +
              "Try searching for top providers like **'HDFC Ergo Optima'**, **'Star Health'**, or **'Care Health'**, or open the Insurance Screener!",
            redirectTo: '/insurance-screener',
            redirectLabel: 'Open Insurance Screener',
            quickActions: [{ label: 'Insurance Screener', route: '/insurance-screener' }],
            timestamp,
          };
        }
      } catch {
        // ignore
      }
    }

    // 3. IPO SCORE CARD QUERY (Evaluated THIRD)
    const ipoKeywords = [
      'ipo',
      'upcoming ipo',
      'price band',
      'issue size',
      'gmp',
      'bidding',
      'allotment',
    ];

    const isIpoQuery = ipoKeywords.some((kw) => matchesKeyword(norm, kw));
    if (isIpoQuery) {
      try {
        const ipos = await this._getIpos();
        const matchedIpo = this._findBestMatch(norm, ipos, ['company_name', 'name']);

        if (matchedIpo) {
          const text = ScoreCardAdvisor.generateIpoDetails(matchedIpo);
          return {
            id: Date.now().toString(),
            sender: 'bot',
            text,
            redirectTo: '/dashboard',
            redirectLabel: 'View Dashboard',
            quickActions: [
              { label: 'Stock Screener', route: '/stock-screener' },
              { label: 'MF Screener', route: '/mf-screener' },
            ],
            timestamp,
          };
        } else if (!norm.includes('screener')) {
          return {
            id: Date.now().toString(),
            sender: 'bot',
            text:
              "Sorry! I couldn't find active IPO score card details for that query. Check upcoming IPOs in the dashboard or Stock Screener!",
            redirectTo: '/dashboard',
            redirectLabel: 'Go to Dashboard',
            quickActions: [{ label: 'Stock Screener', route: '/stock-screener' }],
            timestamp,
          };
        }
      } catch {
        // ignore
      }
    }

    // 4. STOCK SCORE CARD QUERY (Evaluated FOURTH)
    const stockKeywords = [
      'stock',
      'share',
      'shares',
      'equity',
      'nifty 50',
      'bse',
      'buy stock',
      'sell stock',
      'pe ratio',
      'market cap',
      'reliance',
      'tata motors',
      'infosys',
      'tcs',
      'hdfc bank',
      'icici bank',
      'sbi bank',
      'adani',
      'itc',
      'bharti',
      'wipro',
      'l&t',
      'maruti',
      'bajaj',
      'asian paints',
      'titan',
      'sun pharma',
      'axis bank',
      'kotak bank',
      'ultratech',
      'power grid',
      'ntpc',
      'jio',
      'hal',
      'vedanta',
      'zomato',
      'paytm',
      'policybazaar',
      'nykaa',
      'irctc',
      'coal india',
      'ongc',
      'divis',
      'cipla',
    ];

    const isStockQuery = stockKeywords.some((kw) => matchesKeyword(norm, kw));
    if (isStockQuery) {
      try {
        const stocks = await this._getStocks();
        const matchedStock = this._findBestMatch(norm, stocks, [
          'company_name',
          'symbol',
          'sector',
        ]);

        if (matchedStock) {
          const text = ScoreCardAdvisor.generateStockAdvice(matchedStock);
          return {
            id: Date.now().toString(),
            sender: 'bot',
            text,
            redirectTo: '/stock-screener',
            redirectLabel: 'Explore Stock Screener',
            quickActions: [
              { label: 'Stock Screener', route: '/stock-screener' },
              { label: 'MF Screener', route: '/mf-screener' },
            ],
            timestamp,
          };
        } else if (!this._matchesAnyIntent(norm) && !norm.includes('screener') && !norm.includes('overall')) {
          return {
            id: Date.now().toString(),
            sender: 'bot',
            text:
              "Sorry! I couldn't identify that specific stock in our Stock Score Card dataset.\n\n" +
              "Try asking about top companies like **Reliance**, **Tata Motors**, **Infosys**, or **HDFC Bank**, or explore all listed stocks in our **Stock Screener**!",
            redirectTo: '/stock-screener',
            redirectLabel: 'Open Stock Screener',
            quickActions: [{ label: 'Stock Screener', route: '/stock-screener' }],
            timestamp,
          };
        }
      } catch {
        // ignore
      }
    }

    return null;
  }

  private _matchesAnyIntent(norm: string): boolean {
    for (const rule of this._intentRules) {
      for (const keyword of rule.keywords) {
        if (matchesKeyword(norm, keyword)) {
          return true;
        }
      }
    }
    return false;
  }

  private _findBestMatch(
    queryNorm: string,
    items: Record<string, any>[],
    searchFields: string[]
  ): Record<string, any> | null {
    const stopWords = new Set([
      'mutual',
      'fund',
      'funds',
      'stock',
      'stocks',
      'share',
      'shares',
      'company',
      'plan',
      'plans',
      'insurance',
      'direct',
      'growth',
      'scheme',
      'option',
      'screener',
      'score',
      'card',
      'tell',
      'show',
      'me',
      'about',
      'best',
      'top',
      'what',
      'is',
      'the',
      'for',
      'a',
      'suggest',
      'recommend',
      'give',
      'detail',
      'details',
      'info',
    ]);

    const queryTokens = queryNorm
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !stopWords.has(w));

    if (queryTokens.length === 0) return null;

    const tokenRegexes = queryTokens.map(
      (t) => new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i')
    );

    let bestItem: Record<string, any> | null = null;
    let maxScore = 0;

    for (const item of items) {
      let score = 0;
      for (const field of searchFields) {
        const val = (item[field] ?? '').toString().toLowerCase();
        if (!val) continue;

        // Exact phrase match
        const cleanPhrase = queryTokens.join(' ');
        if (cleanPhrase.length > 0) {
          const fullPhraseRegex = new RegExp(escapeRegExp(cleanPhrase), 'i');
          if (fullPhraseRegex.test(val)) {
            score += 20;
          }
        }

        // Token RegExp matches
        for (let i = 0; i < queryTokens.length; i++) {
          const token = queryTokens[i];
          const tokenRegex = tokenRegexes[i];

          if (tokenRegex.test(val)) {
            score += token.length >= 4 ? 5 : 3;
          } else if (val.includes(token)) {
            score += token.length >= 4 ? 3 : 1;
          }
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestItem = item;
      }
    }

    return maxScore >= 3 ? bestItem : null;
  }
}

export const chatIntentService = new ChatIntentService();
