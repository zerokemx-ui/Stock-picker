import React from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Briefcase, 
  Trash2, 
  Plus, 
  Minus,
  Coins,
  DollarSign
} from 'lucide-react';
import { 
  formatVolumeInChang, 
  formatValueInYi, 
  calculateChangeRate, 
  getChangeColorClass 
} from '../utils/stockUtils';

export default function Portfolio({ 
  stocks, 
  onSelectStock,
  portfolio = [],
  portfolioLivePrices = {},
  onRemoveFromPortfolio,
  onUpdatePortfolioLots
}) {
  // 1. 計算模擬投資組合統計與明細
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
        dividendYield,
        Category: liveStock ? liveStock.Category : '其他'
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

  // 1.2. 計算投資組合圓餅圖與長條圖數據
  const categoryAllocation = React.useMemo(() => {
    if (!portfolioStats || !portfolioStats.items) return {};
    const alloc = {};
    portfolioStats.items.forEach(item => {
      const cat = item.Category || '其他';
      alloc[cat] = (alloc[cat] || 0) + item.value;
    });
    return alloc;
  }, [portfolioStats]);

  const doughnutData = React.useMemo(() => {
    return {
      labels: Object.keys(categoryAllocation),
      datasets: [
        {
          data: Object.values(categoryAllocation),
          backgroundColor: [
            'rgba(56, 189, 248, 0.55)',  // Cyan / Accent Blue
            'rgba(168, 85, 247, 0.55)', // Purple
            'rgba(245, 158, 11, 0.55)',  // Gold
            'rgba(34, 197, 94, 0.55)',   // Green
            'rgba(239, 68, 68, 0.55)',   // Red
            'rgba(148, 163, 184, 0.55)'  // Slate
          ],
          borderColor: [
            '#38bdf8',
            '#a855f7',
            '#f59e0b',
            '#22c55e',
            '#ff4d4d',
            '#94a3b8'
          ],
          borderWidth: 1.5
        }
      ]
    };
  }, [categoryAllocation]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#cbd5e1',
          font: { size: 10, weight: 'bold' },
          boxWidth: 12,
          padding: 8
        }
      },
      tooltip: {
        backgroundColor: 'rgba(14, 19, 38, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const val = context.raw;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
            return ` ${context.label}: $${Math.round(val).toLocaleString()} (${pct}%)`;
          }
        }
      }
    }
  };

  const pnlBarData = React.useMemo(() => {
    if (!portfolioStats || !portfolioStats.items) return { labels: [], datasets: [] };
    
    const sortedItems = [...portfolioStats.items].sort((a, b) => b.pnl - a.pnl);

    return {
      labels: sortedItems.map(item => `${item.name} (${item.code})`),
      datasets: [
        {
          label: '未實現損益',
          data: sortedItems.map(item => item.pnl),
          backgroundColor: sortedItems.map(item => item.pnl >= 0 ? 'rgba(255, 77, 77, 0.35)' : 'rgba(0, 230, 118, 0.35)'),
          borderColor: sortedItems.map(item => item.pnl >= 0 ? 'var(--stock-up)' : 'var(--stock-down)'),
          borderWidth: 1.5,
          borderRadius: 4
        }
      ]
    };
  }, [portfolioStats]);

  const pnlBarOptions = {
    indexAxis: 'y',
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
        callbacks: {
          label: (context) => {
            const val = context.raw;
            const sign = val >= 0 ? '+' : '';
            return ` 損益: ${sign}${Math.round(val).toLocaleString()} 元`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: {
          color: '#64748b',
          font: { size: 9 },
          callback: (value) => {
            const absVal = Math.abs(value);
            if (absVal >= 100000000) return (value / 100000000).toFixed(1) + '億';
            if (absVal >= 10000) return (value / 10000).toFixed(0) + '萬';
            return value;
          }
        }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#cbd5e1', font: { size: 9, weight: 'bold' } }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 💼 模擬投資組合模組 */}
      <div className="glass-panel" style={{ padding: '1.75rem', borderLeft: '4px solid var(--accent-blue)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ padding: '0.4rem', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-blue)', borderRadius: '8px' }}>
              <Briefcase size={22} style={{ filter: 'drop-shadow(0 0 5px var(--accent-blue))' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                💼 我的模擬投資組合 (Virtual Portfolio Dashboard)
                {portfolio.length > 0 && (
                  <span className="live-badge" style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#22c55e', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, letterSpacing: '0.5px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'live-pulse 1.6s infinite' }}></span>
                    即時行情同步 (Live)
                  </span>
                )}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                精確分析持股水位、板塊曝險佔比、未實現損益以及存股利息複利增長效應。
              </p>
            </div>
          </div>
        </div>

        {!portfolioStats ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5rem 2rem', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px dashed var(--border-glass)', textAlign: 'center', gap: '1.25rem' }}>
            <div style={{ fontSize: '3rem' }}>💼</div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>您目前還沒有任何模擬持股喔！</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '580px', lineHeight: '1.6', margin: 0 }}>
              請至「<strong>進階智慧選股</strong>」頁面點選您感興趣的個股，展開個股 AI 診斷面板，並在最下方的 **「個股損益除權息試算機」** 中輸入持股價格與買入張數，點選 **「模擬買入此股」**，您的資產配置圓餅圖與損益排行榜就會在這裡即時呈現！
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* 投資組合四大數據卡 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              
              <div className="glass-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.1rem 1.35rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>累計投入本金</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  $ {Math.round(portfolioStats.totalCost).toLocaleString('zh-TW')} <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>元</span>
                </div>
              </div>

              <div className="glass-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.1rem 1.35rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>目前組合市值</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                  $ {Math.round(portfolioStats.totalValue).toLocaleString('zh-TW')} <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>元</span>
                </div>
              </div>

              <div className="glass-card" style={{ 
                background: 'rgba(255,255,255,0.02)', 
                padding: '1.1rem 1.35rem',
                border: portfolioStats.totalPnl >= 0 ? '1px solid rgba(255, 77, 77, 0.15)' : '1px solid rgba(0, 230, 118, 0.15)',
                boxShadow: portfolioStats.totalPnl >= 0 ? '0 0 15px rgba(255, 77, 77, 0.05)' : '0 0 15px rgba(0, 230, 118, 0.05)'
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>未實現盈虧總額</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'Outfit', marginTop: '0.25rem', display: 'flex', alignItems: 'baseline', gap: '4px' }} className={portfolioStats.totalPnl >= 0 ? 'up-text' : 'down-text'}>
                  {portfolioStats.totalPnl >= 0 ? '+' : ''}{Math.round(portfolioStats.totalPnl).toLocaleString('zh-TW')}
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    ({portfolioStats.totalPnl >= 0 ? '+' : ''}{portfolioStats.totalPnlPct.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <div className="glass-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.1rem 1.35rem', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>預估被動年息收</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--accent-gold)', marginTop: '0.25rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  $ {Math.round(portfolioStats.totalDividend).toLocaleString('zh-TW')}
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    (殖利率 {portfolioStats.avgYieldOnCost.toFixed(2)}%)
                  </span>
                </div>
              </div>

            </div>

            {/* 📊 投資組合診斷視覺化圖表 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '0.5rem' }}>
              
              {/* 產業配置佔比圓餅圖 */}
              <div className="glass-card" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={15} style={{ color: 'var(--accent-blue)' }} /> 投資資金板塊配置 (產業比重佔比)
                </h4>
                <div style={{ height: '210px', position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
              </div>

              {/* 個股未實現損益排行榜 */}
              <div className="glass-card" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={15} style={{ color: 'var(--accent-purple)' }} /> 個股損益貢獻排行 (降序排行)
                </h4>
                <div style={{ height: '210px', position: 'relative' }}>
                  <Bar data={pnlBarData} options={pnlBarOptions} />
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
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>買入均價 / 目前市價</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>持股成本 / 持股市值</th>
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
                      <tr key={item.code} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.02)', background: 'rgba(14, 19, 38, 0.2)' }}>
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
                              style={{ padding: '0.2rem', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                              title="減少 1 張"
                            >
                              <Minus size={11} />
                            </button>
                            <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.9rem', minWidth: '35px', textAlign: 'center' }}>
                              {item.buyLots} 張
                            </span>
                            <button 
                              onClick={() => onUpdatePortfolioLots(item.code, 1)}
                              style={{ padding: '0.2rem', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
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
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes live-pulse {
          0% { transform: scale(0.85); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0.6; }
        }
      `}} />
      
    </div>
  );
}
