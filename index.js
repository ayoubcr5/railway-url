const http = require('http');
const https = require('https');
const { URL } = require('url');

// Railway provides the PORT environment variable automatically
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    // 1. CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    // 2. Parse the ?url= parameter
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    let targetUrl = parsedUrl.searchParams.get('url');

    if (!targetUrl) {
        res.writeHead(400);
        return res.end('Error: Missing "url" parameter. Example: /proxy?url=https://google.com');
    }

    // Ensure protocol exists
    if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
    }

    console.log(`Forwarding request to: ${targetUrl}`);

    // 3. Proxy Logic
    function fetchUrl(currentUrl, redirectCount = 0) {
        if (redirectCount > 5) {
            res.writeHead(500);
            return res.end('Proxy Error: Too many redirects');
        }

        const protocol = currentUrl.startsWith('https') ? https : http;

        protocol.get(currentUrl, (proxyRes) => {
            // Handle Redirects
            if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
                const nextUrl = new URL(proxyRes.headers.location, currentUrl).href;
                return fetchUrl(nextUrl, redirectCount + 1);
            }

            // Forward Headers (minus host/connection to avoid conflicts)
            const headers = { ...proxyRes.headers };
            delete headers['host'];
            delete headers['connection'];
            delete headers['content-encoding']; // Prevents issues with compressed responses

            res.writeHead(proxyRes.statusCode, headers);
            proxyRes.pipe(res);
            
        }).on('error', (err) => {
            res.writeHead(500);
            res.end(`Proxy Error: ${err.message}`);
        });
    }

    fetchUrl(targetUrl);
});

server.listen(PORT, () => {
    console.log(`Proxy active on port ${PORT}`);
});
