# Multi-Exchange TradingView Advanced Demo (HyperLiquid & Ostium)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TradingView](https://img.shields.io/badge/TradingView-Charting%20Library-blue.svg)](https://www.tradingview.com/charting-library/)

A sophisticated, production-ready trading interface that integrates TradingView Advanced Charts with HyperLiquid's API for real-time cryptocurrency trading data and analysis.

> **⚠️ Important**: This project requires a TradingView Advanced Charts license. [Apply for access here](https://in.tradingview.com/advanced-charts/) before using this integration.

![HyperLiquid TradingView Integration](./charting_library/charting_library/OrderBookCharts.png)

*Professional TradingView charts with integrated order book showing real-time BTC/USD market data*

## 🚀 Live Demo

Visit the live demo: [HLTradingViewTest](https://github.com/DiamondHandsQuant/HLTradingViewTest)

## ✨ Features

### 📈 Advanced Charting
- **TradingView Advanced Charts Integration**: Full-featured charting with professional trading tools
- **Multiple Timeframes**: Support for various chart intervals (1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w)
- **Drawing Tools**: Complete set of technical analysis tools (trend lines, Fibonacci, shapes, annotations)
- **Technical Indicators**: Built-in indicators and studies
- **Professional UI**: Dark theme interface matching modern trading platforms

### 🔗 Real-time Data Integration
- **HyperLiquid API Integration**: Real-time market data and historical candle data
- **WebSocket Real-time Updates**: Live price updates and candle streaming
- **Order Book Integration**: Real-time bid/ask levels with market depth visualization
- **Auto-reconnection**: Robust connection management with automatic reconnection
- **Data Caching**: Optimized performance with intelligent data caching

### 🎨 User Experience
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Fullscreen Mode**: Immersive trading experience
- **Symbol Switching**: Easy cryptocurrency pair selection
- **Customizable Interface**: Adjustable chart settings and preferences

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- Modern web browser (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- Internet connection for API access
- **TradingView Advanced Charts License** - [Apply for access](https://in.tradingview.com/advanced-charts/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/DiamondHandsQuant/HLTradingViewTest.git
   cd HLTradingViewTest
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Obtain TradingView Library** (Required):
   - Apply for access at [TradingView Advanced Charts](https://in.tradingview.com/advanced-charts/)
   - Download the charting library once approved
   - Extract to `charting_library/` directory in the project root

4. **Start the development server**:
   ```bash
   npm start
   ```
   
   Alternative development command:
   ```bash
   npm run dev
   ```

5. **Open your browser** and navigate to `http://localhost:8080`

### First Run

1. The application will automatically load with BTC/USD as the default symbol
2. Real-time data will start streaming immediately
3. Use the symbol selector to switch between different cryptocurrency pairs
4. Explore the drawing tools and technical indicators

### Production Deployment

For production deployment, you can use any static file server:

```bash
# Using nginx, apache, or any static hosting service
# Simply serve the files from the project root directory
```

**Deployment Platforms:**
- Netlify: Drag and drop the project folder
- Vercel: Connect your Git repository
- GitHub Pages: Enable Pages in repository settings
- AWS S3: Upload files to S3 bucket with static hosting

## 📁 Project Structure

```
TvAdvancedDemoHL/
├── 📄 index.html              # Main HTML file with TradingView widget
├── 🎨 styles.css              # Main application styles and UI
├── ⚙️ app.js                  # Main application logic and initialization
├── 📊 datafeed.js            # TradingView datafeed implementation
├── 🔗 hyperliquid-api.js     # HyperLiquid API integration and WebSocket
├── 📦 package.json           # Project dependencies and scripts
├── 📋 README.md              # Project documentation
├── 📜 LICENSE                # MIT License file
└── 📚 charting_library/      # TradingView Charting Library files
    ├── charting_library/     # Core library files
    └── datafeeds/           # UDF datafeed utilities
```

### Key Files Explained

- **`index.html`**: Entry point with TradingView widget container and order book UI
- **`app.js`**: Main application class managing chart initialization and UI interactions
- **`datafeed.js`**: Implements TradingView's datafeed interface for HyperLiquid integration
- **`hyperliquid-api.js`**: Handles REST API calls and WebSocket connections to HyperLiquid
- **`styles.css`**: Custom styling for dark theme, responsive design, and order book
- **`charting_library/`**: TradingView Charting Library with custom configurations

## API Integration

### HyperLiquid REST API

The application uses HyperLiquid's REST API endpoints:

- **Candle Data**: `POST /info` with `type: "candleSnapshot"`
- **Market Data**: `POST /info` with `type: "allMids"`
- **Metadata**: `POST /info` with `type: "meta"`

### WebSocket Integration

Real-time data is streamed via WebSocket connection:

- **URL**: `wss://api.hyperliquid.xyz/ws`
- **Candle Subscription**: `{"method": "subscribe", "subscription": {"type": "candle", "coin": "BTC", "interval": "1m"}}`
- **Order Book Subscription**: `{"method": "subscribe", "subscription": {"type": "l2Book", "coin": "BTC"}}`

### Order Book Integration

The integrated order book provides real-time market depth visualization:

- **Real-time Updates**: Live bid/ask levels with size information
- **Market Depth**: Visual representation of order book liquidity
- **Price Levels**: Detailed view of buy/sell orders at different price points
- **Responsive Design**: Seamlessly integrated with chart interface
- **Color Coding**: Green for bids, red for asks, with size-based intensity

## Supported Features

### Chart Features
- Candlestick charts with OHLCV data
- Multiple timeframes (1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w)
- Real-time price updates via WebSocket
- Volume indicators and market depth
- Integrated order book with bid/ask levels
- Professional dark theme matching HyperLiquid's interface

### Drawing Tools
- Trend lines
- Horizontal/Vertical lines
- Rectangles and circles
- Fibonacci retracements
- Text annotations
- Brush and eraser tools
- Measurement tools

### UI Controls
- Symbol switching between cryptocurrency pairs
- Timeframe selection with multiple intervals
- Fullscreen mode for immersive trading
- Auto-scale and log-scale options
- Technical indicators and studies
- Order book toggle and market depth view
- Chart settings and customization

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

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for full details.

### Third-Party Licenses

- **TradingView Charting Library**: Subject to TradingView's licensing terms
- **HyperLiquid API**: Used in accordance with HyperLiquid's terms of service

### 📋 **TradingView Advanced Charts License**

This project uses TradingView's Advanced Charts library, which requires a separate license from TradingView. 

**Important**: The TradingView Charting Library is **not included** in this repository due to licensing restrictions. To use this project:

1. **Apply for Access**: Visit [TradingView Advanced Charts](https://in.tradingview.com/advanced-charts/) to request access
2. **Download Library**: Once approved, download the charting library from TradingView
3. **Install Library**: Place the library files in the `charting_library/` directory
4. **Commercial Use**: Ensure compliance with TradingView's licensing terms for your use case

The library included in this repository is for demonstration purposes and may not be suitable for production use without proper licensing.

### Usage Rights

✅ **Permitted:**
- Commercial use
- Modification and distribution
- Private use
- Patent use

❌ **Limitations:**
- No warranty provided
- No liability assumed
- Must include license and copyright notice

## 🤝 Contributing

We welcome contributions! Please follow these steps:

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/TvAdvancedDemoHL.git
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```

### Development Guidelines

- Follow existing code style and conventions
- Add comments for complex logic
- Test your changes thoroughly
- Update documentation as needed
- Ensure responsive design compatibility

### Submitting Changes

1. **Commit your changes**:
   ```bash
   git commit -m "Add amazing feature"
   ```
2. **Push to your branch**:
   ```bash
   git push origin feature/amazing-feature
   ```
3. **Submit a pull request** with:
   - Clear description of changes
   - Screenshots for UI changes
   - Testing instructions

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## 🆘 Support & Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Chart not loading | Check browser console, ensure TradingView library is loaded |
| No data displayed | Verify HyperLiquid API connectivity and symbol availability |
| WebSocket connection failed | Check network connectivity and firewall settings |
| Slow performance | Clear browser cache, check internet connection |

### Debug Mode

Enable debug logging in browser console:

```javascript
// Enable detailed logging
window.tradingViewApp.debug = true;

// Check API connectivity
window.tradingViewApp.api.testConnection();
```

### Getting Help

1. **Check the [Issues](https://github.com/DiamondHandsQuant/HLTradingViewTest/issues)** for existing solutions
2. **Search the documentation** for relevant information
3. **Create a new issue** with:
   - Detailed problem description
   - Browser and OS information
   - Console error messages
   - Steps to reproduce

### Performance Optimization

- Use modern browsers for best performance
- Close unnecessary browser tabs
- Ensure stable internet connection
- Clear browser cache periodically

## 📚 Documentation & Resources

### API Documentation
- [HyperLiquid API Documentation](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api)
- [TradingView Charting Library Docs](https://github.com/tradingview/charting_library)
- [WebSocket API Reference](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket)

### Learning Resources
- [TradingView Charting Library Tutorial](https://github.com/tradingview/charting_library/wiki)
- [JavaScript Trading Applications](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [Cryptocurrency Trading Basics](https://www.investopedia.com/cryptocurrency-4427699)

### Community
- [GitHub Discussions](https://github.com/DiamondHandsQuant/HLTradingViewTest/discussions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/tradingview)
- [Follow @psyb0rg_](https://x.com/psyb0rg_) on X (Twitter)

---

**Made with ❤️ for the crypto trading community by [psyb0rg.eth](https://x.com/psyb0rg_)**

*If you find this project helpful, please consider giving it a ⭐ on [GitHub](https://github.com/DiamondHandsQuant/HLTradingViewTest)!*
