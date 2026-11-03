/* ==========================================================================
 * integrations/ads.js — 广告接入层（当前为空实现，接上即可用）
 * --------------------------------------------------------------------------
 * 设计目标：业务代码只调 APP.Ads.show(slotName)，永远不关心是哪家联盟。
 *
 * 接入步骤（以 AdSense 为例）：
 *   1. config.js → APP.ADS.provider = 'adsense'
 *   2. config.js → APP.ADS.adsense.client / slots 填真实值
 *   3. 本文件不用改，下面 loadAdSense() 会自动注入脚本
 *
 * 接直客广告（收益最高的方式）：
 *   1. config.js → APP.ADS.direct['result-inline'] = '<a href="...">...</a>'
 *   2. 会自动优先生效，并且会埋点上报曝光/点击
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

(function () {
  'use strict';

  var CFG = APP.ADS || {};
  var shown = {};      // 已展示的广告位，避免重复注入
  var sdkLoaded = false;

  /* ======================================================================
   * 一、SDK 加载器（按 provider 分支）
   * ==================================================================== */

  /** Google AdSense —— 只需注入一次脚本 */
  function loadAdSense() {
    if (sdkLoaded) return;
    if (!CFG.adsense || !CFG.adsense.client) return;
    if (CFG.adsense.client.indexOf('XXXX') > -1) {
      // 还是占位 ID，直接跳过，避免线上广告位空白/控制台报错
      log('AdSense client 仍是占位值，跳过加载');
      return;
    }
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
            CFG.adsense.client;
    s.crossOrigin = 'anonymous';
    s.onerror = function () { log('AdSense 脚本加载失败'); };
    document.head.appendChild(s);
    sdkLoaded = true;
  }

  /** 百度联盟 —— 需要备案站，注入 cpro 脚本 */
  function loadBaidu() {
    if (sdkLoaded) return;
    if (!CFG.baidu || !CFG.baidu.cproid) return;
    var w = window;
    w._hmt = w._hmt || [];
    var s = document.createElement('script');
    s.src = 'https://cpro.baidustatic.com/cpro/ui/c.js';
    s.async = true;
    document.head.appendChild(s);
    sdkLoaded = true;
  }

  /* ======================================================================
   * 二、渲染
   * ==================================================================== */

  /** 在容器里插入 AdSense 单元 */
  function renderAdSense(container, slotId) {
    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', CFG.adsense.client);
    ins.setAttribute('data-ad-slot', slotId);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    container.innerHTML = '';
    container.appendChild(ins);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      log('AdSense push 失败: ' + e.message);
    }
  }

  /** 渲染直客/自定义 HTML */
  function renderDirect(container, html) {
    container.innerHTML = html;
    // 直客广告需要自己统计点击
    container.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      APP.Analytics && APP.Analytics.track(CFG.direct ? 'ad_click' : 'ad_click', {
        slot: container.getAttribute('data-ad-slot'),
        href: a.href
      });
    });
  }

  /* ======================================================================
   * 三、对外 API
   * ==================================================================== */

  /**
   * 展示某个广告位
   * @param {string} slotName data-ad-slot 的值
   */
  function show(slotName) {
    if (!CFG.enabled) return;
    if (shown[slotName]) return;

    var el = document.querySelector('[data-ad-slot="' + slotName + '"]');
    if (!el) return;

    // 直客优先
    if (CFG.direct && CFG.direct[slotName]) {
      renderDirect(el, CFG.direct[slotName]);
      el.classList.add('ad-slot--filled');
      shown[slotName] = true;
      trackImpression(slotName);
      return;
    }

    if (CFG.provider === 'adsense') {
      var id = CFG.adsense.slots && CFG.adsense.slots[slotName];
      if (!id || id.indexOf('000000') === 0) { log('广告位 ' + slotName + ' 未配置 ID'); return; }
      loadAdSense();
      renderAdSense(el, id);
      el.classList.add('ad-slot--filled');
      shown[slotName] = true;
      trackImpression(slotName);
      return;
    }

    if (CFG.provider === 'baidu') {
      loadBaidu();
      // 百度联盟需要具体的 div id，这里留好钩子
      // el.innerHTML = '<div id="baidu-ad-' + slotName + '"></div>'; ...
      log('百度联盟接入位已预留，请在此补充渲染代码');
      return;
    }

    // placeholder：保留虚线占位框，方便开发时看到广告位置
    log('广告位 ' + slotName + ' 使用占位样式（未接入真实联盟）');
  }

  /** 首次计算后统一放广告（转化更好，也不伤首屏） */
  function showAfterCalc() {
    if (CFG.showAfterFirstCalc === false) {
      ['result-inline', 'content-banner'].forEach(show);
      return;
    }
    show('result-inline');
  }

  function trackImpression(slotName) {
    if (!APP.Analytics) return;
    APP.Analytics.track('ad_impression', { slot: slotName, provider: CFG.provider });
  }

  function log(msg) {
    if (APP.DEBUG && APP.DEBUG.verbose) console.log('[Ads] ' + msg);
  }

  /* ---------- 导出 ---------- */
  APP.Ads = {
    show: show,
    showAfterCalc: showAfterCalc,
    // 供调试：APP.Ads.reset() 后可重新注入
    reset: function () { shown = {}; sdkLoaded = false; }
  };
})();
