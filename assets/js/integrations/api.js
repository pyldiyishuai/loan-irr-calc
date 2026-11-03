/* ==========================================================================
 * integrations/api.js — 后端接口层（预留，当前不发起任何请求）
 * --------------------------------------------------------------------------
 * 现在所有计算都在浏览器完成，零后端 = 零成本 = 不会挂。
 *
 * 什么时候需要后端？
 *   1) 远程下发利率表 / 城市数据 / 银行规则（避免用户看到过期数据）
 *   2) 保存测算方案、生成分享链接（拉新）
 *   3) 会员付费、导出 PDF
 *
 * 接上之后：config.js 里 APP.API.enabled = true + 填 baseUrl 即可。
 * 所有调用都带超时、失败降级，不会因为后端挂了把页面搞白屏。
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

(function () {
  'use strict';

  var CFG = APP.API || {};

  /* ======================================================================
   * 一、基础请求封装
   * ==================================================================== */

  /**
   * @param {string} path   相对路径，或 endpoints 里的 key
   * @param {Object} opts   { method, body, timeout }
   * @returns {Promise<any>} 失败时 reject，调用方必须 catch
   */
  function request(path, opts) {
    opts = opts || {};
    if (!CFG.enabled) {
      return Promise.reject(new Error('API 未启用（config.js → APP.API.enabled）'));
    }

    var url = /^https?:/.test(path)
      ? path
      : CFG.baseUrl + (CFG.endpoints[path] || path);

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, opts.timeout || CFG.timeout || 8000);

    return fetch(url, {
      method: opts.method || 'GET',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        opts.headers || {}
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller ? controller.signal : undefined,
      credentials: 'omit'
    })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .catch(function (err) {
        clearTimeout(timer);
        throw err;
      });
  }

  /* ======================================================================
   * 二、业务方法（全部是预留桩，接后端后逐个打开）
   * ==================================================================== */

  /** 拉取远程利率配置；失败时返回 null，调用方继续用本地 APP.DATA */
  function fetchRates() {
    return request('rates', { method: 'GET' })
      .then(function (data) {
        // 数据落地：覆盖到 APP.DATA，让全站生效
        if (data && data.lpr5y) APP.DATA.lpr5y = data.lpr5y;
        if (data && data.ratePresets) APP.DATA.ratePresets = data.ratePresets;
        return data;
      })
      .catch(function (err) {
        if (CFG.fallbackToLocal) {
          log('利率接口失败，使用本地数据：' + err.message);
          return null;
        }
        throw err;
      });
  }

  /** 拉取银行违约金规则库 */
  function fetchPenaltyRules() {
    return request('penaltyRules', { method: 'GET' })
      .then(function (data) {
        if (data && data.list) APP.DATA.bankRules = data.list;
        return data;
      })
      .catch(function (err) {
        log('规则库接口失败，使用本地数据：' + err.message);
        return null;
      });
  }

  /** 保存测算方案（需登录，见 auth.js） */
  function savePlan(result) {
    return request('savePlan', { method: 'POST', body: result });
  }

  /** 读取分享的方案 */
  function getPlan(id) {
    return request('getPlan?id=' + encodeURIComponent(id), { method: 'GET' });
  }

  /** 意见反馈 */
  function sendFeedback(payload) {
    return request('feedback', { method: 'POST', body: payload });
  }

  function log(msg) {
    if (APP.DEBUG && APP.DEBUG.verbose) console.log('[API] ' + msg);
  }

  /* ---------- 导出 ---------- */
  APP.Api = {
    request: request,
    fetchRates: fetchRates,
    fetchPenaltyRules: fetchPenaltyRules,
    savePlan: savePlan,
    getPlan: getPlan,
    sendFeedback: sendFeedback,
    // 供 UI 判断是否显示「云同步」类按钮
    isEnabled: function () { return !!CFG.enabled; }
  };
})();
