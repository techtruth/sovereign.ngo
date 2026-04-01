const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const parsePositiveInt = (value, fallback, min = 1) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return parsed;
};

const port = Number(process.env.PORT || 3000);
const sovereignInternalOrigin = String(process.env.SOVEREIGN_INTERNAL_ORIGIN || '').trim();
const demoWebId = String(process.env.DEMO_WEBID || '').trim();
const sovereignJweActiveKeyId = String(process.env.SOVEREIGN_JWE_ACTIVE_KEY_ID || 'sovereign-x25519-2026-01').trim();
const sovereignJwePrivateKeyPem = process.env.SOVEREIGN_JWE_PRIVATE_KEY_PEM || `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VuBCIEIBBsNwKs3mpfB3sxWsbpwLcCJvVFcoFt9s75bKLovoVA
-----END PRIVATE KEY-----`;
const sovereignJweRevokedKidSet = new Set(
  String(process.env.SOVEREIGN_JWE_REVOKED_KIDS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
);

if (!sovereignInternalOrigin) {
  throw new Error('SOVEREIGN_INTERNAL_ORIGIN is required');
}
if (!demoWebId) {
  throw new Error('DEMO_WEBID is required');
}

const demoOrigin = (() => {
  try {
    return new URL(demoWebId).origin;
  } catch {
    return 'http://localhost:8180';
  }
})();
const demoIdentitiesFile = String(process.env.DEMO_IDENTITIES_FILE || '/tmp/sovereign-demo-identities.json').trim() || '/tmp/sovereign-demo-identities.json';
const loadDemoIdentityState = () => {
  const fallbackStephenStafferWebId = `${demoOrigin}/profile/card#S7T4F9R2`;
  const normalizeIdentityEntry = (entry) => {
    const webId = String(entry?.webId || '').trim();
    if (!webId) return null;
    const label = String(entry?.label || '').trim() || webId;
    return { label, webId };
  };
  const fallbackIdentities = [
    { label: 'Default Demo Identity', webId: demoWebId },
    { label: 'Stephen Staffer', webId: fallbackStephenStafferWebId }
  ];
  try {
    const raw = fs.readFileSync(demoIdentitiesFile, 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.identities) ? parsed.identities : [];
    const deduped = [];
    const seen = new Set();
    for (const entry of list) {
      const normalized = normalizeIdentityEntry(entry);
      if (!normalized || seen.has(normalized.webId)) continue;
      deduped.push(normalized);
      seen.add(normalized.webId);
    }
    let stephenWebId = String(parsed?.stephenStafferWebId || '').trim();
    if (!stephenWebId) {
      const named = deduped.find((entry) => String(entry.label || '').trim().toLowerCase() === 'stephen staffer');
      stephenWebId = named?.webId || fallbackStephenStafferWebId;
    }
    if (!seen.has(stephenWebId)) {
      deduped.push({ label: 'Stephen Staffer', webId: stephenWebId });
      seen.add(stephenWebId);
    }
    let defaultWebId = String(parsed?.defaultDemoIdentityWebId || '').trim();
    if (!defaultWebId) {
      const firstNonStaff = deduped.find((entry) => entry.webId !== stephenWebId);
      defaultWebId = firstNonStaff?.webId || demoWebId;
    }
    if (!seen.has(defaultWebId)) {
      deduped.unshift({ label: 'Default Demo Identity', webId: defaultWebId });
    }
    return {
      defaultDemoIdentityWebId: defaultWebId,
      stephenStafferWebId: stephenWebId,
      demoIdentityOptions: deduped
    };
  } catch {
    const dedupedFallback = [];
    const seen = new Set();
    for (const entry of fallbackIdentities) {
      const normalized = normalizeIdentityEntry(entry);
      if (!normalized || seen.has(normalized.webId)) continue;
      dedupedFallback.push(normalized);
      seen.add(normalized.webId);
    }
    return {
      defaultDemoIdentityWebId: demoWebId,
      stephenStafferWebId: fallbackStephenStafferWebId,
      demoIdentityOptions: dedupedFallback
    };
  }
};
const identityState = loadDemoIdentityState();
const defaultDemoIdentityWebId = identityState.defaultDemoIdentityWebId;
const stephenStafferWebId = identityState.stephenStafferWebId;
const emergencyJohnDoeWebIdPrefix = `${demoOrigin}/profile/card#john-doe-`;
const demoIdentityOptions = identityState.demoIdentityOptions;
const subjectIdentityOptions = demoIdentityOptions.filter((entry) => entry.webId !== stephenStafferWebId);
const allowedDemoWebIds = new Set([demoWebId, ...demoIdentityOptions.map((entry) => entry.webId)]);
const allowedSubjectLoginWebIds = new Set(subjectIdentityOptions.map((entry) => entry.webId));
const isEmergencyJohnDoeWebId = (webId) => {
  const candidate = String(webId || '').trim().toLowerCase();
  if (!candidate) return false;
  return candidate.startsWith(emergencyJohnDoeWebIdPrefix.toLowerCase());
};
const formatIdentityOptionLabel = (entry) => {
  return String(entry?.label || '').trim() || 'Unnamed Identity';
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const json = (res, status, payload) => {
  const requestId = String(res.__requestId || '').trim();
  const idempotencyMeta = res.__idempotencyMeta && typeof res.__idempotencyMeta === 'object'
    ? res.__idempotencyMeta
    : null;
  const body = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? {
      ...payload,
      ...(requestId && !payload.requestId ? { requestId } : {}),
      ...(idempotencyMeta && !payload.idempotency ? { idempotency: idempotencyMeta } : {})
    }
    : payload;

  if (res.__idempotencyCacheKey && status < 500) {
    idempotencyCache.set(res.__idempotencyCacheKey, {
      status,
      payload: body,
      storedAtMs: Date.now()
    });
  }

  if (!res.__auditSuppressed && res.__auditContext) {
    const summary = body && typeof body === 'object' && !Array.isArray(body)
      ? {
        ok: body.ok,
        error: body.error || null,
        webId: body.webId || null,
        providerDid: body.providerDid || null
      }
      : { ok: status < 400, error: status >= 400 ? 'non_object_response' : null };
    serviceAuditEvents.push({
      id: `audit-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      requestId: requestId || null,
      method: res.__auditContext.method || null,
      path: res.__auditContext.path || null,
      status,
      ...summary
    });
    if (serviceAuditEvents.length > maxAuditEvents) {
      serviceAuditEvents.splice(0, serviceAuditEvents.length - maxAuditEvents);
    }
  }

  if (idempotencyCache.size > maxIdempotencyEntries) {
    const sorted = [...idempotencyCache.entries()].sort((a, b) => (a[1]?.storedAtMs || 0) - (b[1]?.storedAtMs || 0));
    const trimCount = Math.max(1, sorted.length - maxIdempotencyEntries);
    for (let index = 0; index < trimCount; index += 1) {
      idempotencyCache.delete(sorted[index][0]);
    }
  }

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    ...(requestId ? { 'X-Request-Id': requestId } : {})
  });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const decodeBase64UrlJson = (value) => JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));

const decryptSovereignSealedEnvelope = (envelope) => {
  const protectedB64u = String(envelope?.protected || '').trim();
  const ivB64u = String(envelope?.iv || '').trim();
  const tagB64u = String(envelope?.tag || '').trim();
  const ciphertextB64u = String(envelope?.ciphertext || '').trim();
  if (!protectedB64u || !ivB64u || !tagB64u || !ciphertextB64u) {
    throw new Error('invalid envelope: missing protected, iv, ciphertext, or tag');
  }

  const header = decodeBase64UrlJson(protectedB64u);
  if (header.alg !== 'ECDH-ES' || header.enc !== 'A256GCM') {
    throw new Error('unsupported JWE algorithms');
  }
  const kid = String(header.kid || '').trim();
  if (!kid) throw new Error('missing key id');
  if (sovereignJweRevokedKidSet.has(kid)) throw new Error(`key id revoked: ${kid}`);
  if (kid !== sovereignJweActiveKeyId) throw new Error(`unknown key id: ${kid}`);
  if (!header.epk || typeof header.epk !== 'object') throw new Error('missing ephemeral public key');

  const sharedSecret = crypto.diffieHellman({
    privateKey: crypto.createPrivateKey(sovereignJwePrivateKeyPem),
    publicKey: crypto.createPublicKey({ key: header.epk, format: 'jwk' })
  });
  const cek = crypto.hkdfSync(
    'sha256',
    sharedSecret,
    Buffer.alloc(0),
    Buffer.from(`jwe-cek:${kid}`, 'utf8'),
    32
  );
  const decipher = crypto.createDecipheriv('aes-256-gcm', cek, Buffer.from(ivB64u, 'base64url'));
  decipher.setAAD(Buffer.from(protectedB64u, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64u, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64u, 'base64url')),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(plaintext);
};

const sharingPermissionsByWebId = new Map();
const maxAuditEvents = parsePositiveInt(process.env.AUDIT_MAX_EVENTS, 3000, 100);
const maxIdempotencyEntries = parsePositiveInt(process.env.IDEMPOTENCY_MAX_ENTRIES, 1000, 100);
const idempotencyTtlMs = parsePositiveInt(process.env.IDEMPOTENCY_TTL_MS, 10 * 60 * 1000, 1000);
const serviceAuditEvents = [];
const idempotencyCache = new Map();

const normalizeMatchToken = (value) => String(value || '').trim().toLowerCase().replace(/\/+$/, '');

const deriveSubjectDidFromWebId = (webId) => {
  const toDidComponent = (value) => encodeURIComponent(String(value || '').trim()).replace(/%20/g, '+');
  try {
    const u = new URL(webId);
    const hostComponent = toDidComponent(u.port ? `${u.hostname}:${u.port}` : u.hostname);
    const pathComponents = u.pathname
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => toDidComponent(part))
      .filter(Boolean);
    const fragmentComponent = toDidComponent(u.hash.startsWith('#') ? u.hash.slice(1) : '');
    const didComponents = [hostComponent, ...pathComponents];
    if (fragmentComponent) didComponents.push(fragmentComponent);
    return `did:web:${didComponents.join(':') || 'subject'}`;
  } catch {
    const cleaned = toDidComponent(webId || 'subject');
    return `did:web:${cleaned || 'subject'}`;
  }
};

const mapToInternalSovereignOrigin = (url) => {
  const source = new URL(url);
  if (source.hostname === 'localhost' || source.hostname === '127.0.0.1') {
    const mapped = new URL(sovereignInternalOrigin);
    return `${mapped.origin}${source.pathname}${source.search}${source.hash}`;
  }
  return source.toString();
};

const deriveCredentialsContainerFromWebId = (webId) => {
  const effectiveWebId = mapToInternalSovereignOrigin(webId);
  const u = new URL(effectiveWebId);
  return `${u.origin}/credentials/`;
};

const credentialSubjectEntries = (credential) => {
  const subject = credential?.credentialSubject;
  if (Array.isArray(subject)) return subject.filter((entry) => entry && typeof entry === 'object');
  if (subject && typeof subject === 'object') return [subject];
  return [];
};

const credentialTypes = (credential) => {
  const value = credential?.type;
  if (Array.isArray(value)) return value.filter(Boolean).map((entry) => String(entry));
  if (!value) return [];
  return [String(value)];
};

const credentialIssuerDid = (credential) => {
  const issuer = credential?.issuer;
  if (typeof issuer === 'string') return issuer;
  if (issuer && typeof issuer === 'object') return String(issuer.id || '').trim();
  return '';
};

const credentialBelongsToWebId = (credential, webId) => {
  const subjects = credentialSubjectEntries(credential);
  if (subjects.length === 0) return false;
  const expectedWebId = normalizeMatchToken(webId);
  const expectedDid = deriveSubjectDidFromWebId(webId);
  return subjects.some((subject) => {
    const subjectWebId = normalizeMatchToken(subject.webId || subject.subjectWebId || '');
    const subjectDid = String(subject.id || subject.did || '').trim();
    if (subjectWebId && subjectWebId === expectedWebId) return true;
    if (subjectDid && subjectDid === expectedDid) return true;
    return false;
  });
};

const parseCsvList = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isLikelyDid = (value) => /^did:[a-z0-9]+:[A-Za-z0-9:._-]+$/.test(String(value || '').trim());
const isLikelyWebId = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};
const normalizeRequestId = (value) => String(value || '').trim().slice(0, 120);
const generateRequestId = () => `req-${crypto.randomUUID()}`;
const requireObjectBody = (body, contextLabel) => {
  if (!isPlainObject(body)) return `${contextLabel} payload must be a JSON object`;
  return '';
};
const parseIdempotencyKey = (req, body) => {
  const headerKey = String(req.headers['x-idempotency-key'] || '').trim();
  const bodyKey = isPlainObject(body)
    ? String(body.idempotencyKey || body.idempotency_key || '').trim()
    : '';
  const raw = headerKey || bodyKey;
  return raw ? raw.slice(0, 180) : '';
};
const readCachedIdempotentResponse = (cacheKey) => {
  if (!cacheKey) return null;
  const cached = idempotencyCache.get(cacheKey);
  if (!cached) return null;
  if (!Number.isFinite(cached.storedAtMs) || (Date.now() - cached.storedAtMs) > idempotencyTtlMs) {
    idempotencyCache.delete(cacheKey);
    return null;
  }
  return cached;
};

const explorerSessions = new Map();
const explorerSessionTtlMs = parsePositiveInt(process.env.EXPLORER_SESSION_TTL_MS, 30 * 60 * 1000, 60 * 1000);

const trustedIdentityIssuersByType = {
  DriversLicenseCredential: new Set(['did:example:verifier:drivers-license']),
  PassportCredential: new Set(['did:example:verifier:passport'])
};

const getAuthToken = (req) => {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return String(req.headers['x-session-token'] || '').trim();
};

const getSession = (req) => {
  const token = getAuthToken(req);
  if (!token) return null;
  const session = explorerSessions.get(token);
  if (!session) return null;
  if (!Number.isFinite(session.expiresAtMs) || session.expiresAtMs <= Date.now()) {
    explorerSessions.delete(token);
    return null;
  }
  session.lastSeenAt = new Date().toISOString();
  session.expiresAtMs = Date.now() + explorerSessionTtlMs;
  return session;
};

const createSession = (webId) => {
  const token = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const session = {
    token,
    webId,
    createdAt: nowIso,
    lastSeenAt: nowIso,
    expiresAtMs: Date.now() + explorerSessionTtlMs
  };
  explorerSessions.set(token, session);
  return session;
};

const ensureSharingPermissionList = (webId) => {
  const key = String(webId || '').trim();
  if (!key) return [];
  if (!sharingPermissionsByWebId.has(key)) {
    sharingPermissionsByWebId.set(key, []);
  }
  return sharingPermissionsByWebId.get(key);
};

const allowedAccessPresets = new Set(['everything', 'all_xray', 'all_ultrasound', 'custom']);

const listCredentialResourceUrls = async (containerUrl) => {
  const response = await fetch(containerUrl, { headers: { Accept: 'text/turtle' } });
  if (response.status === 404) return { ok: true, containerUrl, resources: [] };
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      containerUrl,
      reason: `credentials container read failed (${response.status})`,
      status: response.status,
      body: text.slice(0, 400)
    };
  }

  const resources = [];
  const containsBlockRegex = /ldp:contains\s+([\s\S]*?>)\s*\./g;
  const linkRegex = /<([^>]+)>/g;
  let containsBlock;
  while ((containsBlock = containsBlockRegex.exec(text))) {
    const block = containsBlock[1];
    let link;
    while ((link = linkRegex.exec(block))) {
      const resourceUrl = link[1];
      const normalized = resourceUrl.startsWith('http://') || resourceUrl.startsWith('https://')
        ? resourceUrl
        : new URL(resourceUrl, containerUrl).toString();
      if (normalized.endsWith('.json') && !resources.includes(normalized)) resources.push(normalized);
    }
  }

  // Fallback: handle edge cases where contains blocks are formatted unexpectedly.
  if (resources.length === 0) {
    const jsonRefRegex = /<([^>]+\.json)>/g;
    let jsonRef;
    while ((jsonRef = jsonRefRegex.exec(text))) {
      const href = jsonRef[1];
      const normalized = href.startsWith('http://') || href.startsWith('https://')
        ? href
        : new URL(href, containerUrl).toString();
      if (!resources.includes(normalized)) resources.push(normalized);
    }
  }

  return { ok: true, containerUrl, resources };
};

const deleteCredentialResources = async (resourceUrls) => {
  let deletedCount = 0;
  let failedCount = 0;
  const failures = [];
  for (const resourceUrl of resourceUrls) {
    try {
      const response = await fetch(resourceUrl, { method: 'DELETE' });
      if (response.ok || response.status === 404) {
        deletedCount += 1;
        continue;
      }
      failedCount += 1;
      if (failures.length < 10) failures.push({ resourceUrl, status: response.status });
    } catch (err) {
      failedCount += 1;
      if (failures.length < 10) failures.push({ resourceUrl, error: err.message });
    }
  }
  return {
    ok: failedCount === 0,
    listedCount: resourceUrls.length,
    deletedCount,
    failedCount,
    failures
  };
};

const resetSovereignDemoCredentials = async () => {
  const containerUrl = deriveCredentialsContainerFromWebId(defaultDemoIdentityWebId);
  const listed = await listCredentialResourceUrls(containerUrl);
  if (!listed.ok) {
    return { ok: false, containerUrl, listed };
  }

  const deletion = await deleteCredentialResources(listed.resources);
  return {
    ok: deletion.ok,
    containerUrl,
    deletion
  };
};

const readCredentials = async (webId) => {
  const containerUrl = deriveCredentialsContainerFromWebId(webId);
  const listed = await listCredentialResourceUrls(containerUrl);
  if (!listed.ok) return listed;
  const credentials = [];
  for (const resourceUrl of listed.resources) {
    const response = await fetch(resourceUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) continue;
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') continue;
    const type = payload.type;
    if (Array.isArray(type) ? type.length === 0 : !type) continue;
    if (!credentialBelongsToWebId(payload, webId)) continue;
    credentials.push({ resourceUrl, credential: payload });
  }
  return {
    ok: true,
    containerUrl: listed.containerUrl,
    exists: true,
    credentials,
    resources: listed.resources
  };
};

const verifyIdentityCredentialForLogin = async (webId) => {
  if (isEmergencyJohnDoeWebId(webId)) {
    return {
      ok: true,
      mode: 'emergency_override_identity',
      matchedCredentialType: null
    };
  }

  const credentialsRead = await readCredentials(webId);
  if (!credentialsRead.ok) {
    return {
      ok: false,
      reason: credentialsRead.reason || 'unable to read sovereign credentials for identity verification'
    };
  }

  const credentials = Array.isArray(credentialsRead.credentials)
    ? credentialsRead.credentials.map((entry) => entry.credential).filter(Boolean)
    : [];

  const match = credentials.find((credential) => {
    const types = credentialTypes(credential);
    const issuerDid = credentialIssuerDid(credential);
    if (types.includes('DriversLicenseCredential') && trustedIdentityIssuersByType.DriversLicenseCredential.has(issuerDid)) return true;
    if (types.includes('PassportCredential') && trustedIdentityIssuersByType.PassportCredential.has(issuerDid)) return true;
    return false;
  });

  if (!match) {
    return {
      ok: false,
      reason: 'trusted DriversLicenseCredential or PassportCredential is required for login'
    };
  }

  const types = credentialTypes(match);
  const matchedCredentialType = types.includes('DriversLicenseCredential')
    ? 'DriversLicenseCredential'
    : (types.includes('PassportCredential') ? 'PassportCredential' : null);

  return {
    ok: true,
    mode: 'credential_bound_webid_login',
    matchedCredentialType
  };
};

const readContainerListing = async (path) => {
  const target = `${sovereignInternalOrigin}${path}`;
  const response = await fetch(target, { headers: { Accept: 'text/turtle' } });
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      path,
      status: response.status,
      reason: `listing failed with status ${response.status}`,
      sample: text.slice(0, 600)
    };
  }

  const links = [];
  const containsBlockRegex = /ldp:contains\s+([\s\S]*?>)\s*\./g;
  const linkRegex = /<([^>]+)>/g;
  let containsBlock;
  while ((containsBlock = containsBlockRegex.exec(text))) {
    const block = containsBlock[1];
    let link;
    while ((link = linkRegex.exec(block))) {
      const href = link[1];
      const normalized = href.startsWith('http://') || href.startsWith('https://')
        ? href
        : new URL(href, target).toString();
      if (!links.includes(normalized)) links.push(normalized);
    }
  }

  return { ok: true, path, links, rawSample: text.slice(0, 1200) };
};

const renderHomePage = () => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Credential Explorer</title>
  <style>
    :root {
      --bg:#eef3f8;
      --panel:#ffffff;
      --line:#d5deea;
      --text:#18212f;
      --muted:#516074;
      --accent:#0e7490;
      --soft:#f2f8ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      background: radial-gradient(1200px 400px at 20% -10%, #d8efff, transparent), linear-gradient(180deg, #f7fbff, var(--bg));
      color: var(--text);
    }
    .wrap { max-width: 1100px; margin: 1rem auto; padding: 0 1rem 1rem; }
    .header {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 1rem;
      box-shadow: 0 12px 24px rgba(24,33,47,.08);
      margin-bottom: 12px;
    }
    h1 { margin: 0; font-size: 1.2rem; }
    .hint { color: var(--muted); font-size: .95rem; margin-top: .45rem; }
    .row { display: grid; gap: 12px; width: 100%; }
    .top-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .bottom-row { grid-template-columns: 1fr; margin-top: 12px; }
    .row > .panel { min-width: 0; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: .9rem;
      box-shadow: 0 10px 20px rgba(24,33,47,.06);
      min-width: 0;
    }
    label { display:block; font-weight:700; margin-bottom:.35rem; }
    input, select {
      width: 100%;
      padding: .6rem .65rem;
      border-radius: 10px;
      border: 1px solid #c5d4e8;
      background: #fff;
      color: var(--text);
      font: inherit;
    }
    .btns { display: flex; gap: 8px; margin-top: 8px; }
    button {
      border: 0;
      border-radius: 10px;
      padding: .55rem .85rem;
      background: var(--accent);
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    button.secondary { background: #334155; }
    .meta {
      margin-top: 8px;
      background: var(--soft);
      border: 1px solid #d8e4f2;
      border-radius: 10px;
      padding: .65rem;
      color: #334155;
      font-size: .9rem;
    }
    .sharing-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .sharing-actions button { flex: 1 1 170px; }
    .sharing-subtle {
      margin-top: 6px;
      color: var(--muted);
      font-size: .85rem;
    }
    .hidden { display: none; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: .9rem;
    }
    th, td {
      border-bottom: 1px solid #e5edf6;
      padding: .5rem;
      text-align: left;
      vertical-align: top;
    }
    th { color: #334155; background: #f8fbff; }
    pre {
      margin: 10px 0 0;
      background: #101827;
      color: #e5edf6;
      border-radius: 12px;
      padding: .75rem;
      max-height: 300px;
      overflow: auto;
      font-size: .82rem;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      word-break: break-all;
      max-width: 100%;
    }
    .outbox {
      margin: 10px 0 0;
      background: #101827;
      color: #e5edf6;
      border-radius: 12px;
      padding: .75rem;
      max-height: 300px;
      overflow: auto;
      font-size: .82rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      word-break: break-all;
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      overflow-y: auto;
    }
    ul { margin: .5rem 0 0 1rem; }
    .pod-panel { max-width: 100%; overflow: hidden; min-width: 0; }
    #links { max-width: 100%; overflow-x: auto; }
    #links li { white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
    #links a { display: inline; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
    #out { display: block; width: 100%; max-width: 100%; }
    #out, #out * { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-all; }
    td, th { overflow-wrap: anywhere; word-break: break-word; }
    @media (max-width: 920px) {
      .top-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="header">
      <h1>Personal Identity and Record Storage</h1>
      <p class="hint">Credential Explorer: browse your sovereign Solid pod credential files under <code>/credentials/</code>.</p>
    </section>

    <div class="row top-row">
      <section class="panel">
        <label for="identityPreset">Identity</label>
        <select id="identityPreset">
          ${subjectIdentityOptions.map((entry) => `<option value="${escapeHtml(entry.webId)}"${entry.webId === defaultDemoIdentityWebId ? ' selected' : ''}>${escapeHtml(formatIdentityOptionLabel(entry))}</option>`).join('')}
          <option value="__custom__">Custom WebID</option>
        </select>
        <label for="webId" style="margin-top:8px;">WebID</label>
        <input id="webId" value="${escapeHtml(defaultDemoIdentityWebId)}" />
        <div class="btns">
          <button id="loginBtn">Login</button>
          <button id="loadBtn" class="secondary">Load Credentials</button>
          <button id="listBtn" class="secondary">Browse Pod</button>
        </div>
        <div id="meta" class="meta">Not logged in.</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Issuer</th>
              <th>Issued</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </section>

      <section class="panel">
        <strong>Sharing Permissions</strong>
        <p class="sharing-subtle">Grant or revoke provider access by DID, and choose what each provider may access.</p>
        <label for="providerDid" style="margin-top:8px;">Provider DID</label>
        <input id="providerDid" placeholder="did:example:issuer:apple-seed-insurance" />
        <label for="accessPreset" style="margin-top:8px;">What It Allows</label>
        <select id="accessPreset">
          <option value="everything">Everything</option>
          <option value="all_xray">All X-Ray</option>
          <option value="all_ultrasound">All Ultrasound</option>
          <option value="custom">Only Granularly Specific Access</option>
        </select>
        <div id="sharingCustomFields" class="hidden" style="margin-top:8px;">
          <label for="sharingRecordTypes">Allowed Record Types</label>
          <input id="sharingRecordTypes" placeholder="xray, ultrasound" />
          <label for="sharingRecordIds" style="margin-top:8px;">Allowed Specific Record IDs</label>
          <input id="sharingRecordIds" placeholder="xray-123, ultrasound-456" />
        </div>
        <div class="sharing-actions">
          <button id="sharingGrantBtn">Grant / Update</button>
          <button id="sharingRevokeBtn" class="secondary">Revoke</button>
        </div>
        <div id="sharingMeta" class="meta">No sharing updates yet.</div>
        <table>
          <thead>
            <tr>
              <th>Provider DID</th>
              <th>Allowed</th>
              <th>Scope Detail</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="sharingRows"></tbody>
        </table>
      </section>
    </div>

    <div class="row bottom-row">
      <section class="panel pod-panel">
        <strong>Pod Resources</strong>
        <ul id="links"></ul>
        <div id="out" class="outbox">{}</div>
      </section>
    </div>
  </div>

  <script>
    const namedIdentityPresets = ${JSON.stringify(subjectIdentityOptions)};
    const customIdentityPresetValue = '__custom__';
    const identityPresetEl = document.getElementById('identityPreset');
    const webIdEl = document.getElementById('webId');
    const rowsEl = document.getElementById('rows');
    const outEl = document.getElementById('out');
    const linksEl = document.getElementById('links');
    const metaEl = document.getElementById('meta');
    const providerDidEl = document.getElementById('providerDid');
    const accessPresetEl = document.getElementById('accessPreset');
    const sharingCustomFieldsEl = document.getElementById('sharingCustomFields');
    const sharingRecordTypesEl = document.getElementById('sharingRecordTypes');
    const sharingRecordIdsEl = document.getElementById('sharingRecordIds');
    const sharingGrantBtn = document.getElementById('sharingGrantBtn');
    const sharingRevokeBtn = document.getElementById('sharingRevokeBtn');
    const sharingMetaEl = document.getElementById('sharingMeta');
    const sharingRowsEl = document.getElementById('sharingRows');
    const loginBtn = document.getElementById('loginBtn');
    const identityPresetByWebId = new Map(namedIdentityPresets.map((entry) => [String(entry.webId || '').trim(), entry]));

    let token = '';
    let authenticatedWebId = '';

    const setMeta = (text) => { metaEl.textContent = text; };
    const setSharingMeta = (text) => { sharingMetaEl.textContent = text; };
    const normalizeToken = (value) => String(value || '').trim().toLowerCase();

    const syncIdentityPresetFromWebId = () => {
      const currentWebId = webIdEl.value.trim();
      if (!currentWebId) {
        identityPresetEl.value = customIdentityPresetValue;
        return;
      }
      identityPresetEl.value = identityPresetByWebId.has(currentWebId) ? currentWebId : customIdentityPresetValue;
    };

    const applyIdentityPresetToWebId = () => {
      const selectedWebId = String(identityPresetEl.value || '').trim();
      if (!selectedWebId || selectedWebId === customIdentityPresetValue) return;
      webIdEl.value = selectedWebId;
      syncIdentityPresetFromWebId();
    };

    const hardWrapLongTokens = (input, chunk = 56) => String(input ?? '').replace(/\\S{80,}/g, (tokenValue) => {
      const parts = [];
      for (let i = 0; i < tokenValue.length; i += chunk) parts.push(tokenValue.slice(i, i + chunk));
      return parts.join('\\u200b');
    });
    const formatForOutput = (value) => hardWrapLongTokens(JSON.stringify(value, null, 2));

    const clearAuthState = () => {
      token = '';
      authenticatedWebId = '';
    };

    const authHeaders = (extraHeaders = {}) => {
      const headers = { ...extraHeaders };
      if (token) headers.Authorization = 'Bearer ' + token;
      return headers;
    };

    const loginWithWebId = async ({ silent = false } = {}) => {
      const webId = webIdEl.value.trim();
      if (!webId) {
        if (!silent) setMeta('WebID is required.');
        clearAuthState();
        return false;
      }

      const res = await fetch('/api/login-webid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webId })
      });
      const data = await res.json();
      outEl.textContent = formatForOutput(data);
      if (!res.ok || !data.ok || !data.token) {
        clearAuthState();
        if (!silent) setMeta('Login failed.');
        return false;
      }

      token = String(data.token || '').trim();
      authenticatedWebId = String(data.authenticatedWebId || '').trim();
      if (authenticatedWebId) {
        webIdEl.value = authenticatedWebId;
        syncIdentityPresetFromWebId();
      }
      if (!silent) {
        const matched = data.matchedCredentialType ? (' using ' + data.matchedCredentialType) : '';
        setMeta('Logged in as ' + authenticatedWebId + matched + '.');
      }
      return true;
    };

    const ensureAuthenticatedForSelectedIdentity = async () => {
      const selectedWebId = webIdEl.value.trim();
      if (!selectedWebId) {
        setMeta('WebID is required.');
        clearAuthState();
        return false;
      }
      const sameIdentity = token && normalizeToken(authenticatedWebId) === normalizeToken(selectedWebId);
      if (sameIdentity) return true;
      return loginWithWebId({ silent: true });
    };

    const renderRows = (credentials) => {
      rowsEl.innerHTML = credentials.map((cred, idx) => {
        const types = Array.isArray(cred.type) ? cred.type.filter((entry) => entry !== 'VerifiableCredential').join(', ') : 'Unknown';
        const issuer = cred && cred.issuer ? (cred.issuer.name || cred.issuer.id || 'Unknown') : 'Unknown';
        const issued = cred && (cred.issuanceDate || cred.validFrom) ? (cred.issuanceDate || cred.validFrom) : 'Unknown';
        return '<tr>' +
          '<td>' + (idx + 1) + '</td>' +
          '<td>' + types + '</td>' +
          '<td>' + issuer + '</td>' +
          '<td>' + issued + '</td>' +
          '</tr>';
      }).join('');
    };

    const syncSharingCustomVisibility = () => {
      const preset = String(accessPresetEl.value || '').trim();
      sharingCustomFieldsEl.classList.toggle('hidden', preset !== 'custom');
    };

    const renderSharingRows = (entries) => {
      if (!Array.isArray(entries) || entries.length === 0) {
        sharingRowsEl.innerHTML = '<tr><td colspan="4">No sharing permissions configured.</td></tr>';
        return;
      }
      sharingRowsEl.innerHTML = entries.map((entry) => {
        const allowed = entry && entry.accessPreset ? entry.accessPreset : 'unknown';
        const scopeParts = [];
        if (entry && Array.isArray(entry.allowedRecordTypes) && entry.allowedRecordTypes.length > 0) {
          scopeParts.push('types: ' + entry.allowedRecordTypes.join(', '));
        }
        if (entry && Array.isArray(entry.allowedRecordIds) && entry.allowedRecordIds.length > 0) {
          scopeParts.push('records: ' + entry.allowedRecordIds.join(', '));
        }
        const scopeText = scopeParts.length > 0 ? scopeParts.join(' | ') : 'default preset scope';
        const status = String(entry && entry.status ? entry.status : 'unknown');
        return '<tr>' +
          '<td>' + hardWrapLongTokens(String(entry && entry.providerDid ? entry.providerDid : 'Unknown'), 42) + '</td>' +
          '<td>' + hardWrapLongTokens(allowed, 42) + '</td>' +
          '<td>' + hardWrapLongTokens(scopeText, 42) + '</td>' +
          '<td>' + hardWrapLongTokens(status, 42) + '</td>' +
          '</tr>';
      }).join('');
    };

    const loadSharingPermissions = async () => {
      if (!(await ensureAuthenticatedForSelectedIdentity())) {
        setSharingMeta('Login required.');
        renderSharingRows([]);
        return;
      }
      const res = await fetch('/api/sharing-permissions', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSharingMeta('Unable to load sharing permissions.');
        renderSharingRows([]);
        return;
      }
      renderSharingRows(data.permissions || []);
      setSharingMeta('Loaded ' + (data.activePermissionCount || 0) + ' active sharing permission(s).');
    };

    const grantOrUpdateSharingPermission = async () => {
      const providerDid = providerDidEl.value.trim();
      const accessPreset = String(accessPresetEl.value || '').trim() || 'everything';
      if (!providerDid) {
        setSharingMeta('Provider DID is required.');
        return;
      }
      if (!(await ensureAuthenticatedForSelectedIdentity())) {
        setSharingMeta('Login required.');
        return;
      }
      const body = { providerDid, accessPreset };
      if (accessPreset === 'custom') {
        body.allowedRecordTypes = sharingRecordTypesEl.value.trim();
        body.allowedRecordIds = sharingRecordIdsEl.value.trim();
      }
      const res = await fetch('/api/sharing-permissions/grant', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      outEl.textContent = formatForOutput(data);
      if (!res.ok || !data.ok) {
        setSharingMeta('Grant / update failed.');
        return;
      }
      setSharingMeta('Sharing permission granted / updated.');
      await loadSharingPermissions();
    };

    const revokeSharingPermission = async () => {
      const providerDid = providerDidEl.value.trim();
      if (!providerDid) {
        setSharingMeta('Provider DID is required.');
        return;
      }
      if (!(await ensureAuthenticatedForSelectedIdentity())) {
        setSharingMeta('Login required.');
        return;
      }
      const res = await fetch('/api/sharing-permissions/revoke', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ providerDid })
      });
      const data = await res.json();
      outEl.textContent = formatForOutput(data);
      if (!res.ok || !data.ok) {
        setSharingMeta('Revoke failed.');
        return;
      }
      setSharingMeta('Sharing permission revoked.');
      await loadSharingPermissions();
    };

    const loadCredentials = async () => {
      if (!(await ensureAuthenticatedForSelectedIdentity())) {
        setMeta('Login required.');
        rowsEl.innerHTML = '';
        return;
      }
      const res = await fetch('/api/credentials', { headers: authHeaders() });
      const data = await res.json();
      outEl.textContent = formatForOutput(data);
      if (!res.ok || !data.ok) {
        setMeta('Unable to load credentials.');
        rowsEl.innerHTML = '';
        return;
      }
      renderRows(data.credentials || []);
      setMeta('Loaded ' + (data.credentials || []).length + ' credential files from /credentials/.');
    };

    const browsePod = async () => {
      if (!(await ensureAuthenticatedForSelectedIdentity())) {
        setMeta('Login required.');
        linksEl.innerHTML = '';
        return;
      }
      const res = await fetch('/api/browse', { headers: authHeaders() });
      const data = await res.json();
      outEl.textContent = formatForOutput(data);
      linksEl.innerHTML = '';
      if (!res.ok || !data.ok) {
        setMeta('Unable to browse pod resources.');
        return;
      }
      const links = data.links || [];
      links.forEach((href) => {
        const li = document.createElement('li');
        li.textContent = hardWrapLongTokens(href, 48);
        linksEl.appendChild(li);
      });
      setMeta('Found ' + links.length + ' visible pod resources.');
    };

    const refreshAllViews = async () => {
      const loggedIn = await loginWithWebId({ silent: true });
      if (!loggedIn) {
        setMeta('Not logged in.');
        rowsEl.innerHTML = '';
        linksEl.innerHTML = '';
        renderSharingRows([]);
        return;
      }
      await loadCredentials();
      await browsePod();
      await loadSharingPermissions();
    };

    loginBtn.addEventListener('click', () => loginWithWebId().catch((e) => {
      clearAuthState();
      outEl.textContent = formatForOutput({ ok: false, error: String(e && e.message ? e.message : e) });
      setMeta('Login failed.');
    }));
    document.getElementById('loadBtn').addEventListener('click', () => loadCredentials().catch((e) => {
      outEl.textContent = formatForOutput({ ok: false, error: String(e && e.message ? e.message : e) });
      setMeta('Load failed.');
    }));
    document.getElementById('listBtn').addEventListener('click', () => browsePod().catch((e) => {
      outEl.textContent = formatForOutput({ ok: false, error: String(e && e.message ? e.message : e) });
      setMeta('Browse failed.');
    }));
    identityPresetEl.addEventListener('change', () => {
      applyIdentityPresetToWebId();
      clearAuthState();
      refreshAllViews().catch((e) => {
        outEl.textContent = formatForOutput({ ok: false, error: String(e && e.message ? e.message : e) });
        setMeta('Identity switch failed.');
      });
    });
    webIdEl.addEventListener('input', () => {
      syncIdentityPresetFromWebId();
      clearAuthState();
    });
    webIdEl.addEventListener('blur', syncIdentityPresetFromWebId);

    accessPresetEl.addEventListener('change', syncSharingCustomVisibility);
    sharingGrantBtn.addEventListener('click', () => grantOrUpdateSharingPermission().catch((e) => {
      outEl.textContent = formatForOutput({ ok: false, error: String(e && e.message ? e.message : e) });
      setSharingMeta('Grant / update failed.');
    }));
    sharingRevokeBtn.addEventListener('click', () => revokeSharingPermission().catch((e) => {
      outEl.textContent = formatForOutput({ ok: false, error: String(e && e.message ? e.message : e) });
      setSharingMeta('Revoke failed.');
    }));

    syncSharingCustomVisibility();
    syncIdentityPresetFromWebId();
    refreshAllViews();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  try {
    const requestId = normalizeRequestId(req.headers['x-request-id']) || generateRequestId();
    req.requestId = requestId;
    res.__requestId = requestId;
    res.__auditContext = {
      method: req.method,
      path: String(req.url || '').split('?')[0]
    };

    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderHomePage());
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      json(res, 200, {
        ok: true,
        service: 'credential-explorer',
        sovereignInternalOrigin,
        demoWebId,
        defaultDemoIdentityWebId,
        demoIdentityOptions,
        subjectIdentityOptions,
        allowedDemoWebIds: [...allowedDemoWebIds],
        allowedSubjectLoginWebIds: [...allowedSubjectLoginWebIds],
        jwe: {
          activeKid: sovereignJweActiveKeyId,
          revokedKids: [...sovereignJweRevokedKidSet]
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/subject-identities') {
      json(res, 200, {
        ok: true,
        defaultDemoIdentityWebId,
        subjectIdentityOptions
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/login-webid') {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const bodyError = requireObjectBody(body, 'login-webid');
      if (bodyError) {
        json(res, 400, { ok: false, error: bodyError });
        return;
      }
      const webId = String(body.webId || '').trim();
      if (!webId) {
        json(res, 400, { ok: false, error: 'webId is required' });
        return;
      }
      if (!isLikelyWebId(webId)) {
        json(res, 400, { ok: false, error: 'webId must be a valid http(s) WebID URL' });
        return;
      }
      if (!allowedSubjectLoginWebIds.has(webId) && !isEmergencyJohnDoeWebId(webId)) {
        json(res, 403, { ok: false, error: 'webId is not an approved sovereign identity for this demo environment' });
        return;
      }
      const identityCheck = await verifyIdentityCredentialForLogin(webId);
      const matchedCredentialType = identityCheck.ok ? (identityCheck.matchedCredentialType || null) : null;
      const verificationMode = identityCheck.ok ? (identityCheck.mode || 'credential_bound_webid_login') : 'allowlisted_demo_identity_login';
      const session = createSession(webId);
      json(res, 200, {
        ok: true,
        token: session.token,
        authenticatedWebId: webId,
        subjectDid: deriveSubjectDidFromWebId(webId),
        verification: {
          authorized: true,
          mode: verificationMode
        },
        matchedCredentialType,
        expiresInSeconds: Math.floor(explorerSessionTtlMs / 1000)
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/jwe-key-status') {
      json(res, 200, {
        ok: true,
        activeKid: sovereignJweActiveKeyId,
        revokedKids: [...sovereignJweRevokedKidSet]
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/demo/reset-data') {
      sharingPermissionsByWebId.clear();
      const sovereignCredentialReset = await resetSovereignDemoCredentials();
      json(res, 200, {
        ok: sovereignCredentialReset.ok,
        sharingPermissionsReset: true,
        sovereignCredentialReset
      });
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/audit/events')) {
      const session = getSession(req);
      if (!session) {
        json(res, 401, { ok: false, error: 'unauthorized' });
        return;
      }
      const url = new URL(req.url, `http://localhost:${port}`);
      const limitRaw = Number.parseInt(String(url.searchParams.get('limit') || '100'), 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;
      const events = serviceAuditEvents.slice(-limit).reverse();
      json(res, 200, {
        ok: true,
        authenticatedWebId: session.webId,
        totalEvents: serviceAuditEvents.length,
        returnedEvents: events.length,
        events
      });
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/credentials')) {
      const session = getSession(req);
      if (!session) {
        json(res, 401, { ok: false, error: 'unauthorized' });
        return;
      }
      const url = new URL(req.url, `http://localhost:${port}`);
      const requestedWebId = String(url.searchParams.get('webId') || '').trim();
      if (requestedWebId && normalizeMatchToken(requestedWebId) !== normalizeMatchToken(session.webId)) {
        json(res, 403, { ok: false, error: 'requested webId does not match authenticated session' });
        return;
      }
      const webId = session.webId;

      const credentialsRead = await readCredentials(webId);
      if (!credentialsRead.ok) {
        json(res, 502, credentialsRead);
        return;
      }
      const credentials = credentialsRead.credentials.map((entry) => entry.credential);

      json(res, 200, {
        ok: true,
        webId,
        walletUrl: credentialsRead.containerUrl,
        exists: credentialsRead.exists,
        credentialCount: credentials.length,
        credentials,
        resources: credentialsRead.credentials.map((entry) => entry.resourceUrl)
      });
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/browse')) {
      const session = getSession(req);
      if (!session) {
        json(res, 401, { ok: false, error: 'unauthorized' });
        return;
      }
      const url = new URL(req.url, `http://localhost:${port}`);
      const requestedWebId = String(url.searchParams.get('webId') || '').trim();
      if (requestedWebId && normalizeMatchToken(requestedWebId) !== normalizeMatchToken(session.webId)) {
        json(res, 403, { ok: false, error: 'requested webId does not match authenticated session' });
        return;
      }
      const webId = session.webId;
      const credentialsRead = await readCredentials(webId);
      if (!credentialsRead.ok) {
        json(res, 502, { ok: false, error: 'failed to browse selected identity resources', credentialsRead });
        return;
      }

      const uniqueLinks = [...new Set((credentialsRead.credentials || []).map((entry) => entry.resourceUrl))].sort();
      json(res, 200, {
        ok: true,
        webId,
        links: uniqueLinks,
        credentialResources: {
          ok: credentialsRead.ok,
          containerUrl: credentialsRead.containerUrl,
          credentialCount: credentialsRead.credentials ? credentialsRead.credentials.length : 0
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/sharing-permissions')) {
      const session = getSession(req);
      if (!session) {
        json(res, 401, { ok: false, error: 'unauthorized' });
        return;
      }
      const url = new URL(req.url, `http://localhost:${port}`);
      const requestedWebId = String(url.searchParams.get('webId') || '').trim();
      if (requestedWebId && normalizeMatchToken(requestedWebId) !== normalizeMatchToken(session.webId)) {
        json(res, 403, { ok: false, error: 'requested webId does not match authenticated session' });
        return;
      }
      const webId = session.webId;
      const list = ensureSharingPermissionList(webId);
      const permissions = [...list].sort((a, b) => (Date.parse(b.updatedAt || b.grantedAt || '') || 0) - (Date.parse(a.updatedAt || a.grantedAt || '') || 0));
      const activePermissionCount = permissions.filter((entry) => entry.status === 'active').length;
      json(res, 200, { ok: true, webId, activePermissionCount, permissions });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/sharing-permissions/grant') {
      const session = getSession(req);
      if (!session) {
        json(res, 401, { ok: false, error: 'unauthorized' });
        return;
      }
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const bodyError = requireObjectBody(body, 'sharing-permissions grant');
      if (bodyError) {
        json(res, 400, { ok: false, error: bodyError });
        return;
      }

      const requestedWebId = String(body.webId || '').trim();
      if (requestedWebId && normalizeMatchToken(requestedWebId) !== normalizeMatchToken(session.webId)) {
        json(res, 403, { ok: false, error: 'body webId does not match authenticated session' });
        return;
      }
      const webId = session.webId;
      const providerDid = String(body.providerDid || '').trim();
      const accessPresetInput = String(body.accessPreset || 'everything').trim().toLowerCase();
      const accessPreset = allowedAccessPresets.has(accessPresetInput) ? accessPresetInput : 'everything';
      if (!providerDid) {
        json(res, 400, { ok: false, error: 'providerDid is required' });
        return;
      }
      if (!isLikelyDid(providerDid)) {
        json(res, 400, { ok: false, error: 'providerDid must be a valid DID' });
        return;
      }
      if (body.allowedRecordTypes !== undefined && !(typeof body.allowedRecordTypes === 'string' || Array.isArray(body.allowedRecordTypes))) {
        json(res, 400, { ok: false, error: 'allowedRecordTypes must be a comma-separated string or array when provided' });
        return;
      }
      if (body.allowedRecordIds !== undefined && !(typeof body.allowedRecordIds === 'string' || Array.isArray(body.allowedRecordIds))) {
        json(res, 400, { ok: false, error: 'allowedRecordIds must be a comma-separated string or array when provided' });
        return;
      }

      const idempotencyKey = parseIdempotencyKey(req, body);
      if (idempotencyKey) {
        const cacheKey = `sharing-grant:${webId}:${providerDid}:${idempotencyKey}`;
        const cached = readCachedIdempotentResponse(cacheKey);
        if (cached) {
          json(res, cached.status, {
            ...(cached.payload && typeof cached.payload === 'object' ? cached.payload : {}),
            idempotency: { key: idempotencyKey, replayed: true }
          });
          return;
        }
        res.__idempotencyCacheKey = cacheKey;
        res.__idempotencyMeta = { key: idempotencyKey, replayed: false };
      }

      const allowedRecordTypes = accessPreset === 'custom' ? parseCsvList(body.allowedRecordTypes) : [];
      const allowedRecordIds = accessPreset === 'custom' ? parseCsvList(body.allowedRecordIds) : [];
      const now = new Date().toISOString();
      const list = ensureSharingPermissionList(webId);
      const existing = list.find((entry) => entry.status === 'active' && entry.providerDid === providerDid);
      if (existing) {
        existing.accessPreset = accessPreset;
        existing.allowedRecordTypes = allowedRecordTypes;
        existing.allowedRecordIds = allowedRecordIds;
        existing.updatedAt = now;
        json(res, 200, {
          ok: true,
          webId,
          providerDid,
          updated: true,
          permission: existing,
          activePermissionCount: list.filter((entry) => entry.status === 'active').length
        });
        return;
      }

      const permission = {
        id: `share-${crypto.randomUUID()}`,
        webId,
        providerDid,
        accessPreset,
        allowedRecordTypes,
        allowedRecordIds,
        status: 'active',
        grantedAt: now,
        updatedAt: now
      };
      list.push(permission);
      json(res, 200, {
        ok: true,
        webId,
        providerDid,
        updated: false,
        permission,
        activePermissionCount: list.filter((entry) => entry.status === 'active').length
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/sharing-permissions/revoke') {
      const session = getSession(req);
      if (!session) {
        json(res, 401, { ok: false, error: 'unauthorized' });
        return;
      }
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const bodyError = requireObjectBody(body, 'sharing-permissions revoke');
      if (bodyError) {
        json(res, 400, { ok: false, error: bodyError });
        return;
      }

      const requestedWebId = String(body.webId || '').trim();
      if (requestedWebId && normalizeMatchToken(requestedWebId) !== normalizeMatchToken(session.webId)) {
        json(res, 403, { ok: false, error: 'body webId does not match authenticated session' });
        return;
      }
      const webId = session.webId;
      const providerDid = String(body.providerDid || '').trim();
      if (!providerDid) {
        json(res, 400, { ok: false, error: 'providerDid is required' });
        return;
      }
      if (!isLikelyDid(providerDid)) {
        json(res, 400, { ok: false, error: 'providerDid must be a valid DID' });
        return;
      }

      const idempotencyKey = parseIdempotencyKey(req, body);
      if (idempotencyKey) {
        const cacheKey = `sharing-revoke:${webId}:${providerDid}:${idempotencyKey}`;
        const cached = readCachedIdempotentResponse(cacheKey);
        if (cached) {
          json(res, cached.status, {
            ...(cached.payload && typeof cached.payload === 'object' ? cached.payload : {}),
            idempotency: { key: idempotencyKey, replayed: true }
          });
          return;
        }
        res.__idempotencyCacheKey = cacheKey;
        res.__idempotencyMeta = { key: idempotencyKey, replayed: false };
      }

      const now = new Date().toISOString();
      const list = ensureSharingPermissionList(webId);
      let revokedCount = 0;
      for (const entry of list) {
        if (entry.status !== 'active') continue;
        if (entry.providerDid !== providerDid) continue;
        entry.status = 'revoked';
        entry.revokedAt = now;
        entry.updatedAt = now;
        revokedCount += 1;
      }
      json(res, 200, {
        ok: true,
        webId,
        providerDid,
        revokedCount,
        activePermissionCount: list.filter((entry) => entry.status === 'active').length
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/decrypt-shared-envelope') {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const bodyError = requireObjectBody(body, 'decrypt-shared-envelope');
      if (bodyError) {
        json(res, 400, { ok: false, error: bodyError });
        return;
      }
      const webId = String(body.webId || '').trim();
      const envelope = body.envelope;
      if (!webId) {
        json(res, 400, { ok: false, error: 'webId is required' });
        return;
      }
      if (!isLikelyWebId(webId)) {
        json(res, 400, { ok: false, error: 'webId must be a valid http(s) WebID URL' });
        return;
      }
      if (!allowedDemoWebIds.has(webId) && !isEmergencyJohnDoeWebId(webId)) {
        json(res, 403, { ok: false, error: 'only configured sovereign identities may decrypt shared envelopes' });
        return;
      }
      if (!envelope || typeof envelope !== 'object') {
        json(res, 400, { ok: false, error: 'envelope object is required' });
        return;
      }
      if (!envelope.protected || !envelope.iv || !envelope.tag || !envelope.ciphertext) {
        json(res, 400, { ok: false, error: 'envelope must include protected, iv, tag, and ciphertext' });
        return;
      }

      const payload = decryptSovereignSealedEnvelope(envelope);
      json(res, 200, {
        ok: true,
        webId,
        decrypted: payload,
        context: envelope.context || null
      });
      return;
    }

    json(res, 404, { ok: false, error: 'not found' });
  } catch (error) {
    json(res, 500, { ok: false, error: String(error && error.message ? error.message : error) });
  }
});

server.listen(port, () => {
  console.log(`Credential Explorer listening on ${port} (sovereign origin ${sovereignInternalOrigin})`);
});
