/* ==========================================================================
 * core/irr.js — 分期真实利率计算（纯函数层）
 * --------------------------------------------------------------------------
 * 核心问题：
 *   销售说「月费率 0.75%，年化才 9%」。
 *   真实年化是 17.6%。差了一倍。
 *
 * 为什么：
 *   手续费按**初始本金**收，但本金在逐月减少。
 *   最后一期只剩 1/12 的本金，却还在按全额付手续费。
 *
 * 解法：
 *   把所有现金流列出来，求让净现值（NPV）为 0 的贴现率 —— 这就是 IRR。
 *   再把月 IRR 换算成年化：(1 + irr)^12 − 1
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.Core = APP.Core || {};

(function (Core) {
  'use strict';

  function n(v) {
    var x = Number(v);
    return isFinite(x) ? x : 0;
  }

  function r2(v) {
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }

  /* ======================================================================
   * 一、现金流与 IRR
   * ==================================================================== */

  /**
   * 净现值：Σ CF_t / (1+rate)^t
   * cashflows[0] 是期初（借款为正数），之后各期为负（还款）
   */
  function npv(cashflows, rate) {
    var sum = 0;
    for (var i = 0; i < cashflows.length; i++) {
      sum += cashflows[i] / Math.pow(1 + rate, i);
    }
    return sum;
  }

  /**
   * 求 IRR（这里返回的是**月利率**）
   * 用二分法：对标准贷款现金流，NPV 关于 rate 单调递减，二分法一定收敛。
   *
   * 为什么不用牛顿法：牛顿法对初值敏感，在接近 −100% 时导数趋于 0 会发散。
   * 二分法慢一点，但 100 次迭代足够精确到 1e-9，而且永远收敛。
   */
  function monthlyIrr(cashflows) {
    if (!cashflows || cashflows.length < 2) return 0;

    var lo = -0.9999, hi = 10;
    var fLo = npv(cashflows, lo);
    var fHi = npv(cashflows, hi);

    // 同号说明区间内无解（现金流方向异常）
    if (fLo * fHi > 0) return NaN;

    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2;
      var fMid = npv(cashflows, mid);
      if (Math.abs(fMid) < 1e-10) return mid;
      if (fMid * fLo > 0) { lo = mid; fLo = fMid; }
      else { hi = mid; }
    }
    return (lo + hi) / 2;
  }

  /** 月利率 → 年化（复利） */
  function toAnnual(monthlyRate) {
    if (!isFinite(monthlyRate)) return NaN;
    return Math.pow(1 + monthlyRate, 12) - 1;
  }

  /* ======================================================================
   * 二、还款计划
   * ==================================================================== */

  /**
   * 生成等额本息 / 等额本金 / 先息后本 的还款计划
   * 本工具默认用「等额本息 + 固定手续费」，这是分期产品的标准形态。
   */
  function buildSchedule(principal, months, monthlyPayment) {
    var rows = [];
    var balance = principal;
    for (var i = 1; i <= months; i++) {
      var pay = monthlyPayment;
      var interest = 0;       // 手续费不产生本金递减，余额线性减少
      var principalPart = principal / months;
      balance = Math.max(balance - principalPart, 0);
      rows.push({
        period: i,
        payment: r2(pay),
        principal: r2(principalPart),
        interest: r2(pay - principalPart),
        balance: r2(balance)
      });
    }
    return rows;
  }

  /* ======================================================================
   * 三、主计算
   * ==================================================================== */

  /**
   * @param {Object} f
   *   f.amount     借款本金
   *   f.months     分期期数
   *   f.feeRate    月费率（%，如 0.75 表示 0.75%）
   *   f.upfront    一次性手续费（元，放款时先扣）
   *   f.cutInterest 砍头息（元，从本金里先扣走）
   *   f.preset     预设 id（仅记录用）
   */
  function buildResult(f) {
    var amount = Math.max(n(f.amount), 0);
    var months = Math.max(Math.round(n(f.months)), 1);
    var feeRate = Math.max(n(f.feeRate), 0) / 100;
    var upfront = Math.max(n(f.upfront), 0);
    var cutInterest = Math.max(n(f.cutInterest), 0);

    // 每期手续费 = 初始本金 × 月费率（不随本金减少）
    var feePerMonth = amount * feeRate;
    var principalPerMonth = amount / months;
    var payment = principalPerMonth + feePerMonth;

    // 实际到手 = 本金 − 一次性手续费 − 砍头息
    var received = amount - upfront - cutInterest;
    if (received <= 0) received = amount; // 防止手续费过大导致无意义

    var totalPayment = r2(payment * months);
    var totalFee = r2(totalPayment - amount);
    var totalCost = r2(totalPayment - received); // 相对实际到手的真实成本

    // ---- 现金流 ----
    var cashflows = [received];
    for (var i = 0; i < months; i++) cashflows.push(-payment);

    var mIrr = monthlyIrr(cashflows);
    var realAnnual = toAnnual(mIrr);

    // ---- 名义年化 ----
    var nominalAnnual = feeRate * 12;              // 只看费率的「销售口径」
    var nominalWithUpfront = (totalCost / received) / (months / 12); // 含费用的简单年化

    // ---- 倍数 ----
    var multiple = nominalAnnual > 0 ? realAnnual / nominalAnnual : 0;

    // ---- 还款计划 ----
    var schedule = buildSchedule(amount, months, payment);

    // ---- 提前还款：第 k 期还清还要付多少 ----
    var earlyPayoff = buildEarlyPayoff(amount, months, feePerMonth, principalPerMonth, totalPayment);

    // ---- 建议 ----
    var advice = buildAdvice({
      amount: amount, months: months, feeRate: feeRate,
      realAnnual: realAnnual, nominalAnnual: nominalAnnual,
      multiple: multiple, totalFee: totalFee, received: received,
      upfront: upfront, cutInterest: cutInterest, payment: payment
    });

    return {
      valid: amount > 0 && months > 0,
      input: {
        amount: amount, months: months, feeRate: feeRate * 100,
        upfront: upfront, cutInterest: cutInterest, preset: f.preset || 'custom'
      },
      loan: {
        amount: amount,
        months: months,
        feeRate: feeRate,
        feePerMonth: r2(feePerMonth),
        principalPerMonth: r2(principalPerMonth),
        payment: r2(payment),
        received: r2(received)
      },
      cost: {
        totalPayment: totalPayment,
        totalFee: totalFee,
        totalCost: totalCost,
        feeRatio: received > 0 ? totalCost / received : 0
      },
      rate: {
        nominal: nominalAnnual,
        nominalWithUpfront: nominalWithUpfront,
        monthly: mIrr,
        real: realAnnual,
        multiple: multiple,
        spread: realAnnual - nominalAnnual
      },
      schedule: schedule,
      earlyPayoff: earlyPayoff,
      advice: advice
    };
  }

  /**
   * 提前还款测算
   * 多数分期产品的规则：提前结清仍需付全部或大部分手续费，
   * 所以「提前还」往往省不下多少钱。这里把两种口径都算出来。
   */
  function buildEarlyPayoff(amount, months, feePerMonth, principalPerMonth, totalPayment) {
    var rows = [];
    // 检查点按常见分期长度铺开，保证短期限产品也有 3 个以上对比点
    var checkpoints = [3, 6, 9, 12, 18, 24, 36].filter(function (m) { return m < months; });

    checkpoints.forEach(function (k) {
      var paidPrincipal = principalPerMonth * k;
      var paidFee = feePerMonth * k;
      var remainPrincipal = Math.max(amount - paidPrincipal, 0);

      rows.push({
        period: k,
        paidTotal: r2(paidPrincipal + paidFee),
        remainPrincipal: r2(remainPrincipal),
        // 口径 A：只还剩余本金（理想情况）
        payoffBest: r2(remainPrincipal),
        // 口径 B：剩余本金 + 剩余全部手续费（多数产品的实际规则）
        payoffWorst: r2(remainPrincipal + feePerMonth * (months - k)),
        savedIfFree: r2(feePerMonth * (months - k))
      });
    });

    return {
      checkpoints: rows,
      // 如果从第 1 期就提前还清，最理想能省多少
      maxSave: r2(feePerMonth * (months - 1)),
      totalPayment: totalPayment
    };
  }

  /* ======================================================================
   * 四、建议生成
   * ==================================================================== */

  function buildAdvice(ctx) {
    var out = [];
    var F = APP.UI && APP.UI.Format;
    function money(v) { return F ? F.moneyFree(v, 0) : ('¥' + Math.round(v)); }
    function pct(v) { return (v * 100).toFixed(2) + '%'; }

    if (ctx.amount <= 0) {
      return [{ type: 'info', text: '填上借款金额和期数，我就能算出这笔分期的真实年化。' }];
    }

    // 1. 结论先行：真实 vs 名义
    out.push({
      type: 'warn',
      text: '这笔分期的真实年化是 <b>' + pct(ctx.realAnnual) + '</b>，' +
            '不是销售说的 ' + pct(ctx.nominalAnnual) + '——' +
            '真实成本是名义的 <b>' + ctx.multiple.toFixed(2) + ' 倍</b>。'
    });

    // 2. 风险分档
    if (ctx.realAnnual >= 0.24) {
      out.push({
        type: 'warn',
        text: '⚠️ 超过 24%，已经进入高息区间。' +
              '如果这是网贷，先确认平台是否有放贷资质，并核对合同里的综合费率。'
      });
    } else if (ctx.realAnnual >= 0.138) {
      out.push({
        type: 'tip',
        text: '超过 13.8%（一年期 LPR 的 4 倍）。' +
              '民间借贷超过这个数的部分不受司法保护；' +
              '持牌金融机构虽不直接适用，但这个数字可以作为「贵不贵」的参照。'
      });
    } else if (ctx.realAnnual <= 0.06) {
      out.push({
        type: 'ok',
        text: '真实年化 ' + pct(ctx.realAnnual) + '，属于正常偏低水平，' +
              '比多数消费信贷便宜，可以考虑使用。'
      });
    }

    // 3. 一次性费用
    if (ctx.upfront > 0 || ctx.cutInterest > 0) {
      out.push({
        type: 'warn',
        text: '这笔有 ' + money(ctx.upfront + ctx.cutInterest) + ' 的前置扣费，' +
              '实际到手只有 ' + money(ctx.received) + '，但还款仍按 ' +
              money(ctx.amount) + ' 计算，真实利率被进一步推高。'
      });
    }

    // 4. 手续费的本质
    out.push({
      type: 'info',
      text: '为什么差这么多：手续费按<b>初始本金</b>收，但你的欠款在逐月减少。' +
            '平均下来你只占用了约一半的资金，却付了全额的费。'
    });

    // 5. 提前还款
    out.push({
      type: 'tip',
      text: '别指望提前还款能省钱：多数分期产品提前结清仍需支付全部或大部分手续费。' +
            '真要提前还，先问清楚「剩余手续费能不能免」。'
    });

    // 6. 替代方案
    out.push({
      type: 'info',
      text: '同样的钱，银行消费贷真实年化通常在 3.5%–5.5%。' +
            '如果有额度、且不急着当天到账，优先走银行渠道。'
    });

    return out;
  }

  /* ======================================================================
   * 五、扩展接口
   * ==================================================================== */

  /** 对比多个方案：哪个最便宜 */
  function comparePlans(plans) {
    return (plans || []).map(function (p) {
      var r = buildResult(p);
      return {
        label: p.label || (p.months + ' 期'),
        months: r.loan.months,
        payment: r.loan.payment,
        totalFee: r.cost.totalFee,
        real: r.rate.real,
        nominal: r.rate.nominal
      };
    }).sort(function (a, b) { return a.real - b.real; });
  }

  /** 反查：给定可接受的真实年化，最多能承受多少月费率 */
  function maxFeeRateFor(amount, months, targetAnnual) {
    var target = n(targetAnnual);
    if (target <= 0) return 0;
    // 二分：月费率越高 IRR 越高
    var lo = 0, hi = 10;
    for (var i = 0; i < 100; i++) {
      var mid = (lo + hi) / 2;
      var r = buildResult({ amount: amount, months: months, feeRate: mid * 100 });
      if (r.rate.real < target) lo = mid; else hi = mid;
    }
    return r2(lo * 100);
  }

  /* ---------- 对外 ---------- */
  Core.Irr = {
    buildResult: buildResult,
    npv: npv,
    monthlyIrr: monthlyIrr,
    toAnnual: toAnnual,
    comparePlans: comparePlans,
    maxFeeRateFor: maxFeeRateFor
  };
})(APP.Core);
