/* ==========================================================================
 * ui/chart.js — 用纯 DOM 画条形图（零依赖、零体积、可直接截图）
 * --------------------------------------------------------------------------
 * 为什么不用 ECharts/Chart.js：
 *   一个纯计算器站点，加载 100KB+ 的图表库会让首屏变慢、SEO 打分下降。
 *   这里只需要条形对比，十几行 CSS 就够了。
 *
 * 【扩展点】以后要做「利息随年限变化的折线图」，加一个 renderLine() 用 SVG 实现即可，
 * 接口保持 renderBars(container, data) 的风格。
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.UI = APP.UI || {};

(function (UI) {
  'use strict';

  /**
   * 渲染条形图
   * @param {HTMLElement} container
   * @param {Array<{label:string, value:number, cls:string}>} data
   */
  function renderBars(container, data) {
    if (!container || !data || !data.length) return;

    var max = Math.max.apply(null, data.map(function (d) {
      return Math.abs(d.value) || 0;
    }));
    if (max <= 0) max = 1;

    var f = UI.Format;
    container.innerHTML = data.map(function (d) {
      var pct = Math.max((Math.abs(d.value) / max) * 100, 1.5);
      return '' +
        '<div class="bar-row">' +
          '<div class="bar-row__label">' +
            '<span>' + d.label + '</span>' +
            '<b>' + f.wan(d.value) + '</b>' +
          '</div>' +
          '<div class="bar-row__track">' +
            '<div class="bar-row__fill bar-row__fill--' + d.cls + '" ' +
                 'style="width:' + pct + '%"></div>' +
          '</div>' +
        '</div>';
    }).join('');

    // 下一帧再设宽度，触发 CSS transition（进场动画）
    requestAnimationFrame(function () {
      container.querySelectorAll('.bar-row__fill').forEach(function (el, i) {
        var target = el.style.width;
        el.style.width = '0';
        setTimeout(function () { el.style.width = target; }, 60 + i * 90);
      });
    });
  }

  /* ---------- 对外 ---------- */
  UI.Chart = {
    renderBars: renderBars
  };
})(APP.UI);
