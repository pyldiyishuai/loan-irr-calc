/* ==========================================================================
 * ui/form.js — 表单读写与产品预设联动（分期 IRR 版）
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.UI = APP.UI || {};

(function (UI) {
  'use strict';

  var FIELDS = {
    amount:       { min: 0, max: 100000000, money: true },
    months:       { min: 1, max: 360 },
    feeRate:      { min: 0, max: 10 },
    upfront:      { min: 0, max: 100000000, money: true },
    cutInterest:  { min: 0, max: 100000000, money: true }
  };

  var DEFAULTS = {
    amount: 12000,
    months: 12,
    feeRate: 0.75,
    upfront: 0,
    cutInterest: 0
  };

  function stripMoney(s) { return String(s == null ? '' : s).replace(/[^\d.]/g, ''); }

  function groupThousands(s) {
    if (s === '' || s == null) return '';
    var parts = String(s).split('.');
    var intPart = parts[0].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? intPart + '.' + parts[1].slice(0, 2) : intPart;
  }

  function readNum(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var v = parseFloat(String(el.value == null ? '' : el.value).replace(/[,，\s]/g, ''));
    return isFinite(v) ? v : 0;
  }

  function clamp(v, cfg) {
    if (!isFinite(v)) return cfg.min || 0;
    return Math.min(Math.max(v, cfg.min), cfg.max);
  }

  function getValues() {
    var v = {};
    Object.keys(FIELDS).forEach(function (id) {
      v[id] = clamp(readNum(id), FIELDS[id]);
    });
    var sel = document.getElementById('preset');
    v.preset = sel ? sel.value : 'custom';
    return v;
  }

  function setValue(id, value, silent) {
    var el = document.getElementById(id);
    if (!el) return;
    var cfg = FIELDS[id] || {};
    if (cfg.money) {
      el.value = groupThousands(String(Math.round(Number(value) || 0)));
    } else {
      var num = Number(value) || 0;
      el.value = String(Math.round(num * 100) / 100);
    }
    if (!silent) updateHints();
  }

  function formatMoneyInput(el) {
    var caretFromEnd = el.value.length - (el.selectionStart || 0);
    var formatted = groupThousands(stripMoney(el.value));
    if (formatted === el.value) return;
    el.value = formatted;
    var pos = Math.max(formatted.length - caretFromEnd, 0);
    try { el.setSelectionRange(pos, pos); } catch (e) {}
  }

  /* ======================================================================
   * 产品预设
   * ==================================================================== */

  function renderPresets() {
    var sel = document.getElementById('preset');
    var list = (APP.DATA && APP.DATA.presets) || [];
    if (!sel || !list.length) return;
    sel.innerHTML = list.map(function (p) {
      return '<option value="' + p.id + '">' + p.name + '</option>';
    }).join('');
    sel.value = 'creditcard';
    applyPreset('creditcard', true);
  }

  function applyPreset(id, silent) {
    var list = (APP.DATA && APP.DATA.presets) || [];
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { found = list[i]; break; }
    }
    if (!found) return;

    if (!silent && id !== 'custom') {
      setValue('feeRate', found.feeRate);
      setValue('months', found.months);
    }

    var tip = document.getElementById('presetTip');
    if (tip) tip.textContent = found.note || '';
  }

  /* ======================================================================
   * 提示
   * ==================================================================== */

  function updateHints() {
    var v = getValues();
    var F = UI.Format;

    var feePerMonth = v.amount * (v.feeRate / 100);
    var payment = v.amount / v.months + feePerMonth;

    var tip = document.getElementById('feeTip');
    if (tip) {
      if (v.amount <= 0) {
        tip.textContent = '填上借款金额后自动计算每期还款。';
        tip.style.color = '';
      } else {
        tip.innerHTML = '每期还 <b>' + F.moneyFree(payment, 0) + '</b>（本金 ' +
                        F.moneyFree(v.amount / v.months, 0) + ' + 手续费 ' +
                        F.moneyFree(feePerMonth, 0) + '）';
        tip.style.color = '';
      }
    }

    var rateTip = document.getElementById('rateTip');
    if (rateTip) {
      if (v.feeRate <= 0) {
        rateTip.textContent = '填 0 就是真正的零费率分期。';
      } else if (v.feeRate >= 2) {
        rateTip.innerHTML = '月费率 <b>' + v.feeRate + '%</b> 偏高，真实年化会超过 40%。';
        rateTip.style.color = 'var(--danger)';
      } else {
        rateTip.textContent = '销售口径的年化 = ' + (v.feeRate * 12).toFixed(2) + '%，真实值要高得多。';
        rateTip.style.color = '';
      }
    }

    var extraTip = document.getElementById('extraTip');
    if (extraTip) {
      var extra = v.upfront + v.cutInterest;
      if (extra > 0) {
        extraTip.innerHTML = '前置扣费 <b>' + F.moneyFree(extra, 0) + '</b>，' +
                             '实际到手只有 <b>' + F.moneyFree(v.amount - extra, 0) + '</b>。';
        extraTip.style.color = 'var(--danger)';
      } else {
        extraTip.textContent = '一次性手续费和砍头息都会让真实利率进一步升高，没有就留 0。';
        extraTip.style.color = '';
      }
    }
  }

  /* ======================================================================
   * 事件
   * ==================================================================== */

  function bind(onChange) {
    Object.keys(FIELDS).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var cfg = FIELDS[id];

      el.addEventListener('input', function () {
        if (cfg.money) formatMoneyInput(el);
        updateHints();
        onChange();
      });

      el.addEventListener('blur', function () {
        setValue(id, clamp(readNum(id), cfg));
        onChange();
      });
    });

    var sel = document.getElementById('preset');
    if (sel) {
      sel.addEventListener('change', function () {
        applyPreset(sel.value, false);
        onChange();
      });
    }
  }

  function reset() {
    Object.keys(DEFAULTS).forEach(function (id) { setValue(id, DEFAULTS[id]); });
    var sel = document.getElementById('preset');
    if (sel) { sel.value = 'creditcard'; applyPreset('creditcard', true); }
    updateHints();
  }

  function init() {
    renderPresets();
    Object.keys(DEFAULTS).forEach(function (id) { setValue(id, DEFAULTS[id], true); });
    updateHints();
  }

  UI.Form = {
    init: init,
    getValues: getValues,
    setValue: setValue,
    reset: reset,
    bind: bind,
    updateHints: updateHints,
    groupThousands: groupThousands,
    FIELDS: FIELDS,
    DEFAULTS: DEFAULTS
  };
})(APP.UI);
