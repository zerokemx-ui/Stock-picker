import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const publicApiDir = path.join(process.cwd(), 'public', 'api');
const outputPath = path.join(publicApiDir, 'us-indices.json');

const INDEXES = [
  { symbol: '^DJI', name: 'Dow Jones', enName: 'Dow Jones Industrial Average', yahooSymbol: '%5EDJI' },
  { symbol: '^GSPC', name: 'S&P 500', enName: 'S&P 500 Index', yahooSymbol: '%5EGSPC' },
  { symbol: '^IXIC', name: 'Nasdaq Composite', enName: 'Nasdaq Composite', yahooSymbol: '%5EIXIC' },
  { symbol: '^SOX', name: 'Philadelphia Semiconductor', enName: 'Philadelphia Semiconductor Index', yahooSymbol: '%5ESOX' }
];

function formatDate(timestamp, timeZone = 'America/New_York') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(timestamp * 1000));
}

function readExistingSnapshot() {
  if (!fs.existsSync(outputPath)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    if (payload && Array.isArray(payload.data) && payload.data.length === INDEXES.length) return payload;
  } catch {
    return null;
  }
  return null;
}

function compactNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

async function fetchYahooChart(index) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${index.yahooSymbol}?range=7d&interval=1d`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json'
    }
  });
  if (!response.ok) throw new Error(`${index.symbol} HTTP ${response.status}`);

  const payload = await response.json();
  const result = payload.chart?.result?.[0];
  if (!result) {
    const message = payload.chart?.error?.description || 'missing chart result';
    throw new Error(`${index.symbol} ${message}`);
  }

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const rows = timestamps
    .map((timestamp, idx) => ({ timestamp, close: closes[idx] }))
    .filter(row => Number.isFinite(row.close));

  if (rows.length < 2) throw new Error(`${index.symbol} has too few chart rows`);

  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  const value = compactNumber(latest.close);
  const previousClose = compactNumber(previous.close);
  const change = compactNumber(value - previousClose);
  const changeRate = compactNumber((change / previousClose) * 100);
  const timeZone = result.meta?.exchangeTimezoneName || 'America/New_York';

  return {
    name: index.name,
    enName: index.enName,
    symbol: index.symbol,
    value,
    previousClose,
    change,
    changeRate,
    currency: result.meta?.currency || 'USD',
    exchange: result.meta?.exchangeName || '',
    dataDate: formatDate(latest.timestamp, timeZone),
    marketTime: new Date(latest.timestamp * 1000).toISOString(),
    source: 'yahoo_chart'
  };
}

export async function fetchUsIndicesSnapshot() {
  try {
    const data = await Promise.all(INDEXES.map(fetchYahooChart));
    const dataDate = data.reduce((latest, item) => item.dataDate > latest ? item.dataDate : latest, '');
    return {
      success: true,
      source: 'yahoo_chart',
      generatedAt: new Date().toISOString(),
      dataDate,
      count: data.length,
      data
    };
  } catch (error) {
    console.error(`US indices fetch failed: ${error.message}`);
    const existing = readExistingSnapshot();
    if (existing) {
      return {
        ...existing,
        success: true,
        source: 'static_us_indices_fallback',
        generatedAt: new Date().toISOString(),
        isFallback: true,
        warning: 'US indices fetch failed. Existing published snapshot was preserved.'
      };
    }
    throw error;
  }
}

export async function writeUsIndicesSnapshot() {
  if (!fs.existsSync(publicApiDir)) fs.mkdirSync(publicApiDir, { recursive: true });
  const snapshot = await fetchUsIndicesSnapshot();
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`US indices generated at ${outputPath}. Date: ${snapshot.dataDate}. Source: ${snapshot.source}`);
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeUsIndicesSnapshot();
}
