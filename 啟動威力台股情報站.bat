@echo off
title 啟動威力台股情報站
chcp 65001 >nul
echo =======================================================
echo     🚀 歡迎使用「威力台股情報站」一鍵啟動程式 🚀
echo =======================================================
echo.
echo [步驟 1] 正在導航至專案資料夾 (E:\stock-picker)...
E:
cd \stock-picker
echo.
echo [步驟 2] 正在自動為您在瀏覽器中打開威力台股情報站網頁...
start http://localhost:5173/
echo.
echo [步驟 3] 正在同步證交所數據並啟動本地伺服器，請勿關閉此視窗...
echo.
npm run dev
pause
