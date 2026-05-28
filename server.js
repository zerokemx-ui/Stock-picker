import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchRealtimeStocks, fetchTaiwanStockData } from './scripts/twse-data.js';

const app = express();
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

let cachedStocksData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 4 * 60 * 60 * 1000;

app.get('/api/stocks', async (req, res) => {
  const now = Date.now();

  if (cachedStocksData && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION) {
    return res.json({
      ...cachedStocksData,
      source: `${cachedStocksData.source}_cache`,
      timestamp: new Date(cacheTimestamp).toISOString()
    });
  }

  const result = await fetchTaiwanStockData();
  cachedStocksData = result;
  cacheTimestamp = now;

  res.json(result);
});

app.post('/api/stocks/refresh', async (req, res) => {
  const result = await fetchTaiwanStockData();
  cachedStocksData = result;
  cacheTimestamp = Date.now();

  res.json(result);
});

app.get('/api/stocks/realtime', async (req, res) => {
  const result = await fetchRealtimeStocks(req.query.codes);
  res.json(result);
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Vite build assets not found. Run npm run dev in development mode.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Backend Express server proxy running on http://localhost:${PORT}`);
});
