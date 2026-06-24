# 威力台股情報站

## 前台連結

[開啟威力台股情報站前台](https://zerokemx-ui.github.io/Stock-picker/)

## 專案說明

台股資訊、籌碼解析與投資組合追蹤工具，提供市場總覽、股票篩選、SOP 選股雷達、圖表分析、自選清單、比較清單與 GitHub Actions 雲端更新。

## 常用指令

```bash
npm install
npm run dev
npm run build
```

## 資料管線（全部使用官方真實資料）

每次 `npm run build`（與每日 GitHub Actions）會依序產生 `public/api/` 下的資料：

| 檔案 | 來源 | 內容 |
| --- | --- | --- |
| `company.json` | TWSE OpenAPI t187ap03_L | 上市公司產業別、實收資本額（取代用代碼前綴猜產業） |
| `fundamentals.json` | TWSE OpenAPI t187ap05_L | 每月營收、年增(YoY)、月增(MoM) |
| `stocks.json` | TWSE MI_INDEX + BWIBBU | 當日收盤行情、PE/PB/殖利率、真實產業別 |
| `history.json` | TWSE MI_INDEX（每日追加） | 全市場真實日線 OHLC 序列（保留約 180 個交易日） |
| `chip.json` | TDCC 股權分散 + TWSE T86 | 大戶集中度與三大法人買賣超 |

任一來源抓取失敗時都會安全回退（保留既有檔案或空殼），不會中斷流程，也**不會以亂數捏造資料**。

### 首次建立歷史（重要）

技術面選股（SOP 雷達步驟二/三、個股 K 線、動能/突破策略）需要真實歷史。
`history.json` 由每日累積，初次請執行一次回補：

```bash
node scripts/backfill-history.js        # 回補約 95 個交易日
node scripts/backfill-history.js 260    # 自訂回補天數
```

在歷史尚不足前，SOP 雷達會誠實顯示「資料不足」，而非給出虛構訊號；基本與籌碼初選（步驟一）則已即時使用真實資料。

## 本次重構重點（選股核心）

- 移除所有以股票代碼為種子的假 K 線 / 假基本面 / 假籌碼產生器。
- SOP 雷達、個股圖表、定期定額回測改用真實歷史與真實籌碼/營收。
- 新增多日技術指標（MA、量比、距 20 日高、RSI 等），並據此強化動能/突破策略。
- 產業分類改用官方產業別。
