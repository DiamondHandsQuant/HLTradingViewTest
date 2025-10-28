/**
 * Ostium API Integration
 * Handles REST API calls and SSE connections for real-time data
 */

class OstiumAPI {
    constructor(apiKey, apiSecret) {
        this.baseURL = 'https://api.ostium.io'; // Update with actual Ostium API URL
        this.sseURL = 'https://metadata-backend.ostium.io/price-updates/all-feeds-auth';
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.sseReader = null;
        this.sseAbortController = null;
        this.subscribers = new Map();
        this.priceCache = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnecting = false;
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

            console.log('SSE connection established');
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            
            // Start reading the stream
            this.readSSEStream(response.body);
            
        } catch (error) {
            this.isConnecting = false;
            
            if (error.name === 'AbortError') {
                console.log('SSE connection aborted');
                return;
            }
            
            console.error('SSE connection error:', error);
            
            // Implement reconnection logic
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                
                setTimeout(() => {
                    this.connectSSE();
                }, delay);
            } else {
                console.error('Max reconnection attempts reached');
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
     * @param {string} symbol - Symbol (e.g., 'BTC', 'ETH')
     * @param {string} interval - Time interval (e.g., '1m', '5m', '1h', '1d')
     * @param {number} startTime - Start timestamp in milliseconds
     * @param {number} endTime - End timestamp in milliseconds
     * @returns {Promise<Array>} Array of candle data
     */
    async getCandles(symbol, interval, startTime, endTime) {
        try {
            console.log(`Fetching Ostium candles for ${symbol} ${interval} from ${new Date(startTime)} to ${new Date(endTime)}`);
            
            // Validate input parameters
            if (!symbol || !interval || !startTime || !endTime) {
                throw new Error('Missing required parameters');
            }
            
            // Note: Update this endpoint based on actual Ostium API documentation
            const url = `${this.baseURL}/v1/candles`;
            const body = {
                symbol: symbol,
                interval: interval,
                startTime: startTime,
                endTime: endTime
            };
            
            const response = await this.makeRateLimitedRequest(url, {
                method: 'POST',
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            console.log(`Received ${data.length || 0} candles from Ostium`);
            
            return this.formatCandles(data);
            
        } catch (error) {
            console.error('Error fetching Ostium candles:', error);
            throw error;
        }
    }

    /**
     * Format candles to TradingView format
     */
    formatCandles(data) {
        if (!Array.isArray(data)) {
            console.warn('Invalid candles data format:', data);
            return [];
        }
        
        return data.map(candle => ({
            time: candle.timestamp || candle.time || candle.t,
            open: parseFloat(candle.open || candle.o),
            high: parseFloat(candle.high || candle.h),
            low: parseFloat(candle.low || candle.l),
            close: parseFloat(candle.close || candle.c),
            volume: parseFloat(candle.volume || candle.v || 0)
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
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
                console.log(`Unsubscribed from ${symbol}`);
            }
            
            // Clean up if no more subscribers
            if (callbacks.length === 0) {
                this.subscribers.delete(symbol);
            }
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

