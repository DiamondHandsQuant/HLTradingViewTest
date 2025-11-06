# Ostium Integration - Multi-Exchange TradingView

## Overview

This TradingView integration now supports **two exchanges**:
- **HyperLiquid** - For crypto assets (BTC, ETH, SOL, etc.)
- **Ostium** - For Real World Assets (RWA) like GOLD, SILVER, SPX, etc.

The exchange is **automatically selected** based on the asset type being viewed - no manual switching required!

## How It Works

### Automatic Exchange Detection

When a user selects a symbol:
1. The app checks if the symbol is an RWA asset
2. **RWA assets** → Automatically uses **Ostium** datafeed with SSE for real-time prices
3. **Crypto assets** → Automatically uses **HyperLiquid** datafeed with WebSocket

### Symbol-to-Exchange Mapping

```javascript
// RWA Symbols (Ostium)
['GOLD', 'SILVER', 'OIL', 'SPX', 'NDX', 'EURUSD', 'GBPUSD']

// Crypto Symbols (HyperLiquid)
['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', etc.]
```

## Technical Implementation

### File Structure

```
├── config.js                    # API credentials for both exchanges
├── hyperliquid-api.js          # HyperLiquid REST + WebSocket
├── ostium-api.js               # Ostium REST + SSE (NEW)
├── datafeed.js                 # HyperLiquid datafeed
├── ostium-datafeed.js          # Ostium datafeed (NEW)
├── app.js                      # Main app with auto-switching logic (UPDATED)
└── index.html                  # HTML page (UPDATED)
```

### Key Components

#### 1. **OstiumAPI Class** (`ostium-api.js`)
- Handles Server-Sent Events (SSE) for real-time price updates
- REST API for historical OHLC data
- Price caching and subscription management
- Automatic reconnection logic

```javascript
// Connect to Ostium SSE
await ostiumAPI.connectSSE();

// Subscribe to price updates
ostiumAPI.subscribe('GOLD', (data) => {
    console.log('Gold price:', data.price);
});
```

#### 2. **OstiumDatafeed Class** (`ostium-datafeed.js`)
- Implements TradingView datafeed interface
- Real-time bar updates from SSE
- Historical data from REST API

#### 3. **Automatic Exchange Switching** (`app.js`)
```javascript
// Determine exchange for symbol
getExchangeForSymbol(symbol) {
    const isRWA = this.rwaSymbols.some(rwa => symbol.includes(rwa));
    return isRWA ? 'OSTIUM' : 'HYPERLIQUID';
}

// Change symbol (auto-switches exchange if needed)
await app.changeSymbol('GOLD'); // → Uses Ostium
await app.changeSymbol('BTC');  // → Uses HyperLiquid
```

## Configuration

Update `config.js` with your Ostium API credentials:

```javascript
const config = {
    ostium: {
        apiURL: 'https://api.ostium.io',
        sseURL: 'https://metadata-backend.ostium.io/price-updates/all-feeds-auth',
        apiKey: 'YOUR_API_KEY',
        apiSecret: 'YOUR_API_SECRET'
    }
};
```

## Real-Time Data Flow

### Ostium (SSE)
```
Ostium SSE Endpoint
    ↓ (Server-Sent Events)
OstiumAPI.connectSSE()
    ↓ (Price updates)
OstiumDatafeed.subscribeBars()
    ↓ (Real-time candles)
TradingView Chart
```

### HyperLiquid (WebSocket)
```
HyperLiquid WebSocket
    ↓ (WebSocket messages)
HyperLiquidAPI.connectWebSocket()
    ↓ (Price updates)
HyperLiquidDatafeed.subscribeBars()
    ↓ (Real-time candles)
TradingView Chart
```

## Usage Example

```javascript
// Initialize app
const app = new TradingViewApp();
await app.init();

// User selects GOLD → Automatically switches to Ostium
await app.changeSymbol('GOLD');
// Chart now shows Ostium data with SSE real-time updates

// User selects BTC → Automatically switches to HyperLiquid
await app.changeSymbol('BTC');
// Chart now shows HyperLiquid data with WebSocket updates
```

## Adding New RWA Symbols

To add more RWA symbols that should use Ostium, update the `rwaSymbols` array in `app.js`:

```javascript
this.rwaSymbols = [
    'GOLD', 'SILVER', 'OIL',     // Commodities
    'SPX', 'NDX',                 // Indices
    'EURUSD', 'GBPUSD',          // Forex
    'AAPL', 'TSLA'               // Add stocks
];
```

## API Endpoints

### Ostium REST API
```
GET  /v1/candles          # Historical OHLC data
GET  /v1/markets          # Available markets
GET  /v1/orderbook/:symbol # Orderbook data
GET  /v1/trades/:symbol    # Recent trades
```

### Ostium SSE Endpoint
```
GET  /price-updates/all-feeds-auth
Authorization: Basic <base64(apiKey:apiSecret)>
Content-Type: text/event-stream
```

## Testing

1. **Test Ostium SSE Connection**:
```javascript
// Open browser console
const api = new OstiumAPI('YOUR_KEY', 'YOUR_SECRET');
await api.connectSSE();
api.subscribe('*', (data) => console.log('Price update:', data));
```

2. **Test Exchange Switching**:
```javascript
// Should use HyperLiquid
await app.changeSymbol('BTC');
console.log('Current exchange:', app.currentExchange); // 'HYPERLIQUID'

// Should use Ostium
await app.changeSymbol('GOLD');
console.log('Current exchange:', app.currentExchange); // 'OSTIUM'
```

## Troubleshooting

### SSE Connection Issues
- Check API credentials in `config.js`
- Verify SSE endpoint URL is correct
- Check browser console for connection errors
- Ensure Basic Auth header is properly formatted

### Chart Not Loading
- Verify symbol is correctly mapped to exchange
- Check console for datafeed errors
- Ensure TradingView library is loaded
- Verify API responses are in correct format

### Symbol Not Switching
- Check if symbol is in `rwaSymbols` array
- Verify `getExchangeForSymbol()` logic
- Check console logs for switching errors

## Performance Notes

- SSE connection is persistent (low overhead)
- Price updates are cached to reduce API calls
- Automatic reconnection on connection loss
- Rate limiting prevents API abuse

## Security

⚠️ **Important**: Never commit API credentials to version control!

- Store credentials in environment variables
- Use `.gitignore` to exclude `config.js`
- Consider using a backend proxy for production
- Rotate API keys regularly

## Future Enhancements

- [ ] Add support for more RWA asset types
- [ ] Implement orderbook display for Ostium
- [ ] Add trade history from Ostium API
- [ ] Cache historical data for faster loading
- [ ] Add symbol search/filtering by exchange
- [ ] Implement error recovery strategies
- [ ] Add metrics/monitoring for SSE connection

