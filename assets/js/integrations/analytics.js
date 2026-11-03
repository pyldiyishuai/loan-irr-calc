/* ==========================================================================
 * integrations/analytics.js — 埋点层
 * --------------------------------------------------------------------------
 * 目标：只暴露 APP.Analytics.track(event, props)。
 * 内部按配置同时投递到 GA4 / 百度统计 / 自建端点，全部失败也不影响业务。
 *
 * 【为什么要有这层】
 * 做工具站最值钱的数据是「用户输入了什么参数、选了哪个方案」。
 * 这些数据决定你下一步做什么功能、卖给谁广告。
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

(function () {
  'use strict';

  var CFG = APP.ANALYTICS || {};
  var queue = [];       // 未加载完成时先缓存
  var loaded = false;

  /* ======================================================================
   * 一、SDK 加载
   * ==================================================================== */

  function loadGA4() {
    if (!CFG.ga4 || CFG.ga4.indexOf('XXXX') > -1) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + CFG.ga4;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', CFG.ga4, { send_page_view: false });
  }

  function loadBaidu() {
    if (!CFG.baiduHmt || CFG.baiduHmt.indexOf('xxx') > -1) return;
    window._hmt = window._hmt || [];
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://hm.baidu.com/hm.js?' + CFG.baiduHmt;
    document.head.appendChild(s);
  }

  function ensureLoaded() {
    if (loaded) return;
    loadGA4();
    loadBaidu();
    loaded = true;
    // 补发缓存事件
    queue.splice(0).forEach(function (item) { send(item.name, item.props); });
  }

  /* ======================================================================
   * 二、投递
   * ==================================================================== */

  function send(name, props) {
    props = props || {};

    // GA4
    if (window.gtag && CFG.ga4) {
      try { window.gtag('event', name, props); } catch (e) {}
    }

    // 百度统计（只支持 _trackEvent 三参数）
    if (window._hmt && CFG.baiduHmt) {
      try {
        window._hmt.push(['_trackEvent', props.category || 'tool',
                          name, props.label || JSON.stringify(props).slice(0, 120)]);
      } catch (e) {}
    }

    // 自建端点（可选，方便自己建报表）
    if (CFG.endpoint) {
      try {
        var body = JSON.stringify({ event: name, props: props, ts: Date.now(), url: location.href });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(CFG.endpoint, body);
        } else {
          fetch(CFG.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            keepalive: true
          }).catch(function () {});
        }
      } catch (e) {}
    }

    if (APP.DEBUG && APP.DEBUG.verbose) {
      console.log('[Analytics]', name, props);
    }
  }

  /* ======================================================================
   * 三、对外 API
   * ==================================================================== */

  function track(name, props) {
    if (!CFG.enabled) return;
    if (!loaded) {
      queue.push({ name: name, props: props });
      ensureLoaded();
      return;
    }
    send(name, props);
  }

  /** 页面浏览（SPA 路由切换时手动调用） */
  function pageView(page) {
    track((CFG.events && CFG.events.pageView) || 'page_view', {
      page: page || location.pathname
    });
  }

  /**
   * 测算事件 —— 本工具最重要的埋点
   * 记录借款规模、费率区间与真实年化分布，用于：
   *   - 判断哪类产品被用得最多（决定写哪篇内容）
   *   - 「真实/名义倍数」的分布是很好的内容素材
   *   - 给信贷类广告主报数据
   */
  function trackCalc(result) {
    if (!result) return;
    track((CFG.events && CFG.events.calcRun) || 'calc_run', {
      category: 'calc',
      preset: result.input.preset,
      amount_bucket: bucket(result.input.amount),
      months: result.loan.months,
      fee_rate: result.input.feeRate,
      real_bucket: rateBucket(result.rate.real),
      multiple: Math.round(result.rate.multiple * 100) / 100,
      has_upfront: result.input.upfront > 0 || result.input.cutInterest > 0
    });
  }

  /** 金额分桶 */
  function bucket(v) {
    if (!isFinite(v) || v <= 0) return '0';
    if (v < 5000) return '<5k';
    if (v < 20000) return '5k-2w';
    if (v < 50000) return '2-5w';
    if (v < 100000) return '5-10w';
    if (v < 300000) return '10-30w';
    return '>30w';
  }

  /** 年化利率分桶 */
  function rateBucket(v) {
    if (!isFinite(v)) return 'na';
    var p = v * 100;
    if (p < 6) return '<6%';
    if (p < 12) return '6-12%';
    if (p < 18) return '12-18%';
    if (p < 24) return '18-24%';
    if (p < 36) return '24-36%';
    return '>36%';
  }

  /* ---------- 初始化 ---------- */
  ensureLoaded();

  /* ---------- 导出 ---------- */
  APP.Analytics = {
    track: track,
    pageView: pageView,
    trackCalc: trackCalc,
    bucket: bucket
  };
})();
