import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Coins, 
  BarChart3, 
  ArrowLeftRight, 
  Star, 
  TrendingUp,
  RefreshCw, 
  AlertTriangle,
  WifiOff,
  Settings
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import StockFilter from './components/StockFilter';
import StockTable from './components/StockTable';
import StockCharts from './components/StockCharts';
import StockCompare from './components/StockCompare';
import Watchlist from './components/Watchlist';
import StockDetail from './components/StockDetail';
import { PRESET_STRATEGIES } from './utils/stockUtils';

const DEFAULT_FILTERS = {
  search: '',
  minPrice: '',
  maxPrice: '',
  minPE: '',
  maxPE: '',
  minYield: '',
  maxYield: '',
  minPB: '',
  maxPB: ''
};

export default function App() {
  // 1. 全域股票數據狀態
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  // 2. 使用者自訂狀態 (自選股與對比)
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem('tw_stock_watchlist');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [compareList, setCompareList] = useState(() => {
    const saved = localStorage.getItem('tw_stock_compare');
    return saved ? JSON.parse(saved) : [];
  });

  // 模擬投資組合狀態
  const [portfolio, setPortfolio] = useState(() => {
    const saved = localStorage.getItem('tw_stock_portfolio');
    return saved ? JSON.parse(saved) : [];
  });

  // 投資組合所有持股的即時盤中價格快照
  const [portfolioLivePrices, setPortfolioLivePrices] = useState({});

  // 自訂選股策略狀態
  const [customStrategies, setCustomStrategies] = useState(() => {
    const saved = localStorage.getItem('tw_stock_custom_strategies');
    return saved ? JSON.parse(saved) : [];
  });

  // 3. 篩選與排序狀態
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeStrategy, setActiveStrategy] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'ClosingPrice', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);

  // 4. UI 面板控制狀態
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'table', 'charts', 'compare'
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [selectedStockCode, setSelectedStockCode] = useState(null);

  // GitHub Actions 手動雲端觸發狀態
  const [githubToken, setGithubToken] = useState(() => {
    return localStorage.getItem('tw_github_token') || '';
  });
  const [isGithubPanelOpen, setIsGithubPanelOpen] = useState(false);
  const [isTriggeringAction, setIsTriggeringAction] = useState(false);

  // 獲取所有獨特的產業類別
  const categories = useMemo(() => {
    const cats = stocks.map(s => s.Category).filter(Boolean);
    return Array.from(new Set(cats)).sort();
  }, [stocks]);

  // 保存自選股與對比至 localStorage
  useEffect(() => {
    localStorage.setItem('tw_stock_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem('tw_stock_compare', JSON.stringify(compareList));
  }, [compareList]);

  useEffect(() => {
    localStorage.setItem('tw_stock_portfolio', JSON.stringify(portfolio));
  }, [portfolio]);

  useEffect(() => {
    localStorage.setItem('tw_stock_custom_strategies', JSON.stringify(customStrategies));
  }, [customStrategies]);

  // 合併預設與自訂策略
  const allStrategies = useMemo(() => {
    const combined = { ...PRESET_STRATEGIES };
    customStrategies.forEach(strat => {
      combined[strat.id] = {
        id: strat.id,
        name: strat.name,
        desc: strat.desc,
        criteriaDesc: strat.criteriaDesc,
        isCustom: true,
        criteria: strat.criteria,
        filter: (stock) => {
          const price = parseFloat(stock.ClosingPrice) || 0;
          const pe = stock.PEratio !== '' ? parseFloat(stock.PEratio) : null;
          const pb = stock.PBratio !== '' ? parseFloat(stock.PBratio) : null;
          const yieldPct = parseFloat(stock.DividendYield) || 0;

          const c = strat.criteria;
          if (c.minPrice && price < parseFloat(c.minPrice)) return false;
          if (c.maxPrice && price > parseFloat(c.maxPrice)) return false;
          if (c.minPE) {
            if (pe === null || pe < parseFloat(c.minPE)) return false;
          }
          if (c.maxPE) {
            if (pe === null || pe > parseFloat(c.maxPE)) return false;
          }
          if (c.minYield && yieldPct < parseFloat(c.minYield)) return false;
          if (c.maxYield && yieldPct > parseFloat(c.maxYield)) return false;
          if (c.minPB) {
            if (pb === null || pb < parseFloat(c.minPB)) return false;
          }
          if (c.maxPB) {
            if (pb === null || pb > parseFloat(c.maxPB)) return false;
          }
          return true;
        }
      };
    });
    return combined;
  }, [customStrategies]);

  // 投資組合操作 Handlers
  const handleAddToPortfolio = (code, buyPrice, buyLots) => {
    const targetStock = stocks.find(s => s.Code === code);
    if (!targetStock) return;
    
    setPortfolio(prev => {
      const existingIdx = prev.findIndex(item => item.code === code);
      if (existingIdx > -1) {
        const existing = prev[existingIdx];
        const newLots = existing.buyLots + buyLots;
        const newBuyPrice = ((existing.buyPrice * existing.buyLots) + (buyPrice * buyLots)) / newLots;
        const updated = [...prev];
        updated[existingIdx] = {
          ...existing,
          buyLots: newLots,
          buyPrice: parseFloat(newBuyPrice.toFixed(2)),
          date: new Date().toLocaleDateString('zh-TW')
        };
        showToast(`💼 已加碼 ${targetStock.Name}，累計持股：${newLots} 張`);
        return updated;
      } else {
        showToast(`💼 已將 ${targetStock.Name} 納入模擬投資組合`);
        return [...prev, {
          id: code,
          code,
          name: targetStock.Name,
          buyPrice: parseFloat(buyPrice),
          buyLots: parseInt(buyLots),
          date: new Date().toLocaleDateString('zh-TW')
        }];
      }
    });
  };

  const handleRemoveFromPortfolio = (code) => {
    setPortfolio(prev => prev.filter(item => item.code !== code));
    showToast(`💼 已從投資組合中賣出/移除股票：${code}`);
  };

  const handleUpdatePortfolioLots = (code, delta) => {
    setPortfolio(prev => {
      return prev.map(item => {
        if (item.code === code) {
          const newLots = item.buyLots + delta;
          if (newLots <= 0) return null;
          return { ...item, buyLots: newLots };
        }
        return item;
      }).filter(Boolean);
    });
  };

  // 自訂策略操作 Handlers
  const handleAddCustomStrategy = (newStrat) => {
    setCustomStrategies(prev => [...prev, newStrat]);
    showToast(`🛠️ 已新增自訂策略：${newStrat.name}`);
  };

  const handleDeleteCustomStrategy = (id) => {
    setCustomStrategies(prev => prev.filter(s => s.id !== id));
    if (activeStrategy === id) {
      handleResetFilters();
    }
    showToast(`🛠️ 已刪除自訂策略`);
  };

  // 彈出 Toast 訊息輔助函式
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // 5. 獲取台股 API 數據
  const fetchStocksData = async (isRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      let response;
      
      try {
        // 先嘗試發送到 Express 後端伺服器 (若處於本機或 Full-stack 伺服器運行模式)
        if (isRefresh) {
          response = await fetch('/api/stocks/refresh', { method: 'POST' });
        } else {
          response = await fetch('/api/stocks');
        }
        if (!response.ok) {
          throw new Error('Express endpoint returned non-OK status');
        }
      } catch (e) {
        // 若在 GitHub Pages (Serverless) 等不支援後台運行的環境，則優雅降級讀取相對路徑下的靜態檔案
        response = await fetch('./api/stocks.json');
      }

      if (!response.ok) {
        throw new Error(`無法載入靜態資料庫 (HTTP status: ${response.status})`);
      }
      const resData = await response.json();
      if (resData.success && Array.isArray(resData.data)) {
        setStocks(resData.data);
        setIsOffline(resData.source === 'fallback_mock');
        
        // 格式化最後更新時間
        const updateDate = new Date(resData.timestamp);
        setLastUpdated(updateDate.toLocaleString('zh-TW', { hour12: false }));
        
        if (isRefresh) {
          showToast(resData.source === 'fallback_mock'
            ? "⚠️ 已重新整理！目前載入的是高保真離線備用行情"
            : "✅ 已重新同步！台股行情與大盤指標已成功更新"
          );
        } else {
          showToast(resData.source === 'fallback_mock' 
            ? "⚠️ 目前載入的是離線備用數據，請在聯網時透過 Actions 排程更新" 
            : "✅ 台股收盤數據載入成功！"
          );
        }
      } else {
        throw new Error("靜態資料結構格式不正確");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("無法取得台灣股市數據庫。如果您是在本機開發，請確保已運行過 npm run build:data 生成 public/api/stocks.json。");
      showToast("❌ 數據庫檔案載入失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocksData();
  }, []);

  // 5.2 手動觸發 GitHub Actions 雲端工作流
  const handleTriggerWorkflow = async () => {
    const cleanToken = githubToken ? githubToken.trim() : '';
    if (!cleanToken) {
      showToast("❌ 請先輸入有效的 GitHub Token！");
      return;
    }
    setIsTriggeringAction(true);
    try {
      const response = await fetch('https://api.github.com/repos/zerokemx-ui/Stock-picker/actions/workflows/deploy.yml/dispatches', {
        method: 'POST',
        headers: {
          'Authorization': `token ${cleanToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main'
        })
      });

      if (response.status === 204) {
        showToast("⚡ 雲端更新指令已成功送出！請等待約 1-2 分鐘，雲端將自動更新數據。");
        setIsGithubPanelOpen(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP status ${response.status}`);
      }
    } catch (err) {
      console.error("觸發 Actions 失敗:", err);
      showToast(`❌ 觸發雲端更新失敗: ${err.message}`);
    } finally {
      setIsTriggeringAction(false);
    }
  };

  // 5.5. 批量同步模擬持股的即時價格數據 (每 15 秒自動輪詢)
  const fetchPortfolioLivePrices = async () => {
    if (!portfolio || portfolio.length === 0) {
      setPortfolioLivePrices({});
      return;
    }
    
    const codes = portfolio.map(item => item.code).join(',');
    try {
      const response = await fetch(`/api/stocks/realtime?codes=${codes}`);
      const resData = await response.json();
      if (resData.success && Array.isArray(resData.data)) {
        const priceMap = {};
        resData.data.forEach(stock => {
          priceMap[stock.Code] = {
            price: parseFloat(stock.ClosingPrice),
            change: parseFloat(stock.Change),
            changePercent: parseFloat(stock.ChangePercent),
            highest: parseFloat(stock.HighestPrice),
            lowest: parseFloat(stock.LowestPrice),
            open: parseFloat(stock.OpeningPrice),
            volume: parseInt(stock.TradeVolume),
            time: stock.Time,
            isLive: true
          };
        });
        setPortfolioLivePrices(priceMap);
      }
    } catch (err) {
      console.error("無法同步投資組合即時報價:", err);
    }
  };

  const portfolioCodesString = portfolio.map(p => p.code).join(',');
  useEffect(() => {
    fetchPortfolioLivePrices();
    
    const timer = setInterval(() => {
      fetchPortfolioLivePrices();
    }, 15000);
    
    return () => clearInterval(timer);
  }, [portfolioCodesString]);

  // 6. 各種互動 Handlers
  const handleToggleWatchlist = (code) => {
    if (watchlist.includes(code)) {
      setWatchlist(prev => prev.filter(c => c !== code));
      showToast(`⭐ 已將股票 ${code} 移出自選追蹤`);
    } else {
      setWatchlist(prev => [...prev, code]);
      showToast(`⭐ 已將股票 ${code} 加入自選追蹤`);
    }
  };

  const handleToggleCompare = (code) => {
    if (compareList.includes(code)) {
      setCompareList(prev => prev.filter(c => c !== code));
      showToast(`📊 已將股票 ${code} 移出對比清單`);
    } else {
      if (compareList.length >= 4) {
        showToast("⚠️ 對比清單上限為 4 檔股票！請先移除其他股票");
        return;
      }
      setCompareList(prev => [...prev, code]);
      showToast(`📊 已將股票 ${code} 加入對比清單`);
    }
  };

  const handleRemoveCompare = (code) => {
    setCompareList(prev => prev.filter(c => c !== code));
  };

  const handleClearCompare = () => {
    setCompareList([]);
    showToast("📊 已清空對比清單");
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSelectedCategory('All');
    setActiveStrategy(null);
    setCurrentPage(1);
    showToast("🔄 已重設所有篩選與搜尋條件");
  };

  // 當使用者在儀表板或圖表中點擊某檔股票時，自動填入搜尋並切換到表格，並開啟詳細分析彈窗
  const handleSelectStock = (code) => {
    setFilters(prev => ({
      ...prev,
      search: code
    }));
    setSelectedCategory('All');
    setActiveStrategy(null);
    setCurrentPage(1);
    setActiveTab('table');
    setSelectedStockCode(code);
    showToast(`🔍 已為您定位並開啟個股分析：${code}`);
  };

  // 7. 計算多重篩選後的股票列表
  const filteredStocks = useMemo(() => {
    let result = [...stocks];

    // 產業篩選
    if (selectedCategory !== 'All') {
      result = result.filter(s => s.Category === selectedCategory);
    }

    // 預設與自訂選股策略篩選
    if (activeStrategy && allStrategies[activeStrategy]) {
      const strategy = allStrategies[activeStrategy];
      result = result.filter(strategy.filter);
    }

    // 進階條件範圍篩選
    result = result.filter(s => {
      // 搜尋關鍵字 (代號或名稱)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const codeMatch = s.Code.toLowerCase().includes(searchLower);
        const nameMatch = s.Name.toLowerCase().includes(searchLower);
        if (!codeMatch && !nameMatch) return false;
      }

      // 股價篩選
      const price = parseFloat(s.ClosingPrice) || 0;
      if (filters.minPrice && price < parseFloat(filters.minPrice)) return false;
      if (filters.maxPrice && price > parseFloat(filters.maxPrice)) return false;

      // 本益比篩選
      const pe = s.PEratio !== '' ? parseFloat(s.PEratio) : null;
      if (filters.minPE) {
        if (pe === null || pe < parseFloat(filters.minPE)) return false;
      }
      if (filters.maxPE) {
        if (pe === null || pe > parseFloat(filters.maxPE)) return false;
      }

      // 殖利率篩選
      const yieldPct = parseFloat(s.DividendYield) || 0;
      if (filters.minYield && yieldPct < parseFloat(filters.minYield)) return false;
      if (filters.maxYield && yieldPct > parseFloat(filters.maxYield)) return false;

      // 股價淨值比篩選
      const pb = s.PBratio !== '' ? parseFloat(s.PBratio) : null;
      if (filters.minPB) {
        if (pb === null || pb < parseFloat(filters.minPB)) return false;
      }
      if (filters.maxPB) {
        if (pb === null || pb > parseFloat(filters.maxPB)) return false;
      }

      return true;
    });

    // 進行排序
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        // 數值類別轉換為 Float 比較，避免字串排序錯誤
        if (['ClosingPrice', 'Change', 'PEratio', 'DividendYield', 'PBratio', 'TradeVolume', 'TradeValue'].includes(sortConfig.key)) {
          valA = valA === '' ? -Infinity : parseFloat(valA);
          valB = valB === '' ? -Infinity : parseFloat(valB);
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [stocks, filters, selectedCategory, activeStrategy, allStrategies, sortConfig]);

  // 當篩選條件變動時，重設分頁至第一頁
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, selectedCategory, activeStrategy]);

  return (
    <div className="container">
      
      {/* 頂部標頭列 */}
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-blue)', borderRadius: '10px' }}>
              <Activity size={28} />
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.03em' }}>
              <span className="text-gradient-cyan">台股選股</span>
              <span style={{ color: 'var(--text-primary)' }}>神器</span>
            </h1>
            
            {/* 離線或備用數據狀態提示 badge */}
            {isOffline && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-gold)', borderRadius: '4px', fontWeight: 600 }}>
                <WifiOff size={12} /> 離線備用行情
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontWeight: 500 }}>
            ⚡ 整合每日最新收盤行情、本益比、殖利率、股價淨值比，一鍵鎖定黃金投資機會。
          </p>
        </div>

        {/* 系統功能按鈕列 (刷新、自選股抽屜切換) */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'none', md: 'inline' }}>
            數據更新：{lastUpdated || '載入中...'}
          </span>
          
          <button 
            onClick={() => fetchStocksData(true)} 
            disabled={loading}
            className="btn-secondary" 
            style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
            title="重新整理數據"
          >
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            同步行情
          </button>

          <button 
            onClick={() => setIsGithubPanelOpen(true)}
            className="btn-secondary" 
            style={{ padding: '0.6rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="設定雲端同步 (GitHub Actions)"
          >
            <Settings size={14} />
          </button>
          
          <button 
            onClick={() => setIsWatchlistOpen(true)}
            className="btn-primary"
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', position: 'relative' }}
          >
            <Star size={14} fill="currentColor" />
            自選追蹤
            {watchlist.length > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--stock-up)', color: '#fff', fontSize: '0.7rem', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid var(--bg-primary)' }}>
                {watchlist.length}
              </span>
            )}
          </button>

        </div>
      </header>

      {/* 導覽分頁 Tab 選單 */}
      <div className="tabs-container">
        
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          <Activity size={16} />
          市場總覽儀表板
        </button>

        <button 
          onClick={() => setActiveTab('table')} 
          className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`}
        >
          <BarChart3 size={16} />
          進階智慧選股
        </button>

        <button 
          onClick={() => setActiveTab('charts')} 
          className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
        >
          <Coins size={16} />
          價值尋寶散佈圖
        </button>

        <button 
          onClick={() => setActiveTab('compare')} 
          className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
          style={{ position: 'relative' }}
        >
          <ArrowLeftRight size={16} />
          多股指標對比
          {compareList.length > 0 && (
            <span style={{ marginLeft: '6px', background: 'var(--accent-blue)', color: '#070a13', fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '10px', fontWeight: 'bold' }}>
              {compareList.length}
            </span>
          )}
        </button>

      </div>

      {/* 主畫面視窗內容渲染 */}
      {error && !loading && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem 2rem', borderLeft: '4px solid var(--stock-up)', marginBottom: '2rem' }}>
          <AlertTriangle size={48} style={{ color: 'var(--stock-up)' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>伺服器代理連線異常</h3>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '600px', fontSize: '0.9rem' }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button onClick={() => fetchStocksData()} className="btn-primary">重試連線</button>
            <button onClick={() => {
              // 載入備用數據
              setStocks(fallbackMockStocks);
              setIsOffline(true);
              setError(null);
              showToast("⚠️ 已為您切換至離線預置數據");
            }} className="btn-secondary">載入離線備用數據</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '6rem 0' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '0.25rem' }}>台股數據同步中...</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>正在由台灣證券交易所 (TWSE) 獲取並整合最新的基本面與收盤行情指標</div>
          </div>
          
          {/* 漂亮的 Skeleton 模擬表格載入 */}
          <div className="glass-panel" style={{ width: '100%', maxWidth: '1000px', marginTop: '2rem', padding: '1rem' }}>
            <div className="skeleton-row" style={{ height: '32px', marginBottom: '1rem', opacity: 0.5 }}></div>
            <div className="skeleton-row"></div>
            <div className="skeleton-row" style={{ animationDelay: '0.2s' }}></div>
            <div className="skeleton-row" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      ) : (
        !error && (
          <div style={{ transition: 'opacity 0.2s ease' }}>
            
            {/* Tab 1: 市場總覽儀表板 */}
            {activeTab === 'dashboard' && (
              <Dashboard 
                stocks={stocks} 
                onSelectStock={handleSelectStock} 
                portfolio={portfolio}
                portfolioLivePrices={portfolioLivePrices}
                onRemoveFromPortfolio={handleRemoveFromPortfolio}
                onUpdatePortfolioLots={handleUpdatePortfolioLots}
              />
            )}

            {/* Tab 2: 進階篩選與表格 */}
            {activeTab === 'table' && (
              <>
                <StockFilter 
                  filters={filters} 
                  setFilters={setFilters}
                  activeStrategy={activeStrategy}
                  setActiveStrategy={setActiveStrategy}
                  onResetFilters={handleResetFilters}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  allStrategies={allStrategies}
                  onAddCustomStrategy={handleAddCustomStrategy}
                  onDeleteCustomStrategy={handleDeleteCustomStrategy}
                />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    符合篩選條件股票：<span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{filteredStocks.length}</span> 檔
                  </div>
                  {activeStrategy && allStrategies[activeStrategy] && (
                    <div style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)', borderRadius: '4px', fontWeight: 600 }}>
                      策略啟用中：{allStrategies[activeStrategy].name}
                    </div>
                  )}
                </div>

                <StockTable 
                  stocks={filteredStocks}
                  watchlist={watchlist}
                  compareList={compareList}
                  onToggleWatchlist={handleToggleWatchlist}
                  onToggleCompare={handleToggleCompare}
                  sortConfig={sortConfig}
                  setSortConfig={setSortConfig}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  onOpenDetail={handleSelectStock}
                />
              </>
            )}

            {/* Tab 3: Chart.js 數據圖表 */}
            {activeTab === 'charts' && (
              <StockCharts stocks={filteredStocks} onSelectStock={handleSelectStock} />
            )}

            {/* Tab 4: 股票對比與計算機 */}
            {activeTab === 'compare' && (
              <StockCompare 
                stocks={stocks}
                compareList={compareList}
                onRemoveCompare={handleRemoveCompare}
                onClearCompare={handleClearCompare}
              />
            )}

          </div>
        )
      )}

      {/* 側邊自選股追蹤側拉抽屜 */}
      <Watchlist 
        stocks={stocks}
        watchlist={watchlist}
        onRemoveWatchlist={handleToggleWatchlist}
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
        onSelectStock={handleSelectStock}
      />

      {/* 抽屜開啟時的半透明背景遮罩 */}
      {isWatchlistOpen && (
        <div 
          onClick={() => setIsWatchlistOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 999 }}
        />
      )}

      {/* 個股詳細分析彈窗面板 */}
      {selectedStockCode && (
        <StockDetail 
          stockCode={selectedStockCode}
          stocks={stocks}
          watchlist={watchlist}
          compareList={compareList}
          portfolio={portfolio}
          onAddToPortfolio={handleAddToPortfolio}
          onToggleWatchlist={handleToggleWatchlist}
          onToggleCompare={handleToggleCompare}
          onClose={() => setSelectedStockCode(null)}
        />
      )}

      {/* 雲端更新設定彈窗 */}
      {isGithubPanelOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          {/* 半透明背景遮罩 */}
          <div 
            onClick={() => setIsGithubPanelOpen(false)}
            style={{ position: 'absolute', width: '100%', height: '100%', background: 'rgba(5, 8, 20, 0.75)', backdropFilter: 'blur(8px)' }}
          />
          
          {/* 彈窗主體 */}
          <div className="glass-panel" style={{ 
            position: 'relative', 
            width: '90%', 
            maxWidth: '520px', 
            maxHeight: '90vh', 
            overflowY: 'auto',
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-glass-hover)', 
            boxShadow: '0 20px 50px rgba(0,0,0,0.6), var(--shadow-neon-blue)',
            padding: '2rem',
            animation: 'slide-up-fade 0.3s ease-out',
            zIndex: 10001
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="text-gradient-cyan">☁️ 雲端數據即時更新</span>
              </h3>
              <button 
                onClick={() => setIsGithubPanelOpen(false)}
                className="btn-icon"
                style={{ fontSize: '1.2rem', padding: '0.2rem' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <p>
                本網頁完全在您的瀏覽器（線上靜態 GitHub Pages）中運作，無須下載或安裝任何本地程式。
              </p>
              
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(56, 189, 248, 0.05)', borderLeft: '3px solid var(--accent-blue)', borderRadius: '4px', fontSize: '0.85rem' }}>
                <strong>🔒 安全聲明：</strong>
                本設定使用「個人瀏覽器儲存（localStorage）」，您的 Token 僅會直接與 GitHub API 通訊，絕對不會上傳至任何第三方伺服器，安全無輿。
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-primary)' }}>步驟 1. 取得 GitHub 授權（PAT）</label>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  請至 GitHub 生成一個存取權杖（Token），並勾選 <code>workflow</code> 權限，以允許此網頁發送更新請求。
                </p>
                <a 
                  href="https://github.com/settings/tokens/new?description=Taiwan-Stock-Picker-Trigger&scopes=workflow" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontSize: '0.8rem', fontWeight: 600, width: 'fit-content' }}
                >
                  👉 點此前往 GitHub 自動生成 Token 頁面
                </a>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <label htmlFor="github-token-input" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>步驟 2. 輸入您的 Token</label>
                <input 
                  id="github-token-input"
                  type="password"
                  value={githubToken}
                  onChange={(e) => {
                    setGithubToken(e.target.value);
                    localStorage.setItem('tw_github_token', e.target.value);
                  }}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="input-field"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                <button 
                  onClick={handleTriggerWorkflow}
                  disabled={!githubToken || isTriggeringAction}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', background: !githubToken ? 'var(--bg-tertiary)' : undefined, color: !githubToken ? 'var(--text-muted)' : undefined, border: !githubToken ? '1px solid var(--border-glass)' : undefined, cursor: !githubToken ? 'not-allowed' : 'pointer', boxShadow: !githubToken ? 'none' : undefined }}
                >
                  <RefreshCw size={16} className={isTriggeringAction ? 'spin-anim' : ''} />
                  {isTriggeringAction ? '正在傳送雲端請求...' : '⚡ 立即強制更新雲端數據 (Actions)'}
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                  * 按下後會觸發 GitHub Actions 執行盤中行情抓取，整個過程約需 1-2 分鐘。完成後重新整理網頁即可看見最新數據！
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 全域美觀微調的 Toast 懸浮通知 */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: 'rgba(14, 19, 38, 0.95)', border: '1px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 8px 30px rgba(0,0,0,0.5), var(--shadow-neon-blue)', padding: '0.85rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 99999, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', animation: 'slide-up-fade 0.3s ease-out' }}>
          {toastMessage}
        </div>
      )}

      {/* 局部動畫效果 CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        .spin-anim {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slide-up-fade {
          0% { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}} />

    </div>
  );
}
