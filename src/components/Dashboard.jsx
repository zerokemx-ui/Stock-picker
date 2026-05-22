import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Coins, 
  BarChart3, 
  Flame, 
  Award,
  DollarSign
} from 'lucide-react';
import { 
  formatVolumeInChang, 
  formatValueInYi, 
  calculateChangeRate, 
  getChangeColorClass 
} from '../utils/stockUtils';

export default function Dashboard({ stocks, onSelectStock }) {
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

  // 2. 市場多空情緒統計 (今日上漲、下跌、平盤數量)
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

  // 3. 計算今日排行
  // 今日漲幅前 5 名
  const gainers = [...stocks]
    .map(s => {
      const price = parseFloat(s.ClosingPrice) || 0;
      const chg = parseFloat(s.Change) || 0;
      const prevPrice = price - chg;
      const rate = prevPrice > 0 ? (chg / prevPrice) * 100 : 0;
      return { ...s, changeRate: rate };
    })
    .sort((a, b) => b.changeRate - a.changeRate)
    .slice(0, 5);

  // 今日跌幅前 5 名
  const losers = [...stocks]
    .map(s => {
      const price = parseFloat(s.ClosingPrice) || 0;
      const chg = parseFloat(s.Change) || 0;
      const prevPrice = price - chg;
      const rate = prevPrice > 0 ? (chg / prevPrice) * 100 : 0;
      return { ...s, changeRate: rate };
    })
    .sort((a, b) => a.changeRate - b.changeRate)
    .slice(0, 5);

  // 今日成交值前 5 名 (熱門排行)
  const volumeLeaders = [...stocks]
    .sort((a, b) => parseFloat(b.TradeValue) - parseFloat(a.TradeValue))
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
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
          <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
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
        
        {/* 區塊 1: 今日漲幅前五名 */}
        <div className="glass-card" style={{ padding: '1.5rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
            <TrendingUp className="up-text" size={20} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>今日漲幅領先</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {gainers.map((s, idx) => (
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
          background: rgba(255, 255, 255, 0.05) !important;
        }
      `}} />
      
    </div>
  );
}
