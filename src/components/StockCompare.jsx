import React, { useState, useMemo } from 'react';
import { 
  X, 
  ArrowLeftRight, 
  Calculator, 
  HelpCircle, 
  Plus, 
  ArrowUpRight 
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { 
  formatVolumeInChang, 
  formatValueInYi, 
  calculateChangeRate, 
  getChangeColorClass 
} from '../utils/stockUtils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function StockCompare({ 
  stocks, 
  compareList, 
  onRemoveCompare,
  onClearCompare
}) {
  const [calcStockCode, setCalcStockCode] = useState('');
  const [numChang, setNumChang] = useState(1); // 預設 1 張
  const [activeCompareMetric, setActiveCompareMetric] = useState('PE');

  // 計算對比圖表的資料
  const barChartData = useMemo(() => {
    const labels = compareStocks.map(s => `${s.Name} (${s.Code})`);
    let data = [];
    let label = '';
    let color = 'rgba(56, 189, 248, 0.2)';
    let borderColor = 'var(--accent-blue)';
    let hoverColor = 'rgba(56, 189, 248, 0.4)';

    if (activeCompareMetric === 'PE') {
      data = compareStocks.map(s => s.PEratio !== '' ? parseFloat(s.PEratio) : 0);
      label = '本益比 PE (倍)';
      color = 'rgba(56, 189, 248, 0.2)';
      borderColor = 'var(--accent-blue)';
      hoverColor = 'rgba(56, 189, 248, 0.4)';
    } else if (activeCompareMetric === 'PB') {
      data = compareStocks.map(s => s.PBratio !== '' ? parseFloat(s.PBratio) : 0);
      label = '股價淨值比 PB (倍)';
      color = 'rgba(168, 85, 247, 0.2)';
      borderColor = 'var(--accent-purple)';
      hoverColor = 'rgba(168, 85, 247, 0.4)';
    } else if (activeCompareMetric === 'Yield') {
      data = compareStocks.map(s => parseFloat(s.DividendYield) || 0);
      label = '殖利率 Yield (%)';
      color = 'rgba(245, 158, 11, 0.2)';
      borderColor = 'var(--accent-gold)';
      hoverColor = 'rgba(245, 158, 11, 0.4)';
    }

    return {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return color;
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          if (activeCompareMetric === 'PE') {
            gradient.addColorStop(0, 'rgba(56, 189, 248, 0.05)');
            gradient.addColorStop(1, 'rgba(56, 189, 248, 0.65)');
          } else if (activeCompareMetric === 'PB') {
            gradient.addColorStop(0, 'rgba(168, 85, 247, 0.05)');
            gradient.addColorStop(1, 'rgba(168, 85, 247, 0.65)');
          } else if (activeCompareMetric === 'Yield') {
            gradient.addColorStop(0, 'rgba(245, 158, 11, 0.05)');
            gradient.addColorStop(1, 'rgba(245, 158, 11, 0.65)');
          }
          return gradient;
        },
        borderColor: borderColor,
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: hoverColor,
        hoverBorderColor: borderColor,
        hoverBorderWidth: 3,
        barThickness: 32,
      }]
    };
  }, [compareStocks, activeCompareMetric]);

  const barChartOptions = {
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
            const val = context.parsed.y;
            const unit = activeCompareMetric === 'Yield' ? '%' : ' 倍';
            return ` ${context.dataset.label.split(' ')[0]}: ${val.toFixed(2)}${unit}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#cbd5e1', font: { size: 11, weight: 'bold' } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#64748b', font: { size: 10 } }
      }
    }
  };

  // 1. 取得當前對比股票的完整數據
  const compareStocks = stocks.filter(s => compareList.includes(s.Code));

  // 2. 股利計算器邏輯
  const selectedCalcStock = compareStocks.find(s => s.Code === calcStockCode) || compareStocks[0];
  
  // 當對比清單改變時，重設計算器的預設股票
  React.useEffect(() => {
    if (compareStocks.length > 0 && (!calcStockCode || !compareList.includes(calcStockCode))) {
      setCalcStockCode(compareStocks[0].Code);
    }
  }, [compareList, compareStocks, calcStockCode]);

  const calculateResults = () => {
    if (!selectedCalcStock) return null;
    const price = parseFloat(selectedCalcStock.ClosingPrice) || 0;
    const yieldPct = parseFloat(selectedCalcStock.DividendYield) || 0;
    
    // 台股 1 張 = 1000 股
    const sharesCount = numChang * 1000;
    const totalCost = price * sharesCount;
    const estimatedDividend = totalCost * (yieldPct / 100);

    return {
      sharesCount,
      totalCost,
      estimatedDividend
    };
  };

  const results = calculateResults();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 判斷對比清單是否為空 */}
      {compareStocks.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            <ArrowLeftRight size={64} style={{ opacity: 0.3 }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>股票比較清單空空如也</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            在「台股數據庫」表格中點擊 <ArrowLeftRight size={14} style={{ display: 'inline' }} /> 按鈕，即可將心儀的股票加入此清單進行橫向基本面指標對比！
          </p>
        </div>
      ) : (
        <div className="compare-container">
          
          {/* 左側：橫向對比卡片組 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>📊 多維度個股對比 (最多 4 檔)</h3>
              <button onClick={onClearCompare} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                清除全部
              </button>
            </div>
            
            <div className="compare-grid">
              {compareStocks.map(s => {
                const changeVal = parseFloat(s.Change) || 0;
                const changeClass = getChangeColorClass(s.Change);
                const rateText = calculateChangeRate(s.ClosingPrice, s.Change);
                
                // 每張估算股利 (股價 * 1000 * 殖利率%)
                const dividendPerChang = (parseFloat(s.ClosingPrice) * 1000 * (parseFloat(s.DividendYield) / 100)).toFixed(0);

                return (
                  <div key={s.Code} className="compare-card">
                    <button 
                      onClick={() => onRemoveCompare(s.Code)} 
                      className="compare-card-remove"
                      title="移出對比"
                      style={{ background: 'transparent', border: 'none' }}
                    >
                      <X size={18} />
                    </button>
                    
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '0.5rem' }}>
                      {s.Name}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'Outfit', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      {s.Code} · {s.Category}
                    </div>

                    <div className="compare-metric-row">
                      <span className="compare-metric-label">收盤價</span>
                      <span className="compare-metric-value" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {parseFloat(s.ClosingPrice).toFixed(2)} 元
                      </span>
                    </div>

                    <div className="compare-metric-row">
                      <span className="compare-metric-label">今日漲跌</span>
                      <span className={`compare-metric-value ${changeClass}`}>
                        {changeVal > 0 ? '+' : ''}{changeVal.toFixed(2)} ({rateText})
                      </span>
                    </div>

                    <div className="compare-metric-row">
                      <span className="compare-metric-label">本益比 PE</span>
                      <span className="compare-metric-value">
                        {s.PEratio !== '' ? `${parseFloat(s.PEratio).toFixed(2)} 倍` : '-'}
                      </span>
                    </div>

                    <div className="compare-metric-row">
                      <span className="compare-metric-label">股價淨值比 PB</span>
                      <span className="compare-metric-value">
                        {s.PBratio !== '' ? parseFloat(s.PBratio).toFixed(2) : '-'}
                      </span>
                    </div>

                    <div className="compare-metric-row">
                      <span className="compare-metric-label">殖利率 Yield</span>
                      <span className={`compare-metric-value ${parseFloat(s.DividendYield) >= 5 ? 'up-text' : ''}`}>
                        {parseFloat(s.DividendYield).toFixed(2)} %
                      </span>
                    </div>

                    <div className="compare-metric-row" style={{ borderBottom: 'none' }}>
                      <span className="compare-metric-label">每張估計股利</span>
                      <span className="compare-metric-value" style={{ color: 'var(--accent-gold)' }}>
                        ${parseInt(dividendPerChang).toLocaleString('zh-TW')} 元
                      </span>
                    </div>

                  </div>
                );
              })}
              
              {compareStocks.length < 4 && (
                <div 
                  className="compare-card" 
                  style={{ borderStyle: 'dashed', borderColor: 'var(--border-glass)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '260px', opacity: 0.6 }}
                >
                  <Plus size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>還可以加入 {4 - compareStocks.length} 檔股票</span>
                </div>
              )}
            </div>
          </div>

          {/* 右側：股利試算計算機 */}
          <div className="glass-card calculator-panel" style={{ padding: '1.75rem 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
              <Calculator style={{ color: 'var(--accent-gold)' }} size={22} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>💰 存股配息試算計算機</h3>
            </div>

            {selectedCalcStock ? (
              <div>
                
                {/* 選擇計算目標 */}
                <div className="calc-input-group">
                  <label className="filter-label">選擇試算股票</label>
                  <select 
                    value={calcStockCode} 
                    onChange={(e) => setCalcStockCode(e.target.value)}
                    className="input-field"
                    style={{ cursor: 'pointer' }}
                  >
                    {compareStocks.map(s => (
                      <option key={s.Code} value={s.Code}>{s.Code} {s.Name}</option>
                    ))}
                  </select>
                </div>

                {/* 輸入欲購買張數 */}
                <div className="calc-input-group">
                  <label className="filter-label">
                    <span>預計買進張數 (1 張 = 1,000 股)</span>
                    <span style={{ color: 'var(--accent-blue)' }}>{numChang} 張</span>
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="1000"
                    value={numChang}
                    onChange={(e) => setNumChang(Math.max(1, parseInt(e.target.value) || 1))}
                    className="input-field"
                  />
                  {/* 滑動條拉桿 */}
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={numChang}
                    onChange={(e) => setNumChang(parseInt(e.target.value))}
                    style={{ marginTop: '0.5rem', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                  />
                </div>

                {/* 試算結果框 */}
                {results && (
                  <div className="calc-result-box">
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <HelpCircle size={12} /> 基於今日收盤價與殖利率估算
                    </div>
                    
                    <div className="calc-result-row">
                      <span style={{ color: 'var(--text-secondary)' }}>購買總股數:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'Outfit' }}>
                        {results.sharesCount.toLocaleString('zh-TW')} 股
                      </span>
                    </div>

                    <div className="calc-result-row">
                      <span style={{ color: 'var(--text-secondary)' }}>估算投資總成本:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'Outfit' }}>
                        $ {results.totalCost.toLocaleString('zh-TW')} 元
                      </span>
                    </div>

                    <div className="calc-result-row">
                      <span style={{ color: 'var(--text-secondary)' }}>每股配發股利 (估):</span>
                      <span style={{ fontWeight: 600, fontFamily: 'Outfit' }}>
                        $ {(parseFloat(selectedCalcStock.ClosingPrice) * (parseFloat(selectedCalcStock.DividendYield) / 100)).toFixed(2)} 元
                      </span>
                    </div>

                    <div className="calc-result-row calc-result-total">
                      <span>預估年度領取股利:</span>
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        $ {Math.round(results.estimatedDividend).toLocaleString('zh-TW')} 元
                        <ArrowUpRight size={18} style={{ marginLeft: '2px' }} />
                      </span>
                    </div>
                    
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem' }}>
                      ※ 註：此為概估配息，實際配息金額應以該公司股東會決議發放之盈餘分派為準。
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                請先加入股票至左側對比清單以啟動計算機。
              </div>
            )}
          </div>

        </div>
      )}

      {compareStocks.length > 0 && (
        <div className="glass-card" style={{ padding: '1.75rem 2rem', animation: 'slide-up-fade 0.3s ease-out' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeftRight size={18} style={{ color: 'var(--accent-blue)' }} />
              📊 多股基本面指標視覺化對比圖
            </h3>
            
            {/* 指標切換按鈕群 */}
            <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {[
                { id: 'PE', label: '本益比 PE', color: 'var(--accent-blue)' },
                { id: 'PB', label: '股價淨值比 PB', color: 'var(--accent-purple)' },
                { id: 'Yield', label: '殖利率 Yield (%)', color: 'var(--accent-gold)' }
              ].map(metric => (
                <button
                  key={metric.id}
                  onClick={() => setActiveCompareMetric(metric.id)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: activeCompareMetric === metric.id ? 800 : 500,
                    background: activeCompareMetric === metric.id ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    color: activeCompareMetric === metric.id ? metric.color : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: activeCompareMetric === metric.id ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
                  }}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: '300px', position: 'relative' }}>
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>
      )}
      
    </div>
  );
}
