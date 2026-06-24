/**
 * 抓取上市公司基本資料（產業別、實收資本額），取代用股票代碼前綴硬猜產業的做法。
 * 來源：TWSE OpenAPI t187ap03_L（上市公司基本資料）。
 * 產物：public/api/company.json  { dataDate, count, data: { code: { name, industry, capitalYi } } }
 *
 * 安全策略：抓取或欄位解析失敗時，保留既有 company.json（不覆寫成空），整體流程不中斷。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, '..', 'public', 'api', 'company.json');

const COMPANY_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L';

// TWSE 產業別名稱 → app 內部慣用分類（其餘維持 TWSE 原名，比代碼前綴精準）
const INDUSTRY_MAP = {
  '半導體業': '半導體',
  '電腦及週邊設備業': '電腦週邊',
  '金融保險業': '金融保險',
  '航運業': '航運業',
  '光電業': '光電業',
  '電子零組件業': '電子零組件',
  '通信網路業': '通信網路',
  '水泥工業': '水泥工業',
  '塑膠工業': '塑膠工業',
  '鋼鐵工業': '鋼鐵工業',
  '食品工業': '食品工業',
  '汽車工業': '汽車工業'
};

function pick(obj, includes) {
  for (const key of Object.keys(obj)) {
    if (includes.every((frag) => key.includes(frag))) return obj[key];
  }
  return undefined;
}

function toNum(v) {
  if (v === undefined || v === null) return 0;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
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

export async function writeCompanyInfo() {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  try {
    const res = await fetch(COMPANY_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty payload');

    const data = {};
    for (const row of rows) {
      const code = String(pick(row, ['公司代號']) || pick(row, ['代號']) || '').trim();
      if (!/^\d{4}$/.test(code)) continue;
      const name = String(pick(row, ['簡稱']) || pick(row, ['名稱']) || '').trim();
      const rawIndustry = String(pick(row, ['產業別']) || '').trim();
      const capitalRaw = toNum(pick(row, ['實收資本額']));

      data[code] = {
        name,
        industry: INDUSTRY_MAP[rawIndustry] || rawIndustry || '其他',
        capitalYi: capitalRaw > 0 ? Number((capitalRaw / 1e8).toFixed(2)) : null
      };
    }

    if (Object.keys(data).length === 0) throw new Error('no parsable rows');

    const payload = {
      success: true,
      source: 'twse_t187ap03_L',
      generatedAt: new Date().toISOString(),
      count: Object.keys(data).length,
      data
    };
    fs.writeFileSync(outputPath, JSON.stringify(payload), 'utf8');
    console.log(`company.json generated: ${payload.count} companies.`);
    return payload;
  } catch (err) {
    console.warn(`Company info fetch failed (${err.message}); keeping existing company.json if any.`);
    const existing = readExisting();
    if (existing) {
      console.log(`Preserved existing company.json (${existing.count} companies).`);
      return existing;
    }
    // 沒有任何資料時寫入空殼，前端會自動回退到代碼前綴分類
    const empty = { success: false, source: 'unavailable', generatedAt: new Date().toISOString(), count: 0, data: {} };
    fs.writeFileSync(outputPath, JSON.stringify(empty), 'utf8');
    return empty;
  }
}

// 允許單獨執行
if (import.meta.url === `file://${process.argv[1]}`) {
  writeCompanyInfo();
}
