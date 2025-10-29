/**
 * Ostium API Integration
 * Handles REST API calls and SSE connections for real-time data
 */

class OstiumAPI {
    constructor(apiKey, apiSecret, baseURL = null, sseURL = null) {
        this.baseURL = baseURL || 'https://history.ostium.io';
        this.sseURL = sseURL || 'https://metadata-backend.ostium.io/price-updates/all-feeds-auth';
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.sseReader = null;
        this.sseAbortController = null;
        this.subscribers = new Map();
        this.priceCache = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 1; // Only try once (CORS issues expected)
        this.reconnectDelay = 1000;
        this.isConnecting = false;
        this.sseConnected = false;
        this.buffer = ''; // Buffer for incomplete SSE data
        
        // Rate limiting
        this.lastRequestTime = 0;
        this.minRequestInterval = 100; // Minimum 100ms between requests
        this.requestQueue = [];
        this.isProcessingQueue = false;
    }

    /**
     * Generate Basic Auth header for SSE
     */
    getAuthHeader() {
        const credentials = `${this.apiKey}:${this.apiSecret}`;
        const encoded = btoa(credentials);
        return `Basic ${encoded}`;
    }

    /**
     * Connect to Ostium SSE for real-time prices
     * Uses fetch() with streaming instead of EventSource due to auth header requirement
     */
    async connectSSE() {
        if (this.isConnecting) {
            console.log('SSE connection already in progress');
            return;
        }

        this.isConnecting = true;
        this.sseAbortController = new AbortController();

        try {
            console.log('Connecting to Ostium SSE...');
            
            const response = await fetch(this.sseURL, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'text/event-stream'
                },
                signal: this.sseAbortController.signal
            });

            if (!response.ok) {
                throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
            }

            console.log('✅ SSE connection established');
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            this.sseConnected = true;
            
            // Start reading the stream
            this.readSSEStream(response.body);
            
        } catch (error) {
            this.isConnecting = false;
            
            if (error.name === 'AbortError') {
                console.log('SSE connection aborted');
                return;
            }
            
            console.warn('⚠️  SSE connection error:', error.message);
            
            // Don't retry if CORS error (won't work from browser anyway)
            if (error.message && error.message.includes('fetch')) {
                console.log('ℹ️  SSE not available (likely CORS restriction). Historical data will still work.');
                return;
            }
            
            // Implement reconnection logic for other errors
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                
                setTimeout(() => {
                    this.connectSSE();
                }, delay);
            } else {
                console.log('ℹ️  SSE connection attempts exhausted. Continuing without real-time updates.');
            }
        }
    }

    /**
     * Read and process SSE stream
     */
    async readSSEStream(body) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        this.sseReader = reader;

        try {
            while (true) {
                const { value, done } = await reader.read();
                
                if (done) {
                    console.log('SSE stream ended');
                    this.reconnectSSE();
                    break;
                }
                
                const chunk = decoder.decode(value, { stream: true });
                this.buffer += chunk;
                
                // Process complete SSE messages
                this.processSSEBuffer();
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error reading SSE stream:', error);
                this.reconnectSSE();
            }
        }
    }

    /**
     * Process buffered SSE data
     */
    processSSEBuffer() {
        const lines = this.buffer.split('\n\n');
        
        // Keep the last incomplete message in the buffer
        this.buffer = lines.pop() || '';
        
        // Process complete messages
        for (const message of lines) {
            if (message.trim()) {
                this.processSSEMessage(message);
            }
        }
    }

    /**
     * Process a single SSE message
     */
    processSSEMessage(message) {
        const lines = message.split('\n');
        let eventType = 'message';
        let eventData = '';
        let eventId = null;
        
        for (const line of lines) {
            if (line.startsWith('event:')) {
                eventType = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
                eventData += line.substring(5).trim();
            } else if (line.startsWith('id:')) {
                eventId = line.substring(3).trim();
            }
        }
        
        if (eventData) {
            try {
                const data = JSON.parse(eventData);
                this.handlePriceUpdate(data, eventType);
            } catch (error) {
                console.error('Error parsing SSE data:', error, eventData);
            }
        }
    }

    /**
     * Handle price update from SSE
     */
    handlePriceUpdate(data, eventType = 'message') {
        console.log('Received price update:', data);
        
        // Extract symbol and price from Ostium data format
        // Note: Adjust these fields based on actual Ostium SSE data structure
        const symbol = data.symbol || data.feedName || data.ticker;
        const price = data.price || data.last || data.close;
        const timestamp = data.timestamp || Date.now();
        
        if (!symbol || !price) {
            console.warn('Invalid price data:', data);
            return;
        }
        
        // Update price cache
        this.priceCache.set(symbol, { 
            price: parseFloat(price), 
            timestamp,
            raw: data
        });
        
        // Notify subscribers
        if (this.subscribers.has(symbol)) {
            this.subscribers.get(symbol).forEach(callback => {
                try {
                    callback({
                        symbol,
                        price: parseFloat(price),
                        timestamp,
                        data
                    });
                } catch (error) {
                    console.error('Error in subscriber callback:', error);
                }
            });
        }
        
        // Also notify wildcard subscribers (listening to all symbols)
        if (this.subscribers.has('*')) {
            this.subscribers.get('*').forEach(callback => {
                try {
                    callback({
                        symbol,
                        price: parseFloat(price),
                        timestamp,
                        data
                    });
                } catch (error) {
                    console.error('Error in wildcard subscriber callback:', error);
                }
            });
        }
    }

    /**
     * Reconnect SSE with backoff
     */
    reconnectSSE() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
            console.log(`Reconnecting SSE in ${delay}ms`);
            setTimeout(() => this.connectSSE(), delay);
        }
    }

    /**
     * Disconnect SSE
     */
    disconnectSSE() {
        console.log('Disconnecting SSE');
        if (this.sseAbortController) {
            this.sseAbortController.abort();
            this.sseAbortController = null;
        }
        this.sseReader = null;
        this.isConnecting = false;
    }

    /**
     * Rate-limited API request
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
                await new Promise(resolve => 
                    setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
                );
            }

            const { url, options, resolve, reject } = this.requestQueue.shift();

            try {
                this.lastRequestTime = Date.now();
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': this.getAuthHeader(),
                        ...options.headers
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                resolve(response);
            } catch (error) {
                reject(error);
            }
        }

        this.isProcessingQueue = false;
    }

    /**
     * Get historical candle data from Ostium
     * @param {string} symbol - Symbol (e.g., 'SPX', 'EURUSD')
     * @param {string} interval - Time interval (e.g., '1m', '5m', '1h', '1d')
     * @param {number} startTime - Start timestamp in milliseconds
     * @param {number} endTime - End timestamp in milliseconds
     * @returns {Promise<Array>} Array of candle data
     */
    async getCandles(symbol, interval, startTime, endTime) {
        try {
            console.log(`🔍 Fetching Ostium candles for ${symbol} ${interval}`);
            console.log(`   From: ${new Date(startTime).toISOString()}`);
            console.log(`   To: ${new Date(endTime).toISOString()}`);
            
            // Validate input parameters
            if (!symbol || !interval || !startTime || !endTime) {
                throw new Error('Missing required parameters');
            }
            
            // Convert interval format (1m -> 1, 1h -> 60, 1d -> D)
            const resolution = this.convertIntervalToResolution(interval);
            
            // Ensure symbol has USD suffix for Ostium
            const asset = symbol.endsWith('USD') ? symbol : `${symbol}USD`;
            
            // Call Ostium API
            const url = `${this.baseURL}/ohlc/getHistorical`;
            const body = {
                asset: asset,
                resolution: resolution,
                fromTimestampSeconds: Math.floor(startTime / 1000),
                toTimestampSeconds: Math.floor(endTime / 1000)
            };
            
            console.log(`   Requesting: ${JSON.stringify(body)}`);
            
            const response = await this.makeRateLimitedRequest(url, {
                method: 'POST',
                body: JSON.stringify(body)
            });
            
            const result = await response.json();
            console.log(`✅ Received ${result.data?.length || 0} candles from Ostium`);
            
            // Format candles
            const formattedCandles = this.formatOstiumCandles(result.data || []);
            
            return formattedCandles;
            
        } catch (error) {
            console.error('❌ Error fetching Ostium candles:', error);
            throw error;
        }
    }

    /**
     * Convert interval string to Ostium resolution format
     */
    convertIntervalToResolution(interval) {
        const intervalMap = {
            '1m': '1',
            '2m': '2',
            '5m': '5',
            '15m': '15',
            '30m': '30',
            '1h': '60',
            '2h': '120',
            '4h': '240',
            '6h': '360',
            '12h': '720',
            '1d': 'D'
        };
        
        return intervalMap[interval] || '60'; // Default to 1 hour
    }

    /**
     * Format Ostium candles to TradingView format
     */
    formatOstiumCandles(data) {
        if (!Array.isArray(data)) {
            console.warn('Invalid candles data format:', data);
            return [];
        }
        
        return data.map(candle => ({
            time: Math.floor(candle.time / 1000), // Convert ms to seconds
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: 0 // Ostium doesn't provide volume
        }));
    }

    /**
     * Subscribe to real-time updates for a symbol
     */
    subscribe(symbol, callback) {
        if (!this.subscribers.has(symbol)) {
            this.subscribers.set(symbol, []);
        }
        this.subscribers.get(symbol).push(callback);
        console.log(`Subscribed to ${symbol}, total subscribers: ${this.subscribers.get(symbol).length}`);
    }

    /**
     * Unsubscribe from symbol updates
     */
    unsubscribe(symbol, callback) {
        if (this.subscribers.has(symbol)) {
            const callbacks = this.subscribers.get(symbol);
            const beforeCount = callbacks.length;
            const index = callbacks.indexOf(callback);
            
            if (index > -1) {
                callbacks.splice(index, 1);
                const afterCount = callbacks.length;
                console.log(`✅ Unsubscribed from ${symbol}: ${beforeCount} → ${afterCount} subscribers remaining`);
            } else {
                console.warn(`⚠️  Callback not found for ${symbol}, total subscribers: ${beforeCount}`);
            }
            
            // Clean up if no more subscribers
            if (callbacks.length === 0) {
                this.subscribers.delete(symbol);
                console.log(`🗑️  No more subscribers for ${symbol}, removed from map`);
            }
        } else {
            console.warn(`⚠️  No subscribers found for ${symbol}`);
        }
    }

    /**
     * Get current price from cache
     */
    getCurrentPrice(symbol) {
        const cached = this.priceCache.get(symbol);
        return cached ? cached.price : null;
    }

    /**
     * Get orderbook data (if Ostium supports it)
     */
    async getOrderbook(symbol, depth = 20) {
        try {
            const url = `${this.baseURL}/v1/orderbook/${symbol}?depth=${depth}`;
            const response = await this.makeRateLimitedRequest(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching orderbook:', error);
            return null;
        }
    }

    /**
     * Get recent trades (if Ostium supports it)
     */
    async getTrades(symbol, limit = 50) {
        try {
            const url = `${this.baseURL}/v1/trades/${symbol}?limit=${limit}`;
            const response = await this.makeRateLimitedRequest(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching trades:', error);
            return null;
        }
    }

    /**
     * Get available markets/symbols
     */
    async getMarkets() {
        try {
            const url = `${this.baseURL}/v1/markets`;
            const response = await this.makeRateLimitedRequest(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching markets:', error);
            return [];
        }
    }
}

