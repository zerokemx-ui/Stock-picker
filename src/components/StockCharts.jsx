import React, { useRef } from 'react';
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

export default function StockCharts({ stocks, onSelectStock }) {
  const scatterRef = useRef(null);

  // 1. 篩選有完整 PE 與 Yield 數據的股票用於繪圖
  const validStocks = stocks.filter(
    s => s.PEratio !== '' && parseFloat(s.PEratio) > 0 && parseFloat(s.PEratio) < 60 && parseFloat(s.DividendYield) >= 0
  );

  // 2. 構建「本益比 vs. 殖利率」散佈圖數據
  const scatterData = {
    datasets: [
      {
        label: '上市股票 (本益比 < 60)',
        data: validStocks.map(s => ({
          x: parseFloat(s.PEratio),
          y: parseFloat(s.DividendYield),
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
              `收盤價: ${raw.price} 元`,
              `本益比 (PE): ${raw.x.toFixed(2)} 倍`,
              `殖利率 (Yield): ${raw.y.toFixed(2)} %`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '本益比 (PE Ratio) - 越低越便宜',
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
          text: '殖利率 (Dividend Yield %) - 越高配息越豐厚',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>價值尋寶散佈圖 (本益比 vs. 殖利率)</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              📍 尋找左上角「低本益比、高殖利率」的黃金區間！您可以直接點擊點位來對齊底下的搜尋。
            </p>
          </div>
          <div style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)', borderRadius: '4px', fontWeight: 600 }}>
            可互動點擊
          </div>
        </div>
        
        <div style={{ height: '380px', position: 'relative' }}>
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
