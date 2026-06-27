import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchTaiwanStockData } from './twse-data.js';
import { fetchUsIndicesSnapshot } from './generate-us-indices.js';
import { getMarketStatus } from './market-clock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoDir = path.join(__dirname, '..');
const repoApiDir = path.join(repoDir, 'public', 'api');
const webDir = process.env.STOCK_PICKER_WEB_DIR || '/share/Projects/saas/apps/stock-picker-web';
const webApiDir = path.join(webDir, 'api');
const closedPollMs = parseInt(process.env.STOCK_PICKER_CLOSED_POLL_MS || '300000', 10);
const once = process.env.STOCK_PICKER_LIVE_ONCE === '1';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJsonAtomic(filePath, payload) {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function publishApiFile(fileName, payload) {
  writeJsonAtomic(path.join(repoApiDir, fileName), payload);
  writeJsonAtomic(path.join(webApiDir, fileName), payload);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateOnce() {
  const status = getMarketStatus();
  publishApiFile('market-status.json', status);

  console.log(`[${new Date().toISOString()}] market status: TW=${status.markets.taiwan.reason}, US=${status.markets.us.reason}`);

  if (status.markets.taiwan.isOpen) {
    const stocks = await fetchTaiwanStockData();
    if (!stocks.success || stocks.isFallback) {
      throw new Error(`Taiwan live stock update rejected: ${stocks.source || 'unknown'}`);
    }
    publishApiFile('stocks.json', stocks);
    console.log(`[${new Date().toISOString()}] stocks.json updated: ${stocks.count} rows, source=${stocks.source}, realtime=${stocks.realtimeCount || 0}`);
  }

  if (status.markets.us.isOpen) {
    const usIndices = await fetchUsIndicesSnapshot();
    if (!usIndices.success || usIndices.isFallback) {
      throw new Error(`US indices update rejected: ${usIndices.source || 'unknown'}`);
    }
    publishApiFile('us-indices.json', usIndices);
    console.log(`[${new Date().toISOString()}] us-indices.json updated: ${usIndices.dataDate}`);
  }

  return status;
}

async function run() {
  if (!webDir || webDir === '/') {
    throw new Error(`Refusing unsafe STOCK_PICKER_WEB_DIR: ${webDir}`);
  }

  ensureDir(repoApiDir);
  ensureDir(webApiDir);

  do {
    let waitMs = closedPollMs;
    try {
      const status = await updateOnce();
      waitMs = status.anyMarketOpen ? status.nextPollMs : closedPollMs;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] live update failed: ${error.message}`);
      waitMs = 60000;
    }

    if (!once) await sleep(waitMs);
  } while (!once);
}

run();
