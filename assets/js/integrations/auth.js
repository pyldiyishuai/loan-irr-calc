/* ==========================================================================
 * integrations/auth.js — 登录 / 会员（预留，当前完全空实现）
 * --------------------------------------------------------------------------
 * 为什么先留桩：
 *   工具站的第一优先级是「让不登录的人也能算」，登录只会降低转化。
 *   等有了稳定流量再上会员，用来售卖：
 *     - 多方案并排对比
 *     - 导出 PDF 报告
 *     - 方案云端保存 / 分享链接
 *     - 利率变动提醒
 *
 * 接法：
 *   1. config.js → APP.AUTH.enabled = true，provider 选 'wechat' | 'github' | 'phone'
 *   2. 实现下面的 login()，把 token 存 localStorage
 *   3. UI 里 #btnLogin 会自动出现（app.js 负责）
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

(function () {
  'use strict';

  var CFG = APP.AUTH || {};
  var TOKEN_KEY = (APP.CONST && APP.CONST.STORAGE_PREFIX || 'app_') + 'token';
  var user = null;

  /* ======================================================================
   * 一、状态
   * ==================================================================== */

  function isLoggedIn() {
    return !!getToken();
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function getUser() { return user; }

  /* ======================================================================
   * 二、登录（按 provider 预留分支）
   * ==================================================================== */

  /**
   * @returns {Promise<Object>} 用户信息
   */
  function login() {
    if (!CFG.enabled) {
      return Promise.reject(new Error('登录未启用'));
    }

    switch (CFG.provider) {
      case 'wechat':
        // 预留：微信网页授权 / 公众号静默授权
        // window.location.href = CFG.loginUrl + '?redirect=' + encodeURIComponent(location.href);
        return Promise.reject(new Error('微信登录待接入'));

      case 'github':
        // 预留：GitHub OAuth，适合开发者类工具
        // window.location.href = 'https://github.com/login/oauth/authorize?client_id=...';
        return Promise.reject(new Error('GitHub 登录待接入'));

      case 'phone':
        // 预留：手机号 + 短信验证码，需要后端
        return Promise.reject(new Error('手机登录待接入'));

      default:
        return Promise.reject(new Error('未配置登录方式'));
    }
  }

  function logout() {
    setToken('');
    user = null;
  }

  /* ======================================================================
   * 三、付费墙判断
   * ==================================================================== */

  /**
   * 某个高级功能当前是否可用
   * @param {string} feature  'save-plan' | 'export-pdf' | 'multi-plan'
   */
  function canUse(feature) {
    if (!CFG.enabled) return false;                 // 会员体系没上，全部不许
    var gated = CFG.gatedFeatures || [];
    if (gated.indexOf(feature) === -1) return true; // 不在付费名单里，随便用
    return isLoggedIn();
  }

  /**
   * 触发付费墙：当前实现是提示，接上会员后改成弹支付
   */
  function requireFeature(feature) {
    if (canUse(feature)) return true;
    // TODO(会员): 换成真实弹窗 / 跳转支付页
    alert('这个功能需要登录后使用（会员功能尚未开放）');
    return false;
  }

  /* ---------- 导出 ---------- */
  APP.Auth = {
    isLoggedIn: isLoggedIn,
    getUser: getUser,
    getToken: getToken,
    setToken: setToken,
    login: login,
    logout: logout,
    canUse: canUse,
    requireFeature: requireFeature,
    isEnabled: function () { return !!CFG.enabled; }
  };
})();
