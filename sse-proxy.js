/**
 * Simple SSE Proxy Server
 * Forwards Ostium SSE stream to browser, adding CORS headers
 */

const http = require('http');
const https = require('https');

const OSTIUM_SSE_URL = 'https://metadata-backend.ostium.io/price-updates/all-feeds-auth';
const OSTIUM_API_KEY = 'PulseTrader01FX2EtClaGlu1FsXry0ZM42HzbXKv20sCn2JJ';
const OSTIUM_API_SECRET = 'mmprejrGVklxRjLZM4idXDoZk8J39vul8i6AnX9O5zMtY72U';
const PORT = 3001;

// Create Basic Auth header
const auth = Buffer.from(`${OSTIUM_API_KEY}:${OSTIUM_API_SECRET}`).toString('base64');

const server = http.createServer((req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Accept'
        });
        res.end();
        return;
    }

    // Only allow GET requests to /sse
    if (req.method !== 'GET' || req.url !== '/sse') {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    console.log('🔌 New SSE connection from browser');

    // Set SSE response headers with CORS
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Accept'
    });

    // Connect to Ostium SSE
    const options = {
        headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'text/event-stream'
        }
    };

    console.log('📡 Connecting to Ostium SSE...');
    
    const proxyReq = https.get(OSTIUM_SSE_URL, options, (proxyRes) => {
        console.log('✅ Connected to Ostium SSE');
        
        // Forward all data from Ostium to browser
        proxyRes.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.trim()) {
                console.log('📨 Forwarding SSE data:', data.substring(0, 100) + '...');
            }
            res.write(chunk);
        });

        proxyRes.on('end', () => {
            console.log('⚠️  Ostium SSE connection ended');
            res.end();
        });

        proxyRes.on('error', (err) => {
            console.error('❌ Ostium SSE error:', err);
            res.end();
        });
    });

    proxyReq.on('error', (err) => {
        console.error('❌ Proxy request error:', err);
        res.writeHead(500);
        res.end('Proxy error');
    });

    // Handle client disconnect
    req.on('close', () => {
        console.log('🔌 Browser disconnected');
        proxyReq.destroy();
    });
});

server.listen(PORT, () => {
    console.log(`
🚀 SSE Proxy Server running on http://localhost:${PORT}

📋 Configuration:
   - Proxy URL: http://localhost:${PORT}/sse
   - Ostium URL: ${OSTIUM_SSE_URL}
   
🔧 Update your config.js:
   sseURL: 'http://localhost:${PORT}/sse'

✅ Ready to accept SSE connections!
`);
});

