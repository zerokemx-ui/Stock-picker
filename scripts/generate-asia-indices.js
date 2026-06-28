import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const publicApiDir = path.join(process.cwd(), 'public', 'api');
const outputPath = path.join(publicApiDir, 'asia-indices.json');

const INDEXES = [
  { symbol: '^N225', name: '日經 225', enName: 'Nikkei 225', yahooSymbol: '%5EN225', timeZone: 'Asia/Tokyo' },
  { symbol: '^KS11', name: '韓國 KOSPI', enName: 'KOSPI Composite', yahooSymbol: '%5EKS11', timeZone: 'Asia/Seoul' }
];

function formatDate(timestamp, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(timestamp * 1000));
}

function compactNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function readExistingSnapshot() {
  if (!fs.existsSync(outputPath)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    if (payload && Array.isArray(payload.data) && payload.data.length) return payload;
  } catch {
    return null;
  }
  return null;
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
  if (!result) throw new Error(`${index.symbol} missing chart result`);

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const rows = timestamps
    .map((timestamp, idx) => ({ timestamp, close: closes[idx] }))
    .filter((row) => Number.isFinite(row.close));
  if (rows.length < 2) throw new Error(`${index.symbol} has too few rows`);

  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  const value = compactNumber(latest.close);
  const previousClose = compactNumber(previous.close);
  const change = compactNumber(value - previousClose);
  const changeRate = compactNumber((change / previousClose) * 100);
  const timeZone = result.meta?.exchangeTimezoneName || index.timeZone;

  return {
    name: index.name,
    enName: index.enName,
    symbol: index.symbol,
    value,
    previousClose,
    change,
    changeRate,
    currency: result.meta?.currency || '',
    exchange: result.meta?.exchangeName || '',
    dataDate: formatDate(latest.timestamp, timeZone),
    marketTime: new Date(latest.timestamp * 1000).toISOString(),
    source: 'yahoo_chart'
  };
}

function parseTwseNumber(value) {
  const number = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function formatTwseDate(dateText) {
  const raw = String(dateText || '');
  if (raw.length !== 8) return '';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

async function fetchTaiwanWeightedIndex() {
  const response = await fetch('https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?response=json&type=ALLBUT0999', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://www.twse.com.tw/zh/trading/historical/mi-index.html',
      'Accept': 'application/json'
    }
  });
  if (!response.ok) throw new Error(`TWSE index HTTP ${response.status}`);
  const payload = await response.json();
  const indexTable = (payload.tables || []).find((table) => {
    const fields = table.fields || [];
    return fields.includes('指數') && fields.includes('收盤指數') && Array.isArray(table.data);
  });
  const row = indexTable?.data?.find((item) => item[0] === '發行量加權股價指數');
  if (!row) throw new Error('TWSE weighted index row not found');

  const signText = String(row[2] || '');
  const sign = signText.includes('-') || signText.includes('green') ? -1 : 1;
  const change = parseTwseNumber(row[3]) * sign;
  return {
    name: '台灣加權',
    enName: 'Taiwan Weighted Index',
    symbol: 'TWSE',
    value: parseTwseNumber(row[1]),
    previousClose: null,
    change,
    currency: 'TWD',
    exchange: 'TWSE',
    dataDate: formatTwseDate(payload.date),
    marketTime: new Date().toISOString(),
    changeRate: parseTwseNumber(row[4]),
    source: 'twse_mi_index'
  };
}

export async function fetchAsiaIndicesSnapshot() {
  try {
    const [taiwan, ...regional] = await Promise.all([
      fetchTaiwanWeightedIndex(),
      ...INDEXES.map(fetchYahooChart)
    ]);
    const data = [taiwan, ...regional];
    const dataDate = data.reduce((latest, item) => item.dataDate > latest ? item.dataDate : latest, '');
    return {
      success: true,
      source: 'twse_yahoo_chart',
      generatedAt: new Date().toISOString(),
      dataDate,
      count: data.length,
      data
    };
  } catch (error) {
    console.error(`Asia indices fetch failed: ${error.message}`);
    const existing = readExistingSnapshot();
    if (existing) {
      return {
        ...existing,
        success: true,
        source: 'static_asia_indices_fallback',
        generatedAt: new Date().toISOString(),
        isFallback: true,
        warning: 'Asia indices fetch failed. Existing published snapshot was preserved.'
      };
    }
    throw error;
  }
}

export async function writeAsiaIndicesSnapshot() {
  if (!fs.existsSync(publicApiDir)) fs.mkdirSync(publicApiDir, { recursive: true });
  const snapshot = await fetchAsiaIndicesSnapshot();
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`Asia indices generated at ${outputPath}. Date: ${snapshot.dataDate}. Source: ${snapshot.source}`);
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeAsiaIndicesSnapshot();
}
