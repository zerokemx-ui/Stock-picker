import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeChipDataSnapshot } from './generate-chip-data.js';
import { barsFromStockList, appendDailyBars, readHistory } from './twse-history.js';
import { backfillHistory } from './backfill-history.js';
import { writeCompanyInfo } from './generate-company-info.js';
import { writeFundamentals } from './generate-fundamentals.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicApiDir = path.join(__dirname, '..', 'public', 'api');
if (!fs.existsSync(publicApiDir)) {
  fs.mkdirSync(publicApiDir, { recursive: true });
}

const outputPath = path.join(publicApiDir, 'stocks.json');
const historyPath = path.join(publicApiDir, 'history.json');
const companyPath = path.join(publicApiDir, 'company.json');

function readExistingSnapshot() {
  if (!fs.existsSync(outputPath)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    if (payload && Array.isArray(payload.data) && payload.data.length > 0) return payload;
  } catch {
    return null;
  }
  return null;
}

// 讀取真實產業別/股本對照表（company.json）；失敗則回傳空 Map，改用代碼前綴推測
function readCompanyMap() {
  if (!fs.existsSync(companyPath)) return new Map();
  try {
    const payload = JSON.parse(fs.readFileSync(companyPath, 'utf8'));
    const map = new Map();
    if (payload && payload.data) {
      for (const [code, info] of Object.entries(payload.data)) map.set(code, info);
    }
    return map;
  } catch {
    return new Map();
  }
}

function formatTwseDate(dateText) {
  if (!dateText || String(dateText).length !== 8) return '';
  const raw = String(dateText);
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

// 後備分類：僅在 company.json 缺該檔產業別時使用（精準度較低）
function getCategoryByCode(code) {
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
  if (code.startsWith('24') || code.startsWith('30') || code.startsWith('34') || code.startsWith('37') || code.startsWith('49')) {
    if (code.startsWith('2409') || code.startsWith('3481') || code.startsWith('3008')) return '光電業';
    if (code.startsWith('2412') || code.startsWith('3045') || code.startsWith('4904')) return '通信網路';
    return '電子零組件';
  }
  return '其他';
}

async function fetchTaiwanStockData() {
  console.log('Attempting to fetch latest daily close data from TWSE MI_INDEX...');
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const companyMap = readCompanyMap();
  const resolveCategory = (code) => {
    const info = companyMap.get(code);
    if (info && info.industry) return info.industry;
    return getCategoryByCode(code);
  };

  try {
    const miIndexRes = await fetch('https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=ALLBUT0999');
    if (!miIndexRes.ok) throw new Error(`MI_INDEX fetch failed with status ${miIndexRes.status}`);
    const miIndexJson = await miIndexRes.json();

    const miTable = miIndexJson.tables.find(t => t.title && t.title.includes('每日收盤行情'));
    if (!miTable || !Array.isArray(miTable.data)) throw new Error('MI_INDEX table not found or empty');

    const bwibbuRes = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL');
    const bwibbuMap = new Map();
    if (bwibbuRes.ok) {
      try {
        const bwibbuData = await bwibbuRes.json();
        for (const item of bwibbuData) bwibbuMap.set(item.Code, item);
      } catch (err) {
        console.error('Error parsing BWIBBU_ALL:', err.message);
      }
    }

    console.log(`Successfully fetched from TWSE MI_INDEX. Total records in index: ${miTable.data.length}`);

    const mergedList = [];
    for (const row of miTable.data) {
      const code = row[0];
      const name = row[1];
      if (!code || !name || code.length > 6) continue;

      const tradeVolume = parseInt(row[2].replace(/,/g, '')) || 0;
      const transaction = parseInt(row[3].replace(/,/g, '')) || 0;
      const tradeValue = parseInt(row[4].replace(/,/g, '')) || 0;

      const closingPrice = parseFloat(row[8].replace(/,/g, '')) || 0;
      if (closingPrice <= 0) continue;

      const openingPrice = parseFloat(row[5].replace(/,/g, '')) || closingPrice;
      const highestPrice = parseFloat(row[6].replace(/,/g, '')) || closingPrice;
      const lowestPrice = parseFloat(row[7].replace(/,/g, '')) || closingPrice;

      const changeSignHtml = row[9] || '';
      const changeValRaw = parseFloat(row[10].replace(/,/g, '')) || 0;
      let changeVal = changeValRaw;
      if (changeSignHtml.includes('-') || changeSignHtml.includes('green')) {
        changeVal = -changeValRaw;
      }

      const bItem = bwibbuMap.get(code);
      const pe = bItem && bItem.PEratio !== '' && bItem.PEratio !== undefined ? parseFloat(bItem.PEratio) : (parseFloat(row[15]) || null);
      const yieldPct = bItem && bItem.DividendYield !== '' && bItem.DividendYield !== undefined ? parseFloat(bItem.DividendYield) : 0;
      const pb = bItem && bItem.PBratio !== '' && bItem.PBratio !== undefined ? parseFloat(bItem.PBratio) : null;
      const companyInfo = companyMap.get(code);

      mergedList.push({
        Code: code,
        Name: name,
        ClosingPrice: closingPrice.toFixed(2),
        OpeningPrice: openingPrice.toFixed(2),
        HighestPrice: highestPrice.toFixed(2),
        LowestPrice: lowestPrice.toFixed(2),
        Change: changeVal.toFixed(2),
        TradeVolume: tradeVolume.toString(),
        TradeValue: tradeValue.toString(),
        Transaction: transaction.toString(),
        PEratio: pe !== null && pe > 0 ? pe.toFixed(2) : '',
        DividendYield: yieldPct.toFixed(2),
        PBratio: pb !== null && pb > 0 ? pb.toFixed(2) : '',
        Category: resolveCategory(code),
        CapitalYi: companyInfo && companyInfo.capitalYi != null ? companyInfo.capitalYi : null
      });
    }

    mergedList.sort((a, b) => parseFloat(b.TradeValue) - parseFloat(a.TradeValue));

    return {
      success: true,
      source: 'twse_mi_index',
      dataDate: formatTwseDate(miIndexJson.date),
      generatedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      isFallback: false,
      count: mergedList.length,
      data: mergedList
    };
  } catch (error) {
    console.error('Error fetching TWSE MI_INDEX:', error.message);
    const existing = readExistingSnapshot();
    if (existing) {
      return {
        ...existing,
        success: true,
        source: 'static_fallback',
        generatedAt: new Date().toISOString(),
        timestamp: existing.timestamp || existing.generatedAt || new Date().toISOString(),
        isFallback: true,
        warning: 'TWSE fetch failed. Existing published snapshot was preserved.'
      };
    }
    throw new Error(`TWSE fetch failed and no existing snapshot is available: ${error.message}`);
  }
}

async function run() {
  // 1. 先刷新真實公司資料與基本面（皆有安全回退，不會因失敗中斷）
  await writeCompanyInfo();
  await writeFundamentals();

  // 2. 抓當日行情（此時已能套用 company.json 的真實產業別/股本）
  const result = await fetchTaiwanStockData();
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Successfully generated static stock data at ${outputPath}. Total records: ${result.count}. Source: ${result.source}`);

  // 3. 把當日 K 棒追加進真實歷史序列（依日期去重）
  if (!result.isFallback) {
    const bars = barsFromStockList(result.data);
    const appended = appendDailyBars(historyPath, bars, result.dataDate);
    if (appended) {
      console.log(`history.json updated: ${appended.count} stocks across ${appended.dates.length} trading days.`);
    }
  } else {
    console.log('Skipped history append (fallback snapshot).');
  }

  // 3b. 歷史不足時自動回補（部署環境可連 TWSE；首次部署即補滿，技術面選股才能運作）
  try {
    const hist = readHistory(historyPath);
    if ((hist.dates ? hist.dates.length : 0) < 60) {
      console.log(`History has only ${hist.dates ? hist.dates.length : 0} day(s); running auto-backfill...`);
      await backfillHistory(130);
    }
  } catch (err) {
    console.warn('Auto-backfill skipped:', err.message);
  }

  // 4. 籌碼面
  await writeChipDataSnapshot(result.dataDate);
}

run();
