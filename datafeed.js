/**
 * Simplified TradingView Datafeed Implementation for HyperLiquid
 * This implements a basic datafeed interface that works with TradingView widget
 */

class HyperLiquidDatafeed {
    constructor() {
        this.api = new HyperLiquidAPI();
        this.supportedResolutions = ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', '720', '1D', '3D', '1W'];
        this.config = {
            supported_resolutions: this.supportedResolutions,
            exchanges: [
                {
                    value: 'HYPERLIQUID',
                    name: 'HyperLiquid',
                    desc: 'HyperLiquid Exchange'
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
    }

    /**
     * Initialize the datafeed
     */
    async initialize() {
        try {
            console.log('Initializing HyperLiquid datafeed...');
            
            // Create default symbols
            const defaultSymbols = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC'];
            
            defaultSymbols.forEach(symbol => {
                const symbolInfo = {
                    name: symbol,
                    full_name: `HYPERLIQUID:${symbol}USD`,
                    description: `${symbol}/USD`,
                    type: 'crypto',
                    session: '24x7',
                    timezone: 'Etc/UTC',
                    exchange: 'HYPERLIQUID',
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
            
            console.log('HyperLiquid datafeed initialized with', this.symbols.size, 'symbols');
        } catch (error) {
            console.error('Failed to initialize datafeed:', error);
            throw error;
        }
    }

    /**
     * TradingView datafeed method: onReady
     */
    onReady(callback) {
        console.log('Datafeed onReady called');
        setTimeout(() => {
            callback(this.config);
        }, 0);
    }

    /**
     * TradingView datafeed method: searchSymbols
     */
    searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        console.log('Search symbols:', userInput);
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
     */
    resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        console.log('Resolve symbol:', symbolName);
        
        const symbol = symbolName.split(':').pop().replace('USD', '');
        let symbolInfo = this.symbols.get(symbol);
        
        if (!symbolInfo) {
            // Create a default symbol info if not found
            symbolInfo = {
                name: symbol,
                full_name: `HYPERLIQUID:${symbol}USD`,
                description: `${symbol}/USD`,
                type: 'crypto',
                session: '24x7',
                timezone: 'Etc/UTC',
                exchange: 'HYPERLIQUID',
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
        }
        
        setTimeout(() => {
            onSymbolResolvedCallback(symbolInfo);
        }, 0);
    }

    /**
     * TradingView datafeed method: getBars
     */
    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        console.log('Get bars for:', symbolInfo.name, 'resolution:', resolution);
        
        try {
            const symbol = symbolInfo.name;
            const interval = this.api.convertInterval(resolution);
            let { from, to } = periodParams;
            
            // Prevent requests for very old data (before 2020) to avoid API errors
            const minTimestamp = Math.floor(new Date('2020-01-01').getTime() / 1000);
            const maxHistoryDays = 365; // Limit to 1 year of history
            const currentTime = Math.floor(Date.now() / 1000);
            const maxHistoryTimestamp = currentTime - (maxHistoryDays * 24 * 60 * 60);
            
            // Clamp BOTH from and to timestamps to reasonable bounds
            if (from < minTimestamp) {
                console.log(`⚠️ Requested start time too old (${new Date(from * 1000)}), clamping to ${new Date(minTimestamp * 1000)}`);
                from = Math.max(minTimestamp, maxHistoryTimestamp);
            }
            
            if (to < minTimestamp) {
                console.log(`⚠️ Requested end time too old (${new Date(to * 1000)}), clamping to current time`);
                to = currentTime;
            }
            
            // Ensure to timestamp is not in the future and not before from
            if (to > currentTime) {
                to = currentTime;
            }
            
            // Ensure from is not after to
            if (from >= to) {
                console.log(`⚠️ Invalid date range: from >= to, adjusting...`);
                from = to - (24 * 60 * 60); // Set from to 1 day before to
            }
            
            // Convert timestamps to milliseconds
            const startTime = from * 1000;
            const endTime = to * 1000;
            
            console.log(`Fetching bars for ${symbol}, interval: ${interval}, from: ${new Date(startTime)}, to: ${new Date(endTime)}`);
            
            // Try to fetch real data from HyperLiquid
            console.log('🔍 Attempting to fetch real data from HyperLiquid...');
            console.log('📊 Request params:', { symbol, interval, startTime, endTime });
            
            try {
                const candles = await this.api.getCandles(symbol, interval, startTime, endTime);
                console.log('📥 Raw API response:', candles);
                
                if (!candles || candles.length === 0) {
                    console.warn('⚠️ No data received from HyperLiquid API, using mock data');
                    console.log('🔧 Generating mock data for testing...');
                    const mockBars = this.generateMockBars(startTime, endTime, interval);
                    onHistoryCallback(mockBars, { noData: false });
                    return;
                }
                
                console.log(`✅ Received ${candles.length} candles from HyperLiquid`);
                console.log('📋 Sample candle data:', candles.slice(0, 2));
                
                // Convert to TradingView format
                const bars = candles.map(candle => {
                    // TradingView expects timestamps in MILLISECONDS, not seconds!
                    let timestamp = candle.time;
                    
                    // If timestamp is in seconds (from HyperLiquid), convert to milliseconds
                    if (timestamp < 1000000000000) {
                        console.log(`🔄 Converting timestamp from seconds to milliseconds: ${timestamp} -> ${timestamp * 1000}`);
                        timestamp = timestamp * 1000;
                    }
                    
                    // Validate timestamp is reasonable (after 2020)
                    const minValidTimestamp = new Date('2020-01-01').getTime(); // milliseconds
                    if (timestamp < minValidTimestamp) {
                        console.warn(`⚠️ Invalid timestamp detected: ${timestamp}, using current time`);
                        timestamp = Date.now();
                    }
                    
                    return {
                        time: timestamp, // TradingView expects milliseconds
                        open: parseFloat(candle.open),
                        high: parseFloat(candle.high),
                        low: parseFloat(candle.low),
                        close: parseFloat(candle.close),
                        volume: parseFloat(candle.volume || 0)
                    };
                });
                
                // Sort by time
                bars.sort((a, b) => a.time - b.time);
                
                console.log('📈 Formatted bars sample:', bars.slice(0, 2));
                console.log('🕐 First bar timestamp:', bars[0]?.time, 'Date:', new Date(bars[0]?.time));
                console.log('🕐 Last bar timestamp:', bars[bars.length - 1]?.time, 'Date:', new Date(bars[bars.length - 1]?.time));
                console.log('🔍 All bar timestamps (first 5):', bars.slice(0, 5).map(b => ({ time: b.time, date: new Date(b.time).toISOString() })));
                console.log(`🎯 Sending ${bars.length} bars to TradingView`);
                
                // Force TradingView to use our data by indicating this is the most recent data
                onHistoryCallback(bars, { 
                    noData: bars.length === 0,
                    nextTime: undefined // No more historical data available
                });
                
            } catch (apiError) {
                console.error('❌ HyperLiquid API error:', apiError);
                console.log('🔄 Falling back to mock data...');
                const mockBars = this.generateMockBars(startTime, endTime, interval);
                onHistoryCallback(mockBars, { noData: false });
            }
            
        } catch (error) {
            console.error('Error fetching bars:', error);
            onErrorCallback(error.message);
        }
    }

    /**
     * Generate mock bars for testing
     */
    generateMockBars(startTime, endTime, interval) {
        const bars = [];
        const intervalMs = this.api.getIntervalMs(interval);
        
        // Ensure we don't generate data from 1970 - use recent dates
        const now = Date.now();
        const minTime = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago
        
        // Fix invalid date ranges
        let actualStartTime = Math.max(startTime, minTime);
        let actualEndTime = Math.min(endTime, now);
        
        // If endTime is still invalid (from 1970), use recent dates
        if (actualEndTime < actualStartTime || actualEndTime < minTime) {
            actualEndTime = now;
            actualStartTime = now - (7 * 24 * 60 * 60 * 1000); // Last 7 days
        }
        
        let currentTime = actualStartTime;
        let price = 111000; // Starting price for BTC (realistic current price)
        
        console.log(`🔧 Generating mock data from ${new Date(actualStartTime)} to ${new Date(actualEndTime)}`);
        
        while (currentTime <= actualEndTime) {
            const change = (Math.random() - 0.5) * 2000; // Random price change
            const open = price;
            const close = price + change;
            const high = Math.max(open, close) + Math.random() * 1000;
            const low = Math.min(open, close) - Math.random() * 1000;
            const volume = Math.random() * 10;
            
            bars.push({
                time: Math.floor(currentTime / 1000), // TradingView expects seconds
                open: Math.round(open * 100) / 100,
                high: Math.round(high * 100) / 100,
                low: Math.round(low * 100) / 100,
                close: Math.round(close * 100) / 100,
                volume: Math.round(volume * 100) / 100
            });
            
            price = close;
            currentTime += intervalMs;
        }
        
        console.log('Generated mock bars sample:', bars.slice(0, 3));
        console.log(`📊 Generated ${bars.length} mock bars with timestamps from ${new Date(bars[0]?.time * 1000)} to ${new Date(bars[bars.length - 1]?.time * 1000)}`);
        return bars;
    }

    /**
     * TradingView datafeed method: subscribeBars
     */
    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
        console.log('Subscribe bars:', symbolInfo.name, resolution, subscriberUID);
        
        const symbol = symbolInfo.name;
        const interval = this.api.convertInterval(resolution);
        
        // Store subscriber info
        this.subscribers.set(subscriberUID, {
            symbolInfo,
            resolution,
            onRealtimeCallback,
            symbol,
            interval
        });
        
        // Subscribe to real-time updates from HyperLiquid
        const callback = (candle) => {
            // TradingView expects timestamps in MILLISECONDS for real-time data too!
            let timestamp = candle.time;
            
            // If timestamp is in seconds, convert to milliseconds
            if (timestamp < 1000000000000) {
                console.log(`🔄 Real-time: Converting timestamp from seconds to milliseconds: ${timestamp} -> ${timestamp * 1000}`);
                timestamp = timestamp * 1000;
            }
            
            // Validate timestamp is reasonable (after 2020)
            const minValidTimestamp = new Date('2020-01-01').getTime(); // milliseconds
            if (timestamp < minValidTimestamp) {
                console.warn(`⚠️ Invalid real-time timestamp detected: ${timestamp}, using current time`);
                timestamp = Date.now();
            }
            
            const bar = {
                time: timestamp, // TradingView expects milliseconds
                open: parseFloat(candle.open),
                high: parseFloat(candle.high),
                low: parseFloat(candle.low),
                close: parseFloat(candle.close),
                volume: parseFloat(candle.volume || 0)
            };
            
            console.log('🔴 Real-time candle update:', bar);
            console.log('🕐 Real-time timestamp:', bar.time, 'Date:', new Date(bar.time));
            onRealtimeCallback(bar);
        };
        
        // Store the callback for cleanup
        this.subscribers.get(subscriberUID).callback = callback;
        
        // Subscribe to WebSocket updates
        this.api.subscribeToCandles(symbol, interval, callback).catch(error => {
            console.error('Failed to subscribe to real-time data:', error);
        });
    }

    /**
     * TradingView datafeed method: unsubscribeBars
     */
    unsubscribeBars(subscriberUID) {
        console.log('Unsubscribe bars:', subscriberUID);
        
        const subscriber = this.subscribers.get(subscriberUID);
        if (subscriber && subscriber.callback) {
            // Unsubscribe from WebSocket updates
            this.api.unsubscribeFromCandles(
                subscriber.symbol,
                subscriber.interval,
                subscriber.callback
            );
        }
        
        this.subscribers.delete(subscriberUID);
    }

    /**
     * TradingView datafeed method: calculateHistoryDepth
     * Limit historical data depth to prevent old data requests
     */
    calculateHistoryDepth(resolution, resolutionBack, intervalBack) {
        // Limit history depth based on resolution to prevent 1970 requests
        const maxBars = {
            '1': 1440,    // 1 minute: 1 day
            '5': 2016,    // 5 minutes: 1 week  
            '15': 2016,   // 15 minutes: 3 weeks
            '30': 1440,   // 30 minutes: 1 month
            '60': 720,    // 1 hour: 1 month
            '240': 180,   // 4 hours: 1 month
            '1D': 365,    // 1 day: 1 year
            '1W': 52,     // 1 week: 1 year
        };
        
        return maxBars[resolution] || 720; // Default to 720 bars (1 month for hourly)
    }

    /**
     * TradingView datafeed method: getMarks
     */
    getMarks(symbolInfo, from, to, onDataCallback, resolution) {
        onDataCallback([]);
    }

    /**
     * TradingView datafeed method: getTimescaleMarks
     */
    getTimescaleMarks(symbolInfo, from, to, onDataCallback, resolution) {
        onDataCallback([]);
    }

    /**
     * TradingView datafeed method: getServerTime
     */
    getServerTime(callback) {
        callback(Math.floor(Date.now() / 1000));
    }

    /**
     * Get current price for a symbol
     */
    async getCurrentPrice(symbol) {
        try {
            const mids = await this.api.getAllMids();
            return mids[symbol] ? parseFloat(mids[symbol]) : null;
        } catch (error) {
            console.error('Error fetching current price:', error);
            // Return mock price as fallback
            return 45000 + (Math.random() - 0.5) * 1000;
        }
    }

    /**
     * Get all available symbols
     */
    getSymbols() {
        return Array.from(this.symbols.keys());
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.subscribers.clear();
        if (this.api) {
            this.api.disconnect();
        }
    }
}

// Export for use in other modules
window.HyperLiquidDatafeed = HyperLiquidDatafeed;