/**
 * Configuration for exchanges
 * Store API credentials and endpoints
 */

const config = {
    hyperliquid: {
        apiURL: 'https://api.hyperliquid.xyz',
        wsURL: 'wss://api.hyperliquid.xyz/ws'
    },
    ostium: {
        apiURL: 'https://history.ostium.io',
        sseURL: 'https://metadata-backend.ostium.io/price-updates/all-feeds-auth',
        
        // API credentials
        apiKey: 'PulseTrader01FX2EtClaGlu1FsXry0ZM42HzbXKv20sCn2JJ',
        apiSecret: 'mmprejrGVklxRjLZM4idXDoZk8J39vul8i6AnX9O5zMtY72U'
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}

