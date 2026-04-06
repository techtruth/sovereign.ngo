'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');

const TLS_PORT = Number(process.env.TLS_PORT || 3000);
const UPSTREAM_HOST = String(process.env.UPSTREAM_HOST || '127.0.0.1').trim() || '127.0.0.1';
const UPSTREAM_PORT = Number(process.env.UPSTREAM_PORT || 3001);
const TLS_CERT_PATH = String(process.env.TLS_CERT_PATH || '/etc/sovereign/tls/internal.crt').trim();
const TLS_KEY_PATH = String(process.env.TLS_KEY_PATH || '/etc/sovereign/tls/internal.key').trim();

const readTlsMaterial = () => {
  if (!TLS_CERT_PATH || !TLS_KEY_PATH) {
    throw new Error('TLS_CERT_PATH and TLS_KEY_PATH are required.');
  }
  if (!fs.existsSync(TLS_CERT_PATH) || !fs.existsSync(TLS_KEY_PATH)) {
    throw new Error(`TLS certificate or key file missing (${TLS_CERT_PATH}, ${TLS_KEY_PATH}).`);
  }
  return {
    cert: fs.readFileSync(TLS_CERT_PATH, 'utf8'),
    key: fs.readFileSync(TLS_KEY_PATH, 'utf8')
  };
};

const tlsMaterial = readTlsMaterial();

const proxyRequest = (req, res) => {
  const upstreamReq = http.request(
    {
      protocol: 'http:',
      hostname: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        host: `${UPSTREAM_HOST}:${UPSTREAM_PORT}`
      }
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstreamReq.on('error', (error) => {
    const payload = JSON.stringify({
      ok: false,
      error: 'Pod TLS proxy upstream request failed.',
      detail: error && error.message ? String(error.message) : 'Unknown error'
    });
    res.writeHead(502, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    });
    res.end(payload);
  });

  req.pipe(upstreamReq);
};

const server = https.createServer(tlsMaterial, proxyRequest);

server.listen(TLS_PORT, () => {
  console.log(`[solid-pod-tls-proxy] listening on ${TLS_PORT}, upstream http://${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
});
