/**
 * Lighter TradingView Datafeed Implementation
 * Implements the TradingView datafeed interface for Lighter exchange
 */

class LighterDatafeed {
    constructor() {
        this.api = new LighterAPI();
        this.supportedResolutions = ['1', '5', '15', '30', '60', '240', '720', '1D', '1W'];
        this.config = {
            supported_resolutions: this.supportedResolutions,
            exchanges: [
                {
                    value: 'LIGHTER',
                    name: 'Lighter',
                    desc: 'Lighter Exchange'
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
            console.log('🟡 Initializing Lighter datafeed...');
            
            // Fetch all available markets from Lighter
            const markets = await this.api.getMarkets();
            
            if (!markets || markets.length === 0) {
                console.warn('⚠️  No markets returned from Lighter API');
                return;
            }
            
            // Register each market as a symbol
            markets.forEach(market => {
                // Extract symbol information from Lighter API response
                const marketId = market.market_id;
                const symbolName = this.normalizeSymbol(market.symbol);
                
                // Determine price scale based on supported_price_decimals
                const pricescale = market.supported_price_decimals ? Math.pow(10, market.supported_price_decimals) : 100;
                
                const symbolInfo = {
                    name: symbolName,
                    ticker: symbolName,
                    full_name: `LIGHTER:${symbolName}`,
                    description: `${symbolName} Perpetual`,
                    type: 'crypto',
                    session: '24x7',
                    timezone: 'Etc/UTC',
                    exchange: 'LIGHTER',
                    listed_exchange: 'LIGHTER',
                    minmov: 1,
                    pricescale: pricescale,
                    has_intraday: true,
                    has_daily: true,
                    has_weekly_and_monthly: true,
                    supported_resolutions: this.supportedResolutions,
                    volume_precision: market.supported_size_decimals || 2,
                    data_status: 'streaming',
                    currency_code: 'USD',
                    format: 'price',
                    // Store market ID for API calls
                    marketId: marketId
                };
                
                this.symbols.set(symbolName, symbolInfo);
                console.log(`✅ Registered Lighter symbol: ${symbolName} (ID: ${marketId})`);
            });
            
            console.log('✅ Lighter datafeed initialized with', this.symbols.size, 'symbols:', Array.from(this.symbols.keys()).slice(0, 10));
            
        } catch (error) {
            console.error('❌ Failed to initialize Lighter datafeed:', error);
            throw error;
        }
    }

    /**
     * Normalize symbol name
     * @param {string} symbol - Raw symbol from API (e.g., "BTC/USD", "BTC-USD")
     * @returns {string} Normalized symbol (e.g., "BTCUSD")
     */
    normalizeSymbol(symbol) {
        if (!symbol) return 'UNKNOWN';
        
        // Remove separators and convert to uppercase
        return symbol.replace(/[\/\-_]/g, '').toUpperCase();
    }

    /**
     * TradingView datafeed method: onReady
     * Called when the datafeed is ready to provide data
     */
    onReady(callback) {
        console.log('Lighter Datafeed onReady called');
        setTimeout(() => {
            callback(this.config);
        }, 0);
    }

    /**
     * TradingView datafeed method: searchSymbols
     * Search for symbols matching user input
     */
    searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        console.log('Search Lighter symbols:', userInput);
        const results = [];
        const searchTerm = userInput.toUpperCase();
        
        for (const [symbol, symbolInfo] of this.symbols) {
            if (symbol.includes(searchTerm)) {
				results.push(this.buildSearchResult(symbolInfo));
            }
        }
        
        console.log(`Found ${results.length} Lighter symbols matching "${userInput}"`);
        onResultReadyCallback(results);
    }

	/**
	 * Build a TradingView search result ensuring unique, prefixed symbols
	 * TradingView may use the `symbol` field to resolve, so make it prefixed.
	 */
	buildSearchResult(symbolInfo) {
		const prefixed = symbolInfo.full_name; // e.g., LIGHTER:BTC
		return {
			symbol: prefixed,
			full_name: prefixed,
			description: symbolInfo.description,
			exchange: symbolInfo.exchange,
			type: symbolInfo.type,
			ticker: prefixed
		};
	}

    /**
     * TradingView datafeed method: resolveSymbol
     * Get detailed symbol information
     */
    resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        console.log('🔍 Resolving Lighter symbol:', symbolName);
        console.log('📚 Available Lighter symbols:', Array.from(this.symbols.keys()));
        
        try {
            // Extract symbol from full name (e.g., "LIGHTER:BTCUSD" -> "BTCUSD")
            let symbol = symbolName;
            if (symbolName.includes(':')) {
                symbol = symbolName.split(':')[1];
            }
            
            console.log(`   Extracted symbol: "${symbol}"`);
            
            // Try different variations
            let symbolInfo = null;
            
            // 1. Try exact match
            symbolInfo = this.symbols.get(symbol);
            console.log(`   Try exact "${symbol}":`, symbolInfo ? '✅ Found' : '❌ Not found');
            
            // 2. Try with USD suffix
            if (!symbolInfo && !symbol.endsWith('USD')) {
                symbolInfo = this.symbols.get(symbol + 'USD');
                console.log(`   Try with USD "${symbol}USD":`, symbolInfo ? '✅ Found' : '❌ Not found');
            }
            
            // 3. Try removing USD suffix
            if (!symbolInfo && symbol.endsWith('USD')) {
                const withoutUSD = symbol.replace(/USD$/, '');
                symbolInfo = this.symbols.get(withoutUSD);
                console.log(`   Try without USD "${withoutUSD}":`, symbolInfo ? '✅ Found' : '❌ Not found');
            }
            
            // 4. Try case-insensitive search
            if (!symbolInfo) {
                for (const [key, value] of this.symbols) {
                    if (key.toUpperCase() === symbol.toUpperCase()) {
                        symbolInfo = value;
                        console.log(`   Case-insensitive match found: "${key}"`);
                        break;
                    }
                }
            }
            
            if (symbolInfo) {
                console.log('✅ Symbol resolved successfully!');
                console.log('   Market ID:', symbolInfo.marketId);
                console.log('   Full info:', symbolInfo);
                setTimeout(() => {
                    onSymbolResolvedCallback(symbolInfo);
                }, 0);
            } else {
                console.error('❌ Symbol not found in Lighter symbols:', symbol);
                console.error('   Searched variations:', [symbol, symbol + 'USD', symbol.replace(/USD$/, '')]);
                onResolveErrorCallback(`Symbol ${symbol} not found in Lighter`);
            }
        } catch (error) {
            console.error('💥 Error resolving symbol:', error);
            onResolveErrorCallback('Symbol resolution error: ' + error.message);
        }
    }

    /**
     * TradingView datafeed method: getBars
     * Get historical bars for a symbol
     */
    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        const { from, to, firstDataRequest } = periodParams;
        
        try {
            console.log(`🟡 LIGHTER DATAFEED - getBars called`);
            console.log(`   Symbol: ${symbolInfo.name}`);
            console.log(`   Resolution: ${resolution}`);
            console.log(`   From: ${new Date(from * 1000).toISOString()}`);
            console.log(`   To: ${new Date(to * 1000).toISOString()}`);
            console.log(`   First request: ${firstDataRequest}`);
            console.log(`   Market ID: ${symbolInfo.marketId}`);
            
            // Get market ID from symbol info
            const marketId = symbolInfo.marketId;
            
            if (!marketId) {
                throw new Error('Market ID not found for symbol');
            }
            
            // Convert TradingView resolution to Lighter interval format
            const interval = this.convertResolution(resolution);
            console.log(`   Converted interval: ${interval}`);
            
            // Convert timestamps from seconds to milliseconds
            const startTime = from * 1000;
            const endTime = to * 1000;
            
            console.log(`🌐 Calling Lighter API.getCandles(${marketId}, ${interval}, ...)`);
            
            // Fetch candles from Lighter API
            const candles = await this.api.getCandles(marketId, interval, startTime, endTime);
            
            console.log(`📦 Received ${candles?.length || 0} candles from Lighter API`);
            
            if (!candles || candles.length === 0) {
                console.warn('⚠️  No Lighter data available for this period');
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
                this.lastBars.set(`${symbolInfo.name}_${resolution}`, lastBar);
            }
            
            console.log(`✅ LIGHTER: Returning ${bars.length} bars to TradingView`);
            onHistoryCallback(bars, { noData: false });
            
        } catch (error) {
            console.error('❌ LIGHTER ERROR getting bars:', error);
            console.error('   Stack:', error.stack);
            onErrorCallback(error.message || 'Failed to fetch data from Lighter');
        }
    }

    /**
     * TradingView datafeed method: subscribeBars
     * Subscribe to real-time bar updates
     */
    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
        console.log(`Subscribing to Lighter bars: ${symbolInfo.name} ${resolution} [${subscriberUID}]`);
        
        const symbol = symbolInfo.name;
        const marketId = symbolInfo.marketId;
        const key = `${symbol}_${resolution}`;
        
        // Store subscription info
        this.subscribers.set(subscriberUID, {
            symbol,
            resolution,
            marketId,
            callback: onRealtimeCallback
        });
        
        console.log(`Subscribed to ${symbol} updates (Market ID: ${marketId})`);
        
        // Note: Real-time candle updates would require WebSocket implementation
        // For now, this is a placeholder for the subscription mechanism
    }

    /**
     * TradingView datafeed method: unsubscribeBars
     * Unsubscribe from real-time bar updates
     */
    unsubscribeBars(subscriberUID) {
        console.log(`Unsubscribing from Lighter bars [${subscriberUID}]`);
        
        const subscription = this.subscribers.get(subscriberUID);
        if (subscription) {
            console.log(`Unsubscribed from ${subscription.symbol}`);
            this.subscribers.delete(subscriberUID);
        }
    }

    /**
     * Convert TradingView resolution to Lighter interval format
     */
    convertResolution(resolution) {
        // Map TradingView resolutions to Lighter intervals
        const resolutionMap = {
            '1': '1m',
            '5': '5m',
            '15': '15m',
            '30': '30m',
            '60': '1h',
            '240': '4h',
            '720': '12h',
            '1D': '1d',
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
        console.log('Destroying Lighter datafeed');
        
        // Disconnect WebSocket
        this.api.disconnectWebSocket();
        
        // Clear all subscriptions
        this.subscribers.clear();
        this.lastBars.clear();
    }
}

// Export for use in other modules
window.LighterDatafeed = LighterDatafeed;

