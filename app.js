/**
 * Main Application Logic
 * Initializes TradingView chart and handles UI interactions
 */

class TradingViewApp {
    constructor() {
        this.widget = null;
        this.datafeed = null;
        this.currentSymbol = 'BTC';
        this.currentExchange = null; // Track current exchange
        this.currentInterval = '1h';
        this.isInitialized = false;
        this.priceUpdateInterval = null;
        this.activeOrderBookSubscription = null; // Track active order book subscription
        
        // Bind methods
        this.handleResize = this.handleResize.bind(this);
        this.updatePriceInfo = this.updatePriceInfo.bind(this);
    }
    
    /**
     * Initialize the application
     */
    async init() {
        try {
            this.showLoading(true);
            
            // Wait for TradingView to load
            await this.waitForTradingView();
            
            // Initialize unified datafeed (handles both exchanges)
            await this.initDatafeed();
            
            // Initialize TradingView widget with unified datafeed
            await this.initTradingViewWidget();
            
            // Setup UI event listeners
            this.setupEventListeners();
            
            // Start price updates
            this.startPriceUpdates();
            
            this.isInitialized = true;
            this.showLoading(false);
            
            console.log('✅ TradingView app initialized successfully with Unified Datafeed');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
            this.showLoading(false);
        }
    }
    
    /**
     * Initialize unified datafeed (handles both HyperLiquid and Ostium)
     */
    async initDatafeed() {
        console.log('🔄 Initializing Unified Datafeed...');
        
        // Create unified datafeed with Ostium credentials and URLs
        this.datafeed = new UnifiedDatafeed(
            config.ostium.apiKey, 
            config.ostium.apiSecret,
            config.ostium.apiURL,
            config.ostium.sseURL
        );
        
        await this.datafeed.initialize();
        console.log('✅ Unified Datafeed ready - supports both HyperLiquid and Ostium');
        console.log(`   Ostium API URL: ${config.ostium.apiURL}`);
    }

    /**
     * Wait for TradingView Charting Library to load
     */
    waitForTradingView() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            const checkTradingView = () => {
                attempts++;
                
                if (typeof TradingView !== 'undefined' && TradingView.widget) {
                    console.log('TradingView Charting Library loaded successfully');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('TradingView Charting Library failed to load'));
                } else {
                    setTimeout(checkTradingView, 100);
                }
            };
            
            checkTradingView();
        });
    }

    /**
     * Initialize TradingView widget
     * @param {string} symbol - Optional symbol override
     */
    async initTradingViewWidget(symbol = null) {
        return new Promise((resolve, reject) => {
            try {
                // Clear any existing chart container
                const container = document.getElementById('tv_chart_container');
                if (container) {
                    container.innerHTML = '';
                }
                
                // Determine symbol - let unified datafeed handle routing
                const symbolToUse = symbol || this.currentSymbol;
                const exchange = this.datafeed.getExchangeForSymbol(symbolToUse);
                const exchangePrefix = exchange === 'OSTIUM' ? 'OSTIUM' : 'HYPERLIQUID';
                
                // Smart suffix handling
                let symbolSuffix = '';
                if (!symbolToUse.includes('USD') && !symbolToUse.includes('EUR') && !symbolToUse.includes('GBP')) {
                    symbolSuffix = 'USD';
                }
                
                const fullSymbol = `${exchangePrefix}:${symbolToUse}${symbolSuffix}`;
                
                console.log(`🎯 Initializing TradingView widget with symbol: ${fullSymbol} (${exchange})`);
                
                this.widget = new TradingView.widget({
                    symbol: fullSymbol,
                    interval: '1H',
                    container: 'tv_chart_container',
                    datafeed: this.datafeed,
                    library_path: 'charting_library/charting_library/',
                    locale: 'en',
                    timezone: 'Etc/UTC',
                    debug: true, // Enable debug mode
                    disabled_features: [
                        'use_localstorage_for_settings',
                        'volume_force_overlay',
                        'create_volume_indicator_by_default',
                        'header_symbol_search',
                        'header_compare',
                        'header_undo_redo',
                        'header_screenshot'
                    ],
                    enabled_features: [
                        'study_templates',
                        'side_toolbar_in_fullscreen_mode'
                    ],
                    charts_storage_url: 'https://saveload.tradingview.com',
                    charts_storage_api_version: '1.1',
                    client_id: 'hyperliquid-demo',
                    user_id: 'public_user',
                    fullscreen: false,
                    autosize: true,
                    theme: 'dark',
                    custom_css_url: 'custom_chart.css',
                    loading_screen: {
                        backgroundColor: '#0d1421',
                        foregroundColor: '#2962ff'
                    },
                    overrides: {
                        'paneProperties.background': '#0d1421',
                        'paneProperties.backgroundType': 'solid',
                        'paneProperties.gridProperties.color': '#1e222d',
                        'paneProperties.vertGridProperties.color': '#1e222d',
                        'paneProperties.horzGridProperties.color': '#1e222d',
                        'symbolWatermarkProperties.transparency': 90,
                        'scalesProperties.textColor': '#868993',
                        'scalesProperties.backgroundColor': '#0d1421',
                        'mainSeriesProperties.candleStyle.upColor': '#4caf50',
                        'mainSeriesProperties.candleStyle.downColor': '#f44336',
                        'mainSeriesProperties.candleStyle.borderUpColor': '#4caf50',
                        'mainSeriesProperties.candleStyle.borderDownColor': '#f44336',
                        'mainSeriesProperties.candleStyle.wickUpColor': '#4caf50',
                        'mainSeriesProperties.candleStyle.wickDownColor': '#f44336'
                    },
                    studies_overrides: {
                        'volume.volume.color.0': '#f44336',
                        'volume.volume.color.1': '#4caf50',
                        'volume.volume.transparency': 65,
                        'volume.volume ma.color': '#2962ff',
                        'volume.volume ma.transparency': 30,
                        'volume.volume ma.linewidth': 2
                    }
                });

                this.widget.onChartReady(() => {
                    console.log('TradingView chart is ready');
                    this.setupChartEventListeners();
                    
                    // Set initial exchange and order book visibility
                    const initialExchange = this.datafeed.getExchangeForSymbol(symbolToUse);
                    this.currentExchange = initialExchange;
                    this.updateOrderBookVisibility(initialExchange);
                    
                    resolve();
                });

            } catch (error) {
                console.error('Error initializing TradingView widget:', error);
                reject(error);
            }
        });
    }

    /**
     * Setup chart-specific event listeners
     */
    setupChartEventListeners() {
        if (!this.widget) return;

        try {
            // Listen for symbol changes
            this.widget.subscribe('onSymbolChanged', (symbolInfo) => {
                console.log('🔄 SYMBOL CHANGED EVENT FIRED');
                console.log('   Full symbolInfo object:', JSON.stringify(symbolInfo, null, 2));
                
                if (symbolInfo && symbolInfo.name) {
                    // Extract clean symbol name
                    let newSymbol = symbolInfo.name;
                    
                    // Remove USD suffix carefully (not for forex pairs)
                    if (newSymbol.endsWith('USD') && !newSymbol.match(/^[A-Z]{3}USD$/)) {
                        newSymbol = newSymbol.replace(/USD$/, '');
                    }
                    
                    // IMPORTANT: Use symbolInfo.exchange to get the correct exchange
                    // TradingView strips the prefix from symbolInfo.name, so we can't detect from the name
                    const newExchange = symbolInfo.exchange || this.datafeed.getExchangeForSymbol(newSymbol);
                    
                    console.log(`   📊 OLD STATE:`);
                    console.log(`      Symbol: ${this.currentSymbol}`);
                    console.log(`      Exchange: ${this.currentExchange}`);
                    console.log(`   📊 NEW STATE:`);
                    console.log(`      Symbol: ${newSymbol}`);
                    console.log(`      Exchange: ${newExchange}`);
                    console.log(`      symbolInfo.exchange: ${symbolInfo.exchange}`);
                    console.log(`      symbolInfo.full_name: ${symbolInfo.full_name}`);
                    
                    // Check if symbol OR exchange has changed
                    const symbolChanged = this.currentSymbol !== newSymbol;
                    const exchangeChanged = this.currentExchange !== newExchange;
                    
                    if (symbolChanged || exchangeChanged) {
                        console.log(`   ⚠️  CHANGE DETECTED:`);
                        console.log(`      Symbol changed: ${symbolChanged} (${this.currentSymbol} -> ${newSymbol})`);
                        console.log(`      Exchange changed: ${exchangeChanged} (${this.currentExchange} -> ${newExchange})`);
                        console.log(`   🔄 Triggering order book update for exchange: ${newExchange}`);
                        
                        // Update order book visibility and subscriptions
                        this.updateOrderBookVisibility(newExchange);
                    } else {
                        console.log(`   ℹ️  No change detected, skipping order book update`);
                    }

                    this.currentSymbol = newSymbol;
                    this.currentExchange = newExchange;
                    this.updateSymbolDisplay();
                    
                    console.log(`✅ Symbol change complete: ${newSymbol} (${newExchange})`);
                }
            });

            // Listen for interval changes
            this.widget.subscribe('onIntervalChanged', (interval) => {
                console.log('Interval changed:', interval);
                this.currentInterval = this.mapTradingViewInterval(interval);
                this.updateIntervalDisplay();
            });

        } catch (error) {
            console.error('Error setting up chart event listeners:', error);
        }
    }

    /**
     * Map TradingView interval to display interval
     */
    mapTradingViewInterval(tvInterval) {
        const intervalMap = {
            '5': '5m',
            '1H': '1h',
            '1D': '1D',
            '1W': '1W'
        };
        
        return intervalMap[tvInterval] || tvInterval;
    }

    /**
     * Setup UI event listeners
     */
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', this.handleResize);

        // Order book tab switching
        document.querySelectorAll('.orderbook-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchOrderBookTab(e.target);
            });
        });

        // Order book precision selector
        const precisionSelect = document.querySelector('.orderbook-precision');
        if (precisionSelect) {
            precisionSelect.addEventListener('change', (e) => {
                this.changeOrderBookPrecision(e.target.value);
            });
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.widget && this.widget.resize) {
            this.widget.resize();
        }
    }

    /**
     * Switch order book tab
     */
    switchOrderBookTab(clickedTab) {
        // Remove active class from all tabs
        document.querySelectorAll('.orderbook-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Add active class to clicked tab
        clickedTab.classList.add('active');
        
        // Handle tab functionality (placeholder for future implementation)
        const tabType = clickedTab.dataset.tab;
        console.log(`Switched to ${tabType} tab`);
    }

    /**
     * Change order book precision
     */
    changeOrderBookPrecision(precision) {
        console.log(`Changed order book precision to ${precision}`);
        // Placeholder for future implementation
    }

    /**
     * Change chart interval
     */
    changeInterval(interval) {
        if (!this.widget || interval === this.currentInterval) return;

        try {
            // Map display intervals to TradingView intervals
            const intervalMap = {
                '5m': '5',
                '1h': '1H',
                '1D': '1D',
                '1W': '1W'
            };

            const tvInterval = intervalMap[interval] || interval;
            
            // Use the chart's setResolution method to change interval
            if (this.widget.chart) {
                this.widget.chart().setResolution(tvInterval, () => {
                    console.log('Interval changed to:', tvInterval);
                });
            } else {
                // Fallback: use setSymbol method
                this.widget.setSymbol(`HYPERLIQUID:${this.currentSymbol}USD`, tvInterval, () => {
                    console.log('Interval changed to:', tvInterval);
                });
            }
            
            this.currentInterval = interval;
            this.updateIntervalDisplay();

        } catch (error) {
            console.error('Error changing interval:', error);
        }
    }

    /**
     * Update interval display
     */
    updateIntervalDisplay() {
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.interval === this.currentInterval) {
                btn.classList.add('active');
            }
        });
    }

    /**
     * Update symbol display
     */
    updateSymbolDisplay() {
        const symbolNameEl = document.querySelector('.symbol-name');
        if (symbolNameEl) {
            // For forex pairs, don't add USD
            const displaySymbol = this.currentSymbol.includes('USD') || 
                                 this.currentSymbol.includes('EUR') || 
                                 this.currentSymbol.includes('GBP')
                ? this.currentSymbol
                : `${this.currentSymbol}USD`;
            symbolNameEl.textContent = displaySymbol;
        }
    }

    /**
     * Update order book visibility based on exchange
     * Ostium doesn't have order book data, HyperLiquid and Lighter do
     */
    updateOrderBookVisibility(exchange) {
        const orderBookContainer = document.querySelector('.orderbook-container');
        
        if (orderBookContainer) {
            if (exchange === 'OSTIUM') {
                // Hide order book for Ostium symbols
                orderBookContainer.style.display = 'none';
                console.log('ℹ️  Order book hidden (not available for Ostium)');
                
                // IMPORTANT: Clean up subscriptions
                this.cleanupOrderBook();
                
            } else if (exchange === 'HYPERLIQUID' || exchange === 'LIGHTER') {
                // Show order book for HyperLiquid and Lighter symbols
                orderBookContainer.style.display = 'flex';
                console.log(`✅ Order book visible (${exchange})`);
                
                // Clean up old subscription first
                this.cleanupOrderBook();
                
                // Re-initialize order book for new symbol
                this.initOrderBook().catch(err => {
                    console.error('Failed to reinitialize order book:', err);
                });
            }
        }
    }

    /**
     * Clean up active order book subscriptions
     */
    cleanupOrderBook() {
        if (this.activeOrderBookSubscription) {
            console.log('🧹 Cleaning up order book subscription for', this.activeOrderBookSubscription.symbol);
            
            // Get the API instance
            const api = this.datafeed.getAPIForSymbol(this.activeOrderBookSubscription.symbol);
            
            // Unsubscribe from order book if API supports it
            if (api && api.unsubscribeFromOrderBook) {
                // Use the subscription key (market ID for Lighter, symbol for HyperLiquid)
                const keyToUnsubscribe = this.activeOrderBookSubscription.subscriptionKey || this.activeOrderBookSubscription.symbol;
                console.log(`   Unsubscribing with key: ${keyToUnsubscribe}`);
                api.unsubscribeFromOrderBook(keyToUnsubscribe);
                console.log('✅ Unsubscribe message sent');
            }
            
            // AGGRESSIVE: Also disconnect WebSocket to force stop all subscriptions
            if (api && api.disconnectWebSocket) {
                console.log('⚠️  Force disconnecting WebSocket to stop all subscriptions');
                api.disconnectWebSocket();
            }
            
            this.activeOrderBookSubscription = null;
        } else {
            console.log('ℹ️  No active order book subscription to clean up');
        }
    }



    /**
     * Start price updates
     */
    startPriceUpdates() {
        // Update price immediately
        this.updatePriceInfo();

        // Set up periodic updates
        this.priceUpdateInterval = setInterval(() => {
            this.updatePriceInfo();
        }, 5000); // Update every 5 seconds
    }

    /**
     * Update price information in the UI
     */
    async updatePriceInfo() {
        try {
            if (this.datafeed) {
                const price = await this.datafeed.getCurrentPrice(this.currentSymbol);
                if (price) {
                    const priceStr = price.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });

                    const closePriceEl = document.getElementById('close-price');
                    if (closePriceEl) {
                        closePriceEl.textContent = priceStr;
                    }
                }
            }
        } catch (error) {
            console.error('Error updating price info:', error);
        }
    }





    /**
     * Show/hide loading overlay
     */
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (show) {
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error(message);
        alert(message);
    }

    /**
     * Strip exchange prefix from symbol (e.g., "LIGHTER:BTC" -> "BTC")
     */
    stripExchangePrefix(symbol) {
        if (symbol.includes(':')) {
            return symbol.split(':')[1];
        }
        return symbol;
    }

    /**
     * Initialize order book
     */
    async initOrderBook() {
        console.log('📚 Initializing order book for', this.currentSymbol);
        
        try {
            // Get the appropriate API for the current symbol
            const api = this.datafeed.getAPIForSymbol(this.currentSymbol);
            const exchange = this.datafeed.getExchangeForSymbol(this.currentSymbol);
            
            console.log(`   Exchange detected: ${exchange}`);
            console.log(`   API found: ${api ? 'Yes' : 'No'}`);
            
            // Check if we're already subscribed to this symbol on this exchange
            if (this.activeOrderBookSubscription && 
                this.activeOrderBookSubscription.symbol === this.currentSymbol &&
                this.activeOrderBookSubscription.exchange === exchange) {
                console.log(`ℹ️  Already subscribed to ${this.currentSymbol} on ${exchange}, skipping`);
                return;
            }
            
            // HyperLiquid and Lighter support order books
            if (api && api.subscribeToOrderBook) {
                // For Lighter, use market ID; for HyperLiquid, use symbol name
                let subscriptionKey = this.currentSymbol;
                
                if (exchange === 'LIGHTER') {
                    // Strip exchange prefix before looking up market ID
                    const cleanSymbol = this.stripExchangePrefix(this.currentSymbol);
                    console.log(`   Clean symbol for Lighter lookup: ${cleanSymbol}`);
                    
                    // Get market ID from the Lighter API
                    const marketId = api.getMarketIdForSymbol(cleanSymbol);
                    if (marketId !== null) {
                        subscriptionKey = marketId;
                        console.log(`   Using Lighter market ID: ${subscriptionKey}`);
                    } else {
                        console.error(`   ❌ Could not find market ID for symbol: ${cleanSymbol}`);
                        return; // Don't subscribe if we can't find the market ID
                    }
                } else {
                    // For HyperLiquid, also strip prefix
                    subscriptionKey = this.stripExchangePrefix(this.currentSymbol);
                    console.log(`   Using symbol name: ${subscriptionKey}`);
                }
                
                console.log(`   📤 Subscribing to order book with key: ${subscriptionKey}`);
                await api.subscribeToOrderBook(subscriptionKey, (orderBook) => {
                    this.updateOrderBook(orderBook);
                });
                
                // Track the active subscription
                this.activeOrderBookSubscription = {
                    symbol: this.currentSymbol,
                    exchange: exchange,
                    api: api,
                    subscriptionKey: subscriptionKey
                };
                
                console.log('✅ Order book subscription successful for', this.currentSymbol, 'on', exchange);
            } else {
                console.log('ℹ️  Order book not available for', this.currentSymbol);
            }
        } catch (error) {
            console.error('❌ Failed to initialize order book:', error);
        }
    }

    /**
     * Update order book display
     */
    updateOrderBook(orderBook) {
        console.log('📊 Updating order book display:', orderBook);
        
        const bidsContainer = document.getElementById('orderbook-bids');
        const asksContainer = document.getElementById('orderbook-asks');
        const midPriceElement = document.querySelector('.mid-price-value');
        const spreadValueElement = document.getElementById('spread-value');
        const spreadPercentElement = document.getElementById('spread-percent');
        
        if (!bidsContainer || !asksContainer) {
            console.warn('Order book containers not found');
            return;
        }
        
        const [bids, asks] = orderBook.levels || [[], []];
        
        // Calculate mid price and spread
        // HyperLiquid order book format: {px: "price", sz: "size", n: count}
        const bestBid = bids[0] ? parseFloat(bids[0].px) : 0;
        const bestAsk = asks[0] ? parseFloat(asks[0].px) : 0;
        const midPrice = (bestBid + bestAsk) / 2;
        const spread = bestAsk - bestBid;
        const spreadPercent = ((spread / midPrice) * 100).toFixed(3);
        
        // Update mid price and spread
        if (midPriceElement) {
            midPriceElement.textContent = midPrice.toLocaleString('en-US', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            });
        }
        
        if (spreadValueElement) {
            spreadValueElement.textContent = spread.toFixed(1);
        }
        
        if (spreadPercentElement) {
            spreadPercentElement.textContent = `${spreadPercent}%`;
        }
        
        // Update bids (green, buy orders)
        this.renderOrderBookSide(bidsContainer, bids, 'bid', true);
        
        // Update asks (red, sell orders) 
        this.renderOrderBookSide(asksContainer, asks, 'ask', false);
    }

    /**
     * Render one side of the order book
     */
    renderOrderBookSide(container, orders, side, reverse = false) {
        const maxOrders = 15;
        const ordersToShow = orders.slice(0, maxOrders);
        
        // Calculate max size for bar visualization
        const maxSize = Math.max(...ordersToShow.map(order => parseFloat(order.sz)));
        
        let html = '';
        let runningTotal = 0;
        
        const ordersToRender = reverse ? ordersToShow.reverse() : ordersToShow;
        
        ordersToRender.forEach(order => {
            const price = parseFloat(order.px);
            const size = parseFloat(order.sz);
            const sizeUsd = price * size;
            runningTotal += sizeUsd;
            
            const barWidth = (size / maxSize) * 100;
            
            html += `
                <div class="orderbook-row ${side}">
                    <div class="size-bar" style="width: ${barWidth}%"></div>
                    <span class="price">${price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                    <span class="size">${sizeUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    <span class="total">${runningTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
        }

        // Clean up order book subscriptions
        this.cleanupOrderBook();

        if (this.datafeed) {
            this.datafeed.destroy();
        }

        if (this.widget) {
            this.widget.remove();
        }

        window.removeEventListener('resize', this.handleResize);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new TradingViewApp();
    app.init();

    // Make app globally available for debugging
    window.tradingViewApp = app;
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.tradingViewApp) {
        window.tradingViewApp.destroy();
    }
});