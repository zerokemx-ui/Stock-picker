import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Disable TLS verification warnings/errors for governmental APIs that might have cert chain issues in certain Node environments
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// In-memory cache for stock data
let cachedStocksData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

// High-fidelity fallback mock data representing 60+ major Taiwan Stocks (used if TWSE API fails or we are offline)
const fallbackMockStocks = [
  // Semiconductor
  { Code: "2330", Name: "台積電", ClosingPrice: "835.00", Change: "15.00", TradeVolume: "28450122", TradeValue: "23755851870", PEratio: "28.5", DividendYield: "1.68", PBratio: "6.2", Category: "半導體", OpeningPrice: "820.00", HighestPrice: "840.00", LowestPrice: "820.00", Transaction: "45120" },
  { Code: "2454", Name: "聯發科", ClosingPrice: "1190.00", Change: "-10.00", TradeVolume: "2451000", TradeValue: "2916690000", PEratio: "18.2", DividendYield: "4.62", PBratio: "3.8", Category: "半導體", OpeningPrice: "1200.00", HighestPrice: "1205.00", LowestPrice: "1185.00", Transaction: "8520" },
  { Code: "2303", Name: "聯電", ClosingPrice: "52.40", Change: "0.60", TradeVolume: "45120300", TradeValue: "2364303720", PEratio: "11.8", DividendYield: "5.73", PBratio: "1.9", Category: "半導體", OpeningPrice: "51.80", HighestPrice: "52.80", LowestPrice: "51.70", Transaction: "12840" },
  { Code: "3711", Name: "日月光投控", ClosingPrice: "154.50", Change: "2.50", TradeVolume: "8124000", TradeValue: "1255158000", PEratio: "15.6", DividendYield: "3.37", PBratio: "2.1", Category: "半導體", OpeningPrice: "152.00", HighestPrice: "155.00", LowestPrice: "151.50", Transaction: "4820" },
  { Code: "2379", Name: "瑞昱", ClosingPrice: "582.00", Change: "12.00", TradeVolume: "1421000", TradeValue: "827022000", PEratio: "22.4", DividendYield: "2.58", PBratio: "4.5", Category: "半導體", OpeningPrice: "570.00", HighestPrice: "585.00", LowestPrice: "568.00", Transaction: "2940" },
  { Code: "3034", Name: "聯詠", ClosingPrice: "595.00", Change: "-5.00", TradeVolume: "1214000", TradeValue: "722330000", PEratio: "15.4", DividendYield: "6.22", PBratio: "4.8", Category: "半導體", OpeningPrice: "600.00", HighestPrice: "602.00", LowestPrice: "591.00", Transaction: "2140" },
  
  // Computer & Peripheral
  { Code: "2317", Name: "鴻海", ClosingPrice: "173.00", Change: "4.50", TradeVolume: "78452000", TradeValue: "13572196000", PEratio: "16.8", DividendYield: "3.12", PBratio: "1.6", Category: "電腦週邊", OpeningPrice: "168.50", HighestPrice: "174.50", LowestPrice: "168.00", Transaction: "32150" },
  { Code: "2382", Name: "廣達", ClosingPrice: "284.50", Change: "9.50", TradeVolume: "24150000", TradeValue: "6870675000", PEratio: "24.2", DividendYield: "3.16", PBratio: "4.2", Category: "電腦週邊", OpeningPrice: "275.00", HighestPrice: "286.00", LowestPrice: "274.50", Transaction: "18500" },
  { Code: "2357", Name: "華碩", ClosingPrice: "485.00", Change: "11.00", TradeVolume: "3120000", TradeValue: "1513200000", PEratio: "21.5", DividendYield: "3.51", PBratio: "2.3", Category: "電腦週邊", OpeningPrice: "474.00", HighestPrice: "488.00", LowestPrice: "473.00", Transaction: "5420" },
  { Code: "3231", Name: "緯創", ClosingPrice: "112.50", Change: "-1.50", TradeVolume: "38450000", TradeValue: "4325625000", PEratio: "26.3", DividendYield: "2.31", PBratio: "2.8", Category: "電腦週邊", OpeningPrice: "114.00", HighestPrice: "114.50", LowestPrice: "111.50", Transaction: "15420" },
  { Code: "2324", Name: "仁寶", ClosingPrice: "37.20", Change: "0.35", TradeVolume: "14210000", TradeValue: "528612000", PEratio: "18.6", DividendYield: "3.76", PBratio: "1.4", Category: "電腦週邊", OpeningPrice: "36.85", HighestPrice: "37.50", LowestPrice: "36.70", Transaction: "6820" },
  { Code: "2395", Name: "研華", ClosingPrice: "392.00", Change: "2.00", TradeVolume: "852000", TradeValue: "333984000", PEratio: "29.8", DividendYield: "2.42", PBratio: "6.5", Category: "電腦週邊", OpeningPrice: "390.00", HighestPrice: "395.00", LowestPrice: "389.00", Transaction: "1120" },
  { Code: "2301", Name: "光寶科", ClosingPrice: "108.50", Change: "-2.00", TradeVolume: "9520000", TradeValue: "1032920000", PEratio: "17.2", DividendYield: "4.15", PBratio: "2.5", Category: "電腦週邊", OpeningPrice: "110.50", HighestPrice: "111.00", LowestPrice: "108.00", Transaction: "5940" },
  { Code: "2356", Name: "英業達", ClosingPrice: "54.80", Change: "1.20", TradeVolume: "21450000", TradeValue: "1175460000", PEratio: "28.1", DividendYield: "2.74", PBratio: "2.2", Category: "電腦週邊", OpeningPrice: "53.60", HighestPrice: "55.20", LowestPrice: "53.50", Transaction: "9820" },

  // Electronic Components & Optoelectronics
  { Code: "3008", Name: "大立光", ClosingPrice: "2210.00", Change: "45.00", TradeVolume: "420000", TradeValue: "928200000", PEratio: "16.5", DividendYield: "2.08", PBratio: "1.9", Category: "光電業", OpeningPrice: "2165.00", HighestPrice: "2225.00", LowestPrice: "2160.00", Transaction: "920" },
  { Code: "2409", Name: "友達", ClosingPrice: "18.15", Change: "-0.15", TradeVolume: "29450000", TradeValue: "534517500", PEratio: "", DividendYield: "0.00", PBratio: "0.78", Category: "光電業", OpeningPrice: "18.30", HighestPrice: "18.45", LowestPrice: "18.10", Transaction: "8520" },
  { Code: "3481", Name: "群創", ClosingPrice: "13.60", Change: "0.10", TradeVolume: "35120000", TradeValue: "477632000", PEratio: "", DividendYield: "0.00", PBratio: "0.58", Category: "光電業", OpeningPrice: "13.50", HighestPrice: "13.75", LowestPrice: "13.45", Transaction: "7430" },
  { Code: "2308", Name: "台達電", ClosingPrice: "328.00", Change: "6.00", TradeVolume: "5120000", TradeValue: "1679360000", PEratio: "24.5", DividendYield: "2.11", PBratio: "4.1", Category: "電子零組件", OpeningPrice: "322.00", HighestPrice: "330.00", LowestPrice: "321.00", Transaction: "6120" },
  { Code: "2327", Name: "國巨", ClosingPrice: "618.00", Change: "14.00", TradeVolume: "1850000", TradeValue: "1143300000", PEratio: "13.8", DividendYield: "3.56", PBratio: "2.1", Category: "電子零組件", OpeningPrice: "604.00", HighestPrice: "621.00", LowestPrice: "604.00", Transaction: "3420" },
  { Code: "3045", Name: "台灣大", ClosingPrice: "103.50", Change: "0.50", TradeVolume: "3410000", TradeValue: "352935000", PEratio: "23.4", DividendYield: "4.15", PBratio: "3.2", Category: "通信網路", OpeningPrice: "103.00", HighestPrice: "104.00", LowestPrice: "102.50", Transaction: "1520" },
  { Code: "4904", Name: "遠傳", ClosingPrice: "82.40", Change: "0.20", TradeVolume: "2980000", TradeValue: "245552000", PEratio: "24.1", DividendYield: "3.94", PBratio: "2.6", Category: "通信網路", OpeningPrice: "82.20", HighestPrice: "82.70", LowestPrice: "82.00", Transaction: "1180" },
  { Code: "2412", Name: "中華電", ClosingPrice: "123.00", Change: "0.50", TradeVolume: "6450000", TradeValue: "793350000", PEratio: "25.8", DividendYield: "3.87", PBratio: "2.4", Category: "通信網路", OpeningPrice: "122.50", HighestPrice: "123.50", LowestPrice: "122.50", Transaction: "2840" },

  // Financials
  { Code: "2881", Name: "富邦金", ClosingPrice: "72.80", Change: "1.20", TradeVolume: "24510000", TradeValue: "1784328000", PEratio: "10.5", DividendYield: "4.12", PBratio: "1.25", Category: "金融保險", OpeningPrice: "71.60", HighestPrice: "73.20", LowestPrice: "71.60", Transaction: "8520" },
  { Code: "2882", Name: "國泰金", ClosingPrice: "54.20", Change: "0.80", TradeVolume: "28120000", TradeValue: "1524104000", PEratio: "11.2", DividendYield: "3.69", PBratio: "1.05", Category: "金融保險", OpeningPrice: "53.40", HighestPrice: "54.50", LowestPrice: "53.30", Transaction: "9210" },
  { Code: "2886", Name: "兆豐金", ClosingPrice: "39.80", Change: "-0.15", TradeVolume: "18420000", TradeValue: "733116000", PEratio: "16.4", DividendYield: "4.27", PBratio: "1.52", Category: "金融保險", OpeningPrice: "40.00", HighestPrice: "40.10", LowestPrice: "39.75", Transaction: "5420" },
  { Code: "2891", Name: "中信金", ClosingPrice: "34.15", Change: "0.55", TradeVolume: "42150000", TradeValue: "1439422500", PEratio: "9.8", DividendYield: "5.27", PBratio: "1.32", Category: "金融保險", OpeningPrice: "33.60", HighestPrice: "34.30", LowestPrice: "33.55", Transaction: "11430" },
  { Code: "2884", Name: "玉山金", ClosingPrice: "27.85", Change: "0.20", TradeVolume: "21450000", TradeValue: "597382500", PEratio: "15.2", DividendYield: "4.31", PBratio: "1.45", Category: "金融保險", OpeningPrice: "27.65", HighestPrice: "27.95", LowestPrice: "27.60", Transaction: "5820" },
  { Code: "2892", Name: "第一金", ClosingPrice: "27.90", Change: "0.10", TradeVolume: "15200000", TradeValue: "424080000", PEratio: "15.1", DividendYield: "4.12", PBratio: "1.38", Category: "金融保險", OpeningPrice: "27.80", HighestPrice: "28.00", LowestPrice: "27.75", Transaction: "4120" },
  { Code: "2880", Name: "華南金", ClosingPrice: "25.30", Change: "0.15", TradeVolume: "11240000", TradeValue: "284372000", PEratio: "14.8", DividendYield: "4.74", PBratio: "1.28", Category: "金融保險", OpeningPrice: "25.15", HighestPrice: "25.40", LowestPrice: "25.10", Transaction: "3210" },
  { Code: "2885", Name: "元大金", ClosingPrice: "31.25", Change: "0.45", TradeVolume: "16820000", TradeValue: "525625000", PEratio: "13.2", DividendYield: "4.80", PBratio: "1.35", Category: "金融保險", OpeningPrice: "30.80", HighestPrice: "31.40", LowestPrice: "30.80", Transaction: "4920" },
  { Code: "2883", Name: "開發金", ClosingPrice: "14.35", Change: "0.15", TradeVolume: "38920000", TradeValue: "558492000", PEratio: "12.8", DividendYield: "4.18", PBratio: "0.98", Category: "金融保險", OpeningPrice: "14.20", HighestPrice: "14.45", LowestPrice: "14.20", Transaction: "6850" },
  { Code: "2887", Name: "台新金", ClosingPrice: "18.40", Change: "0.10", TradeVolume: "16420000", TradeValue: "302128000", PEratio: "12.5", DividendYield: "5.10", PBratio: "1.12", Category: "金融保險", OpeningPrice: "18.30", HighestPrice: "18.45", LowestPrice: "18.25", Transaction: "3820" },
  { Code: "2890", Name: "永豐金", ClosingPrice: "22.85", Change: "0.25", TradeVolume: "14120000", TradeValue: "322642000", PEratio: "13.6", DividendYield: "4.38", PBratio: "1.31", Category: "金融保險", OpeningPrice: "22.60", HighestPrice: "22.95", LowestPrice: "22.55", Transaction: "4110" },
  { Code: "5880", Name: "合庫金", ClosingPrice: "26.15", Change: "0.05", TradeVolume: "10850000", TradeValue: "283727500", PEratio: "17.4", DividendYield: "3.82", PBratio: "1.42", Category: "金融保險", OpeningPrice: "26.10", HighestPrice: "26.25", LowestPrice: "26.05", Transaction: "3150" },
  { Code: "2888", Name: "新光金", ClosingPrice: "9.12", Change: "-0.08", TradeVolume: "84120000", TradeValue: "767174400", PEratio: "", DividendYield: "0.00", PBratio: "0.72", Category: "金融保險", OpeningPrice: "9.20", HighestPrice: "9.25", LowestPrice: "9.08", Transaction: "9820" },

  // Shipping & Transport
  { Code: "2603", Name: "長榮", ClosingPrice: "192.50", Change: "8.50", TradeVolume: "18450000", TradeValue: "3551625000", PEratio: "6.8", DividendYield: "8.31", PBratio: "1.48", Category: "航運業", OpeningPrice: "184.00", HighestPrice: "194.50", LowestPrice: "183.50", Transaction: "15420" },
  { Code: "2609", Name: "陽明", ClosingPrice: "72.40", Change: "3.20", TradeVolume: "34120000", TradeValue: "2470288000", PEratio: "8.5", DividendYield: "7.15", PBratio: "1.12", Category: "航運業", OpeningPrice: "69.20", HighestPrice: "73.50", LowestPrice: "69.00", Transaction: "24800" },
  { Code: "2615", Name: "萬海", ClosingPrice: "75.80", Change: "4.10", TradeVolume: "21400000", TradeValue: "1622120000", PEratio: "14.5", DividendYield: "5.82", PBratio: "1.22", Category: "航運業", OpeningPrice: "71.70", HighestPrice: "76.40", LowestPrice: "71.50", Transaction: "18500" },
  { Code: "2618", Name: "長榮航", ClosingPrice: "36.45", Change: "-0.35", TradeVolume: "42150000", TradeValue: "1536367500", PEratio: "9.2", DividendYield: "4.94", PBratio: "1.85", Category: "航運業", OpeningPrice: "36.80", HighestPrice: "36.95", LowestPrice: "36.20", Transaction: "14210" },
  { Code: "2610", Name: "華航", ClosingPrice: "22.85", Change: "-0.15", TradeVolume: "29410000", TradeValue: "672018500", PEratio: "10.4", DividendYield: "4.12", PBratio: "1.41", Category: "航運業", OpeningPrice: "23.00", HighestPrice: "23.10", LowestPrice: "22.75", Transaction: "9510" },

  // Steel, Plastic, Cement & Others
  { Code: "2002", Name: "中鋼", ClosingPrice: "24.15", Change: "0.10", TradeVolume: "15820000", TradeValue: "382053000", PEratio: "38.2", DividendYield: "2.85", PBratio: "1.18", Category: "鋼鐵工業", OpeningPrice: "24.05", HighestPrice: "24.25", LowestPrice: "24.00", Transaction: "4820" },
  { Code: "1301", Name: "台塑", ClosingPrice: "68.20", Change: "-0.50", TradeVolume: "5420000", TradeValue: "369644000", PEratio: "22.5", DividendYield: "3.52", PBratio: "1.22", Category: "塑膠工業", OpeningPrice: "68.70", HighestPrice: "69.00", LowestPrice: "68.00", Transaction: "2840" },
  { Code: "1303", Name: "南亞", ClosingPrice: "56.40", Change: "-0.30", TradeVolume: "4920000", TradeValue: "277488000", PEratio: "19.8", DividendYield: "3.90", PBratio: "1.15", Category: "塑膠工業", OpeningPrice: "56.70", HighestPrice: "56.90", LowestPrice: "56.20", Transaction: "2520" },
  { Code: "1326", Name: "台化", ClosingPrice: "55.80", Change: "-0.20", TradeVolume: "3850000", TradeValue: "214830000", PEratio: "20.1", DividendYield: "3.80", PBratio: "1.08", Category: "塑膠工業", OpeningPrice: "56.00", HighestPrice: "56.20", LowestPrice: "55.60", Transaction: "1850" },
  { Code: "1101", Name: "台泥", ClosingPrice: "34.60", Change: "0.15", TradeVolume: "14850000", TradeValue: "513810000", PEratio: "21.2", DividendYield: "3.31", PBratio: "0.77", Category: "水泥工業", OpeningPrice: "34.45", HighestPrice: "34.75", LowestPrice: "34.40", Transaction: "4920" },
  { Code: "1102", Name: "亞泥", ClosingPrice: "42.15", Change: "0.30", TradeVolume: "3840000", TradeValue: "161856000", PEratio: "14.5", DividendYield: "4.86", PBratio: "1.05", Category: "水泥工業", OpeningPrice: "41.85", HighestPrice: "42.25", LowestPrice: "41.80", Transaction: "1840" },
  { Code: "1216", Name: "統一", ClosingPrice: "78.40", Change: "0.90", TradeVolume: "6120000", TradeValue: "479808000", PEratio: "18.5", DividendYield: "3.83", PBratio: "2.85", Category: "食品工業", OpeningPrice: "77.50", HighestPrice: "78.60", LowestPrice: "77.50", Transaction: "3420" },
  { Code: "2201", Name: "裕隆", ClosingPrice: "64.20", Change: "1.10", TradeVolume: "4210000", TradeValue: "270282000", PEratio: "12.8", DividendYield: "4.21", PBratio: "1.15", Category: "汽車工業", OpeningPrice: "63.10", HighestPrice: "64.60", LowestPrice: "63.00", Transaction: "2950" },
  { Code: "2912", Name: "統一超", ClosingPrice: "275.50", Change: "1.50", TradeVolume: "850000", TradeValue: "234175000", PEratio: "26.4", DividendYield: "3.27", PBratio: "7.1", Category: "百貨貿易", OpeningPrice: "274.00", HighestPrice: "276.50", LowestPrice: "273.50", Transaction: "1210" },
  { Code: "9904", Name: "寶成", ClosingPrice: "36.80", Change: "0.45", TradeVolume: "3840000", TradeValue: "141312000", PEratio: "11.2", DividendYield: "5.43", PBratio: "0.92", Category: "其他", OpeningPrice: "36.35", HighestPrice: "36.95", LowestPrice: "36.30", Transaction: "1920" }
];

// Helper to determine standard category based on stock code range (used when category is not returned by the API)
function getCategoryByCode(code) {
  if (code.startsWith('2330') || code.startsWith('2454') || code.startsWith('2303') || code.startsWith('3711') || code.startsWith('2379') || code.startsWith('3034')) {
    return '半導體';
  }
  if (code.startsWith('2317') || code.startsWith('2382') || code.startsWith('2357') || code.startsWith('3231') || code.startsWith('2324') || code.startsWith('2395') || code.startsWith('2301') || code.startsWith('2356')) {
    return '電腦週邊';
  }
  if (code.startsWith('28') || code.startsWith('58')) {
    return '金融保險';
  }
  if (code.startsWith('26')) {
    return '航運業';
  }
  if (code.startsWith('11')) {
    return '水泥工業';
  }
  if (code.startsWith('13')) {
    return '塑膠工業';
  }
  if (code.startsWith('20')) {
    return '鋼鐵工業';
  }
  if (code.startsWith('12')) {
    return '食品工業';
  }
  if (code.startsWith('24') || code.startsWith('30') || code.startsWith('34') || code.startsWith('37') || code.startsWith('49')) {
    // General Electronics/Opto/Comms
    if (code.startsWith('2409') || code.startsWith('3481') || code.startsWith('3008')) return '光電業';
    if (code.startsWith('2412') || code.startsWith('3045') || code.startsWith('4904')) return '通信網路';
    return '電子零組件';
  }
  return '其他';
}

// Function to fetch and merge data from Taiwan Stock Exchange
async function fetchTaiwanStockData() {
  console.log('Attempting to fetch latest data from TWSE OpenAPI...');
  try {
    // 1. Fetch STOCK_DAY_ALL (Price, Volume, Change)
    const stockDayRes = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
    if (!stockDayRes.ok) throw new Error(`STOCK_DAY_ALL fetch failed with status ${stockDayRes.status}`);
    const stockDayData = await stockDayRes.json();
    
    // 2. Fetch BWIBBU_ALL (PE, PB, Dividend Yield)
    const bwibbuRes = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL');
    if (!bwibbuRes.ok) throw new Error(`BWIBBU_ALL fetch failed with status ${bwibbuRes.status}`);
    const bwibbuData = await bwibbuRes.json();
    
    console.log(`Successfully fetched from TWSE. STOCK_DAY_ALL: ${stockDayData.length} records. BWIBBU_ALL: ${bwibbuData.length} records.`);
    
    // Map BWIBBU data for O(1) lookup during merge
    const bwibbuMap = new Map();
    for (const item of bwibbuData) {
      bwibbuMap.set(item.Code, item);
    }
    
    // Merge datasets
    const mergedList = [];
    for (const dayItem of stockDayData) {
      // Basic validation
      if (!dayItem.Code || !dayItem.Name) continue;
      
      // Skip options, warrants or specific index trackers unless they look like normal stocks/ETFs
      // Normal stock codes are 4-6 chars. Filter out extremely long codes (warrants usually have 6+ digits and letters)
      if (dayItem.Code.length > 6) continue;
      
      const bItem = bwibbuMap.get(dayItem.Code);
      
      // Parse numbers cleanly
      const closingPrice = parseFloat(dayItem.ClosingPrice) || 0;
      const change = parseFloat(dayItem.Change) || 0;
      const tradeVolume = parseInt(dayItem.TradeVolume) || 0;
      const tradeValue = parseInt(dayItem.TradeValue) || 0;
      const transaction = parseInt(dayItem.Transaction) || 0;
      
      const pe = bItem && bItem.PEratio !== '' && bItem.PEratio !== undefined ? parseFloat(bItem.PEratio) : null;
      const yieldPct = bItem && bItem.DividendYield !== '' && bItem.DividendYield !== undefined ? parseFloat(bItem.DividendYield) : 0;
      const pb = bItem && bItem.PBratio !== '' && bItem.PBratio !== undefined ? parseFloat(bItem.PBratio) : null;
      
      mergedList.push({
        Code: dayItem.Code,
        Name: dayItem.Name,
        ClosingPrice: closingPrice.toFixed(2),
        OpeningPrice: (parseFloat(dayItem.OpeningPrice) || closingPrice).toFixed(2),
        HighestPrice: (parseFloat(dayItem.HighestPrice) || closingPrice).toFixed(2),
        LowestPrice: (parseFloat(dayItem.LowestPrice) || closingPrice).toFixed(2),
        Change: change.toFixed(2),
        TradeVolume: tradeVolume.toString(),
        TradeValue: tradeValue.toString(),
        Transaction: transaction.toString(),
        PEratio: pe !== null ? pe.toFixed(2) : '',
        DividendYield: yieldPct.toFixed(2),
        PBratio: pb !== null ? pb.toFixed(2) : '',
        Category: getCategoryByCode(dayItem.Code)
      });
    }
    
    // Sort primarily by TradeValue descending (most active first)
    mergedList.sort((a, b) => parseFloat(b.TradeValue) - parseFloat(a.TradeValue));
    
    return mergedList;
  } catch (error) {
    console.error('Error fetching live TWSE data, falling back to high-fidelity mock data:', error.message);
    return fallbackMockStocks;
  }
}

// Endpoints
app.get('/api/stocks', async (req, res) => {
  const now = Date.now();
  
  // Use cached data if valid
  if (cachedStocksData && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    console.log('Serving stock data from cache...');
    return res.json({
      success: true,
      source: 'cache',
      timestamp: new Date(cacheTimestamp).toISOString(),
      count: cachedStocksData.length,
      data: cachedStocksData
    });
  }
  
  // Fetch fresh data
  const data = await fetchTaiwanStockData();
  cachedStocksData = data;
  cacheTimestamp = now;
  
  res.json({
    success: true,
    source: data === fallbackMockStocks ? 'fallback_mock' : 'twse_api',
    timestamp: new Date(now).toISOString(),
    count: data.length,
    data: data
  });
});

// Force refresh endpoint
app.post('/api/stocks/refresh', async (req, res) => {
  const now = Date.now();
  const data = await fetchTaiwanStockData();
  cachedStocksData = data;
  cacheTimestamp = now;
  
  res.json({
    success: true,
    source: data === fallbackMockStocks ? 'fallback_mock' : 'twse_api',
  res.json({
    success: true,
    source: data === fallbackMockStocks ? 'fallback_mock' : 'twse_api',
    timestamp: new Date(now).toISOString(),
    count: data.length,
    data: data
  });
});

// 獲取 TWSE MIS 即時行情交易資訊 API (自動處理 Session Cookie 握手)
async function getTWSERealtimeData(codesString) {
  if (!codesString) return { success: false, error: '未提供股票代號' };
  
  const codes = codesString.split(',').map(c => c.trim()).filter(Boolean);
  if (codes.length === 0) return { success: false, error: '無效的股票代號' };
  
  // 將代號格式化為 tse_XXXX.tw 格式 (本資料庫皆為上市櫃主要股票)
  const exChList = codes.map(code => `tse_${code}.tw`).join('|');
  
  try {
    // 1. 先請求 fibest.jsp 以取得合法的 Session Cookie
    const initialRes = await fetch('https://mis.twse.com.tw/stock/fibest.jsp?lang=zh_tw', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    let cookie = '';
    const setCookie = initialRes.headers.getSetCookie 
      ? initialRes.headers.getSetCookie() 
      : (initialRes.headers.get('set-cookie') ? [initialRes.headers.get('set-cookie')] : []);
    
    if (setCookie && setCookie.length > 0) {
      cookie = setCookie.map(c => c.split(';')[0]).join('; ');
    }
    
    // 2. 帶上 Cookie 請求真正的即時報價 API
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${exChList}&json=1&delay=0`;
    const res = await fetch(url, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://mis.twse.com.tw/stock/fibest.jsp?lang=zh_tw'
      }
    });
    
    if (!res.ok) throw new Error(`TWSE MIS API 響應錯誤: ${res.status}`);
    const json = await res.json();
    
    if (!json || !Array.isArray(json.msgArray) || json.msgArray.length === 0) {
      return { success: false, error: '證交所即時 API 未回傳有效數據，可能非交易時間或代號有誤' };
    }
    
    // 3. 欄位映射與邏輯處理
    const formattedData = json.msgArray.map(item => {
      const yesterdayClose = parseFloat(item.y) || 0;
      
      // z 為當前撮合價，若尚未成交則嘗試取第一檔買入價 b 或賣出價 a，或開盤價，或昨收價
      let livePrice = parseFloat(item.z);
      if (isNaN(livePrice) || livePrice <= 0) {
        if (item.b) {
          const bids = item.b.split('_').map(parseFloat).filter(Boolean);
          if (bids.length > 0) livePrice = bids[0];
        }
      }
      if (isNaN(livePrice) || livePrice <= 0) {
        if (item.a) {
          const asks = item.a.split('_').map(parseFloat).filter(Boolean);
          if (asks.length > 0) livePrice = asks[0];
        }
      }
      if (isNaN(livePrice) || livePrice <= 0) {
        livePrice = parseFloat(item.o) || yesterdayClose;
      }
      
      const changeVal = livePrice - yesterdayClose;
      const changePct = yesterdayClose > 0 ? (changeVal / yesterdayClose * 100) : 0;
      
      return {
        Code: item.c,
        Name: item.n,
        ClosingPrice: livePrice.toFixed(2),
        OpeningPrice: (parseFloat(item.o) || yesterdayClose).toFixed(2),
        HighestPrice: (parseFloat(item.h) || livePrice).toFixed(2),
        LowestPrice: (parseFloat(item.l) || livePrice).toFixed(2),
        Change: changeVal.toFixed(2),
        ChangePercent: changePct.toFixed(2),
        TradeVolume: (parseInt(item.v) || 0).toString(), // 累積成交量 (張)
        LimitUp: item.u ? parseFloat(item.u).toFixed(2) : '', // 漲停限制價
        LimitDown: item.w ? parseFloat(item.w).toFixed(2) : '', // 跌停限制價
        Time: item.t || '', // 最後撮合時間 (e.g. 13:30:00)
        Source: 'twse_mis_live'
      };
    });
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: formattedData
    };
  } catch (error) {
    console.error('後端即時行情請求錯誤:', error.message);
    return { success: false, error: error.message };
  }
}

// 即時行情代理路由
app.get('/api/stocks/realtime', async (req, res) => {
  const codes = req.query.codes;
  if (!codes) {
    return res.status(400).json({ success: false, error: '缺少必填參數 codes (以逗號分隔)' });
  }
  
  const result = await getTWSERealtimeData(codes);
  if (result.success) {
    res.json(result);
  } else {
    // 即使失敗也回傳 200 並帶上 success: false，方便前端進行優雅降級
    res.json(result);
  }
});

// Serve frontend in production (after npm run build)

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  // If the request starts with /api, pass it to next handlers (which will fail/404 if not found)
  if (req.path.startsWith('/api')) {
    return next();
  }
  // Otherwise serve React index.html in production if it exists
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Vite build assets not found. Run npm run dev in development mode.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Backend Express server proxy running on http://localhost:${PORT}`);
});
