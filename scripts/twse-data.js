import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_DATA_PATH = path.join(__dirname, '..', 'public', 'api', 'stocks.json');

const STOCK_DAY_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const BWIBBU_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL';
const TWSE_MIS_HOME = 'https://mis.twse.com.tw/stock/fibest.jsp?lang=zh_tw';
const TWSE_MIS_API = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp';
const REALTIME_BATCH_SIZE = 80;

export function getCategoryByCode(code) {
  if (code.startsWith('2330') || code.startsWith('2454') || code.startsWith('2303') || code.startsWith('3711') || code.startsWith('2379') || code.startsWith('3034')) {
    return '半導體';
  }
  if (code.startsWith('2317') || code.startsWith('2382') || code.startsWith('2357') || code.startsWith('3231') || code.startsWith('2324') || code.startsWith('2395') || code.startsWith('2301') || code.startsWith('2356')) {
    return '電腦週邊';
  }
  if (code.startsWith('28') || code.startsWith('58')) return '金融保險';
  if (code.startsWith('26')) return '航運業';
  if (code.startsWith('11')) return '水泥工業';
  if (code.startsWith('13')) return '塑膠工業';
  if (code.startsWith('20')) return '鋼鐵工業';
  if (code.startsWith('12')) return '食品工業';
  if (code.startsWith('2409') || code.startsWith('3481') || code.startsWith('3008')) return '光電業';
  if (code.startsWith('2412') || code.startsWith('3045') || code.startsWith('4904')) return '通信網路';
  if (code.startsWith('24') || code.startsWith('30') || code.startsWith('34') || code.startsWith('37') || code.startsWith('49')) return '電子零組件';
  return '其他';
}

function parseNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '' || value === '-' || value === '--') return fallback;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value) {
  return parseNumber(value).toFixed(2);
}

function formatRocDate(dateText) {
  const raw = String(dateText || '');
  if (!/^\d{7}$/.test(raw)) return '';
  const year = Number(raw.slice(0, 3)) + 1911;
  return `${year}-${raw.slice(3, 5)}-${raw.slice(5, 7)}`;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${url} failed with status ${response.status}`);
  }
  return response.json();
}

function readStaticFallback() {
  if (!fs.existsSync(STATIC_DATA_PATH)) {
    return null;
  }
  try {
    const payload = JSON.parse(fs.readFileSync(STATIC_DATA_PATH, 'utf8'));
    return Array.isArray(payload.data) ? payload : null;
  } catch {
    return null;
  }
}

async function getMisCookie() {
  const response = await fetch(TWSE_MIS_HOME, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  const setCookie = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);

  return setCookie.map(cookie => cookie.split(';')[0]).join('; ');
}

function pickRealtimePrice(item) {
  const candidates = [
    item.z,
    item.pz,
    item.b ? item.b.split('_')[0] : '',
    item.a ? item.a.split('_')[0] : '',
    item.o,
    item.y
  ];

  for (const candidate of candidates) {
    const value = parseNumber(candidate, NaN);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}

async function fetchRealtimeMap(codes) {
  if (!codes.length) return new Map();

  const cookie = await getMisCookie();
  const realtimeMap = new Map();

  for (const chunk of chunkArray(codes, REALTIME_BATCH_SIZE)) {
    const exCh = chunk.map(code => `tse_${code}.tw`).join('|');
    const url = `${TWSE_MIS_API}?ex_ch=${encodeURIComponent(exCh)}&json=1&delay=0&_=${Date.now()}`;
    const json = await fetchJson(url, {
      headers: {
        Cookie: cookie,
        Referer: TWSE_MIS_HOME,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (Array.isArray(json.msgArray)) {
      for (const item of json.msgArray) {
        if (item.c) realtimeMap.set(item.c, item);
      }
    }
  }

  return realtimeMap;
}

export async function fetchTaiwanStockData() {
  console.log('Attempting to fetch latest stock data from TWSE OpenAPI and MIS...');

  try {
    const [stockDayData, bwibbuData] = await Promise.all([
      fetchJson(STOCK_DAY_URL),
      fetchJson(BWIBBU_URL)
    ]);

    const bwibbuMap = new Map();
    for (const item of bwibbuData) {
      bwibbuMap.set(item.Code, item);
    }

    const baseItems = stockDayData
      .filter(item => item.Code && item.Name && item.Code.length <= 6)
      .map(item => {
        const bItem = bwibbuMap.get(item.Code);
        const closingPrice = parseNumber(item.ClosingPrice);

        return {
          Code: item.Code,
          Name: item.Name,
          ClosingPrice: closingPrice.toFixed(2),
          OpeningPrice: formatNumber(item.OpeningPrice || closingPrice),
          HighestPrice: formatNumber(item.HighestPrice || closingPrice),
          LowestPrice: formatNumber(item.LowestPrice || closingPrice),
          Change: formatNumber(item.Change),
          TradeVolume: String(parseNumber(item.TradeVolume)),
          TradeValue: String(parseNumber(item.TradeValue)),
          Transaction: String(parseNumber(item.Transaction)),
          PEratio: bItem && bItem.PEratio !== '' ? formatNumber(bItem.PEratio) : '',
          DividendYield: bItem && bItem.DividendYield !== '' ? formatNumber(bItem.DividendYield) : '0.00',
          PBratio: bItem && bItem.PBratio !== '' ? formatNumber(bItem.PBratio) : '',
          Category: getCategoryByCode(item.Code)
        };
      });
    const dataDate = formatRocDate(stockDayData.find(item => item.Date)?.Date);

    const realtimeMap = await fetchRealtimeMap(baseItems.map(item => item.Code));
    let realtimeCount = 0;

    const mergedList = baseItems.map(item => {
      const realtime = realtimeMap.get(item.Code);
      if (!realtime) return item;

      const livePrice = pickRealtimePrice(realtime);
      const yesterdayClose = parseNumber(realtime.y, parseNumber(item.ClosingPrice));
      const volumeLots = parseNumber(realtime.v, 0);
      const volumeShares = volumeLots > 0 ? volumeLots * 1000 : parseNumber(item.TradeVolume);
      const tradeValue = livePrice > 0 && volumeShares > 0
        ? Math.round(livePrice * volumeShares)
        : parseNumber(item.TradeValue);

      if (livePrice > 0) realtimeCount += 1;

      return {
        ...item,
        Name: realtime.n || item.Name,
        ClosingPrice: livePrice > 0 ? livePrice.toFixed(2) : item.ClosingPrice,
        OpeningPrice: formatNumber(realtime.o || item.OpeningPrice),
        HighestPrice: formatNumber(realtime.h || item.HighestPrice),
        LowestPrice: formatNumber(realtime.l || item.LowestPrice),
        Change: livePrice > 0 && yesterdayClose > 0 ? (livePrice - yesterdayClose).toFixed(2) : item.Change,
        TradeVolume: String(volumeShares),
        TradeValue: String(tradeValue),
        Time: realtime.t || '',
        LimitUp: realtime.u ? formatNumber(realtime.u) : '',
        LimitDown: realtime.w ? formatNumber(realtime.w) : '',
        Source: livePrice > 0 ? 'twse_mis_live' : 'twse_api'
      };
    });

    mergedList.sort((a, b) => parseNumber(b.TradeValue) - parseNumber(a.TradeValue));

    console.log(`Fetched ${mergedList.length} stocks. Realtime rows merged: ${realtimeCount}.`);

    return {
      success: true,
      source: realtimeCount > 0 ? 'twse_mis_live' : 'twse_api',
      dataDate,
      generatedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      count: mergedList.length,
      realtimeCount,
      data: mergedList
    };
  } catch (error) {
    console.error('Error fetching TWSE data, falling back to current static snapshot:', error.message);
    const fallbackPayload = readStaticFallback();
    const fallback = fallbackPayload?.data || [];
    return {
      success: true,
      source: fallback.length ? 'static_fallback' : 'empty_fallback',
      dataDate: fallbackPayload?.dataDate || '',
      generatedAt: new Date().toISOString(),
      timestamp: fallbackPayload?.timestamp || fallbackPayload?.generatedAt || new Date().toISOString(),
      isFallback: true,
      count: fallback.length,
      realtimeCount: 0,
      data: fallback
    };
  }
}

export async function fetchRealtimeStocks(codesString) {
  const codes = String(codesString || '')
    .split(',')
    .map(code => code.trim())
    .filter(Boolean);

  if (!codes.length) {
    return { success: false, error: '缺少股票代碼 codes' };
  }

  try {
    const realtimeMap = await fetchRealtimeMap(codes);
    const data = [];

    for (const code of codes) {
      const item = realtimeMap.get(code);
      if (!item) continue;

      const livePrice = pickRealtimePrice(item);
      const yesterdayClose = parseNumber(item.y);
      const volumeLots = parseNumber(item.v);

      data.push({
        Code: item.c,
        Name: item.n,
        ClosingPrice: livePrice.toFixed(2),
        OpeningPrice: formatNumber(item.o || yesterdayClose),
        HighestPrice: formatNumber(item.h || livePrice),
        LowestPrice: formatNumber(item.l || livePrice),
        Change: yesterdayClose > 0 ? (livePrice - yesterdayClose).toFixed(2) : '0.00',
        ChangePercent: yesterdayClose > 0 ? (((livePrice - yesterdayClose) / yesterdayClose) * 100).toFixed(2) : '0.00',
        TradeVolume: String(volumeLots * 1000),
        LimitUp: item.u ? formatNumber(item.u) : '',
        LimitDown: item.w ? formatNumber(item.w) : '',
        Time: item.t || '',
        Source: 'twse_mis_live'
      });
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      data
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
