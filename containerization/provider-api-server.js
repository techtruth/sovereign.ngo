'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const subtle = crypto.webcrypto && crypto.webcrypto.subtle;

const PORT = Number(process.env.PORT || 8080);
const PROVIDER_ID = String(process.env.PROVIDER_ID || '').trim() || 'unknown_provider';
const PROVIDER_DID = String(process.env.PROVIDER_DID || '').trim();
const PROVIDER_LABEL = String(process.env.PROVIDER_LABEL || PROVIDER_ID).trim();
const PROVIDER_TYPE = String(process.env.PROVIDER_TYPE || '').trim();
const PROVIDER_POD_URL = String(process.env.PROVIDER_POD_URL || '').trim();
const PROVIDER_API_SHARED_SECRET = String(process.env.PROVIDER_API_SHARED_SECRET || '').trim();
const TLS_CERT_PATH = String(process.env.TLS_CERT_PATH || '/etc/sovereign/tls/internal.crt').trim();
const TLS_KEY_PATH = String(process.env.TLS_KEY_PATH || '/etc/sovereign/tls/internal.key').trim();
const AUDIT_LOG_DIR = String(process.env.AUDIT_LOG_DIR || '/var/lib/sovereign').trim();
const AUDIT_LOG_PATH = String(process.env.AUDIT_LOG_PATH || path.join(AUDIT_LOG_DIR, `${PROVIDER_ID}.audit.jsonl`)).trim();
const MAX_AUDIT_ENTRIES = 1200;
const MAX_REPLAY_ENTRIES = Number(process.env.MAX_REPLAY_ENTRIES || 8000);
const CLOCK_SKEW_SECONDS = 120;
const GATEWAY_SENTINEL_HEADER = 'x-gateway-proxy';
const GATEWAY_SENTINEL_VALUE = 'sovereign-gateway';

const VC_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
const STATUS_LIST_ENTRY_TYPE = 'StatusList2021Entry';
const STATUS_LIST_PURPOSE = 'revocation';
const STATUS_LIST_BASE_URL = 'https://demo.sovereign.ngo/vc/status-lists/';

if (!subtle) {
  console.error('[provider-api] WebCrypto subtle API is required.');
  process.exit(1);
}
if (!PROVIDER_API_SHARED_SECRET) {
  console.error('[provider-api] PROVIDER_API_SHARED_SECRET is required.');
  process.exit(1);
}
if (!PROVIDER_DID) {
  console.error('[provider-api] PROVIDER_DID is required.');
  process.exit(1);
}

const nowIso = () => new Date().toISOString();
const requestAudit = [];
const holderSigningKeyRegistry = new Map();
const issuerSigningKeyRegistry = new Map();
const replayByTokenHash = new Map();
const replayByNonceKey = new Map();
let auditTipHash = crypto.createHash('sha256').update(`provider-api:${PROVIDER_ID}:genesis`).digest('hex');

const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const summarizeError = (error) => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string' && error.message) return error.message;
  return String(error);
};

const fromBase64Url = (input) => {
  const normalized = toSafeString(input);
  if (!normalized) return Buffer.alloc(0);
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
};

const parseJsonBase64Url = (input) => {
  const raw = fromBase64Url(input).toString('utf8');
  return JSON.parse(raw);
};

const audMatches = (payloadAud, expectedAud) => {
  if (!expectedAud) return true;
  if (Array.isArray(payloadAud)) {
    return payloadAud.map((entry) => toSafeString(entry)).includes(expectedAud);
  }
  return toSafeString(payloadAud) === expectedAud;
};

const timingSafeEquals = (left, right) => {
  const leftBuffer = Buffer.from(toSafeString(left));
  const rightBuffer = Buffer.from(toSafeString(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const digestHex = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const parseBearerToken = (req) => {
  const authorization = toSafeString(req.headers.authorization);
  if (!authorization.startsWith('Bearer ')) return '';
  return toSafeString(authorization.slice('Bearer '.length));
};

const parseUrl = (req) => {
  const host = req.headers.host || 'localhost';
  const scheme = req.socket && req.socket.encrypted ? 'https' : 'http';
  return new URL(req.url || '/', `${scheme}://${host}`);
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

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload || {});
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(body);
};

const providerEnvelope = {
  providerId: PROVIDER_ID,
  providerDid: PROVIDER_DID,
  providerLabel: PROVIDER_LABEL,
  providerType: PROVIDER_TYPE,
  providerPodUrl: PROVIDER_POD_URL
};

const sanitizePublicJwk = (jwk) => {
  const candidate = isObject(jwk) ? jwk : null;
  if (!candidate) return null;
  const normalized = {
    kty: toSafeString(candidate.kty),
    crv: toSafeString(candidate.crv),
    x: toSafeString(candidate.x),
    kid: toSafeString(candidate.kid),
    alg: 'EdDSA',
    key_ops: ['verify']
  };
  if (normalized.kty !== 'OKP' || normalized.crv !== 'Ed25519' || !normalized.x) return null;
  return normalized;
};

const publicJwkFingerprint = (publicJwk) => {
  if (!publicJwk) return '';
  return digestHex(`${publicJwk.kty}|${publicJwk.crv}|${publicJwk.x}`);
};

const cloneWithoutProof = (credential) => {
  if (!isObject(credential)) return {};
  const cloned = JSON.parse(JSON.stringify(credential));
  if (isObject(cloned.proof)) {
    delete cloned.proof;
  }
  return cloned;
};

const issuerDidFromStatusListCredential = (statusListCredential) => {
  const raw = toSafeString(statusListCredential);
  if (!raw.startsWith(STATUS_LIST_BASE_URL)) return '';
  const encodedIssuerDid = raw.slice(STATUS_LIST_BASE_URL.length).split('#')[0].split('?')[0];
  if (!encodedIssuerDid) return '';
  try {
    return decodeURIComponent(encodedIssuerDid);
  } catch {
    return '';
  }
};

const verifyJwtEdDsa = async (jwt, options) => {
  const opts = options && typeof options === 'object' ? options : {};
  const raw = toSafeString(jwt);
  const parts = raw.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: 'vp_token must be a compact JWT with 3 segments.' };
  }

  let header;
  let payload;
  try {
    header = parseJsonBase64Url(parts[0]);
    payload = parseJsonBase64Url(parts[1]);
  } catch {
    return { ok: false, error: 'vp_token header/payload must be valid base64url JSON.' };
  }

  if (toSafeString(header.alg) !== 'EdDSA') {
    return { ok: false, error: 'vp_token alg must be EdDSA.' };
  }
  const expectedTyp = toSafeString(opts.expectedTyp || 'vp+jwt');
  if (expectedTyp && toSafeString(header.typ) !== expectedTyp) {
    return { ok: false, error: `vp_token typ must be ${expectedTyp}.` };
  }

  const publicJwk = sanitizePublicJwk(header.jwk);
  if (!publicJwk) {
    return { ok: false, error: 'vp_token header.jwk must contain a valid Ed25519 public JWK.' };
  }

  let verifyKey;
  try {
    verifyKey = await subtle.importKey('jwk', publicJwk, { name: 'Ed25519' }, false, ['verify']);
  } catch {
    return { ok: false, error: 'vp_token public key import failed.' };
  }

  let signatureBytes;
  try {
    signatureBytes = fromBase64Url(parts[2]);
  } catch {
    return { ok: false, error: 'vp_token signature is invalid base64url.' };
  }

  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
  const verified = await subtle.verify('Ed25519', verifyKey, signatureBytes, signingInput);
  if (!verified) {
    return { ok: false, error: 'vp_token signature verification failed.' };
  }

  const signerDid = toSafeString(payload.sub) || toSafeString(payload.iss);
  if (!signerDid) {
    return { ok: false, error: 'vp_token must include sub or iss.' };
  }
  const kid = toSafeString(header.kid);
  if (kid && !kid.startsWith(`${signerDid}#`)) {
    return { ok: false, error: 'vp_token kid must be scoped to signer DID.' };
  }

  const now = Math.floor(Date.now() / 1000);
  const iat = Number(payload.iat);
  const nbf = Number(payload.nbf);
  const exp = Number(payload.exp);
  if (Number.isFinite(iat) && iat > now + CLOCK_SKEW_SECONDS) {
    return { ok: false, error: 'vp_token iat is in the future beyond tolerance.' };
  }
  if (Number.isFinite(nbf) && nbf > now + CLOCK_SKEW_SECONDS) {
    return { ok: false, error: 'vp_token nbf is in the future beyond tolerance.' };
  }
  if (!Number.isFinite(exp) || exp <= now - CLOCK_SKEW_SECONDS) {
    return { ok: false, error: 'vp_token exp is missing or expired.' };
  }

  const expectedAudience = toSafeString(opts.expectedAudience);
  if (!audMatches(payload.aud, expectedAudience)) {
    return { ok: false, error: `vp_token aud must be ${expectedAudience}.` };
  }

  return {
    ok: true,
    header,
    payload,
    signerDid,
    publicJwk,
    publicKeyFingerprint: publicJwkFingerprint(publicJwk)
  };
};

const verifyVcProofJwt = async (vc, options) => {
  const opts = options && typeof options === 'object' ? options : {};
  const credential = isObject(vc) ? vc : null;
  if (!credential) {
    return { ok: false, error: 'VC proof verification requires a VC object.' };
  }

  const proof = isObject(credential.proof) ? credential.proof : null;
  const proofJwt = toSafeString(proof && proof.jwt);
  if (!proofJwt) {
    return { ok: false, error: 'VC proof.jwt is required.' };
  }

  const parts = proofJwt.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: 'VC proof.jwt must be a compact JWT with 3 segments.' };
  }

  let header;
  let payload;
  try {
    header = parseJsonBase64Url(parts[0]);
    payload = parseJsonBase64Url(parts[1]);
  } catch {
    return { ok: false, error: 'VC proof JWT header/payload must be valid base64url JSON.' };
  }

  if (toSafeString(header.alg) !== 'EdDSA') {
    return { ok: false, error: 'VC proof JWT alg must be EdDSA.' };
  }
  if (toSafeString(header.typ) !== 'vc+jwt') {
    return { ok: false, error: 'VC proof JWT typ must be vc+jwt.' };
  }

  const publicJwk = sanitizePublicJwk(header.jwk);
  if (!publicJwk) {
    return { ok: false, error: 'VC proof JWT header.jwk must contain a valid Ed25519 public JWK.' };
  }

  let verifyKey;
  try {
    verifyKey = await subtle.importKey('jwk', publicJwk, { name: 'Ed25519' }, false, ['verify']);
  } catch {
    return { ok: false, error: 'VC proof JWT public key import failed.' };
  }

  let signatureBytes;
  try {
    signatureBytes = fromBase64Url(parts[2]);
  } catch {
    return { ok: false, error: 'VC proof JWT signature is invalid base64url.' };
  }

  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
  const verified = await subtle.verify('Ed25519', verifyKey, signatureBytes, signingInput);
  if (!verified) {
    return { ok: false, error: 'VC proof JWT signature verification failed.' };
  }

  const now = Math.floor(Date.now() / 1000);
  const iat = Number(payload.iat);
  const nbf = Number(payload.nbf);
  const exp = Number(payload.exp);
  if (Number.isFinite(iat) && iat > now + CLOCK_SKEW_SECONDS) {
    return { ok: false, error: 'VC proof JWT iat is in the future beyond tolerance.' };
  }
  if (Number.isFinite(nbf) && nbf > now + CLOCK_SKEW_SECONDS) {
    return { ok: false, error: 'VC proof JWT nbf is in the future beyond tolerance.' };
  }
  if (!Number.isFinite(exp) || exp <= now - CLOCK_SKEW_SECONDS) {
    return { ok: false, error: 'VC proof JWT exp is missing or expired.' };
  }

  const expectedAudience = toSafeString(opts.expectedAudience);
  if (!audMatches(payload.aud, expectedAudience)) {
    return { ok: false, error: `VC proof JWT aud must be ${expectedAudience}.` };
  }

  const issuerDid = isObject(credential.issuer) ? toSafeString(credential.issuer.id) : '';
  const subjectDid = isObject(credential.credentialSubject) ? toSafeString(credential.credentialSubject.id) : '';
  const credentialId = toSafeString(credential.id);
  if (!issuerDid || !subjectDid || !credentialId) {
    return { ok: false, error: 'VC must include issuer.id, credentialSubject.id, and id.' };
  }

  if (toSafeString(payload.iss) !== issuerDid) {
    return { ok: false, error: 'VC proof JWT iss must match VC issuer.id.' };
  }
  if (toSafeString(payload.sub) !== subjectDid) {
    return { ok: false, error: 'VC proof JWT sub must match VC credentialSubject.id.' };
  }
  if (toSafeString(payload.jti) !== credentialId) {
    return { ok: false, error: 'VC proof JWT jti must match VC id.' };
  }

  const canonicalCredential = cloneWithoutProof(credential);
  const expectedCredentialHash = digestHex(JSON.stringify(canonicalCredential));
  if (toSafeString(payload.vc_hash) !== expectedCredentialHash) {
    return { ok: false, error: 'VC proof JWT vc_hash does not match credential contents.' };
  }

  const statusListCredential = toSafeString(credential.credentialStatus && credential.credentialStatus.statusListCredential);
  const statusListIndex = Number(credential.credentialStatus && credential.credentialStatus.statusListIndex);
  if (toSafeString(payload.status_list_credential) !== statusListCredential) {
    return { ok: false, error: 'VC proof JWT status_list_credential does not match credentialStatus.' };
  }
  if (Number(payload.status_list_index) !== statusListIndex) {
    return { ok: false, error: 'VC proof JWT status_list_index does not match credentialStatus.' };
  }

  const kid = toSafeString(header.kid);
  if (kid && !kid.startsWith(`${issuerDid}#`)) {
    return { ok: false, error: 'VC proof JWT kid must be scoped to VC issuer DID.' };
  }

  return {
    ok: true,
    issuerDid,
    keyFingerprint: publicJwkFingerprint(publicJwk)
  };
};

const verifyAuditRowHash = (row, expectedPrevHash) => {
  if (!isObject(row)) return false;
  const prevHash = toSafeString(row.prevHash);
  const hash = toSafeString(row.hash);
  if (!prevHash || !hash) return false;
  if (prevHash !== expectedPrevHash) return false;
  const canonicalRow = { ...row };
  delete canonicalRow.hash;
  const recomputed = digestHex(`${prevHash}|${JSON.stringify(canonicalRow)}`);
  return recomputed === hash;
};

const replayNonceKeyForHolder = (holderDid, nonce) => {
  const holder = toSafeString(holderDid);
  const normalizedNonce = toSafeString(nonce);
  if (!holder || !normalizedNonce) return '';
  return `${holder}|${normalizedNonce}`;
};

const dropReplayEntryByTokenHash = (tokenHash) => {
  const normalizedTokenHash = toSafeString(tokenHash);
  if (!normalizedTokenHash) return;
  const row = replayByTokenHash.get(normalizedTokenHash);
  if (!row) return;
  replayByTokenHash.delete(normalizedTokenHash);
  const nonceKey = toSafeString(row.nonceKey);
  if (nonceKey) {
    const nonceRow = replayByNonceKey.get(nonceKey);
    if (nonceRow && nonceRow.tokenHash === normalizedTokenHash) {
      replayByNonceKey.delete(nonceKey);
    }
  }
};

const pruneReplayEntries = (nowSec) => {
  const now = Number.isFinite(Number(nowSec)) ? Math.floor(Number(nowSec)) : Math.floor(Date.now() / 1000);
  for (const [tokenHash, row] of replayByTokenHash.entries()) {
    const expiresAtSec = Number(row && row.expiresAtSec);
    if (!Number.isFinite(expiresAtSec) || expiresAtSec > now) continue;
    dropReplayEntryByTokenHash(tokenHash);
  }
};

const trimReplayEntries = () => {
  const maxEntries = Number.isFinite(MAX_REPLAY_ENTRIES) && MAX_REPLAY_ENTRIES > 0
    ? Math.floor(MAX_REPLAY_ENTRIES)
    : 8000;
  while (replayByTokenHash.size > maxEntries) {
    const oldestTokenHash = replayByTokenHash.keys().next().value;
    if (!oldestTokenHash) break;
    dropReplayEntryByTokenHash(oldestTokenHash);
  }
};

const claimReplayEntry = ({ tokenHash, nonceKey, holderDid, exp }) => {
  const normalizedTokenHash = toSafeString(tokenHash);
  const normalizedNonceKey = toSafeString(nonceKey);
  const normalizedHolderDid = toSafeString(holderDid);
  const expSec = Number(exp);
  const nowSec = Math.floor(Date.now() / 1000);
  pruneReplayEntries(nowSec);

  if (!normalizedTokenHash || !normalizedNonceKey || !normalizedHolderDid || !Number.isFinite(expSec)) {
    return { ok: false, error: 'Replay guard requires token hash, nonce key, holder DID, and exp.' };
  }
  if (replayByTokenHash.has(normalizedTokenHash)) {
    return { ok: false, error: 'Replay detected: vp_token hash has already been submitted.' };
  }
  if (replayByNonceKey.has(normalizedNonceKey)) {
    return { ok: false, error: 'Replay detected: nonce has already been used for this holder.' };
  }

  const row = {
    tokenHash: normalizedTokenHash,
    nonceKey: normalizedNonceKey,
    holderDid: normalizedHolderDid,
    createdAt: nowIso(),
    status: 'pending',
    expiresAtSec: Math.max(Math.floor(expSec) + CLOCK_SKEW_SECONDS, nowSec + CLOCK_SKEW_SECONDS)
  };
  replayByTokenHash.set(normalizedTokenHash, row);
  replayByNonceKey.set(normalizedNonceKey, row);
  trimReplayEntries();
  return { ok: true };
};

const commitReplayEntry = (tokenHash) => {
  const normalizedTokenHash = toSafeString(tokenHash);
  if (!normalizedTokenHash) return;
  const row = replayByTokenHash.get(normalizedTokenHash);
  if (!row) return;
  row.status = 'committed';
  row.committedAt = nowIso();
};

const releaseReplayEntry = (tokenHash) => {
  dropReplayEntryByTokenHash(tokenHash);
};

const loadAuditFromDisk = () => {
  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG_PATH), { recursive: true });
    if (!fs.existsSync(AUDIT_LOG_PATH)) return;

    const raw = fs.readFileSync(AUDIT_LOG_PATH, 'utf8');
    const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
    const chronological = [];
    let expectedPrevHash = auditTipHash;

    lines.forEach((line, index) => {
      let row = null;
      try {
        row = JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSON at line ${index + 1}.`);
      }
      if (!verifyAuditRowHash(row, expectedPrevHash)) {
        throw new Error(`Audit hash mismatch at line ${index + 1}.`);
      }
      expectedPrevHash = toSafeString(row.hash);
      chronological.push(row);
    });

    auditTipHash = expectedPrevHash;
    chronological.reverse().slice(0, MAX_AUDIT_ENTRIES).forEach((row) => requestAudit.push(row));
  } catch (error) {
    console.error(`[provider-api] Failed to load audit log ${AUDIT_LOG_PATH}: ${summarizeError(error)}`);
    process.exit(1);
  }
};

const appendAuditToDisk = (row) => {
  fs.appendFileSync(AUDIT_LOG_PATH, `${JSON.stringify(row)}\n`, 'utf8');
};

const pushAudit = (entry) => {
  const row = {
    at: nowIso(),
    providerId: PROVIDER_ID,
    providerType: PROVIDER_TYPE,
    ...entry
  };
  row.prevHash = auditTipHash;
  row.hash = digestHex(`${row.prevHash}|${JSON.stringify(row)}`);
  auditTipHash = row.hash;
  appendAuditToDisk(row);

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

const validatePresentationEnvelope = async (payload) => {
  if (!isObject(payload)) {
    return { ok: false, error: 'Envelope must be a JSON object.' };
  }

  const vpToken = toSafeString(payload.vp_token);
  if (!vpToken) {
    return { ok: false, error: 'vp_token is required.' };
  }

  const vpTokenVerification = await verifyJwtEdDsa(vpToken, {
    expectedAudience: PROVIDER_DID,
    expectedTyp: 'vp+jwt'
  });
  if (!vpTokenVerification.ok) {
    return { ok: false, error: vpTokenVerification.error || 'vp_token failed cryptographic verification.' };
  }

  const vpPayload = vpTokenVerification.payload;
  const presentation = isObject(vpPayload.vp) ? vpPayload.vp : null;
  if (!presentation) {
    return { ok: false, error: 'vp_token payload must include vp object.' };
  }

  const contexts = Array.isArray(presentation['@context']) ? presentation['@context'].map(toSafeString) : [];
  if (!contexts.includes(VC_CONTEXT)) {
    return { ok: false, error: 'Presentation is missing VC context.' };
  }

  const types = Array.isArray(presentation.type) ? presentation.type.map(toSafeString) : [];
  if (!types.includes('VerifiablePresentation')) {
    return { ok: false, error: 'Presentation type must include VerifiablePresentation.' };
  }

  const holder = toSafeString(presentation.holder);
  if (!holder) {
    return { ok: false, error: 'Presentation holder is required.' };
  }
  if (vpTokenVerification.signerDid !== holder) {
    return { ok: false, error: 'vp_token signer must match presentation holder.' };
  }

  const knownFingerprint = holderSigningKeyRegistry.get(holder) || '';
  if (knownFingerprint && knownFingerprint !== vpTokenVerification.publicKeyFingerprint) {
    return { ok: false, error: 'Holder signing key mismatch for this DID.' };
  }
  holderSigningKeyRegistry.set(holder, vpTokenVerification.publicKeyFingerprint);

  const challengeFromEnvelope = isObject(payload.request) ? toSafeString(payload.request.challenge) : '';
  const nonceFromToken = toSafeString(vpPayload.nonce);
  if (!nonceFromToken) {
    return { ok: false, error: 'vp_token nonce is required.' };
  }
  if (challengeFromEnvelope && nonceFromToken && challengeFromEnvelope !== nonceFromToken) {
    return { ok: false, error: 'Presentation challenge must match vp_token nonce.' };
  }

  const vpTokenHash = digestHex(vpToken);
  const nonceKey = replayNonceKeyForHolder(holder, nonceFromToken);
  const replayClaim = claimReplayEntry({
    tokenHash: vpTokenHash,
    nonceKey,
    holderDid: holder,
    exp: vpPayload.exp
  });
  if (!replayClaim.ok) {
    return { ok: false, error: replayClaim.error || 'Replay protection rejected this presentation.' };
  }

  let replayCommitted = false;
  const vcRows = Array.isArray(presentation.verifiableCredential)
    ? presentation.verifiableCredential.filter((entry) => isObject(entry))
    : [];
  const credentialErrors = [];

  try {
    for (let index = 0; index < vcRows.length; index += 1) {
      const vc = vcRows[index];
      const vcContexts = Array.isArray(vc['@context']) ? vc['@context'].map(toSafeString) : [];
      const vcTypes = Array.isArray(vc.type) ? vc.type.map(toSafeString) : [];
      const issuerId = isObject(vc.issuer) ? toSafeString(vc.issuer.id) : '';
      const subjectId = isObject(vc.credentialSubject) ? toSafeString(vc.credentialSubject.id) : '';
      if (!vcContexts.includes(VC_CONTEXT)) {
        credentialErrors.push(`Credential ${index} missing VC context.`);
      }
      if (!vcTypes.includes('VerifiableCredential')) {
        credentialErrors.push(`Credential ${index} missing VerifiableCredential type.`);
      }
      if (!toSafeString(vc.id)) {
        credentialErrors.push(`Credential ${index} missing id.`);
      }
      if (!issuerId) {
        credentialErrors.push(`Credential ${index} missing issuer.id.`);
      }
      if (!subjectId) {
        credentialErrors.push(`Credential ${index} missing credentialSubject.id.`);
      }
      if (!isObject(vc.credentialStatus)) {
        credentialErrors.push(`Credential ${index} missing credentialStatus.`);
        continue;
      }
      const statusListType = toSafeString(vc.credentialStatus.type);
      const statusPurpose = toSafeString(vc.credentialStatus.statusPurpose);
      const statusListCredential = toSafeString(vc.credentialStatus.statusListCredential);
      const statusListIndex = Number(vc.credentialStatus.statusListIndex);
      if (statusListType !== STATUS_LIST_ENTRY_TYPE) {
        credentialErrors.push(`Credential ${index} has invalid credentialStatus.type.`);
      }
      if (statusPurpose !== STATUS_LIST_PURPOSE) {
        credentialErrors.push(`Credential ${index} has invalid credentialStatus.statusPurpose.`);
      }
      if (!statusListCredential) {
        credentialErrors.push(`Credential ${index} missing credentialStatus.statusListCredential.`);
      }
      if (statusListCredential && !statusListCredential.startsWith(STATUS_LIST_BASE_URL)) {
        credentialErrors.push(`Credential ${index} must use demo.sovereign.ngo status list credential URL.`);
      }
      if (!Number.isFinite(statusListIndex) || statusListIndex < 0) {
        credentialErrors.push(`Credential ${index} has invalid credentialStatus.statusListIndex.`);
      }
      const statusListIssuerDid = issuerDidFromStatusListCredential(statusListCredential);
      if (!statusListIssuerDid || statusListIssuerDid !== issuerId) {
        credentialErrors.push(`Credential ${index} status list issuer must match credential issuer.`);
      }

      const vcProofVerification = await verifyVcProofJwt(vc, {
        expectedAudience: PROVIDER_DID
      });
      if (!vcProofVerification.ok) {
        credentialErrors.push(`Credential ${index} proof verification failed: ${vcProofVerification.error}`);
        continue;
      }

      const knownIssuerKeyFingerprint = issuerSigningKeyRegistry.get(vcProofVerification.issuerDid) || '';
      if (knownIssuerKeyFingerprint && knownIssuerKeyFingerprint !== vcProofVerification.keyFingerprint) {
        credentialErrors.push(`Credential ${index} issuer signing key mismatch for ${vcProofVerification.issuerDid}.`);
        continue;
      }
      issuerSigningKeyRegistry.set(vcProofVerification.issuerDid, vcProofVerification.keyFingerprint);
    }

    if (credentialErrors.length) {
      return {
        ok: false,
        error: credentialErrors.join(' ')
      };
    }

    commitReplayEntry(vpTokenHash);
    replayCommitted = true;

    return {
      ok: true,
      holder,
      signerDid: vpTokenVerification.signerDid,
      signerKeyFingerprint: vpTokenVerification.publicKeyFingerprint,
      credentialCount: vcRows.length,
      credentialIds: vcRows.map((vc) => toSafeString(vc.id)).filter(Boolean),
      exchangeType: toSafeString(payload.exchangeType) || 'service-event',
      challenge: challengeFromEnvelope || nonceFromToken,
      domain: isObject(payload.request) ? toSafeString(payload.request.domain) : '',
      serviceContext: isObject(payload.serviceContext) ? payload.serviceContext : {},
      vpTokenHash
    };
  } finally {
    if (!replayCommitted) {
      releaseReplayEntry(vpTokenHash);
    }
  }
};

const unauthorizedApiResponse = (res) => {
  sendJson(res, 401, {
    ok: false,
    error: 'Unauthorized API request.',
    ...providerEnvelope
  });
};

const requestHandler = async (req, res) => {
  const method = String(req.method || 'GET').toUpperCase();
  const url = parseUrl(req);
  const requestPath = url.pathname;

  if (method === 'GET' && requestPath === '/health') {
    pruneReplayEntries(Math.floor(Date.now() / 1000));
    sendJson(res, 200, {
      ok: true,
      ...providerEnvelope,
      auditEntries: requestAudit.length,
      replayEntries: replayByTokenHash.size,
      auditTipHash,
      now: nowIso()
    });
    return;
  }

  if (requestPath.startsWith('/api/')) {
    const gatewayMarker = toSafeString(req.headers[GATEWAY_SENTINEL_HEADER]);
    if (gatewayMarker !== GATEWAY_SENTINEL_VALUE) {
      unauthorizedApiResponse(res);
      return;
    }
    const bearerToken = parseBearerToken(req);
    if (!bearerToken || !timingSafeEquals(bearerToken, PROVIDER_API_SHARED_SECRET)) {
      unauthorizedApiResponse(res);
      return;
    }
  }

  if (method === 'GET' && requestPath === '/api/info') {
    pruneReplayEntries(Math.floor(Date.now() / 1000));
    sendJson(res, 200, {
      ok: true,
      ...providerEnvelope,
      replayEntries: replayByTokenHash.size,
      auditTipHash,
      now: nowIso()
    });
    return;
  }

  if (method === 'GET' && requestPath === '/api/audit/log') {
    const requestedLimit = Number(url.searchParams.get('limit') || 80);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), 500)
      : 80;
    sendJson(res, 200, {
      ok: true,
      ...providerEnvelope,
      auditTipHash,
      count: Math.min(limit, requestAudit.length),
      rows: requestAudit.slice(0, limit)
    });
    return;
  }

  if (method !== 'POST' || !requestPath.startsWith('/api/')) {
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

  if (requestPath === '/api/presentations/submit') {
    const validation = await validatePresentationEnvelope(payload);
    if (!validation.ok) {
      sendJson(res, 400, {
        ok: false,
        error: validation.error || 'Invalid presentation envelope.',
        ...providerEnvelope
      });
      return;
    }

    pushAudit({
      kind: `vp_${validation.exchangeType}`,
      direction: 'inbound',
      holder: validation.holder,
      signerDid: validation.signerDid,
      signerKeyFingerprint: validation.signerKeyFingerprint,
      challenge: validation.challenge,
      domain: validation.domain,
      credentialCount: validation.credentialCount,
      credentialIds: validation.credentialIds,
      serviceContext: validation.serviceContext,
      vpTokenHash: validation.vpTokenHash
    });

    sendJson(res, 200, {
      ok: true,
      recorded: 'verifiable_presentation',
      exchangeType: validation.exchangeType,
      holder: validation.holder,
      signerDid: validation.signerDid,
      credentialCount: validation.credentialCount,
      credentialIds: validation.credentialIds,
      challenge: validation.challenge,
      domain: validation.domain,
      auditTipHash,
      ...providerEnvelope
    });
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Unknown API route.',
    ...providerEnvelope
  });
};

const tryLoadTlsMaterial = () => {
  try {
    if (!TLS_CERT_PATH || !TLS_KEY_PATH) return null;
    if (!fs.existsSync(TLS_CERT_PATH) || !fs.existsSync(TLS_KEY_PATH)) return null;
    const cert = fs.readFileSync(TLS_CERT_PATH, 'utf8');
    const key = fs.readFileSync(TLS_KEY_PATH, 'utf8');
    if (!cert || !key) return null;
    return { cert, key };
  } catch {
    return null;
  }
};

loadAuditFromDisk();

const tlsMaterial = tryLoadTlsMaterial();
const server = tlsMaterial
  ? https.createServer(tlsMaterial, requestHandler)
  : http.createServer(requestHandler);

server.listen(PORT, () => {
  console.log(
    `[provider-api] listening on ${PORT} (${tlsMaterial ? 'https' : 'http'}) for ${PROVIDER_ID} (${PROVIDER_LABEL})` +
    ` audit=${AUDIT_LOG_PATH}` +
    (PROVIDER_POD_URL ? ` pod=${PROVIDER_POD_URL}` : '')
  );
});
