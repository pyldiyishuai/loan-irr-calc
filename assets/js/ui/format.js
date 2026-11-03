/* ==========================================================================
 * ui/format.js — 统一的数字 / 金额格式化
 * --------------------------------------------------------------------------
 * 全站只从这里取格式，避免同一个数在页面两个地方显示不一致。
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.UI = APP.UI || {};

(function (UI) {
  'use strict';

  var WAN = 10000;

  /** 千分位整数：1234567 → 1,234,567 */
  function int(v) {
    if (!isFinite(v)) return '—';
    return Math.round(v).toLocaleString('zh-CN');
  }

  /** 保留小数 + 千分位 */
  function num(v, decimals) {
    if (!isFinite(v)) return '—';
    var d = decimals === undefined ? 2 : decimals;
    return Number(v).toLocaleString('zh-CN', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  }

  /**
   * 智能金额：超过 1 万自动换成「万元」
   * 用于结果区，让数字更好读
   */
  function money(v) {
    if (!isFinite(v)) return '—';
    var abs = Math.abs(v);
    if (abs >= WAN) {
      return num(v / WAN, 2) + ' 万';
    }
    return int(v) + ' 元';
  }

  /** 带 ¥ 前缀的智能金额 */
  function moneyYuan(v) {
    if (!isFinite(v)) return '—';
    var abs = Math.abs(v);
    if (abs >= WAN) return '¥' + num(v / WAN, 2) + ' 万';
    return '¥' + int(v);
  }

  /** 纯整数元，带 ¥ */
  function yuan(v) {
    if (!isFinite(v)) return '—';
    return '¥' + int(v);
  }

  /** 万元，固定两位 */
  function wan(v) {
    if (!isFinite(v)) return '—';
    return num(v / WAN, 2) + ' 万';
  }

  /** 固定用元显示，保留小数（利率场景的金额多在千元级，用「万」反而不直观） */
  function moneyFree(v, decimals) {
    if (!isFinite(v)) return '—';
    var d = decimals === undefined ? 2 : decimals;
    return '¥' + num(v, d);
  }

  /** 百分比：0.1523 → 15.23% */
  function percent(v, decimals) {
    if (!isFinite(v)) return '—';
    var d = decimals === undefined ? 2 : decimals;
    return (v * 100).toFixed(d) + '%';
  }

  /** 直接是百分数的值：4.2 → 4.2% */
  function rate(v) {
    if (!isFinite(v)) return '—';
    return Number(v).toFixed(2).replace(/\.?0+$/, '') + '%';
  }

  /** 期数 → 中文时长：38 → 3 年 2 个月 */
  function months(mo) {
    if (!isFinite(mo) || mo <= 0) return '0 期';
    mo = Math.round(mo);
    var y = Math.floor(mo / 12);
    var m = mo % 12;
    if (y && m) return y + ' 年 ' + m + ' 个月';
    if (y) return y + ' 年';
    return m + ' 个月';
  }

  /** 期数 → 简短时长（指标格用）：38 → 3年2月 */
  function monthsShort(mo) {
    if (!isFinite(mo) || mo <= 0) return '—';
    mo = Math.round(mo);
    var y = Math.floor(mo / 12);
    var m = mo % 12;
    if (y && m) return y + '年' + m + '月';
    if (y) return y + '年';
    return m + '月';
  }

  /** 年月日：2025-08-01 */
  function date(d) {
    if (!(d instanceof Date) || isNaN(d)) return '—';
    var p = function (x) { return String(x).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /** 从今天起偏移 n 个月的年月 */
  function addMonths(n) {
    var d = new Date();
    d.setMonth(d.getMonth() + Math.round(n));
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
  }

  /** 带正负号：+1,234 / −1,234 */
  function signed(v, fmt) {
    if (!isFinite(v)) return '—';
    var s = (fmt || int)(Math.abs(v));
    return (v > 0 ? '+' : v < 0 ? '−' : '') + s;
  }

  UI.Format = {
    int: int,
    num: num,
    money: money,
    moneyYuan: moneyYuan,
    moneyFree: moneyFree,
    yuan: yuan,
    wan: wan,
    percent: percent,
    rate: rate,
    months: months,
    monthsShort: monthsShort,
    date: date,
    addMonths: addMonths,
    signed: signed
  };
})(APP.UI);
