# 🔄 Unified Datafeed Architecture

## Overview

The **Unified Datafeed** seamlessly combines HyperLiquid (crypto) and Ostium (RWA) exchanges into a single TradingView datafeed. Users can search and switch between any symbol without knowing which exchange it's on.

---

## 🎯 Key Features

✅ **Transparent Exchange Routing** - Automatically routes symbols to the correct exchange  
✅ **Unified Symbol Search** - Search across both exchanges simultaneously  
✅ **Seamless Switching** - No manual exchange selection needed  
✅ **Parallel Data Streams** - Real-time updates from both exchanges concurrently  
✅ **Smart Symbol Resolution** - Handles different symbol formats (BTC, BTCUSD, EURUSD, SPX)

---

## 📊 Symbol Distribution

### HyperLiquid Symbols (Crypto)
- BTC, ETH, SOL, AVAX, MATIC, DOGE, etc.
- Format: `HYPERLIQUID:BTCUSD`

### Ostium Symbols (RWA - Test)
- SPX (S&P 500 Index)
- EURUSD (EUR/USD Forex Pair)
- Format: `OSTIUM:SPX`, `OSTIUM:EURUSD`

---

## 🔧 How It Works

### 1. Initialization Flow

```javascript
App starts
    ↓
UnifiedDatafeed created
    ↓
Initialize both datafeeds in parallel:
    ├─ HyperLiquidDatafeed.initialize()
    └─ OstiumDatafeed.initialize()
    ↓
Build symbolExchangeMap:
    ├─ BTC → HYPERLIQUID
    ├─ ETH → HYPERLIQUID
    ├─ SPX → OSTIUM
    └─ EURUSD → OSTIUM
    ↓
TradingView widget loads with unified datafeed
```

### 2. Symbol Search Flow

```javascript
User types "SPX" in search
    ↓
UnifiedDatafeed.searchSymbols("SPX")
    ↓
Parallel search:
    ├─ HyperLiquidDatafeed.searchSymbols("SPX") → []
    └─ OstiumDatafeed.searchSymbols("SPX") → [SPX result]
    ↓
Combine results → Return all matches
    ↓
User sees: "SPX - S&P 500 Index (OSTIUM)"
```

### 3. Symbol Resolution Flow

```javascript
User selects "SPX"
    ↓
UnifiedDatafeed.resolveSymbol("OSTIUM:SPX")
    ↓
Extract symbol: "SPX"
    ↓
getExchangeForSymbol("SPX")
    ├─ Check if in rwaSymbols: ['SPX', 'EURUSD']
    └─ Found! → Return 'OSTIUM'
    ↓
Route to OstiumDatafeed.resolveSymbol()
    ↓
Return symbol info with Ostium config
```

### 4. Historical Data Flow

```javascript
TradingView requests bars for "SPX"
    ↓
UnifiedDatafeed.getBars(symbolInfo, ...)
    ↓
getExchangeForSymbol("SPX") → 'OSTIUM'
    ↓
Route to OstiumDatafeed.getBars()
    ↓
OstiumAPI.getCandles() → Fetch from Ostium REST API
    ↓
Return OHLCV bars to TradingView
```

### 5. Real-time Updates Flow

```javascript
TradingView subscribes to "SPX" real-time
    ↓
UnifiedDatafeed.subscribeBars(symbolInfo, ...)
    ↓
getExchangeForSymbol("SPX") → 'OSTIUM'
    ↓
Track subscription: subscriberUID → {exchange: 'OSTIUM', ...}
    ↓
Route to OstiumDatafeed.subscribeBars()
    ↓
OstiumAPI.subscribe() → Connect to SSE stream
    ↓
Real-time price updates flow to TradingView
```

---

## 🗺️ Symbol Routing Logic

```javascript
function getExchangeForSymbol(symbolName) {
    // 1. Remove exchange prefix
    let cleanSymbol = symbolName.replace(/^(HYPERLIQUID|OSTIUM):/, '');
    
    // 2. Remove USD suffix (except for forex pairs)
    let testSymbol = cleanSymbol.replace(/USD$/, '');
    
    // 3. Check RWA symbols list
    if (rwaSymbols.includes(testSymbol)) {
        return 'OSTIUM';  // SPX, EURUSD → OSTIUM
    }
    
    // 4. Check symbol exchange map
    if (symbolExchangeMap.has(cleanSymbol)) {
        return symbolExchangeMap.get(cleanSymbol);
    }
    
    // 5. Default to HyperLiquid for crypto
    return 'HYPERLIQUID';  // BTC, ETH, etc. → HYPERLIQUID
}
```

---

## 📡 Datafeed Methods Implementation

| Method | Description | Routing |
|--------|-------------|---------|
| `onReady()` | Return merged config from both exchanges | Combined |
| `searchSymbols()` | Search across both exchanges | Parallel |
| `resolveSymbol()` | Get symbol details | Routed by symbol |
| `getBars()` | Fetch historical data | Routed by symbol |
| `subscribeBars()` | Real-time updates | Routed by symbol |
| `unsubscribeBars()` | Stop real-time updates | Routed by subscription |

---

## 🔍 Testing the Unified Datafeed

### In Browser Console:

```javascript
// Search will now find symbols from BOTH exchanges
// Just use TradingView's built-in search

// Or programmatically:
window.tradingViewApp.widget.chart().setSymbol('OSTIUM:SPX');
window.tradingViewApp.widget.chart().setSymbol('HYPERLIQUID:BTCUSD');
window.tradingViewApp.widget.chart().setSymbol('OSTIUM:EURUSD');
```

### Expected Behavior:

1. ✅ Search for "BTC" → Shows BTC (HYPERLIQUID)
2. ✅ Search for "SPX" → Shows SPX (OSTIUM)
3. ✅ Search for "EUR" → Shows EURUSD (OSTIUM)
4. ✅ Switching between symbols happens seamlessly
5. ✅ Real-time updates work for both exchanges

---

## 🎨 Architecture Diagram

```
┌─────────────────────────────────────────┐
│        TradingView Widget               │
│  (User searches/selects symbols)        │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│       UnifiedDatafeed                   │
│  ┌───────────────────────────────────┐  │
│  │  Symbol Routing Logic             │  │
│  │  • getExchangeForSymbol()         │  │
│  │  • symbolExchangeMap              │  │
│  │  • rwaSymbols list                │  │
│  └───────────────────────────────────┘  │
└─────────────┬───────────────────────────┘
              │
     ┌────────┴────────┐
     │                 │
     ↓                 ↓
┌─────────┐      ┌─────────┐
│Hyperliquid│    │ Ostium  │
│Datafeed   │    │Datafeed │
└─────┬─────┘    └────┬────┘
      │               │
      ↓               ↓
┌─────────┐      ┌─────────┐
│Hyperliquid│    │ Ostium  │
│   API     │    │   API   │
│(WebSocket)│    │  (SSE)  │
└───────────┘    └─────────┘
```

---

## 🚀 Benefits

### For Users:
- 🎯 **Single Interface** - One search box for all symbols
- 🔄 **Seamless Switching** - No manual exchange selection
- 📊 **Unified Experience** - Same UI for crypto and RWA assets

### For Developers:
- 🧹 **Clean Architecture** - Single datafeed interface
- 🔌 **Easy Extension** - Add new exchanges easily
- 🐛 **Easier Debugging** - Centralized routing logic
- ♻️ **Code Reuse** - Both exchanges use same patterns

---

## 📝 Key Files

- `unified-datafeed.js` - Main unified datafeed class
- `datafeed.js` - HyperLiquid datafeed implementation
- `ostium-datafeed.js` - Ostium datafeed implementation
- `app.js` - Application logic (simplified)
- `hyperliquid-api.js` - HyperLiquid API client
- `ostium-api.js` - Ostium API client

---

## 🐛 Debugging

Enable detailed logging in browser console:

```javascript
// Check which symbols are registered
console.log(window.tradingViewApp.datafeed.symbolExchangeMap);

// Check which exchange a symbol maps to
console.log(window.tradingViewApp.datafeed.getExchangeForSymbol('SPX'));
// → 'OSTIUM'

console.log(window.tradingViewApp.datafeed.getExchangeForSymbol('BTC'));
// → 'HYPERLIQUID'

// Check active subscriptions
console.log(window.tradingViewApp.datafeed.activeSubscriptions);
```

---

## ✨ Future Enhancements

- [ ] Add more RWA symbols (GOLD, SILVER, OIL, etc.)
- [ ] Implement order book for Ostium (if available)
- [ ] Add symbol favorites/watchlist
- [ ] Cache symbol data for faster searches
- [ ] Add symbol comparison across exchanges
- [ ] Implement cross-exchange analytics

---

Made with ❤️ for seamless multi-exchange trading

