/* ==========================================================================
 * tests/smoke.js — 分期真实利率计算器冒烟测试
 * --------------------------------------------------------------------------
 * 期望值全部按年金公式手算，不复用被测函数。
 *   node ../_tools/eval.mjs "file:///<绝对路径>/index.html" "tests/smoke.js"
 * ========================================================================== */

(async function () {
  var out = { total: 0, passed: 0, failed: 0, failures: [] };

  function ok(name, cond, got) {
    out.total++;
    if (cond) out.passed++;
    else { out.failed++; out.failures.push(name + '  →  got: ' + JSON.stringify(got)); }
  }
  function near(name, got, want, tol) {
    ok(name, Math.abs(Number(got) - Number(want)) <= (tol == null ? 0.02 : tol),
       got + ' (want ' + want + ')');
  }
  function eq(name, got, want) {
    ok(name, String(got) === String(want), got + ' (want ' + want + ')');
  }
  function $(id) { return document.getElementById(id); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var I = APP.Core.Irr;

  function base(over) {
    var f = { amount: 12000, months: 12, feeRate: 0.75, upfront: 0, cutInterest: 0 };
    Object.keys(over || {}).forEach(function (k) { f[k] = over[k]; });
    return f;
  }

  /* ==================================================================
   * 一、IRR 求解器本身
   * ================================================================== */

  // 简单验证：借 1000，12 期，每月还 100（零利息）
  eq('零利息时 IRR = 0', Math.round(I.monthlyIrr([1200].concat(Array(12).fill(-100))) * 1e6) / 1e6, 0);

  // 借 1000，1 期还 1100 → 月利率 10%
  near('一期 10% → IRR 0.10', I.monthlyIrr([1000, -1100]), 0.10, 0.0001);

  // 借 1000，1 期还 1200 → 月利率 20%，年化 = 1.2^12 - 1
  near('一期 20% → 年化 = 1.2^12 − 1',
       I.toAnnual(I.monthlyIrr([1000, -1200])),
       Math.pow(1.2, 12) - 1, 0.001);

  // NPV 在解处应为 0
  var cf = [12000];
  for (var i = 0; i < 12; i++) cf.push(-1090);
  var r0 = I.monthlyIrr(cf);
  near('NPV 在 IRR 处为 0', I.npv(cf, r0), 0, 1e-6);

  /* ==================================================================
   * 二、主计算：12000 元 / 12 期 / 月费率 0.75%
   * ================================================================== */

  var r = I.buildResult(base());

  eq('每期手续费 = 12000 × 0.75% = 90', r.loan.feePerMonth, 90);
  eq('每期本金 = 1000', r.loan.principalPerMonth, 1000);
  eq('每期还款 = 1090', r.loan.payment, 1090);
  eq('总还款 = 13080', r.cost.totalPayment, 13080);
  eq('总手续费 = 1080', r.cost.totalFee, 1080);
  eq('名义年化 = 0.75% × 12 = 9%', Math.round(r.rate.nominal * 10000) / 10000, 0.09);

  // 真实年化：解 12000 = 1090 × [1−(1+r)^−12]/r
  ok('真实年化落在 17.3%–17.7% 之间', r.rate.real > 0.173 && r.rate.real < 0.177,
     (r.rate.real * 100).toFixed(3) + '%');
  near('真实年化约 17.48%', r.rate.real, 0.1748, 0.0025);

  // 倍数
  ok('真实是名义的约 1.94 倍', r.rate.multiple > 1.90 && r.rate.multiple < 1.99,
     r.rate.multiple.toFixed(3));

  /* ==================================================================
   * 三、期数与费率的单调性
   * ================================================================== */

  var r3 = I.buildResult(base({ months: 3 }));
  var r24 = I.buildResult(base({ months: 24 }));

  ok('期数越长，真实年化越高', r24.rate.real > r.rate.real && r.rate.real > r3.rate.real,
     [r3.rate.real, r.rate.real, r24.rate.real].map(function (v) { return (v * 100).toFixed(1); }));
  ok('3 期真实年化在 13.5%–15%', r3.rate.real > 0.135 && r3.rate.real < 0.15,
     (r3.rate.real * 100).toFixed(2) + '%');
  ok('24 期真实年化在 17.5%–19%', r24.rate.real > 0.175 && r24.rate.real < 0.19,
     (r24.rate.real * 100).toFixed(2) + '%');

  var rLow = I.buildResult(base({ feeRate: 0.3 }));
  ok('月费率 0.3% 的真实年化低于 0.75% 的', rLow.rate.real < r.rate.real,
     (rLow.rate.real * 100).toFixed(2) + '%');

  var rZero = I.buildResult(base({ feeRate: 0 }));
  near('费率 0 时真实年化 = 0', rZero.rate.real, 0, 0.0001);

  /* ==================================================================
   * 四、前置费用：手续费与砍头息
   * ================================================================== */

  var rUp = I.buildResult(base({ upfront: 600 }));
  eq('一次性手续费不改变每期还款', rUp.loan.payment, 1090);
  eq('实际到手 = 12000 − 600', rUp.loan.received, 11400);
  ok('前置手续费推高真实年化', rUp.rate.real > r.rate.real,
     (rUp.rate.real * 100).toFixed(2) + '%');

  var rCut = I.buildResult(base({ cutInterest: 1200 }));
  eq('砍头息后实际到手 10800', rCut.loan.received, 10800);
  ok('砍头息 10% 让真实年化明显上升', rCut.rate.real > r.rate.real * 1.1,
     (rCut.rate.real * 100).toFixed(2) + '%');

  /* ==================================================================
   * 五、边界
   * ================================================================== */

  var empty = I.buildResult({ amount: 0, months: 12, feeRate: 0.75 });
  eq('金额为 0 时 valid=false', empty.valid, false);

  var neg = I.buildResult({ amount: -5000, months: -3, feeRate: -1 });
  eq('负数金额钳制为 0', neg.input.amount, 0);
  eq('负数期数钳制为 1', neg.input.months, 1);
  eq('负费率钳制为 0', neg.input.feeRate, 0);

  var huge = I.buildResult({ amount: 100000, months: 36, feeRate: 5 });
  ok('极端费率下仍返回有限值', isFinite(huge.rate.real), huge.rate.real);

  /* ==================================================================
   * 六、提前还款
   * ================================================================== */

  var ep = r.earlyPayoff.checkpoints;
  ok('提前还款有多个检查点', ep.length >= 3, ep.length);
  eq('第 3 期后剩余本金 = 9000', ep[0].remainPrincipal, 9000);
  eq('第 3 期后已付 = 3270', ep[0].paidTotal, 3270);
  ok('理想结清 < 实际结清', ep[0].payoffBest < ep[0].payoffWorst,
     ep[0].payoffBest + ' vs ' + ep[0].payoffWorst);
  eq('第 3 期后实际结清 = 9000 + 9×90 = 9810', ep[0].payoffWorst, 9810);

  /* ==================================================================
   * 七、还款计划
   * ================================================================== */

  eq('还款计划 12 期', r.schedule.length, 12);
  eq('第 1 期还款 1090', r.schedule[0].payment, 1090);
  eq('第 1 期手续费 90', r.schedule[0].interest, 90);
  eq('最后一期剩余本金 0', r.schedule[11].balance, 0);

  /* ==================================================================
   * 八、扩展接口
   * ================================================================== */

  var plans = I.comparePlans([
    { label: '3 期', amount: 12000, months: 3, feeRate: 0.75 },
    { label: '12 期', amount: 12000, months: 12, feeRate: 0.75 },
    { label: '24 期', amount: 12000, months: 24, feeRate: 0.75 }
  ]);
  eq('对比返回 3 条', plans.length, 3);
  eq('按真实年化升序，3 期最便宜', plans[0].label, '3 期');

  var maxFee = I.maxFeeRateFor(12000, 12, 0.10);
  ok('可接受 10% 时，月费率上限约 0.43%', maxFee > 0.40 && maxFee < 0.46,
     maxFee + '%');

  /* ==================================================================
   * 九、DOM 渲染
   * ================================================================== */

  ok('真实年化已渲染', $('heroValue').textContent.indexOf('%') > -1, $('heroValue').textContent);
  ok('对比条里出现名义年化 9.00%', $('compareBar').textContent.indexOf('9.00') > -1,
     $('compareBar').textContent.slice(0, 60));
  ok('对比条里出现真实年化 17.', $('compareBar').textContent.indexOf('17.') > -1,
     $('compareBar').textContent.slice(0, 80));
  ok('倍数徽章已渲染', $('multipleBadge').textContent.indexOf('倍') > -1, $('multipleBadge').textContent);
  ok('对比条有 2 行', document.querySelectorAll('#compareBar .cbar__row').length === 2, 0);
  eq('每期还款 1,090', $('metricPayment').textContent, '¥1,090');
  eq('实际到手 12,000', $('metricReceived').textContent, '¥12,000');

  ok('行业参照有行', document.querySelectorAll('#benchmarkList .bm-row').length >= 6,
     document.querySelectorAll('#benchmarkList .bm-row').length);
  ok('当前所处区间被高亮', document.querySelectorAll('#benchmarkList .is-current').length >= 1,
     document.querySelectorAll('#benchmarkList .is-current').length);

  ok('提前还款表有行', document.querySelectorAll('#earlyBody tr').length >= 3,
     document.querySelectorAll('#earlyBody tr').length);
  ok('还款计划表有行', document.querySelectorAll('#scheduleBody tr').length >= 6,
     document.querySelectorAll('#scheduleBody tr').length);

  eq('对照表 8 行', document.querySelectorAll('#bmTableBody tr').length, 8);
  eq('FAQ 12 条', document.querySelectorAll('#faqList .faq__item').length, 12);

  var ld = Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]'));
  ok('注入了 FAQPage', ld.some(function (s) { return s.textContent.indexOf('FAQPage') > -1; }), ld.length);

  /* ==================================================================
   * 十、交互
   * ================================================================== */

  // 10.1 切换预设 → 费率跟着变
  var sel = $('preset');
  sel.value = 'online';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(600);
  eq('切到网贷后月费率 = 1.5', $('feeRate').value, '1.5');
  ok('网贷的真实年化超过 30%',
     parseFloat($('heroValue').textContent) > 30, $('heroValue').textContent);

  sel.value = 'consumer';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(600);
  eq('切到银行消费贷后月费率 = 0.3', $('feeRate').value, '0.3');
  ok('银行消费贷真实年化低于 8%',
     parseFloat($('heroValue').textContent) < 8, $('heroValue').textContent);

  // 10.2 期数快捷按钮
  var btn24 = document.querySelector('[data-quickpick="months"] button[data-value="24"]');
  btn24.click();
  await sleep(700);
  eq('点 24 期后输入框变成 24', $('months').value, '24');
  ok('24 期后倍数仍在 1.9 倍以上',
     parseFloat($('multipleBadge').textContent.replace(/[^\d.]/g, '')) > 1.9,
     $('multipleBadge').textContent);

  // 10.3 加砍头息 → 到手金额变少
  var receivedBefore = $('metricReceived').textContent;
  $('cutInterest').value = '1,000';
  $('cutInterest').dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(700);
  ok('填砍头息后到手金额下降', $('metricReceived').textContent !== receivedBefore,
     receivedBefore + ' → ' + $('metricReceived').textContent);

  /* ==================================================================
   * 十一、建议
   * ================================================================== */

  var adv = r.advice.map(function (a) { return a.text; }).join('');
  ok('建议首条给出真实 vs 名义的结论', adv.indexOf('真实年化') > -1, adv.slice(0, 80));
  ok('建议里提到倍数', adv.indexOf('倍') > -1, '');
  ok('建议里解释为什么差这么多', adv.indexOf('初始本金') > -1, '');

  var advHigh = I.buildResult(base({ feeRate: 2.5 }))
    .advice.map(function (a) { return a.text; }).join('');
  ok('高息场景给出 24% 警告', advHigh.indexOf('24%') > -1, advHigh.slice(0, 80));

  var advLow = I.buildResult(base({ feeRate: 0.2 }))
    .advice.map(function (a) { return a.text; }).join('');
  ok('低息场景给出正面评价', advLow.indexOf('正常偏低') > -1 || advLow.indexOf('便宜') > -1,
     advLow.slice(0, 80));

  return out;
})()
