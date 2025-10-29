/**
 * Unified TradingView Datafeed
 * Combines HyperLiquid (crypto) and Ostium (RWA) into a single seamless datafeed
 * Users can search and switch between any symbol without manual exchange switching
 */

class UnifiedDatafeed {
    constructor(ostiumApiKey, ostiumApiSecret, ostiumApiURL = null, ostiumSSEURL = null) {
        // Initialize both datafeeds
        this.hyperLiquidDatafeed = new HyperLiquidDatafeed();
        this.ostiumDatafeed = new OstiumDatafeed(ostiumApiKey, ostiumApiSecret, ostiumApiURL, ostiumSSEURL);
        
        // Symbol registry: maps symbol name to its exchange
        this.symbolExchangeMap = new Map();
        
        // RWA symbols that use Ostium
        this.rwaSymbols = ['SPX', 'EURUSD'];
        
        // Track active subscriptions
        this.activeSubscriptions = new Map();
        
        // Track last requested symbol to detect changes
        this.lastRequestedSymbol = null;
        
        this.isInitialized = false;
    }

    /**
     * Initialize both datafeeds
     */
    async initialize() {
        try {
            console.log('🔄 Initializing Unified Datafeed...');
            
            // Initialize both datafeeds in parallel
            await Promise.all([
                this.hyperLiquidDatafeed.initialize(),
                this.ostiumDatafeed.initialize()
            ]);
            
            // Build symbol exchange map
            this.buildSymbolMap();
            
            this.isInitialized = true;
            console.log('✅ Unified Datafeed initialized with', this.symbolExchangeMap.size, 'symbols');
            console.log('📊 Symbol distribution:', {
                hyperliquid: Array.from(this.symbolExchangeMap.entries())
                    .filter(([_, ex]) => ex === 'HYPERLIQUID')
                    .map(([sym, _]) => sym),
                ostium: Array.from(this.symbolExchangeMap.entries())
                    .filter(([_, ex]) => ex === 'OSTIUM')
                    .map(([sym, _]) => sym)
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Unified Datafeed:', error);
            throw error;
        }
    }

    /**
     * Build map of symbols to their exchanges
     */
    buildSymbolMap() {
        // Add HyperLiquid symbols
        for (const [symbol, _] of this.hyperLiquidDatafeed.symbols) {
            this.symbolExchangeMap.set(symbol, 'HYPERLIQUID');
            this.symbolExchangeMap.set(`${symbol}USD`, 'HYPERLIQUID');
            this.symbolExchangeMap.set(`HYPERLIQUID:${symbol}USD`, 'HYPERLIQUID');
        }
        
        // Add Ostium symbols
        for (const [symbol, _] of this.ostiumDatafeed.symbols) {
            this.symbolExchangeMap.set(symbol, 'OSTIUM');
            // Handle forex pairs differently (no USD suffix)
            if (symbol.includes('USD') || symbol.includes('EUR') || symbol.includes('GBP')) {
                this.symbolExchangeMap.set(`OSTIUM:${symbol}`, 'OSTIUM');
            } else {
                this.symbolExchangeMap.set(`${symbol}USD`, 'OSTIUM');
                this.symbolExchangeMap.set(`OSTIUM:${symbol}`, 'OSTIUM');
            }
        }
    }

    /**
     * Determine which exchange a symbol belongs to
     */
    getExchangeForSymbol(symbolName) {
        // Clean up symbol name
        let cleanSymbol = symbolName;
        
        // Remove exchange prefix
        if (cleanSymbol.includes(':')) {
            const parts = cleanSymbol.split(':');
            if (parts[0] === 'HYPERLIQUID' || parts[0] === 'OSTIUM') {
                return parts[0];
            }
            cleanSymbol = parts[1];
        }
        
        // Remove USD suffix for lookup (but keep for forex pairs)
        const testSymbol = cleanSymbol.replace(/USD$/, '');
        
        // Check if it's an RWA symbol
        if (this.rwaSymbols.includes(testSymbol) || this.rwaSymbols.includes(cleanSymbol)) {
            return 'OSTIUM';
        }
        
        // Check symbol map
        if (this.symbolExchangeMap.has(cleanSymbol)) {
            return this.symbolExchangeMap.get(cleanSymbol);
        }
        
        if (this.symbolExchangeMap.has(testSymbol)) {
            return this.symbolExchangeMap.get(testSymbol);
        }
        
        // Default to HyperLiquid for crypto
        return 'HYPERLIQUID';
    }

    /**
     * Get the appropriate datafeed for a symbol
     */
    getDatafeedForSymbol(symbolName) {
        const exchange = this.getExchangeForSymbol(symbolName);
        return exchange === 'OSTIUM' ? this.ostiumDatafeed : this.hyperLiquidDatafeed;
    }

    /**
     * TradingView datafeed method: onReady
     */
    onReady(callback) {
        console.log('📡 Unified Datafeed onReady called');
        
        // Merge configurations from both datafeeds
        const hyperLiquidConfig = this.hyperLiquidDatafeed.config;
        const ostiumConfig = this.ostiumDatafeed.config;
        
        const unifiedConfig = {
            supported_resolutions: hyperLiquidConfig.supported_resolutions,
            exchanges: [
                ...hyperLiquidConfig.exchanges,
                ...ostiumConfig.exchanges
            ],
            symbols_types: [
                { name: 'crypto', value: 'crypto' },
                { name: 'index', value: 'index' },
                { name: 'forex', value: 'forex' }
            ],
            supports_search: true,
            supports_group_request: false,
            supports_marks: false,
            supports_timescale_marks: false,
            supports_time: true
        };
        
        setTimeout(() => callback(unifiedConfig), 0);
    }

    /**
     * TradingView datafeed method: searchSymbols
     * Search across BOTH exchanges
     */
    searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        console.log('🔍 Unified search for:', userInput);
        
        const allResults = [];
        
        // Search HyperLiquid symbols
        this.hyperLiquidDatafeed.searchSymbols(userInput, '', '', (hlResults) => {
            allResults.push(...hlResults);
        });
        
        // Search Ostium symbols
        this.ostiumDatafeed.searchSymbols(userInput, '', '', (ostiumResults) => {
            allResults.push(...ostiumResults);
        });
        
        console.log(`✅ Found ${allResults.length} symbols across both exchanges:`, allResults);
        onResultReadyCallback(allResults);
    }

    /**
     * TradingView datafeed method: resolveSymbol
     * Route to appropriate exchange
     */
    resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        console.log('🔵 UNIFIED DATAFEED - resolveSymbol called');
        console.log(`   Symbol: ${symbolName}`);
        
        const exchange = this.getExchangeForSymbol(symbolName);
        const datafeed = this.getDatafeedForSymbol(symbolName);
        
        console.log(`   Detected Exchange: ${exchange}`);
        console.log(`   Routing to: ${exchange === 'OSTIUM' ? 'OstiumDatafeed' : 'HyperLiquidDatafeed'}`);
        
        datafeed.resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback);
    }

    /**
     * TradingView datafeed method: getBars
     * Route to appropriate exchange
     */
    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        const exchange = this.getExchangeForSymbol(symbolInfo.name);
        const datafeed = this.getDatafeedForSymbol(symbolInfo.name);
        
        console.log(`🔵 UNIFIED DATAFEED - getBars called`);
        console.log(`   Symbol: ${symbolInfo.name}`);
        console.log(`   Detected Exchange: ${exchange}`);
        console.log(`   Routing to: ${exchange === 'OSTIUM' ? 'OstiumDatafeed' : 'HyperLiquidDatafeed'}`);
        
        // CRITICAL: Detect symbol changes and notify app to cleanup order books
        if (!this.lastRequestedSymbol || this.lastRequestedSymbol !== symbolInfo.name) {
            console.log(`   ⚠️  Symbol changed from ${this.lastRequestedSymbol} to ${symbolInfo.name}`);
            console.log(`   → Triggering order book cleanup via window event`);
            
            // Trigger cleanup via global event
            if (window.tradingViewApp) {
                const newExchange = this.getExchangeForSymbol(symbolInfo.name);
                window.tradingViewApp.updateOrderBookVisibility(newExchange);
            }
            
            this.lastRequestedSymbol = symbolInfo.name;
        }
        
        return datafeed.getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback);
    }

    /**
     * TradingView datafeed method: subscribeBars
     * Route to appropriate exchange
     */
    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
        const exchange = this.getExchangeForSymbol(symbolInfo.name);
        const datafeed = this.getDatafeedForSymbol(symbolInfo.name);
        
        console.log(`🔔 UNIFIED DATAFEED - subscribeBars called`);
        console.log(`   Symbol: ${symbolInfo.name}`);
        console.log(`   Exchange: ${exchange}`);
        console.log(`   SubscriberUID: ${subscriberUID}`);
        console.log(`   Resolution: ${resolution}`);
        
        // Track which exchange this subscription is on
        this.activeSubscriptions.set(subscriberUID, {
            exchange,
            symbol: symbolInfo.name,
            datafeed,
            resolution
        });
        
        console.log(`📊 Active subscriptions count: ${this.activeSubscriptions.size}`);
        console.log(`   All subscriptions:`, Array.from(this.activeSubscriptions.entries()).map(([uid, sub]) => `${sub.symbol}(${sub.exchange})`));
        
        datafeed.subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback);
    }

    /**
     * TradingView datafeed method: unsubscribeBars
     * Route to appropriate exchange
     */
    unsubscribeBars(subscriberUID) {
        console.log(`🔕 UNIFIED DATAFEED - unsubscribeBars called`);
        console.log(`   SubscriberUID: ${subscriberUID}`);
        
        const subscription = this.activeSubscriptions.get(subscriberUID);
        
        if (subscription) {
            console.log(`   Symbol: ${subscription.symbol}`);
            console.log(`   Exchange: ${subscription.exchange}`);
            console.log(`   → Routing unsubscribe to ${subscription.exchange} datafeed`);
            subscription.datafeed.unsubscribeBars(subscriberUID);
            this.activeSubscriptions.delete(subscriberUID);
            
            console.log(`📊 Remaining subscriptions: ${this.activeSubscriptions.size}`);
            if (this.activeSubscriptions.size > 0) {
                console.log(`   Still active:`, Array.from(this.activeSubscriptions.entries()).map(([uid, sub]) => `${sub.symbol}(${sub.exchange})`));
            }
        } else {
            console.warn(`   ⚠️  No active subscription found for ${subscriberUID}`);
            console.log(`   Current active subscriptions:`, Array.from(this.activeSubscriptions.keys()));
        }
    }

    /**
     * Get current price for a symbol
     */
    async getCurrentPrice(symbol) {
        const datafeed = this.getDatafeedForSymbol(symbol);
        
        if (datafeed.getCurrentPrice) {
            return datafeed.getCurrentPrice(symbol);
        }
        
        return null;
    }

    /**
     * Get API instance for a symbol (for order book, etc.)
     */
    getAPIForSymbol(symbol) {
        const exchange = this.getExchangeForSymbol(symbol);
        
        if (exchange === 'OSTIUM') {
            return this.ostiumDatafeed.api;
        } else {
            return this.hyperLiquidDatafeed.api;
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        console.log('🧹 Destroying Unified Datafeed');
        
        // Destroy both datafeeds
        if (this.hyperLiquidDatafeed && this.hyperLiquidDatafeed.destroy) {
            this.hyperLiquidDatafeed.destroy();
        }
        
        if (this.ostiumDatafeed && this.ostiumDatafeed.destroy) {
            this.ostiumDatafeed.destroy();
        }
        
        this.activeSubscriptions.clear();
        this.symbolExchangeMap.clear();
    }
}

