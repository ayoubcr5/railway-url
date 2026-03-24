const http = require('http');
const https = require('https');
const { URL } = require('url'); // Added for easier parsing

const PORT = process.env.PORT || 3000; // Railway provides the PORT env var

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // --- UPDATED LOGIC FOR ?url= ---
    const fullUrl = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = fullUrl.searchParams.get('url');

    if (!targetUrl) {
        res.writeHead(400);
        res.end('Missing "url" parameter. Use /proxy?url=https://example.com');
        return;
    }

    // Ensure the target has a protocol
    const finalInitialUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
    console.log(`Forwarding to: ${finalInitialUrl}`);

    function fetchUrl(currentUrl, redirectCount = 0) {
        if (redirectCount > 5) {
            res.writeHead(500);
            return res.end('Proxy Error: Too many redirects');
        }

        // Select module based on protocol (http vs https)
        const client = currentUrl.startsWith('https') ? https : http;

        client.get(currentUrl, (proxyRes) => {
            if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
                const nextUrl = new URL(proxyRes.headers.location, currentUrl).href;
                return fetchUrl(nextUrl, redirectCount + 1);
            }

            const headersToForward = { ...proxyRes.headers };
            delete headersToForward['host'];
            delete headersToForward['connection'];
            delete headersToForward['content-encoding']; // Avoid double-compression issues

            res.writeHead(proxyRes.statusCode, headersToForward);
            proxyRes.pipe(res);
            
        }).on('error', (e) => {
            res.writeHead(500);
            res.end('Proxy Error: ' + e.message);
        });
    }

    fetchUrl(finalInitialUrl);
});

server.listen(PORT, () => {
    console.log(`Proxy running on port ${PORT}`);
});
