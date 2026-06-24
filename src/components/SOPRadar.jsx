import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  Activity, 
  Coins, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  HelpCircle,
  Flame,
  ShieldCheck
} from 'lucide-react';
import { checkSOPStrategy } from '../utils/stockUtils';

const ALL_AVAILABLE_SECTORS = [
  '半導體', '電腦週邊', '金融保險', '航運業', '光電業', 
  '電子零組件', '通信網路', '水泥工業', '塑膠工業', 
  '鋼鐵工業', '食品工業', '汽車工業', '其他'
];

export default function SOPRadar({ stocks, onSelectStock, historyData = {}, fundamentalsData = {}, officialChipData = {} }) {
  // 1. 篩選策略狀態
  const [radarMode, setRadarMode] = useState('long'); // 'long' (多頭多單模式), 'short' (空頭空單模式)
  const [hotSectors, setHotSectors] = useState(['半導體', '電腦週邊', '電子零組件']);
  const [maxCapital, setMaxCapital] = useState(50); // 預設 50 億
  const [relaxKD, setRelaxKD] = useState(false);     // 預設不放寬金叉/死叉
  const [collapsedCardCode, setCollapsedCardCode] = useState(null); // 當前打開檢核表的股票代號
  const [filterType, setFilterType] = useState('all_bull'); // 'all_bull' (所有結構股), 'buy_signal' (僅今日進場訊號)

  // 當切換模式時，重置一些狀態
  const handleSwitchMode = (mode) => {
    setRadarMode(mode);
    setCollapsedCardCode(null);
  };

  const isShort = radarMode === 'short';
  const themeAccent = isShort ? 'var(--accent-cyan)' : 'var(--accent-purple)';
  const themeGlow = isShort ? 'drop-shadow(0 0 5px var(--accent-cyan))' : 'drop-shadow(0 0 5px var(--accent-purple))';

  // 2. 進行全台股 SOP 精確篩選
  const screeningResults = useMemo(() => {
    return stocks.map(stock => {
      return checkSOPStrategy(stock, hotSectors, {
        maxCapital,
        relaxKD,
        radarMode,
        history: historyData[stock.Code],
        fundamentals: fundamentalsData[stock.Code],
        chip: officialChipData[stock.Code],
        capitalYi: stock.CapitalYi
      });
    });
  }, [stocks, hotSectors, maxCapital, relaxKD, radarMode, historyData, fundamentalsData, officialChipData]);

  // 是否已有足夠真實歷史可供技術面判定
  const hasRealHistory = useMemo(() => screeningResults.some((r) => r.dataSufficient), [screeningResults]);

  // 3. 計算三步驟漏斗家數
  const funnelStats = useMemo(() => {
    const total = screeningResults.length;
    let pass1 = 0;
    let pass2 = 0;
    let pass3 = 0;

    screeningResults.forEach(r => {
      if (r.passStep1) {
        pass1++;
        if (r.passStep2) {
          pass2++;
          if (r.passStep3) {
            pass3++;
          }
        }
      }
    });

    return { total, pass1, pass2, pass3 };
  }, [screeningResults]);

  // 4. 過濾出多頭/空頭結構股與進場訊號推薦清單
  const trendStocks = useMemo(() => {
    return screeningResults.filter(r => r.passStep2);
  }, [screeningResults]);

  const entrySignalStocks = useMemo(() => {
    return screeningResults.filter(r => r.passStep3);
  }, [screeningResults]);

  const displayedStocks = useMemo(() => {
    return filterType === 'all_bull' ? trendStocks : entrySignalStocks;
  }, [filterType, trendStocks, entrySignalStocks]);

  // 5. 切換板塊多選
  const handleToggleSector = (sector) => {
    setHotSectors(prev => {
      if (prev.includes(sector)) {
        // 至少保留一個板塊
        if (prev.length <= 1) return prev;
        return prev.filter(s => s !== sector);
      } else {
        return [...prev, sector];
      }
    });
  };

  const handleSelectAllSectors = () => {
    setHotSectors(ALL_AVAILABLE_SECTORS);
  };

  const handleClearAllSectors = () => {
    setHotSectors(['半導體']); // 預設保留半導體
  };

  // 6. 切換折疊卡片
  const handleToggleCardCollapse = (code) => {
    setCollapsedCardCode(prev => prev === code ? null : code);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 🚀 頂部控制面板與介紹 */}
      <div className="glass-panel" style={{ padding: '1.5rem 1.75rem', borderLeft: `4px solid ${themeAccent}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={22} style={{ color: themeAccent, filter: themeGlow }} />
              {isShort ? 'SOP 短線空頭放空雷達 (AI SOP Bearish Radar)' : 'SOP 短線多頭飆股雷達 (AI SOP Bullish Radar)'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: '1.5' }}>
              {isShort 
                ? '💡 本系統是一套嚴格的短線空頭放空跟隨模型。首先進行「中小型股本、熱門產業、營收衰退或季虧損且法人連續賣超」的基本籌碼初選；隨後進行「日線頭頭低/底底低、均線空頭向下、KD與MACD死亡交叉」的技術共振比對；最後判定今日 K 線是否觸發「彈後空下跌」或「盤整跌破」放空點，方列入推薦名單。'
                : '💡 本系統是一套嚴格的短線多頭跟隨模型。首先進行「中小型股本、熱門產業、營收年增且法人連續買超」的基本籌碼初選；隨後進行「日線頭頭高/底底高、均線多頭排列向上、KD與MACD黃金交叉」的技術共振比對；最後判定今日 K 線是否觸發「回後買上漲」或「盤整突破」買點，方列入推薦名單。'
              }
            </p>
          </div>
          
          {/* 雙模式切換按鈕 + 重設按鈕 */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--panel-strong)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '3px' }}>
              <button
                onClick={() => handleSwitchMode('long')}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: !isShort ? 'rgba(168, 85, 247, 0.18)' : 'transparent',
                  color: !isShort ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  border: !isShort ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                🐂 多頭多單模式
              </button>
              <button
                onClick={() => handleSwitchMode('short')}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: isShort ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
                  color: isShort ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  border: isShort ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Bear 🐻 空頭空單模式
              </button>
            </div>
            
            <button 
              onClick={() => {
                setHotSectors(['半導體', '電腦週邊', '電子零組件']);
                setMaxCapital(50);
                setRelaxKD(false);
              }}
              className="btn-secondary" 
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}
            >
              重設參數
            </button>
          </div>
        </div>

        {/* 策略核心控制台 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem' }}>
          
          {/* 板塊多選設定 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                步驟一：配置關注板塊 (`hot_sectors` 多選)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSelectAllSectors} style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>全選</button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>|</span>
                <button onClick={handleClearAllSectors} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>清空</button>
              </div>
            </div>
            
            {/* 產業 Badges 點選區 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {ALL_AVAILABLE_SECTORS.map(sec => {
                const isSelected = hotSectors.includes(sec);
                return (
                  <button
                    key={sec}
                    onClick={() => handleToggleSector(sec)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? `1px solid ${themeAccent}` : '1px solid var(--border-glass)',
                      background: isSelected ? (isShort ? 'rgba(6, 182, 212, 0.12)' : 'rgba(168, 85, 247, 0.12)') : 'var(--surface-1)',
                      color: isSelected ? themeAccent : 'var(--text-secondary)',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? `0 2px 8px ${isShort ? 'rgba(6, 182, 212, 0.1)' : 'rgba(168, 85, 247, 0.1)'}` : 'none'
                    }}
                  >
                    {sec}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 其他初選參數與放寬條件 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '0.25rem' }}>
            
            {/* 股本門檻 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                股本限制篩選
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input 
                  type="range" 
                  min="10" 
                  max="150" 
                  step="5"
                  value={maxCapital}
                  onChange={(e) => setMaxCapital(parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: themeAccent, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.82rem', fontFamily: 'Outfit', fontWeight: 700, color: themeAccent, minWidth: '75px', textAlign: 'right' }}>
                  ≤ {maxCapital} 億元
                </span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>排除大型權值股，專注於中小型高波動股。</span>
            </div>

            {/* KD金叉/死叉放寬 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-1)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isShort ? '放寬 KD 死亡交叉時機' : '放寬 KD 黃金交叉時機'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {isShort ? '開啟後將允許「近 3 日內」發生過 KD 死叉' : '開啟後將允許「近 3 日內」發生過 KD 金叉'}
                </div>
              </div>
              
              {/* 美麗開關 */}
              <button
                onClick={() => setRelaxKD(!relaxKD)}
                style={{
                  width: '45px',
                  height: '24px',
                  borderRadius: '12px',
                  background: relaxKD ? themeAccent : 'var(--bg-tertiary)',
                  border: '1px solid var(--border-glass)',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: 0,
                  transition: 'background 0.2s'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: relaxKD ? '23px' : '2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }} />
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* 📊 篩選診斷漏斗儀 與 篩選結果 兩欄版面 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        
        {/* 左側：三步驟診斷漏斗儀 */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={16} style={{ color: 'var(--accent-blue)' }} /> {isShort ? '空頭篩選診斷漏斗 (Bearish Funnel)' : '多頭篩選診斷漏斗 (Bullish Funnel)'}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* 漏斗層級一：基本面與籌碼初選 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {isShort ? '步驟一：基本與籌碼初選 (空頭)' : '步驟一：基本與籌碼初選 (多頭)'}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {funnelStats.pass1} / {funnelStats.total} 檔
                </span>
              </div>
              <div style={{ height: '24px', background: 'var(--surface-2)', border: '1px solid var(--surface-3)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${(funnelStats.pass1 / funnelStats.total * 100) || 0}%`,
                  background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.15) 0%, rgba(56, 189, 248, 0.45) 100%)',
                  height: '100%',
                  transition: 'width 0.5s ease-out'
                }} />
                <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8' }}>
                  {((funnelStats.pass1 / funnelStats.total * 100) || 0).toFixed(1)}% 通過
                </span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {isShort 
                  ? `篩選：股本 ≤ ${maxCapital}億、選定產業、營收年增率 < 0% 或 EPS ≤ 0、三大法人淨賣超。`
                  : `篩選：股本 ≤ ${maxCapital}億、選定產業、營收增長、EPS > 0、三大法人淨買超。`
                }
              </span>
            </div>

            {/* 漏斗層級二：型態與技術指標比對 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {isShort ? '步驟二：型態與指標比對 (空頭)' : '步驟二：型態與指標比對 (多頭)'}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {funnelStats.pass2} / {funnelStats.pass1} 檔
                </span>
              </div>
              <div style={{ height: '24px', background: 'var(--surface-2)', border: '1px solid var(--surface-3)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${(funnelStats.pass2 / funnelStats.pass1 * 100) || 0}%`,
                  background: `linear-gradient(90deg, ${isShort ? 'rgba(6, 182, 212, 0.15)' : 'rgba(168, 85, 247, 0.15)'} 0%, ${isShort ? 'rgba(6, 182, 212, 0.45)' : 'rgba(168, 85, 247, 0.45)'} 100%)`,
                  height: '100%',
                  transition: 'width 0.5s ease-out'
                }} />
                <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', fontWeight: 800, color: themeAccent }}>
                  {((funnelStats.pass2 / funnelStats.pass1 * 100) || 0).toFixed(1)}% 通過
                </span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {isShort 
                  ? '篩選：MA10 < MA20 且向下排列、今日收盤在均線下、MACD綠柱增長、KD死亡交叉、頭頭低底底低。'
                  : '篩選：MA10 > MA20 且向上排列、今日收盤在均線上、MACD紅柱增長、KD黃金交叉、頭頭高底底高。'
                }
              </span>
            </div>

            {/* 漏斗層級三：進場訊號確認 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {isShort ? '步驟三：放空觸發訊號確認' : '步驟三：買進觸發訊號確認'}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {funnelStats.pass3} / {funnelStats.pass2} 檔
                </span>
              </div>
              <div style={{ height: '24px', background: 'var(--surface-2)', border: '1px solid var(--surface-3)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${(funnelStats.pass3 / funnelStats.pass2 * 100) || 0}%`,
                  background: `linear-gradient(90deg, ${isShort ? 'rgba(0, 230, 118, 0.15)' : 'rgba(245, 158, 11, 0.15)'} 0%, ${isShort ? 'rgba(0, 230, 118, 0.45)' : 'rgba(245, 158, 11, 0.45)'} 100%)`,
                  height: '100%',
                  transition: 'width 0.5s ease-out'
                }} />
                <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', fontWeight: 800, color: isShort ? 'var(--stock-down)' : 'var(--accent-gold)' }}>
                  {((funnelStats.pass3 / funnelStats.pass2 * 100) || 0).toFixed(1)}% 通過
                </span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {isShort 
                  ? '篩選：今日收大綠 K 棒破昨低（情境A：彈後空下跌）或大綠 K 摜破區間低（情境B：盤整跌破），且放量。'
                  : '篩選：今日收大紅 K 棒過昨高（情境A：回後買上漲）或大紅 K 突破區間高（情境B：盤整突破），且放量。'
                }
              </span>
            </div>

          </div>

          {/* 總結說明 */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-3)', borderRadius: '12px', padding: '1rem', marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.45', margin: 0 }}>
              <strong>💡 提示</strong>：SOP {isShort ? '空頭放空' : '多頭飆股'}篩選公式極為嚴格。若結果偏少，可點擊上方<strong>「重設參數」</strong>、包含更多產業，或開啟<strong>「放寬 KD 時機」</strong>。
            </p>
          </div>
        </div>

        {/* 右側：篩選結果與精緻摺疊卡片 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!hasRealHistory && (
            <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={20} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                <strong>尚無足夠真實歷史資料</strong>：技術面判定（步驟二、三）需要每檔至少約 35 個交易日的真實日線。請先於專案根目錄執行 <code>node scripts/backfill-history.js</code> 回補歷史，或等每日 GitHub Actions 自動累積數週後即會生效。基本與籌碼初選（步驟一）已使用真實資料。
              </p>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              🚀 {isShort ? '空頭趨勢結構追蹤清單' : '多頭趨勢結構追蹤清單'}：
              <span style={{ color: filterType === 'all_bull' ? 'var(--accent-blue)' : themeAccent, fontWeight: 900 }}>
                {displayedStocks.length}
              </span> 檔股票
            </h3>
            
            {/* 篩選切換開關 */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--panel-strong)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '3px' }}>
              <button
                onClick={() => setFilterType('all_bull')}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: 'none',
                  background: filterType === 'all_bull' ? 'var(--bg-tertiary)' : 'transparent',
                  color: filterType === 'all_bull' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                {isShort ? `📉 所有空頭結構股 (${trendStocks.length})` : `📈 所有多頭結構股 (${trendStocks.length})`}
              </button>
              <button
                onClick={() => setFilterType('buy_signal')}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: 'none',
                  background: filterType === 'buy_signal' ? 'var(--bg-tertiary)' : 'transparent',
                  color: filterType === 'buy_signal' ? themeAccent : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                {isShort ? `💥 僅今日放空訊號 (${entrySignalStocks.length})` : `💥 僅今日進場訊號 (${entrySignalStocks.length})`}
              </button>
            </div>
          </div>

          {displayedStocks.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2.5rem' }}>{isShort ? '🐻' : '💤'}</div>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700 }}>
                {isShort 
                  ? (filterType === 'all_bull' ? '目前條件下暫無符合空頭結構之股票' : '今日市場暫無符合空頭 SOP 放空訊號之股票')
                  : (filterType === 'all_bull' ? '目前條件下暫無符合多頭結構之股票' : '今日市場暫無符合多頭 SOP 進場訊號之飆股')}
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', maxWidth: '420px', lineHeight: '1.5' }}>
                {isShort 
                  ? '目前正處於多頭強勢市場，空頭訊號極其珍貴。建議可以增加關注板塊，或切換回「多頭多單模式」賺取主波段波段收益。'
                  : '雖然有股票正處於多頭波段中，但今天剛好沒有觸發「回後買上漲」的黃金起漲點。您可以切換至「所有多頭結構股」來追蹤波段強勢股。'
                }
              </p>
            </div>
          ) : (
            displayedStocks.map(s => {
              const isOpen = collapsedCardCode === s.code;
              return (
                <div 
                  key={s.code} 
                  className="glass-card" 
                  style={{ 
                    padding: '0', 
                    overflow: 'hidden', 
                    border: isOpen ? `1px solid ${themeAccent}4d` : '1px solid var(--border-glass)',
                    boxShadow: isOpen ? `0 8px 30px ${isShort ? 'rgba(6, 182, 212, 0.12)' : 'rgba(168, 85, 247, 0.12)'}` : 'none',
                    transition: 'all 0.25s ease' 
                  }}
                >
                  
                  {/* 卡片標頭列 */}
                  <div 
                    onClick={() => handleToggleCardCollapse(s.code)}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '1.25rem 1.5rem', 
                      cursor: 'pointer',
                      background: isOpen ? (isShort ? 'rgba(6, 182, 212, 0.02)' : 'rgba(168, 85, 247, 0.02)') : 'transparent',
                      transition: 'background 0.2s'
                    }}
                  >
                    
                    {/* 股票基本資料 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span 
                        onClick={(e) => {
                          e.stopPropagation(); // 阻止折疊觸發
                          onSelectStock(s.code);
                        }}
                        style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.85rem', color: 'var(--accent-blue)', background: 'rgba(56,189,248,0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                        title="點擊查看詳細分析"
                      >
                        {s.code}
                      </span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)' }}>{s.name}</span>
                          <span className="badge badge-category">{s.category}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          收盤價：<span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{s.price.toFixed(2)} 元</span>
                          <span style={{ margin: '0 4px' }}>·</span>
                          漲跌幅：<span style={{ color: s.changeRate >= 0 ? 'var(--stock-up)' : 'var(--stock-down)', fontWeight: 700 }}>{s.changeRate >= 0 ? `+${s.changeRate.toFixed(2)}%` : `${s.changeRate.toFixed(2)}%`}</span>
                        </div>
                      </div>
                    </div>

                    {/* 情境與進場點標章 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {s.passStep3 ? (
                        isShort ? (
                          s.scenario === 'A' ? (
                            <span className="live-badge" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', background: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.25)', color: 'var(--stock-down)', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <TrendingDown size={12} /> 💥 彈後空下跌 (情境 A)
                            </span>
                          ) : (
                            <span className="live-badge" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.25)', color: 'var(--accent-cyan)', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <ShieldCheck size={12} /> 💥 盤整跌破 (情境 B)
                            </span>
                          )
                        ) : (
                          s.scenario === 'A' ? (
                            <span className="live-badge" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.25)', color: '#ff4d4d', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Flame size={12} style={{ fill: '#ff4d4d' }} /> 💥 回後買上漲 (情境 A)
                            </span>
                          ) : (
                            <span className="live-badge" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', color: 'var(--accent-purple)', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <ShieldCheck size={12} /> 💥 盤整突破 (情境 B)
                            </span>
                          )
                        )
                      ) : (
                        isShort ? (
                          <span className="live-badge" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <TrendingDown size={12} /> 📉 空頭趨勢股 (通道中)
                          </span>
                        ) : (
                          <span className="live-badge" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', color: 'var(--accent-blue)', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <TrendingUp size={12} /> 📈 多頭趨勢股 (波段中)
                          </span>
                        )
                      )}
                      {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                    </div>

                  </div>

                  {/* 展開後的 SOP 指標通過檢核表 */}
                  {isOpen && (
                    <div style={{ 
                      padding: '1.25rem 1.5rem', 
                      background: 'rgba(0,0,0,0.25)', 
                      borderTop: '1px solid var(--border-glass)',
                      animation: 'slide-up-fade 0.2s ease-out'
                    }}>
                      
                      <h5 style={{ fontSize: '0.78rem', fontWeight: 800, color: themeAccent, marginBottom: '0.75rem' }}>
                        📋 SOP 核心篩選指標通過檢測清單 (Diagnostics Checklist)
                      </h5>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.75rem' }}>
                        
                        {/* 步驟一詳細檢核 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingRight: '0.5rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--surface-2)', paddingBottom: '0.3rem', marginBottom: '0.25rem' }}>
                            步驟一：基本與籌碼過濾
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>總股本限制:</span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {s.capital == null ? 'N/A' : s.capital + ' 億'} ( {s.isCapitalOk ? <CheckCircle2 size={12} color="#22c55e" /> : <XCircle size={12} color="#ff4d4d" />} )
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {isShort ? '單月營收衰退 (YoY/MoM):' : '單月營收年增 (YoY/MoM):'}
                            </span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {s.revenueGrowth == null ? '資料不足' : s.revenueGrowth + '%'} ( {s.isRevenueOk ? <CheckCircle2 size={12} color="#22c55e" /> : <XCircle size={12} color="#ff4d4d" />} )
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {isShort ? '最新單季 EPS (虧損/微利):' : '最新單季 EPS:'}
                            </span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {s.eps == null ? '資料不足' : s.eps + ' 元'} ( {s.isEpsOk ? <CheckCircle2 size={12} color="#22c55e" /> : <XCircle size={12} color="#ff4d4d" />} )
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {isShort ? '法人3日累計籌碼 (淨賣超):' : '法人3日累計籌碼 (淨買超):'}
                            </span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {s.chipNetBuy == null ? '資料不足' : (s.chipNetBuy > 0 ? '+' + s.chipNetBuy : s.chipNetBuy) + ' 張'} ( {s.isChipOk ? <CheckCircle2 size={12} color="#22c55e" /> : <XCircle size={12} color="#ff4d4d" />} )
                            </span>
                          </div>
                        </div>

                        {/* 步驟二詳細檢核 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', borderLeft: '1px solid var(--surface-3)', paddingLeft: '0.75rem' }}>
                          <div style={{ fontWeight: 700, color: themeAccent, borderBottom: '1px solid var(--surface-2)', paddingBottom: '0.3rem', marginBottom: '0.25rem' }}>
                            步驟二：技術指標與型態
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {isShort ? '日均線空頭排列 (MA10 < MA20):' : '日均線多頭排列 (MA10 > MA20):'}
                            </span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {s.isMAAlignmentOk ? (isShort ? "空排且向下" : "多排且向上") : "排列不符"} ( {s.isMAAlignmentOk ? <CheckCircle2 size={12} color="#22c55e" /> : <XCircle size={12} color="#ff4d4d" />} )
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {isShort ? '股價收在均線之下 (Close < MA):' : '股價收在均線之上 (Close > MA):'}
                            </span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {s.isPricePositionOk ? (isShort ? "均線之下" : "安全線上") : "位置不符"} ( {s.isPricePositionOk ? <CheckCircle2 size={12} color="#22c55e" /> : <XCircle size={12} color="#ff4d4d" />} )
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {isShort ? 'MACD綠柱增長/紅柱縮短:' : 'MACD紅柱增長/綠柱縮短:'}
                            </span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {s.historyData.macd > 0 ? "紅柱走勢" : "綠柱走勢"} ( {s.isMACDOk ? <CheckCircle2 size={12} color="#22c55e" /> : <XCircle size={12} color="#ff4d4d" />} )
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {isShort ? '日線 KD 死亡交叉:' : '日線 KD 黃金交叉:'}
                            </span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              K:{s.historyData.K.toFixed(1)} vs D:{s.historyData.D.toFixed(1)} ( {s.isKDCrossOk ? <CheckCircle2 size={12} color="#22c55e" /> : <XCircle size={12} color="#ff4d4d" />} )
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {isShort ? '空頭軌道（頭頭低底底低）:' : '多頭軌道（頭頭高底底高）:'}
                            </span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {isShort ? '符合空頭結構' : '符合多頭結構'} ( {s.isTrendOk ? <CheckCircle2 size={12} color="#22c55e" /> : <XCircle size={12} color="#ff4d4d" />} )
                            </span>
                          </div>
                        </div>

                      </div>

                      {/* 決策按鈕 */}
                      <div style={{ borderTop: '1px solid var(--surface-3)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          * 註：該結果基於台股{isShort ? '空頭' : '多頭'}經典 SOP 公式進行即時運算，投資仍需控制部位風險。
                        </span>
                        <button 
                          onClick={() => onSelectStock(s.code)}
                          className="btn-primary"
                          style={{ 
                            padding: '0.45rem 1.25rem', 
                            fontSize: '0.78rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            background: isShort ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' : 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
                            border: 'none',
                            boxShadow: isShort ? '0 0 15px rgba(6, 182, 212, 0.4)' : '0 0 15px rgba(168, 85, 247, 0.4)'
                          }}
                        >
                          🔍 {isShort ? '立即開啟個股 AI 診斷與放空損益試算' : '立即開啟個股 AI 診斷與損益試算'}
                        </button>
                      </div>

                    </div>
                  )}

                </div>
              );
            })
          )}

        </div>

      </div>
      
    </div>
  );
}
