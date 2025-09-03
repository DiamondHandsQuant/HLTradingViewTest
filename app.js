/**
 * Main Application Logic
 * Initializes TradingView chart and handles UI interactions
 */

class TradingViewApp {
    constructor() {
        this.widget = null;
        this.datafeed = null;
        this.currentSymbol = 'BTC';
        this.currentInterval = '1h';
        this.isInitialized = false;
        this.priceUpdateInterval = null;
        
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
            
            // Initialize datafeed first
            this.datafeed = new HyperLiquidDatafeed();
            await this.datafeed.initialize();
            
            // Initialize TradingView widget with HyperLiquid datafeed
            await this.initTradingViewWidget();
            
            // Setup UI event listeners
            this.setupEventListeners();
            
            // Start price updates
            this.startPriceUpdates();
            
            this.isInitialized = true;
            this.showLoading(false);
            
            console.log('TradingView app initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
            this.showLoading(false);
        }
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
     */
    async initTradingViewWidget() {
        return new Promise((resolve, reject) => {
            try {
                // Clear any existing chart container
                const container = document.getElementById('tv_chart_container');
                if (container) {
                    container.innerHTML = '';
                }
                
                this.widget = new TradingView.widget({
                    symbol: 'HYPERLIQUID:BTCUSD',
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
                    
                    // Initialize order book after chart is ready
                    this.initOrderBook().catch(error => {
                        console.error('Failed to initialize order book:', error);
                    });
                    
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
                console.log('Symbol changed:', symbolInfo);
                if (symbolInfo && symbolInfo.name) {
                    this.currentSymbol = symbolInfo.name.replace('USD', '');
                    this.updateSymbolDisplay();
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
            symbolNameEl.textContent = `${this.currentSymbol}USD`;
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
     * Initialize order book
     */
    async initOrderBook() {
        console.log('📚 Initializing order book...');
        
        try {
            // Subscribe to order book updates
            await this.datafeed.api.subscribeToOrderBook('BTC', (orderBook) => {
                this.updateOrderBook(orderBook);
            });
            
            console.log('✅ Order book subscription successful');
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