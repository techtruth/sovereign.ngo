'use strict';

const http = require('http');

const PORT = Number(process.env.PORT || 8080);
const PROVIDER_ID = String(process.env.PROVIDER_ID || '').trim() || 'unknown_provider';
const PROVIDER_DID = String(process.env.PROVIDER_DID || '').trim();
const PROVIDER_LABEL = String(process.env.PROVIDER_LABEL || PROVIDER_ID).trim();
const PROVIDER_TYPE = String(process.env.PROVIDER_TYPE || '').trim();
const PROVIDER_POD_URL = String(process.env.PROVIDER_POD_URL || '').trim();
const MAX_AUDIT_ENTRIES = 1200;

const nowIso = () => new Date().toISOString();
const requestAudit = [];

const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const summarizeError = (error) => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string' && error.message) return error.message;
  return String(error);
};

const pushAudit = (entry) => {
  const row = {
    at: nowIso(),
    providerId: PROVIDER_ID,
    providerType: PROVIDER_TYPE,
    ...entry
  };
  requestAudit.unshift(row);
  if (requestAudit.length > MAX_AUDIT_ENTRIES) {
    requestAudit.length = MAX_AUDIT_ENTRIES;
  }
  try {
    const kind = toSafeString(row.kind) || 'event';
    const direction = toSafeString(row.direction) || 'n/a';
    const target = toSafeString(row.targetProviderId);
    const status = Number.isFinite(row.status) ? ` status=${row.status}` : '';
    const targetPart = target ? ` target=${target}` : '';
    console.log(`[provider-api:${PROVIDER_ID}] ${kind} direction=${direction}${targetPart}${status}`);
  } catch {
    // no-op
  }
};

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload || {});
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(body);
};

const parseUrl = (req) => {
  const host = req.headers.host || 'localhost';
  return new URL(req.url || '/', `http://${host}`);
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > 1024 * 1024) {
      reject(new Error('Payload too large.'));
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (!chunks.length) {
      resolve({});
      return;
    }
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      resolve(parsed && typeof parsed === 'object' ? parsed : {});
    } catch {
      reject(new Error('Invalid JSON payload.'));
    }
  });
  req.on('error', reject);
});

const providerEnvelope = {
  providerId: PROVIDER_ID,
  providerDid: PROVIDER_DID,
  providerLabel: PROVIDER_LABEL,
  providerType: PROVIDER_TYPE,
  providerPodUrl: PROVIDER_POD_URL
};

const server = http.createServer(async (req, res) => {
  const method = String(req.method || 'GET').toUpperCase();
  const url = parseUrl(req);
  const path = url.pathname;

  if (method === 'GET' && path === '/health') {
    sendJson(res, 200, {
      ok: true,
      ...providerEnvelope,
      auditEntries: requestAudit.length,
      now: nowIso()
    });
    return;
  }

  if (method === 'GET' && path === '/api/info') {
    sendJson(res, 200, {
      ok: true,
      ...providerEnvelope,
      now: nowIso()
    });
    return;
  }

  if (method === 'GET' && path === '/api/audit/log') {
    const requestedLimit = Number(url.searchParams.get('limit') || 80);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), 500)
      : 80;
    sendJson(res, 200, {
      ok: true,
      ...providerEnvelope,
      count: Math.min(limit, requestAudit.length),
      rows: requestAudit.slice(0, limit)
    });
    return;
  }

  if (method !== 'POST' || !path.startsWith('/api/')) {
    sendJson(res, 404, {
      ok: false,
      error: 'Not found.',
      ...providerEnvelope
    });
    return;
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: summarizeError(error),
      ...providerEnvelope
    });
    return;
  }

  if (path === '/api/session/login') {
    pushAudit({
      kind: 'login',
      direction: 'inbound',
      payload
    });
    sendJson(res, 200, {
      ok: true,
      recorded: 'login',
      ...providerEnvelope
    });
    return;
  }

  if (path === '/api/actions/self') {
    pushAudit({
      kind: 'self_action',
      direction: 'inbound',
      payload
    });
    sendJson(res, 200, {
      ok: true,
      recorded: 'self_action',
      ...providerEnvelope
    });
    return;
  }

  if (path === '/api/actions/staff') {
    pushAudit({
      kind: 'staff_action',
      direction: 'inbound',
      payload
    });
    sendJson(res, 200, {
      ok: true,
      recorded: 'staff_action',
      ...providerEnvelope
    });
    return;
  }

  if (path === '/api/records/access') {
    pushAudit({
      kind: 'record_access_fetch',
      direction: 'inbound',
      payload
    });
    sendJson(res, 200, {
      ok: true,
      recorded: 'record_access_fetch',
      ...providerEnvelope
    });
    return;
  }

  if (path === '/api/referrals/issue') {
    pushAudit({
      kind: 'referral_issue',
      direction: 'inbound',
      payload
    });

    sendJson(res, 200, {
      ok: true,
      recorded: 'referral_issue',
      ...providerEnvelope
    });
    return;
  }

  if (path === '/api/referrals/fulfill') {
    pushAudit({
      kind: 'referral_fulfill',
      direction: 'inbound',
      payload
    });

    sendJson(res, 200, {
      ok: true,
      recorded: 'referral_fulfill',
      ...providerEnvelope
    });
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Unknown API route.',
    ...providerEnvelope
  });
});

server.listen(PORT, () => {
  console.log(
    `[provider-api] listening on ${PORT} for ${PROVIDER_ID} (${PROVIDER_LABEL})` +
    (PROVIDER_POD_URL ? ` pod=${PROVIDER_POD_URL}` : '')
  );
});
