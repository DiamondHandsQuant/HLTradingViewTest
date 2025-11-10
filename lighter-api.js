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
        console.log('🔵 Lighter WebSocket message received:', data);
        
        // Handle order book updates
        if (data.channel && data.channel.startsWith('order_book/')) {
            const marketIndex = data.channel.split('/')[1];
            const subscriptionKey = `${marketIndex}_orderbook`;
            
            const subscribers = this.subscribers.get(subscriptionKey);
            
            if (subscribers) {
                console.log(`✅ Found ${subscribers.size} order book subscribers for market ${marketIndex}`);
                
                // Format order book data
                const orderBook = {
                    marketIndex: marketIndex,
                    bids: data.data?.bids || [],
                    asks: data.data?.asks || [],
                    time: Date.now()
                };
                
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
        else if (data.channel && data.channel.startsWith('trade/')) {
            const marketIndex = data.channel.split('/')[1];
            const subscriptionKey = `${marketIndex}_trade`;
            
            const subscribers = this.subscribers.get(subscriptionKey);
            
            if (subscribers) {
                subscribers.forEach(callback => {
                    try {
                        callback(data.data);
                    } catch (error) {
                        console.error('Error in trade callback:', error);
                    }
                });
            }
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
        
        if (!this.subscribers.has(subscriptionKey)) {
            this.subscribers.set(subscriptionKey, new Set());
            console.log(`📝 Created new order book subscription set for market ${marketIndex}`);
        }
        
        this.subscribers.get(subscriptionKey).add(callback);
        console.log(`👥 Added order book callback, total subscribers: ${this.subscribers.get(subscriptionKey).size}`);

        // Send subscription message
        const subscriptionMessage = {
            type: 'subscribe',
            channel: `order_book/${marketIndex}`
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`📤 Sending Lighter WebSocket subscription:`, subscriptionMessage);
            this.ws.send(JSON.stringify(subscriptionMessage));
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
        
        if (this.subscribers.has(subscriptionKey)) {
            this.subscribers.delete(subscriptionKey);
            console.log(`✅ Removed order book subscription for market ${marketIndex}`);
            
            // Send unsubscribe message
            const unsubscribeMessage = {
                type: 'unsubscribe',
                channel: `order_book/${marketIndex}`
            };
            
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                console.log(`📤 Sending Lighter WebSocket unsubscribe:`, unsubscribeMessage);
                this.ws.send(JSON.stringify(unsubscribeMessage));
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

