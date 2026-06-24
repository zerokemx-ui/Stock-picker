import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RotateCcw, 
  Coins, 
  TrendingDown, 
  Flame, 
  ShieldCheck, 
  Rocket,
  Wrench,
  X
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
  setSelectedCategory,
  allStrategies = PRESET_STRATEGIES,
  onAddCustomStrategy,
  onDeleteCustomStrategy
}) {

  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [stratName, setStratName] = useState('');
  const [stratDesc, setStratDesc] = useState('');
  const [stratCriteria, setStratCriteria] = useState({
    minPrice: '', maxPrice: '',
    minPE: '', maxPE: '',
    minYield: '', maxYield: '',
    minPB: '', maxPB: ''
  });

  // 當打開編輯器時，自動帶入目前的篩選器值作為預設值
  useEffect(() => {
    if (isCreatorOpen) {
      setStratCriteria({
        minPrice: filters.minPrice || '',
        maxPrice: filters.maxPrice || '',
        minPE: filters.minPE || '',
        maxPE: filters.maxPE || '',
        minYield: filters.minYield || '',
        maxYield: filters.maxYield || '',
        minPB: filters.minPB || '',
        maxPB: filters.maxPB || ''
      });
      if (!stratName) {
        setStratName('自訂策略 #' + (Object.keys(allStrategies).length - 4));
      }
    }
  }, [isCreatorOpen]);

  const handleSaveStrategy = (e) => {
    e.preventDefault();
    if (!stratName.trim()) {
      alert("請輸入策略名稱！");
      return;
    }

    // 建立策略文字說明
    const descParts = [];
    if (stratCriteria.minPrice || stratCriteria.maxPrice) {
      descParts.push(`價 ${stratCriteria.minPrice || 0}~${stratCriteria.maxPrice || '∞'}`);
    }
    if (stratCriteria.minPE || stratCriteria.maxPE) {
      descParts.push(`PE ${stratCriteria.minPE || 0}~${stratCriteria.maxPE || '∞'}`);
    }
    if (stratCriteria.minYield || stratCriteria.maxYield) {
      descParts.push(`殖 ${stratCriteria.minYield || 0}~${stratCriteria.maxYield || '∞'}%`);
    }
    if (stratCriteria.minPB || stratCriteria.maxPB) {
      descParts.push(`PB ${stratCriteria.minPB || 0}~${stratCriteria.maxPB || '∞'}`);
    }
    const criteriaDesc = descParts.length > 0 ? descParts.join(' | ') : '無限制條件';

    const newStrategy = {
      id: 'custom_' + Date.now(),
      name: stratName,
      desc: stratDesc || '自訂篩選策略',
      criteriaDesc,
      criteria: { ...stratCriteria }
    };

    onAddCustomStrategy(newStrategy);
    setStratName('');
    setStratDesc('');
    setIsCreatorOpen(false);
  };

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

  // Click handler for preset and custom strategies
  const handleStrategyClick = (strategyId) => {
    if (activeStrategy === strategyId) {
      // Toggle off
      onResetFilters();
    } else {
      setActiveStrategy(strategyId);
      const strat = allStrategies[strategyId];
      if (strat) {
        if (strat.isCustom) {
          setFilters({
            search: '',
            minPrice: strat.criteria.minPrice || '',
            maxPrice: strat.criteria.maxPrice || '',
            minPE: strat.criteria.minPE || '',
            maxPE: strat.criteria.maxPE || '',
            minYield: strat.criteria.minYield || '',
            maxYield: strat.criteria.maxYield || '',
            minPB: strat.criteria.minPB || '',
            maxPB: strat.criteria.maxPB || ''
          });
        } else {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left' }}>
            💡 一鍵智慧選股策略 (套用後自動配置適當的篩選器參數)
          </div>
          <button 
            onClick={() => setIsCreatorOpen(!isCreatorOpen)}
            className="btn-secondary" 
            style={{ 
              padding: '0.4rem 0.8rem', 
              fontSize: '0.8rem', 
              borderColor: 'var(--accent-purple)', 
              color: 'var(--accent-purple)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Wrench size={12} /> {isCreatorOpen ? '關閉策略編輯器' : '建立自訂策略'}
          </button>
        </div>

        {/* 自訂策略建立面板 */}
        {isCreatorOpen && (
          <div 
            className="glass-panel" 
            style={{ 
              background: 'rgba(168, 85, 247, 0.04)', 
              border: '1px solid rgba(168, 85, 247, 0.25)', 
              borderRadius: '12px', 
              padding: '1.5rem', 
              marginBottom: '1.25rem',
              animation: 'slide-up-fade 0.25s ease-out'
            }}
          >
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-purple)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wrench size={16} /> 🛠&nbsp;建立您的自訂選股策略
            </h4>
            <form onSubmit={handleSaveStrategy} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>策略名稱 (必填)</label>
                  <input 
                    type="text" 
                    placeholder="例如: 便宜超值小鋼炮"
                    value={stratName}
                    onChange={(e) => setStratName(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>描述/備忘 (選填)</label>
                  <input 
                    type="text" 
                    placeholder="例如: 低PE、低PB且殖利率大於4%的股票"
                    value={stratDesc}
                    onChange={(e) => setStratDesc(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              {/* 門檻值預覽與調整 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--surface-2)' }}>
                {/* 價格 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>價格區間 (元)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="number" 
                      placeholder="最低" 
                      value={stratCriteria.minPrice}
                      onChange={(e) => setStratCriteria(prev => ({ ...prev, minPrice: e.target.value }))}
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', width: '100%', background: 'var(--surface-1)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'var(--text-primary)' }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>~</span>
                    <input 
                      type="number" 
                      placeholder="最高" 
                      value={stratCriteria.maxPrice}
                      onChange={(e) => setStratCriteria(prev => ({ ...prev, maxPrice: e.target.value }))}
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', width: '100%', background: 'var(--surface-1)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                {/* PE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>本益比 PE</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="number" 
                      placeholder="最低" 
                      value={stratCriteria.minPE}
                      onChange={(e) => setStratCriteria(prev => ({ ...prev, minPE: e.target.value }))}
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', width: '100%', background: 'var(--surface-1)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'var(--text-primary)' }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>~</span>
                    <input 
                      type="number" 
                      placeholder="最高" 
                      value={stratCriteria.maxPE}
                      onChange={(e) => setStratCriteria(prev => ({ ...prev, maxPE: e.target.value }))}
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', width: '100%', background: 'var(--surface-1)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                {/* PB */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>股價淨值比 PB</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="number" 
                      placeholder="最低" 
                      value={stratCriteria.minPB}
                      onChange={(e) => setStratCriteria(prev => ({ ...prev, minPB: e.target.value }))}
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', width: '100%', background: 'var(--surface-1)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'var(--text-primary)' }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>~</span>
                    <input 
                      type="number" 
                      placeholder="最高" 
                      value={stratCriteria.maxPB}
                      onChange={(e) => setStratCriteria(prev => ({ ...prev, maxPB: e.target.value }))}
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', width: '100%', background: 'var(--surface-1)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                {/* Yield */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>殖利率 (%)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="number" 
                      placeholder="最低" 
                      value={stratCriteria.minYield}
                      onChange={(e) => setStratCriteria(prev => ({ ...prev, minYield: e.target.value }))}
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', width: '100%', background: 'var(--surface-1)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'var(--text-primary)' }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>~</span>
                    <input 
                      type="number" 
                      placeholder="最高" 
                      value={stratCriteria.maxYield}
                      onChange={(e) => setStratCriteria(prev => ({ ...prev, maxYield: e.target.value }))}
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', width: '100%', background: 'var(--surface-1)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsCreatorOpen(false)} 
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem' }}
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  style={{ padding: '0.5rem 1.5rem', fontSize: '0.8rem', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)', boxShadow: '0 2px 10px rgba(168, 85, 247, 0.4)' }}
                >
                  💾 儲存並啟用策略
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="strategies-container">
          {Object.values(allStrategies).map(strat => {
            const IconComponent = IconMap[strat.icon] || Rocket;
            const isActive = activeStrategy === strat.id;
            return (
              <div 
                key={strat.id}
                onClick={() => handleStrategyClick(strat.id)}
                className={`strategy-card ${isActive ? 'active' : ''}`}
                style={{
                  borderLeft: isActive ? '3px solid var(--accent-purple)' : '1px solid var(--border-glass)',
                  position: 'relative'
                }}
              >
                {/* 如果是自訂策略，渲染一個小刪除按鈕 */}
                {strat.isCustom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // 阻止觸發卡片點擊
                      onDeleteCustomStrategy(strat.id);
                    }}
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      background: 'rgba(255, 77, 77, 0.1)',
                      color: 'var(--stock-up)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '0.65rem',
                      padding: '0',
                      zIndex: 10,
                      transition: 'all 0.2s ease'
                    }}
                    title="刪除此自訂策略"
                  >
                    ✕
                  </button>
                )}

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
