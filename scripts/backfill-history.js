/**
 * 用 TWSE MI_INDEX 逐日抓取過去 N 個交易日的全市場 K 棒，建立 public/api/history.json 初始真實歷史。
 *
 * 兩種用法：
 *   1) CLI：  node scripts/backfill-history.js [calendarDays]
 *   2) 程式： import { backfillHistory } from './backfill-history.js'
 *             generate-data.js 會在歷史不足時自動呼叫（部署時自動補齊，無需改動 workflow）。
 *
 * 特性：對 TWSE 友善（每次請求間隔 sleep）、跳過假日、依日期去重可重複執行。
 */
import path from 'path';
import { fileURLToPath } from 'url';
import {
  MI_INDEX_BASE,
  parseMiIndexBars,
  readHistory,
  mergeDay,
  writeHistory,
  HISTORY_CAP_DEFAULT
} from './twse-history.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const historyPath = path.join(__dirname, '..', 'public', 'api', 'history.json');

const REQUEST_GAP_MS = parseInt(process.env.BACKFILL_GAP_MS, 10) || 1200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function compact(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function recentWeekdays(days) {
  const out = [];
  const cursor = new Date();
  for (let i = 0; i < days; i++) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) out.push(compact(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return out.reverse(); // 由舊到新
}

async function fetchMiIndexDay(dateText) {
  const url = `${MI_INDEX_BASE}?response=json&date=${dateText}&type=ALLBUT0999`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.stat && json.stat !== 'OK') return null;
  return parseMiIndexBars(json);
}

export async function backfillHistory(calendarDays = 130) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  let history = readHistory(historyPath);

  // 探測：先試抓最近一個交易日，連不到 TWSE（如本地無外網）就直接略過，不空轉
  const dates = recentWeekdays(calendarDays);
  try {
    await fetchMiIndexDay(dates[dates.length - 1]);
  } catch (err) {
    console.warn(`TWSE unreachable (${err.message}); skipping backfill.`);
    return writeHistory(historyPath, history, history.dates[history.dates.length - 1] || '');
  }

  console.log(`Backfilling ~${calendarDays} calendar days of TWSE history...`);
  let added = 0;
  let lastDate = '';
  let consecFail = 0;

  for (const dateText of dates) {
    try {
      const parsed = await fetchMiIndexDay(dateText);
      if (parsed && parsed.dataDate && Object.keys(parsed.bars).length) {
        history = mergeDay(history, parsed.bars, parsed.dataDate, HISTORY_CAP_DEFAULT);
        lastDate = parsed.dataDate;
        added++;
        consecFail = 0;
        console.log(`  + ${parsed.dataDate} (${Object.keys(parsed.bars).length} stocks)`);
      }
    } catch (err) {
      consecFail++;
      console.warn(`  ! ${dateText} failed: ${err.message}`);
      if (consecFail >= 5) {
        console.warn('Too many consecutive failures; aborting backfill early.');
        break;
      }
    }
    await sleep(REQUEST_GAP_MS);
  }

  const payload = writeHistory(historyPath, history, lastDate);
  console.log(`Backfill done. Added ${added} trading days; history now ${payload.dates.length} dates, ${payload.count} stocks.`);
  return payload;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const calendarDays = parseInt(process.argv[2], 10) || 130;
  backfillHistory(calendarDays);
}
