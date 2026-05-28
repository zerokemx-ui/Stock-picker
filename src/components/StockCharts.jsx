import React, { useRef, useState } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  CategoryScale
} from 'chart.js';
import { Scatter, Bar } from 'react-chartjs-2';

// 註冊 Chart.js 核心元件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const METRIC_CONFIG = {
  PE: {
    id: 'PE',
    label: '本益比 PE (倍)',
    shortLabel: '本益比',
    unit: ' 倍',
    getValue: (s) => s.PEratio !== '' ? parseFloat(s.PEratio) : null,
    filter: (v) => v !== null && v > 0 && v < 80, // 為了可視化清晰，過濾掉極大或負數的本益比
    desc: '本益比 (PE Ratio) - 越低越便宜'
  },
  PB: {
    id: 'PB',
    label: '股價淨值比 PB (倍)',
    shortLabel: '股價淨值比',
    unit: ' 倍',
    getValue: (s) => s.PBratio !== '' ? parseFloat(s.PBratio) : null,
    filter: (v) => v !== null && v > 0 && v < 15,
    desc: '股價淨值比 (PB Ratio) - 越低越具防守性'
  },
  Yield: {
    id: 'Yield',
    label: '殖利率 Yield (%)',
    shortLabel: '殖利率',
    unit: '%',
    getValue: (s) => parseFloat(s.DividendYield) || 0,
    filter: (v) => v !== null && v >= 0,
    desc: '殖利率 (Dividend Yield %) - 越高配息越豐厚'
  },
  Price: {
    id: 'Price',
    label: '收盤價 Price (元)',
    shortLabel: '收盤價',
    unit: ' 元',
    getValue: (s) => parseFloat(s.ClosingPrice) || 0,
    filter: (v) => v > 0,
    desc: '收盤價 (Closing Price) - 股價絕對水位'
  },
  ChangePercent: {
    id: 'ChangePercent',
    label: '今日漲跌幅 (%)',
    shortLabel: '漲跌幅',
    unit: '%',
    getValue: (s) => {
      const price = parseFloat(s.ClosingPrice) || 0;
      const chg = parseFloat(s.Change) || 0;
      const prev = price - chg;
      return prev > 0 ? (chg / prev) * 100 : 0;
    },
    filter: (v) => true,
    desc: '今日漲跌幅 (Change %) - 當日股價強弱'
  },
  Volume: {
    id: 'Volume',
    label: '成交量 Volume (張)',
    shortLabel: '成交量',
    unit: ' 張',
    getValue: (s) => (parseInt(s.TradeVolume) || 0) / 1000,
    filter: (v) => v >= 0,
    desc: '今日成交量 (Trade Volume) - 人氣與流動性指標'
  }
};

export default function StockCharts({ stocks, onSelectStock }) {
  const scatterRef = useRef(null);

  const [xAxisMetric, setXAxisMetric] = useState('PE');
  const [yAxisMetric, setYAxisMetric] = useState('Yield');

  const xConf = METRIC_CONFIG[xAxisMetric];
  const yConf = METRIC_CONFIG[yAxisMetric];

  // 1. 根據選擇的指標動態篩選數據用於繪圖
  const validStocks = React.useMemo(() => {
    return stocks.filter(s => {
      const xVal = xConf.getValue(s);
      const yVal = yConf.getValue(s);
      return xConf.filter(xVal) && yConf.filter(yVal);
    });
  }, [stocks, xAxisMetric, yAxisMetric]);

  // 2. 構建動態散佈圖數據
  const scatterData = {
    datasets: [
      {
        label: `${xConf.shortLabel} vs ${yConf.shortLabel}`,
        data: validStocks.map(s => ({
          x: xConf.getValue(s),
          y: yConf.getValue(s),
          code: s.Code,
          name: s.Name,
          price: s.ClosingPrice
        })),
        backgroundColor: 'rgba(56, 189, 248, 0.6)',
        borderColor: '#38bdf8',
        borderWidth: 1,
        pointRadius: 6,
        pointHoverRadius: 9,
        pointHoverBackgroundColor: '#a855f7',
        pointHoverBorderColor: '#fff',
      }
    ]
  };

  const scatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(14, 19, 38, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const raw = context.raw;
            return [
              `股票: ${raw.code} ${raw.name}`,
              `收盤價: ${parseFloat(raw.price).toFixed(2)} 元`,
              `${xConf.shortLabel}: ${raw.x.toFixed(2)}${xConf.unit}`,
              `${yConf.shortLabel}: ${raw.y.toFixed(2)}${yConf.unit}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: xConf.desc,
          color: '#94a3b8',
          font: { size: 12, weight: 'bold' }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8'
        }
      },
      y: {
        title: {
          display: true,
          text: yConf.desc,
          color: '#94a3b8',
          font: { size: 12, weight: 'bold' }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8'
        }
      }
    },
    onClick: (event, elements) => {
      if (elements.length > 0 && onSelectStock) {
        const index = elements[0].index;
        const stockClicked = validStocks[index];
        if (stockClicked) {
          onSelectStock(stockClicked.Code);
        }
      }
    }
  };

  // 3. 構建「本益比分佈」直方圖數據
  const peIntervals = {
    '10倍以下': 0,
    '10-15倍': 0,
    '15-20倍': 0,
    '20-30倍': 0,
    '30倍以上': 0
  };

  stocks.forEach(s => {
    if (s.PEratio === '' || parseFloat(s.PEratio) <= 0) return;
    const pe = parseFloat(s.PEratio);
    if (pe < 10) peIntervals['10倍以下']++;
    else if (pe < 15) peIntervals['10-15倍']++;
    else if (pe < 20) peIntervals['15-20倍']++;
    else if (pe < 30) peIntervals['20-30倍']++;
    else peIntervals['30倍以上']++;
  });

  const peBarData = {
    labels: Object.keys(peIntervals),
    datasets: [
      {
        label: '股票家數',
        data: Object.values(peIntervals),
        backgroundColor: 'rgba(168, 85, 247, 0.5)',
        borderColor: '#a855f7',
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

  // 4. 構建「殖利率分佈」直方圖數據
  const yieldIntervals = {
    '無配息 (0%)': 0,
    '2% 以下': 0,
    '2% - 4%': 0,
    '4% - 6%': 0,
    '6% 以上': 0
  };

  stocks.forEach(s => {
    const y = parseFloat(s.DividendYield) || 0;
    if (y === 0) yieldIntervals['無配息 (0%)']++;
    else if (y < 2) yieldIntervals['2% 以下']++;
    else if (y < 4) yieldIntervals['2% - 4%']++;
    else if (y < 6) yieldIntervals['4% - 6%']++;
    else yieldIntervals['6% 以上']++;
  });

  const yieldBarData = {
    labels: Object.keys(yieldIntervals),
    datasets: [
      {
        label: '股票家數',
        data: Object.values(yieldIntervals),
        backgroundColor: 'rgba(245, 158, 11, 0.5)',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(14, 19, 38, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8' }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 散佈圖卡片 (主圖表) */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📊 多維度交叉篩選散佈圖 ({xConf.shortLabel} vs. {yConf.shortLabel})
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              📍 自訂 X 與 Y 座標軸指標，交叉探索最優質的個股！您可以點擊任意點位直接定位個股。
            </p>
          </div>
          
          {/* X/Y 軸切換選單 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>X 軸:</span>
              <select 
                value={xAxisMetric} 
                onChange={(e) => setXAxisMetric(e.target.value)}
                className="input-field"
                style={{ width: '130px', padding: '0.35rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                {Object.values(METRIC_CONFIG).map(m => (
                  <option key={m.id} value={m.id}>{m.shortLabel}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Y 軸:</span>
              <select 
                value={yAxisMetric} 
                onChange={(e) => setYAxisMetric(e.target.value)}
                className="input-field"
                style={{ width: '130px', padding: '0.35rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                {Object.values(METRIC_CONFIG).map(m => (
                  <option key={m.id} value={m.id}>{m.shortLabel}</option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)', borderRadius: '4px', fontWeight: 700 }}>
              {validStocks.length} 檔符合
            </div>
          </div>
        </div>
        
        <div style={{ height: '390px', position: 'relative' }}>
          <Scatter ref={scatterRef} data={scatterData} options={scatterOptions} />
        </div>
      </div>

      {/* 兩個直方分佈圖並排 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* 本益比直方圖 */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-purple)' }}>市場本益比分佈</h3>
          <div style={{ height: '220px' }}>
            <Bar data={peBarData} options={barOptions} />
          </div>
        </div>

        {/* 殖利率直方圖 */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-gold)' }}>市場殖利率分佈</h3>
          <div style={{ height: '220px' }}>
            <Bar data={yieldBarData} options={barOptions} />
          </div>
        </div>

      </div>

    </div>
  );
}
