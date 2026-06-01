import fs from 'fs';
import path from 'path';

const TDCC_URL = 'https://opendata.tdcc.com.tw/getOD.ashx?id=1-5';
const T86_URL = 'https://www.twse.com.tw/rwd/zh/fund/T86';

const publicApiDir = path.join(process.cwd(), 'public', 'api');
const outputPath = path.join(publicApiDir, 'chip.json');

const gradeLabels = {
  1: '1 股至 999 股',
  2: '1 張至 5 張',
  3: '5 張至 10 張',
  4: '10 張至 15 張',
  5: '15 張至 20 張',
  6: '20 張至 30 張',
  7: '30 張至 40 張',
  8: '40 張至 50 張',
  9: '50 張至 100 張',
  10: '100 張至 200 張',
  11: '200 張至 400 張',
  12: '400 張至 600 張',
  13: '600 張至 800 張',
  14: '800 張至 1000 張',
  15: '1000 張以上',
  16: '差異數調整',
  17: '合計'
};

function parseNumber(value) {
  if (value === undefined || value === null) return 0;
  return Number(String(value).replace(/,/g, '').trim()) || 0;
}

function formatDate(raw) {
  const value = String(raw || '').trim();
  if (!/^\d{8}$/.test(value)) return '';
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function compactDate(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function getRecentWeekdays(baseDateText, days = 5) {
  const base = baseDateText && /^\d{4}-\d{2}-\d{2}$/.test(baseDateText)
    ? new Date(`${baseDateText}T12:00:00+08:00`)
    : new Date();
  const result = [];
  const cursor = new Date(base);
  while (result.length < days && result.length < 10) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) result.push(compactDate(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return result;
}

function readExistingChipSnapshot() {
  if (!fs.existsSync(outputPath)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    if (payload && payload.data && Object.keys(payload.data).length > 0) return payload;
  } catch {
    return null;
  }
  return null;
}

function parseTdccCsv(text) {
  const normalized = text.replace(/^\uFEFF/, '').trim();
  const lines = normalized.split(/\r?\n/).filter(Boolean);
  const byCode = new Map();
  let dataDate = '';

  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    if (cols.length < 6) continue;
    const rawDate = cols[0].trim();
    const code = cols[1].trim();
    const level = parseNumber(cols[2]);
    if (!code || !level) continue;
    if (!dataDate) dataDate = formatDate(rawDate);

    if (!byCode.has(code)) {
      byCode.set(code, {
        code,
        dataDate: formatDate(rawDate),
        source: 'TDCC 集保股權分散表',
        grades: []
      });
    }

    byCode.get(code).grades.push({
      level,
      label: gradeLabels[level] || `級距 ${level}`,
      holders: parseNumber(cols[3]),
      shares: parseNumber(cols[4]),
      percent: parseNumber(cols[5])
    });
  }

  const data = {};
  for (const [code, item] of byCode.entries()) {
    const pick = (levels) => item.grades
      .filter((grade) => levels.includes(grade.level))
      .reduce((sum, grade) => sum + grade.percent, 0);
    const pickHolders = (levels) => item.grades
      .filter((grade) => levels.includes(grade.level))
      .reduce((sum, grade) => sum + grade.holders, 0);
    const totalGrade = item.grades.find((grade) => grade.level === 17);

    const superLargePercent = pick([15]);
    const large400To1000Percent = pick([12, 13, 14]);
    const large400PlusPercent = pick([12, 13, 14, 15]);
    const below400Percent = pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const below100Percent = pick([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    data[code] = {
      code,
      dataDate: item.dataDate,
      source: item.source,
      shareholderBase: totalGrade?.holders || item.grades.reduce((sum, grade) => grade.level !== 17 ? sum + grade.holders : sum, 0),
      totalShares: totalGrade?.shares || 0,
      superLargePercent: Number(superLargePercent.toFixed(2)),
      largePercent: Number(large400To1000Percent.toFixed(2)),
      cumulativeLargePercent: Number(large400PlusPercent.toFixed(2)),
      retailPercent: Number(below400Percent.toFixed(2)),
      below100Percent: Number(below100Percent.toFixed(2)),
      below400Holders: pickHolders([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
      large400PlusHolders: pickHolders([12, 13, 14, 15])
    };
  }

  return { dataDate, data };
}

async function fetchInstitutionalDay(dateText) {
  const url = `${T86_URL}?date=${dateText}&selectType=ALL&response=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`T86 ${dateText} HTTP ${response.status}`);
  const json = await response.json();
  if (json.stat !== 'OK' || !Array.isArray(json.data)) return null;

  const date = formatDate(json.date || dateText);
  const data = {};
  for (const row of json.data) {
    const code = String(row[0] || '').trim();
    if (!/^\d{4}$/.test(code)) continue;
    data[code] = {
      date,
      foreign: Math.round(parseNumber(row[4]) / 1000),
      trust: Math.round(parseNumber(row[10]) / 1000),
      dealer: Math.round(parseNumber(row[11]) / 1000),
      netTotal: Math.round(parseNumber(row[18]) / 1000)
    };
  }

  return { date, data };
}

async function fetchInstitutionalHistory(baseDate) {
  const dates = getRecentWeekdays(baseDate, 5);
  const days = [];

  for (const dateText of dates) {
    try {
      const day = await fetchInstitutionalDay(dateText);
      if (day) days.push(day);
    } catch (error) {
      console.warn(`T86 fetch skipped for ${dateText}: ${error.message}`);
    }
  }

  const byCode = {};
  for (const day of days.reverse()) {
    for (const [code, value] of Object.entries(day.data)) {
      if (!byCode[code]) byCode[code] = [];
      byCode[code].push(value);
    }
  }

  return {
    dates: days.map((day) => day.date),
    data: byCode
  };
}

export async function fetchChipDataSnapshot(baseDate = '') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  try {
    const tdccResponse = await fetch(TDCC_URL);
    if (!tdccResponse.ok) throw new Error(`TDCC HTTP ${tdccResponse.status}`);
    const tdccText = await tdccResponse.text();
    const shareholding = parseTdccCsv(tdccText);
    const institutional = await fetchInstitutionalHistory(baseDate || shareholding.dataDate);

    for (const [code, rows] of Object.entries(institutional.data)) {
      if (shareholding.data[code]) shareholding.data[code].dailyTrades = rows;
    }

    return {
      success: true,
      source: 'tdcc_shareholding_twse_t86',
      generatedAt: new Date().toISOString(),
      shareholding: {
        source: 'TDCC 集保股權分散表',
        url: TDCC_URL,
        dataDate: shareholding.dataDate,
        count: Object.keys(shareholding.data).length
      },
      institutional: {
        source: 'TWSE 三大法人買賣超日報',
        url: T86_URL,
        dates: institutional.dates
      },
      data: shareholding.data
    };
  } catch (error) {
    console.error(`Chip data fetch failed: ${error.message}`);
    const existing = readExistingChipSnapshot();
    if (existing) {
      return {
        ...existing,
        success: true,
        source: 'static_chip_fallback',
        generatedAt: new Date().toISOString(),
        isFallback: true,
        warning: 'Official chip data fetch failed. Existing published chip snapshot was preserved.'
      };
    }
    throw error;
  }
}

export async function writeChipDataSnapshot(baseDate = '') {
  if (!fs.existsSync(publicApiDir)) fs.mkdirSync(publicApiDir, { recursive: true });
  const snapshot = await fetchChipDataSnapshot(baseDate);
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`Successfully generated official chip data at ${outputPath}. Records: ${Object.keys(snapshot.data || {}).length}. Source: ${snapshot.source}`);
  return snapshot;
}
