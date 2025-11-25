/**
 * Unified TradingView Datafeed
 * Combines HyperLiquid, Ostium, and Lighter into a single seamless datafeed
 * Users can search and switch between any symbol without manual exchange switching
 */

class UnifiedDatafeed {
    constructor(ostiumApiKey, ostiumApiSecret, ostiumApiURL = null, ostiumSSEURL = null) {
        // Initialize all three datafeeds
        this.hyperLiquidDatafeed = new HyperLiquidDatafeed();
        this.ostiumDatafeed = new OstiumDatafeed(ostiumApiKey, ostiumApiSecret, ostiumApiURL, ostiumSSEURL);
        this.lighterDatafeed = new LighterDatafeed();
        
        // Symbol registry: maps symbol name to its exchange
        this.symbolExchangeMap = new Map();
        
        // Track which exchange was used during resolveSymbol
        // Maps: symbolInfo object -> exchange name
        this.resolvedSymbolExchange = new Map();
        
        // RWA symbols that use Ostium
        this.rwaSymbols = ['SPX', 'EURUSD'];
        
        // Track active subscriptions
        this.activeSubscriptions = new Map();
        
        // Track last requested symbol to detect changes
        this.lastRequestedSymbol = null;
        
        this.isInitialized = false;
    }

    /**
     * Initialize all three datafeeds
     */
    async initialize() {
        try {
            console.log('🔄 Initializing Unified Datafeed...');
            
            // Initialize all three datafeeds in parallel
            await Promise.all([
                this.hyperLiquidDatafeed.initialize(),
                this.ostiumDatafeed.initialize(),
                this.lighterDatafeed.initialize()
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
                    .map(([sym, _]) => sym),
                lighter: Array.from(this.symbolExchangeMap.entries())
                    .filter(([_, ex]) => ex === 'LIGHTER')
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
        // Collect all symbols first to detect conflicts
        const symbolSources = new Map(); // symbol -> array of exchanges
        
        // Collect HyperLiquid symbols
        for (const [symbol, _] of this.hyperLiquidDatafeed.symbols) {
            if (!symbolSources.has(symbol)) symbolSources.set(symbol, []);
            symbolSources.get(symbol).push('HYPERLIQUID');
        }
        
        // Collect Ostium symbols
        for (const [symbol, _] of this.ostiumDatafeed.symbols) {
            if (!symbolSources.has(symbol)) symbolSources.set(symbol, []);
            symbolSources.get(symbol).push('OSTIUM');
        }
        
        // Collect Lighter symbols
        for (const [symbol, _] of this.lighterDatafeed.symbols) {
            if (!symbolSources.has(symbol)) symbolSources.set(symbol, []);
            symbolSources.get(symbol).push('LIGHTER');
        }
        
        // Now register symbols
        // For unique symbols: register without prefix
        // For conflicting symbols: ONLY register with exchange prefix
        
        for (const [symbol, exchanges] of symbolSources) {
            if (exchanges.length === 1) {
                // Unique symbol - register without prefix
                const exchange = exchanges[0];
                this.symbolExchangeMap.set(symbol, exchange);
                this.symbolExchangeMap.set(`${symbol}USD`, exchange);
            }
            // For conflicting symbols, don't register unprefixed version
            // They MUST use exchange prefix
            
            // Always register WITH exchange prefix
            for (const exchange of exchanges) {
                this.symbolExchangeMap.set(`${exchange}:${symbol}`, exchange);
                this.symbolExchangeMap.set(`${exchange}:${symbol}USD`, exchange);
            }
        }
        
        console.log('📋 Symbol conflicts detected:', 
            Array.from(symbolSources.entries())
                .filter(([_, exs]) => exs.length > 1)
                .map(([sym, exs]) => `${sym} (${exs.join(', ')})`)
        );
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
            if (parts[0] === 'HYPERLIQUID' || parts[0] === 'OSTIUM' || parts[0] === 'LIGHTER') {
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
        if (exchange === 'OSTIUM') {
            return this.ostiumDatafeed;
        } else if (exchange === 'LIGHTER') {
            return this.lighterDatafeed;
        } else {
            return this.hyperLiquidDatafeed;
        }
    }

    /**
     * TradingView datafeed method: onReady
     */
    onReady(callback) {
        console.log('📡 Unified Datafeed onReady called');
        
        // Merge configurations from all three datafeeds
        const hyperLiquidConfig = this.hyperLiquidDatafeed.config;
        const ostiumConfig = this.ostiumDatafeed.config;
        const lighterConfig = this.lighterDatafeed.config;
        
        const unifiedConfig = {
            supported_resolutions: hyperLiquidConfig.supported_resolutions,
            exchanges: [
                ...hyperLiquidConfig.exchanges,
                ...ostiumConfig.exchanges,
                ...lighterConfig.exchanges
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
     * Search across ALL THREE exchanges
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
        
        // Search Lighter symbols
        this.lighterDatafeed.searchSymbols(userInput, '', '', (lighterResults) => {
            allResults.push(...lighterResults);
        });
        
        console.log(`✅ Found ${allResults.length} symbols across all three exchanges:`);
        allResults.forEach(result => {
            console.log(`   📍 ${result.full_name} | ${result.description} | Exchange: ${result.exchange}`);
        });
        
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
        console.log(`   Routing to: ${datafeed === this.ostiumDatafeed ? 'OstiumDatafeed' : datafeed === this.lighterDatafeed ? 'LighterDatafeed' : 'HyperLiquidDatafeed'}`);
        
        // Wrap the callback to store the exchange mapping
        const wrappedCallback = (symbolInfo) => {
            // Store which exchange this symbolInfo belongs to
            this.resolvedSymbolExchange.set(symbolInfo, exchange);
            console.log(`   ✅ Stored exchange mapping: ${symbolInfo.name} -> ${exchange}`);
            onSymbolResolvedCallback(symbolInfo);
        };
        
        datafeed.resolveSymbol(symbolName, wrappedCallback, onResolveErrorCallback);
    }

    /**
     * TradingView datafeed method: getBars
     * Route to appropriate exchange
     */
    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        // Use the exchange that was determined during resolveSymbol
        const exchange = this.resolvedSymbolExchange.get(symbolInfo) || this.getExchangeForSymbol(symbolInfo.name);
        
        // Get the appropriate datafeed
        let datafeed;
        if (exchange === 'HYPERLIQUID') {
            datafeed = this.hyperLiquidDatafeed;
        } else if (exchange === 'OSTIUM') {
            datafeed = this.ostiumDatafeed;
        } else if (exchange === 'LIGHTER') {
            datafeed = this.lighterDatafeed;
        } else {
            datafeed = this.hyperLiquidDatafeed; // fallback
        }
        
        console.log(`🔵 UNIFIED DATAFEED - getBars called`);
        console.log(`   Symbol: ${symbolInfo.name}`);
        console.log(`   Exchange (from resolveSymbol): ${exchange}`);
        console.log(`   Routing to: ${exchange === 'OSTIUM' ? 'OstiumDatafeed' : exchange === 'LIGHTER' ? 'LighterDatafeed' : 'HyperLiquidDatafeed'}`);
        
        // Track symbol changes for debugging purposes only
        // NOTE: Order book updates are now handled exclusively by onSymbolChanged event in app.js
        // DO NOT call updateOrderBookVisibility here as it causes duplicate subscriptions and blinking
        if (!this.lastRequestedSymbol || this.lastRequestedSymbol !== symbolInfo.name) {
            console.log(`   ⚠️  Symbol changed from ${this.lastRequestedSymbol} to ${symbolInfo.name}`);
            console.log(`   ℹ️  Order book will be updated by onSymbolChanged event (not here)`);
            this.lastRequestedSymbol = symbolInfo.name;
        }
        
        return datafeed.getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback);
    }

    /**
     * TradingView datafeed method: subscribeBars
     * Route to appropriate exchange
     */
    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
        // Use the exchange that was determined during resolveSymbol
        const exchange = this.resolvedSymbolExchange.get(symbolInfo) || this.getExchangeForSymbol(symbolInfo.name);
        
        // Get the appropriate datafeed
        let datafeed;
        if (exchange === 'HYPERLIQUID') {
            datafeed = this.hyperLiquidDatafeed;
        } else if (exchange === 'OSTIUM') {
            datafeed = this.ostiumDatafeed;
        } else if (exchange === 'LIGHTER') {
            datafeed = this.lighterDatafeed;
        } else {
            datafeed = this.hyperLiquidDatafeed; // fallback
        }
        
        console.log(`🔔 UNIFIED DATAFEED - subscribeBars called`);
        console.log(`   Symbol: ${symbolInfo.name}`);
        console.log(`   Exchange (from resolveSymbol): ${exchange}`);
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
        } else if (exchange === 'LIGHTER') {
            return this.lighterDatafeed.api;
        } else {
            return this.hyperLiquidDatafeed.api;
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        console.log('🧹 Destroying Unified Datafeed');
        
        // Destroy all three datafeeds
        if (this.hyperLiquidDatafeed && this.hyperLiquidDatafeed.destroy) {
            this.hyperLiquidDatafeed.destroy();
        }
        
        if (this.ostiumDatafeed && this.ostiumDatafeed.destroy) {
            this.ostiumDatafeed.destroy();
        }
        
        if (this.lighterDatafeed && this.lighterDatafeed.destroy) {
            this.lighterDatafeed.destroy();
        }
        
        this.activeSubscriptions.clear();
        this.symbolExchangeMap.clear();
    }
}

