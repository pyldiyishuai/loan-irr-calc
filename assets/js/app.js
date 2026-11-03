/* ==========================================================================
 * app.js — 入口（分期真实利率计算器）
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

(function () {
  'use strict';

  var F, Form, Result;
  var timer = null;
  var firstCalcDone = false;
  var LAST_KEY = ((APP.CONST && APP.CONST.STORAGE_PREFIX) || 'app_') + 'last_input';

  function boot() {
    F = APP.UI.Format;
    Form = APP.UI.Form;
    Result = APP.UI.Result;

    Form.init();
    renderFaq();
    injectFaqSchema();
    Result.renderBenchmarkTable();
    setYear();

    bindForm();
    bindMisc();

    restoreInput();
    Form.updateHints();
    recalc(true);

    if (APP.Analytics) APP.Analytics.pageView();
  }

  function recalc(immediate) {
    var run = function () {
      timer = null;
      try {
        var values = Form.getValues();
        var result = APP.Core.Irr.buildResult(values);
        Result.renderAll(result);
        if (APP.Analytics) APP.Analytics.trackCalc(result);
        saveInput(values);

        if (!firstCalcDone) {
          firstCalcDone = true;
          setTimeout(function () { if (APP.Ads) APP.Ads.showAfterCalc(); }, 600);
        }
      } catch (err) {
        console.error('[calc]', err);
      }
    };

    if (immediate || (APP.DEBUG && APP.DEBUG.noDebounce)) {
      if (timer) clearTimeout(timer);
      run();
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 16);
  }

  /* ======================================================================
   * 事件
   * ==================================================================== */

  function bindForm() {
    Form.bind(function () {
      Form.updateHints();
      recalc(false);
    });

    var form = document.getElementById('form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        recalc(true);
        scrollToResult();
      });
    }

    var btnCalc = document.getElementById('btnCalc');
    if (btnCalc) {
      btnCalc.addEventListener('click', function () {
        btnCalc.classList.add('is-loading');
        setTimeout(function () {
          btnCalc.classList.remove('is-loading');
          scrollToResult();
        }, 400);
      });
    }

    var btnReset = document.getElementById('btnReset');
    if (btnReset) {
      btnReset.addEventListener('click', function () {
        Form.reset();
        recalc(true);
      });
    }

    // 期数快捷按钮
    document.querySelectorAll('[data-quickpick]').forEach(function (box) {
      var id = box.dataset.quickpick;
      box.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-value]');
        if (!btn) return;
        Form.setValue(id, btn.dataset.value);
        box.querySelectorAll('button').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        recalc(true);
      });
    });
  }

  function bindMisc() {
    var backtop = document.getElementById('backtop');
    if (backtop) {
      backtop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
    bindDockbar();
    bindScroll();

    document.querySelectorAll('[data-action="feedback"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        alert('算得不对或者费率过期了，欢迎发邮件到 ' +
              (APP.SITE.contactEmail || '邮箱') + '。');
      });
    });
  }

  var resultVisible = false;

  function bindDockbar() {
    var dock = document.getElementById('dockbar');
    var jump = document.getElementById('dockJump');
    var resultEl = document.getElementById('result');
    if (!dock) return;
    if (jump && resultEl) {
      jump.addEventListener('click', function () {
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    if ('IntersectionObserver' in window && resultEl) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          resultVisible = en.isIntersecting;
          updateDockbar();
        });
      }, { threshold: 0.12 }).observe(resultEl);
    }
  }

  function updateDockbar() {
    var dock = document.getElementById('dockbar');
    if (!dock) return;
    dock.hidden = !(window.scrollY > 420 && !resultVisible);
  }

  function bindScroll() {
    var backtop = document.getElementById('backtop');
    var onScroll = function () {
      if (backtop) backtop.hidden = window.scrollY < 480;
      updateDockbar();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  function scrollToResult() {
    var el = document.getElementById('result');
    if (el && window.innerWidth < 1024) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ======================================================================
   * FAQ
   * ==================================================================== */

  function renderFaq() {
    var list = document.getElementById('faqList');
    var data = (APP.DATA && APP.DATA.faq) || [];
    if (!list) return;
    list.innerHTML = data.map(function (item, i) {
      return '<details class="faq__item"' + (i === 0 ? ' open' : '') + '>' +
               '<summary class="faq__q">' + item.q + '</summary>' +
               '<div class="faq__a">' + item.a + '</div>' +
             '</details>';
    }).join('');
  }

  function injectFaqSchema() {
    var data = (APP.DATA && APP.DATA.faq) || [];
    if (!data.length) return;
    var schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: data.map(function (item) {
        return {
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a.replace(/<[^>]+>/g, '') }
        };
      })
    };
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(schema);
    document.head.appendChild(s);
  }

  /* ======================================================================
   * 持久化
   * ==================================================================== */

  function saveInput(values) {
    try { localStorage.setItem(LAST_KEY, JSON.stringify(values)); } catch (e) {}
  }

  function restoreInput() {
    var fromUrl = readUrlParams();
    if (fromUrl) { applyValues(fromUrl); return; }
    try {
      var raw = localStorage.getItem(LAST_KEY);
      if (!raw) return;
      var v = JSON.parse(raw);
      if (v && typeof v === 'object') applyValues(v);
    } catch (e) {}
  }

  function applyValues(v) {
    Object.keys(Form.FIELDS).forEach(function (id) {
      if (v[id] !== undefined && v[id] !== null && isFinite(v[id])) {
        Form.setValue(id, v[id], true);
      }
    });
    Form.updateHints();
  }

  /** ?amount=12000&months=12&fee=0.75&upfront=0&cut=0 */
  function readUrlParams() {
    var q = location.search.replace(/^\?/, '');
    if (!q) return null;
    var out = {}, has = false;
    var map = {
      amount: 'amount', months: 'months', fee: 'feeRate',
      upfront: 'upfront', cut: 'cutInterest'
    };
    q.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv.length !== 2) return;
      var k = decodeURIComponent(kv[0]);
      var val = parseFloat(decodeURIComponent(kv[1]));
      if (map[k] !== undefined && isFinite(val)) {
        out[map[k]] = val;
        has = true;
      }
    });
    return has ? out : null;
  }

  function setYear() {
    var el = document.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
