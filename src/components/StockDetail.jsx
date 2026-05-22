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
  safeFloat 
} from '../utils/stockUtils';

// 註冊 Chart.js 核心與折線圖填滿元件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
  onToggleWatchlist,
  onToggleCompare,
  onClose
}) {
  // 1. 查找目前選中的股票數據
  const stock = useMemo(() => {
    return stocks.find(s => s.Code === stockCode);
  }, [stocks, stockCode]);

  // 如果找不到股票，則不渲染
  if (!stock) return null;

  const closingPrice = safeFloat(stock.ClosingPrice, 100);
  const changeVal = safeFloat(stock.Change, 0);
  const changeClass = getChangeColorClass(stock.Change);
  const changePctText = calculateChangeRate(stock.ClosingPrice, stock.Change);

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

  // 4. 計算個股健康度與評鑑分數 (0 - 100)
  const valuationRating = useMemo(() => {
    let score = 50; // 基礎分數
    const pe = stock.PEratio !== '' ? parseFloat(stock.PEratio) : null;
    const pb = stock.PBratio !== '' ? parseFloat(stock.PBratio) : null;
    const yieldPct = parseFloat(stock.DividendYield) || 0;

    // 殖利率權重
    if (yieldPct >= 5.0) score += 15;
    else if (yieldPct >= 3.0) score += 8;
    else if (yieldPct === 0.0) score -= 5;

    // 本益比權重
    if (pe !== null) {
      if (pe > 0 && pe <= 12) score += 15;
      else if (pe > 12 && pe <= 20) score += 8;
      else if (pe > 25) score -= 10;
    } else {
      score -= 8; // 虧損股扣分
    }

    // 股價淨值比權重
    if (pb !== null) {
      if (pb > 0 && pb <= 1.2) score += 15;
      else if (pb > 1.2 && pb <= 2.2) score += 8;
      else if (pb > 3.0) score -= 8;
    }

    // 今日動能權重
    if (changeVal > 0) score += 7;
    else if (changeVal < 0) score -= 5;

    // 限制分數區間在 10 ~ 98
    score = Math.max(10, Math.min(98, score));

    let grade = 'B';
    let gradeColor = 'var(--text-secondary)';
    let gradeDesc = '估值中性，穩健觀望';

    if (score >= 85) {
      grade = 'S';
      gradeColor = 'var(--accent-gold)';
      gradeDesc = '價值低估，高防守型優質股';
    } else if (score >= 70) {
      grade = 'A';
      gradeColor = 'var(--accent-blue)';
      gradeDesc = '體質健全，表現優良';
    } else if (score < 50) {
      grade = 'C';
      gradeColor = 'var(--stock-up)'; // 紅色/橙色警示
      gradeDesc = '溢價偏高或營運虧損，宜謹慎評估';
    }

    return { score, grade, gradeColor, gradeDesc };
  }, [stock, changeVal]);

  // 5. 動能與優劣勢分析 (Pros & Cons)
  const prosAndCons = useMemo(() => {
    const pros = [];
    const cons = [];
    const pe = stock.PEratio !== '' ? parseFloat(stock.PEratio) : null;
    const pb = stock.PBratio !== '' ? parseFloat(stock.PBratio) : null;
    const yieldPct = parseFloat(stock.DividendYield) || 0;

    // 優勢分析
    if (yieldPct >= 5.0) {
      pros.push(`💰 股利超豐厚：殖利率高達 ${yieldPct.toFixed(2)}%，遠超銀行定存。`);
    } else if (yieldPct >= 3.5) {
      pros.push(`💸 穩定高配息：具備 ${yieldPct.toFixed(2)}% 的穩健殖利率，防守性佳。`);
    }

    if (pe !== null && pe > 0 && pe < 15.0) {
      pros.push(`📉 估值相對便宜：本益比僅 ${pe.toFixed(2)} 倍，投資性價比高。`);
    }
    if (pb !== null && pb > 0 && pb < 1.3) {
      pros.push(`🛡️ 具備安全邊際：股價淨值比僅 ${pb.toFixed(2)}，資產清算價值扎實。`);
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
    } else if (pe > 25.0) {
      cons.push(`⚠️ 估值溢價偏高：本益比達 ${pe.toFixed(2)} 倍，遠超歷史均值，有修正風險。`);
    }

    if (pb !== null && pb > 3.0) {
      cons.push(`⚠️ 高資產溢價：股價淨值比達 ${pb.toFixed(2)} 倍，資產泡沫化程度較高。`);
    }

    if (yieldPct < 2.0 && yieldPct > 0) {
      cons.push(`💸 股利收益極低：殖利率僅 ${yieldPct.toFixed(2)}%，不適合尋求現金流的投資人。`);
    } else if (yieldPct === 0) {
      cons.push(`❌ 當前無配息：今年度不配發股利，資金缺乏息收保護。`);
    }

    if (changeVal < 0) {
      cons.push(`📉 短線走勢疲軟：今日股價下跌收綠，上方浮現一定套牢賣壓。`);
    }

    // 確保有預設項目
    if (pros.length === 0) pros.push("⚖️ 指標持平：個股各項財務比率在市場平均區間，表現平穩。");
    if (cons.length === 0) cons.push("⚖️ 波動溫和：目前無明顯的高估值溢價或劇烈下跌風險。");

    return { pros, cons };
  }, [stock, changeVal]);

  // 6. 生成 30 日歷史模擬走勢
  const chartData = useMemo(() => {
    const rand = createSeededRandom(stock.Code);
    const simulatedPrices = [];
    const labels = [];
    
    let tempPrice = closingPrice;
    // 基於今日漲跌幅計算波動度
    const volatility = Math.max(0.012, Math.min(0.06, Math.abs(changeVal) / closingPrice || 0.02));
    
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

    // 反向隨機漫步回推 30 天
    for (let i = 0; i < 30; i++) {
      simulatedPrices.unshift(tempPrice);
      // 生成圍繞當前趨勢的隨機數
      const factor = (rand() - 0.485) * 2; // -0.97 至 1.03
      const dailyChg = factor * volatility;
      tempPrice = tempPrice / (1 + dailyChg);
    }

    const isPriceUp = closingPrice >= simulatedPrices[0];
    const accentColor = isPriceUp ? 'var(--stock-up)' : 'var(--stock-down)';
    
    return {
      labels: dates,
      datasets: [
        {
          label: '收盤價',
          data: simulatedPrices.map(p => parseFloat(p.toFixed(2))),
          borderColor: accentColor,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: accentColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          tension: 0.35,
          fill: true,
          // 金融科技感的霓虹漸層填充效果
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, isPriceUp ? 'rgba(255, 77, 77, 0.25)' : 'rgba(0, 230, 118, 0.25)');
            gradient.addColorStop(1, 'rgba(7, 10, 19, 0)');
            return gradient;
          }
        }
      ]
    };
  }, [stock, closingPrice, changeVal]);

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
        padding: 10,
        callbacks: {
          label: (context) => ` 收盤價: ${context.parsed.y.toFixed(2)} 元`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#64748b', font: { size: 10 } }
      }
    }
  };

  // 7. 計算當日交易區間進度 (High-Low Bar)
  const dayRangeProgress = useMemo(() => {
    const low = safeFloat(stock.LowestPrice, closingPrice);
    const high = safeFloat(stock.HighestPrice, closingPrice);
    const open = safeFloat(stock.OpeningPrice, closingPrice);
    
    if (high === low) return { openPct: 50, closePct: 50 };
    
    const openPct = ((open - low) / (high - low)) * 100;
    const closePct = ((closingPrice - low) / (high - low)) * 100;
    
    return { openPct, closePct };
  }, [stock, closingPrice]);

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900 }}>{stock.Name}</h2>
                <span className="badge badge-category">{stock.Category}</span>
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
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                    <span style={{ fontSize: '2.8rem', fontWeight: 900, fontFamily: 'Outfit', letterSpacing: '-0.03em' }}>
                      {parseFloat(stock.ClosingPrice).toFixed(2)}
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
                </div>

                {/* 當日最高最低走勢滑動定位條 (Yahoo Finance 風格) */}
                <div style={{ margin: '1rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
                    <span>今日最低 {parseFloat(stock.LowestPrice || closingPrice).toFixed(2)}</span>
                    <span>今日最高 {parseFloat(stock.HighestPrice || closingPrice).toFixed(2)}</span>
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
                    <span>開盤價 {parseFloat(stock.OpeningPrice || closingPrice).toFixed(2)}</span>
                    <span style={{ color: changeVal >= 0 ? 'var(--stock-up)' : 'var(--stock-down)' }}>最新收盤 {parseFloat(stock.ClosingPrice).toFixed(2)}</span>
                  </div>
                </div>

                {/* 今日量能與籌碼明細網格 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>今日成交量</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {formatVolumeInChang(stock.TradeVolume)}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '4px' }}>({Number(stock.TradeVolume).toLocaleString()} 股)</span>
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
              </div>
            </div>

            {/* 右下：AI 智慧選股評鑑與 Pros/Cons */}
            <div className="glass-card" style={{ background: 'rgba(14, 19, 38, 0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.6rem' }}>
                  <Award size={16} style={{ color: 'var(--accent-gold)' }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>智慧選股投資評鑑面板</h3>
                </div>

                {/* 綜合得分評等 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '15px', background: `rgba(255, 255, 255, 0.03)`, border: `2px solid ${valuationRating.gradeColor}`, boxShadow: `0 0 15px ${valuationRating.gradeColor}40`, color: valuationRating.gradeColor, fontSize: '2.1rem', fontWeight: 900, fontFamily: 'Outfit' }}>
                    {valuationRating.grade}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>綜合評級：{valuationRating.grade} 級</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>(得分 {valuationRating.score}/100)</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontWeight: 600 }}>
                      💬 {valuationRating.gradeDesc}
                    </p>
                  </div>
                </div>

                {/* 優缺點動態文字分析 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* 優點 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {prosAndCons.pros.map((pro, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        <span style={{ color: 'var(--stock-down)', fontWeight: 'bold' }}>✓</span>
                        <span>{pro}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* 缺點 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                    {prosAndCons.cons.map((con, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
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

          {/* 第三層：個股損益交易 & 存股除權息試算機 (全互動模組) */}
          <div className="glass-card" style={{ background: 'rgba(56, 189, 248, 0.04)', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
            
            {/* 標頭 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(56, 189, 248, 0.15)', paddingBottom: '0.75rem' }}>
              <Calculator size={18} style={{ color: 'var(--accent-blue)' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                個股實戰交易損益 & 存股除權息試算機
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                (依今日收盤價 {parseFloat(stock.ClosingPrice).toFixed(2)} 元為買入基準，手續費 0.1425%、證交稅 0.3%)
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

          </div>

        </div>

      </div>

    </div>
  );
}
