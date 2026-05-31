import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Star, 
  ArrowLeftRight, 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  Calculator, 
  Flame, 
  ShieldCheck, 
  Activity,
  Award,
  AlertCircle
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { 
  formatVolumeInChang, 
  formatValueInYi, 
  calculateChangeRate, 
  getChangeColorClass, 
  safeFloat,
  runDCABacktest,
  generateChipData,
  generateFundamentals
} from '../utils/stockUtils';

// 註冊 Chart.js 核心與折線圖填滿元件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// 輔助函式：建立以股票代碼為基礎的種子隨機產生器，以確保相同股票產生的圖表在重整時是一致的
const createSeededRandom = (seedString) => {
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = seedString.charCodeAt(i) + ((seed << 5) - seed);
  }
  return () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
};

export default function StockDetail({
  stockCode,
  stocks,
  watchlist,
  compareList,
  onAddToPortfolio,
  onToggleWatchlist,
  onToggleCompare,
  onClose,
  activeStrategy
}) {
  // 1. 查找目前選中的股票數據
  const stock = useMemo(() => {
    return stocks.find(s => s.Code === stockCode);
  }, [stocks, stockCode]);

  // 1.2. 實時行情狀態變數
  const [liveStockData, setLiveStockData] = useState(null);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  // 1.3. 實時價格輪詢 useEffect (每 15 秒同步一次)
  useEffect(() => {
    if (!stockCode) return;
    
    // 重設上一檔股票殘留的實時資料
    setLiveStockData(null);
    
    const fetchLivePrice = async () => {
      setIsLiveLoading(true);
      try {
        const response = await fetch(`/api/stocks/realtime?codes=${stockCode}`);
        const resData = await response.json();
        if (resData.success && Array.isArray(resData.data) && resData.data.length > 0) {
          setLiveStockData(resData.data[0]);
        }
      } catch (err) {
        console.error("無法取得該股實時行情，將自動採用延遲/靜態收盤行情:", err);
      } finally {
        setIsLiveLoading(false);
      }
    };

    fetchLivePrice();

    const timer = setInterval(() => {
      fetchLivePrice();
    }, 15000);

    return () => clearInterval(timer);
  }, [stockCode]);

  // 如果找不到股票，則不渲染
  if (!stock) return null;

  // 1.4. 整合實時動態數值與靜態備份
  const closingPrice = liveStockData ? parseFloat(liveStockData.ClosingPrice) : safeFloat(stock.ClosingPrice, 100);
  const changeVal = liveStockData ? parseFloat(liveStockData.Change) : safeFloat(stock.Change, 0);
  const changeClass = liveStockData ? getChangeColorClass(liveStockData.Change) : getChangeColorClass(stock.Change);
  const changePctText = liveStockData 
    ? (parseFloat(liveStockData.ChangePercent) >= 0 ? '+' : '') + parseFloat(liveStockData.ChangePercent).toFixed(2) + '%'
    : calculateChangeRate(stock.ClosingPrice, stock.Change);

  // 2. 損益與配息試算狀態
  const [buyLots, setBuyLots] = useState(1);
  const [targetSellPrice, setTargetSellPrice] = useState(() => {
    // 預設目標賣出價為收盤價上漲 10%
    return (closingPrice * 1.10).toFixed(2);
  });

  // 當選中股票變更時，重設試算狀態
  useEffect(() => {
    setBuyLots(1);
    setTargetSellPrice((closingPrice * 1.10).toFixed(2));
  }, [stockCode, closingPrice]);

  // 2.2. 定期定額回測試算狀態
  const [dcaAmount, setDcaAmount] = useState(10000); // 預設 10,000 元
  const [dcaYears, setDcaYears] = useState(3);       // 預設 3 年

  // 當選中股票變更時，重設定期定額狀態
  useEffect(() => {
    setDcaAmount(10000);
    setDcaYears(3);
  }, [stockCode]);

  const dcaResults = useMemo(() => {
    return runDCABacktest(stock, dcaAmount, dcaYears);
  }, [stock, dcaAmount, dcaYears]);

  const chipData = useMemo(() => {
    return generateChipData(stock);
  }, [stock]);

  const fundamentalsData = useMemo(() => {
    return generateFundamentals(stock);
  }, [stock]);

  const chipDashboard = useMemo(() => {
    if (!chipData) return null;

    const dailyTrades = Array.isArray(chipData.dailyTrades) ? chipData.dailyTrades : [];
    const last3Trades = dailyTrades.slice(-3);
    const net3Days = last3Trades.reduce((sum, day) => sum + (day.netTotal || 0), 0);
    const net5Days = dailyTrades.reduce((sum, day) => sum + (day.netTotal || 0), 0);
    const strongestInflow = dailyTrades.reduce((max, day) => Math.max(max, day.netTotal || 0), 0);
    const strongestOutflow = dailyTrades.reduce((min, day) => Math.min(min, day.netTotal || 0), 0);
    const buyPressure = dailyTrades.reduce((sum, day) => sum + Math.max(day.netTotal || 0, 0), 0);
    const sellPressure = Math.abs(dailyTrades.reduce((sum, day) => sum + Math.min(day.netTotal || 0, 0), 0));
    const pressureTotal = Math.max(buyPressure + sellPressure, 1);
    const buyPressurePercent = Math.round((buyPressure / pressureTotal) * 100);
    const sellPressurePercent = 100 - buyPressurePercent;
    const largeHolderPercent = chipData.cumulativeLargePercent || 0;
    const retailPercent = chipData.retailPercent || 0;
    const isLargeHolderStrong = largeHolderPercent >= 65;
    const isLargeHolderWeak = largeHolderPercent < 45;
    const isNetBuying = net3Days > 2000;
    const isNetSelling = net3Days < -2000;

    let verdict = '籌碼拉鋸';
    let verdictTone = 'var(--accent-blue)';
    let verdictBg = 'rgba(56, 189, 248, 0.08)';
    let verdictCopy = '大戶與法人訊號尚未完全同向，適合搭配量價與基本面等待確認。';

    if (isLargeHolderStrong && isNetBuying) {
      verdict = '籌碼集中加溫';
      verdictTone = 'var(--stock-up)';
      verdictBg = 'rgba(34, 197, 94, 0.1)';
      verdictCopy = '大戶持股比偏高，近 3 日法人仍偏買，籌碼掌握度較佳。';
    } else if (isLargeHolderStrong) {
      verdict = '大戶鎖碼';
      verdictTone = 'var(--accent-purple)';
      verdictBg = 'rgba(168, 85, 247, 0.1)';
      verdictCopy = '大戶持股集中度高，但短線買盤未明顯延續，觀察後續量能是否跟上。';
    } else if (isLargeHolderWeak && isNetSelling) {
      verdict = '籌碼分散降溫';
      verdictTone = 'var(--stock-down)';
      verdictBg = 'rgba(239, 68, 68, 0.1)';
      verdictCopy = '大戶持股比偏低且法人近 3 日偏賣，需留意籌碼鬆動與追價風險。';
    } else if (isNetBuying) {
      verdict = '買盤回補';
      verdictTone = 'var(--stock-up)';
      verdictBg = 'rgba(34, 197, 94, 0.1)';
      verdictCopy = '短線法人轉為偏買，但大戶集中度仍需觀察是否同步提升。';
    } else if (isNetSelling) {
      verdict = '法人調節';
      verdictTone = 'var(--stock-down)';
      verdictBg = 'rgba(239, 68, 68, 0.1)';
      verdictCopy = '近 3 日法人偏賣，短線籌碼轉弱，先確認賣壓是否收斂。';
    }

    const quadrant = isLargeHolderStrong && retailPercent < 25
      ? {
          title: '強集中',
          tone: 'var(--stock-up)',
          copy: '大戶持股占優、散戶比重低，籌碼結構相對乾淨。'
        }
      : isLargeHolderStrong && retailPercent >= 25
        ? {
            title: '大戶強、散戶也追',
            tone: 'var(--accent-gold)',
            copy: '大戶仍有掌握度，但散戶參與提高，追價波動可能放大。'
          }
        : !isLargeHolderStrong && retailPercent >= 35
          ? {
              title: '分散偏高',
              tone: 'var(--stock-down)',
              copy: '散戶持股比偏高，若價格轉弱容易形成籌碼壓力。'
            }
          : {
              title: '中性換手',
              tone: 'var(--accent-blue)',
              copy: '股權結構未明顯偏向集中或分散，等待法人方向確認。'
            };

    return {
      verdict,
      verdictTone,
      verdictBg,
      verdictCopy,
      quadrant,
      net3Days,
      net5Days,
      strongestInflow,
      strongestOutflow,
      buyPressure,
      sellPressure,
      buyPressurePercent,
      sellPressurePercent,
      largeHolderPercent,
      retailPercent,
      structureRows: [
        { label: '千張以上大戶', value: chipData.superLargePercent, color: '#ec4899' },
        { label: '400-1000 張', value: chipData.largePercent, color: '#a855f7' },
        { label: '10-400 張', value: chipData.mediumPercent, color: '#38bdf8' },
        { label: '10 張以下散戶', value: chipData.retailPercent, color: '#10b981' }
      ],
      signalRows: [
        { label: '近 3 日法人', value: net3Days, unit: '張', tone: net3Days >= 0 ? 'up-text' : 'down-text' },
        { label: '近 5 日法人', value: net5Days, unit: '張', tone: net5Days >= 0 ? 'up-text' : 'down-text' },
        { label: '最大單日買超', value: strongestInflow, unit: '張', tone: 'up-text' },
        { label: '最大單日賣超', value: strongestOutflow, unit: '張', tone: strongestOutflow < 0 ? 'down-text' : '' }
      ]
    };
  }, [chipData]);

  const dcaChartData = useMemo(() => {
    if (!dcaResults || !dcaResults.history) return { labels: [], datasets: [] };

    return {
      labels: dcaResults.history.map(h => h.label),
      datasets: [
        {
          label: '投資總成本',
          data: dcaResults.history.map(h => h.cost),
          borderColor: '#64748b',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.1
        },
        {
          label: '複利期末市值',
          data: dcaResults.history.map(h => h.value),
          borderColor: 'var(--accent-purple)',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: 'var(--accent-purple)',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          fill: true,
          tension: 0.3,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(168, 85, 247, 0.2)');
            gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
            return gradient;
          }
        }
      ]
    };
  }, [dcaResults]);

  const dcaChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { size: 10, weight: 'bold' },
          boxWidth: 12,
          padding: 6
        }
      },
      tooltip: {
        backgroundColor: 'rgba(14, 19, 38, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context) => {
            const val = context.raw;
            return ` ${context.dataset.label}: NT$ ${Math.round(val).toLocaleString()} 元`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { 
          color: '#64748b', 
          font: { 
            size: 9,
            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          } 
        }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { 
          color: '#cbd5e1', 
          font: { 
            size: 9,
            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          },
          callback: (value) => {
            if (value >= 10000) return (value / 10000).toFixed(0) + '萬';
            return value;
          }
        }
      }
    }
  };

  // 3. 計算同行業平均指標 (PE, PB, 殖利率)
  const peerComparison = useMemo(() => {
    const categoryStocks = stocks.filter(s => s.Category === stock.Category);
    
    // 平均本益比
    const peStocks = categoryStocks.filter(s => s.PEratio !== '' && parseFloat(s.PEratio) > 0);
    const avgPE = peStocks.length > 0
      ? peStocks.reduce((sum, s) => sum + parseFloat(s.PEratio), 0) / peStocks.length
      : 0;
      
    // 平均股價淨值比
    const pbStocks = categoryStocks.filter(s => s.PBratio !== '' && parseFloat(s.PBratio) > 0);
    const avgPB = pbStocks.length > 0
      ? pbStocks.reduce((sum, s) => sum + parseFloat(s.PBratio), 0) / pbStocks.length
      : 0;

    // 平均殖利率
    const avgYield = categoryStocks.length > 0
      ? categoryStocks.reduce((sum, s) => sum + parseFloat(s.DividendYield), 0) / categoryStocks.length
      : 0;

    return {
      count: categoryStocks.length,
      avgPE: avgPE,
      avgPB: avgPB,
      avgYield: avgYield
    };
  }, [stocks, stock]);

  // 4. 計算個股健康度與評鑑分數 (六大維度加權評分：接單25%, 技術20%, 籌碼20%, 產業15%, 估值10%, 流通10%)
  const valuationRating = useMemo(() => {
    const code = stock.Code || '2330';
    const pe = stock.PEratio !== '' ? parseFloat(stock.PEratio) : null;
    const pb = stock.PBratio !== '' ? parseFloat(stock.PBratio) : null;
    const yieldPct = parseFloat(stock.DividendYield) || 0;
    
    // 1. 判定個股產業類型與體量
    const isLargeCap = ['2330', '2454', '2317', '2303', '2308', '2881', '2882'].includes(code);
    const isTech = ['半導體', '電腦週邊', '電子零組件', '光電業', '通信網路'].includes(stock.Category || '其他');
    const isValueStock = yieldPct >= 4.0 || ['金融保險', '塑膠工業', '水泥工業', '鋼鐵工業'].includes(stock.Category || '其他');
    
    // 2. 資金流通性安全維度 (Liquidity - 10%) - 優先採用實時成交量
    const volShares = liveStockData ? parseFloat(liveStockData.TradeVolume) * 1000 : (parseInt(stock.TradeVolume) || 0);
    const volChang = Math.floor(volShares / 1000); // 轉換為「張」
    
    let liqScore = 75;
    let liquidityLevel = 'decent';
    if (volChang < 100) {
      liqScore = 20; // 殭屍股
      liquidityLevel = 'extremely_low';
    } else if (volChang < 500) {
      liqScore = 50; // 冷門股
      liquidityLevel = 'low';
    } else if (volChang >= 3000) {
      liqScore = 98; // 熱門股
      liquidityLevel = 'high';
    } else if (volChang >= 1500) {
      liqScore = 88; // 充足流動性
      liquidityLevel = 'high';
    } else {
      liqScore = 75;
      liquidityLevel = 'decent';
    }
    
    let liqLevelText = '正常';
    if (liquidityLevel === 'extremely_low') liqLevelText = '殭屍股';
    else if (liquidityLevel === 'low') liqLevelText = '冷門';
    else if (liquidityLevel === 'high') liqLevelText = '充沛';

    // 3. 在手訂單與接單能力評估 (Orders & Bookings - 25%)
    let orderScore = fundamentalsData ? fundamentalsData.growthScore : 60;
    let orderLevel = '一般';
    if (fundamentalsData) {
      if (fundamentalsData.orderVisibility.includes('2 ~ 3 季')) {
        orderScore = Math.max(90, orderScore);
        orderLevel = '暢旺';
      } else if (fundamentalsData.orderVisibility.includes('1 ~ 2 季') || fundamentalsData.orderVisibility.includes('產銷穩定')) {
        orderScore = Math.max(78, orderScore);
        orderLevel = '穩健';
      } else {
        orderScore = Math.min(58, orderScore);
        orderLevel = '偏弱';
      }
    }
    if (pe === null || pe <= 0) {
      orderScore = Math.max(20, orderScore - 20); // 實質虧損下，接單與獲利能力大打折扣
    }

    // 4. 技術面趨勢動能評估 (Technical - 20%)
    let techScore = 70;
    let techLevel = '整理';
    if (changeVal > 0) {
      techScore = isLargeCap ? 92 : 88;
      techLevel = '強勢';
    } else if (changeVal < 0) {
      techScore = 52;
      techLevel = '疲軟';
    } else {
      techScore = 70;
      techLevel = '整理';
    }

    // 5. 籌碼大戶集中度評估 (Chip - 20%)
    let chipScore = 75;
    let chipLevel = '拉鋸';
    if (chipData) {
      const largeHolders = chipData.cumulativeLargePercent;
      chipScore = largeHolders; // 大戶持股佔比作為底分
      
      const dailyTrades = chipData.dailyTrades;
      const last3DaysNet = dailyTrades.slice(2).reduce((sum, d) => sum + d.netTotal, 0);
      if (last3DaysNet > 10000) chipScore = Math.min(98, chipScore + 12);
      else if (last3DaysNet > 2000) chipScore = Math.min(98, chipScore + 6);
      else if (last3DaysNet < -10000) chipScore = Math.max(10, chipScore - 15);
      else if (last3DaysNet < -2000) chipScore = Math.max(10, chipScore - 8);

      if (chipScore >= 80) chipLevel = '集中';
      else if (chipScore >= 60) chipLevel = '鎖定';
      else if (chipScore < 45) chipLevel = '渙散';
      else chipLevel = '拉鋸';
    }

    // 6. 產業趨勢與稀缺性評估 (Trend & Scarcity - 15%)
    let trendScore = 60;
    let trendLevel = '平穩';
    if (isLargeCap) {
      trendScore = 96;
      trendLevel = '極高';
    } else if (isTech) {
      if (fundamentalsData && fundamentalsData.moatScarcity.includes('中高等護城河')) {
        trendScore = 85;
        trendLevel = '高';
      } else {
        trendScore = 55;
        trendLevel = '成熟';
      }
    } else {
      if (fundamentalsData && fundamentalsData.moatScarcity.includes('剛性需求')) {
        trendScore = 75;
        trendLevel = '穩健';
      } else {
        trendScore = 50;
        trendLevel = '平淡';
      }
    }

    // 7. 合理估值與股利收益評估 (Valuation & Dividends - 10%) - 雙模切換
    let valScore = 75;
    let valLevel = '合理';
    
    const isHighDivFocus = activeStrategy === 'highYield' || activeStrategy === 'value' || yieldPct >= 4.0;
    
    if (isHighDivFocus) {
      // 價值與高股息導向：殖利率高、P/E P/B 低則分數極高
      let vTemp = 50;
      if (yieldPct >= 5.0) vTemp += 25;
      else if (yieldPct >= 3.0) vTemp += 12;
      else if (yieldPct === 0.0) vTemp -= 20;

      if (pe !== null && pe > 0) {
        if (pe <= 12) vTemp += 20;
        else if (pe <= 18) vTemp += 10;
        else if (pe > 25) vTemp -= 15;
      } else {
        vTemp -= 25; // 虧損
      }

      if (pb !== null && pb > 0) {
        if (pb <= 1.2) vTemp += 10;
        else if (pb > 2.5) vTemp -= 15;
      }
      valScore = Math.max(15, Math.min(98, vTemp));
      
      if (valScore >= 85) valLevel = '超值';
      else if (valScore >= 70) valLevel = '便宜';
      else if (valScore < 45) valLevel = '偏高';
      else valLevel = '合理';
    } else {
      // 成長股與科技股導向：不因為高溢價或低股利被嚴扣！溢價反映高成長認同
      if (pe === null || pe <= 0) {
        valScore = 35; // 實質營運虧損依然扣分
        valLevel = '虧損';
      } else if (pe > 35) {
        valScore = 80; // 高溢價代表市場對其接單與成長潛力的強烈認同，給予溢價合理認同分
        valLevel = '合理溢價';
      } else if (pe <= 15) {
        valScore = 95; // 便宜的科技股極具吸引力
        valLevel = '低估便宜';
      } else {
        valScore = 86;
        valLevel = '合理認同';
      }
    }

    // 8. 計算加權綜合得分
    let score = Math.round(
      0.25 * orderScore + 
      0.20 * techScore + 
      0.20 * chipScore + 
      0.15 * trendScore + 
      0.10 * valScore + 
      0.10 * liqScore
    );
    score = Math.max(10, Math.min(98, score));

    // 9. 判定評級與動態評語 (消除自相矛盾，分離流動性)
    let grade = 'B';
    let gradeColor = 'var(--text-secondary)';
    let gradeDesc = '個股各項指標平穩，適合區間整理操作';

    if (score >= 85) {
      grade = 'S';
      gradeColor = 'var(--accent-gold)';
      gradeDesc = isTech 
        ? '👑 科技領袖，在手訂單暢旺且具技術稀缺性，大戶籌碼鎖定，極具波段爆發力！' 
        : '👑 頂級高息價值股，防守能力一流且估值極便宜，長線存股安全首選！';
    } else if (score >= 70) {
      grade = 'A';
      gradeColor = 'var(--accent-blue)';
      gradeDesc = '✨ 營運表現優良，技術與籌碼結構穩健，屬多頭波段操作優質標的';
    } else if (score < 50) {
      grade = 'C';
      gradeColor = '#ff4d4d'; // 亮紅色警示
      
      // 動態分析最嚴重的短板 (財務、接單與籌碼痛點，排除流動性)
      if (pe === null || pe <= 0) {
        gradeDesc = '🚨 警示：企業營運呈現虧損狀態，基本面承壓，宜防禦性保守看待！';
      } else if (chipScore < 50) {
        gradeDesc = '⚠️ 警示：主力與大戶籌碼持續渙散，法人出貨套現，籌碼高度渙散！';
      } else if (orderScore < 55) {
        gradeDesc = '⚠️ 警示：在手訂單能見度低，產能利用率欠佳，基本面成長性受限！';
      } else {
        gradeDesc = '⚠️ 警示：個股估值溢價過高且技術面疲軟，短線面臨拉回修正風險！';
      }
    } else {
      // B 級
      if (pe > 28) {
        gradeDesc = '⚖️ 近期估值溢價稍大，雖然在手訂單無虞，仍需嚴防高檔震盪拉回風險';
      } else {
        gradeDesc = '⚖️ 基本面與技術指標表現中性，產業與股性平穩，建議區間分批佈局';
      }
    }

    return { 
      score, 
      grade, 
      gradeColor, 
      gradeDesc, 
      liquidityLevel, 
      volChang,
      fundScore: orderScore,
      techScore,
      chipScore,
      trendScore,
      valScore,
      liqScore,
      orderLevel,
      techLevel,
      chipLevel,
      trendLevel,
      valLevel,
      liqLevelText
    };
  }, [stock, changeVal, liveStockData, fundamentalsData, chipData, activeStrategy]);

  // 5. 動能與優劣勢分析 (Pros & Cons) - 考慮成長/價值分流
  const prosAndCons = useMemo(() => {
    const pros = [];
    const cons = [];
    const pe = stock.PEratio !== '' ? parseFloat(stock.PEratio) : null;
    const pb = stock.PBratio !== '' ? parseFloat(stock.PBratio) : null;
    const yieldPct = parseFloat(stock.DividendYield) || 0;
    const isTech = ['半導體', '電腦週邊', '電子零組件', '光電業', '通信網路'].includes(stock.Category || '其他');
    const isHighDivFocus = activeStrategy === 'highYield' || activeStrategy === 'value' || yieldPct >= 4.0;

    // 優勢分析
    if (yieldPct >= 5.0) {
      pros.push(`💰 股利超豐厚：殖利率高達 ${yieldPct.toFixed(2)}%，遠超銀行定存。`);
    } else if (yieldPct >= 3.5) {
      pros.push(`💸 穩定高配息：具備 ${yieldPct.toFixed(2)}% 的穩健殖利率，防守性佳。`);
    } else if (isTech && !isHighDivFocus) {
      pros.push(`🚀 科技成長定位：低配息率反映公司積極進行資本支出以擴大在手訂單。`);
    }

    if (pe !== null && pe > 0 && pe < 15.0) {
      pros.push(`📉 估值相對便宜：本益比僅 ${pe.toFixed(2)} 倍，投資性價比高。`);
    } else if (pe !== null && pe > 25.0 && isTech && !isHighDivFocus) {
      pros.push(`📈 享有市場合理溢價：高本益比反映強勁的接單能力與高壁壘技術稀缺性。`);
    }

    if (pb !== null && pb > 0 && pb < 1.3) {
      pros.push(`🛡️ 具備安全邊際：股價淨值比僅 ${pb.toFixed(2)}，資產清算價值扎實。`);
    }

    if (fundamentalsData && fundamentalsData.orderVisibility.includes('2 ~ 3 季')) {
      pros.push(`🏢 訂單能見度極佳：在手訂單能見度長達 2~3 季，產能全線滿載。`);
    }

    if (changeVal > 0) {
      const vol = parseInt(stock.TradeVolume) || 0;
      if (vol > 10000 * 1000) {
        pros.push(`🔥 價量齊揚：今日股價強勢收紅，伴隨大交易量湧入，人氣熱絡。`);
      } else {
        pros.push(`📈 多方佔優：今日股價強勢上漲，技術面呈短線多頭姿態。`);
      }
    }

    // 風險/缺點分析
    if (pe === null || pe <= 0) {
      cons.push(`🚨 企業近期虧損：目前暫無本益比（營運呈挑戰狀態），風險較高。`);
    } else if (pe > 25.0 && !isTech) {
      cons.push(`⚠️ 估值溢價偏高：非科技股本益比達 ${pe.toFixed(2)} 倍，防修正拉回。`);
    }

    if (pb !== null && pb > 3.0) {
      cons.push(`⚠️ 高資產溢價：股價淨值比達 ${pb.toFixed(2)} 倍，資產泡沫化程度較高。`);
    }

    if (isHighDivFocus) {
      if (yieldPct < 2.0 && yieldPct > 0) {
        cons.push(`💸 股利收益極低：殖利率僅 ${yieldPct.toFixed(2)}%，不符合高股息配置導向。`);
      } else if (yieldPct === 0) {
        cons.push(`❌ 當前無配息：今年度不配發股利，資金缺乏息收保護。`);
      }
    }

    if (changeVal < 0) {
      cons.push(`📉 短線走勢疲軟：今日股價下跌收綠，上方浮現一定套牢賣壓。`);
    }

    // 確保有預設項目
    if (pros.length === 0) pros.push("⚖️ 指標持平：個股各項財務比率在市場平均區間，表現平穩。");
    if (cons.length === 0) cons.push("⚖️ 波動溫和：目前無明顯的高估值溢價或劇烈下跌風險。");

    return { pros, cons };
  }, [stock, changeVal, fundamentalsData, activeStrategy]);

  // 6. 生成 30 日歷史模擬走勢
  const chartData = useMemo(() => {
    const rand = createSeededRandom(stock.Code);
    const ohlcData = [];
    
    let tempPrice = closingPrice;
    // 基於今日漲跌幅計算波動度
    const volatility = Math.max(0.012, Math.min(0.05, Math.abs(changeVal) / closingPrice || 0.02));
    
    // 生成 30 個交易日的日期
    const today = new Date();
    let businessDaysCount = 0;
    let dayOffset = 0;
    
    const dates = [];
    while (businessDaysCount < 30) {
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - dayOffset);
      const dayOfWeek = pastDate.getDay();
      
      // 排除週末
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const mm = String(pastDate.getMonth() + 1).padStart(2, '0');
        const dd = String(pastDate.getDate()).padStart(2, '0');
        dates.unshift(`${mm}/${dd}`);
        businessDaysCount++;
      }
      dayOffset++;
    }

    // 基於今日即時/靜態成交量取得一個基準日成交量 (以張為單位，維持與當日相同的張數級別)
    const currentVolShares = liveStockData ? parseFloat(liveStockData.TradeVolume) * 1000 : (parseInt(stock.TradeVolume) || 5000000);
    const baseVolume = currentVolShares / 1000; // 每日基準成交張數

    // 反向隨機漫步回推 30 天，然後正向生成 ohlcData 以維持時間順序
    const tempCloses = [];
    let curPrice = tempPrice;
    for (let i = 0; i < 30; i++) {
      tempCloses.unshift(curPrice);
      const factor = (rand() - 0.485) * 2; // -0.97 至 1.03
      const dailyChg = factor * volatility;
      curPrice = curPrice / (1 + dailyChg);
    }

    // 現在正向為每天生成完整的 OHLC 與成交量
    for (let i = 0; i < 30; i++) {
      const close = tempCloses[i];
      const prevClose = i > 0 ? tempCloses[i - 1] : close * 0.98;
      
      // 開盤價在昨日收盤價附近波動
      const open = prevClose * (1 + (rand() - 0.5) * volatility * 0.4);
      
      // 最高、最低價
      const maxOC = Math.max(open, close);
      const minOC = Math.min(open, close);
      const high = maxOC * (1 + rand() * volatility * 0.5);
      const low = minOC * (1 - rand() * volatility * 0.5);
      
      // 成交量：當天漲跌幅度越大，成交量可能越大 (放量)
      const volChangeFactor = 1 + Math.abs(close - open) / (open || 1) * 10;
      const vol = baseVolume * (0.6 + rand() * 0.8) * volChangeFactor;

      ohlcData.push({
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: Math.round(vol),
        isUp: close >= open
      });
    }

    const isPriceUp = closingPrice >= ohlcData[0].close;
    const accentColor = isPriceUp ? 'var(--stock-up)' : 'var(--stock-down)';
    
    return {
      labels: dates,
      ohlc: ohlcData,
      datasets: [
        {
          label: '收盤價',
          data: ohlcData.map(d => d.close),
          borderColor: accentColor,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: accentColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          tension: 0.35,
          fill: true,
          yAxisID: 'yPrice',
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, isPriceUp ? 'rgba(255, 77, 77, 0.2)' : 'rgba(0, 230, 118, 0.2)');
            gradient.addColorStop(1, 'rgba(7, 10, 19, 0)');
            return gradient;
          }
        },
        {
          label: '成交量',
          data: ohlcData.map(d => d.volume),
          type: 'bar',
          yAxisID: 'yVolume',
          backgroundColor: ohlcData.map(d => d.isUp ? 'rgba(255, 77, 77, 0.25)' : 'rgba(0, 230, 118, 0.25)'),
          hoverBackgroundColor: ohlcData.map(d => d.isUp ? 'rgba(255, 77, 77, 0.45)' : 'rgba(0, 230, 118, 0.45)'),
          borderColor: ohlcData.map(d => d.isUp ? 'rgba(255, 77, 77, 0.4)' : 'rgba(0, 230, 118, 0.4)'),
          borderWidth: 1,
          barThickness: 6
        }
      ]
    };
  }, [stock, closingPrice, changeVal, liveStockData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(14, 19, 38, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const index = context.dataIndex;
            const dataPoint = chartData.ohlc[index];
            if (!dataPoint) return '';
            
            // 對於收盤價折線，顯示完整的 OHLC
            if (context.datasetIndex === 0) {
              return [
                ` 收盤價: ${dataPoint.close.toFixed(2)} 元`,
                ` 開盤價: ${dataPoint.open.toFixed(2)} 元`,
                ` 最高價: ${dataPoint.high.toFixed(2)} 元`,
                ` 最低價: ${dataPoint.low.toFixed(2)} 元`
              ];
            } else {
              return ` 成交量: ${dataPoint.volume.toLocaleString()} 張`;
            }
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { 
          color: '#64748b', 
          font: { 
            size: 10,
            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          } 
        }
      },
      yPrice: {
        type: 'linear',
        position: 'left',
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { 
          color: '#cbd5e1', 
          font: { 
            size: 10,
            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          },
          callback: (value) => `${value.toFixed(1)}元`
        }
      },
      yVolume: {
        type: 'linear',
        position: 'right',
        grid: { display: false },
        ticks: { 
          color: '#64748b', 
          font: { 
            size: 9,
            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          },
          callback: (value) => `${Math.round(value)}張`
        },
        max: Math.max(...(chartData.ohlc ? chartData.ohlc.map(d => d.volume) : [1000])) * 3.3
      }
    }
  };

  // 7. 計算當日交易區間進度 (High-Low Bar)
  const dayRangeProgress = useMemo(() => {
    const low = liveStockData ? parseFloat(liveStockData.LowestPrice) : safeFloat(stock.LowestPrice, closingPrice);
    const high = liveStockData ? parseFloat(liveStockData.HighestPrice) : safeFloat(stock.HighestPrice, closingPrice);
    const open = liveStockData ? parseFloat(liveStockData.OpeningPrice) : safeFloat(stock.OpeningPrice, closingPrice);
    
    if (high === low) return { openPct: 50, closePct: 50 };
    
    const openPct = ((open - low) / (high - low)) * 100;
    const closePct = ((closingPrice - low) / (high - low)) * 100;
    
    return { openPct, closePct };
  }, [stock, closingPrice, liveStockData]);

  // 定義開盤、最高、最低、成交量的實時/靜態解析
  const displayLow = liveStockData ? parseFloat(liveStockData.LowestPrice) : parseFloat(stock.LowestPrice || stock.ClosingPrice);
  const displayHigh = liveStockData ? parseFloat(liveStockData.HighestPrice) : parseFloat(stock.HighestPrice || stock.ClosingPrice);
  const displayOpen = liveStockData ? parseFloat(liveStockData.OpeningPrice) : parseFloat(stock.OpeningPrice || stock.ClosingPrice);
  const displayVolume = liveStockData ? parseFloat(liveStockData.TradeVolume) * 1000 : parseFloat(stock.TradeVolume);

  // 8. 損益試算即時結果計算
  const calcResults = useMemo(() => {
    const parsedLots = parseInt(buyLots) || 0;
    const parsedTargetPrice = parseFloat(targetSellPrice) || 0;
    
    const totalShares = parsedLots * 1000;
    const buyValue = closingPrice * totalShares;
    
    // 券商手續費 (買入 0.1425%，台股最低通常為 20 元)
    const buyFee = Math.max(20, Math.floor(buyValue * 0.001425));
    const totalCost = buyValue + buyFee;
    
    // 預估賣出
    const sellValue = parsedTargetPrice * totalShares;
    // 賣出手續費 (0.1425%，最低 20 元)
    const sellFee = Math.max(20, Math.floor(sellValue * 0.001425));
    // 證券交易稅 (台股賣出時收取 0.3%)
    const stockTax = Math.floor(sellValue * 0.003);
    
    const totalFriction = buyFee + sellFee + stockTax;
    const netProfit = sellValue - totalCost - sellFee - stockTax;
    const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
    
    // 預估年領股利
    const divYield = parseFloat(stock.DividendYield) || 0;
    const annualDividend = buyValue * (divYield / 100);

    return {
      buyValue,
      buyFee,
      totalCost,
      sellValue,
      sellFee,
      stockTax,
      totalFriction,
      netProfit,
      roi,
      annualDividend
    };
  }, [stock, buyLots, targetSellPrice, closingPrice]);

  const isWatched = watchlist.includes(stock.Code);
  const isCompared = compareList.includes(stock.Code);

  const limitUpPrice = liveStockData && liveStockData.LimitUp ? parseFloat(liveStockData.LimitUp) : null;
  const limitDownPrice = liveStockData && liveStockData.LimitDown ? parseFloat(liveStockData.LimitDown) : null;

  const isLimitUp = limitUpPrice !== null && closingPrice >= limitUpPrice;
  const isLimitDown = limitDownPrice !== null && closingPrice <= limitDownPrice;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
      
      {/* 半透明背景遮罩 */}
      <div 
        onClick={onClose}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(5, 7, 16, 0.75)', backdropFilter: 'blur(10px)', zIndex: -1 }}
      />
      
      {/* 彈出視窗主體 (極致高質感毛玻璃) */}
      <div className="glass-panel" style={{ width: '100%', maxWidth: '1050px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.6), var(--shadow-neon-blue)', animation: 'slide-up-fade 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        
        {/* Header 列：名稱與狀態 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '1.75rem 2rem', borderBottom: '1px solid var(--border-glass)', gap: '1rem', background: 'rgba(14, 19, 38, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, padding: '0.3rem 0.75rem', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-blue)', borderRadius: '10px', fontFamily: 'Outfit' }}>
              {stock.Code}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900 }}>{stock.Name}</h2>
                <span className="badge badge-category">{stock.Category}</span>
                {liveStockData ? (
                  <span style={{ 
                    fontSize: '0.72rem', 
                    padding: '0.2rem 0.6rem', 
                    background: 'rgba(34, 197, 94, 0.12)', 
                    border: '1px solid rgba(34, 197, 94, 0.25)', 
                    color: '#22c55e', 
                    borderRadius: '6px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '5px', 
                    fontWeight: 700, 
                    letterSpacing: '0.5px' 
                  }}>
                    <span style={{ 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '50%', 
                      background: '#22c55e', 
                      display: 'inline-block', 
                      animation: 'live-pulse 1.6s infinite' 
                    }}></span>
                    即時行情 (Live {liveStockData.Time})
                  </span>
                ) : (
                  <span style={{ 
                    fontSize: '0.72rem', 
                    padding: '0.2rem 0.6rem', 
                    background: 'rgba(245, 158, 11, 0.12)', 
                    border: '1px solid rgba(245, 158, 11, 0.25)', 
                    color: 'var(--accent-gold)', 
                    borderRadius: '6px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '5px', 
                    fontWeight: 700, 
                    letterSpacing: '0.5px' 
                  }}>
                    收盤行情 (TWSE)
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                個股綜合分析診斷與交易策略工具
              </p>
            </div>
          </div>
          
          {/* 操作按鈕群 */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* 加入/移出自選 */}
            <button 
              onClick={() => onToggleWatchlist(stock.Code)} 
              className="btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', borderColor: isWatched ? 'var(--accent-gold)' : 'var(--border-glass)' }}
            >
              <Star size={13} fill={isWatched ? 'var(--accent-gold)' : 'none'} color={isWatched ? 'var(--accent-gold)' : 'currentColor'} />
              {isWatched ? '移出自選' : '加入自選'}
            </button>

            {/* 加入/移出對比 */}
            <button 
              onClick={() => onToggleCompare(stock.Code)} 
              className="btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', borderColor: isCompared ? 'var(--accent-blue)' : 'var(--border-glass)' }}
            >
              <ArrowLeftRight size={13} color={isCompared ? 'var(--accent-blue)' : 'currentColor'} />
              {isCompared ? '移出對比' : '加入對比'}
            </button>

            {/* 關閉按鈕 */}
            <button 
              onClick={onClose} 
              className="btn-icon"
              style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', color: 'var(--text-secondary)' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 內文主要分欄區區塊 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.75rem', padding: '2rem' }}>
          
          {/* 第一層：股價與圖表 2 欄並排 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.75rem' }}>
            
            {/* 左側：當日報價與籌碼面 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="glass-card" style={{ background: 'rgba(14, 19, 38, 0.25)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.25rem 1.5rem' }}>
                
                {/* 股價大型展示 */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                      <span style={{ fontSize: '2.8rem', fontWeight: 900, fontFamily: 'Outfit', letterSpacing: '-0.03em' }}>
                        {closingPrice.toFixed(2)}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.05rem', fontFamily: 'Outfit', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }} className={changeClass}>
                          {changeVal > 0 ? <TrendingUp size={14} style={{ marginRight: '2px' }} /> : changeVal < 0 ? <TrendingDown size={14} style={{ marginRight: '2px' }} /> : null}
                          {changeVal > 0 ? '+' : ''}{changeVal.toFixed(2)}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontFamily: 'Outfit', fontWeight: 600 }} className={changeClass}>
                          {changePctText}
                        </span>
                      </div>
                    </div>

                    {/* 🚨 漲停/跌停 呼吸霓虹看板 */}
                    {isLimitUp && (
                      <div className="limit-up-neon">
                        <Flame size={15} style={{ fill: '#ff4d4d' }} />
                        <span>漲停板 Limit Up</span>
                      </div>
                    )}
                    {isLimitDown && (
                      <div className="limit-down-neon">
                        <Flame size={15} style={{ fill: '#00e676' }} />
                        <span>跌停板 Limit Down</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 當日最高最低走勢滑動定位條 (Yahoo Finance 風格) */}
                <div style={{ margin: '1rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
                    <span>今日最低 {displayLow.toFixed(2)}</span>
                    <span>今日最高 {displayHigh.toFixed(2)}</span>
                  </div>
                  <div style={{ position: 'relative', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', margin: '0.5rem 0' }}>
                    {/* 開高低收區間 */}
                    <div style={{
                      position: 'absolute',
                      left: `${Math.min(dayRangeProgress.openPct, dayRangeProgress.closePct)}%`,
                      width: `${Math.max(1.5, Math.abs(dayRangeProgress.closePct - dayRangeProgress.openPct))}%`,
                      height: '100%',
                      background: changeVal >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                      borderRadius: '3px',
                      opacity: 0.8
                    }} />
                    {/* 收盤價定位標記針 */}
                    <div style={{
                      position: 'absolute',
                      left: `${dayRangeProgress.closePct}%`,
                      transform: 'translateX(-50%)',
                      width: '4px',
                      height: '14px',
                      background: '#fff',
                      top: '-4px',
                      borderRadius: '2px',
                      boxShadow: '0 0 10px #fff'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.2rem' }}>
                    <span>開盤價 {displayOpen.toFixed(2)}</span>
                    <span style={{ color: changeVal >= 0 ? 'var(--stock-up)' : 'var(--stock-down)' }}>
                      {liveStockData ? "即時價格" : "最新收盤"} {closingPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 今日量能與籌碼明細網格 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>今日成交量</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {formatVolumeInChang(displayVolume)}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '4px' }}>({Number(displayVolume).toLocaleString()} 股)</span>
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>今日成交金額</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {formatValueInYi(stock.TradeValue)}
                    </div>
                  </div>

                  <div style={{ marginTop: '0.4rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>今日交易筆數</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '0.15rem', fontFamily: 'Outfit' }}>
                      {Number(stock.Transaction).toLocaleString()} 筆
                    </div>
                  </div>

                  <div style={{ marginTop: '0.4rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>所屬產業板塊</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {stock.Category}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* 右側：30 日發光霓虹走勢圖 */}
            <div className="glass-card" style={{ background: 'rgba(14, 19, 38, 0.25)', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Activity size={15} style={{ color: 'var(--accent-blue)' }} /> 近 30 日走勢趨勢圖 (高仿真技術分析)
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>數據以收盤價推算</span>
              </div>
              <div style={{ flex: 1, minHeight: '200px', position: 'relative' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

          </div>

          {/* 第二層：同業指標對比與評鑑 2 欄 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.75rem' }}>
            
            {/* 左下：同業指標評比 (Peer Comparison) */}
            <div className="glass-card" style={{ background: 'rgba(14, 19, 38, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.6rem' }}>
                <ArrowLeftRight size={16} style={{ color: 'var(--accent-blue)' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>同業平均指標評比 ({stock.Category}板塊)</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {/* 1. 本益比對比 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>本益比 (PE ratio)</span>
                    <span style={{ fontWeight: 700 }}>
                      個股 {stock.PEratio !== '' ? `${parseFloat(stock.PEratio).toFixed(2)}倍` : '虧損中'} vs 同業平均 {peerComparison.avgPE > 0 ? `${peerComparison.avgPE.toFixed(2)}倍` : 'N/A'}
                    </span>
                  </div>
                  {/* 可視化條 */}
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', display: 'flex', overflow: 'hidden' }}>
                    {stock.PEratio !== '' && (
                      <div 
                        style={{ 
                          width: `${Math.min(100, (parseFloat(stock.PEratio) / Math.max(1, parseFloat(stock.PEratio), peerComparison.avgPE)) * 100)}%`, 
                          background: parseFloat(stock.PEratio) > peerComparison.avgPE ? 'var(--stock-up)' : 'var(--stock-down)',
                          height: '100%' 
                        }} 
                      />
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{stock.PEratio !== '' && parseFloat(stock.PEratio) < peerComparison.avgPE ? '✅ 估值低於同業 (便宜)' : stock.PEratio === '' ? '⚠️ 虧損階段，需防範風險' : '⚠️ 估值高於同業平均 (溢價)'}</span>
                    <span>板塊總計 {peerComparison.count} 檔</span>
                  </div>
                </div>

                {/* 2. 股價淨值比對比 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>股價淨值比 (PB ratio)</span>
                    <span style={{ fontWeight: 700 }}>
                      個股 {stock.PBratio !== '' ? `${parseFloat(stock.PBratio).toFixed(2)}倍` : 'N/A'} vs 同業平均 {peerComparison.avgPB.toFixed(2)}倍
                    </span>
                  </div>
                  {/* 可視化條 */}
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', display: 'flex', overflow: 'hidden' }}>
                    {stock.PBratio !== '' && (
                      <div 
                        style={{ 
                          width: `${Math.min(100, (parseFloat(stock.PBratio) / Math.max(1, parseFloat(stock.PBratio), peerComparison.avgPB)) * 100)}%`, 
                          background: parseFloat(stock.PBratio) > peerComparison.avgPB ? 'var(--stock-up)' : 'var(--stock-down)',
                          height: '100%' 
                        }} 
                      />
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {stock.PBratio !== '' && parseFloat(stock.PBratio) < peerComparison.avgPB ? '✅ 資產溢價低於同業，安全邊際厚' : '⚠️ 溢價高於同業平均，溢價較大'}
                  </div>
                </div>

                {/* 3. 殖利率對比 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>股息殖利率 (Dividend Yield)</span>
                    <span style={{ fontWeight: 700 }} className="up-text">
                      個股 {parseFloat(stock.DividendYield).toFixed(2)}% vs 同業平均 {peerComparison.avgYield.toFixed(2)}%
                    </span>
                  </div>
                  {/* 可視化條 */}
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', display: 'flex', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${Math.min(100, (parseFloat(stock.DividendYield) / Math.max(1, parseFloat(stock.DividendYield), peerComparison.avgYield)) * 100)}%`, 
                        background: 'var(--stock-up)', // 股息高是紅色優勢
                        height: '100%' 
                      }} 
                    />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {parseFloat(stock.DividendYield) >= peerComparison.avgYield ? '✅ 殖利率超越產業平均，高股息吸金力強' : '⚠️ 殖利率低於產業平均，配息能力偏弱'}
                  </div>
                </div>

                {/* 💡 核心財務指標解析小學堂 (Financial Metrics Glossary) */}
                <div style={{ 
                  marginTop: '1.25rem',
                  borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                  paddingTop: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-blue)', marginBottom: '0.5rem' }}>
                    <Info size={13} style={{ color: 'var(--accent-blue)' }} />
                    <span>💡 核心財務指標解析小學堂</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>• 本益比 (PE)：</strong>
                      <span>代表「花多少年才能靠盈餘收回本金」。公式為 <code>股價 / EPS</code>。倍數越低代表回本越快、價格越便宜；若公司虧損則顯示為 N/A (無本益比)。</span>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>• 股價淨值比 (PB)：</strong>
                      <span>代表「股價相對於公司帳面淨資產的倍數」。公式為 <code>股價 / 每股淨值</code>。通常以 1.0 倍為基準，低於 1.0 代表股價打折出售，安全邊際極高。</span>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>• 股息殖利率 (Yield)：</strong>
                      <span>代表「每一元股息投入能為您換回多少比例的被動利息」。公式為 <code>現金股利 / 股價</code>。數值越高代表分紅越豐厚，大於 5.0% 屬優質高股息。</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* 右下：AI 智慧選股評鑑與 Pros/Cons */}
            <div className="glass-card" style={{ background: 'rgba(14, 19, 38, 0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.6rem' }}>
                  <Award size={16} style={{ color: 'var(--accent-gold)' }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>智慧選股投資評鑑面板</h3>
                </div>

                {/* 綜合得分與流動性安全徽章 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', background: `rgba(255, 255, 255, 0.03)`, border: `2px solid ${valuationRating.gradeColor}`, boxShadow: `0 0 15px ${valuationRating.gradeColor}40`, color: valuationRating.gradeColor, fontSize: '1.9rem', fontWeight: 900, fontFamily: 'Outfit' }}>
                      {valuationRating.grade}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>綜合評級：{valuationRating.grade} 級</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>(得分 {valuationRating.score}/100)</span>
                      </div>
                      <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.15rem', fontWeight: 600, maxWidth: '280px', lineHeight: '1.3' }}>
                        💬 {valuationRating.gradeDesc}
                      </p>
                    </div>
                  </div>
                  
                  {/* 流通性安全健康徽章 (Liquidity Health Badge) */}
                  <div style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    padding: '0.25rem 0.6rem', 
                    borderRadius: '6px', 
                    fontSize: '0.72rem', 
                    fontWeight: 800,
                    background: valuationRating.liquidityLevel === 'extremely_low'
                      ? 'rgba(239, 68, 68, 0.08)'
                      : valuationRating.liquidityLevel === 'low'
                        ? 'rgba(245, 158, 11, 0.08)'
                        : 'rgba(16, 185, 129, 0.08)',
                    border: valuationRating.liquidityLevel === 'extremely_low' 
                      ? '1px solid rgba(239, 68, 68, 0.3)' 
                      : valuationRating.liquidityLevel === 'low' 
                        ? '1px solid rgba(245, 158, 11, 0.3)' 
                        : '1px solid rgba(16, 185, 129, 0.3)',
                    color: valuationRating.liquidityLevel === 'extremely_low'
                      ? '#f87171'
                      : valuationRating.liquidityLevel === 'low'
                        ? '#fbbf24'
                        : '#34d399',
                  }}>
                    <span>💧 流通安全：{valuationRating.liqLevelText}</span>
                  </div>
                </div>

                {/* 📊 核心六大投資價值維度解析進度網格 (6-Dimension Bar Grid) */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '0.75rem',
                  marginBottom: '1.25rem',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  borderRadius: '10px'
                }}>
                  {/* 維度 1: 接單能力 */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.45rem 0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <ShieldCheck size={10} style={{ color: 'var(--accent-blue)' }} /> 接單量能
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                        {valuationRating.fundScore}分 ({valuationRating.orderLevel})
                      </span>
                    </div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '1.5px', overflow: 'hidden' }}>
                      <div style={{ width: `${valuationRating.fundScore}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #0ea5e9 100%)' }} />
                    </div>
                  </div>

                  {/* 維度 2: 技術動能 */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.45rem 0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <TrendingUp size={10} style={{ color: 'var(--stock-up)' }} /> 技術結構
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--stock-up)' }}>
                        {valuationRating.techScore}分 ({valuationRating.techLevel})
                      </span>
                    </div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '1.5px', overflow: 'hidden' }}>
                      <div style={{ width: `${valuationRating.techScore}%`, height: '100%', background: 'linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)' }} />
                    </div>
                  </div>

                  {/* 維度 3: 籌碼集中 */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.45rem 0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Flame size={10} style={{ color: 'var(--accent-purple)' }} /> 籌碼大戶
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-purple)' }}>
                        {valuationRating.chipScore}分 ({valuationRating.chipLevel})
                      </span>
                    </div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '1.5px', overflow: 'hidden' }}>
                      <div style={{ width: `${valuationRating.chipScore}%`, height: '100%', background: 'linear-gradient(90deg, #c084fc 0%, #a855f7 100%)' }} />
                    </div>
                  </div>

                  {/* 維度 4: 產業稀缺 */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.45rem 0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Star size={10} style={{ color: 'var(--accent-gold)' }} /> 趨勢稀缺
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                        {valuationRating.trendScore}分 ({valuationRating.trendLevel})
                      </span>
                    </div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '1.5px', overflow: 'hidden' }}>
                      <div style={{ width: `${valuationRating.trendScore}%`, height: '100%', background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)' }} />
                    </div>
                  </div>

                  {/* 維度 5: 合理估值 */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.45rem 0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Coins size={10} style={{ color: '#06b6d4' }} /> 估值股利
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#06b6d4' }}>
                        {valuationRating.valScore}分 ({valuationRating.valLevel})
                      </span>
                    </div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '1.5px', overflow: 'hidden' }}>
                      <div style={{ width: `${valuationRating.valScore}%`, height: '100%', background: 'linear-gradient(90deg, #22d3ee 0%, #06b6d4 100%)' }} />
                    </div>
                  </div>

                  {/* 維度 6: 流通安全 */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.45rem 0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Activity size={10} style={{ color: '#10b981' }} /> 流通安全
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981' }}>
                        {valuationRating.liqScore}分 ({valuationRating.liqLevelText})
                      </span>
                    </div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '1.5px', overflow: 'hidden' }}>
                      <div style={{ width: `${valuationRating.liqScore}%`, height: '100%', background: 'linear-gradient(90deg, #34d399 0%, #10b981 100%)' }} />
                    </div>
                  </div>
                </div>

                {/* 💧 資金流通性安全診斷面板 (單獨說明卡片) */}
                <div style={{ 
                  marginBottom: '1.15rem',
                  padding: '0.65rem 0.85rem', 
                  borderRadius: '8px', 
                  border: valuationRating.liquidityLevel === 'extremely_low' 
                    ? '1px solid rgba(239, 68, 68, 0.2)' 
                    : valuationRating.liquidityLevel === 'low' 
                      ? '1px solid rgba(245, 158, 11, 0.2)' 
                      : '1px solid rgba(16, 185, 129, 0.15)',
                  background: valuationRating.liquidityLevel === 'extremely_low'
                    ? 'rgba(239, 68, 68, 0.03)'
                    : valuationRating.liquidityLevel === 'low'
                      ? 'rgba(245, 158, 11, 0.03)'
                      : 'rgba(16, 185, 129, 0.02)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <span>💧 資金流通健康診斷：</span>
                    {valuationRating.liquidityLevel === 'extremely_low' && (
                      <span style={{ color: 'var(--stock-up)', fontWeight: 900 }}>極高風險殭屍股 🚨</span>
                    )}
                    {valuationRating.liquidityLevel === 'low' && (
                      <span style={{ color: 'var(--accent-gold)', fontWeight: 900 }}>中低流動冷門股 ⚠️</span>
                    )}
                    {valuationRating.liquidityLevel === 'decent' && (
                      <span style={{ color: 'var(--accent-blue)', fontWeight: 900 }}>合格流動標的 ✓</span>
                    )}
                    {valuationRating.liquidityLevel === 'high' && (
                      <span style={{ color: '#10b981', fontWeight: 900 }}>資金愛戴熱門股 🔥</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.4', margin: 0 }}>
                    {valuationRating.liquidityLevel === 'extremely_low' && (
                      `日均量 ${valuationRating.volChang} 張。流動性匱乏，大筆交易面臨變現困難與極大折溢價滑點！`
                    )}
                    {valuationRating.liquidityLevel === 'low' && (
                      `日均量 ${valuationRating.volChang} 張。買賣掛單稀疏，法人生意冷清，中大額進出易引發價格劇烈波動。`
                    )}
                    {valuationRating.liquidityLevel === 'decent' && (
                      `日均量 ${valuationRating.volChang} 張。流動性表現一般，完全足夠零售及小額交易者流暢買賣。`
                    )}
                    {valuationRating.liquidityLevel === 'high' && (
                      `日均量高達 ${valuationRating.volChang.toLocaleString()} 張。三大法人與市場大戶積極交投，買賣價差窄，極度流暢。`
                    )}
                  </p>
                </div>

                {/* 優缺點動態文字分析 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {/* 優點 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {prosAndCons.pros.map((pro, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '5px', fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.35' }}>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                        <span>{pro}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* 缺點 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.15rem' }}>
                    {prosAndCons.cons.map((con, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '5px', fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.35' }}>
                        <span style={{ color: 'var(--stock-up)', fontWeight: 'bold' }}>✗</span>
                        <span>{con}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 核心建議 */}
              <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px dashed rgba(56, 189, 248, 0.2)', borderRadius: '8px', padding: '0.75rem 1rem', marginTop: '1.25rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Info size={16} style={{ color: 'var(--accent-blue)', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  <strong>💡 投資決策建議</strong>：
                  {parseFloat(stock.DividendYield) >= 5.0 && (stock.PEratio !== '' && parseFloat(stock.PEratio) <= 15) ? (
                    "該股兼具「低本益比」與「高股息」優勢，屬極佳防守型標的，適合定存存股族採取分批買進並長期持有的策略。"
                  ) : (stock.PEratio !== '' && parseFloat(stock.PEratio) > 25.0) || (stock.PBratio !== '' && parseFloat(stock.PBratio) > 3.0) ? (
                    "該股享有市場高估值溢價（可能由AI或熱門題材帶動），短線動能強但波動劇烈，建議短線操作者順勢分批追蹤，長線存股者宜耐心等候估值拉回。"
                  ) : stock.PEratio === '' ? (
                    "由於公司近期暫無獲利，基本面波動大，偏向轉機性波段題材，不適合作為穩定配息標的，投資時須控管好部位風險。"
                  ) : (
                    "個股目前估值處於合理區間，產業基本面穩健，適合資產配置之投資人，作為中長期持股組合以降低整體投資組合的風險。"
                  )}
                </p>
              </div>

            </div>

          </div>

          {/* 籌碼儀表板：集中度、法人方向與股權分散診斷 */}
          {chipDashboard && (
            <div className="glass-card" style={{ background: 'rgba(56, 189, 248, 0.035)', border: '1px solid rgba(56, 189, 248, 0.16)', marginTop: '0rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.35rem', borderBottom: '1px solid rgba(56, 189, 248, 0.14)', paddingBottom: '0.9rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                    <Activity size={18} style={{ color: 'var(--accent-blue)' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 850, color: 'var(--text-primary)', margin: 0 }}>
                      籌碼儀表板
                    </h3>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      大戶集中度、法人流向與散戶壓力整合判讀
                    </div>
                  </div>
                </div>

                <div style={{ minWidth: '220px', padding: '0.65rem 0.8rem', borderRadius: '8px', background: chipDashboard.verdictBg, border: `1px solid ${chipDashboard.verdictTone}35` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>目前籌碼狀態</span>
                    <strong style={{ color: chipDashboard.verdictTone, fontSize: '0.95rem' }}>{chipDashboard.verdict}</strong>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '0.35rem' }}>
                    {chipDashboard.verdictCopy}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { label: '大戶持股合計', value: `${chipDashboard.largeHolderPercent}%`, icon: ShieldCheck, tone: chipDashboard.largeHolderPercent >= 65 ? 'var(--stock-up)' : 'var(--accent-blue)' },
                    { label: '散戶持股壓力', value: `${chipDashboard.retailPercent}%`, icon: AlertCircle, tone: chipDashboard.retailPercent >= 35 ? 'var(--stock-down)' : 'var(--text-secondary)' },
                    { label: '近 3 日法人', value: `${chipDashboard.net3Days >= 0 ? '+' : ''}${chipDashboard.net3Days.toLocaleString()} 張`, icon: chipDashboard.net3Days >= 0 ? TrendingUp : TrendingDown, tone: chipDashboard.net3Days >= 0 ? 'var(--stock-up)' : 'var(--stock-down)' },
                    { label: '近 5 日法人', value: `${chipDashboard.net5Days >= 0 ? '+' : ''}${chipDashboard.net5Days.toLocaleString()} 張`, icon: chipDashboard.net5Days >= 0 ? TrendingUp : TrendingDown, tone: chipDashboard.net5Days >= 0 ? 'var(--stock-up)' : 'var(--stock-down)' }
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} style={{ background: 'rgba(0, 0, 0, 0.16)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>{item.label}</span>
                          <Icon size={15} style={{ color: item.tone }} />
                        </div>
                        <div style={{ fontFamily: 'Outfit', fontSize: '1.1rem', fontWeight: 850, color: item.tone, lineHeight: 1.1 }}>
                          {item.value}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ background: 'rgba(0, 0, 0, 0.16)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '1rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-secondary)', margin: 0 }}>法人買賣壓力</h4>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>以近 5 日三大法人淨買賣超估算方向</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      買壓 {chipDashboard.buyPressurePercent}% ／ 賣壓 {chipDashboard.sellPressurePercent}%
                    </div>
                  </div>

                  <div style={{ height: '28px', display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ width: `${chipDashboard.sellPressurePercent}%`, minWidth: chipDashboard.sellPressure > 0 ? '10px' : '0', background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.85), rgba(248, 113, 113, 0.65))' }} title={`賣壓 ${chipDashboard.sellPressure.toLocaleString()} 張`} />
                    <div style={{ width: `${chipDashboard.buyPressurePercent}%`, minWidth: chipDashboard.buyPressure > 0 ? '10px' : '0', background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.65), rgba(16, 185, 129, 0.9))' }} title={`買壓 ${chipDashboard.buyPressure.toLocaleString()} 張`} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem', marginTop: '0.85rem' }}>
                    {chipDashboard.signalRows.map((row) => (
                      <div key={row.label} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.55rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{row.label}</div>
                        <div className={row.tone} style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.95rem' }}>
                          {row.value >= 0 ? '+' : ''}{row.value.toLocaleString()} {row.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1rem' }}>
                <div style={{ background: 'rgba(0, 0, 0, 0.16)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-secondary)', margin: 0 }}>股權結構分布</h4>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>總股東人數 {chipData.shareholderBase.toLocaleString()} 人</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>集中度</div>
                      <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: '1.1rem', color: chipDashboard.quadrant.tone }}>{chipDashboard.quadrant.title}</div>
                    </div>
                  </div>

                  <div style={{ height: '30px', display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.28)' }}>
                    {chipDashboard.structureRows.map((row) => (
                      <div key={row.label} style={{ width: `${row.value}%`, background: row.color, minWidth: row.value > 0 ? '8px' : '0' }} title={`${row.label}: ${row.value}%`} />
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem', marginTop: '0.85rem' }}>
                    {chipDashboard.structureRows.map((row) => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.55rem', fontSize: '0.76rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.035)', borderRadius: '6px', padding: '0.45rem 0.55rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontWeight: 700 }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.color, display: 'inline-block' }} />
                          {row.label}
                        </span>
                        <strong style={{ color: 'var(--text-primary)', fontFamily: 'Outfit' }}>{row.value}%</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'rgba(0, 0, 0, 0.16)', border: `1px solid ${chipDashboard.quadrant.tone}28`, borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.85rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.55rem' }}>
                      <ShieldCheck size={16} style={{ color: chipDashboard.quadrant.tone }} />
                      <h4 style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-secondary)', margin: 0 }}>股權分散診斷</h4>
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: chipDashboard.quadrant.tone, marginBottom: '0.45rem' }}>
                      {chipDashboard.quadrant.title}
                    </div>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                      {chipDashboard.quadrant.copy}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.72rem' }}>
                    <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.14)', borderRadius: '6px', padding: '0.55rem' }}>
                      <strong style={{ color: 'var(--stock-up)', display: 'block', marginBottom: '2px' }}>集中條件</strong>
                      大戶高、散戶低
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.14)', borderRadius: '6px', padding: '0.55rem' }}>
                      <strong style={{ color: 'var(--stock-down)', display: 'block', marginBottom: '2px' }}>分散警訊</strong>
                      散戶高、法人賣
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', background: 'rgba(0, 0, 0, 0.2)', border: `1px solid ${chipDashboard.verdictTone}22`, borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Info size={16} style={{ color: chipDashboard.verdictTone, flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
                    判讀依據
                  </strong>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                    {chipData.diagnostic} 目前大戶合計 {chipDashboard.largeHolderPercent}%、散戶 {chipDashboard.retailPercent}%；近 3 日法人淨買賣超 {chipDashboard.net3Days >= 0 ? '+' : ''}{chipDashboard.net3Days.toLocaleString()} 張。
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="glass-card" style={{ background: 'rgba(56, 189, 248, 0.04)', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
            
            {/* 標頭 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(56, 189, 248, 0.15)', paddingBottom: '0.75rem' }}>
              <Calculator size={18} style={{ color: 'var(--accent-blue)' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                個股實戰交易損益 & 存股除權息試算機
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                (依{liveStockData ? '即時價格' : '今日收盤價'} {closingPrice.toFixed(2)} 元為買入基準，手續費 0.1425%、證交稅 0.3%)
              </span>
            </div>

            {/* 輸入控制項區 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              
              {/* 控制項 1: 買入張數 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  預計買入張數 (1張 = 1,000股)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="number" 
                    min="1" 
                    max="1000"
                    value={buyLots}
                    onChange={(e) => setBuyLots(Math.max(1, parseInt(e.target.value) || 0))}
                    className="input-field"
                    style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem', width: '100%', fontFamily: 'Outfit', fontWeight: 700 }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    張 (= { (buyLots * 1000).toLocaleString() } 股)
                  </span>
                </div>
              </div>

              {/* 控制項 2: 預估賣出股價 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    預期賣出股價 (元)
                  </label>
                  {/* 快速百分比按鈕 */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      onClick={() => setTargetSellPrice((closingPrice * 1.05).toFixed(2))}
                      style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      +5%
                    </button>
                    <button 
                      onClick={() => setTargetSellPrice((closingPrice * 1.10).toFixed(2))}
                      style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      +10%
                    </button>
                    <button 
                      onClick={() => setTargetSellPrice((closingPrice * 1.20).toFixed(2))}
                      style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      +20%
                    </button>
                  </div>
                </div>
                <input 
                  type="number" 
                  step="0.05"
                  value={targetSellPrice}
                  onChange={(e) => setTargetSellPrice(e.target.value)}
                  className="input-field"
                  style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem', fontFamily: 'Outfit', fontWeight: 700 }}
                />
              </div>

            </div>

            {/* 試算結果輸出區 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.25rem 1.5rem' }}>
              
              {/* 左邊：短線交易利潤試算 */}
              <div>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  📊 短線價差交易損益評估
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>買入原始成本</span>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 600 }}>NT$ {calcResults.buyValue.toLocaleString()} 元</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>預估券商手續費 (買+賣)</span>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 600 }}>NT$ {(calcResults.buyFee + calcResults.sellFee).toLocaleString()} 元</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>預估政府證券交易稅 (0.3%)</span>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 600 }}>NT$ {calcResults.stockTax.toLocaleString()} 元</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>總計投入總資金</span>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 700 }}>NT$ {calcResults.totalCost.toLocaleString()} 元</span>
                  </div>

                  {/* 核心損益結果 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>預期淨損益</span>
                    <span style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 900 }} className={calcResults.netProfit >= 0 ? 'up-text' : 'down-text'}>
                      NT$ {calcResults.netProfit >= 0 ? '+' : ''}{calcResults.netProfit.toLocaleString()} 元
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>預期報酬率 (ROI)</span>
                    <span style={{ fontSize: '1.05rem', fontFamily: 'Outfit', fontWeight: 800 }} className={calcResults.roi >= 0 ? 'up-text' : 'down-text'}>
                      {calcResults.roi >= 0 ? '+' : ''}{calcResults.roi.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 右邊：長期定存存股利息試算 */}
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '1.5rem' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  💰 長期定存存股利息評估
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', height: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>個股年化股利殖利率</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{parseFloat(stock.DividendYield).toFixed(2)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>您持有的股票總數</span>
                      <span style={{ fontWeight: 700 }}>{buyLots} 張 ({(buyLots * 1000).toLocaleString()} 股)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>估計持有一年總成本</span>
                      <span style={{ fontWeight: 700, fontFamily: 'Outfit' }}>NT$ {calcResults.totalCost.toLocaleString()} 元</span>
                    </div>
                  </div>

                  {/* 核心息收結果 */}
                  <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '8px', padding: '0.75rem 1rem', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-gold)' }}>預估年領股利金額</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>長期存股被動收入</div>
                      </div>
                      <span style={{ fontSize: '1.35rem', fontFamily: 'Outfit', fontWeight: 900, color: 'var(--accent-gold)' }}>
                        NT$ {Math.floor(calcResults.annualDividend).toLocaleString()} 元
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button 
                onClick={() => onAddToPortfolio(stock.Code, closingPrice, buyLots)}
                className="btn-primary"
                style={{ 
                  width: '100%', 
                  padding: '0.85rem 2rem', 
                  fontSize: '1rem', 
                  fontWeight: 800, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.5rem',
                  background: 'linear-gradient(135deg, var(--accent-blue) 0%, #1e40af 100%)',
                  boxShadow: '0 4px 20px rgba(56, 189, 248, 0.3)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Coins size={18} />
                💼 模擬買入此股，加入我的投資組合 (以現價 {closingPrice.toFixed(2)} 元買入 {buyLots} 張)
              </button>
            </div>

          </div>

          {/* 定期定額歷史存股回測與複利試算機 */}
          <div className="glass-card" style={{ background: 'rgba(168, 85, 247, 0.04)', border: '1px solid rgba(168, 85, 247, 0.15)', marginTop: '0rem' }}>
            
            {/* 標頭 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(168, 85, 247, 0.15)', paddingBottom: '0.75rem' }}>
              <Coins size={18} style={{ color: 'var(--accent-purple)' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                💰 定期定額歷史存股回測與複利增長試算機
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                (定期定額複利滾動，假設股利自動再投資，基於該股基本面與產業股性回測)
              </span>
            </div>

            {/* 輸入控制項區 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              
              {/* 控制項 1: 每月扣款金額 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  每月固定投資金額
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <select 
                    value={dcaAmount} 
                    onChange={(e) => setDcaAmount(parseInt(e.target.value))}
                    className="input-field"
                    style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem', width: '100%', cursor: 'pointer', fontWeight: 700 }}
                  >
                    <option value="3000">3,000 元</option>
                    <option value="5000">5,000 元</option>
                    <option value="10000">10,000 元</option>
                    <option value="20000">20,000 元</option>
                    <option value="50000">50,000 元</option>
                  </select>
                </div>
              </div>

              {/* 控制項 2: 投資年限 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  投資扣款年限 (定期定額)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[1, 3, 5, 10].map(yr => (
                    <button
                      key={yr}
                      onClick={() => setDcaYears(yr)}
                      className="btn-secondary"
                      style={{ 
                        flex: 1, 
                        padding: '0.6rem 0rem', 
                        fontSize: '0.85rem', 
                        fontWeight: dcaYears === yr ? 800 : 500,
                        borderColor: dcaYears === yr ? 'var(--accent-purple)' : 'var(--border-glass)',
                        background: dcaYears === yr ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                        color: dcaYears === yr ? 'var(--accent-purple)' : 'var(--text-secondary)',
                      }}
                    >
                      {yr} 年
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* 回測試算核心結果 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.75rem' }}>
              
              {/* 左邊：數字統計數據 */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem', background: 'rgba(0, 0, 0, 0.15)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1.25rem' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>累積投入總本金</span>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      NT$ {dcaResults.principal.toLocaleString()} 元
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>期末資產市值 (含配息再投入)</span>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--text-primary)' }}>
                      NT$ {dcaResults.finalValue.toLocaleString()} 元
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>累積領取現金股利 (估)</span>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 700, color: 'var(--accent-gold)' }}>
                      NT$ {dcaResults.totalDividends.toLocaleString()} 元
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>累積淨回報率 (ROI)</span>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 900 }} className="up-text">
                      +{dcaResults.roi}%
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>預估年化複利報酬率 (CAGR)</span>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 900, color: 'var(--accent-blue)' }}>
                      {dcaResults.cagr}%
                    </span>
                  </div>
                </div>

                <div style={{ background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.1)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  📈 <strong>存股效益分析：</strong> 每月固定投資 {dcaAmount.toLocaleString()} 元，經歷 {dcaYears} 年累積，您的資產淨增值了 <span style={{ color: 'var(--stock-up)', fontWeight: 'bold' }}>NT$ {dcaResults.totalReturn.toLocaleString()} 元</span>，複利效果顯著！
                </div>
              </div>

              {/* 右邊：資產成長折線圖 */}
              <div style={{ minHeight: '230px', position: 'relative' }}>
                <Line data={dcaChartData} options={dcaChartOptions} />
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
