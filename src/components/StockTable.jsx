import React, { useState, useEffect, useMemo } from 'react';
import { 
  Star, 
  ArrowLeftRight, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Info
} from 'lucide-react';
import { 
  formatVolumeInChang, 
  calculateChangeRate, 
  getChangeColorClass 
} from '../utils/stockUtils';

export default function StockTable({
  stocks,
  watchlist,
  compareList,
  onToggleWatchlist,
  onToggleCompare,
  sortConfig,
  setSortConfig,
  currentPage,
  setCurrentPage,
  onOpenDetail
}) {
  const ITEMS_PER_PAGE = 15;

  // 1. 本地實時價格狀態
  const [livePrices, setLivePrices] = useState({});

  // 2. 處理分頁
  const totalItems = stocks.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedStocks = useMemo(() => {
    return stocks.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [stocks, startIndex]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // 3. 實時價格載入與同步 (每 15 秒背景更新一次，僅鎖定當前頁面 15 檔可見股票)
  const visibleCodesString = useMemo(() => {
    return paginatedStocks.map(s => s.Code).join(',');
  }, [paginatedStocks]);

  useEffect(() => {
    if (!visibleCodesString) return;
    
    let isMounted = true;
    const fetchLivePrices = async () => {
      try {
        const response = await fetch(`/api/stocks/realtime?codes=${visibleCodesString}`);
        const resData = await response.json();
        if (resData.success && Array.isArray(resData.data) && isMounted) {
          const newPrices = {};
          resData.data.forEach(item => {
            newPrices[item.Code] = {
              price: parseFloat(item.ClosingPrice),
              change: parseFloat(item.Change),
              changePercent: parseFloat(item.ChangePercent)
            };
          });
          setLivePrices(prev => ({ ...prev, ...newPrices }));
        }
      } catch (err) {
        console.error("無法同步目前分頁個股即時價格:", err);
      }
    };

    fetchLivePrices();
    
    const timer = setInterval(() => {
      fetchLivePrices();
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [visibleCodesString]);

  // 4. 處理排序
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // 渲染排序指示圖示
  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown size={13} style={{ marginLeft: '4px', opacity: 0.5 }} />;
    }
    return sortConfig.direction === 'desc' 
      ? <ArrowDown size={13} style={{ marginLeft: '4px', color: 'var(--accent-blue)' }} />
      : <ArrowUp size={13} style={{ marginLeft: '4px', color: 'var(--accent-blue)' }} />;
  };

  // 判斷自選或對比狀態
  const isWatched = (code) => watchlist.includes(code);
  const isCompared = (code) => compareList.includes(code);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      
      {/* 數據表格 */}
      <div className="table-wrapper">
        {paginatedStocks.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>沒有符合目前篩選條件的股票</div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>請嘗試放寬篩選範圍或清除搜尋條件。</div>
          </div>
        ) : (
          <table className="stock-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('Code')}>證券代號 {renderSortIcon('Code')}</th>
                <th onClick={() => handleSort('Name')}>證券名稱 {renderSortIcon('Name')}</th>
                <th onClick={() => handleSort('ClosingPrice')} style={{ textAlign: 'right' }}>收盤價 (元) {renderSortIcon('ClosingPrice')}</th>
                <th onClick={() => handleSort('Change')} style={{ textAlign: 'right' }}>今日漲跌 {renderSortIcon('Change')}</th>
                <th onClick={() => handleSort('Change')} style={{ textAlign: 'right' }}>漲跌幅 {renderSortIcon('Change')}</th>
                <th onClick={() => handleSort('PEratio')} style={{ textAlign: 'right' }}>本益比 (PE) {renderSortIcon('PEratio')}</th>
                <th onClick={() => handleSort('DividendYield')} style={{ textAlign: 'right' }}>殖利率 (%) {renderSortIcon('DividendYield')}</th>
                <th onClick={() => handleSort('PBratio')} style={{ textAlign: 'right' }}>股價淨值比 (PB) {renderSortIcon('PBratio')}</th>
                <th onClick={() => handleSort('Category')}>產業別 {renderSortIcon('Category')}</th>
                <th style={{ textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStocks.map((stock) => {
                const liveData = livePrices[stock.Code];
                const closingPrice = (liveData && liveData.price !== undefined && !isNaN(liveData.price)) 
                  ? liveData.price 
                  : parseFloat(stock.ClosingPrice || 0);
                const changeVal = (liveData && liveData.change !== undefined && !isNaN(liveData.change)) 
                  ? liveData.change 
                  : parseFloat(stock.Change || 0);
                
                const changeClass = getChangeColorClass(changeVal.toString());
                const rateText = calculateChangeRate(closingPrice.toString(), changeVal.toString());
                
                // 台灣股市習慣：上漲顯示 "+" 前綴，下跌顯示 "-"，平盤不顯示
                const changePrefix = changeVal > 0 ? '+' : '';

                return (
                  <tr key={stock.Code}>
                    
                    {/* 代號 */}
                    <td data-label="證券代號">
                      <span 
                        onClick={() => onOpenDetail && onOpenDetail(stock.Code)}
                        className="stock-code stock-clickable"
                        title="點擊查看詳細分析"
                      >
                        {stock.Code}
                      </span>
                    </td>
                    
                    {/* 名稱 */}
                    <td data-label="證券名稱">
                      <div 
                        onClick={() => onOpenDetail && onOpenDetail(stock.Code)}
                        className="stock-name-cell stock-clickable" 
                        style={{ fontWeight: 700 }}
                        title="點擊查看詳細分析"
                      >
                        {stock.Name}
                      </div>
                    </td>
                    
                    {/* 收盤價 */}
                    <td data-label="收盤價" style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'Outfit' }}>
                      {closingPrice.toFixed(2)}
                    </td>
                    
                    {/* 漲跌 */}
                    <td data-label="今日漲跌" style={{ textAlign: 'right', fontFamily: 'Outfit' }} className={changeClass}>
                      {changePrefix}{changeVal.toFixed(2)}
                    </td>
                    
                    {/* 漲跌幅 */}
                    <td data-label="漲跌幅" style={{ textAlign: 'right', fontFamily: 'Outfit' }} className={changeClass}>
                      {rateText}
                    </td>
                    
                    {/* 本益比 */}
                    <td data-label="本益比" style={{ textAlign: 'right', fontFamily: 'Outfit' }}>
                      {stock.PEratio !== '' ? parseFloat(stock.PEratio).toFixed(2) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    
                    {/* 殖利率 */}
                    <td data-label="殖利率" style={{ textAlign: 'right', fontFamily: 'Outfit' }} className={parseFloat(stock.DividendYield) >= 5 ? 'up-text' : ''}>
                      {parseFloat(stock.DividendYield).toFixed(2)}%
                    </td>
                    
                    {/* 股價淨值比 */}
                    <td data-label="股價淨值比" style={{ textAlign: 'right', fontFamily: 'Outfit' }}>
                      {stock.PBratio !== '' ? parseFloat(stock.PBratio).toFixed(2) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    
                    {/* 產業別 */}
                    <td data-label="產業別">
                      <span className="badge badge-category">{stock.Category}</span>
                    </td>
                    
                    {/* 操作按鈕 */}
                    <td data-label="操作" style={{ textAlign: 'center' }}>
                      <div className="table-actions" style={{ justifyContent: 'center' }}>
                        
                        {/* 分析按鈕 */}
                        <button 
                          onClick={() => onOpenDetail && onOpenDetail(stock.Code)} 
                          className="btn-icon active-compare"
                          style={{ color: 'var(--accent-blue)', borderColor: 'rgba(56, 189, 248, 0.2)' }}
                          title="查看詳細個股分析與試算"
                        >
                          <Info size={16} />
                        </button>

                        {/* 自選按鈕 */}
                        <button 
                          onClick={() => onToggleWatchlist(stock.Code)} 
                          className={`btn-icon ${isWatched(stock.Code) ? 'active-watchlist' : ''}`}
                          title={isWatched(stock.Code) ? "移出自選股" : "加入自選股"}
                        >
                          <Star size={16} fill={isWatched(stock.Code) ? "var(--accent-gold)" : "none"} />
                        </button>
                        
                        {/* 對比按鈕 */}
                        <button 
                          onClick={() => onToggleCompare(stock.Code)} 
                          className={`btn-icon ${isCompared(stock.Code) ? 'active-compare' : ''}`}
                          title={isCompared(stock.Code) ? "取消對比" : "加入對比清單"}
                        >
                          <ArrowLeftRight size={16} />
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 分頁控制列 */}
      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            顯示第 {startIndex + 1} 至 {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} 檔，共 {totalItems} 檔股票
          </div>
          <div className="pagination-controls">
            
            <button 
              onClick={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage === 1}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.8rem', opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              <ChevronLeft size={16} />
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 600 }}>
              <span style={{ color: 'var(--accent-blue)' }}>{currentPage}</span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span>{totalPages}</span>
            </div>
            
            <button 
              onClick={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage === totalPages}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.8rem', opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
            >
              <ChevronRight size={16} />
            </button>

          </div>
        </div>
      )}
      
    </div>
  );
}
