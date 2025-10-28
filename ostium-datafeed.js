/**
 * Ostium TradingView Datafeed Implementation
 * Implements the TradingView datafeed interface for Ostium exchange
 */

class OstiumDatafeed {
    constructor(apiKey, apiSecret) {
        this.api = new OstiumAPI(apiKey, apiSecret);
        this.supportedResolutions = ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', '720', '1D', '3D', '1W'];
        this.config = {
            supported_resolutions: this.supportedResolutions,
            exchanges: [
                {
                    value: 'OSTIUM',
                    name: 'Ostium',
                    desc: 'Ostium Exchange'
                }
            ],
            symbols_types: [
                {
                    name: 'crypto',
                    value: 'crypto'
                }
            ]
        };
        this.symbols = new Map();
        this.subscribers = new Map();
        this.lastBars = new Map();
    }

    /**
     * Initialize the datafeed
     */
    async initialize() {
        try {
            console.log('Initializing Ostium datafeed...');
            
            // Connect to SSE for real-time prices
            await this.api.connectSSE();
            
            // Create default symbols
            const defaultSymbols = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC'];
            
            defaultSymbols.forEach(symbol => {
                const symbolInfo = {
                    name: symbol,
                    full_name: `OSTIUM:${symbol}USD`,
                    description: `${symbol}/USD`,
                    type: 'crypto',
                    session: '24x7',
                    timezone: 'Etc/UTC',
                    exchange: 'OSTIUM',
                    minmov: 1,
                    pricescale: 100000000, // 8 decimal places
                    has_intraday: true,
                    has_weekly_and_monthly: true,
                    supported_resolutions: this.supportedResolutions,
                    volume_precision: 8,
                    data_status: 'streaming',
                    currency_code: 'USD'
                };
                
                this.symbols.set(symbol, symbolInfo);
            });
            
            console.log('Ostium datafeed initialized with', this.symbols.size, 'symbols');
        } catch (error) {
            console.error('Failed to initialize Ostium datafeed:', error);
            throw error;
        }
    }

    /**
     * TradingView datafeed method: onReady
     * Called when the datafeed is ready to provide data
     */
    onReady(callback) {
        console.log('Ostium Datafeed onReady called');
        setTimeout(() => {
            callback(this.config);
        }, 0);
    }

    /**
     * TradingView datafeed method: searchSymbols
     * Search for symbols matching user input
     */
    searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        console.log('Search Ostium symbols:', userInput);
        const results = [];
        const searchTerm = userInput.toUpperCase();
        
        for (const [symbol, symbolInfo] of this.symbols) {
            if (symbol.includes(searchTerm)) {
                results.push({
                    symbol: symbolInfo.name,
                    full_name: symbolInfo.full_name,
                    description: symbolInfo.description,
                    exchange: symbolInfo.exchange,
                    type: symbolInfo.type
                });
            }
        }
        
        onResultReadyCallback(results);
    }

    /**
     * TradingView datafeed method: resolveSymbol
     * Get detailed symbol information
     */
    resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        console.log('Resolving Ostium symbol:', symbolName);
        
        try {
            // Extract symbol from full name (e.g., "OSTIUM:BTCUSD" -> "BTC")
            let symbol = symbolName;
            if (symbolName.includes(':')) {
                symbol = symbolName.split(':')[1].replace('USD', '');
            }
            
            const symbolInfo = this.symbols.get(symbol);
            
            if (symbolInfo) {
                console.log('Symbol resolved:', symbolInfo);
                setTimeout(() => {
                    onSymbolResolvedCallback(symbolInfo);
                }, 0);
            } else {
                // Create a default symbol info if not found
                const defaultSymbolInfo = {
                    name: symbol,
                    full_name: `OSTIUM:${symbol}USD`,
                    description: `${symbol}/USD`,
                    type: 'crypto',
                    session: '24x7',
                    timezone: 'Etc/UTC',
                    exchange: 'OSTIUM',
                    minmov: 1,
                    pricescale: 100000000,
                    has_intraday: true,
                    has_weekly_and_monthly: true,
                    supported_resolutions: this.supportedResolutions,
                    volume_precision: 8,
                    data_status: 'streaming',
                    currency_code: 'USD'
                };
                
                this.symbols.set(symbol, defaultSymbolInfo);
                console.log('Created default symbol info:', defaultSymbolInfo);
                
                setTimeout(() => {
                    onSymbolResolvedCallback(defaultSymbolInfo);
                }, 0);
            }
        } catch (error) {
            console.error('Error resolving symbol:', error);
            onResolveErrorCallback('Symbol not found');
        }
    }

    /**
     * TradingView datafeed method: getBars
     * Get historical bars for a symbol
     */
    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        const { from, to, firstDataRequest } = periodParams;
        
        try {
            console.log(`Getting Ostium bars for ${symbolInfo.name} ${resolution} from ${new Date(from * 1000)} to ${new Date(to * 1000)}`);
            
            // Extract symbol
            const symbol = symbolInfo.name;
            
            // Convert TradingView resolution to Ostium interval format
            const interval = this.convertResolution(resolution);
            
            // Convert timestamps from seconds to milliseconds
            const startTime = from * 1000;
            const endTime = to * 1000;
            
            // Fetch candles from Ostium API
            const candles = await this.api.getCandles(symbol, interval, startTime, endTime);
            
            if (!candles || candles.length === 0) {
                console.log('No Ostium data available for this period');
                onHistoryCallback([], { noData: true });
                return;
            }
            
            // Convert to TradingView format
            const bars = candles.map(candle => ({
                time: candle.time * 1000, // Convert to milliseconds
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume
            }));
            
            // Store last bar for real-time updates
            if (bars.length > 0) {
                const lastBar = bars[bars.length - 1];
                this.lastBars.set(`${symbol}_${resolution}`, lastBar);
            }
            
            console.log(`Received ${bars.length} bars from Ostium`);
            onHistoryCallback(bars, { noData: false });
            
        } catch (error) {
            console.error('Error getting Ostium bars:', error);
            onErrorCallback(error.message || 'Failed to fetch data from Ostium');
        }
    }

    /**
     * TradingView datafeed method: subscribeBars
     * Subscribe to real-time bar updates
     */
    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
        console.log(`Subscribing to Ostium bars: ${symbolInfo.name} ${resolution} [${subscriberUID}]`);
        
        const symbol = symbolInfo.name;
        const key = `${symbol}_${resolution}`;
        
        // Create subscription handler
        const handler = (data) => {
            try {
                // Get last bar or create new one
                let lastBar = this.lastBars.get(key);
                const price = data.price;
                const timestamp = data.timestamp || Date.now();
                
                // Calculate bar timestamp based on resolution
                const barTime = this.getBarTime(timestamp, resolution);
                
                if (!lastBar || barTime > lastBar.time) {
                    // New bar
                    const newBar = {
                        time: barTime,
                        open: price,
                        high: price,
                        low: price,
                        close: price,
                        volume: 0
                    };
                    
                    this.lastBars.set(key, newBar);
                    console.log(`New bar for ${symbol}:`, newBar);
                    onRealtimeCallback(newBar);
                    
                } else {
                    // Update existing bar
                    lastBar.close = price;
                    lastBar.high = Math.max(lastBar.high, price);
                    lastBar.low = Math.min(lastBar.low, price);
                    
                    console.log(`Updated bar for ${symbol}:`, lastBar);
                    onRealtimeCallback(lastBar);
                }
            } catch (error) {
                console.error('Error in real-time bar update:', error);
            }
        };
        
        // Store subscription
        this.subscribers.set(subscriberUID, {
            symbol,
            resolution,
            handler,
            callback: onRealtimeCallback
        });
        
        // Subscribe to price updates from SSE
        this.api.subscribe(symbol, handler);
        
        console.log(`Subscribed to ${symbol} updates`);
    }

    /**
     * TradingView datafeed method: unsubscribeBars
     * Unsubscribe from real-time bar updates
     */
    unsubscribeBars(subscriberUID) {
        console.log(`Unsubscribing from Ostium bars [${subscriberUID}]`);
        
        const subscription = this.subscribers.get(subscriberUID);
        if (subscription) {
            // Unsubscribe from API
            this.api.unsubscribe(subscription.symbol, subscription.handler);
            
            // Remove from subscribers
            this.subscribers.delete(subscriberUID);
            console.log(`Unsubscribed from ${subscription.symbol}`);
        }
    }

    /**
     * Convert TradingView resolution to Ostium interval format
     */
    convertResolution(resolution) {
        // Map TradingView resolutions to Ostium intervals
        const resolutionMap = {
            '1': '1m',
            '3': '3m',
            '5': '5m',
            '15': '15m',
            '30': '30m',
            '60': '1h',
            '120': '2h',
            '240': '4h',
            '360': '6h',
            '480': '8h',
            '720': '12h',
            '1D': '1d',
            '3D': '3d',
            '1W': '1w'
        };
        
        return resolutionMap[resolution] || '1h';
    }

    /**
     * Get bar time based on resolution
     */
    getBarTime(timestamp, resolution) {
        const date = new Date(timestamp);
        
        // Resolution to milliseconds
        const resolutionMap = {
            '1': 60 * 1000,
            '3': 3 * 60 * 1000,
            '5': 5 * 60 * 1000,
            '15': 15 * 60 * 1000,
            '30': 30 * 60 * 1000,
            '60': 60 * 60 * 1000,
            '120': 2 * 60 * 60 * 1000,
            '240': 4 * 60 * 60 * 1000,
            '360': 6 * 60 * 60 * 1000,
            '480': 8 * 60 * 60 * 1000,
            '720': 12 * 60 * 60 * 1000,
            '1D': 24 * 60 * 60 * 1000
        };
        
        const resolutionMs = resolutionMap[resolution] || 60 * 60 * 1000;
        
        // Round down to resolution boundary
        return Math.floor(date.getTime() / resolutionMs) * resolutionMs;
    }

    /**
     * Cleanup on destroy
     */
    destroy() {
        console.log('Destroying Ostium datafeed');
        
        // Disconnect SSE
        this.api.disconnectSSE();
        
        // Clear all subscriptions
        this.subscribers.clear();
        this.lastBars.clear();
    }
}

