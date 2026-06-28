import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Database,
  Globe2,
  Layers3,
  RefreshCw,
  Search,
  Settings,
  Star,
  Sun,
  Moon,
  Target,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';
import TradingChart from './components/TradingChart.jsx';
import { calculateChangePercent, checkSOPStrategy, computeIndicators, normalizeBars } from './utils/stockUtils';

const STOCK_DATA_CACHE_KEY = 'tw_stock_last_good_snapshot';

const TABS = [
  { id: 'overview', label: '市場總覽', icon: Globe2 },
  { id: 'selector', label: '選股中心', icon: Target },
  { id: 'stock', label: '個股詳情', icon: BarChart3 },
  { id: 'watchlist', label: '觀察清單', icon: Star },
  { id: 'status', label: '資料狀態', icon: Database }
];

const SECTOR_OPTIONS = ['半導體', '電子零組件', '電腦及週邊', '金融保險', '航運業', '其他'];

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return number.toLocaleString('zh-TW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatCompact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  if (number >= 100000000) return `${(number / 100000000).toFixed(1)} 億`;
  if (number >= 10000) return `${(number / 10000).toFixed(1)} 萬`;
  return number.toLocaleString('zh-TW');
}

function getChange(stock) {
  const change = toNumber(stock?.Change);
  const rate = calculateChangePercent(stock?.ClosingPrice, stock?.Change);
  return { change, rate };
}

function toneClass(value) {
  if (value > 0) return 'is-up';
  if (value < 0) return 'is-down';
  return 'is-flat';
}

function normalizeIndex(item) {
  const change = toNumber(item.change);
  return {
    ...item,
    value: toNumber(item.value),
    change,
    changeRate: toNumber(item.changeRate),
    tone: toneClass(change)
  };
}

function firstValidStock(stocks, preferredCode = '2330') {
  return stocks.find((stock) => stock.Code === preferredCode) || stocks[0] || null;
}

function statFromStocks(stocks) {
  let up = 0;
  let down = 0;
  let flat = 0;
  let tradeValue = 0;

  stocks.forEach((stock) => {
    const change = toNumber(stock.Change);
    if (change > 0) up += 1;
    else if (change < 0) down += 1;
    else flat += 1;
    tradeValue += toNumber(stock.TradeValue);
  });

  return { up, down, flat, tradeValue };
}

function readCache() {
  try {
    const raw = localStorage.getItem(STOCK_DATA_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(payload) {
  try {
    localStorage.setItem(STOCK_DATA_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Local cache is a convenience only.
  }
}

function MarketCard({ item, compact = false }) {
  return (
    <article className={`market-card ${item.tone || ''} ${compact ? 'compact' : ''}`}>
      <div className="market-card__head">
        <div>
          <div className="market-card__name">{item.name}</div>
          <div className="market-card__symbol">{item.symbol || item.enName || item.market}</div>
        </div>
        <span className="market-card__badge">{item.sourceLabel || '即時快照'}</span>
      </div>
      <div className="market-card__value">{formatNumber(item.value)}</div>
      <div className="market-card__change">
        <span>{item.change >= 0 ? '+' : ''}{formatNumber(item.change)}</span>
        <span>{item.changeRate >= 0 ? '+' : ''}{formatNumber(item.changeRate)}%</span>
      </div>
    </article>
  );
}

function StockRow({ stock, active, onClick, action }) {
  const { change, rate } = getChange(stock);
  return (
    <button className={`stock-row ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      <span className="stock-row__id">
        <strong>{stock.Code}</strong>
        <small>{stock.Name}</small>
      </span>
      <span className="stock-row__price">{formatNumber(stock.ClosingPrice)}</span>
      <span className={`stock-row__change ${toneClass(change)}`}>
        {change >= 0 ? '+' : ''}{formatNumber(rate)}%
      </span>
      {action}
    </button>
  );
}

function SectionTitle({ icon: Icon, title, meta }) {
  return (
    <div className="section-title">
      <div>
        <h2><Icon size={18} />{title}</h2>
        {meta && <p>{meta}</p>}
      </div>
    </div>
  );
}

export default function App() {
  const [stocks, setStocks] = useState([]);
  const [historyData, setHistoryData] = useState({});
  const [fundamentalsData, setFundamentalsData] = useState({});
  const [chipData, setChipData] = useState({});
  const [usIndices, setUsIndices] = useState([]);
  const [asiaIndices, setAsiaIndices] = useState([]);
  const [marketStatus, setMarketStatus] = useState(null);
  const [dataStatus, setDataStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(() => {
    const view = new URLSearchParams(window.location.search).get('view');
    return TABS.some((tab) => tab.id === view) ? view : 'overview';
  });
  const [selectedCode, setSelectedCode] = useState(() => new URLSearchParams(window.location.search).get('code') || '');
  const [theme, setTheme] = useState(() => localStorage.getItem('tw_stock_theme') || 'dark');
  const [watchlist, setWatchlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tw_stock_watchlist') || '[]');
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState('');
  const [selectorMode, setSelectorMode] = useState('long');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [maxCapital, setMaxCapital] = useState(80);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tw_stock_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('tw_stock_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  const loadJson = async (url, required = false) => {
    const response = await fetch(`${url}?_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      if (required) throw new Error(`${url} HTTP ${response.status}`);
      return null;
    }
    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
      if (required) throw new Error(`${url} 不是 JSON 快照`);
      return null;
    }
    return JSON.parse(trimmed);
  };

  const fetchStocksData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');

    try {
      const [stockPayload, usPayload, asiaPayload, historyPayload, chipPayload, fundamentalsPayload, statusPayload] = await Promise.all([
        loadJson('./api/stocks.json', true),
        loadJson('./api/us-indices.json'),
        loadJson('./api/asia-indices.json'),
        loadJson('./api/history.json'),
        loadJson('./api/chip.json'),
        loadJson('./api/fundamentals.json'),
        loadJson('./api/market-status.json')
      ]);

      if (!stockPayload?.success || !Array.isArray(stockPayload.data)) {
        throw new Error('stocks.json 格式不正確');
      }

      const historyMap = historyPayload?.data || {};
      const enriched = stockPayload.data.map((stock) => ({
        ...stock,
        Indicators: computeIndicators(historyMap[stock.Code])
      }));

      writeCache(stockPayload);
      setStocks(enriched);
      setHistoryData(historyMap);
      setChipData(chipPayload?.data || {});
      setFundamentalsData(fundamentalsPayload?.data || {});
      setUsIndices(Array.isArray(usPayload?.data) ? usPayload.data.map(normalizeIndex) : []);
      setAsiaIndices(Array.isArray(asiaPayload?.data) ? asiaPayload.data.map(normalizeIndex) : []);
      setMarketStatus(statusPayload || null);
      setDataStatus({
        source: stockPayload.source || '',
        dataDate: stockPayload.dataDate || '',
        generatedAt: stockPayload.generatedAt || stockPayload.timestamp || '',
        isFallback: Boolean(stockPayload.isFallback)
      });
      setSelectedCode((previous) => previous || firstValidStock(enriched)?.Code || '');
    } catch (err) {
      const cached = readCache();
      if (cached?.data?.length) {
        setStocks(cached.data);
        setDataStatus({
          source: cached.source || 'local_cache',
          dataDate: cached.dataDate || '',
          generatedAt: cached.generatedAt || cached.timestamp || '',
          isFallback: true
        });
      }
      setError(err.message || '資料讀取失敗');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocksData();
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer = null;

    const pollLiveSnapshot = async () => {
      if (stopped) return;
      let nextPollMs = 60000;

      try {
        const status = await loadJson('./api/market-status.json');
        nextPollMs = Number(status?.nextPollMs) || nextPollMs;
        setMarketStatus(status || null);
        if (status?.anyMarketOpen) await fetchStocksData(true);
      } catch (err) {
        console.warn('market-status refresh skipped:', err);
      }

      if (!stopped) {
        timer = window.setTimeout(pollLiveSnapshot, Math.max(15000, Math.min(nextPollMs, 300000)));
      }
    };

    timer = window.setTimeout(pollLiveSnapshot, 30000);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const selectedStock = useMemo(() => {
    return stocks.find((stock) => stock.Code === selectedCode) || firstValidStock(stocks);
  }, [stocks, selectedCode]);

  const marketStats = useMemo(() => statFromStocks(stocks), [stocks]);

  const taiwanIndex = useMemo(() => {
    const officialTaiwan = asiaIndices.find((item) => item.symbol === 'TWSE');
    if (officialTaiwan) return { ...officialTaiwan, sourceLabel: 'TWSE 官方' };
    const weighted = stocks.slice(0, 80).reduce((sum, stock) => sum + toNumber(stock.TradeValue) * getChange(stock).rate, 0);
    const totalValue = stocks.slice(0, 80).reduce((sum, stock) => sum + toNumber(stock.TradeValue), 0);
    const proxyRate = totalValue ? weighted / totalValue : 0;
    return {
      name: '台灣大盤',
      symbol: 'TWSE',
      value: null,
      change: proxyRate,
      changeRate: proxyRate,
      tone: toneClass(proxyRate),
      sourceLabel: '上市家數代理'
    };
  }, [stocks, asiaIndices]);

  const visibleAsiaIndices = useMemo(() => {
    const targets = new Set(['^N225', '^KS11']);
    const live = asiaIndices.filter((item) => targets.has(item.symbol)).map((item) => ({ ...item, sourceLabel: 'Yahoo 快照' }));
    if (live.length) return live;
    return [
      { name: '日經 225', symbol: '^N225', value: 0, change: 0, changeRate: 0, tone: 'is-flat', sourceLabel: '待接資料' },
      { name: '韓國 KOSPI', symbol: '^KS11', value: 0, change: 0, changeRate: 0, tone: 'is-flat', sourceLabel: '待接資料' }
    ];
  }, [asiaIndices]);

  const rankedStocks = useMemo(() => {
    return [...stocks]
      .map((stock) => {
        const { change, rate } = getChange(stock);
        return {
          ...stock,
          _change: change,
          _rate: rate,
          _tradeValue: toNumber(stock.TradeValue)
        };
      })
      .sort((a, b) => b._tradeValue - a._tradeValue);
  }, [stocks]);

  const hotStocks = useMemo(() => rankedStocks.filter((stock) => stock._rate > 0).slice(0, 12), [rankedStocks]);
  const weakStocks = useMemo(() => rankedStocks.filter((stock) => stock._rate < 0).sort((a, b) => a._rate - b._rate).slice(0, 12), [rankedStocks]);

  const selectorResults = useMemo(() => {
    const fallbackSectors = sectorFilter === 'all' ? [] : [sectorFilter];
    return stocks
      .map((stock) => checkSOPStrategy(stock, fallbackSectors, {
        maxCapital,
        relaxKD: true,
        radarMode: selectorMode,
        history: historyData[stock.Code],
        fundamentals: fundamentalsData[stock.Code],
        chip: chipData[stock.Code],
        capitalYi: stock.CapitalYi
      }))
      .filter((result) => result.passStep2 || result.passStep3)
      .sort((a, b) => Number(b.passStep3) - Number(a.passStep3) || Math.abs(b.changeRate) - Math.abs(a.changeRate))
      .slice(0, 80);
  }, [stocks, selectorMode, sectorFilter, maxCapital, historyData, fundamentalsData, chipData]);

  const filteredStocks = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rankedStocks.slice(0, 120);
    return rankedStocks
      .filter((stock) => `${stock.Code} ${stock.Name} ${stock.Category}`.toLowerCase().includes(keyword))
      .slice(0, 120);
  }, [rankedStocks, search]);

  const watchedStocks = useMemo(() => watchlist
    .map((code) => stocks.find((stock) => stock.Code === code))
    .filter(Boolean), [watchlist, stocks]);

  const toggleWatchlist = (code) => {
    setWatchlist((previous) => previous.includes(code)
      ? previous.filter((item) => item !== code)
      : [...previous, code]
    );
  };

  const openStock = (code) => {
    setSelectedCode(code);
    setActiveTab('stock');
  };

  const selectedBars = normalizeBars(historyData[selectedStock?.Code] || []);
  const fallbackBars = selectedStock ? [{
    date: dataStatus.dataDate || '',
    open: toNumber(selectedStock.OpeningPrice, toNumber(selectedStock.ClosingPrice)),
    high: toNumber(selectedStock.HighestPrice, toNumber(selectedStock.ClosingPrice)),
    low: toNumber(selectedStock.LowestPrice, toNumber(selectedStock.ClosingPrice)),
    close: toNumber(selectedStock.ClosingPrice),
    volume: toNumber(selectedStock.TradeVolume)
  }] : [];
  const chartBars = selectedBars.length ? selectedBars : fallbackBars;

  return (
    <div className="app-shell">
      <aside className="side-rail">
        <div className="brand-block">
          <div className="brand-mark">SP</div>
          <div>
            <h1>Stock Picker</h1>
            <p>市場監控與選股工作站</p>
          </div>
        </div>

        <nav className="rail-nav">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="rail-watch">
          <div className="rail-watch__title">
            <span>快速觀察</span>
            <strong>{watchlist.length}</strong>
          </div>
          <div className="rail-watch__list">
            {(watchedStocks.length ? watchedStocks : hotStocks.slice(0, 6)).slice(0, 8).map((stock) => (
              <StockRow
                key={stock.Code}
                stock={stock}
                active={stock.Code === selectedStock?.Code}
                onClick={() => openStock(stock.Code)}
              />
            ))}
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar__left">
            <div className="market-open-dot" data-open={marketStatus?.anyMarketOpen ? 'true' : 'false'} />
            <div>
              <strong>{marketStatus?.anyMarketOpen ? '市場開盤更新中' : '市場休市或盤後監控'}</strong>
              <span>資料日 {dataStatus.dataDate || '--'}，產生時間 {dataStatus.generatedAt ? new Date(dataStatus.generatedAt).toLocaleString('zh-TW', { hour12: false }) : '--'}</span>
            </div>
          </div>
          <div className="topbar__actions">
            <button className="icon-button" type="button" title="重新整理" onClick={() => fetchStocksData()}>
              <RefreshCw size={17} />
            </button>
            <button className="icon-button" type="button" title="切換主題" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="icon-button" type="button" title="資料設定" onClick={() => setActiveTab('status')}>
              <Settings size={17} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="loading-state">
            <RefreshCw className="spin" size={30} />
            <strong>讀取最新市場資料中</strong>
            <span>正在載入 NAS 發布的靜態快照與即時市場狀態。</span>
          </div>
        ) : (
          <>
            {error && <div className="alert-line"><Bell size={16} />{error}，目前可能使用本機快取資料。</div>}

            {activeTab === 'overview' && (
              <section className="overview-grid">
                <div className="hero-panel">
                  <SectionTitle icon={Activity} title="全球市場雷達" meta="優先監控美股四大指數、台股盤面與東北亞市場。" />
                  <div className="market-grid major">
                    {usIndices.map((item) => <MarketCard key={item.symbol} item={item} />)}
                  </div>
                  <div className="market-grid secondary">
                    <MarketCard item={taiwanIndex} compact />
                    {visibleAsiaIndices.map((item) => <MarketCard key={item.symbol} item={item} compact />)}
                  </div>
                </div>

                <div className="breadth-panel">
                  <SectionTitle icon={Layers3} title="台股盤面寬度" meta={`${stocks.length} 檔上市資料`} />
                  <div className="breadth-meter">
                    <div style={{ width: `${stocks.length ? (marketStats.up / stocks.length) * 100 : 0}%` }} className="up" />
                    <div style={{ width: `${stocks.length ? (marketStats.flat / stocks.length) * 100 : 0}%` }} className="flat" />
                    <div style={{ width: `${stocks.length ? (marketStats.down / stocks.length) * 100 : 0}%` }} className="down" />
                  </div>
                  <div className="stat-grid">
                    <div><span>上漲</span><strong className="is-up">{marketStats.up}</strong></div>
                    <div><span>下跌</span><strong className="is-down">{marketStats.down}</strong></div>
                    <div><span>平盤</span><strong>{marketStats.flat}</strong></div>
                    <div><span>成交值</span><strong>{formatCompact(marketStats.tradeValue)}</strong></div>
                  </div>
                </div>

                <div className="list-panel">
                  <SectionTitle icon={TrendingUp} title="短線強勢" meta="依成交值與漲幅排序" />
                  {hotStocks.slice(0, 10).map((stock) => (
                    <StockRow key={stock.Code} stock={stock} onClick={() => openStock(stock.Code)} />
                  ))}
                </div>

                <div className="list-panel">
                  <SectionTitle icon={TrendingDown} title="空方觀察" meta="跌幅與量能優先" />
                  {weakStocks.slice(0, 10).map((stock) => (
                    <StockRow key={stock.Code} stock={stock} onClick={() => openStock(stock.Code)} />
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'selector' && (
              <section className="selector-layout">
                <div className="control-panel">
                  <SectionTitle icon={Zap} title="選股中心" meta="合併短線雷達、進階智慧選股與手動篩選。" />
                  <div className="segmented">
                    <button type="button" className={selectorMode === 'long' ? 'active' : ''} onClick={() => setSelectorMode('long')}>買進候選</button>
                    <button type="button" className={selectorMode === 'short' ? 'active' : ''} onClick={() => setSelectorMode('short')}>做空候選</button>
                  </div>
                  <label className="field-label">產業篩選</label>
                  <select className="input-field" value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}>
                    <option value="all">全部產業</option>
                    {SECTOR_OPTIONS.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
                  </select>
                  <label className="field-label">最大股本：{maxCapital} 億</label>
                  <input type="range" min="10" max="200" step="5" value={maxCapital} onChange={(event) => setMaxCapital(Number(event.target.value))} />
                  <div className="selector-note">
                    系統使用歷史 K 線、均線、KD、MACD、籌碼與基本面資料計算。資料不足的股票不會硬塞進結果。
                  </div>
                </div>

                <div className="result-panel">
                  <div className="result-panel__head">
                    <SectionTitle icon={Target} title={selectorMode === 'long' ? '買進候選清單' : '做空候選清單'} meta={`${selectorResults.length} 檔符合技術條件`} />
                  </div>
                  <div className="candidate-table">
                    {selectorResults.map((item) => (
                      <button key={item.code} type="button" className="candidate-row" onClick={() => openStock(item.code)}>
                        <span><strong>{item.code}</strong><small>{item.name}</small></span>
                        <span>{item.category || '--'}</span>
                        <span className={toneClass(item.changeRate)}>{item.changeRate >= 0 ? '+' : ''}{formatNumber(item.changeRate)}%</span>
                        <span className={item.passStep3 ? 'signal strong' : 'signal'}>{item.passStep3 ? '進場訊號' : '趨勢成立'}</span>
                      </button>
                    ))}
                    {!selectorResults.length && <div className="empty-state">目前沒有符合條件的標的。可放寬股本或切換模式。</div>}
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'stock' && selectedStock && (
              <section className="stock-workbench">
                <div className="stock-sidebar">
                  <div className="search-box">
                    <Search size={16} />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋代號、名稱或產業" />
                  </div>
                  <div className="stock-scroll">
                    {filteredStocks.map((stock) => (
                      <StockRow
                        key={stock.Code}
                        stock={stock}
                        active={stock.Code === selectedStock.Code}
                        onClick={() => setSelectedCode(stock.Code)}
                      />
                    ))}
                  </div>
                </div>

                <div className="chart-desk">
                  <div className="stock-headline">
                    <div>
                      <span className="stock-code-pill">{selectedStock.Code}</span>
                      <h2>{selectedStock.Name}</h2>
                      <p>{selectedStock.Category || '--'}，資料日 {dataStatus.dataDate || '--'}</p>
                    </div>
                    <div className="price-box">
                      <strong>{formatNumber(selectedStock.ClosingPrice)}</strong>
                      <span className={toneClass(getChange(selectedStock).change)}>
                        {getChange(selectedStock).change >= 0 ? '+' : ''}{formatNumber(getChange(selectedStock).change)}
                        （{getChange(selectedStock).rate >= 0 ? '+' : ''}{formatNumber(getChange(selectedStock).rate)}%）
                      </span>
                    </div>
                    <button className={`watch-button ${watchlist.includes(selectedStock.Code) ? 'active' : ''}`} type="button" onClick={() => toggleWatchlist(selectedStock.Code)}>
                      <Star size={16} fill="currentColor" />
                      {watchlist.includes(selectedStock.Code) ? '已加入觀察' : '加入觀察'}
                    </button>
                  </div>

                  <TradingChart bars={chartBars} title={`${selectedStock.Code} ${selectedStock.Name}`} />
                </div>

                <aside className="stock-inspector">
                  <SectionTitle icon={Database} title="個股資訊" meta="價格、估值、量能與資料完整性" />
                  <div className="metric-list">
                    <div><span>開盤</span><strong>{formatNumber(selectedStock.OpeningPrice)}</strong></div>
                    <div><span>最高</span><strong>{formatNumber(selectedStock.HighestPrice)}</strong></div>
                    <div><span>最低</span><strong>{formatNumber(selectedStock.LowestPrice)}</strong></div>
                    <div><span>成交量</span><strong>{formatCompact(selectedStock.TradeVolume)}</strong></div>
                    <div><span>成交值</span><strong>{formatCompact(selectedStock.TradeValue)}</strong></div>
                    <div><span>本益比</span><strong>{selectedStock.PEratio || '--'}</strong></div>
                    <div><span>殖利率</span><strong>{selectedStock.DividendYield || '--'}%</strong></div>
                    <div><span>股價淨值比</span><strong>{selectedStock.PBratio || '--'}</strong></div>
                    <div><span>K 線資料</span><strong>{chartBars.length} 根</strong></div>
                  </div>
                </aside>
              </section>
            )}

            {activeTab === 'watchlist' && (
              <section className="watch-page">
                <SectionTitle icon={Star} title="觀察清單" meta="保留你正在追蹤的候選標的。" />
                <div className="watch-grid">
                  {watchedStocks.map((stock) => <MarketLikeStockCard key={stock.Code} stock={stock} onOpen={() => openStock(stock.Code)} onRemove={() => toggleWatchlist(stock.Code)} />)}
                  {!watchedStocks.length && <div className="empty-state">尚未加入觀察標的。可從市場總覽或個股詳情加入。</div>}
                </div>
              </section>
            )}

            {activeTab === 'status' && (
              <section className="status-page">
                <SectionTitle icon={Database} title="資料狀態" meta="確認網站是否正在使用最新快照。" />
                <div className="status-grid">
                  <div><span>資料來源</span><strong>{dataStatus.source || '--'}</strong></div>
                  <div><span>資料日期</span><strong>{dataStatus.dataDate || '--'}</strong></div>
                  <div><span>產生時間</span><strong>{dataStatus.generatedAt ? new Date(dataStatus.generatedAt).toLocaleString('zh-TW', { hour12: false }) : '--'}</strong></div>
                  <div><span>台股筆數</span><strong>{stocks.length}</strong></div>
                  <div><span>美股指數</span><strong>{usIndices.length} / 4</strong></div>
                  <div><span>市場輪詢</span><strong>{marketStatus?.nextPollMs ? `${Math.round(marketStatus.nextPollMs / 1000)} 秒` : '--'}</strong></div>
                  <div><span>是否開盤</span><strong>{marketStatus?.anyMarketOpen ? '是' : '否'}</strong></div>
                  <div><span>備援狀態</span><strong>{dataStatus.isFallback ? '使用備援資料' : '正常'}</strong></div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MarketLikeStockCard({ stock, onOpen, onRemove }) {
  const { change, rate } = getChange(stock);
  return (
    <article className="watch-card">
      <div>
        <span>{stock.Code}</span>
        <h3>{stock.Name}</h3>
        <p>{stock.Category || '--'}</p>
      </div>
      <strong>{formatNumber(stock.ClosingPrice)}</strong>
      <em className={toneClass(change)}>{rate >= 0 ? '+' : ''}{formatNumber(rate)}%</em>
      <div className="watch-card__actions">
        <button type="button" onClick={onOpen}>查看</button>
        <button type="button" onClick={onRemove}>移除</button>
      </div>
    </article>
  );
}
