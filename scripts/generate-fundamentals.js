/**
 * 抓取真實基本面：上市公司每月營收（YoY / MoM）。取代 stockUtils 內以亂數捏造的基本面。
 * 來源：TWSE OpenAPI t187ap05_L（上市公司每月營業收入彙總表）。
 * 產物：public/api/fundamentals.json
 *   { dataDate, count, data: { code: { revenue, revenueYoY, revenueMoM, eps, dataMonth } } }
 *
 * 註：EPS 屬季報財報、且依產業別分表，端點較雜；此處保留 eps 欄位（預設 null），
 *     可日後接 t163sb04 等綜合損益表資料集補上。營收年增已足以驅動 SOP 的「營收成長」初選。
 * 安全策略：抓取/解析失敗保留既有檔案，流程不中斷、不捏造數據。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, '..', 'public', 'api', 'fundamentals.json');

const REVENUE_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap05_L';

function pick(obj, includes) {
  for (const key of Object.keys(obj)) {
    if (includes.every((frag) => key.includes(frag))) return obj[key];
  }
  return undefined;
}

function toNumOrNull(v) {
  if (v === undefined || v === null || v === '' || v === '-') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function readExisting() {
  if (!fs.existsSync(outputPath)) return null;
  try {
    const p = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    return p && p.data && Object.keys(p.data).length ? p : null;
  } catch {
    return null;
  }
}

export async function writeFundamentals() {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  try {
    const res = await fetch(REVENUE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty payload');

    const data = {};
    let dataMonth = '';
    for (const row of rows) {
      const code = String(pick(row, ['公司代號']) || pick(row, ['代號']) || '').trim();
      if (!/^\d{4}$/.test(code)) continue;

      const revenue = toNumOrNull(pick(row, ['當月營收']));
      const yoy = toNumOrNull(pick(row, ['去年同月增減']));
      const mom = toNumOrNull(pick(row, ['上月比較增減']));
      const ym = String(pick(row, ['資料年月']) || pick(row, ['年月']) || '').trim();
      if (ym && !dataMonth) dataMonth = ym;

      data[code] = {
        revenue,
        revenueYoY: yoy,
        revenueMoM: mom,
        eps: null,
        dataMonth: ym
      };
    }

    if (Object.keys(data).length === 0) throw new Error('no parsable rows');

    const payload = {
      success: true,
      source: 'twse_t187ap05_L',
      generatedAt: new Date().toISOString(),
      dataMonth,
      count: Object.keys(data).length,
      data
    };
    fs.writeFileSync(outputPath, JSON.stringify(payload), 'utf8');
    console.log(`fundamentals.json generated: ${payload.count} companies (month ${dataMonth}).`);
    return payload;
  } catch (err) {
    console.warn(`Fundamentals fetch failed (${err.message}); keeping existing fundamentals.json if any.`);
    const existing = readExisting();
    if (existing) {
      console.log(`Preserved existing fundamentals.json (${existing.count} companies).`);
      return existing;
    }
    const empty = { success: false, source: 'unavailable', generatedAt: new Date().toISOString(), count: 0, data: {} };
    fs.writeFileSync(outputPath, JSON.stringify(empty), 'utf8');
    return empty;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFundamentals();
}
