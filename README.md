# HyperLiquid TradingView Advanced Demo

A sophisticated trading interface that integrates TradingView Advanced Charts with HyperLiquid's API for real-time cryptocurrency trading data.

## Features

- **TradingView Advanced Charts Integration**: Full-featured charting with professional trading tools
- **HyperLiquid API Integration**: Real-time market data and historical candle data
- **WebSocket Real-time Updates**: Live price updates and candle streaming
- **Professional UI**: Dark theme interface matching modern trading platforms
- **Drawing Tools**: Complete set of technical analysis drawing tools
- **Multiple Timeframes**: Support for various chart intervals (1m, 5m, 1h, 1D, etc.)
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Open your browser** and navigate to `http://localhost:8080`

## Project Structure

```
TvAdvancedDemoHL/
├── index.html              # Main HTML file
├── styles.css              # Main application styles
├── custom_chart.css        # TradingView chart custom styles
├── app.js                  # Main application logic
├── datafeed.js            # TradingView datafeed implementation
├── hyperliquid-api.js     # HyperLiquid API integration
├── package.json           # Project dependencies
└── README.md              # This file
```

## API Integration

### HyperLiquid REST API

The application uses HyperLiquid's REST API endpoints:

- **Candle Data**: `POST /info` with `type: "candleSnapshot"`
- **Market Data**: `POST /info` with `type: "allMids"`
- **Metadata**: `POST /info` with `type: "meta"`

### WebSocket Integration

Real-time data is streamed via WebSocket connection:

- **URL**: `wss://api.hyperliquid.xyz/ws`
- **Subscription**: `{"method": "subscribe", "subscription": {"type": "candle", "coin": "BTC", "interval": "1m"}}`

## Supported Features

### Chart Features
- Candlestick charts with OHLCV data
- Multiple timeframes (1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w)
- Real-time price updates
- Volume indicators
- Professional dark theme

### Drawing Tools
- Trend lines
- Horizontal/Vertical lines
- Rectangles and circles
- Fibonacci retracements
- Text annotations
- Brush and eraser tools
- Measurement tools

### UI Controls
- Symbol switching
- Timeframe selection
- Fullscreen mode
- Auto-scale and log-scale options
- Technical indicators
- Chart settings

## Technical Implementation

### TradingView Datafeed

The `HyperLiquidDatafeed` class implements the TradingView Charting Library datafeed interface:

- `onReady()`: Provides chart configuration
- `resolveSymbol()`: Resolves symbol information
- `getBars()`: Fetches historical data
- `subscribeBars()`: Subscribes to real-time updates
- `unsubscribeBars()`: Unsubscribes from updates

### API Client

The `HyperLiquidAPI` class handles:

- REST API requests for historical data
- WebSocket connections for real-time data
- Data formatting and error handling
- Connection management and reconnection logic

### Application Logic

The `TradingViewApp` class manages:

- TradingView widget initialization
- UI event handling
- Price updates and display
- Tool selection and chart interactions

## Customization

### Styling

The application uses a dark theme that can be customized in:

- `styles.css`: Main application styles
- `custom_chart.css`: TradingView chart overrides

### API Configuration

HyperLiquid API settings can be modified in `hyperliquid-api.js`:

```javascript
this.baseURL = 'https://api.hyperliquid.xyz';
this.wsURL = 'wss://api.hyperliquid.xyz/ws';
```

### Chart Configuration

TradingView widget settings can be adjusted in `app.js`:

```javascript
this.widget = new TradingView.widget({
    // Configuration options
    theme: 'dark',
    interval: '1h',
    // ... other options
});
```

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Performance Considerations

- WebSocket connections are automatically managed with reconnection logic
- Historical data is cached to reduce API calls
- Chart rendering is optimized for smooth performance
- Responsive design adapts to different screen sizes

## Troubleshooting

### Common Issues

1. **Chart not loading**: Check browser console for errors and ensure TradingView library is loaded
2. **No data**: Verify HyperLiquid API connectivity and symbol availability
3. **WebSocket connection failed**: Check network connectivity and firewall settings

### Debug Mode

Enable debug logging by opening browser console and setting:

```javascript
window.tradingViewApp.debug = true;
```

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:

- Check the browser console for error messages
- Verify API connectivity
- Ensure all dependencies are installed
- Review the TradingView Charting Library documentation

## API Documentation

- [HyperLiquid API Docs](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api)
- [TradingView Charting Library](https://github.com/tradingview/charting_library)
