import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'config', 'market-calendars.json');

function readConfig(configPath = DEFAULT_CONFIG_PATH) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const hour = map.hour === '24' ? 0 : Number(map.hour);
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    weekday: map.weekday,
    minutes: hour * 60 + Number(map.minute)
  };
}

function parseMinutes(value) {
  const [hour, minute] = String(value).split(':').map(Number);
  return hour * 60 + minute;
}

function getMarketState(key, market, now, forceMarkets = []) {
  const local = getZonedParts(now, market.timeZone);
  const isWeekend = local.weekday === 'Sat' || local.weekday === 'Sun';
  const holidays = new Set(market.holidays || []);
  const earlyCloses = market.earlyCloses || {};
  const closeTime = earlyCloses[local.date] || market.regularClose;
  const openMinutes = parseMinutes(market.regularOpen);
  const closeMinutes = parseMinutes(closeTime);
  const forced = forceMarkets.includes(key) || forceMarkets.includes('all');

  let reason = 'open';
  let isOpen = local.minutes >= openMinutes && local.minutes <= closeMinutes;

  if (isWeekend) {
    isOpen = false;
    reason = 'weekend';
  } else if (holidays.has(local.date)) {
    isOpen = false;
    reason = 'holiday';
  } else if (local.minutes < openMinutes) {
    isOpen = false;
    reason = 'before_open';
  } else if (local.minutes > closeMinutes) {
    isOpen = false;
    reason = 'after_close';
  }

  if (forced) {
    isOpen = true;
    reason = 'forced';
  }

  return {
    key,
    isOpen,
    reason,
    localDate: local.date,
    timeZone: market.timeZone,
    open: market.regularOpen,
    close: closeTime,
    pollMs: market.pollMs
  };
}

export function getMarketStatus(now = new Date(), options = {}) {
  const config = options.config || readConfig(options.configPath);
  const forceMarkets = String(options.forceMarkets || process.env.STOCK_PICKER_FORCE_MARKETS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  const markets = {
    taiwan: getMarketState('taiwan', config.taiwan, now, forceMarkets),
    us: getMarketState('us', config.us, now, forceMarkets)
  };
  const openMarkets = Object.values(markets).filter(market => market.isOpen);

  return {
    generatedAt: now.toISOString(),
    anyMarketOpen: openMarkets.length > 0,
    nextPollMs: openMarkets.length
      ? Math.min(...openMarkets.map(market => market.pollMs || 60000))
      : 300000,
    markets
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(getMarketStatus(), null, 2));
}
