import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  fetchTaiwanStockData,
  fetchRealtimeStocks
} from './scripts/twse-data.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

let cachedStocksResult = null;
let cacheTimestamp = null;
const CACHE_DURATION = 4 * 60 * 60 * 1000;

function isFallbackSource(source) {
  return source === 'static_fallback' || source === 'empty_fallback';
}

function normalizeStockResult(result, fallbackTimestamp = new Date().toISOString()) {
  const data = Array.isArray(result.data) ? result.data : [];
  return {
    success: true,
    source: result.source || 'unknown',
    dataDate: result.dataDate || '',
    generatedAt: result.generatedAt || result.timestamp || fallbackTimestamp,
    timestamp: result.timestamp || fallbackTimestamp,
    isFallback: result.isFallback || isFallbackSource(result.source),
    count: data.length,
    realtimeCount: result.realtimeCount || 0,
    warning: result.warning || '',
    data
  };
}

app.get('/api/stocks', async (req, res) => {
  const now = Date.now();

  if (cachedStocksResult && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION) {
    console.log('Serving stock data from cache...');
    return res.json(normalizeStockResult(cachedStocksResult, new Date(cacheTimestamp).toISOString()));
  }

  try {
    const result = await fetchTaiwanStockData();
    cachedStocksResult = result;
    cacheTimestamp = now;
    res.json(normalizeStockResult(result));
  } catch (error) {
    res.status(502).json({
      success: false,
      error: `TWSE 資料同步失敗：${error.message}`
    });
  }
});

app.post('/api/stocks/refresh', async (req, res) => {
  try {
    const result = await fetchTaiwanStockData();
    cachedStocksResult = result;
    cacheTimestamp = Date.now();
    res.json(normalizeStockResult(result));
  } catch (error) {
    res.status(502).json({
      success: false,
      error: `TWSE 資料同步失敗：${error.message}`
    });
  }
});

app.get('/api/stocks/realtime', async (req, res) => {
  const codes = req.query.codes;
  if (!codes) {
    return res.status(400).json({ success: false, error: '缺少必填參數 codes (以逗號分隔)' });
  }

  const result = await fetchRealtimeStocks(codes);
  res.json(result);
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Vite build assets not found. Run npm run dev in development mode.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Backend Express server proxy running on http://localhost:${PORT}`);
});
