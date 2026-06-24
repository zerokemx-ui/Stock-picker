/**
 * 威力台股情報站 - 真實歷史日線 OHLC 累積管線
 *
 * 設計重點：
 * 1. 與 generate-data.js 相同的 TWSE MI_INDEX 解析邏輯（已在正式環境驗證可用）。
 * 2. 每日把整個市場的當日 K 棒「追加」進 public/api/history.json，逐步累積成真實歷史。
 * 3. backfill-history.js 會用同一組解析器，逐日回補過去 N 個交易日，快速建立初始歷史。
 *
 * history.json 結構：
 * {
 *   success, generatedAt, dataDate, days,
 *   dates: ["2026-01-02", ...],                 // 已收錄交易日（升冪）
 *   data: { "2330": [ { d, o, h, l, c, v }, ... 升冪 ], ... }
 * }
 */
import fs from 'fs';
import path from 'path';

export const MI_INDEX_BASE = 'https://www.twse.com.tw/exchangeReport/MI_INDEX';
export const HISTORY_CAP_DEFAULT = 180; // 約 9 個月交易日，足以算 MA60 / 20 日新高

function toNum(value) {
  if (value === undefined || value === null) return 0;
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function formatTwseDate(dateText) {
  const raw = String(dateText || '');
  if (raw.length !== 8) return '';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/** 從 MI_INDEX JSON 解析出當日全市場 K 棒 */
export function parseMiIndexBars(miIndexJson) {
  const table =
    (miIndexJson.tables || []).find((t) => t.title && t.title.includes('每日收盤行情')) ||
    (Array.isArray(miIndexJson.data) ? { data: miIndexJson.data } : null);

  const bars = {};
  if (!table || !Array.isArray(table.data)) {
    return { dataDate: formatTwseDate(miIndexJson.date), bars };
  }

  for (const row of table.data) {
    const code = row[0];
    const name = row[1];
    if (!code || !name || String(code).length > 6) continue;

    const close = toNum(row[8]);
    if (close <= 0) continue; // 排除無交易/停牌

    bars[code] = {
      o: Number((toNum(row[5]) || close).toFixed(2)),
      h: Number((toNum(row[6]) || close).toFixed(2)),
      l: Number((toNum(row[7]) || close).toFixed(2)),
      c: Number(close.toFixed(2)),
      v: Math.round(toNum(row[2])) // 成交股數
    };
  }
  return { dataDate: formatTwseDate(miIndexJson.date), bars };
}

/** 從 stocks.json 的 data 陣列直接建立 bars（免重新解析） */
export function barsFromStockList(list) {
  const bars = {};
  for (const s of list || []) {
    const close = toNum(s.ClosingPrice);
    if (close <= 0) continue;
    bars[s.Code] = {
      o: Number((toNum(s.OpeningPrice) || close).toFixed(2)),
      h: Number((toNum(s.HighestPrice) || close).toFixed(2)),
      l: Number((toNum(s.LowestPrice) || close).toFixed(2)),
      c: Number(close.toFixed(2)),
      v: Math.round(toNum(s.TradeVolume))
    };
  }
  return bars;
}

export function readHistory(historyPath) {
  if (!fs.existsSync(historyPath)) return { dates: [], data: {} };
  try {
    const payload = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    if (payload && payload.data && typeof payload.data === 'object') {
      return { dates: Array.isArray(payload.dates) ? payload.dates : [], data: payload.data };
    }
  } catch {
    /* 損毀視為空，避免炸掉流程 */
  }
  return { dates: [], data: {} };
}

/** 將某交易日 bars 併入歷史（依日期去重、升冪、超過上限裁切） */
export function mergeDay(history, bars, dataDate, cap = HISTORY_CAP_DEFAULT) {
  if (!dataDate) return history;
  const data = history.data || {};

  for (const [code, bar] of Object.entries(bars)) {
    let series = Array.isArray(data[code]) ? data[code] : [];
    series = series.filter((row) => row.d !== dataDate);
    series.push({ d: dataDate, ...bar });
    series.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    if (series.length > cap) series = series.slice(series.length - cap);
    data[code] = series;
  }

  const dateSet = new Set(history.dates || []);
  dateSet.add(dataDate);
  let dates = Array.from(dateSet).sort();
  if (dates.length > cap) dates = dates.slice(dates.length - cap);

  return { dates, data };
}

export function writeHistory(historyPath, history, dataDate) {
  const dir = path.dirname(historyPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const payload = {
    success: true,
    source: 'twse_mi_index_history',
    generatedAt: new Date().toISOString(),
    dataDate: dataDate || (history.dates.length ? history.dates[history.dates.length - 1] : ''),
    days: HISTORY_CAP_DEFAULT,
    count: Object.keys(history.data || {}).length,
    dates: history.dates,
    data: history.data
  };
  fs.writeFileSync(historyPath, JSON.stringify(payload), 'utf8');
  return payload;
}

/** 便捷：把當日 bars 追加進 history.json */
export function appendDailyBars(historyPath, bars, dataDate, cap = HISTORY_CAP_DEFAULT) {
  if (!dataDate || !bars || Object.keys(bars).length === 0) return null;
  const history = readHistory(historyPath);
  const merged = mergeDay(history, bars, dataDate, cap);
  return writeHistory(historyPath, merged, dataDate);
}
