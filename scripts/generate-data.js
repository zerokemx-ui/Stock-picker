import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchTaiwanStockData } from './twse-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicApiDir = path.join(__dirname, '..', 'public', 'api');
const outputPath = path.join(publicApiDir, 'stocks.json');

if (!fs.existsSync(publicApiDir)) {
  fs.mkdirSync(publicApiDir, { recursive: true });
}

const result = await fetchTaiwanStockData();
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

console.log(
  `Successfully generated static stock data at ${outputPath}. ` +
  `Total records: ${result.count}. Source: ${result.source}. Realtime rows: ${result.realtimeCount || 0}.`
);
