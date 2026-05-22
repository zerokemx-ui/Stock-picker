import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Coins, 
  BarChart3, 
  Flame, 
  Award,
  DollarSign,
  Briefcase,
  Trash2,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  formatVolumeInChang, 
  formatValueInYi, 
  calculateChangeRate, 
  getChangeColorClass 
} from '../utils/stockUtils';

export default function Dashboard({ 
  stocks, 
  onSelectStock,
  portfolio = [],
  portfolioLivePrices = {},
  onRemoveFromPortfolio,
  onUpdatePortfolioLots
}) {
  const [isPortfolioCollapsed, setIsPortfolioCollapsed] = useState(false);

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

  // 2. 模擬投資組合統計與明細計算
  const portfolioStats = React.useMemo(() => {
    if (!portfolio || portfolio.length === 0) return null;

    let totalCost = 0;
    let totalValue = 0;
    let totalDividend = 0;

    const items = portfolio.map(item => {
      const liveStock = stocks.find(s => s.Code === item.code);
      const livePriceObj = portfolioLivePrices && portfolioLivePrices[item.code];
      
      const currentPrice = livePriceObj ? livePriceObj.price : (liveStock ? parseFloat(liveStock.ClosingPrice) || 0 : item.buyPrice);
      const changeVal = livePriceObj ? livePriceObj.change : (liveStock ? parseFloat(liveStock.Change) || 0 : 0);
      const dividendYield = liveStock ? parseFloat(liveStock.DividendYield) || 0 : 0;

      const shares = item.buyLots * 1000;
      const cost = item.buyPrice * shares;
      const value = currentPrice * shares;
      const pnl = value - cost;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
      const annualDiv = cost * (dividendYield / 100);

      totalCost += cost;
      totalValue += value;
      totalDividend += annualDiv;

      return {
        ...item,
        currentPrice,
        cost,
        value,
        pnl,
        pnlPct,
        annualDiv,
        changeVal,
        dividendYield
      };
    });

    const totalPnl = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const avgYieldOnCost = totalCost > 0 ? (totalDividend / totalCost) * 100 : 0;

    return {
      items,
      totalCost,
      totalValue,
      totalPnl,
      totalPnlPct,
      totalDividend,
      avgYieldOnCost
    };
  }, [portfolio, stocks, portfolioLivePrices]);

  // 3. 市場多空情緒統計 (今日上漲、下跌、平盤數量)
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

      {/* 💼 模擬投資組合模組 */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-blue)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPortfolioCollapsed ? '0' : '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }} onClick={() => setIsPortfolioCollapsed(!isPortfolioCollapsed)}>
            <div style={{ padding: '0.4rem', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-blue)', borderRadius: '8px' }}>
              <Briefcase size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                💼 我的模擬投資組合 (Virtual Portfolio)
                {portfolio.length > 0 && (
                  <span className="live-badge" style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#22c55e', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, letterSpacing: '0.5px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'live-pulse 1.6s infinite' }}></span>
                    即時更新中 (Live)
                  </span>
                )}
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                即時追蹤您的持股水位、未實現損益與存股被動年領息。
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsPortfolioCollapsed(!isPortfolioCollapsed)} 
            className="btn-icon"
            style={{ padding: '0.4rem', color: 'var(--text-secondary)' }}
          >
            {isPortfolioCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>
        </div>

        {!isPortfolioCollapsed && (
          <>
            {!portfolioStats ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 1.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px dashed var(--border-glass)', textAlign: 'center' }}>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '550px', lineHeight: '1.6' }}>
                  💡 <strong>您目前還沒有任何模擬持股喔！</strong><br />
                  請至「<strong>進階智慧選股</strong>」頁面點選您心儀的股票，開啟個股分析面板，並在最下方的 **「個股損益除權息試算機」** 中輸入張數，點選 **「模擬買入此股」**，即可啟動您的個人投資組合！
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* 投資組合四大數據卡 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  
                  <div className="glass-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem 1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>投資本金</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      $ {Math.round(portfolioStats.totalCost).toLocaleString('zh-TW')} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>元</span>
                    </div>
                  </div>

                  <div className="glass-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem 1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>組合市值</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                      $ {Math.round(portfolioStats.totalValue).toLocaleString('zh-TW')} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>元</span>
                    </div>
                  </div>

                  <div className="glass-card" style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    padding: '1rem 1.25rem',
                    border: portfolioStats.totalPnl >= 0 ? '1px solid rgba(255, 77, 77, 0.15)' : '1px solid rgba(0, 230, 118, 0.15)',
                    boxShadow: portfolioStats.totalPnl >= 0 ? '0 0 15px rgba(255, 77, 77, 0.05)' : '0 0 15px rgba(0, 230, 118, 0.05)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>未實現損益</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'Outfit', marginTop: '0.25rem', display: 'flex', alignItems: 'baseline', gap: '4px' }} className={portfolioStats.totalPnl >= 0 ? 'up-text' : 'down-text'}>
                      {portfolioStats.totalPnl >= 0 ? '+' : ''}{Math.round(portfolioStats.totalPnl).toLocaleString('zh-TW')}
                      <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                        ({portfolioStats.totalPnl >= 0 ? '+' : ''}{portfolioStats.totalPnlPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  <div className="glass-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem 1.25rem', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>預估被動年息收</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--accent-gold)', marginTop: '0.25rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      $ {Math.round(portfolioStats.totalDividend).toLocaleString('zh-TW')}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        (殖利率 {portfolioStats.avgYieldOnCost.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                </div>

                {/* 持股明細表格 */}
                <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <table className="stock-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(14, 19, 38, 0.65)' }}>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>股票代碼/名稱</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>庫存張數</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>買入均價 / 市價</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>持股成本 / 市值</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>未實現損益</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>年估配息 (殖利率)</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '90px' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioStats.items.map(item => {
                        const isUp = item.pnl >= 0;
                        const changeClass = isUp ? 'up-text' : 'down-text';

                        return (
                          <tr key={item.code} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: 'rgba(14, 19, 38, 0.2)' }}>
                            <td 
                              style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                              onClick={() => onSelectStock(item.code)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.85rem', color: 'var(--accent-blue)', background: 'rgba(56,189,248,0.08)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                  {item.code}
                                </span>
                                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{item.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                <button 
                                  onClick={() => onUpdatePortfolioLots(item.code, -1)}
                                  style={{ padding: '0.2rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                  title="減少 1 張"
                                >
                                  <Minus size={11} />
                                </button>
                                <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.9rem', minWidth: '35px', textAlign: 'center' }}>
                                  {item.buyLots} 張
                                </span>
                                <button 
                                  onClick={() => onUpdatePortfolioLots(item.code, 1)}
                                  style={{ padding: '0.2rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                  title="加碼 1 張"
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'Outfit', fontSize: '0.88rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{item.buyPrice.toFixed(2)}</span>
                              <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 6px' }}>/</span>
                              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{item.currentPrice.toFixed(2)}</span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'Outfit', fontSize: '0.88rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>${Math.round(item.cost).toLocaleString()}</span>
                              <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 6px' }}>/</span>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${Math.round(item.value).toLocaleString()}</span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'Outfit', fontSize: '0.88rem' }} className={changeClass}>
                              <span style={{ fontWeight: 700 }}>
                                {isUp ? '+' : ''}{Math.round(item.pnl).toLocaleString()}
                              </span>
                              <div style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                                {isUp ? '+' : ''}{item.pnlPct.toFixed(2)}%
                              </div>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--accent-gold)', fontWeight: 700, fontFamily: 'Outfit' }}>
                                ${Math.round(item.annualDiv).toLocaleString()}
                              </span>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Outfit' }}>
                                ({item.dividendYield.toFixed(2)}%)
                              </div>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                              <button 
                                onClick={() => onRemoveFromPortfolio(item.code)}
                                style={{ padding: '0.35rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#ff4d4d', cursor: 'pointer' }}
                                title="一鍵結清/移出投資組合"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
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
        @keyframes live-pulse {
          0% { transform: scale(0.85); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0.6; }
        }
      `}} />
      
    </div>
  );
}
