import fs from 'fs';
import path from 'path';

const publicApiDir = path.join(process.cwd(), 'public', 'api');
const minStockRows = parseInt(process.env.MIN_STOCK_ROWS || '1000', 10);
const minHistoryDays = parseInt(process.env.MIN_HISTORY_DAYS || '60', 10);
const maxStockDataAgeDays = parseInt(process.env.MAX_STOCK_DATA_AGE_DAYS || '10', 10);

function readJson(fileName) {
  const filePath = path.join(publicApiDir, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`${fileName} is missing`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function daysBetween(dateText, now = new Date()) {
  const parsed = new Date(`${dateText}T12:00:00+08:00`);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - parsed.getTime()) / 86400000);
}

function validateStocks() {
  const payload = readJson('stocks.json');
  assert(payload.success, 'stocks.json success=false');
  assert(!payload.isFallback, 'stocks.json was generated from fallback data');
  assert(payload.source === 'twse_mi_index', `stocks.json unexpected source: ${payload.source}`);
  assert(payload.dataDate, 'stocks.json missing dataDate');
  assert(daysBetween(payload.dataDate) <= maxStockDataAgeDays, `stocks.json dataDate is stale: ${payload.dataDate}`);
  assert(Array.isArray(payload.data), 'stocks.json data is not an array');
  assert(payload.data.length >= minStockRows, `stocks.json has too few rows: ${payload.data.length}`);

  const tsmc = payload.data.find((stock) => stock.Code === '2330');
  assert(tsmc, 'stocks.json missing 2330');
  assert(Number.parseFloat(tsmc.ClosingPrice) > 0, '2330 closing price is invalid');
  assert(Number.parseFloat(tsmc.TradeVolume) > 0, '2330 trade volume is invalid');

  return payload;
}

function validateHistory(stocksDate) {
  const payload = readJson('history.json');
  assert(payload.success, 'history.json success=false');
  assert(payload.source === 'twse_mi_index_history', `history.json unexpected source: ${payload.source}`);
  assert(payload.dataDate === stocksDate, `history.json dataDate ${payload.dataDate} does not match stocks ${stocksDate}`);
  assert(Array.isArray(payload.dates), 'history.json dates is not an array');
  assert(payload.dates.length >= minHistoryDays, `history.json has too few dates: ${payload.dates.length}`);
  assert(payload.dates.includes(stocksDate), `history.json missing stocks dataDate ${stocksDate}`);

  const tsmc = payload.data && payload.data['2330'];
  assert(Array.isArray(tsmc) && tsmc.length >= minHistoryDays, 'history.json missing enough 2330 bars');
  const lastBar = tsmc[tsmc.length - 1];
  assert(lastBar && lastBar.d === stocksDate, `2330 latest history bar is not ${stocksDate}`);

  return payload;
}

function validateChip(stocksDate) {
  const payload = readJson('chip.json');
  assert(payload.success, 'chip.json success=false');
  assert(payload.source === 'tdcc_shareholding_twse_t86' || payload.source === 'static_chip_fallback', `chip.json unexpected source: ${payload.source}`);
  assert(!payload.isFallback, 'chip.json was generated from fallback data');
  assert(payload.data && typeof payload.data === 'object', 'chip.json data is invalid');
  assert(payload.data['2330'], 'chip.json missing 2330');
  assert(payload.institutional && Array.isArray(payload.institutional.dates), 'chip.json missing institutional dates');
  assert(payload.institutional.dates.length > 0, 'chip.json institutional dates is empty');
  const latestInstitutionalDate = payload.institutional.dates[payload.institutional.dates.length - 1];
  assert(daysBetween(latestInstitutionalDate) <= 7, `chip.json institutional data is stale: ${latestInstitutionalDate}`);

  return payload;
}

function validateFundamentals() {
  const payload = readJson('fundamentals.json');
  assert(payload.success, 'fundamentals.json success=false');
  assert(payload.source === 'twse_t187ap05_L', `fundamentals.json unexpected source: ${payload.source}`);
  assert(payload.dataMonth, 'fundamentals.json missing dataMonth');
  assert(payload.data && typeof payload.data === 'object', 'fundamentals.json data is invalid');
  assert(payload.data['2330'], 'fundamentals.json missing 2330');

  return payload;
}

function validateCompany() {
  const payload = readJson('company.json');
  assert(payload.success, 'company.json success=false');
  assert(payload.source === 'twse_t187ap03_L', `company.json unexpected source: ${payload.source}`);
  assert(payload.data && typeof payload.data === 'object', 'company.json data is invalid');
  assert(payload.data['2330'], 'company.json missing 2330');

  return payload;
}

function validateUsIndices() {
  const payload = readJson('us-indices.json');
  assert(payload.success, 'us-indices.json success=false');
  assert(payload.source === 'yahoo_chart', `us-indices.json unexpected source: ${payload.source}`);
  assert(!payload.isFallback, 'us-indices.json was generated from fallback data');
  assert(payload.dataDate, 'us-indices.json missing dataDate');
  assert(daysBetween(payload.dataDate) <= 10, `us-indices.json dataDate is stale: ${payload.dataDate}`);
  assert(Array.isArray(payload.data) && payload.data.length === 4, 'us-indices.json must contain four indices');

  const required = new Set(['^DJI', '^GSPC', '^IXIC', '^SOX']);
  for (const item of payload.data) {
    assert(required.has(item.symbol), `us-indices.json unexpected symbol: ${item.symbol}`);
    assert(Number.isFinite(Number(item.value)) && Number(item.value) > 0, `${item.symbol} value is invalid`);
    assert(Number.isFinite(Number(item.change)), `${item.symbol} change is invalid`);
    assert(Number.isFinite(Number(item.changeRate)), `${item.symbol} changeRate is invalid`);
    required.delete(item.symbol);
  }
  assert(required.size === 0, `us-indices.json missing symbols: ${Array.from(required).join(', ')}`);

  return payload;
}

try {
  const stocks = validateStocks();
  const history = validateHistory(stocks.dataDate);
  const chip = validateChip(stocks.dataDate);
  const fundamentals = validateFundamentals();
  const company = validateCompany();
  const usIndices = validateUsIndices();

  console.log(JSON.stringify({
    ok: true,
    stocks: {
      source: stocks.source,
      dataDate: stocks.dataDate,
      generatedAt: stocks.generatedAt,
      count: stocks.data.length
    },
    history: {
      source: history.source,
      dataDate: history.dataDate,
      generatedAt: history.generatedAt,
      dates: history.dates.length,
      count: history.count
    },
    chip: {
      source: chip.source,
      generatedAt: chip.generatedAt,
      shareholdingDate: chip.shareholding?.dataDate || '',
      institutionalDates: chip.institutional?.dates || []
    },
    fundamentals: {
      source: fundamentals.source,
      generatedAt: fundamentals.generatedAt,
      dataMonth: fundamentals.dataMonth,
      count: fundamentals.count
    },
    company: {
      source: company.source,
      generatedAt: company.generatedAt,
      count: company.count
    },
    usIndices: {
      source: usIndices.source,
      generatedAt: usIndices.generatedAt,
      dataDate: usIndices.dataDate,
      count: usIndices.count
    }
  }, null, 2));
} catch (error) {
  console.error(`Data validation failed: ${error.message}`);
  process.exit(1);
}
