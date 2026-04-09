'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const PORT = Number(process.env.PORT || 8090);
const DID_DOMAIN = String(process.env.DID_DOMAIN || 'demo.sovereign.ngo').trim() || 'demo.sovereign.ngo';
const EXTERNAL_BASE_URL = String(process.env.EXTERNAL_BASE_URL || `https://${DID_DOMAIN}`).trim().replace(/\/+$/, '');
const STATE_SOURCE_URL = String(process.env.STATE_SOURCE_URL || 'http://holder_sovereign:3001/sovereign/demo/state.json').trim();
const MAX_STATE_BYTES = Number(process.env.MAX_STATE_BYTES || (4 * 1024 * 1024));
const STANDARDS_DATA_DIR = String(process.env.STANDARDS_DATA_DIR || path.join(__dirname, 'data')).trim();

const VC_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
const STATUS_LIST_CONTEXT = 'https://w3id.org/vc/status-list/2021/v1';
const STATUS_LIST_PURPOSE = 'revocation';

const nowIso = () => new Date().toISOString();

const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const base64Url = (buffer) => Buffer.from(buffer)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const jsonClone = (value) => JSON.parse(JSON.stringify(value));

const loadWindowGlobalScript = (scriptPath, exportName) => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  const context = {
    window: {},
    globalThis: null
  };
  context.globalThis = context.window;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: scriptPath });
  const value = context.window[exportName];
  if (!value) {
    throw new Error(`Missing export ${exportName} from ${scriptPath}`);
  }
  return jsonClone(value);
};

const providerCatalogPath = path.join(STANDARDS_DATA_DIR, 'provider-catalog.global.js');
const verifierProfilesPath = path.join(STANDARDS_DATA_DIR, 'verifier-profiles.global.js');

const providerCatalog = loadWindowGlobalScript(providerCatalogPath, 'SovereignProviderCatalog');
const verifierProfiles = loadWindowGlobalScript(verifierProfilesPath, 'SovereignVerifierProfiles');

const deterministicPublicJwkForDid = (did) => {
  const digest = crypto.createHash('sha256').update(`sovereign-demo-did-key|${did}`).digest();
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: base64Url(digest.subarray(0, 32))
  };
};

const didFromPathSegments = (segments) => {
  const cleaned = String(segments || '')
    .split('/')
    .map((part) => toSafeString(part))
    .filter(Boolean);
  if (!cleaned.length) {
    return `did:web:${DID_DOMAIN}`;
  }
  return `did:web:${DID_DOMAIN}:${cleaned.join(':')}`;
};

const buildDidDocument = (did, options) => {
  const opts = options && typeof options === 'object' ? options : {};
  const keyId = `${did}#key-1`;
  const publicKeyJwk = deterministicPublicJwkForDid(did);
  const document = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/jws-2020/v1'
    ],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: 'JsonWebKey2020',
        controller: did,
        publicKeyJwk
      }
    ],
    authentication: [keyId],
    assertionMethod: [keyId]
  };

  const services = [];
  if (opts.providerId) {
    services.push({
      id: `${did}#service-portal`,
      type: 'ServicePortal',
      serviceEndpoint: `${EXTERNAL_BASE_URL}/services/provider/index.html?provider=${encodeURIComponent(opts.providerId)}`
    });
  }
  if (opts.verifierProfile) {
    services.push({
      id: `${did}#issuer-portal`,
      type: 'IdentityVcIssuerPortal',
      serviceEndpoint: `${EXTERNAL_BASE_URL}/services/verifier/index.html?profile=${encodeURIComponent(opts.verifierProfile)}`
    });
  }
  if (services.length > 0) {
    document.service = services;
  }
  return document;
};

const createDidLookup = () => {
  const map = new Map();

  const rootDid = `did:web:${DID_DOMAIN}`;
  map.set(rootDid, {
    role: 'domain-root',
    didDocument: buildDidDocument(rootDid)
  });

  providerCatalog.forEach((provider) => {
    if (!provider || !provider.did || !provider.id) return;
    map.set(String(provider.did), {
      role: 'provider',
      providerId: String(provider.id),
      label: String(provider.label || provider.id),
      didDocument: buildDidDocument(String(provider.did), { providerId: String(provider.id) })
    });
  });

  const profileConfigs = isObject(verifierProfiles && verifierProfiles.profileConfigs)
    ? verifierProfiles.profileConfigs
    : {};
  Object.entries(profileConfigs).forEach(([profileKey, profile]) => {
    if (!profile || !profile.verifierDid) return;
    map.set(String(profile.verifierDid), {
      role: 'verifier',
      verifierProfile: String(profileKey),
      label: String(profile.label || profileKey),
      didDocument: buildDidDocument(String(profile.verifierDid), { verifierProfile: String(profileKey) })
    });
  });

  return map;
};

const didLookup = createDidLookup();

const trustRegistrySnapshot = () => {
  const issuers = [];
  didLookup.forEach((entry, did) => {
    if (!entry || !did) return;
    if (entry.role !== 'provider' && entry.role !== 'verifier') return;
    issuers.push({
      did,
      role: entry.role,
      label: entry.label || did,
      active: true,
      statusListCredentialBase: `${EXTERNAL_BASE_URL}/vc/status-lists/${encodeURIComponent(did)}`
    });
  });
  issuers.sort((left, right) => String(left.label).localeCompare(String(right.label)));
  return {
    trustFrameworkId: 'sovereign-demo-trust-registry',
    domain: DID_DOMAIN,
    generatedAt: nowIso(),
    resolver: `${EXTERNAL_BASE_URL}/did/resolve?did={did}`,
    issuerCount: issuers.length,
    issuers
  };
};

const parseDemoState = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return null;
    if (!isObject(parsed.statusLists)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const fetchDemoState = async () => {
  if (!STATE_SOURCE_URL) return null;
  const response = await fetch(STATE_SOURCE_URL, {
    method: 'GET',
    headers: {
      accept: 'application/json'
    }
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`State source request failed (${response.status}).`);
  }
  const raw = await response.text();
  if (raw.length > MAX_STATE_BYTES) {
    throw new Error('State source payload exceeds MAX_STATE_BYTES.');
  }
  return parseDemoState(raw);
};

const buildStatusListEncodedBits = (entriesObject) => {
  const entries = isObject(entriesObject) ? Object.values(entriesObject) : [];
  let maxStatusListIndex = 0;
  const revokedIndexes = [];

  entries.forEach((entry) => {
    const index = Number(entry && entry.statusListIndex);
    if (!Number.isFinite(index) || index < 0) return;
    const normalized = Math.floor(index);
    if (normalized > maxStatusListIndex) maxStatusListIndex = normalized;
    if (toSafeString(entry && entry.status).toLowerCase() === 'revoked') {
      revokedIndexes.push(normalized);
    }
  });

  const bitLength = Math.max(16384, maxStatusListIndex + 1);
  const byteLength = Math.ceil(bitLength / 8);
  const bytes = Buffer.alloc(byteLength, 0);
  revokedIndexes.forEach((index) => {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    if (byteIndex < 0 || byteIndex >= bytes.length) return;
    bytes[byteIndex] |= (1 << bitIndex);
  });
  const compressed = zlib.gzipSync(bytes);
  return {
    encodedList: base64Url(compressed),
    bitLength,
    revokedCount: revokedIndexes.length,
    entryCount: entries.length
  };
};

const statusListCredentialForIssuer = async (issuerDid) => {
  const normalizedIssuerDid = toSafeString(issuerDid);
  if (!normalizedIssuerDid) {
    throw new Error('issuerDid is required.');
  }
  const encodedIssuerDid = encodeURIComponent(normalizedIssuerDid);
  const statusListCredentialId = `${EXTERNAL_BASE_URL}/vc/status-lists/${encodedIssuerDid}`;

  let state = null;
  try {
    state = await fetchDemoState();
  } catch {
    state = null;
  }

  const listRow = state && isObject(state.statusLists) && isObject(state.statusLists[normalizedIssuerDid])
    ? state.statusLists[normalizedIssuerDid]
    : null;

  const statusBits = buildStatusListEncodedBits(listRow && listRow.entries);
  return {
    '@context': [VC_CONTEXT, STATUS_LIST_CONTEXT],
    id: statusListCredentialId,
    type: ['VerifiableCredential', 'StatusList2021Credential'],
    issuer: {
      id: normalizedIssuerDid
    },
    validFrom: nowIso(),
    credentialSubject: {
      id: `${statusListCredentialId}#list`,
      type: 'StatusList2021',
      statusPurpose: STATUS_LIST_PURPOSE,
      encodedList: statusBits.encodedList
    },
    metadata: {
      mode: 'container-demo',
      bitLength: statusBits.bitLength,
      entryCount: statusBits.entryCount,
      revokedCount: statusBits.revokedCount,
      sourceStateUrl: STATE_SOURCE_URL || ''
    }
  };
};

const sendJson = (res, status, payload, contentType) => {
  res.writeHead(status, {
    'content-type': contentType || 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(payload, null, 2));
};

const sendDidDocument = (res, status, didDocument) => {
  sendJson(res, status, didDocument, 'application/did+ld+json; charset=utf-8');
};

const sendStatusListCredential = (res, status, credential) => {
  sendJson(res, status, credential, 'application/vc+ld+json; charset=utf-8');
};

const notFound = (res, message) => {
  sendJson(res, 404, {
    ok: false,
    error: toSafeString(message) || 'Not found.'
  });
};

const badRequest = (res, message) => {
  sendJson(res, 400, {
    ok: false,
    error: toSafeString(message) || 'Bad request.'
  });
};

const handler = async (req, res) => {
  const method = toSafeString(req.method).toUpperCase() || 'GET';
  if (method !== 'GET') {
    notFound(res, 'Not found.');
    return;
  }

  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${host}`);
  const pathname = toSafeString(url.pathname);

  if (pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'sovereign-standards-service',
      mode: 'container-demo',
      now: nowIso(),
      didDocuments: didLookup.size
    });
    return;
  }

  if (pathname === '/.well-known/did.json') {
    const rootDid = `did:web:${DID_DOMAIN}`;
    const rootRow = didLookup.get(rootDid);
    if (!rootRow) {
      notFound(res, 'Root did:web document is not available.');
      return;
    }
    sendDidDocument(res, 200, rootRow.didDocument);
    return;
  }

  if (pathname === '/did/resolve') {
    const did = toSafeString(url.searchParams.get('did'));
    if (!did) {
      badRequest(res, 'Query parameter `did` is required.');
      return;
    }
    const row = didLookup.get(did);
    if (!row) {
      sendJson(res, 404, {
        didDocument: null,
        didResolutionMetadata: {
          error: 'notFound'
        },
        didDocumentMetadata: {}
      });
      return;
    }
    sendJson(res, 200, {
      didDocument: row.didDocument,
      didResolutionMetadata: {
        contentType: 'application/did+ld+json'
      },
      didDocumentMetadata: {
        retrieved: nowIso(),
        role: row.role || ''
      }
    });
    return;
  }

  if (pathname.startsWith('/did-web/') && pathname.endsWith('/did.json')) {
    const prefix = '/did-web/';
    const suffix = '/did.json';
    const encodedSegments = pathname.slice(prefix.length, pathname.length - suffix.length);
    const did = didFromPathSegments(encodedSegments);
    const row = didLookup.get(did);
    if (!row) {
      notFound(res, `No DID document found for ${did}.`);
      return;
    }
    sendDidDocument(res, 200, row.didDocument);
    return;
  }

  if (pathname === '/trust/registry' || pathname === '/trust/issuers') {
    sendJson(res, 200, trustRegistrySnapshot());
    return;
  }

  if (pathname.startsWith('/vc/status-lists/')) {
    const encodedIssuerDid = pathname.slice('/vc/status-lists/'.length);
    if (!encodedIssuerDid) {
      badRequest(res, 'Status list issuer did segment is required.');
      return;
    }
    let issuerDid = '';
    try {
      issuerDid = decodeURIComponent(encodedIssuerDid);
    } catch {
      badRequest(res, 'Status list issuer did segment is not valid URI encoding.');
      return;
    }
    if (!issuerDid.startsWith(`did:web:${DID_DOMAIN}:`)) {
      badRequest(res, `Issuer DID must start with did:web:${DID_DOMAIN}:`);
      return;
    }
    try {
      const credential = await statusListCredentialForIssuer(issuerDid);
      sendStatusListCredential(res, 200, credential);
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: 'Failed to build status list credential.',
        detail: toSafeString(error && error.message)
      });
    }
    return;
  }

  notFound(res, 'Not found.');
};

const server = http.createServer((req, res) => {
  Promise.resolve(handler(req, res)).catch((error) => {
    sendJson(res, 500, {
      ok: false,
      error: 'Unhandled standards service error.',
      detail: toSafeString(error && error.message)
    });
  });
});

server.listen(PORT, () => {
  console.log(
    `[standards-service] listening on ${PORT}` +
    ` did-domain=${DID_DOMAIN}` +
    ` base=${EXTERNAL_BASE_URL}` +
    ` state-source=${STATE_SOURCE_URL || '(disabled)'}`
  );
});
