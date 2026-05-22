import React from 'react';
import { 
  X, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Star 
} from 'lucide-react';
import { 
  calculateChangeRate, 
  getChangeColorClass 
} from '../utils/stockUtils';

export default function Watchlist({ 
  stocks, 
  watchlist, 
  onRemoveWatchlist, 
  isOpen, 
  onClose,
  onSelectStock
}) {
  // 1. 獲取自選股的完整數據
  const watchedStocks = stocks.filter(s => watchlist.includes(s.Code));

  return (
    <div className={`watchlist-drawer ${isOpen ? 'open' : ''}`}>
      
      {/* 自選股標頭 */}
      <div className="watchlist-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Star size={20} fill="var(--accent-gold)" color="var(--accent-gold)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>自選追蹤清單</h3>
        </div>
        <button 
          onClick={onClose} 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '50%' }}
          className="btn-icon"
        >
          <X size={20} />
        </button>
      </div>

      {/* 統計家數 */}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', textAlign: 'left' }}>
        目前追蹤：<span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{watchedStocks.length}</span> 檔股票
      </div>

      {/* 自選股列表 */}
      <div className="watchlist-list">
        {watchedStocks.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', height: '60%', color: 'var(--text-muted)', textAlign: 'center' }}>
            <span style={{ fontSize: '2.5rem' }}>⭐</span>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>您的自選清單還是空的</div>
            <p style={{ fontSize: '0.75rem', padding: '0 1rem' }}>
              在主數據列表中點擊星號按鈕即可將股票加入追蹤，隨時掌握股價波動！
            </p>
          </div>
        ) : (
          watchedStocks.map(s => {
            const chg = parseFloat(s.Change) || 0;
            const changeClass = getChangeColorClass(s.Change);
            const rateText = calculateChangeRate(s.ClosingPrice, s.Change);
            
            return (
              <div 
                key={s.Code} 
                className="watchlist-item"
              >
                {/* 點擊股票代號或名稱可直接選中搜尋 */}
                <div 
                  onClick={() => {
                    onSelectStock(s.Code);
                    onClose(); // 關閉側邊欄
                  }}
                  style={{ cursor: 'pointer', flex: 1 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{s.Name}</span>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'Outfit', color: 'var(--text-muted)' }}>{s.Code}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {s.Category}
                  </div>
                </div>

                {/* 股價與漲幅，及移除按鈕 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit' }}>
                      {parseFloat(s.ClosingPrice).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'Outfit', fontWeight: 600 }} className={changeClass}>
                      {chg > 0 ? '+' : ''}{rateText}
                    </div>
                  </div>

                  <button 
                    onClick={() => onRemoveWatchlist(s.Code)}
                    className="btn-icon" 
                    title="移除自選"
                    style={{ padding: '0.25rem', color: 'var(--text-muted)' }}
                  >
                    <Trash2 size={14} style={{ opacity: 0.7 }} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        💡 點擊自選股的股票列，可自動在主畫面為您進行搜尋對齊。
      </div>

    </div>
  );
}
