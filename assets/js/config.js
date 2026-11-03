/* ==========================================================================
 * config.js — 全局配置中心
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.SITE = {
  name: '分期真实利率计算器',
  domain: 'https://pyldiyishuai.github.io/loan-irr-calc',
  contactEmail: 'hello@example.com',
  icp: '',
  beian: '',
  year: 2025
};

APP.DEBUG = { enabled: false, noDebounce: false };

APP.ADS = {
  enabled: false,
  provider: '',
  slots: {
    resultInline: { id: '', format: 'fluid', label: 'result-inline' },
    contentBanner: { id: '', format: 'horizontal', label: 'content-banner' },
    faqBanner: { id: '', format: 'horizontal', label: 'faq-banner' }
  },
  afterCalcDelay: 600,
  refreshOnRecalc: false
};

APP.ANALYTICS = {
  enabled: false,
  provider: '',
  id: '',
  debug: false,
  events: { pageView: 'page_view', calcRun: 'calc_run', adImpression: 'ad_impression' }
};

APP.API = {
  enabled: false,
  baseUrl: '',
  timeout: 8000,
  endpoints: {
    presets: '/api/loan-presets',
    savePlan: '/api/plan',
    getPlan: '/api/plan/:id',
    feedback: '/api/feedback',
    leadSubmit: '/api/lead'
  }
};

APP.AUTH = {
  enabled: false,
  provider: '',
  loginUrl: '/login',
  storageKey: 'irr_auth_token'
};

APP.FEATURES = {
  // ---- 已实现 ----
  irrCalc: true,          // 真实年化（IRR）计算
  nominalCompare: true,   // 名义 vs 真实对比
  presets: true,          // 常见产品预设
  benchmark: true,        // 行业区间参照
  earlyPayoff: true,      // 提前还款测算
  smartAdvice: true,      // 智能建议

  // ---- 预留 ----
  multiPlan: false,       // 多方案并排对比
  targetReverse: false,   // 反查：可接受年化下最多能承受多少费率
  scheduleExport: false,  // 导出还款计划表
  amortization: false,    // 等额本息 / 等额本金切换
  creditCardReal: false,  // 信用卡分期专项（含账单分期/现金分期）
  lprWidget: false,       // LPR 实时显示
  shareCard: false,
  cloudSave: false,
  loanAdvisorLead: false, // 信贷咨询线索
  i18n: false
};

APP.CONST = {
  MAX_AMOUNT: 100000000,
  MAX_MONTHS: 360,
  MONEY_DECIMALS: 2,
  STORAGE_PREFIX: 'irr_',
  ANIM_DURATION: 660
};
