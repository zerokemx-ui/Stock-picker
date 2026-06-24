/**
 * 威力台股情報站 - 選股策略與技術指標（全面改用真實資料）
 *
 * 重大變更（相對舊版）：
 *  - 移除所有以股票代碼為種子的「假 K 線 / 假基本面 / 假籌碼」產生器。
 *  - checkSOPStrategy 改吃真實日線歷史（history.json）、真實籌碼（chip.json）、
 *    真實月營收（fundamentals.json）；資料不足時誠實回報，而非捏造通過。
 *  - 新增 computeIndicators：由真實歷史計算多日指標，供策略與表格使用。
 *  - runDCABacktest 在有足夠真實歷史時，用歷史年化報酬推估，並標示資料來源。
 */

// =============================================================
// 基礎格式化工具
// =============================================================
export function formatVolumeInChang(sharesStr) {
  const shares = parseInt(sharesStr) || 0;
  return Math.floor(shares / 1000).toLocaleString('zh-TW') + ' 張';
}

export function formatValueInYi(valueStr) {
  const val = parseFloat(valueStr) || 0;
  if (val >= 100000000) return (val / 100000000).toFixed(2) + ' 億';
  if (val >= 10000) return (val / 10000).toFixed(2) + ' 萬';
  return val.toLocaleString('zh-TW') + ' 元';
}

export function calculateChangePercent(closingPriceStr, changeStr) {
  const price = parseFloat(closingPriceStr) || 0;
  const change = parseFloat(changeStr) || 0;
  if (price === 0) return 0;
  const previousPrice = price - change;
  if (previousPrice <= 0) return 0;
  return (change / previousPrice) * 100;
}

export function calculateChangeRate(closingPriceStr, changeStr) {
  const change = parseFloat(changeStr) || 0;
  const rate = calculateChangePercent(closingPriceStr, changeStr);
  const sign = change > 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)}%`;
}

export function getChangeColorClass(changeStr) {
  const change = parseFloat(changeStr) || 0;
  if (change > 0) return 'up-text';
  if (change < 0) return 'down-text';
  return 'flat-text';
}

export function safeFloat(val, fallback = 0) {
  if (val === null || val === undefined || val === '') return fallback;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? fallback : parsed;
}

// =============================================================
// 真實歷史 → 技術指標
// =============================================================

/** 把 history.json 的 bar（{d,o,h,l,c,v}）或 {open,...} 正規化為升冪 OHLC 陣列 */
export function normalizeBars(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((b) => ({
      date: b.d || b.date || '',
      open: Number(b.o ?? b.open ?? b.c ?? b.close ?? 0),
      high: Number(b.h ?? b.high ?? b.c ?? b.close ?? 0),
      low: Number(b.l ?? b.low ?? b.c ?? b.close ?? 0),
      close: Number(b.c ?? b.close ?? 0),
      volume: Number(b.v ?? b.volume ?? 0)
    }))
    .filter((b) => b.close > 0);
}

function maSeries(values, period) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (i >= period - 1) {
      let s = 0;
      for (let j = 0; j < period; j++) s += values[i - j];
      out.push(s / period);
    } else {
      out.push(values[i]); // 暖身期以當值代入，維持序列長度與穩定
    }
  }
  return out;
}

function macdHistSeries(closes) {
  const hist = [];
  let ema12 = closes[0];
  let ema26 = closes[0];
  let dea = 0;
  const k12 = 2 / 13;
  const k26 = 2 / 27;
  const k9 = 2 / 10;
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    ema12 = c * k12 + ema12 * (1 - k12);
    ema26 = c * k26 + ema26 * (1 - k26);
    const dif = ema12 - ema26;
    dea = dif * k9 + dea * (1 - k9);
    hist.push((dif - dea) * 2);
  }
  return hist;
}

function kdSeries(bars) {
  const K = [];
  const D = [];
  let curK = 50;
  let curD = 50;
  for (let i = 0; i < bars.length; i++) {
    if (i < 8) {
      K.push(50);
      D.push(50);
      continue;
    }
    let low9 = Infinity;
    let high9 = -Infinity;
    for (let j = 0; j < 9; j++) {
      const b = bars[i - j];
      if (b.low < low9) low9 = b.low;
      if (b.high > high9) high9 = b.high;
    }
    const rsv = high9 === low9 ? 50 : ((bars[i].close - low9) / (high9 - low9)) * 100;
    curK = (2 / 3) * curK + (1 / 3) * rsv;
    curD = (2 / 3) * curD + (1 / 3) * curK;
    K.push(curK);
    D.push(curD);
  }
  return { K, D };
}

function rsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

const pctChange = (a, b) => (b > 0 ? ((a - b) / b) * 100 : 0);
const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

/**
 * 由真實歷史計算多日指標快照。資料不足的欄位回傳 null。
 * 提供給選股策略與表格排序使用。
 */
export function computeIndicators(history) {
  const bars = normalizeBars(history);
  const n = bars.length;
  if (n < 2) return { dataDays: n };

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const vols = bars.map((b) => b.volume);
  const last = n - 1;

  const ma = (p) => (n >= p ? avg(closes.slice(n - p)) : null);
  const slice = (arr, k) => arr.slice(Math.max(0, n - k));

  const avgVol5 = avg(slice(vols, 5));
  const avgVol20 = avg(slice(vols, 20));

  return {
    dataDays: n,
    close: closes[last],
    ma5: ma(5),
    ma10: ma(10),
    ma20: ma(20),
    ma60: ma(60),
    changePct1: Number(pctChange(closes[last], closes[last - 1]).toFixed(2)),
    changePct5: n > 5 ? Number(pctChange(closes[last], closes[last - 5]).toFixed(2)) : null,
    changePct20: n > 20 ? Number(pctChange(closes[last], closes[last - 20]).toFixed(2)) : null,
    avgVol5: Math.round(avgVol5),
    avgVol20: Math.round(avgVol20),
    volRatio: avgVol5 > 0 ? Number((vols[last] / avgVol5).toFixed(2)) : null,
    high20: n >= 20 ? Math.max(...slice(highs, 20)) : null,
    low20: n >= 20 ? Math.min(...slice(lows, 20)) : null,
    high60: n >= 60 ? Math.max(...slice(highs, 60)) : null,
    distFromHigh20: n >= 20 ? Number(pctChange(closes[last], Math.max(...slice(highs, 20))).toFixed(2)) : null,
    rsi14: rsi(closes, 14),
    trendUp: n >= 20 ? ma(5) > ma(10) && ma(10) > ma(20) : null
  };
}

// =============================================================
// SOP 多頭 / 空頭篩選（真實資料版）
// =============================================================
const MIN_HISTORY_FOR_SOP = 35; // 至少要能算 MA20 與趨勢結構

function emptyHistoryResult(stock, reason) {
  return {
    code: stock.Code,
    name: stock.Name,
    category: stock.Category,
    price: parseFloat(stock.ClosingPrice) || 0,
    change: parseFloat(stock.Change) || 0,
    changeRate: calculateChangePercent(stock.ClosingPrice, stock.Change),
    capital: stock.CapitalYi ?? null,
    eps: null,
    revenueGrowth: null,
    chipNetBuy: null,
    isCapitalOk: null, isSectorOk: false, isRevenueOk: null, isEpsOk: null, isChipOk: null,
    passStep1: false,
    isMAAlignmentOk: false, isPricePositionOk: false, isMACDOk: false, isKDCrossOk: false, isTrendOk: false,
    passStep2: false,
    isScenarioA: false, isScenarioB: false, passStep3: false, scenario: null,
    dataSufficient: false,
    insufficientReason: reason,
    historyData: { ma10: 0, ma20: 0, K: 0, D: 0, macd: 0 }
  };
}

/**
 * @param {object} stock      stocks.json 個股
 * @param {string[]} hotSectors 關注產業
 * @param {object} options    { maxCapital, relaxKD, radarMode,
 *                              history, chip, fundamentals }  ← 皆為「該檔」的真實資料
 */
export function checkSOPStrategy(stock, hotSectors = [], options = {}) {
  const isShort = options.radarMode === 'short';
  const bars = normalizeBars(options.history);

  // 沒有足夠真實歷史 → 誠實回報資料不足（不再捏造 K 線）
  if (bars.length < MIN_HISTORY_FOR_SOP) {
    const res = emptyHistoryResult(stock, '真實歷史資料不足，請先執行 backfill-history 或等待每日累積');
    res.isSectorOk = hotSectors.length === 0 || hotSectors.includes(stock.Category);
    return res;
  }

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const n = bars.length;
  const last = n - 1;
  const prev = n - 2;

  // ---------- Step 1：基本面與籌碼（真實） ----------
  const capital = options.capitalYi ?? stock.CapitalYi ?? null;
  const isCapitalOk = capital == null ? null : capital <= (options.maxCapital || 50);
  const isSectorOk = hotSectors.length === 0 || hotSectors.includes(stock.Category);

  const fund = options.fundamentals || null;
  const revenueGrowth = fund && fund.revenueYoY != null ? fund.revenueYoY : null;
  const eps = fund && fund.eps != null ? fund.eps : null;

  const chip = options.chip || null;
  const trades = chip && Array.isArray(chip.dailyTrades) ? chip.dailyTrades : [];
  const chipNetBuy = trades.length
    ? trades.slice(-3).reduce((s, d) => s + (Number(d.netTotal) || 0), 0)
    : null;

  const isRevenueOk = revenueGrowth == null ? null : isShort ? revenueGrowth < 0 : revenueGrowth > 0;
  const isEpsOk = eps == null ? null : isShort ? eps <= 0 : eps > 0;
  const isChipOk = chipNetBuy == null ? null : isShort ? chipNetBuy < 0 : chipNetBuy > 0;

  // 未知條件（null）不阻擋；但若該檔完全無基本面/籌碼可佐證，仍由技術面（Step2/3）把關
  const nz = (x) => (x === null ? true : x);
  const revenueOrEps = isShort
    ? (isRevenueOk === null && isEpsOk === null ? true : (isRevenueOk === true || isEpsOk === true))
    : (nz(isRevenueOk) && nz(isEpsOk));

  const passStep1 = isSectorOk && nz(isCapitalOk) && revenueOrEps && nz(isChipOk);

  // ---------- Step 2：技術指標與型態（真實 K 線） ----------
  const ma5 = maSeries(closes, 5);
  const ma10 = maSeries(closes, 10);
  const ma20 = maSeries(closes, 20);
  const macd = macdHistSeries(closes);
  const { K, D } = kdSeries(bars);

  const todayClose = closes[last];
  const todayMA5 = ma5[last];
  const todayMA10 = ma10[last];
  const todayMA20 = ma20[last];
  const yestMA5 = ma5[prev];
  const yestMA10 = ma10[prev];
  const yestMA20 = ma20[prev];

  const isMAAlignmentOk = isShort
    ? todayMA10 < todayMA20 && todayMA10 <= yestMA10 && todayMA20 <= yestMA20
    : todayMA10 > todayMA20 && todayMA10 >= yestMA10 && todayMA20 >= yestMA20;

  const isPricePositionOk = isShort
    ? todayClose < todayMA10 && todayClose < todayMA20
    : todayClose > todayMA10 && todayClose > todayMA20;

  const todayMACD = macd[last];
  const yestMACD = macd[prev];
  const isMACDOk = isShort ? todayMACD <= yestMACD : todayMACD >= yestMACD;

  const todayK = K[last];
  const todayD = D[last];
  const yestK = K[prev];
  const yestD = D[prev];
  let isKDCrossOk;
  if (isShort) {
    isKDCrossOk = todayK <= todayD && yestK > yestD;
    if (options.relaxKD) {
      isKDCrossOk = isKDCrossOk || (todayK <= todayD && K[prev] <= D[prev] && K[n - 3] > D[n - 3]);
    }
  } else {
    isKDCrossOk = todayK >= todayD && yestK < yestD;
    if (options.relaxKD) {
      isKDCrossOk = isKDCrossOk || (todayK >= todayD && K[prev] >= D[prev] && K[n - 3] < D[n - 3]);
    }
  }

  // 尋找歷史頭/底（以收盤穿越 5MA 為界）
  const heads = [];
  const bottoms = [];
  let state = null;
  let periodStart = 0;
  for (let i = 0; i < n - 1; i++) {
    const close = bars[i].close;
    const m5 = ma5[i];
    if (close > m5) {
      if (state === 'BELOW') {
        let minLow = Infinity;
        let minIdx = -1;
        for (let k = periodStart; k < i; k++) {
          if (bars[k].low < minLow) { minLow = bars[k].low; minIdx = k; }
        }
        if (minIdx !== -1) bottoms.push({ index: minIdx, price: minLow });
        periodStart = i;
      } else if (state === null) periodStart = i;
      state = 'ABOVE';
    } else if (close < m5) {
      if (state === 'ABOVE') {
        let maxHigh = -Infinity;
        let maxIdx = -1;
        for (let k = periodStart; k < i; k++) {
          if (bars[k].high > maxHigh) { maxHigh = bars[k].high; maxIdx = k; }
        }
        if (maxIdx !== -1) heads.push({ index: maxIdx, price: maxHigh });
        periodStart = i;
      } else if (state === null) periodStart = i;
      state = 'BELOW';
    }
  }

  let isTrendOk;
  if (heads.length >= 2 && bottoms.length >= 2) {
    const lh = heads[heads.length - 1].price;
    const ph = heads[heads.length - 2].price;
    const lb = bottoms[bottoms.length - 1].price;
    const pb = bottoms[bottoms.length - 2].price;
    isTrendOk = isShort ? lh < ph && lb < pb : lh > ph && lb > pb;
  } else if (heads.length >= 1 && bottoms.length >= 1) {
    isTrendOk = isShort
      ? todayClose < todayMA20 && todayMA20 <= yestMA20
      : todayClose > todayMA20 && todayMA20 >= yestMA20;
  } else {
    isTrendOk = isShort
      ? todayClose < todayMA10 && todayMA10 <= yestMA10
      : todayClose > todayMA10 && todayMA10 >= yestMA10;
  }

  const passStep2 = isMAAlignmentOk && isPricePositionOk && isMACDOk && isKDCrossOk && isTrendOk;

  // ---------- Step 3：進場訊號 ----------
  const todayOpen = bars[last].open;
  const todayVol = bars[last].volume;
  const yestClose = bars[prev].close;
  const yestHigh = bars[prev].high;
  const yestLow = bars[prev].low;
  const changePct = pctChange(todayClose, yestClose);
  const avgVol5 = avg(bars.slice(n - 6, n - 1).map((b) => b.volume));

  let pullbackStart = -1;
  for (let k = prev; k >= 0; k--) {
    const isAbove = bars[k].close > ma5[k];
    if (isShort ? !isAbove : isAbove) { pullbackStart = k + 1; break; }
  }

  const priorBottom = bottoms.length ? bottoms[bottoms.length - 1].price : todayClose * 0.82;
  const priorPeak = heads.length ? heads[heads.length - 1].price : yestHigh;

  let isPullbackPerfect = false;
  if (pullbackStart !== -1 && pullbackStart <= prev) {
    let broken = false;
    for (let k = pullbackStart; k <= prev; k++) {
      if (isShort) {
        if (bars[k].high > priorPeak * 1.01) { broken = true; break; }
      } else if (bars[k].low < priorBottom * 0.99) { broken = true; break; }
    }
    isPullbackPerfect = !broken;
  }

  const isCross5MA = isShort
    ? todayClose < todayMA5 && bars[prev].close >= yestMA5
    : todayClose > todayMA5 && bars[prev].close <= yestMA5;
  const isMA20DirOk = isShort ? todayMA20 <= yestMA20 : todayMA20 >= yestMA20;
  const isSolidBar = isShort
    ? todayClose < todayOpen && changePct < -2.0
    : todayClose > todayOpen && changePct > 2.0;
  const isOverPriceBreak = isShort
    ? todayClose < yestLow || todayClose < priorBottom
    : todayClose > yestHigh || todayClose > priorPeak;
  const isVolumeAOk = todayVol > avgVol5;

  const isScenarioA = isPullbackPerfect && isCross5MA && isMA20DirOk && isSolidBar && isOverPriceBreak && isVolumeAOk;

  const rangeHigh = Math.max(...highs.slice(n - 10, n));
  const rangeLow = Math.min(...lows.slice(n - 10, n));
  const isConsolidation = (rangeHigh - rangeLow) / rangeLow <= 0.08;
  const isRangeBreak = isShort ? todayClose < rangeLow : todayClose > rangeHigh;
  const isVolumeBOk = todayVol > avgVol5 * 1.25;
  const isScenarioB = isSolidBar && isConsolidation && isRangeBreak && isVolumeBOk;

  let scenario = null;
  let passStep3 = false;
  if (passStep1 && passStep2) {
    if (isScenarioA) { scenario = 'A'; passStep3 = true; }
    else if (isScenarioB) { scenario = 'B'; passStep3 = true; }
  }

  return {
    code: stock.Code,
    name: stock.Name,
    category: stock.Category,
    price: todayClose,
    change: parseFloat(stock.Change),
    changeRate: changePct,
    capital,
    eps,
    revenueGrowth,
    chipNetBuy,
    isCapitalOk, isSectorOk, isRevenueOk, isEpsOk, isChipOk, passStep1,
    isMAAlignmentOk, isPricePositionOk, isMACDOk, isKDCrossOk, isTrendOk, passStep2,
    isScenarioA, isScenarioB, passStep3, scenario,
    dataSufficient: true,
    historyData: { ma10: todayMA10, ma20: todayMA20, K: todayK, D: todayD, macd: todayMACD }
  };
}

// =============================================================
// 定期定額回測（有真實歷史時以歷史年化推估）
// =============================================================
export function runDCABacktest(stock, monthlyAmount, years, history = null) {
  const yieldPct = parseFloat(stock.DividendYield) || 0;
  const bars = normalizeBars(history);

  let annualPriceReturn;
  let assumptionSource;

  if (bars.length >= 60) {
    // 由真實歷史窗推估年化價格報酬（CAGR），並夾在合理區間避免極端外推
    const first = bars[0].close;
    const lastC = bars[bars.length - 1].close;
    const yearsSpan = bars.length / 252;
    const cagr = Math.pow(lastC / first, 1 / Math.max(0.25, yearsSpan)) - 1;
    annualPriceReturn = Math.max(-0.15, Math.min(0.35, cagr));
    assumptionSource = 'historical';
  } else {
    // 無足夠歷史 → 保守預設，並明確標示為估計值（非歷史回測）
    annualPriceReturn = 0.06;
    assumptionSource = 'estimated';
  }

  const g_m = Math.pow(1 + annualPriceReturn, 1 / 12) - 1;
  const d_m = yieldPct / 100 / 12;
  const r_m = g_m + d_m;

  const months = years * 12;
  let principal = 0;
  let sharesValue = 0;
  let totalDividends = 0;
  const historyPts = [];

  for (let t = 1; t <= months; t++) {
    principal += monthlyAmount;
    const prevValue = sharesValue;
    sharesValue = (sharesValue + monthlyAmount) * (1 + r_m);
    totalDividends += (prevValue + monthlyAmount) * d_m;
    if (t % 3 === 0 || t === months) {
      const yearIndex = Math.floor((t - 1) / 12) + 1;
      const monthIndex = ((t - 1) % 12) + 1;
      historyPts.push({
        label: `${yearIndex}年${monthIndex}月`,
        cost: principal,
        value: Math.round(sharesValue),
        dividends: Math.round(totalDividends)
      });
    }
  }

  const roi = principal > 0 ? ((sharesValue - principal) / principal) * 100 : 0;
  const cagr = principal > 0 ? (Math.pow(sharesValue / principal, 1 / years) - 1) * 100 : 0;

  return {
    principal,
    finalValue: Math.round(sharesValue),
    totalDividends: Math.round(totalDividends),
    roi: parseFloat(roi.toFixed(2)),
    cagr: parseFloat(cagr.toFixed(2)),
    totalReturn: Math.round(sharesValue - principal),
    annualPriceReturn: Number((annualPriceReturn * 100).toFixed(2)),
    assumptionSource, // 'historical' | 'estimated'
    history: historyPts
  };
}

// =============================================================
// 籌碼面（沿用官方 TDCC 真實資料，僅整理呈現）
// =============================================================
export function generateChipData(stock, officialChip = null) {
  if (!stock) return null;

  if (!officialChip) {
    return {
      source: 'unavailable', isOfficial: false, dataDate: '',
      superLargePercent: null, largePercent: null, mediumPercent: null,
      retailPercent: null, below100Percent: null, cumulativeLargePercent: null,
      shareholderBase: null, dailyTrades: [],
      status: '籌碼資料不足', statusColor: '#94a3b8',
      diagnostic: '目前沒有官方 TDCC 股權分散資料，因此不產生籌碼集中或分散結論。'
    };
  }

  const superLargePercent = Number(officialChip.superLargePercent || 0);
  const largePercent = Number(officialChip.largePercent || 0);
  const cumulativeLargePercent = Number(officialChip.cumulativeLargePercent || 0);
  const retailPercent = Number(officialChip.retailPercent || 0);
  const below100Percent = Number(officialChip.below100Percent || 0);
  const mediumPercent = Number(Math.max(0, 100 - cumulativeLargePercent - retailPercent).toFixed(2));
  const dailyTrades = Array.isArray(officialChip.dailyTrades) ? officialChip.dailyTrades : [];
  const last3DaysNet = dailyTrades.slice(-3).reduce((s, d) => s + (Number(d.netTotal) || 0), 0);

  let status = '籌碼中性';
  let statusColor = '#38bdf8';
  if (cumulativeLargePercent >= 70 && retailPercent <= 30) {
    status = last3DaysNet >= 0 ? '大戶集中，法人偏買' : '大戶集中，法人調節';
    statusColor = last3DaysNet >= 0 ? '#ef4444' : '#38bdf8';
  } else if (cumulativeLargePercent >= 60) {
    status = last3DaysNet >= 0 ? '大戶持股偏高' : '大戶持股偏高，短線調節';
    statusColor = last3DaysNet >= 0 ? '#ef4444' : '#a855f7';
  } else if (retailPercent >= 40) {
    status = last3DaysNet < 0 ? '中小股東偏高，法人賣超' : '中小股東偏高';
    statusColor = '#fbbf24';
  }

  const institutionalText = dailyTrades.length
    ? `近 ${Math.min(3, dailyTrades.length)} 個交易日三大法人淨買賣超 ${last3DaysNet >= 0 ? '+' : ''}${last3DaysNet.toLocaleString()} 張。`
    : '三大法人近幾日資料未載入，因此不納入短線買賣壓判斷。';

  return {
    ...officialChip,
    source: officialChip.source || 'TDCC 集保股權分散表',
    isOfficial: true,
    superLargePercent, largePercent, mediumPercent, retailPercent, below100Percent,
    cumulativeLargePercent,
    shareholderBase: officialChip.shareholderBase || null,
    dailyTrades, status, statusColor,
    diagnostic: `官方 TDCC ${officialChip.dataDate || ''} 股權分散資料顯示，400 張以上大戶合計 ${cumulativeLargePercent}%（其中 1000 張以上 ${superLargePercent}%、400-1000 張 ${largePercent}%），400 張以下中小股東 ${retailPercent}%（100 張以下 ${below100Percent}%）。${institutionalText}`
  };
}

// =============================================================
// 基本面摘要（改用真實月營收；無資料則誠實標示，不再捏造）
// =============================================================
export function generateFundamentals(stock, fundamentals = null) {
  if (!stock) return null;

  const yoy = fundamentals && fundamentals.revenueYoY != null ? fundamentals.revenueYoY : null;
  const mom = fundamentals && fundamentals.revenueMoM != null ? fundamentals.revenueMoM : null;
  const eps = fundamentals && fundamentals.eps != null ? fundamentals.eps : null;

  if (yoy == null && eps == null) {
    return {
      isReal: false,
      revenueYoY: null, revenueMoM: null, eps: null,
      dataMonth: fundamentals ? fundamentals.dataMonth || '' : '',
      orderVisibility: '官方營收/財報資料尚未載入',
      capacityUtilization: 'N/A',
      moatScarcity: '⚖️ 尚無足夠官方基本面資料，無法評估護城河',
      industryTrend: '⚖️ 待官方月營收/財報更新後再行判斷',
      growthScore: null
    };
  }

  // 由真實營收年增率推導評分與評語（線性映射，夾在 5~95）
  const base = 50 + (yoy != null ? yoy : 0) * 1.2;
  const growthScore = Math.max(5, Math.min(95, Math.round(base)));

  let trend;
  if (yoy == null) trend = '⚖️ 本月營收年增資料未載入，僅供參考';
  else if (yoy >= 20) trend = `🔥 單月營收年增 ${yoy}%，動能強勁`;
  else if (yoy > 0) trend = `📈 單月營收年增 ${yoy}%，穩定成長`;
  else if (yoy > -15) trend = `⚖️ 單月營收年減 ${Math.abs(yoy)}%，動能轉弱`;
  else trend = `⚠️ 單月營收年減 ${Math.abs(yoy)}%，衰退明顯`;

  return {
    isReal: true,
    revenueYoY: yoy,
    revenueMoM: mom,
    eps,
    dataMonth: fundamentals ? fundamentals.dataMonth || '' : '',
    orderVisibility: yoy != null && yoy > 0 ? '營收呈年增，需求面相對穩健' : '營收年增轉弱，留意拉貨動能',
    capacityUtilization: 'N/A', // 產能利用率非公開逐檔資料，誠實標示
    moatScarcity: '依官方月營收趨勢評估，非主觀臆測',
    industryTrend: trend,
    growthScore
  };
}

// =============================================================
// 預設選股策略（價值/股息類使用真實 PE/PB/殖利率；動能類使用真實多日指標）
// 多日欄位（changePct5 等）由 App 以 computeIndicators 注入 stock.Indicators
// =============================================================
const ind = (stock) => stock.Indicators || {};

export const PRESET_STRATEGIES = {
  highYield: {
    id: 'highYield',
    name: '高股息存股族',
    desc: '追求穩定現金流，高殖利率且估值合理',
    icon: 'Coins',
    criteriaDesc: '殖利率 ≥ 5% | 股價淨值比 ≤ 1.5 | 本益比 ≤ 15',
    filter: (stock) => {
      const y = parseFloat(stock.DividendYield) || 0;
      const pb = stock.PBratio ? parseFloat(stock.PBratio) : null;
      const pe = stock.PEratio ? parseFloat(stock.PEratio) : null;
      return y >= 5 && (pb === null || pb <= 1.5) && (pe === null || (pe > 0 && pe <= 15));
    }
  },
  value: {
    id: 'value',
    name: '價值投資便宜股',
    desc: '尋找被市場低估的明珠，低 PE 與 PB 且具基本配息',
    icon: 'TrendingDown',
    criteriaDesc: '本益比 ≤ 12 | 股價淨值比 ≤ 1.0 | 殖利率 ≥ 3%',
    filter: (stock) => {
      const pe = stock.PEratio ? parseFloat(stock.PEratio) : null;
      const pb = stock.PBratio ? parseFloat(stock.PBratio) : null;
      const y = parseFloat(stock.DividendYield) || 0;
      return pe !== null && pe > 0 && pe <= 12 && pb !== null && pb > 0 && pb <= 1 && y >= 3;
    }
  },
  momentum: {
    id: 'momentum',
    name: '強勢動能飆股',
    desc: '近一週走強、站上均線且爆量的多頭標的（需真實歷史）',
    icon: 'Flame',
    criteriaDesc: '近5日漲幅 ≥ 5% | 站上 MA20 | 量比 ≥ 1.5',
    filter: (stock) => {
      const i = ind(stock);
      if (i.changePct5 == null || i.ma20 == null || i.volRatio == null) return false;
      return i.changePct5 >= 5 && i.close > i.ma20 && i.volRatio >= 1.5;
    }
  },
  breakout: {
    id: 'breakout',
    name: '突破創高股',
    desc: '逼近或突破 20 日新高，且站穩均線之上（需真實歷史）',
    icon: 'TrendingUp',
    criteriaDesc: '距20日高 ≤ 1.5% | 站上 MA20 | 量比 ≥ 1.2',
    filter: (stock) => {
      const i = ind(stock);
      if (i.distFromHigh20 == null || i.ma20 == null || i.volRatio == null) return false;
      return i.distFromHigh20 >= -1.5 && i.close > i.ma20 && i.volRatio >= 1.2;
    }
  },
  blueChip: {
    id: 'blueChip',
    name: '穩健龍頭績優股',
    desc: '市場權值股，基本面扎實，高成交值與知名度',
    icon: 'ShieldCheck',
    criteriaDesc: '指標性權值龍頭股',
    filter: (stock) => {
      const keyCodes = ['2330', '2317', '2454', '2308', '2881', '2882', '1216', '2603', '2002', '2912', '2303', '3711'];
      return keyCodes.includes(stock.Code);
    }
  },
  cheapGrowth: {
    id: 'cheapGrowth',
    name: '小資低價成長股',
    desc: '單價低於 50 元、本益比合理且近期走勢轉強',
    icon: 'Rocket',
    criteriaDesc: '股價 ≤ 50 元 | 本益比 ≤ 15 | 近5日上漲',
    filter: (stock) => {
      const price = parseFloat(stock.ClosingPrice) || 0;
      const pe = stock.PEratio ? parseFloat(stock.PEratio) : null;
      const i = ind(stock);
      const recentUp = i.changePct5 != null ? i.changePct5 > 0 : (parseFloat(stock.Change) || 0) > 0;
      return price <= 50 && pe !== null && pe > 0 && pe <= 15 && recentUp;
    }
  }
};
