/**
 * HyperLiquid API Integration
 * Handles REST API calls and WebSocket connections for real-time data
 */

class HyperLiquidAPI {
    constructor() {
        this.baseURL = 'https://api.hyperliquid.xyz';
        this.wsURL = 'wss://api.hyperliquid.xyz/ws';
        this.ws = null;
        this.subscribers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnecting = false;
        
        // Rate limiting
        this.lastRequestTime = 0;
        this.minRequestInterval = 100; // Minimum 100ms between requests
        this.requestQueue = [];
        this.isProcessingQueue = false;
    }

    /**
     * Rate-limited API request
     * @param {string} url - API endpoint URL
     * @param {Object} body - Request body
     * @returns {Promise<Response>} API response
     */
    async makeRateLimitedRequest(url, body) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ url, body, resolve, reject });
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

            const { url, body, resolve, reject } = this.requestQueue.shift();

            try {
                this.lastRequestTime = Date.now();
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body)
                });
                resolve(response);
            } catch (error) {
                reject(error);
            }
        }

        this.isProcessingQueue = false;
    }

    /**
     * Get historical candle data from HyperLiquid
     * @param {string} coin - Symbol (e.g., 'BTC')
     * @param {string} interval - Time interval (e.g., '1m', '5m', '1h', '1d')
     * @param {number} startTime - Start timestamp in milliseconds
     * @param {number} endTime - End timestamp in milliseconds
     * @returns {Promise<Array>} Array of candle data
     */
    async getCandles(coin, interval, startTime, endTime) {
        try {
            // Validate input parameters
            if (!coin || !interval || !startTime || !endTime) {
                throw new Error('Missing required parameters');
            }
            
            // Validate timestamps are reasonable (not from 1970)
            const minValidTime = new Date('2020-01-01').getTime();
            if (startTime < minValidTime || endTime < minValidTime) {
                throw new Error(`Invalid timestamp range: startTime=${new Date(startTime)}, endTime=${new Date(endTime)}`);
            }
            
            if (startTime >= endTime) {
                throw new Error(`Invalid time range: startTime >= endTime`);
            }
            
            const requestBody = {
                type: 'candleSnapshot',
                req: {
                    coin: coin,
                    interval: interval,
                    startTime: startTime,
                    endTime: endTime
                }
            };
            
            console.log('🌐 Making HyperLiquid API request:', requestBody);
            
            const response = await this.makeRateLimitedRequest(`${this.baseURL}/info`, requestBody);

            console.log('📡 API Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const data = await response.json();
            console.log('📦 Raw API data received:', data);
            console.log('📊 Data type:', typeof data, 'Array?', Array.isArray(data));
            
            if (Array.isArray(data) && data.length > 0) {
                console.log('🔍 Sample raw candle:', data[0]);
            }
            
            const formatted = this.formatCandleData(data);
            console.log('✨ Formatted data sample:', formatted.slice(0, 2));
            
            return formatted;
        } catch (error) {
            console.error('💥 Error fetching candle data:', error);
            throw error;
        }
    }

    /**
     * Get current market data for all coins
     * @returns {Promise<Object>} Market data object
     */
    async getAllMids() {
        try {
            const response = await this.makeRateLimitedRequest(`${this.baseURL}/info`, {
                type: 'allMids'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching market data:', error);
            throw error;
        }
    }

    /**
     * Get metadata for perpetual contracts
     * @returns {Promise<Object>} Metadata object
     */
    async getMeta() {
        try {
            const response = await this.makeRateLimitedRequest(`${this.baseURL}/info`, {
                type: 'meta'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching metadata:', error);
            throw error;
        }
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
            // HyperLiquid returns timestamps in milliseconds, convert to seconds
            const timestamp = Math.floor(candle.t / 1000);
            
            // Debug timestamp conversion for first few items
            if (index < 3) {
                console.log(`🔍 Raw timestamp: ${candle.t} -> Converted: ${timestamp} -> Date: ${new Date(timestamp * 1000)}`);
            }
            
            return {
                time: timestamp,
                open: parseFloat(candle.o),
                high: parseFloat(candle.h),
                low: parseFloat(candle.l),
                close: parseFloat(candle.c),
                volume: parseFloat(candle.v || 0)
            };
        }).sort((a, b) => a.time - b.time);

        console.log('Formatted candle data sample:', formatted.slice(0, 3));
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
                    console.log('WebSocket connected to HyperLiquid');
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleWebSocketMessage(data);
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('WebSocket connection closed:', event.code, event.reason);
                    this.isConnecting = false;
                    this.handleWebSocketClose();
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
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
        console.log('🔵 WebSocket message received:', data);
        
        if (data.channel === 'candle') {
            // Debug the actual data structure
            console.log('🔍 Raw candle data structure:', data.data);
            console.log('🔍 Available data keys:', Object.keys(data.data));
            
            // Try different possible field names for coin and interval
            const coin = data.data.coin || data.data.s || data.data.symbol || 'BTC';
            const interval = data.data.interval || data.data.i || data.data.timeframe || '1m';
            
            console.log(`🔍 Extracted coin: ${coin}, interval: ${interval}`);
            
            const subscriptionKey = `${coin}_${interval}`;
            console.log(`🔑 Looking for subscription key: ${subscriptionKey}`);
            console.log(`📋 Available subscriptions:`, Array.from(this.subscribers.keys()));
            
            const subscribers = this.subscribers.get(subscriptionKey);
            
            if (subscribers) {
                console.log(`✅ Found ${subscribers.size} subscribers for ${subscriptionKey}`);
                
                const formattedCandle = {
                    time: Math.floor(data.data.t / 1000), // Convert milliseconds to seconds
                    open: parseFloat(data.data.o),
                    high: parseFloat(data.data.h),
                    low: parseFloat(data.data.l),
                    close: parseFloat(data.data.c),
                    volume: parseFloat(data.data.v || 0)
                };

                console.log('📊 Formatted real-time candle:', formattedCandle);
                console.log('🕐 Real-time candle timestamp:', formattedCandle.time, 'Date:', new Date(formattedCandle.time * 1000));

                subscribers.forEach(callback => {
                    try {
                        console.log('📞 Calling subscriber callback...');
                        callback(formattedCandle);
                    } catch (error) {
                        console.error('❌ Error in subscriber callback:', error);
                    }
                });
            } else {
                console.warn(`⚠️ No subscribers found for ${subscriptionKey}`);
                console.log('🔍 Trying to match with available subscriptions...');
                
                // Try to find a matching subscription by checking all available keys
                for (const availableKey of this.subscribers.keys()) {
                    console.log(`🔍 Checking if ${availableKey} matches pattern...`);
                    if (availableKey.includes(coin) || availableKey.includes('BTC')) {
                        console.log(`🎯 Found potential match: ${availableKey}`);
                        const matchedSubscribers = this.subscribers.get(availableKey);
                        if (matchedSubscribers) {
                            const formattedCandle = {
                                time: Math.floor(data.data.t / 1000),
                                open: parseFloat(data.data.o),
                                high: parseFloat(data.data.h),
                                low: parseFloat(data.data.l),
                                close: parseFloat(data.data.c),
                                volume: parseFloat(data.data.v || 0)
                            };
                            
                            matchedSubscribers.forEach(callback => {
                                try {
                                    console.log('📞 Calling matched subscriber callback...');
                                    callback(formattedCandle);
                                } catch (error) {
                                    console.error('❌ Error in matched subscriber callback:', error);
                                }
                            });
                            break;
                        }
                    }
                }
            }
        } else if (data.channel === 'l2Book') {
            // Handle order book updates
            console.log('📚 Order book message received:', data.data);
            
            const coin = data.data.coin;
            const subscriptionKey = `${coin}_orderbook`;
            
            // CRITICAL: Check if subscription still exists BEFORE processing
            // This prevents processing stale messages after unsubscribe
            console.log(`🔑 Looking for order book subscription key: ${subscriptionKey}`);
            const subscribers = this.subscribers.get(subscriptionKey);
            
            if (!subscribers || subscribers.size === 0) {
                console.log(`⚠️  Ignoring order book update for ${coin} - no active subscribers`);
                return;
            }
            
            console.log(`✅ Found ${subscribers.size} order book subscribers for ${coin}`);
            
            // Format order book data according to HyperLiquid spec
            const orderBook = {
                coin: coin,
                levels: data.data.levels, // [bids, asks]
                time: Date.now()
            };
            
            console.log('📊 Formatted order book:', orderBook);
            
            // Double-check subscription still exists before calling callbacks
            if (this.subscribers.has(subscriptionKey)) {
                // Call all subscribers
                subscribers.forEach(callback => {
                    try {
                        console.log('📞 Calling order book subscriber callback...');
                        callback(orderBook);
                    } catch (error) {
                        console.error('Error in order book callback:', error);
                    }
                });
            } else {
                console.log(`⚠️  Subscription cleared during processing, skipping callbacks`);
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
            
            console.log(`Attempting to reconnect WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket().catch(error => {
                    console.error('WebSocket reconnection failed:', error);
                });
            }, delay);
        } else {
            console.error('Max WebSocket reconnection attempts reached');
        }
    }

    /**
     * Force disconnect WebSocket and stop all subscriptions
     */
    disconnectWebSocket() {
        console.log('🔌 Disconnecting HyperLiquid WebSocket');
        
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
        
        console.log('✅ HyperLiquid WebSocket disconnected and all subscriptions cleared');
    }

    /**
     * Subscribe to real-time candle updates
     * @param {string} coin - Symbol to subscribe to
     * @param {string} interval - Time interval
     * @param {Function} callback - Callback function for updates
     */
    async subscribeToCandles(coin, interval, callback) {
        console.log(`🔔 Subscribing to: ${coin}_${interval}`);
        await this.connectWebSocket();

        const subscriptionKey = `${coin}_${interval}`;
        
        if (!this.subscribers.has(subscriptionKey)) {
            this.subscribers.set(subscriptionKey, new Set());
            console.log(`📝 Created new subscription set for: ${subscriptionKey}`);
        }
        
        this.subscribers.get(subscriptionKey).add(callback);
        console.log(`👥 Added callback, total subscribers for ${subscriptionKey}:`, this.subscribers.get(subscriptionKey).size);
        console.log(`📋 All subscription keys:`, Array.from(this.subscribers.keys()));

        // Send subscription message
        const subscriptionMessage = {
            method: 'subscribe',
            subscription: {
                type: 'candle',
                coin: coin,
                interval: interval
            }
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`📤 Sending WebSocket subscription:`, subscriptionMessage);
            this.ws.send(JSON.stringify(subscriptionMessage));
        } else {
            console.warn(`⚠️ WebSocket not ready for subscription. State:`, this.ws?.readyState);
        }
    }

    /**
     * Subscribe to order book updates
     * @param {string} coin - Symbol (e.g., 'BTC')
     * @param {Function} callback - Callback function to handle order book updates
     */
    async subscribeToOrderBook(coin, callback) {
        console.log(`📚 Subscribing to order book: ${coin}`);
        
        await this.connectWebSocket();

        const subscriptionKey = `${coin}_orderbook`;
        
        // CRITICAL: Clear any existing callbacks first to prevent duplicates
        // This ensures only ONE callback is active per coin at a time
        if (this.subscribers.has(subscriptionKey)) {
            const existingCount = this.subscribers.get(subscriptionKey).size;
            if (existingCount > 0) {
                console.log(`⚠️  Clearing ${existingCount} existing callback(s) for ${coin} before adding new one`);
                this.subscribers.get(subscriptionKey).clear();
            }
        } else {
            this.subscribers.set(subscriptionKey, new Set());
            console.log(`📝 Created new order book subscription set for: ${coin}`);
        }
        
        this.subscribers.get(subscriptionKey).add(callback);
        console.log(`👥 Added order book callback, total subscribers for ${coin}: ${this.subscribers.get(subscriptionKey).size}`);

        // Send order book subscription message
        const subscriptionMessage = {
            method: 'subscribe',
            subscription: {
                type: 'l2Book',
                coin: coin
            }
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`📤 Sending WebSocket order book subscription:`, subscriptionMessage);
            this.ws.send(JSON.stringify(subscriptionMessage));
        } else {
            console.warn(`⚠️ WebSocket not ready for order book subscription. State:`, this.ws?.readyState);
        }
    }

    /**
     * Unsubscribe from order book updates
     * @param {string} coin - Symbol to unsubscribe from
     */
    unsubscribeFromOrderBook(coin) {
        console.log(`🧹 Unsubscribing from order book: ${coin}`);
        
        const subscriptionKey = `${coin}_orderbook`;
        
        if (this.subscribers.has(subscriptionKey)) {
            // Clear all callbacks for this order book
            this.subscribers.delete(subscriptionKey);
            console.log(`✅ Removed order book subscription for ${coin}`);
            
            // Send unsubscribe message to WebSocket
            const unsubscribeMessage = {
                method: 'unsubscribe',
                subscription: {
                    type: 'l2Book',
                    coin: coin
                }
            };
            
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                console.log(`📤 Sending WebSocket order book unsubscribe:`, unsubscribeMessage);
                this.ws.send(JSON.stringify(unsubscribeMessage));
            }
        } else {
            console.log(`ℹ️  No active order book subscription found for ${coin}`);
        }
    }

    /**
     * Unsubscribe from candle updates
     * @param {string} coin - Symbol to unsubscribe from
     * @param {string} interval - Time interval
     * @param {Function} callback - Callback function to remove
     */
    unsubscribeFromCandles(coin, interval, callback) {
        const subscriptionKey = `${coin}_${interval}`;
        const subscribers = this.subscribers.get(subscriptionKey);
        
        if (subscribers) {
            subscribers.delete(callback);
            
            if (subscribers.size === 0) {
                this.subscribers.delete(subscriptionKey);
                
                // Send unsubscription message
                const unsubscriptionMessage = {
                    method: 'unsubscribe',
                    subscription: {
                        type: 'candle',
                        coin: coin,
                        interval: interval
                    }
                };

                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(unsubscriptionMessage));
                }
            }
        }
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
        return ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w'];
    }

    /**
     * Convert TradingView interval to HyperLiquid interval
     * @param {string} tvInterval - TradingView interval
     * @returns {string} HyperLiquid interval
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
     * Get interval in milliseconds
     * @param {string} interval - Interval string
     * @returns {number} Interval in milliseconds
     */
    getIntervalMs(interval) {
        const intervalMap = {
            '1m': 60 * 1000,
            '3m': 3 * 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '30m': 30 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '2h': 2 * 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '8h': 8 * 60 * 60 * 1000,
            '12h': 12 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '3d': 3 * 24 * 60 * 60 * 1000,
            '1w': 7 * 24 * 60 * 60 * 1000
        };
        
        return intervalMap[interval] || 60 * 60 * 1000; // Default to 1 hour
    }
}

// Export for use in other modules
window.HyperLiquidAPI = HyperLiquidAPI;
