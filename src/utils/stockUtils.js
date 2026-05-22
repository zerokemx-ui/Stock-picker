/**
 * 台灣股市選股神器 - 輔助工具與策略定義
 */

// 1. 預設選股策略條件定義
export const PRESET_STRATEGIES = {
  highYield: {
    id: "highYield",
    name: "高股息存股族",
    desc: "追求穩定現金流，高殖利率且估值合理",
    icon: "Coins",
    criteriaDesc: "殖利率 ≥ 5% | 股價淨值比 ≤ 1.5 | 本益比 ≤ 15",
    filter: (stock) => {
      const yieldPct = parseFloat(stock.DividendYield) || 0;
      const pb = stock.PBratio ? parseFloat(stock.PBratio) : null;
      const pe = stock.PEratio ? parseFloat(stock.PEratio) : null;
      
      return (
        yieldPct >= 5.0 &&
        (pb === null || pb <= 1.5) &&
        (pe === null || (pe > 0 && pe <= 15.0))
      );
    }
  },
  value: {
    id: "value",
    name: "價值投資便宜股",
    desc: "尋找被市場低估的明珠，低 PE 與 PB 且具基本配息",
    icon: "TrendingDown",
    criteriaDesc: "本益比 ≤ 12 | 股價淨值比 ≤ 1.0 | 殖利率 ≥ 3%",
    filter: (stock) => {
      const pe = stock.PEratio ? parseFloat(stock.PEratio) : null;
      const pb = stock.PBratio ? parseFloat(stock.PBratio) : null;
      const yieldPct = parseFloat(stock.DividendYield) || 0;
      
      return (
        pe !== null && pe > 0 && pe <= 12.0 &&
        pb !== null && pb > 0 && pb <= 1.0 &&
        yieldPct >= 3.0
      );
    }
  },
  momentum: {
    id: "momentum",
    name: "強勢動能飆股",
    desc: "追逐今日強勢上漲且交易量大的熱門標的",
    icon: "Flame",
    criteriaDesc: "今日漲幅 ≥ 3% | 成交量 ≥ 3,000 張",
    filter: (stock) => {
      const changePct = parseFloat(stock.Change) || 0;
      const price = parseFloat(stock.ClosingPrice) || 0;
      const changeRate = price > 0 ? (changePct / (price - changePct)) * 100 : 0;
      const volume = parseInt(stock.TradeVolume) || 0;
      
      return changeRate >= 3.0 && volume >= 3000 * 1000; // 3,000張 * 1,000股/張
    }
  },
  blueChip: {
    id: "blueChip",
    name: "穩健龍頭績優股",
    desc: "市場權值股，基本面扎實，高成交值與知名度",
    icon: "ShieldCheck",
    criteriaDesc: "指標性權值龍頭股",
    filter: (stock) => {
      const keyCodes = [
        "2330", "2317", "2454", "2308", "2881", "2882", 
        "1216", "2603", "2002", "2912", "2303", "3711"
      ];
      return keyCodes.includes(stock.Code);
    }
  },
  cheapGrowth: {
    id: "cheapGrowth",
    name: "小資低價成長股",
    desc: "單價低於 50 元、本益比合理且當日收紅的轉機股",
    icon: "Rocket",
    criteriaDesc: "股價 ≤ 50 元 | 本益比 ≤ 15 | 當日漲幅 > 0%",
    filter: (stock) => {
      const price = parseFloat(stock.ClosingPrice) || 0;
      const pe = stock.PEratio ? parseFloat(stock.PEratio) : null;
      const changePct = parseFloat(stock.Change) || 0;
      
      return (
        price <= 50.0 &&
        pe !== null && pe > 0 && pe <= 15.0 &&
        changePct > 0
      );
    }
  }
};

// 2. 格式化成交張數 (台股單位：張 = 1,000股)
export function formatVolumeInChang(sharesStr) {
  const shares = parseInt(sharesStr) || 0;
  const chang = Math.floor(shares / 1000);
  return chang.toLocaleString('zh-TW') + ' 張';
}

// 3. 格式化成交金額 (以「億元」或「萬元」表示)
export function formatValueInYi(valueStr) {
  const val = parseFloat(valueStr) || 0;
  if (val >= 100000000) {
    return (val / 100000000).toFixed(2) + ' 億';
  } else if (val >= 10000) {
    return (val / 10000).toFixed(2) + ' 萬';
  }
  return val.toLocaleString('zh-TW') + ' 元';
}

// 4. 計算並格式化百分比漲跌幅
export function calculateChangeRate(closingPriceStr, changeStr) {
  const price = parseFloat(closingPriceStr) || 0;
  const change = parseFloat(changeStr) || 0;
  if (price === 0) return '0.00%';
  
  const previousPrice = price - change;
  if (previousPrice <= 0) return '0.00%';
  
  const rate = (change / previousPrice) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)}%`;
}

// 5. 判斷數字的漲跌色 Class
export function getChangeColorClass(changeStr) {
  const change = parseFloat(changeStr) || 0;
  if (change > 0) return 'up-text';
  if (change < 0) return 'down-text';
  return 'flat-text';
}

// 6. 輔助解析數值
export function safeFloat(val, fallback = 0) {
  if (val === null || val === undefined || val === '') return fallback;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? fallback : parsed;
}
