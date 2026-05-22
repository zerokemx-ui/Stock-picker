import React from 'react';
import { 
  Search, 
  RotateCcw, 
  Coins, 
  TrendingDown, 
  Flame, 
  ShieldCheck, 
  Rocket 
} from 'lucide-react';
import { PRESET_STRATEGIES } from '../utils/stockUtils';

// Map strategy icon string to Lucide icon component
const IconMap = {
  Coins: Coins,
  TrendingDown: TrendingDown,
  Flame: Flame,
  ShieldCheck: ShieldCheck,
  Rocket: Rocket
};

export default function StockFilter({ 
  filters, 
  setFilters, 
  activeStrategy, 
  setActiveStrategy,
  onResetFilters,
  categories,
  selectedCategory,
  setSelectedCategory
}) {

  // Update a single filter field
  const handleFilterChange = (field, val) => {
    // If a preset strategy is active and user starts manually tweaking, clear the strategy selection active state
    if (activeStrategy) {
      setActiveStrategy(null);
    }
    setFilters(prev => ({
      ...prev,
      [field]: val
    }));
  };

  // Click handler for preset strategies
  const handleStrategyClick = (strategyId) => {
    if (activeStrategy === strategyId) {
      // Toggle off
      onResetFilters();
    } else {
      setActiveStrategy(strategyId);
      // Pre-fill filter sliders / inputs to show what the strategy is filtering!
      if (strategyId === 'highYield') {
        setFilters({
          search: '',
          minPrice: '', maxPrice: '',
          minPE: '', maxPE: '15',
          minYield: '5', maxYield: '',
          minPB: '', maxPB: '1.5'
        });
      } else if (strategyId === 'value') {
        setFilters({
          search: '',
          minPrice: '', maxPrice: '',
          minPE: '', maxPE: '12',
          minYield: '3', maxYield: '',
          minPB: '', maxPB: '1.0'
        });
      } else if (strategyId === 'momentum') {
        setFilters({
          search: '',
          minPrice: '', maxPrice: '',
          minPE: '', maxPE: '',
          minYield: '', maxYield: '',
          minPB: '', maxPB: ''
        });
      } else if (strategyId === 'blueChip') {
        setFilters({
          search: '',
          minPrice: '', maxPrice: '',
          minPE: '', maxPE: '',
          minYield: '', maxYield: '',
          minPB: '', maxPB: ''
        });
      } else if (strategyId === 'cheapGrowth') {
        setFilters({
          search: '',
          minPrice: '', maxPrice: '50',
          minPE: '', maxPE: '15',
          minYield: '', maxYield: '',
          minPB: '', maxPB: ''
        });
      }
    }
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
      
      {/* 搜尋與重設列 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* 搜尋框 */}
        <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
          <input 
            type="text" 
            placeholder="搜尋股票代號或名稱 (例如: 2330, 台積電)..." 
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="input-field"
            style={{ paddingLeft: '2.5rem' }}
          />
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>

        {/* 產業篩選 & 清除篩選 */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select 
            value={selectedCategory} 
            onChange={(e) => {
              if (activeStrategy) setActiveStrategy(null);
              setSelectedCategory(e.target.value);
            }}
            className="input-field"
            style={{ width: '160px', cursor: 'pointer' }}
          >
            <option value="All">全部產業別</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button onClick={onResetFilters} className="btn-secondary" title="重設所有篩選條件">
            <RotateCcw size={16} />
            重設
          </button>
        </div>

      </div>

      {/* 進階條件滑桿 / 輸入區 */}
      <div className="filter-grid">
        
        {/* 價格區間 */}
        <div className="filter-group">
          <label className="filter-label">
            <span>股價區間 (元)</span>
          </label>
          <div className="range-inputs">
            <input 
              type="number" 
              placeholder="最低" 
              value={filters.minPrice}
              onChange={(e) => handleFilterChange('minPrice', e.target.value)}
              className="input-field"
            />
            <span className="range-separator">~</span>
            <input 
              type="number" 
              placeholder="最高" 
              value={filters.maxPrice}
              onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        {/* 本益比區間 */}
        <div className="filter-group">
          <label className="filter-label">
            <span>本益比 (PE)</span>
          </label>
          <div className="range-inputs">
            <input 
              type="number" 
              placeholder="最低" 
              value={filters.minPE}
              onChange={(e) => handleFilterChange('minPE', e.target.value)}
              className="input-field"
            />
            <span className="range-separator">~</span>
            <input 
              type="number" 
              placeholder="最高" 
              value={filters.maxPE}
              onChange={(e) => handleFilterChange('maxPE', e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        {/* 殖利率區間 */}
        <div className="filter-group">
          <label className="filter-label">
            <span>殖利率 (%)</span>
          </label>
          <div className="range-inputs">
            <input 
              type="number" 
              placeholder="最低" 
              value={filters.minYield}
              onChange={(e) => handleFilterChange('minYield', e.target.value)}
              className="input-field"
            />
            <span className="range-separator">~</span>
            <input 
              type="number" 
              placeholder="最高" 
              value={filters.maxYield}
              onChange={(e) => handleFilterChange('maxYield', e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        {/* 股價淨值比區間 */}
        <div className="filter-group">
          <label className="filter-label">
            <span>股價淨值比 (PB)</span>
          </label>
          <div className="range-inputs">
            <input 
              type="number" 
              placeholder="最低" 
              value={filters.minPB}
              onChange={(e) => handleFilterChange('minPB', e.target.value)}
              className="input-field"
            />
            <span className="range-separator">~</span>
            <input 
              type="number" 
              placeholder="最高" 
              value={filters.maxPB}
              onChange={(e) => handleFilterChange('maxPB', e.target.value)}
              className="input-field"
            />
          </div>
        </div>

      </div>

      {/* 一鍵策略選股區 */}
      <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem', textAlign: 'left' }}>
          💡 一鍵智慧選股策略 (套用後自動配置適當的篩選器參數)
        </div>
        <div className="strategies-container">
          {Object.values(PRESET_STRATEGIES).map(strat => {
            const IconComponent = IconMap[strat.icon];
            const isActive = activeStrategy === strat.id;
            return (
              <div 
                key={strat.id}
                onClick={() => handleStrategyClick(strat.id)}
                className={`strategy-card ${isActive ? 'active' : ''}`}
                style={{
                  borderLeft: isActive ? '3px solid var(--accent-purple)' : '1px solid var(--border-glass)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', color: isActive ? 'var(--accent-purple)' : 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {IconComponent && <IconComponent size={22} />}
                </div>
                <div className="strategy-name">{strat.name}</div>
                <div className="strategy-desc">{strat.desc}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', marginTop: '0.35rem', fontWeight: 600 }}>
                  {strat.criteriaDesc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
