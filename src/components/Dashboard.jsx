import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Coins, 
  BarChart3, 
  Flame, 
  Globe, 
  Lightbulb
} from 'lucide-react';
import { 
  formatValueInYi, 
  calculateChangePercent,
  calculateChangeRate, 
  getChangeColorClass 
} from '../utils/stockUtils';

export default function Dashboard({ 
  stocks, 
  onSelectStock,
  dataStatus = {},
  usIndices: officialUsIndices = []
}) {
  // 1. 計算市場整體基本面統計
  const totalStocks = stocks.length;
  
  // 計算有本益比股票的平均本益比
  const peStocks = stocks.filter(s => s.PEratio !== '' && parseFloat(s.PEratio) > 0);
  const avgPE = peStocks.length > 0 
    ? (peStocks.reduce((sum, s) => sum + parseFloat(s.PEratio), 0) / peStocks.length).toFixed(2)
    : 'N/A';
     
  // 計算平均殖利率
  const avgYield = totalStocks > 0
    ? (stocks.reduce((sum, s) => sum + parseFloat(s.DividendYield), 0) / totalStocks).toFixed(2)
    : '0.00';

  // 2. 市場多空情緒統計 (今日上漲、下跌、平盤數量) - 提前至此以利於連動美股指數
  let riseCount = 0;
  let fallCount = 0;
  let flatCount = 0;
  
  stocks.forEach(s => {
    const chg = parseFloat(s.Change) || 0;
    if (chg > 0) riseCount++;
    else if (chg < 0) fallCount++;
    else flatCount++;
  });
  
  const risePct = totalStocks > 0 ? ((riseCount / totalStocks) * 100).toFixed(1) : 0;
  const fallPct = totalStocks > 0 ? ((fallCount / totalStocks) * 100).toFixed(1) : 0;

  // 計算美股四大指數 (動態與台股情緒連動，提供大盤趨勢指引)
  const isTaiwanMarketStrong = riseCount >= fallCount;
  const usIndices = React.useMemo(() => {
    const baseMultiplier = isTaiwanMarketStrong ? 1 : -1;
    
    return [
      {
        name: '道瓊工業指數',
        enName: 'Dow Jones Industrial',
        symbol: '^DJI',
        value: 39127.14 + (baseMultiplier * 185.30),
        change: baseMultiplier * 185.30,
        changeRate: baseMultiplier * 0.47,
        impact: '代表美國傳統龍頭大型股。當道瓊上漲時，代表全球景氣擴張、防守資金回流，對台股傳統產業（如金融、塑化、鋼鐵）具有穩定牽引效應。'
      },
      {
        name: 'S&P 500 指數',
        enName: 'S&P 500 Index',
        symbol: '^SPX',
        value: 5267.84 + (baseMultiplier * 32.40),
        change: baseMultiplier * 32.40,
        changeRate: baseMultiplier * 0.62,
        impact: '美國前 500 大企業。反映國際大型機構法人的整體多空偏好，與外資在台股的加碼/減碼操作高度正相關，直接決定外資買賣超動向。'
      },
      {
        name: '納斯達克指數',
        enName: 'Nasdaq Composite',
        symbol: '^IXIC',
        value: 16274.94 + (baseMultiplier * 148.60),
        change: baseMultiplier * 148.60,
        changeRate: baseMultiplier * 0.92,
        impact: '美國科技股的大本營。直接反映全球科技產業投機熱度，是台股「電子中小型科技股」（如 IC 設計、光電、通信網路）的超級晴雨表。'
      },
      {
        name: '費城半導體指數',
        enName: 'Philadelphia Semiconductor',
        symbol: '^SOX',
        value: 4892.45 + (baseMultiplier * 92.15),
        change: baseMultiplier * 92.15,
        changeRate: baseMultiplier * 1.92,
        impact: '半導體景氣最關鍵領先指標！台股科技股比重極高，費半強弱直接影響台積電 ADR 的走勢，並於隔日同步引導台股半導體供應鏈狂飆或壓回。'
      }
    ];
  }, [isTaiwanMarketStrong]);
  const displayedUsIndices = Array.isArray(officialUsIndices) ? officialUsIndices : [];

  // 3. 計算今日排行
  const rankedStocks = [...stocks]
    .map(s => {
      const changeRate = calculateChangePercent(s.ClosingPrice, s.Change);
      const tradeValue = parseFloat(s.TradeValue) || 0;
      return { ...s, changeRate, tradeValue };
    });

  const capitalFocus = rankedStocks
    .filter(s => s.changeRate > 0)
    .sort((a, b) => b.tradeValue - a.tradeValue)
    .slice(0, 5);

  // 今日跌幅前 5 名
  const losers = rankedStocks
    .sort((a, b) => a.changeRate - b.changeRate)
    .slice(0, 5);

  // 今日成交值前 5 名 (熱門排行)
  const volumeLeaders = rankedStocks
    .sort((a, b) => b.tradeValue - a.tradeValue)
    .slice(0, 5);

  const limitUpLikeCount = rankedStocks.filter(s => s.changeRate >= 9.5).length;
  const dataSourceText = dataStatus.isFallback
    ? '目前沿用已發布快照，未混用假行情'
    : `資料源：${dataStatus.source === 'twse_mi_index' ? 'TWSE 官方每日收盤行情' : 'TWSE 官方資料'}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      <div className="glass-card" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', border: dataStatus.isFallback ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(56,189,248,0.16)', background: dataStatus.isFallback ? 'rgba(245,158,11,0.055)' : 'rgba(56,189,248,0.045)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <Activity size={16} style={{ color: dataStatus.isFallback ? 'var(--accent-gold)' : 'var(--accent-blue)' }} />
          <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>資料可信度狀態</strong>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
          {dataSourceText} · 交易日 {dataStatus.dataDate || '讀取中'}
        </div>
      </div>

      {/* 🌍 全球美股大盤連動監測 (US Major Indices Tracker) */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-purple)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <div style={{ padding: '0.4rem', background: 'rgba(168, 85, 247, 0.1)', color: 'var(--accent-purple)', borderRadius: '8px' }}>
            <Globe size={20} style={{ filter: 'drop-shadow(0 0 4px var(--accent-purple))' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
              🌍 全球美股大盤連動監測 (US Major Indices Tracker)
            </h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem', margin: 0 }}>
              美國四大股指為全球大盤風向球，其前日走勢與均線表現將強烈引導台股今日開盤及多空趨勢判斷。
            </p>
          </div>
        </div>

        {/* 4大指數卡片 Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {displayedUsIndices.map(idx => {
            const isUp = idx.change >= 0;
            const changeColorClass = isUp ? 'up-text' : 'down-text';
            const changeSign = isUp ? '+' : '';
            const cardBorderColor = isUp ? 'rgba(255, 77, 77, 0.15)' : 'rgba(0, 230, 118, 0.15)';
            const cardShadow = isUp ? '0 4px 15px rgba(255, 77, 77, 0.03)' : '0 4px 15px rgba(0, 230, 118, 0.03)';
            
            return (
              <div 
                key={idx.symbol} 
                className="glass-card" 
                style={{ 
                  background: 'var(--surface-1)', 
                  padding: '1.25rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.85rem',
                  border: `1px solid ${cardBorderColor}`,
                  boxShadow: cardShadow,
                  borderRadius: '12px'
                }}
              >
                {/* 卡片頭部 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {idx.name}
                    </span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Outfit', marginTop: '0.1rem' }}>
                      {idx.enName} · {idx.symbol}
                    </div>
                  </div>
                  <span className={`badge ${isUp ? 'up-text' : 'down-text'}`} style={{ 
                    fontSize: '0.65rem', 
                    padding: '0.15rem 0.4rem', 
                    background: isUp ? 'rgba(255, 77, 77, 0.08)' : 'rgba(0, 230, 118, 0.08)',
                    borderRadius: '4px',
                    fontWeight: 700
                  }}>
                    {isUp ? '多頭連動' : '空頭連動'}
                  </span>
                </div>

                {/* 指數價格 */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--text-primary)' }}>
                    {idx.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'Outfit' }} className={changeColorClass}>
                    {changeSign}{idx.change.toFixed(2)} ({changeSign}{idx.changeRate.toFixed(2)}%)
                  </span>
                </div>

                {/* 台股影響說明 (高對比、質感警示框) */}
                <div style={{ 
                  background: 'var(--surface-1)', 
                  border: '1px solid var(--surface-2)', 
                  borderRadius: '8px', 
                  padding: '0.65rem 0.75rem',
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'flex-start'
                }}>
                  <Lightbulb size={13} style={{ color: 'var(--accent-gold)', flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                    <strong>台股連動效應：</strong>{idx.impact}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 頂部市場數據卡片群 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        
        {/* 卡片 1: 上市總家數 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.8rem', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-blue)', borderRadius: '12px' }}>
            <Activity size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>市場上市總數</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit' }}>{totalStocks} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>檔</span></div>
          </div>
        </div>

        {/* 卡片 2: 市場平均本益比 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.8rem', background: 'rgba(168, 85, 247, 0.1)', color: 'var(--accent-purple)', borderRadius: '12px' }}>
            <BarChart3 size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>市場平均本益比</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit' }}>{avgPE} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>倍</span></div>
          </div>
        </div>

        {/* 卡片 3: 市場平均殖利率 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.8rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-gold)', borderRadius: '12px' }}>
            <Coins size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>市場平均殖利率</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit' }}>{avgYield} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>%</span></div>
          </div>
        </div>

        {/* 卡片 4: 市場情緒指標 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <span>今日多空情緒</span>
            <span style={{ color: 'var(--text-muted)' }}>{riseCount} 漲 / {fallCount} 跌</span>
          </div>
          {/* 進度條 */}
          <div style={{ height: '8px', width: '100%', background: 'var(--surface-3)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${risePct}%`, background: 'var(--stock-up)', height: '100%' }}></div>
            <div style={{ width: `${100 - risePct - fallPct}%`, background: 'var(--stock-flat)', height: '100%' }}></div>
            <div style={{ width: `${fallPct}%`, background: 'var(--stock-down)', height: '100%' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
            <span className="up-text">漲 {risePct}%</span>
            <span className="down-text">跌 {fallPct}%</span>
          </div>
        </div>

      </div>

      {/* 排行榜區塊 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* 區塊 1: 資金焦點 */}
        <div className="glass-card" style={{ padding: '1.5rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp className="up-text" size={20} />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>今日資金焦點</h3>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.18rem' }}>
                  依成交金額排序，排除單純漲停排名的雜訊
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--accent-gold)', fontWeight: 800, padding: '0.18rem 0.45rem', border: '1px solid rgba(245,158,11,0.22)', borderRadius: '6px', background: 'rgba(245,158,11,0.08)', whiteSpace: 'nowrap' }}>
              漲停附近 {limitUpLikeCount} 檔
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {capitalFocus.map((s, idx) => (
              <div 
                key={s.Code} 
                onClick={() => onSelectStock(s.Code)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.4rem 0.5rem', borderRadius: '6px', transition: 'background 0.2s' }}
                className="leader-item-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', width: '18px' }}>{idx + 1}</span>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{s.Name}</div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'Outfit', color: 'var(--text-muted)' }}>{s.Code} · {s.Category}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit' }}>{s.ClosingPrice}</div>
                  <div style={{ fontSize: '0.8rem', fontFamily: 'Outfit' }} className={getChangeColorClass(s.Change)}>
                    {calculateChangeRate(s.ClosingPrice, s.Change)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Outfit', marginTop: '0.1rem' }}>
                    {formatValueInYi(s.TradeValue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 區塊 2: 今日跌幅前五名 */}
        <div className="glass-card" style={{ padding: '1.5rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
            <TrendingDown className="down-text" size={20} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>今日跌幅最深</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {losers.map((s, idx) => (
              <div 
                key={s.Code} 
                onClick={() => onSelectStock(s.Code)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.4rem 0.5rem', borderRadius: '6px', transition: 'background 0.2s' }}
                className="leader-item-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', width: '18px' }}>{idx + 1}</span>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{s.Name}</div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'Outfit', color: 'var(--text-muted)' }}>{s.Code} · {s.Category}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit' }}>{s.ClosingPrice}</div>
                  <div style={{ fontSize: '0.8rem', fontFamily: 'Outfit' }} className={getChangeColorClass(s.Change)}>
                    {calculateChangeRate(s.ClosingPrice, s.Change)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 區塊 3: 今日成交金額排行榜 (最熱門) */}
        <div className="glass-card" style={{ padding: '1.5rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
            <Flame style={{ color: 'var(--accent-gold)' }} size={20} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>今日成交金額排行</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {volumeLeaders.map((s, idx) => (
              <div 
                key={s.Code} 
                onClick={() => onSelectStock(s.Code)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.4rem 0.5rem', borderRadius: '6px', transition: 'background 0.2s' }}
                className="leader-item-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', width: '18px' }}>{idx + 1}</span>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{s.Name}</div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'Outfit', color: 'var(--text-muted)' }}>{s.Code} · {s.Category}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit' }}>{s.ClosingPrice}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {formatValueInYi(s.TradeValue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* CSS 局部微調以改善 hover 排行榜行效果 */}
      <style dangerouslySetInnerHTML={{__html: `
        .leader-item-row:hover {
          background: var(--surface-3) !important;
        }
      `}} />
      
    </div>
  );
}
