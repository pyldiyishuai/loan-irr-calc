/* ==========================================================================
 * ui/result.js — 结果渲染（真实 vs 名义 / 行业参照 / 还款计划）
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.UI = APP.UI || {};

(function (UI) {
  'use strict';

  var F = null;
  function fmt() { if (!F) F = UI.Format; return F; }

  var animRaf = {};
  function animateValue(el, from, to, formatter, duration) {
    if (!el) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !isFinite(from) || !isFinite(to)) {
      el.textContent = formatter(to);
      return;
    }
    var id = el.id || (el.id = 'v' + Math.random().toString(36).slice(2));
    if (animRaf[id]) cancelAnimationFrame(animRaf[id]);
    var start = performance.now(), dur = duration || 660, delta = to - from;

    function step(now) {
      var t = Math.min((now - start) / dur, 1);
      var e = 1 - Math.pow(1 - t, 3);
      el.textContent = formatter(from + delta * e);
      if (t < 1) animRaf[id] = requestAnimationFrame(step);
      else animRaf[id] = null;
    }
    animRaf[id] = requestAnimationFrame(step);
  }

  var prev = { nominal: 0, real: 0, fee: 0 };

  /* ======================================================================
   * 主渲染
   * ==================================================================== */

  function renderAll(r) {
    var f = fmt();
    renderHero(r, f);
    renderCompare(r, f);
    renderBenchmark(r, f);
    renderEarlyPayoff(r, f);
    renderSchedule(r, f);
    renderAdvice(r.advice);

    var stamp = document.getElementById('resultStamp');
    if (stamp) {
      stamp.textContent = '已更新 ' + new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit', minute: '2-digit'
      });
      stamp.classList.add('is-fresh');
      setTimeout(function () { stamp.classList.remove('is-fresh'); }, 1400);
    }

    setText('dockSave', (r.rate.real * 100).toFixed(2) + '%');
  }

  /* ---------- 主数字：真实年化 ---------- */
  function renderHero(r, f) {
    var pctFmt = function (v) { return (v * 100).toFixed(2) + '%'; };

    animateValue(document.getElementById('heroValue'), prev.real, r.rate.real, pctFmt, 700);
    prev.real = r.rate.real;

    var sub = document.getElementById('heroSub');
    if (sub) {
      sub.innerHTML = '每期还 ' + f.moneyFree(r.loan.payment, 0) +
                      '，共 ' + r.loan.months + ' 期，总计多付 <b>' +
                      f.moneyFree(r.cost.totalFee, 0) + '</b>';
    }

    var label = document.getElementById('heroLabel');
    if (label) label.textContent = '这笔分期的真实年化';

    // 风险着色
    var el = document.getElementById('heroValue');
    if (el) {
      el.classList.remove('is-high', 'is-mid', 'is-low');
      if (r.rate.real >= 0.24) el.classList.add('is-high');
      else if (r.rate.real >= 0.12) el.classList.add('is-mid');
      else el.classList.add('is-low');
    }
  }

  /* ---------- 名义 vs 真实 ---------- */
  function renderCompare(r, f) {
    var pctFmt = function (v) { return (v * 100).toFixed(2) + '%'; };

    animateValue(document.getElementById('rateNominal'), prev.nominal, r.rate.nominal, pctFmt, 560);
    prev.nominal = r.rate.nominal;

    animateValue(document.getElementById('rateReal'), prev.real, r.rate.real, pctFmt, 560);

    // 条形：真实 / 名义 的比例
    var bar = document.getElementById('compareBar');
    if (bar) {
      var nominalPct = Math.min((r.rate.nominal / Math.max(r.rate.real, 0.001)) * 100, 100);
      bar.innerHTML =
        '<div class="cbar__row">' +
          '<span class="cbar__label">真实年化</span>' +
          '<div class="cbar__track"><div class="cbar__fill cbar__fill--real" style="width:100%"></div></div>' +
          '<b class="cbar__val">' + pctFmt(r.rate.real) + '</b>' +
        '</div>' +
        '<div class="cbar__row">' +
          '<span class="cbar__label">名义年化</span>' +
          '<div class="cbar__track"><div class="cbar__fill cbar__fill--nominal" style="width:' +
            nominalPct.toFixed(1) + '%"></div></div>' +
          '<b class="cbar__val">' + pctFmt(r.rate.nominal) + '</b>' +
        '</div>';
    }

    var badge = document.getElementById('multipleBadge');
    if (badge) {
      badge.innerHTML = '真实成本是名义的 <b>' + r.rate.multiple.toFixed(2) + ' 倍</b>';
    }

    // 指标
    setText('metricPayment', f.moneyFree(r.loan.payment, 0));
    setText('metricTotalFee', f.moneyFree(r.cost.totalFee, 0));
    setText('metricFeePerMonth', f.moneyFree(r.loan.feePerMonth, 0));
    setText('metricReceived', f.moneyFree(r.loan.received, 0));
  }

  /* ---------- 行业参照 ---------- */
  function renderBenchmark(r, f) {
    var box = document.getElementById('benchmarkList');
    if (!box) return;
    var list = (APP.DATA && APP.DATA.benchmarks) || [];
    if (!list.length) return;

    var real = r.rate.real * 100;
    // 坐标轴固定映射到 2%–36% 区间，所有区间才能在同一尺度上比较
    var AXIS_MIN = 2, AXIS_MAX = 36, SPAN = AXIS_MAX - AXIS_MIN;
    function pos(v) { return Math.min(Math.max((v - AXIS_MIN) / SPAN * 100, 0), 100); }

    box.innerHTML = list.map(function (b) {
      var isCurrent = real >= b.low && real <= b.high;
      var left = pos(b.low);
      var width = Math.max(pos(b.high) - left, 1.5);
      return '<div class="bm-row' + (isCurrent ? ' is-current' : '') + '">' +
               '<span class="bm-row__name">' + b.name + '</span>' +
               '<div class="bm-row__track">' +
                 '<div class="bm-row__range bm-row__range--' + b.tone + '" ' +
                      'style="left:' + left.toFixed(2) + '%;width:' + width.toFixed(2) + '%"></div>' +
                 (isCurrent
                   ? '<i class="bm-row__pin" style="left:' + pos(real).toFixed(2) + '%"></i>'
                   : '') +
               '</div>' +
               '<b class="bm-row__val">' + b.low + '–' + b.high + '%</b>' +
             '</div>';
    }).join('');
  }

  /* ---------- 提前还款 ---------- */
  function renderEarlyPayoff(r, f) {
    var body = document.getElementById('earlyBody');
    if (!body) return;
    var rows = (r.earlyPayoff && r.earlyPayoff.checkpoints) || [];
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4" class="is-empty">期数太短，没有可对比的提前还款节点</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (row) {
      return '<tr>' +
        '<td>第 ' + row.period + ' 期后</td>' +
        '<td>' + f.moneyFree(row.remainPrincipal, 0) + '</td>' +
        '<td>' + f.moneyFree(row.payoffBest, 0) + '</td>' +
        '<td class="is-danger">' + f.moneyFree(row.payoffWorst, 0) + '</td>' +
      '</tr>';
    }).join('');
  }

  /* ---------- 还款计划（前 6 期 + 末 2 期） ---------- */
  function renderSchedule(r, f) {
    var body = document.getElementById('scheduleBody');
    if (!body) return;
    var rows = r.schedule || [];
    var show = rows.length > 8
      ? rows.slice(0, 6).concat([null], rows.slice(-2))
      : rows;

    body.innerHTML = show.map(function (row) {
      if (!row) return '<tr class="is-gap"><td colspan="4">⋯</td></tr>';
      return '<tr>' +
        '<td>' + row.period + '</td>' +
        '<td>' + f.moneyFree(row.payment, 0) + '</td>' +
        '<td>' + f.moneyFree(row.interest, 0) + '</td>' +
        '<td>' + f.moneyFree(row.balance, 0) + '</td>' +
      '</tr>';
    }).join('');
  }

  /* ---------- 建议 ---------- */
  function renderAdvice(list) {
    var textEl = document.getElementById('adviceText');
    var box = document.getElementById('advice');
    if (!textEl) return;
    if (!list || !list.length) { if (box) box.style.display = 'none'; return; }
    if (box) box.style.display = '';

    textEl.innerHTML = list.map(function (item, i) {
      var cls = 'advice__item advice__item--' + (item.type || 'info');
      if (i === 0) cls += ' advice__lead';
      return '<span class="' + cls + '">' + item.text + '</span>';
    }).join('');
  }

  /* ---------- 行业参照表（下方独立区块） ---------- */
  function renderBenchmarkTable() {
    var body = document.getElementById('bmTableBody');
    if (!body) return;
    var list = (APP.DATA && APP.DATA.benchmarks) || [];
    body.innerHTML = list.map(function (b) {
      return '<tr>' +
        '<td>' + b.name + '</td>' +
        '<td class="is-' + b.tone + '">' + b.low + '%' +
          (b.high !== b.low ? ' – ' + b.high + '%' : '') + '</td>' +
        '<td>' + toneText(b.tone) + '</td>' +
      '</tr>';
    }).join('');
  }

  function toneText(tone) {
    return tone === 'good' ? '便宜' : tone === 'warn' ? '偏贵' : '很贵';
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  UI.Result = {
    renderAll: renderAll,
    renderBenchmarkTable: renderBenchmarkTable
  };
})(APP.UI);
