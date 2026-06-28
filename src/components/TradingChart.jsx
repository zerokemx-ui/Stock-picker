import React, { useEffect, useMemo, useRef, useState } from 'react';

const MA_CONFIG = [
  { period: 5, color: '#ff3b30', label: 'MA 5' },
  { period: 10, color: '#22d3ee', label: 'MA 10' },
  { period: 20, color: '#f59e0b', label: 'MA 20' },
  { period: 60, color: '#d946ef', label: 'MA 60' }
];

function toFinite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return number.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
}

function movingAverage(bars, period) {
  return bars.map((_, index) => {
    if (index < period - 1) return null;
    let sum = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      sum += bars[cursor].close;
    }
    return sum / period;
  });
}

function normalizeBars(bars) {
  return (Array.isArray(bars) ? bars : [])
    .map((bar) => ({
      date: bar.date || bar.d || '',
      open: toFinite(bar.open ?? bar.o ?? bar.close ?? bar.c),
      high: toFinite(bar.high ?? bar.h ?? bar.close ?? bar.c),
      low: toFinite(bar.low ?? bar.l ?? bar.close ?? bar.c),
      close: toFinite(bar.close ?? bar.c),
      volume: toFinite(bar.volume ?? bar.v)
    }))
    .filter((bar) => bar.close > 0 && bar.high > 0 && bar.low > 0);
}

export default function TradingChart({ bars, title }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const normalized = useMemo(() => normalizeBars(bars).slice(-120), [bars]);
  const maMap = useMemo(() => {
    const map = new Map();
    MA_CONFIG.forEach((item) => map.set(item.period, movingAverage(normalized, item.period)));
    return map;
  }, [normalized]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const rect = wrap.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(680, rect.width);
      const height = Math.max(440, rect.height);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const bg = getComputedStyle(document.documentElement).getPropertyValue('--chart-bg').trim() || '#10131d';
      const grid = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.08)';
      const text = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#8a94a6';
      const up = getComputedStyle(document.documentElement).getPropertyValue('--stock-up').trim() || '#ff4d3d';
      const down = getComputedStyle(document.documentElement).getPropertyValue('--stock-down').trim() || '#19c37d';

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const pad = { left: 52, right: 58, top: 32, bottom: 34 };
      const volumeHeight = Math.floor(height * 0.2);
      const chartBottom = height - pad.bottom - volumeHeight - 18;
      const chartTop = pad.top;
      const chartHeight = chartBottom - chartTop;
      const volumeTop = chartBottom + 22;
      const volumeBottom = height - pad.bottom;
      const plotLeft = pad.left;
      const plotRight = width - pad.right;
      const plotWidth = plotRight - plotLeft;

      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = text;

      if (!normalized.length) {
        ctx.fillStyle = text;
        ctx.textAlign = 'center';
        ctx.fillText('沒有可用的 OHLC K 線資料', width / 2, height / 2);
        return;
      }

      const priceValues = normalized.flatMap((bar) => [bar.high, bar.low]);
      MA_CONFIG.forEach((item) => {
        maMap.get(item.period)?.forEach((value) => {
          if (value != null) priceValues.push(value);
        });
      });
      const high = Math.max(...priceValues);
      const low = Math.min(...priceValues);
      const padding = Math.max((high - low) * 0.08, high * 0.01);
      const maxPrice = high + padding;
      const minPrice = Math.max(0, low - padding);
      const priceRange = Math.max(maxPrice - minPrice, 1);
      const maxVolume = Math.max(...normalized.map((bar) => bar.volume), 1);
      const step = plotWidth / normalized.length;
      const candleWidth = Math.max(3, Math.min(10, step * 0.56));

      const priceY = (price) => chartBottom - ((price - minPrice) / priceRange) * chartHeight;
      const xAt = (index) => plotLeft + index * step + step / 2;

      for (let i = 0; i <= 5; i += 1) {
        const y = chartTop + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(plotLeft, y);
        ctx.lineTo(plotRight, y);
        ctx.stroke();

        const price = maxPrice - (priceRange / 5) * i;
        ctx.fillStyle = text;
        ctx.textAlign = 'left';
        ctx.fillText(formatValue(price), plotRight + 8, y + 4);
      }

      ctx.beginPath();
      ctx.moveTo(plotLeft, volumeTop);
      ctx.lineTo(plotRight, volumeTop);
      ctx.moveTo(plotLeft, volumeBottom);
      ctx.lineTo(plotRight, volumeBottom);
      ctx.stroke();

      normalized.forEach((bar, index) => {
        const x = xAt(index);
        const isUp = bar.close >= bar.open;
        const color = isUp ? up : down;
        const openY = priceY(bar.open);
        const closeY = priceY(bar.close);
        const highY = priceY(bar.high);
        const lowY = priceY(bar.low);
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1, Math.abs(closeY - openY));
        const volumeBarHeight = (bar.volume / maxVolume) * (volumeBottom - volumeTop);

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

        ctx.globalAlpha = 0.42;
        ctx.fillRect(x - candleWidth / 2, volumeBottom - volumeBarHeight, candleWidth, volumeBarHeight);
        ctx.globalAlpha = 1;
      });

      MA_CONFIG.forEach((ma) => {
        const values = maMap.get(ma.period);
        ctx.strokeStyle = ma.color;
        ctx.lineWidth = ma.period === 60 ? 1.1 : 1.4;
        ctx.beginPath();
        let started = false;
        values.forEach((value, index) => {
          if (value == null) return;
          const x = xAt(index);
          const y = priceY(value);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      });

      const labelIndexes = [0, Math.floor(normalized.length / 3), Math.floor((normalized.length / 3) * 2), normalized.length - 1];
      ctx.fillStyle = text;
      ctx.textAlign = 'center';
      labelIndexes.forEach((index) => {
        const bar = normalized[index];
        if (!bar) return;
        ctx.fillText(String(bar.date).slice(5) || String(index + 1), xAt(index), height - 12);
      });

      ctx.fillStyle = text;
      ctx.textAlign = 'left';
      ctx.fillText(title || 'K 線圖', plotLeft, 18);

      if (hover != null) {
        const index = Math.max(0, Math.min(normalized.length - 1, hover));
        const bar = normalized[index];
        const x = xAt(index);
        ctx.strokeStyle = 'rgba(255,255,255,0.38)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, chartTop);
        ctx.lineTo(x, volumeBottom);
        ctx.stroke();
        ctx.setLineDash([]);

        const tooltipWidth = 218;
        const tooltipX = x + tooltipWidth + 16 > plotRight ? x - tooltipWidth - 16 : x + 16;
        const tooltipY = chartTop + 12;
        ctx.fillStyle = 'rgba(6, 10, 18, 0.92)';
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, 110, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        const rows = [
          `${bar.date || '--'}`,
          `開 ${formatValue(bar.open)}  高 ${formatValue(bar.high)}`,
          `低 ${formatValue(bar.low)}  收 ${formatValue(bar.close)}`,
          `量 ${formatValue(bar.volume)}`
        ];
        rows.forEach((row, rowIndex) => ctx.fillText(row, tooltipX + 12, tooltipY + 22 + rowIndex * 21));
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [normalized, maMap, hover, title]);

  const handleMove = (event) => {
    const canvas = canvasRef.current;
    if (!canvas || !normalized.length) return;
    const rect = canvas.getBoundingClientRect();
    const plotLeft = 52;
    const plotRight = rect.width - 58;
    const x = event.clientX - rect.left;
    const ratio = (x - plotLeft) / Math.max(plotRight - plotLeft, 1);
    const index = Math.round(ratio * normalized.length - 0.5);
    setHover(Math.max(0, Math.min(normalized.length - 1, index)));
  };

  const latest = normalized[normalized.length - 1];

  return (
    <div className="trading-chart">
      <div className="trading-chart__legend">
        {latest && <span>最新收盤 {formatValue(latest.close)}</span>}
        {MA_CONFIG.map((item) => (
          <span key={item.period} style={{ color: item.color }}>{item.label}</span>
        ))}
      </div>
      <div ref={wrapRef} className="trading-chart__canvas">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        />
      </div>
    </div>
  );
}
