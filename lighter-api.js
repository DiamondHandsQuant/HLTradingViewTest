/**
 * Lighter API Integration
 * Handles REST API calls and WebSocket connections for real-time data
 */

class LighterAPI {
    constructor() {
        this.baseURL = 'https://mainnet.zklighter.elliot.ai/api/v1';
        this.wsURL = 'wss://mainnet.zklighter.elliot.ai/stream';
        this.ws = null;
        this.subscribers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnecting = false;
        
        // Market data cache
        this.markets = new Map();
        this.marketsBySymbol = new Map();
        
        // Rate limiting
        this.lastRequestTime = 0;
        this.minRequestInterval = 100; // Minimum 100ms between requests
        this.requestQueue = [];
        this.isProcessingQueue = false;
    }

    /**
     * Rate-limited API request
     * @param {string} url - API endpoint URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} API response
     */
    async makeRateLimitedRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ url, options, resolve, reject });
            this.processRequestQueue();
        });
    }

    /**
     * Process the request queue with rate limiting
     */
    async processRequestQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;

            if (timeSinceLastRequest < this.minRequestInterval) {
                await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
            }

            const { url, options, resolve, reject } = this.requestQueue.shift();

            try {
                this.lastRequestTime = Date.now();
                const response = await fetch(url, {
                    method: options.method || 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    },
                    ...options
                });
                resolve(response);
            } catch (error) {
                reject(error);
            }
        }

        this.isProcessingQueue = false;
    }

    /**
     * Get all available markets/order books
     * @returns {Promise<Array>} Array of market data
     */
    async getMarkets() {
        try {
            console.log('🔍 Fetching Lighter markets...');
            const response = await this.makeRateLimitedRequest(`${this.baseURL}/orderBookDetails`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📦 Raw Lighter markets data:', data);
            
            // Store markets for later use
            const markets = data.order_book_details || [];
            if (Array.isArray(markets)) {
                markets.forEach(market => {
                    this.markets.set(market.market_id, market);
                    // Create symbol mapping (e.g., "BTC/USD" -> market data)
                    if (market.symbol) {
                        this.marketsBySymbol.set(market.symbol, market);
                        console.log(`   📝 Registered market: ${market.symbol} -> ID ${market.market_id}`);
                    }
                });
                console.log(`✅ Loaded ${this.markets.size} Lighter markets`);
                console.log(`   Available symbols:`, Array.from(this.marketsBySymbol.keys()));
            }

            return markets;
        } catch (error) {
            console.error('❌ Error fetching Lighter markets:', error);
            throw error;
        }
    }

    /**
     * Get historical candlestick data
     * @param {number} marketIndex - Market index/ID
     * @param {string} interval - Time interval (e.g., '1m', '5m', '1h', '1d')
     * @param {number} startTime - Start timestamp in milliseconds
     * @param {number} endTime - End timestamp in milliseconds
     * @returns {Promise<Array>} Array of candle data
     */
    async getCandles(marketIndex, interval, startTime, endTime) {
        try {
            // Validate input parameters
            if (marketIndex === undefined || !interval || !startTime || !endTime) {
                throw new Error('Missing required parameters');
            }
            
            // Validate timestamps
            const minValidTime = new Date('2020-01-01').getTime();
            if (startTime < minValidTime || endTime < minValidTime) {
                throw new Error(`Invalid timestamp range: startTime=${new Date(startTime)}, endTime=${new Date(endTime)}`);
            }
            
            if (startTime >= endTime) {
                throw new Error(`Invalid time range: startTime >= endTime`);
            }
            
            // Use interval directly (already in correct format like '1m', '1h', etc.)
            const resolution = interval;
            
            // Convert timestamps to seconds
            const startTimestamp = Math.floor(startTime / 1000);
            const endTimestamp = Math.floor(endTime / 1000);
            
            // Calculate count_back (number of candles to fetch)
            const timeRange = endTimestamp - startTimestamp;
            const countBack = Math.min(1000, Math.ceil(timeRange / this.getResolutionSeconds(resolution)));
            
            const url = `${this.baseURL}/candlesticks?` + 
                `market_id=${marketIndex}&` +
                `resolution=${resolution}&` +
                `start_timestamp=${startTimestamp}&` +
                `end_timestamp=${endTimestamp}&` +
                `count_back=${countBack}`;
            
            console.log('🌐 Making Lighter API request:', url);
            
            const response = await this.makeRateLimitedRequest(url);

            console.log('📡 API Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const data = await response.json();
            console.log('📦 Raw Lighter candlestick data:', data);
            
            const formatted = this.formatCandleData(data.candlesticks || []);
            console.log('✨ Formatted candle data sample:', formatted.slice(0, 2));
            
            return formatted;
        } catch (error) {
            console.error('💥 Error fetching Lighter candle data:', error);
            throw error;
        }
    }

    /**
     * Get order book details
     * @param {number} marketIndex - Market index/ID
     * @returns {Promise<Object>} Order book data
     */
    async getOrderBook(marketIndex) {
        try {
            const url = `${this.baseURL}/orderBookDetails?orderBookId=${marketIndex}`;
            const response = await this.makeRateLimitedRequest(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching Lighter order book:', error);
            throw error;
        }
    }

    /**
     * Get resolution in seconds for time range calculation
     * @param {string} resolution - Resolution string (e.g., '1m', '1h', '1d')
     * @returns {number} Seconds per candle
     */
    getResolutionSeconds(resolution) {
        const resolutionMap = {
            '1m': 60,
            '5m': 300,
            '15m': 900,
            '30m': 1800,
            '1h': 3600,
            '4h': 14400,
            '12h': 43200,
            '1d': 86400,
            '1w': 604800
        };
        
        return resolutionMap[resolution] || 3600; // Default to 1 hour
    }

    /**
     * Format candle data for TradingView
     * @param {Array} rawData - Raw candle data from API
     * @returns {Array} Formatted candle data
     */
    formatCandleData(rawData) {
        if (!Array.isArray(rawData)) {
            console.warn('Invalid candle data received:', rawData);
            return [];
        }

        const formatted = rawData.map((candle, index) => {
            // Lighter returns timestamps - need to verify format
            const timestamp = candle.timestamp || candle.time || candle.t;
            
            // Debug timestamp conversion for first few items
            if (index < 3) {
                console.log(`🔍 Raw candle:`, candle);
                console.log(`🔍 Timestamp: ${timestamp} -> Date: ${new Date(timestamp * 1000)}`);
            }
            
            return {
                time: timestamp, // Assuming already in seconds
                open: parseFloat(candle.open || candle.o),
                high: parseFloat(candle.high || candle.h),
                low: parseFloat(candle.low || candle.l),
                close: parseFloat(candle.close || candle.c),
                volume: parseFloat(candle.volume || candle.v || 0)
            };
        }).sort((a, b) => a.time - b.time);

        return formatted;
    }

    /**
     * Connect to WebSocket for real-time data
     */
    connectWebSocket() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        if (this.isConnecting) {
            return new Promise((resolve) => {
                const checkConnection = () => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        resolve();
                    } else {
                        setTimeout(checkConnection, 100);
                    }
                };
                checkConnection();
            });
        }

        this.isConnecting = true;

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.wsURL);

                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected to Lighter');
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleWebSocketMessage(data);
                    } catch (error) {
                        console.error('Error parsing Lighter WebSocket message:', error);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('Lighter WebSocket connection closed:', event.code, event.reason);
                    this.isConnecting = false;
                    this.handleWebSocketClose();
                };

                this.ws.onerror = (error) => {
                    console.error('Lighter WebSocket error:', error);
                    this.isConnecting = false;
                    reject(error);
                };
            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    /**
     * Handle WebSocket messages
     * @param {Object} data - Parsed message data
     */
    handleWebSocketMessage(data) {
        // Reduce logging noise - only log non-order-book messages or important events
        if (!data.channel || !data.channel.startsWith('order_book:')) {
            console.log('🔵 Lighter WebSocket message received:', data);
        }
        
        // Handle order book updates
        // Lighter sends TWO types:
        // 1. type: "subscribed/order_book" - FULL snapshot with all levels
        // 2. type: "update/order_book" - DELTA with only changed levels
        if (data.channel && data.channel.startsWith('order_book:')) {
            const marketIndex = data.channel.split(':')[1];
            const subscriptionKey = `${marketIndex}_orderbook`;
            
            // CRITICAL: Check if subscription still exists BEFORE processing
            const subscribers = this.subscribers.get(subscriptionKey);
            
            if (!subscribers || subscribers.size === 0) {
                console.log(`⚠️  Ignoring order book update for market ${marketIndex} - no active subscribers`);
                return;
            }
            
            // Lighter WebSocket format: data.order_book contains bids/asks
            const orderBookData = data.order_book || {};
            const bids = orderBookData.bids || [];
            const asks = orderBookData.asks || [];
            
            // Check if this is a FULL snapshot or a DELTA update
            const isSnapshot = data.type === 'subscribed/order_book';
            const isDelta = data.type === 'update/order_book';
            
            // Initialize order book cache for this market if needed
            if (!this.orderBookCache) {
                this.orderBookCache = {};
            }
            
            // Format levels helper
            const formatLevels = (levels) => {
                if (!Array.isArray(levels)) return [];
                return levels.map(level => ({
                    px: level[0]?.toString() || level.price?.toString() || '0',
                    sz: level[1]?.toString() || level.size?.toString() || '0'
                }));
            };
            
            if (isSnapshot) {
                // FULL SNAPSHOT - replace entire order book
                console.log(`📚 Received FULL order book snapshot for market ${marketIndex}: ${bids.length} bids, ${asks.length} asks`);
                
                this.orderBookCache[marketIndex] = {
                    bids: formatLevels(bids),
                    asks: formatLevels(asks)
                };
            } else if (isDelta) {
                // DELTA UPDATE - apply changes to cached order book
                console.log(`📝 Received DELTA update for market ${marketIndex}: ${bids.length} bids, ${asks.length} asks`);
                console.log(`   Raw delta data - bids:`, JSON.stringify(bids.slice(0, 3)), `asks:`, JSON.stringify(asks.slice(0, 3)));
                
                // Only apply delta if we have a cached order book
                if (!this.orderBookCache[marketIndex]) {
                    console.log(`⚠️  Received delta update but no cached order book for market ${marketIndex}, skipping`);
                    return;
                }
                
                // Apply delta updates to the cached order book
                const cachedBook = this.orderBookCache[marketIndex];
                
                // Process bid updates
                // Delta format: {"price":"135.403","size":"6.395"} - objects with string values
                for (const bidUpdate of bids) {
                    // Handle both array format [price, size] and object format {price, size}
                    const price = Array.isArray(bidUpdate) 
                        ? bidUpdate[0]?.toString() 
                        : bidUpdate.price?.toString();
                    const size = Array.isArray(bidUpdate) 
                        ? (bidUpdate[1]?.toString() || '0')
                        : (bidUpdate.size?.toString() || '0');
                    
                    if (!price) continue;
                    
                    if (parseFloat(size) === 0) {
                        // Remove level
                        cachedBook.bids = cachedBook.bids.filter(b => b.px !== price);
                    } else {
                        // Update or add level
                        const existingIndex = cachedBook.bids.findIndex(b => b.px === price);
                        if (existingIndex >= 0) {
                            cachedBook.bids[existingIndex].sz = size;
                        } else {
                            cachedBook.bids.push({ px: price, sz: size });
                        }
                    }
                }
                
                // Process ask updates
                // Delta format: {"price":"135.413","size":"1.677"} - objects with string values
                for (const askUpdate of asks) {
                    // Handle both array format [price, size] and object format {price, size}
                    const price = Array.isArray(askUpdate) 
                        ? askUpdate[0]?.toString() 
                        : askUpdate.price?.toString();
                    const size = Array.isArray(askUpdate) 
                        ? (askUpdate[1]?.toString() || '0')
                        : (askUpdate.size?.toString() || '0');
                    
                    if (!price) continue;
                    
                    if (parseFloat(size) === 0) {
                        // Remove level
                        cachedBook.asks = cachedBook.asks.filter(a => a.px !== price);
                    } else {
                        // Update or add level
                        const existingIndex = cachedBook.asks.findIndex(a => a.px === price);
                        if (existingIndex >= 0) {
                            cachedBook.asks[existingIndex].sz = size;
                        } else {
                            cachedBook.asks.push({ px: price, sz: size });
                        }
                    }
                }
                
                // Sort bids descending, asks ascending
                cachedBook.bids.sort((a, b) => parseFloat(b.px) - parseFloat(a.px));
                cachedBook.asks.sort((a, b) => parseFloat(a.px) - parseFloat(b.px));
            } else {
                console.log(`⚠️  Unknown order book message type: ${data.type}`);
                return;
            }
            
            // Get the current full order book from cache
            const cachedBook = this.orderBookCache[marketIndex];
            if (!cachedBook) {
                console.log(`⚠️  No cached order book for market ${marketIndex}`);
                return;
            }
            
            // Create order book object to send to UI
            const orderBook = {
                levels: [
                    cachedBook.bids.slice(0, 50),  // Top 50 bids
                    cachedBook.asks.slice(0, 50)   // Top 50 asks
                ],
                marketIndex: marketIndex,
                time: Date.now()
            };
            
            // Send to callbacks
            if (this.subscribers.has(subscriptionKey)) {
                subscribers.forEach(callback => {
                    try {
                        callback(orderBook);
                    } catch (error) {
                        console.error('Error in order book callback:', error);
                    }
                });
            }
        }
        
        // Handle trade updates
        // Format: {"channel": "trade:3", "type": "update/trade", ...}
        else if (data.channel && data.channel.startsWith('trade:')) {
            const marketIndex = data.channel.split(':')[1];
            const subscriptionKey = `${marketIndex}_trade`;
            
            const subscribers = this.subscribers.get(subscriptionKey);
            
            if (subscribers) {
                subscribers.forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error('Error in trade callback:', error);
                    }
                });
            }
        }
        
        // Handle subscription confirmations
        else if (data.type === 'subscribed/order_book' || data.type === 'subscribed/trade') {
            console.log('✅ Subscription confirmed:', data);
        }
        
        // Log unhandled message types for debugging
        else {
            console.log('ℹ️  Unhandled Lighter WebSocket message type:', data.type || data.channel);
        }
    }

    /**
     * Handle WebSocket connection close
     */
    handleWebSocketClose() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            console.log(`Attempting to reconnect Lighter WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket().catch(error => {
                    console.error('Lighter WebSocket reconnection failed:', error);
                });
            }, delay);
        } else {
            console.error('Max Lighter WebSocket reconnection attempts reached');
        }
    }

    /**
     * Force disconnect WebSocket and stop all subscriptions
     */
    disconnectWebSocket() {
        console.log('🔌 Disconnecting Lighter WebSocket');
        
        // Prevent reconnection
        this.reconnectAttempts = this.maxReconnectAttempts;
        
        if (this.ws) {
            console.log('   Closing WebSocket connection');
            
            // Remove event listeners to prevent reconnection
            this.ws.onclose = null;
            this.ws.onerror = null;
            
            // Close the connection
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            
            this.ws = null;
        }
        
        // Clear all subscribers
        console.log(`   Clearing ${this.subscribers.size} subscription(s)`);
        this.subscribers.clear();
        
        console.log('✅ Lighter WebSocket disconnected and all subscriptions cleared');
    }

    /**
     * Subscribe to order book updates
     * @param {number} marketIndex - Market index/ID
     * @param {Function} callback - Callback function for updates
     */
    async subscribeToOrderBook(marketIndex, callback) {
        console.log(`📚 Subscribing to Lighter order book: market ${marketIndex}`);
        
        await this.connectWebSocket();

        const subscriptionKey = `${marketIndex}_orderbook`;
        
        // CRITICAL: Clear any existing callbacks first to prevent duplicates
        // This ensures only ONE callback is active per market at a time
        if (this.subscribers.has(subscriptionKey)) {
            const existingCount = this.subscribers.get(subscriptionKey).size;
            if (existingCount > 0) {
                console.log(`⚠️  Clearing ${existingCount} existing callback(s) for market ${marketIndex} before adding new one`);
                this.subscribers.get(subscriptionKey).clear();
            }
        } else {
            this.subscribers.set(subscriptionKey, new Set());
            console.log(`📝 Created new order book subscription set for market ${marketIndex}`);
        }
        
        this.subscribers.get(subscriptionKey).add(callback);
        console.log(`👥 Added order book callback, total subscribers: ${this.subscribers.get(subscriptionKey).size}`);

        // Send subscription message according to Lighter API docs
        // Format: {"type": "subscribe", "channel": "order_book/{MARKET_INDEX}"}
        const subscriptionMessage = {
            type: 'subscribe',
            channel: `order_book/${marketIndex}`
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`📤 Sending Lighter order book subscription:`, subscriptionMessage);
            this.ws.send(JSON.stringify(subscriptionMessage));
            console.log(`✅ Lighter order book subscription sent for market ${marketIndex}`);
        } else {
            console.warn(`⚠️  WebSocket not ready for subscription. State:`, this.ws?.readyState);
        }
    }

    /**
     * Unsubscribe from order book updates
     * @param {number} marketIndex - Market index to unsubscribe from
     */
    unsubscribeFromOrderBook(marketIndex) {
        console.log(`🧹 Unsubscribing from Lighter order book: market ${marketIndex}`);
        
        const subscriptionKey = `${marketIndex}_orderbook`;
        
        // Clear the order book cache for this market
        if (this.orderBookCache && this.orderBookCache[marketIndex]) {
            delete this.orderBookCache[marketIndex];
            console.log(`   Cleared order book cache for market ${marketIndex}`);
        }
        
        // CRITICAL: Clear the subscriber set FIRST to stop callbacks immediately
        if (this.subscribers.has(subscriptionKey)) {
            const subscriberCount = this.subscribers.get(subscriptionKey).size;
            console.log(`   Clearing ${subscriberCount} subscriber(s) for market ${marketIndex}`);
            
            // Delete the subscription key to stop all callbacks
            this.subscribers.delete(subscriptionKey);
            console.log(`✅ Removed order book subscription for market ${marketIndex}`);
            
            // Send unsubscribe message according to Lighter API docs
            // Format: {"type": "unsubscribe", "channel": "order_book/{MARKET_INDEX}"}
            const unsubscribeMessage = {
                type: 'unsubscribe',
                channel: `order_book/${marketIndex}`
            };
            
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                console.log(`📤 Sending Lighter order book unsubscribe:`, unsubscribeMessage);
                this.ws.send(JSON.stringify(unsubscribeMessage));
                console.log(`✅ Lighter order book unsubscribe sent for market ${marketIndex}`);
            } else {
                console.log(`⚠️  WebSocket not ready, subscription cleared locally only`);
            }
        } else {
            console.log(`ℹ️  No active order book subscription found for market ${marketIndex}`);
        }
    }

    /**
     * Subscribe to trade updates
     * @param {number} marketIndex - Market index/ID
     * @param {Function} callback - Callback function for updates
     */
    async subscribeToTrades(marketIndex, callback) {
        console.log(`📊 Subscribing to Lighter trades: market ${marketIndex}`);
        
        await this.connectWebSocket();

        const subscriptionKey = `${marketIndex}_trade`;
        
        if (!this.subscribers.has(subscriptionKey)) {
            this.subscribers.set(subscriptionKey, new Set());
        }
        
        this.subscribers.get(subscriptionKey).add(callback);

        // Send subscription message
        const subscriptionMessage = {
            type: 'subscribe',
            channel: `trade/${marketIndex}`
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(subscriptionMessage));
        }
    }

    /**
     * Convert TradingView interval to Lighter interval format
     * @param {string} tvInterval - TradingView interval
     * @returns {string} Lighter interval
     */
    convertInterval(tvInterval) {
        const intervalMap = {
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
        
        return intervalMap[tvInterval] || '1h';
    }

    /**
     * Close WebSocket connection
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.subscribers.clear();
    }

    /**
     * Get supported intervals
     * @returns {Array} Array of supported intervals
     */
    getSupportedIntervals() {
        return ['1m', '5m', '15m', '30m', '1h', '4h', '12h', '1d', '1w'];
    }

    /**
     * Get market ID for a symbol
     * @param {string} symbol - Symbol name (e.g., "BTC", "BTCUSD")
     * @returns {number|null} Market ID or null if not found
     */
    getMarketIdForSymbol(symbol) {
        console.log(`🔍 Looking up market ID for symbol: "${symbol}"`);
        console.log(`   Available symbols in marketsBySymbol:`, Array.from(this.marketsBySymbol.keys()));
        
        // Try exact match first
        const market = this.marketsBySymbol.get(symbol);
        if (market) {
            console.log(`   ✅ Found exact match! Market ID: ${market.market_id}`);
            return market.market_id;
        }
        
        // Try variations
        const variations = [
            symbol,
            symbol.replace(/USD$/, ''),
            symbol + 'USD'
        ];
        
        console.log(`   Trying variations:`, variations);
        
        for (const variant of variations) {
            const market = this.marketsBySymbol.get(variant);
            if (market) {
                console.log(`   ✅ Found market ID ${market.market_id} for symbol "${symbol}" (matched as "${variant}")`);
                return market.market_id;
            }
        }
        
        console.warn(`   ❌ No market ID found for symbol: ${symbol}`);
        console.warn(`   Available market IDs:`, Array.from(this.markets.keys()));
        return null;
    }
}

// Export for use in other modules
window.LighterAPI = LighterAPI;

