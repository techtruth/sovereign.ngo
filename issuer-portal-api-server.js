const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const port = Number(process.env.PORT || 3000);
const siteDir = process.env.SITE_DIR || 'doctors-office';
const solidPodUrl = process.env.SOLID_POD_URL || '';
const sovereignPodUrl = process.env.SOVEREIGN_POD_URL || 'http://holder_sovereign:3000/';
const sovereignInternalOrigin = process.env.SOVEREIGN_INTERNAL_ORIGIN || 'http://sovereign_gateway';
const demoWebId = process.env.DEMO_WEBID || 'http://holder_sovereign:3000/profile/card#me';
const sovereignJweKeyId = process.env.SOVEREIGN_JWE_KEY_ID || 'sovereign-x25519-2026-01';
const sovereignJwePublicKeyPem = process.env.SOVEREIGN_JWE_PUBLIC_KEY_PEM || `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VuAyEA3yhC17XK8kTPNz3LmHGMDwbIsgTtq9orDm0eKLnud0E=
-----END PUBLIC KEY-----`;
const indexPath = path.join(__dirname, 'issuer-sites', siteDir, 'index.html');
const templatePolicyPath = path.join(__dirname, 'issuer-policies', `${siteDir}.json`);

const issuerProfiles = {
  'doctors-office': {
    issuerName: 'Nolichucky Family Clinic',
    actions: [
      { id: 'issue_visit_credential', label: 'Issue Visit Credential', description: 'Generate a proof of clinical visit.' },
      { id: 'schedule_follow_up', label: 'Schedule Follow-Up', description: 'Create a follow-up appointment action record.' },
      { id: 'draw_blood', label: 'Draw Blood', description: 'Issue a signed bloodwork result credential.' },
      { id: 'request_xray', label: 'X-Ray', description: 'Authorize X-ray imaging (requires identity + self-presence).' },
      { id: 'issue_allergy_profile', label: 'Issue Allergy Profile', description: 'Issue a signed allergy profile credential.' }
    ],
    podData: {
      reports: ['patient-checkin-log', 'radiology-queue', 'blood-work-results', 'wellness-followups'],
      retentionPolicy: 'HIPAA-aligned local retention policy',
      lastSyncDate: '2026-03-20'
    }
  },
  'car-repair-shop': {
    issuerName: 'State of Franklin Auto Repair',
    actions: [
      { id: 'issue_service_record', label: 'Issue Service Record', description: 'Issue credential for completed service.' },
      { id: 'issue_safety_inspection', label: 'Issue Safety Inspection', description: 'Issue vehicle inspection credential.' },
      { id: 'create_repair_estimate', label: 'Create Repair Estimate', description: 'Create estimate action with credential receipt.' },
      { id: 'apply_for_employment', label: 'Apply For Employment', description: 'Hiring policy: requires Driver License OR Passport.' },
      { id: 'terminate_employment', label: 'Terminate Employment', description: 'End employment for logged-in subject.' },
      { id: 'issue_shop_access_badge', label: 'Issue Shop Access Badge', description: 'Issue signed shop-access credential.' },
      { id: 'revoke_access_badge', label: 'Revoke Access Badge', description: 'Revoke previously issued access credential.' },
      { id: 'verify_access_badge', label: 'Verify Access Badge', description: 'Verify if access credential is active or revoked.' }
    ],
    podData: {
      reports: ['inspection-log', 'repair-orders', 'parts-replacement-summary', 'employment-status-ledger', 'access-badge-revocations'],
      retentionPolicy: '7-year service history retention',
      lastSyncDate: '2026-03-21'
    }
  },
  'sports-park': {
    issuerName: 'Boone Lake Sports Park',
    actions: [
      { id: 'issue_membership_pass', label: 'Issue Membership Pass', description: 'Issue seasonal membership credential.' },
      { id: 'register_tournament_entry', label: 'Register Tournament Entry', description: 'Register athlete/team for tournament.' },
      { id: 'validate_coach_access', label: 'Validate Coach Access', description: 'Issue coach/volunteer access credential.' },
      { id: 'redeem_employee_season_ticket', label: 'Redeem Employee Season Ticket', description: 'Verify Buffalo Mountain Metal Works entitlement and issue game entry credential.' }
    ],
    podData: {
      reports: ['member-roster', 'tournament-enrollment', 'coach-clearance-list', 'employee-season-ticket-redemptions'],
      retentionPolicy: 'Season-based roster archival',
      lastSyncDate: '2026-03-19'
    }
  },
  'national-metal-works': {
    issuerName: 'Buffalo Mountain Metal Works',
    actions: [
      { id: 'issue_vendor_approval', label: 'Issue Vendor Approval', description: 'Issue approved-vendor credential.' },
      { id: 'issue_shipment_provenance', label: 'Issue Shipment Provenance', description: 'Issue shipment traceability credential.' },
      { id: 'issue_material_certificate', label: 'Issue Material Certificate', description: 'Issue materials quality certificate credential.' },
      { id: 'apply_for_employment', label: 'Apply For Employment', description: 'Hiring policy: requires Driver License OR Passport, plus ITAR.' },
      { id: 'terminate_employment', label: 'Terminate Employment', description: 'End employment for logged-in subject.' },
      { id: 'issue_employee_status', label: 'Issue Employee Status', description: 'Issue active employee status credential.' },
      { id: 'issue_season_ticket_entitlement', label: 'Issue Season Ticket Entitlement', description: 'Issue employee season-ticket benefit credential for Boone Lake Sports Park.' },
      { id: 'issue_facility_access_badge', label: 'Issue Facility Access Badge', description: 'Requires identity + ITAR + self-presence.' },
      { id: 'validate_employee_address_for_benefits', label: 'Validate Address For Benefits', description: 'Requires recent utility bill credential.' }
    ],
    podData: {
      reports: ['vendor-certification-ledger', 'shipment-provenance-index', 'material-compliance-records', 'employee-benefit-ledger'],
      retentionPolicy: 'Compliance archive retention for audits',
      lastSyncDate: '2026-03-22'
    }
  },
  'apple-seed-insurance': {
    issuerName: 'Apple Seed Insurance',
    actions: [
      { id: 'issue_policy_verification', label: 'Issue Policy Verification', description: 'Issue active policy verification credential.' },
      { id: 'issue_claim_intake_receipt', label: 'Issue Claim Intake Receipt', description: 'Issue claim intake receipt credential.' },
      { id: 'issue_benefit_eligibility', label: 'Issue Benefit Eligibility', description: 'Issue benefit eligibility decision credential.' }
    ],
    podData: {
      reports: ['policy-verification-ledger', 'claim-intake-ledger', 'benefit-eligibility-decisions'],
      retentionPolicy: 'Insurance records retention policy',
      lastSyncDate: '2026-03-25'
    }
  },
  'assistance-charity': {
    issuerName: 'Blue Ridge Assistance Network',
    actions: [
      { id: 'process_food_assistance', label: 'Process Food Assistance', description: 'Evaluate and issue food assistance decision credential.' },
      { id: 'process_housing_assistance', label: 'Process Housing Assistance', description: 'Evaluate and issue housing assistance decision credential.' },
      { id: 'issue_assistance_intake_receipt', label: 'Issue Intake Receipt', description: 'Issue assistance intake receipt credential.' }
    ],
    podData: {
      reports: ['assistance-intake-ledger', 'food-assistance-decisions', 'housing-assistance-decisions'],
      retentionPolicy: 'Community assistance record retention policy',
      lastSyncDate: '2026-03-25'
    }
  }
};

const defaultProfile = {
  issuerName: 'Generic Issuer',
  actions: [{ id: 'issue_generic_credential', label: 'Issue Generic Credential', description: 'Issue baseline credential.' }],
  podData: {
    reports: ['generic-report'],
    retentionPolicy: 'Default retention',
    lastSyncDate: '2026-03-01'
  }
};

const siteProfile = issuerProfiles[siteDir] || defaultProfile;
const selfServiceActionIds = new Set([
  'apply_for_employment',
  'redeem_employee_season_ticket',
  'request_xray',
  'process_food_assistance',
  'process_housing_assistance',
  'issue_assistance_intake_receipt'
]);
const inferActionScope = (actionId) => (selfServiceActionIds.has(actionId) ? 'self_service' : 'issuer_staff');
const scopedActions = siteProfile.actions.map((action) => ({
  ...action,
  actorScope: action.actorScope || inferActionScope(action.id)
}));
const sessions = new Map();
const doctorRecords = new Map();
const employmentRegistry = new Map();
const issuedAccessBadges = new Map();
const revokedCredentialIds = new Map();
const sportsOperationalLogs = [];
const encryptedDoctorRecords = new Map();
const doctorRecordConsentGrants = new Map();
const interAgencyConsentGrantsBySubject = new Map();
const encryptedDatastoreStats = {
  recordsStored: 0,
  fetchAttempts: 0,
  fetchAllowed: 0,
  fetchDenied: 0,
  consentGrantsIssued: 0,
  consentGrantsRevoked: 0,
  lastUpdatedAt: null
};
let issuerTemplatePolicy = { actionTemplates: {} };
try {
  const policyRaw = fs.readFileSync(templatePolicyPath, 'utf8');
  const parsed = JSON.parse(policyRaw);
  issuerTemplatePolicy = parsed && typeof parsed === 'object' ? parsed : { actionTemplates: {} };
} catch {
  issuerTemplatePolicy = { actionTemplates: {} };
}

const trustedCredentialIssuersBySite = {
  'doctors-office': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    SelfPresenceCredential: ['did:example:verifier:self-presence']
  },
  'car-repair-shop': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    BusinessRegistrationCredential: ['did:example:verifier:business-registry']
  },
  'sports-park': {
    EmployeeStatusCredential: ['did:example:issuer:national-metal-works'],
    SeasonTicketEntitlementCredential: ['did:example:issuer:national-metal-works']
  },
  'national-metal-works': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    ITARComplianceCredential: ['did:example:verifier:itar'],
    SelfPresenceCredential: ['did:example:verifier:self-presence'],
    UtilityBillCredential: ['did:example:verifier:utility-bill']
  },
  'apple-seed-insurance': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    UtilityBillCredential: ['did:example:verifier:utility-bill'],
    ExternalMedicalRecordLinkCredential: ['did:example:issuer:doctors-office']
  },
  'assistance-charity': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    UtilityBillCredential: ['did:example:verifier:utility-bill']
  }
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

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

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const getAuthToken = (req) => {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return (req.headers['x-session-token'] || '').trim();
};

const getSession = (req) => {
  const token = getAuthToken(req);
  if (!token) return null;
  return sessions.get(token) || null;
};

const deriveSubjectDidFromWebId = (webId) => {
  try {
    const u = new URL(webId);
    const joined = `${u.hostname}${u.pathname}`.replace(/\/+$/, '');
    const sanitized = joined.replace(/[^a-zA-Z0-9]/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
    return `did:web:${sanitized || 'subject'}`;
  } catch {
    const cleaned = String(webId || 'subject').replace(/[^a-zA-Z0-9]/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
    return `did:web:${cleaned || 'subject'}`;
  }
};

const issuerDid = `did:example:issuer:${siteDir}`;
const issuerWebId = (() => {
  try {
    const base = new URL(solidPodUrl);
    return `${base.origin}/profile/card#me`;
  } catch {
    return '';
  }
})();

const hashString = (value) => crypto.createHash('sha256').update(String(value)).digest('base64url');

const grantInterAgencyConsent = ({ subjectDid, targetAgencyDid, scope, grantedByWebId, expiresAt }) => {
  const grants = interAgencyConsentGrantsBySubject.get(subjectDid) || [];
  const grant = {
    id: `agency-consent-${crypto.randomUUID()}`,
    subjectDid,
    ownerIssuerDid: issuerDid,
    ownerIssuerName: siteProfile.issuerName,
    targetAgencyDid,
    scope,
    grantedByWebId,
    grantedAt: new Date().toISOString(),
    expiresAt,
    status: 'active'
  };
  grants.push(grant);
  interAgencyConsentGrantsBySubject.set(subjectDid, grants);
  return grant;
};

const revokeInterAgencyConsent = ({ subjectDid, grantId, targetAgencyDid, scope, revokedByWebId }) => {
  const grants = interAgencyConsentGrantsBySubject.get(subjectDid) || [];
  let revokedCount = 0;
  const now = new Date().toISOString();
  for (const grant of grants) {
    if (grant.status !== 'active') continue;
    if (grantId && grant.id !== grantId) continue;
    if (!grantId && targetAgencyDid && grant.targetAgencyDid !== targetAgencyDid) continue;
    if (!grantId && scope && grant.scope !== scope) continue;
    grant.status = 'revoked';
    grant.revokedAt = now;
    grant.revokedByWebId = revokedByWebId;
    revokedCount += 1;
  }
  if (revokedCount > 0) interAgencyConsentGrantsBySubject.set(subjectDid, grants);
  return revokedCount;
};

const findActiveInterAgencyConsent = ({ subjectDid, targetAgencyDid, scope }) => {
  const grants = interAgencyConsentGrantsBySubject.get(subjectDid) || [];
  const nowMs = Date.now();
  return grants.find((grant) => {
    if (grant.status !== 'active') return false;
    if (grant.targetAgencyDid !== targetAgencyDid) return false;
    if (scope && grant.scope !== scope) return false;
    const expMs = Date.parse(String(grant.expiresAt || ''));
    return Number.isFinite(expMs) && expMs > nowMs;
  }) || null;
};

const encryptPayloadForDatastore = (payload) => {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    keyB64: key.toString('base64'),
    encrypted: {
      algorithm: 'aes-256-gcm',
      ivB64: iv.toString('base64'),
      authTagB64: authTag.toString('base64'),
      ciphertextB64: ciphertext.toString('base64')
    }
  };
};

const b64u = (value) => Buffer.from(value).toString('base64url');
const serializeProtectedHeader = (header) => b64u(JSON.stringify(header));

const deriveEcdhContentEncryptionKey = ({ ephemeralPrivateKey, sovereignPublicKeyPem, kid }) =>
  crypto.hkdfSync(
    'sha256',
    crypto.diffieHellman({
      privateKey: ephemeralPrivateKey,
      publicKey: crypto.createPublicKey(sovereignPublicKeyPem)
    }),
    Buffer.alloc(0),
    Buffer.from(`jwe-cek:${kid}`, 'utf8'),
    32
  );

const encryptPayloadAsJwe = (payload, context = {}) => {
  const ephemeral = crypto.generateKeyPairSync('x25519');
  const protectedHeader = {
    typ: 'JWE',
    alg: 'ECDH-ES',
    enc: 'A256GCM',
    kid: sovereignJweKeyId,
    epk: ephemeral.publicKey.export({ format: 'jwk' })
  };
  const protectedB64u = serializeProtectedHeader(protectedHeader);
  const cek = deriveEcdhContentEncryptionKey({
    ephemeralPrivateKey: ephemeral.privateKey,
    sovereignPublicKeyPem: sovereignJwePublicKeyPem,
    kid: sovereignJweKeyId
  });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cek, iv);
  cipher.setAAD(Buffer.from(protectedB64u, 'utf8'));
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    envelopeType: 'JWEJSONEnvelopeV1',
    protected: protectedB64u,
    iv: b64u(iv),
    ciphertext: b64u(ciphertext),
    tag: b64u(tag),
    context
  };
};

const sealPayloadForSovereign = (payload, context = {}) => {
  return encryptPayloadAsJwe(payload, context);
};

const recordEncryptedDoctorPayload = ({ recordId, payload, subjectDid, webId, recordType = 'xray' }) => {
  const envelope = sealPayloadForSovereign(payload, {
    recordId,
    subjectDid,
    recordType,
    issuerDid,
    issuedBy: siteProfile.issuerName,
    issuedAt: new Date().toISOString()
  });
  encryptedDoctorRecords.set(recordId, {
    recordId,
    recordType,
    subjectDid,
    webId,
    storedAt: new Date().toISOString(),
    envelope
  });
  encryptedDatastoreStats.recordsStored = encryptedDoctorRecords.size;
  encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
};

const issueDoctorRecordConsentGrant = ({ recordId, subjectDid, grantedByWebId, requesterWebId, purpose, expiresAt }) => {
  const grants = doctorRecordConsentGrants.get(recordId) || [];
  const grant = {
    id: `consent-${crypto.randomUUID()}`,
    recordId,
    subjectDid,
    grantedByWebId,
    requesterWebId,
    purpose,
    grantedAt: new Date().toISOString(),
    expiresAt,
    status: 'active'
  };
  grants.push(grant);
  doctorRecordConsentGrants.set(recordId, grants);
  encryptedDatastoreStats.consentGrantsIssued += 1;
  encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
  return grant;
};

const revokeDoctorRecordConsentGrant = ({ recordId, requesterWebId, revokedByWebId }) => {
  const grants = doctorRecordConsentGrants.get(recordId) || [];
  let revokedCount = 0;
  const now = new Date().toISOString();
  for (const grant of grants) {
    if (grant.status !== 'active') continue;
    if (requesterWebId && grant.requesterWebId !== requesterWebId) continue;
    grant.status = 'revoked';
    grant.revokedAt = now;
    grant.revokedByWebId = revokedByWebId;
    revokedCount += 1;
  }
  if (revokedCount > 0) {
    doctorRecordConsentGrants.set(recordId, grants);
    encryptedDatastoreStats.consentGrantsRevoked += revokedCount;
    encryptedDatastoreStats.lastUpdatedAt = now;
  }
  return revokedCount;
};

const getActiveDoctorRecordConsent = ({ recordId, requesterWebId, subjectDid }) => {
  const grants = doctorRecordConsentGrants.get(recordId) || [];
  const nowMs = Date.now();
  return grants.find((grant) => {
    if (grant.status !== 'active') return false;
    if (subjectDid && grant.subjectDid !== subjectDid) return false;
    if (grant.requesterWebId !== requesterWebId) return false;
    const expMs = Date.parse(String(grant.expiresAt || ''));
    return Number.isFinite(expMs) && expMs > nowMs;
  }) || null;
};

const createDoctorRecordLinkCredential = ({ subjectDid, recordId, recordDigest, issuedAt, baseUrl, relationshipMetadata = {} }) => {
  const linkProofJws = hashString(`${siteDir}:xray-link:${recordId}:${issuedAt}:${subjectDid}:${recordDigest}`);
  const vc = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: ['VerifiableCredential', 'ExternalMedicalRecordLinkCredential'],
    issuer: {
      id: issuerDid,
      name: siteProfile.issuerName
    },
    issuanceDate: issuedAt,
    validFrom: issuedAt,
    credentialSubject: {
      id: subjectDid,
      recordId,
      recordType: 'xray',
      recordOwner: 'doctor-pod',
      dataStoredWithIssuerOnly: true,
      fetchEndpoint: `${baseUrl}/api/records/fetch`,
      verifyEndpoint: `${baseUrl}/api/records/verify`
    }
  };
  vc.proof = {
    type: 'MockIssuerSignature2026',
    created: issuedAt,
    verificationMethod: `${issuerDid}#key-1`,
    proofPurpose: 'assertionMethod',
    jws: linkProofJws
  };

  applyRelationshipMetadata({
    credential: vc,
    actionId: relationshipMetadata.actionId || 'request_xray',
    actorMode: relationshipMetadata.actorMode || 'self_service',
    sessionWebId: relationshipMetadata.sessionWebId || null,
    subjectDid,
    recordCustody: relationshipMetadata.recordCustody || {
      fullRecordLocation: 'issuer_pod',
      subjectProofLocation: 'sovereign_pod',
      custodyModel: 'link_to_external_record'
    },
    verificationDependencies: relationshipMetadata.verificationDependencies || [],
    trustSources: relationshipMetadata.trustSources || [],
    lifecycleStatus: relationshipMetadata.lifecycleStatus || 'active'
  });

  return { vc, linkProofJws };
};

const mapToInternalSovereignOrigin = (url) => {
  const source = new URL(url);
  if (source.hostname === 'localhost' || source.hostname === '127.0.0.1') {
    const mapped = new URL(sovereignInternalOrigin);
    return `${mapped.origin}${source.pathname}${source.search}${source.hash}`;
  }
  return source.toString();
};

const hasRequiredFlags = (credential, requiredFlags) => {
  if (!requiredFlags || requiredFlags.length === 0) return true;
  const flags = credential?.credentialSubject?.stateIdFlags || {};
  return requiredFlags.every((flag) => Boolean(flags[flag]));
};

const trustedIssuersForType = (credentialType) => {
  const bySite = trustedCredentialIssuersBySite[siteDir] || {};
  const list = bySite[credentialType];
  return Array.isArray(list) ? list : [];
};

const deriveCredentialsContainerFromWebId = (webId) => {
  const effectiveWebId = mapToInternalSovereignOrigin(webId);
  const u = new URL(effectiveWebId);
  return `${u.origin}/credentials/`;
};

const sanitizeFilePart = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const getActionTemplate = (actionId) => {
  const templates = issuerTemplatePolicy?.actionTemplates;
  if (!templates || typeof templates !== 'object') return null;
  const template = templates[actionId];
  return template && typeof template === 'object' ? template : null;
};

const listCredentialResourceUrls = async (containerUrl) => {
  const response = await fetch(containerUrl, { headers: { Accept: 'text/turtle' } });
  if (response.status === 404) return { ok: true, resources: [] };
  const text = await response.text();
  if (!response.ok) {
    return { ok: false, reason: `credentials container read failed (${response.status})`, detail: text.slice(0, 400) };
  }

  const resources = [];
  const containsRegex = /<([^>]+\.json)>/g;
  let match;
  while ((match = containsRegex.exec(text))) {
    const resourceUrl = match[1];
    const normalized = resourceUrl.startsWith('http://') || resourceUrl.startsWith('https://')
      ? resourceUrl
      : new URL(resourceUrl, containerUrl).toString();
    if (!resources.includes(normalized)) resources.push(normalized);
  }
  return { ok: true, resources };
};

const listIssuerPodIssuedRecordsSummary = async () => {
  if (!solidPodUrl) return { ok: false, reason: 'issuer solid pod url not configured' };
  try {
    const baseUrl = mapToInternalSovereignOrigin(solidPodUrl).replace(/\/+$/, '');
    const records = [];
    const byType = {};
    const containers = [
      { url: `${baseUrl}/issued-credentials/`, kind: 'issued_credentials' },
      { url: `${baseUrl}/records/`, kind: 'issuer_records' }
    ];
    for (const container of containers) {
      const listed = await listCredentialResourceUrls(container.url);
      if (!listed.ok) continue;
      for (const resourceUrl of listed.resources) {
        const response = await fetch(resourceUrl, { headers: { Accept: 'application/json' } });
        if (!response.ok) continue;
        const payload = await response.json().catch(() => null);
        if (!payload || typeof payload !== 'object') continue;

        if (container.kind === 'issued_credentials') {
          const credential = payload.credential && typeof payload.credential === 'object' ? payload.credential : payload;
          const types = credentialTypes(credential).filter((t) => t !== 'VerifiableCredential');
          const primaryType = types[0] || 'UnknownCredential';
          byType[primaryType] = (byType[primaryType] || 0) + 1;
          records.push({
            id: payload.id || credential.id || resourceUrl,
            resourceUrl,
            sourceContainer: container.kind,
            actionId: payload.actionId || null,
            storedAt: payload.storedAt || null,
            subjectDid: payload.subjectDid || credential?.credentialSubject?.id || null,
            recordType: primaryType
          });
        } else {
          const recordType = String(payload.recordType || payload?.record?.recordType || 'issuer_record').trim();
          byType[recordType] = (byType[recordType] || 0) + 1;
          records.push({
            id: payload.id || payload.recordId || resourceUrl,
            resourceUrl,
            sourceContainer: container.kind,
            actionId: null,
            storedAt: payload.storedAt || null,
            subjectDid: payload.subjectDid || payload?.record?.subjectDid || null,
            recordType
          });
        }
      }
    }

    records.sort((a, b) => {
      const ax = Date.parse(a.storedAt || '') || 0;
      const bx = Date.parse(b.storedAt || '') || 0;
      return bx - ax;
    });

    return {
      ok: true,
      containerUrls: containers.map((c) => c.url),
      totalRecords: records.length,
      byCredentialType: byType,
      recentRecords: records.slice(0, 25)
    };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const listIssuerPodRecordsForSubject = async (subjectDid) => {
  if (!solidPodUrl) return { ok: false, reason: 'issuer solid pod url not configured' };
  if (!subjectDid) return { ok: false, reason: 'subjectDid is required' };
  try {
    const baseUrl = mapToInternalSovereignOrigin(solidPodUrl).replace(/\/+$/, '');
    const containers = [
      { url: `${baseUrl}/issued-credentials/`, kind: 'issued_credentials' },
      { url: `${baseUrl}/records/`, kind: 'issuer_records' }
    ];

    const records = [];
    for (const container of containers) {
      const listed = await listCredentialResourceUrls(container.url);
      if (!listed.ok) continue;
      for (const resourceUrl of listed.resources) {
        const response = await fetch(resourceUrl, { headers: { Accept: 'application/json' } });
        if (!response.ok) continue;
        const payload = await response.json().catch(() => null);
        if (!payload || typeof payload !== 'object') continue;

        let candidateSubjectDid = '';
        if (container.kind === 'issued_credentials') {
          const credential = payload.credential && typeof payload.credential === 'object' ? payload.credential : payload;
          candidateSubjectDid = String(payload.subjectDid || credential?.credentialSubject?.id || '').trim();
          if (candidateSubjectDid !== subjectDid) continue;
          records.push({
            sourceContainer: container.kind,
            resourceUrl,
            kind: 'credential',
            id: payload.id || credential.id || resourceUrl,
            storedAt: payload.storedAt || null,
            credential
          });
          continue;
        }

        candidateSubjectDid = String(payload.subjectDid || payload?.record?.subjectDid || '').trim();
        if (candidateSubjectDid !== subjectDid) continue;
        records.push({
          sourceContainer: container.kind,
          resourceUrl,
          kind: 'record',
          id: payload.id || payload.recordId || resourceUrl,
          storedAt: payload.storedAt || null,
          record: payload.record || payload
        });
      }
    }

    records.sort((a, b) => (Date.parse(b.storedAt || '') || 0) - (Date.parse(a.storedAt || '') || 0));
    return { ok: true, subjectDid, totalRecords: records.length, records };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const verifyCredentialWithSovereign = async (webId, requiredCredentialType, requiredFlags = [], trustedIssuers = null) => {
  const walletRead = await fetchWalletCredentialsForWebId(webId);
  if (!walletRead.ok) {
    return { ok: false, reason: walletRead.reason };
  }

  const allowedIssuers = Array.isArray(trustedIssuers) ? trustedIssuers : trustedIssuersForType(requiredCredentialType);
  const matched = walletRead.credentials.find((cred) => {
    const types = credentialTypes(cred);
    if (!types.includes(requiredCredentialType)) return false;
    if (!hasRequiredFlags(cred, requiredFlags)) return false;
    if (allowedIssuers.length === 0) return true;
    return allowedIssuers.includes(credentialIssuerDid(cred));
  });

  if (!matched) {
    const issuerSuffix = allowedIssuers.length > 0 ? ` from trusted issuers (${allowedIssuers.join(', ')})` : '';
    return {
      ok: false,
      reason: `Missing ${requiredCredentialType}${requiredFlags.length ? ` with flags ${requiredFlags.join(', ')}` : ''}${issuerSuffix}`
    };
  }

  return {
    ok: true,
    verification: {
      authorized: true,
      requiredCredentialType,
      requiredFlags,
      matchedCredentialType: requiredCredentialType
    }
  };
};

const verifyIdentityWithSovereign = async (webId) => {
  const driversLicenseCheck = await verifyCredentialWithSovereign(
    webId,
    'DriversLicenseCredential',
    ['isOver18', 'isOver21'],
    trustedIssuersForType('DriversLicenseCredential')
  );
  if (driversLicenseCheck.ok) {
    return {
      ok: true,
      matchedCredentialType: 'DriversLicenseCredential',
      verification: driversLicenseCheck.verification
    };
  }

  const passportCheck = await verifyCredentialWithSovereign(
    webId,
    'PassportCredential',
    [],
    trustedIssuersForType('PassportCredential')
  );
  if (passportCheck.ok) {
    return {
      ok: true,
      matchedCredentialType: 'PassportCredential',
      verification: passportCheck.verification
    };
  }

  return {
    ok: false,
    reason: 'Missing DriversLicenseCredential (isOver18 + isOver21) or PassportCredential'
  };
};

const resolveWalletFromWebId = async (webId) => {
  if (!webId) return { ok: false, reason: 'webId not provided' };
  try {
    const credentialsContainer = deriveCredentialsContainerFromWebId(webId);
    return { ok: true, credentialsContainer };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const fetchWalletCredentialsForWebId = async (webId) => {
  const resolution = await resolveWalletFromWebId(webId);
  if (!resolution.ok) return { ok: false, reason: resolution.reason };

  try {
    const listed = await listCredentialResourceUrls(resolution.credentialsContainer);
    if (!listed.ok) return { ok: false, reason: listed.reason, detail: listed.detail };

    const credentials = [];
    for (const resourceUrl of listed.resources) {
      const response = await fetch(resourceUrl, { headers: { Accept: 'application/json' } });
      if (!response.ok) continue;
      const payload = await response.json().catch(() => null);
      if (!payload || typeof payload !== 'object') continue;
      const types = credentialTypes(payload);
      if (types.length === 0) continue;
      credentials.push(payload);
    }

    return { ok: true, credentials, credentialsContainer: resolution.credentialsContainer, resources: listed.resources };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const fetchIssuerBusinessRegistrationCredential = async () => {
  if (!issuerWebId) return { ok: false, reason: 'issuer webid is not configured' };
  const walletRead = await fetchWalletCredentialsForWebId(issuerWebId);
  if (!walletRead.ok) return { ok: false, reason: walletRead.reason };

  const trustedIssuers = trustedIssuersForType('BusinessRegistrationCredential');
  const now = Date.now();
  const matched = walletRead.credentials.find((cred) => {
    const types = credentialTypes(cred);
    if (!types.includes('BusinessRegistrationCredential')) return false;
    if (trustedIssuers.length > 0 && !trustedIssuers.includes(credentialIssuerDid(cred))) return false;
    const subject = cred?.credentialSubject || {};
    const name = String(subject.businessName || '').trim();
    if (!name || name !== siteProfile.issuerName) return false;
    const status = String(subject.registrationStatus || '').trim().toLowerCase();
    if (status && status !== 'active') return false;
    const expMs = Date.parse(String(subject.expiryDate || cred.expirationDate || ''));
    if (Number.isFinite(expMs) && expMs < now) return false;
    return true;
  });

  if (!matched) {
    return {
      ok: false,
      reason: `Missing active BusinessRegistrationCredential for ${siteProfile.issuerName}`,
      trustedIssuers,
      issuerWebId
    };
  }

  return {
    ok: true,
    issuerWebId,
    trustedIssuers,
    credential: matched,
    summary: {
      credentialId: matched.id || null,
      businessName: matched?.credentialSubject?.businessName || null,
      registrationNumber: matched?.credentialSubject?.registrationNumber || null,
      jurisdiction: matched?.credentialSubject?.jurisdiction || null,
      registrationStatus: matched?.credentialSubject?.registrationStatus || null,
      expiryDate: matched?.credentialSubject?.expiryDate || matched?.expirationDate || null,
      verifierDid: credentialIssuerDid(matched)
    }
  };
};

const handlePublicBusinessLicense = async (req, res) => {
  if (siteDir !== 'car-repair-shop') {
    json(res, 404, { ok: false, error: 'public business license endpoint only available for car-repair-shop issuer' });
    return;
  }

  const verification = await fetchIssuerBusinessRegistrationCredential();
  if (!verification.ok) {
    json(res, 404, {
      ok: false,
      issuer: siteProfile.issuerName,
      issuerWebId: issuerWebId || null,
      error: 'business registration credential not found',
      reason: verification.reason,
      trustedBusinessRegistryVerifierDids: verification.trustedIssuers || trustedIssuersForType('BusinessRegistrationCredential')
    });
    return;
  }

  const nowIso = new Date().toISOString();
  json(res, 200, {
    ok: true,
    issuer: siteProfile.issuerName,
    issuerWebId: verification.issuerWebId,
    verifiedAt: nowIso,
    verification: {
      trustedVerifierDid: verification.summary.verifierDid,
      registrationStatus: verification.summary.registrationStatus,
      expiryDate: verification.summary.expiryDate,
      businessNameMatchesIssuer: verification.summary.businessName === siteProfile.issuerName
    },
    businessRegistrationCredential: verification.credential
  });
};

const attachIssuerBusinessProof = (credential, businessCheck) => {
  if (!credential || typeof credential !== 'object' || !businessCheck?.ok) return credential;
  const subject = credential.credentialSubject && typeof credential.credentialSubject === 'object'
    ? credential.credentialSubject
    : {};
  credential.credentialSubject = {
    ...subject,
    issuerBusinessRegistration: businessCheck.summary
  };
  return credential;
};

const storeCredentialProofToSovereign = async (webId, credential) => {
  const resolution = await resolveWalletFromWebId(webId);
  if (!resolution.ok) return { ok: false, reason: resolution.reason };
  const types = credentialTypes(credential).filter((t) => t !== 'VerifiableCredential');
  const typePart = sanitizeFilePart(types[0] || 'credential');
  const fileName = `vc-${typePart}-${crypto.randomUUID()}.json`;
  const resourceUrl = `${resolution.credentialsContainer}${fileName}`;

  try {
    const response = await fetch(resourceUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credential, null, 2)
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, reason: `credential write failed (${response.status})`, detail };
    }
    return { ok: true, walletUrl: resourceUrl, count: 1 };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const addSportsOperationalLog = (entry) => {
  const logEntry = {
    id: `sports-log-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    ...entry
  };
  sportsOperationalLogs.push(logEntry);
  if (sportsOperationalLogs.length > 500) sportsOperationalLogs.shift();
  return logEntry;
};

const storeCredentialToIssuerPod = async ({ credential, subjectDid, webId, actionId }) => {
  if (!solidPodUrl) return { ok: false, reason: 'issuer solid pod url not configured' };

  const baseUrl = mapToInternalSovereignOrigin(solidPodUrl).replace(/\/+$/, '');
  const containerUrl = `${baseUrl}/issued-credentials/`;
  const issuedTypes = credentialTypes(credential).filter((t) => t !== 'VerifiableCredential');
  const typePart = sanitizeFilePart(issuedTypes[0] || actionId || 'credential');
  const recordId = `issuer-record-${crypto.randomUUID()}`;
  const resourceUrl = `${containerUrl}${recordId}-${typePart}.json`;
  const record = {
    id: recordId,
    storedAt: new Date().toISOString(),
    issuer: siteProfile.issuerName,
    actionId,
    subjectDid,
    webId,
    credential
  };

  try {
    const write = await fetch(resourceUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record, null, 2)
    });
    if (!write.ok) {
      const detail = await write.text().catch(() => '');
      return { ok: false, reason: `issuer pod write failed (${write.status})`, detail };
    }
    return { ok: true, ledgerUrl: resourceUrl, recordId: record.id, count: 1 };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const storeDoctorRecordToIssuerPod = async ({ recordId, recordPayload, recordDigest, recordSignature, subjectDid, webId }) => {
  if (!solidPodUrl) return { ok: false, reason: 'issuer solid pod url not configured' };

  const baseUrl = mapToInternalSovereignOrigin(solidPodUrl).replace(/\/+$/, '');
  const containerUrl = `${baseUrl}/records/`;
  const resourceUrl = `${containerUrl}${recordId}.json`;
  const record = {
    id: recordId,
    recordType: 'xray',
    storedAt: new Date().toISOString(),
    issuer: siteProfile.issuerName,
    subjectDid,
    webId,
    recordDigest,
    recordSignature,
    record: recordPayload
  };

  try {
    const write = await fetch(resourceUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record, null, 2)
    });
    if (!write.ok) {
      const detail = await write.text().catch(() => '');
      return { ok: false, reason: `issuer pod record write failed (${write.status})`, detail };
    }
    return { ok: true, ledgerUrl: resourceUrl, recordId };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const buildCredentialFromActionTemplate = ({ action, payload, subjectDid, webId, issuedAt, actorMode }) => {
  const template = getActionTemplate(action.id) || {};
  const context = Array.isArray(template.context) && template.context.length > 0
    ? template.context
    : ['https://www.w3.org/ns/credentials/v2'];
  const types = Array.isArray(template.types) && template.types.length > 0
    ? template.types
    : ['VerifiableCredential', 'IssuerActionCredential'];
  const subjectDefaults = template.subjectDefaults && typeof template.subjectDefaults === 'object'
    ? template.subjectDefaults
    : {};
  const subjectFromPayload = {};
  if (template.subjectFromPayload && typeof template.subjectFromPayload === 'object') {
    for (const [claimName, payloadKey] of Object.entries(template.subjectFromPayload)) {
      if (payload && Object.prototype.hasOwnProperty.call(payload, payloadKey)) {
        subjectFromPayload[claimName] = payload[payloadKey];
      }
    }
  }

  const credentialSubject = {
    id: subjectDid,
    actorMode: actorMode || action.actorScope || inferActionScope(action.id),
    actionId: action.id,
    actionLabel: action.label,
    actionDescription: action.description,
    authorizedWebId: webId,
    ...subjectDefaults,
    ...subjectFromPayload
  };

  if (template.includePayload !== false) {
    credentialSubject.payload = payload;
  }

  const issuedCredential = {
    '@context': context,
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: types,
    issuer: {
      id: `did:example:issuer:${siteDir}`,
      name: siteProfile.issuerName
    },
    issuanceDate: issuedAt,
    validFrom: issuedAt,
    credentialSubject,
    proof: {
      type: 'MockIssuerSignature2026',
      created: issuedAt,
      verificationMethod: `did:example:issuer:${siteDir}#key-1`,
      proofPurpose: 'assertionMethod',
      jws: crypto.createHash('sha256').update(`${siteDir}:${action.id}:${issuedAt}:${webId}`).digest('base64url')
    }
  };

  return { issuedCredential, template };
};

const normalizeDependencies = (dependencies) =>
  (Array.isArray(dependencies) ? dependencies : [])
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const credentialType = String(entry.credentialType || '').trim();
      if (!credentialType) return null;
      return {
        credentialType,
        policy: String(entry.policy || 'required').trim(),
        requiredFlags: Array.isArray(entry.requiredFlags) ? entry.requiredFlags.filter(Boolean) : []
      };
    })
    .filter(Boolean);

const buildTrustSourcesFromDependencies = (dependencies) => {
  const types = new Set();
  for (const dependency of normalizeDependencies(dependencies)) {
    types.add(dependency.credentialType);
  }
  return Array.from(types).map((credentialType) => ({
    credentialType,
    trustedIssuerDids: trustedIssuersForType(credentialType)
  }));
};

const inferCredentialLifecycleStatus = (credential, explicitStatus) => {
  const status = String(explicitStatus || '').trim().toLowerCase();
  if (status) return status;
  const types = credentialTypes(credential);
  if (types.some((t) => String(t).includes('Denied'))) return 'denied';
  if (types.some((t) => String(t).includes('Termination'))) return 'terminated';
  return 'active';
};

const applyRelationshipMetadata = ({
  credential,
  action,
  actionId,
  actorMode,
  sessionWebId,
  subjectDid,
  authorityWebId,
  recordCustody,
  verificationDependencies,
  trustSources,
  lifecycleStatus
}) => {
  if (!credential || typeof credential !== 'object') return credential;

  const now = new Date().toISOString();
  const effectiveActionId = String(actionId || action?.id || '').trim() || 'issuer_action';
  const effectiveActorMode = String(actorMode || action?.actorScope || inferActionScope(effectiveActionId)).trim();
  const subject = credential.credentialSubject && typeof credential.credentialSubject === 'object'
    ? credential.credentialSubject
    : {};
  const normalizedDependencies = normalizeDependencies(verificationDependencies);
  const effectiveTrustSources = Array.isArray(trustSources) && trustSources.length > 0
    ? trustSources
    : buildTrustSourcesFromDependencies(normalizedDependencies);
  const effectiveCustody = recordCustody && typeof recordCustody === 'object'
    ? recordCustody
    : {
      fullRecordLocation: 'issuer_pod',
      subjectProofLocation: 'sovereign_pod'
    };

  credential.credentialSubject = {
    ...subject,
    id: subject.id || subjectDid || null,
    relationships: {
      actor: {
        initiatedBy: effectiveActorMode,
        actionId: effectiveActionId,
        capturedAt: now
      },
      authority: {
        approvedByWebId: authorityWebId || sessionWebId || null,
        approvedByIssuerDid: issuerDid,
        approvedByIssuerName: siteProfile.issuerName
      },
      recordCustody: effectiveCustody,
      verificationDependencies: normalizedDependencies,
      trustSources: effectiveTrustSources,
      lifecycle: {
        status: inferCredentialLifecycleStatus(credential, lifecycleStatus),
        updatedAt: now
      },
      standardsProfile: inferTransactionStandardsProfile(credential)
    }
  };

  return credential;
};

const inferTransactionStandardsProfile = (credential) => {
  const rawType = credential?.type;
  const types = Array.isArray(rawType) ? rawType : typeof rawType === 'string' && rawType ? [rawType] : [];
  const profile = [
    {
      layer: 'credential-envelope',
      standard: 'W3C Verifiable Credentials Data Model v2.0',
      uri: 'https://www.w3.org/TR/vc-data-model-2.0/',
      usage: 'signature, issuer binding, subject claims'
    }
  ];

  const hasType = (name) => types.includes(name);
  const anyTypeContains = (value) => types.some((t) => String(t).toLowerCase().includes(String(value).toLowerCase()));

  if (
    anyTypeContains('insurance') ||
    anyTypeContains('claim') ||
    hasType('ExternalMedicalRecordLinkCredential')
  ) {
    profile.push(
      {
        layer: 'healthcare-payload',
        standard: 'HL7 FHIR R5 Claim',
        uri: 'https://hl7.org/fhir/claim.html',
        usage: 'claim/payer payload mapping'
      },
      {
        layer: 'edi-transaction',
        standard: 'ASC X12 837 Health Care Claim',
        uri: 'https://x12.org/node/4379',
        usage: 'claim submission interoperability'
      },
      {
        layer: 'edi-eligibility',
        standard: 'ASC X12 270/271',
        uri: 'https://x12.org/node/4248',
        usage: 'eligibility inquiry/response'
      },
      {
        layer: 'insurance-data',
        standard: 'ACORD Data Standards',
        uri: 'https://www-dev.acord.org/standards-architecture/acord-data-standards/Property_Casualty_Data_Standards',
        usage: 'policy/claims common data semantics'
      }
    );
  }

  if (
    hasType('ExternalMedicalRecordLinkCredential') ||
    hasType('BloodworkResultCredential') ||
    hasType('AllergyProfileCredential')
  ) {
    profile.push({
      layer: 'clinical-record',
      standard: 'HL7 FHIR R5 DiagnosticReport/Observation/DocumentReference',
      uri: 'https://hl7.org/fhir/diagnosticreport.html',
      usage: 'clinical evidence exchange'
    });
  }

  if (anyTypeContains('assistance')) {
    profile.push({
      layer: 'human-services',
      standard: 'Open Referral HSDS',
      uri: 'https://docs.openreferral.org/en/3.1/hsds/overview.html',
      usage: 'assistance program and service taxonomy mapping'
    });
  }

  if (hasType('RecordAccessConsentCredential') || anyTypeContains('consent')) {
    profile.push({
      layer: 'consent-policy',
      standard: 'W3C ODRL Information Model 2.2',
      uri: 'https://www.w3.org/TR/odrl-model/',
      usage: 'consent and access policy expression'
    });
  }

  return profile;
};

const credentialTypes = (credential) => {
  const t = credential?.type;
  if (Array.isArray(t)) return t;
  if (typeof t === 'string' && t) return [t];
  return [];
};

const credentialIssuerDid = (credential) => {
  if (!credential || typeof credential !== 'object') return '';
  if (typeof credential.issuer === 'string') return credential.issuer;
  if (credential.issuer && typeof credential.issuer.id === 'string') return credential.issuer.id;
  return '';
};

const hasCredentialInWallet = (credentials, type, issuerDidOrList) =>
  credentials.some((cred) => {
    const types = credentialTypes(cred);
    if (!types.includes(type)) return false;
    const allowedIssuers = Array.isArray(issuerDidOrList)
      ? issuerDidOrList.filter(Boolean)
      : issuerDidOrList
        ? [issuerDidOrList]
        : [];
    if (allowedIssuers.length === 0) return true;
    return allowedIssuers.includes(credentialIssuerDid(cred));
  });

const getSolidPodStatusHtml = async () => {
  if (!solidPodUrl) {
    return '<p style="margin:.4rem 0;color:#b91c1c;"><strong>Solid pod:</strong> not configured</p>';
  }

  try {
    const response = await fetch(mapToInternalSovereignOrigin(solidPodUrl));
    if (!response.ok) {
      return `<p style="margin:.4rem 0;color:#b91c1c;"><strong>Solid pod:</strong> unreachable (${response.status}) at ${escapeHtml(solidPodUrl)}</p>`;
    }

    return `<p style="margin:.4rem 0;color:#065f46;"><strong>Connected issuer Solid pod:</strong> ${escapeHtml(solidPodUrl)}</p>`;
  } catch (err) {
    return `<p style="margin:.4rem 0;color:#b91c1c;"><strong>Solid pod:</strong> connection failed at ${escapeHtml(solidPodUrl)}</p>`;
  }
};

const getApiPanelHtml = async () => {
  const podStatusHtml = await getSolidPodStatusHtml();
  const actionsJson = JSON.stringify(scopedActions);
  const isDoctorSite = siteDir === 'doctors-office';

  return `
  <section style="max-width:920px;margin:0 auto 2rem;padding:0 1rem;">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:1rem;box-shadow:0 10px 24px rgba(0,0,0,.06);">
      <h2 style="margin-top:0;">Issuer Console API</h2>
      <p style="margin:.4rem 0;color:#4b5563;">WebID-authenticated actions for <strong>${escapeHtml(siteProfile.issuerName)}</strong>.</p>
      ${siteDir === 'car-repair-shop' ? '<p style="margin:.4rem 0;color:#0f766e;"><strong>Public business license verification:</strong> <code>/api/public/business-license</code></p>' : ''}
      ${podStatusHtml}
      <p style="margin:.4rem 0;color:#4b5563;"><strong>Sovereign pod source:</strong> ${escapeHtml(sovereignPodUrl)}</p>

      <label style="display:block;font-weight:600;margin-bottom:4px;">Sovereign WebID</label>
      <input id="issuerWebId" value="${escapeHtml(demoWebId)}" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;">

      <button id="issuerLoginBtn" style="margin-top:10px;background:#0f766e;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Login With WebID</button>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
        <div style="border:1px solid #dbeafe;background:#f8fbff;border-radius:10px;padding:10px;">
          <label style="display:block;font-weight:700;margin-bottom:6px;color:#1e40af;">Issuer Staff Portal</label>
          <select id="issuerStaffActionSelect" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;"></select>
          <label style="display:block;font-weight:600;margin:8px 0 4px;">Payload JSON</label>
          <textarea id="issuerStaffPayload" style="width:100%;min-height:80px;padding:8px;border:1px solid #d1d5db;border-radius:8px;">{"priority":"normal"}</textarea>
          <button id="issuerStaffRunBtn" style="margin-top:10px;background:#1f2937;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Run Staff Action</button>
        </div>
        <div style="border:1px solid #dcfce7;background:#f7fff9;border-radius:10px;padding:10px;">
          <label style="display:block;font-weight:700;margin-bottom:6px;color:#166534;">Self-Service Portal</label>
          <select id="selfServiceActionSelect" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;"></select>
          <label style="display:block;font-weight:600;margin:8px 0 4px;">Payload JSON</label>
          <textarea id="selfServicePayload" style="width:100%;min-height:80px;padding:8px;border:1px solid #d1d5db;border-radius:8px;">{"priority":"normal"}</textarea>
          <button id="selfServiceRunBtn" style="margin-top:10px;background:#166534;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Run Self-Service Action</button>
        </div>
      </div>
      <p style="margin:.6rem 0 0;color:#334155;"><strong>Subject DID (from login):</strong> <span id="issuerSessionDid">not logged in</span></p>
      <button id="issuerDownloadBtn" style="margin-top:10px;background:#334155;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Download Issuer Pod Data</button>
      <button id="issuerIssuedRecordsBtn" style="margin-top:10px;margin-left:8px;background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Refresh Issuer Pod Records</button>
      <button id="encryptedStatsBtn" style="margin-top:10px;margin-left:8px;background:#7c3aed;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Refresh Encrypted Store Stats</button>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
        <div style="border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;padding:10px;">
          <label style="display:block;font-weight:700;margin-bottom:6px;color:#1e3a8a;">Issuer Pod Records</label>
          <pre id="issuerIssuedRecordsOut" style="margin:0;background:#0b1020;color:#e5e7eb;border-radius:8px;padding:8px;overflow:auto;max-height:220px;">{}</pre>
        </div>
        <div style="border:1px solid #ddd6fe;background:#f5f3ff;border-radius:10px;padding:10px;">
          <label style="display:block;font-weight:700;margin-bottom:6px;color:#5b21b6;">Encrypted Third-Party Access Store</label>
          <pre id="encryptedStatsOut" style="margin:0;background:#0b1020;color:#e5e7eb;border-radius:8px;padding:8px;overflow:auto;max-height:220px;">{}</pre>
        </div>
      </div>

      <div id="consentControls" style="margin-top:12px;display:${isDoctorSite ? 'block' : 'none'};border:1px solid #fecaca;background:#fff7f7;border-radius:10px;padding:10px;">
        <label style="display:block;font-weight:700;color:#9f1239;margin-bottom:6px;">Sovereign Sharing Consent (Doctor Records)</label>
        <input id="consentRecordId" placeholder="recordId (ex: xray-...)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
        <input id="consentRequesterWebId" placeholder="requesterWebId (ex: did:web:apple-seed-insurance)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
        <input id="consentPurpose" value="medical-claim-review" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
        <input id="consentHours" value="24" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
        <button id="grantConsentBtn" style="background:#be123c;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Grant Consent</button>
        <button id="revokeConsentBtn" style="margin-left:8px;background:#7f1d1d;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Revoke Consent</button>
      </div>

      <div id="agencySharingControls" style="margin-top:12px;border:1px solid #c7d2fe;background:#f8faff;border-radius:10px;padding:10px;">
        <label style="display:block;font-weight:700;color:#1e3a8a;margin-bottom:6px;">Sovereign Inter-Agency Sharing</label>
        <input id="agencyTargetDid" placeholder="targetAgencyDid (ex: did:example:issuer:apple-seed-insurance)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
        <input id="agencyScope" value="subject_records" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
        <input id="agencyHours" value="24" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
        <button id="agencyGrantBtn" style="background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Grant Agency Access</button>
        <button id="agencyRevokeBtn" style="margin-left:8px;background:#334155;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Revoke Agency Access</button>
        <button id="agencyListBtn" style="margin-left:8px;background:#475569;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">List My Grants</button>
      </div>

      <p id="issuerApiStatus" style="margin:.6rem 0 0;color:#334155;font-weight:600;">Not logged in.</p>
      <pre id="issuerApiOut" style="margin-top:10px;background:#111827;color:#f9fafb;border-radius:10px;padding:10px;overflow:auto;max-height:320px;">{}</pre>
    </div>
  </section>

  <script>
    (() => {
      const staticActions = ${actionsJson};
      let token = '';
      let actions = [...staticActions];

      const webIdEl = document.getElementById('issuerWebId');
      const issuerStaffActionEl = document.getElementById('issuerStaffActionSelect');
      const selfServiceActionEl = document.getElementById('selfServiceActionSelect');
      const sessionDidEl = document.getElementById('issuerSessionDid');
      const issuerStaffPayloadEl = document.getElementById('issuerStaffPayload');
      const selfServicePayloadEl = document.getElementById('selfServicePayload');
      const outEl = document.getElementById('issuerApiOut');
      const statusEl = document.getElementById('issuerApiStatus');
      const loginBtn = document.getElementById('issuerLoginBtn');
      const issuerStaffRunBtn = document.getElementById('issuerStaffRunBtn');
      const selfServiceRunBtn = document.getElementById('selfServiceRunBtn');
      const downloadBtn = document.getElementById('issuerDownloadBtn');
      const issuedRecordsBtn = document.getElementById('issuerIssuedRecordsBtn');
      const encryptedStatsBtn = document.getElementById('encryptedStatsBtn');
      const issuedRecordsOutEl = document.getElementById('issuerIssuedRecordsOut');
      const encryptedStatsOutEl = document.getElementById('encryptedStatsOut');
      const consentRecordIdEl = document.getElementById('consentRecordId');
      const consentRequesterWebIdEl = document.getElementById('consentRequesterWebId');
      const consentPurposeEl = document.getElementById('consentPurpose');
      const consentHoursEl = document.getElementById('consentHours');
      const grantConsentBtn = document.getElementById('grantConsentBtn');
      const revokeConsentBtn = document.getElementById('revokeConsentBtn');
      const agencyTargetDidEl = document.getElementById('agencyTargetDid');
      const agencyScopeEl = document.getElementById('agencyScope');
      const agencyHoursEl = document.getElementById('agencyHours');
      const agencyGrantBtn = document.getElementById('agencyGrantBtn');
      const agencyRevokeBtn = document.getElementById('agencyRevokeBtn');
      const agencyListBtn = document.getElementById('agencyListBtn');

      const renderActions = () => {
        issuerStaffActionEl.innerHTML = '';
        selfServiceActionEl.innerHTML = '';
        actions.forEach((a) => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = a.label + ' - ' + a.description;
          if (a.actorScope === 'self_service') {
            selfServiceActionEl.appendChild(opt);
          } else {
            issuerStaffActionEl.appendChild(opt);
          }
        });
      };

      renderActions();

      loginBtn.addEventListener('click', async () => {
        statusEl.textContent = 'Logging in with WebID...';
        try {
          const res = await fetch('/api/login-webid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webId: webIdEl.value.trim() })
          });
          const data = await res.json();
          outEl.textContent = JSON.stringify(data, null, 2);
          if (!res.ok) {
            statusEl.textContent = 'WebID login failed.';
            return;
          }
          token = data.token;
          actions = data.availableActions || staticActions;
          renderActions();
          if (sessionDidEl) sessionDidEl.textContent = data.subjectDid || 'unknown';
          statusEl.textContent = 'WebID verified. Access granted.';
        } catch (err) {
          statusEl.textContent = 'Login error.';
          outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
        }
      });

      const runAction = async (actionEl, payloadEl, actorModeLabel) => {
        if (!token) {
          statusEl.textContent = 'Please login with WebID first.';
          return;
        }

        let parsedPayload = {};
        try {
          parsedPayload = payloadEl.value.trim() ? JSON.parse(payloadEl.value) : {};
        } catch {
          statusEl.textContent = 'Payload JSON is invalid.';
          return;
        }

        const actionId = actionEl.value;
        if (!actionId) {
          statusEl.textContent = 'No action available for this portal section.';
          return;
        }

        statusEl.textContent = 'Running ' + actorModeLabel + ' action...';
        try {
          const res = await fetch('/api/command', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token
            },
            body: JSON.stringify({
              actionId,
              payload: parsedPayload,
              actorMode: actorModeLabel
            })
          });

          const data = await res.json();
          outEl.textContent = JSON.stringify(data, null, 2);
          statusEl.textContent = res.ok ? 'Action completed.' : 'Action failed.';
        } catch (err) {
          statusEl.textContent = 'Action request error.';
          outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
        }
      };

      issuerStaffRunBtn.addEventListener('click', async () => runAction(issuerStaffActionEl, issuerStaffPayloadEl, 'issuer_staff'));
      selfServiceRunBtn.addEventListener('click', async () => runAction(selfServiceActionEl, selfServicePayloadEl, 'self_service'));

      downloadBtn.addEventListener('click', async () => {
        if (!token) {
          statusEl.textContent = 'Please login with WebID first.';
          return;
        }

        statusEl.textContent = 'Downloading issuer pod data...';
        try {
          const res = await fetch('/api/pod/data', {
            headers: {
              Authorization: 'Bearer ' + token
            }
          });
          const data = await res.json();
          outEl.textContent = JSON.stringify(data, null, 2);
          statusEl.textContent = res.ok ? 'Issuer pod data downloaded.' : 'Download failed.';
        } catch (err) {
          statusEl.textContent = 'Download request error.';
          outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
        }
      });

      issuedRecordsBtn.addEventListener('click', async () => {
        if (!token) {
          statusEl.textContent = 'Please login with WebID first.';
          return;
        }
        statusEl.textContent = 'Loading issuer pod issued records...';
        try {
          const res = await fetch('/api/pod/issued-records', {
            headers: { Authorization: 'Bearer ' + token }
          });
          const data = await res.json();
          issuedRecordsOutEl.textContent = JSON.stringify(data, null, 2);
          statusEl.textContent = res.ok ? 'Issuer pod record list refreshed.' : 'Issuer pod record list failed.';
        } catch (err) {
          statusEl.textContent = 'Issuer pod record request error.';
          issuedRecordsOutEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
        }
      });

      encryptedStatsBtn.addEventListener('click', async () => {
        if (!token) {
          statusEl.textContent = 'Please login with WebID first.';
          return;
        }
        statusEl.textContent = 'Loading encrypted datastore stats...';
        try {
          const res = await fetch('/api/encrypted-datastore/stats', {
            headers: { Authorization: 'Bearer ' + token }
          });
          const data = await res.json();
          encryptedStatsOutEl.textContent = JSON.stringify(data, null, 2);
          statusEl.textContent = res.ok ? 'Encrypted datastore stats refreshed.' : 'Encrypted datastore stats failed.';
        } catch (err) {
          statusEl.textContent = 'Encrypted datastore stats error.';
          encryptedStatsOutEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
        }
      });

      if (grantConsentBtn) {
        grantConsentBtn.addEventListener('click', async () => {
          if (!token) {
            statusEl.textContent = 'Please login with WebID first.';
            return;
          }
          statusEl.textContent = 'Granting consent...';
          try {
            const res = await fetch('/api/records/consent/grant', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token
              },
              body: JSON.stringify({
                recordId: (consentRecordIdEl && consentRecordIdEl.value || '').trim(),
                requesterWebId: (consentRequesterWebIdEl && consentRequesterWebIdEl.value || '').trim(),
                purpose: (consentPurposeEl && consentPurposeEl.value || '').trim(),
                expiresInHours: Number((consentHoursEl && consentHoursEl.value || '').trim() || 24)
              })
            });
            const data = await res.json();
            outEl.textContent = JSON.stringify(data, null, 2);
            statusEl.textContent = res.ok ? 'Consent granted.' : 'Consent grant failed.';
          } catch (err) {
            statusEl.textContent = 'Consent grant request error.';
            outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
          }
        });
      }

      if (revokeConsentBtn) {
        revokeConsentBtn.addEventListener('click', async () => {
          if (!token) {
            statusEl.textContent = 'Please login with WebID first.';
            return;
          }
          statusEl.textContent = 'Revoking consent...';
          try {
            const res = await fetch('/api/records/consent/revoke', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token
              },
              body: JSON.stringify({
                recordId: (consentRecordIdEl && consentRecordIdEl.value || '').trim(),
                requesterWebId: (consentRequesterWebIdEl && consentRequesterWebIdEl.value || '').trim()
              })
            });
            const data = await res.json();
            outEl.textContent = JSON.stringify(data, null, 2);
            statusEl.textContent = res.ok ? 'Consent revoked.' : 'Consent revoke failed.';
          } catch (err) {
            statusEl.textContent = 'Consent revoke request error.';
            outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
          }
        });
      }

      if (agencyGrantBtn) {
        agencyGrantBtn.addEventListener('click', async () => {
          if (!token) {
            statusEl.textContent = 'Please login with WebID first.';
            return;
          }
          statusEl.textContent = 'Granting inter-agency access...';
          try {
            const res = await fetch('/api/sharing/grant', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token
              },
              body: JSON.stringify({
                targetAgencyDid: (agencyTargetDidEl && agencyTargetDidEl.value || '').trim(),
                scope: (agencyScopeEl && agencyScopeEl.value || '').trim() || 'subject_records',
                expiresInHours: Number((agencyHoursEl && agencyHoursEl.value || '').trim() || 24)
              })
            });
            const data = await res.json();
            outEl.textContent = JSON.stringify(data, null, 2);
            statusEl.textContent = res.ok ? 'Inter-agency grant created.' : 'Inter-agency grant failed.';
          } catch (err) {
            statusEl.textContent = 'Inter-agency grant error.';
            outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
          }
        });
      }

      if (agencyRevokeBtn) {
        agencyRevokeBtn.addEventListener('click', async () => {
          if (!token) {
            statusEl.textContent = 'Please login with WebID first.';
            return;
          }
          statusEl.textContent = 'Revoking inter-agency access...';
          try {
            const res = await fetch('/api/sharing/revoke', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token
              },
              body: JSON.stringify({
                targetAgencyDid: (agencyTargetDidEl && agencyTargetDidEl.value || '').trim(),
                scope: (agencyScopeEl && agencyScopeEl.value || '').trim() || 'subject_records'
              })
            });
            const data = await res.json();
            outEl.textContent = JSON.stringify(data, null, 2);
            statusEl.textContent = res.ok ? 'Inter-agency access revoked.' : 'Inter-agency revoke failed.';
          } catch (err) {
            statusEl.textContent = 'Inter-agency revoke error.';
            outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
          }
        });
      }

      if (agencyListBtn) {
        agencyListBtn.addEventListener('click', async () => {
          if (!token) {
            statusEl.textContent = 'Please login with WebID first.';
            return;
          }
          statusEl.textContent = 'Loading inter-agency grants...';
          try {
            const res = await fetch('/api/sharing/grants', {
              headers: { Authorization: 'Bearer ' + token }
            });
            const data = await res.json();
            outEl.textContent = JSON.stringify(data, null, 2);
            statusEl.textContent = res.ok ? 'Inter-agency grants loaded.' : 'Inter-agency grants request failed.';
          } catch (err) {
            statusEl.textContent = 'Inter-agency grants request error.';
            outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
          }
        });
      }
    })();
  </script>`;
};

const handleLoginWebId = async (req, res) => {
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const webId = String(body.webId || '').trim();

    if (!webId) {
      json(res, 400, { ok: false, error: 'webId is required' });
      return;
    }

    const verification = await verifyIdentityWithSovereign(webId);
    if (!verification.ok) {
      json(res, 403, {
        ok: false,
        error: 'webId verification failed',
        reason: verification.reason
      });
      return;
    }

    const token = crypto.randomUUID();
    const subjectDid = deriveSubjectDidFromWebId(webId);
    sessions.set(token, {
      webId,
      subjectDid,
      createdAt: new Date().toISOString(),
      verification: verification.verification,
      matchedCredentialType: verification.matchedCredentialType
    });

    json(res, 200, {
      ok: true,
      token,
      issuer: siteProfile.issuerName,
      authenticatedWebId: webId,
      subjectDid,
      matchedCredentialType: verification.matchedCredentialType,
      verification: verification.verification,
      availableActions: scopedActions
    });
  } catch (err) {
    json(res, 500, { ok: false, error: 'webid login request failed', detail: err.message });
  }
};

const handleActions = (req, res) => {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  json(res, 200, {
    ok: true,
    issuer: siteProfile.issuerName,
    authenticatedWebId: session.webId,
    actions: scopedActions
  });
};

const handlePodDataDownload = (req, res) => {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  json(res, 200, {
    ok: true,
    issuer: siteProfile.issuerName,
    authenticatedWebId: session.webId,
    accessGrantedBy: `${session.matchedCredentialType || 'IdentityCredential'} on sovereign pod`,
    podData: siteProfile.podData
  });
};

const handleIssuerPodIssuedRecords = async (req, res) => {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  const summary = await listIssuerPodIssuedRecordsSummary();
  if (!summary.ok) {
    json(res, 500, {
      ok: false,
      issuer: siteProfile.issuerName,
      authenticatedWebId: session.webId,
      error: 'failed to read issuer pod issued records',
      reason: summary.reason
    });
    return;
  }

  json(res, 200, {
    ok: true,
    issuer: siteProfile.issuerName,
    authenticatedWebId: session.webId,
    ...summary
  });
};

const handleEncryptedDatastoreStats = (req, res) => {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  const activeConsentCount = Array.from(doctorRecordConsentGrants.values()).reduce((count, grants) =>
    count + grants.filter((grant) => grant.status === 'active').length, 0);

  json(res, 200, {
    ok: true,
    issuer: siteProfile.issuerName,
    authenticatedWebId: session.webId,
    encryptedDatastore: {
      enabled: siteDir === 'doctors-office',
      recordsStored: encryptedDatastoreStats.recordsStored,
      fetchAttempts: encryptedDatastoreStats.fetchAttempts,
      fetchAllowed: encryptedDatastoreStats.fetchAllowed,
      fetchDenied: encryptedDatastoreStats.fetchDenied,
      consentGrantsIssued: encryptedDatastoreStats.consentGrantsIssued,
      consentGrantsRevoked: encryptedDatastoreStats.consentGrantsRevoked,
      activeConsentCount,
      lastUpdatedAt: encryptedDatastoreStats.lastUpdatedAt
    }
  });
};

const handleListInterAgencyConsents = (req, res) => {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }
  const subjectDid = session.subjectDid || deriveSubjectDidFromWebId(session.webId);
  const grants = interAgencyConsentGrantsBySubject.get(subjectDid) || [];
  json(res, 200, {
    ok: true,
    issuer: siteProfile.issuerName,
    authenticatedWebId: session.webId,
    subjectDid,
    grants
  });
};

const handleGrantInterAgencyConsent = async (req, res) => {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const targetAgencyDid = String(body.targetAgencyDid || '').trim();
    const scope = String(body.scope || 'subject_records').trim();
    const expiresInHours = Number(body.expiresInHours || 24);
    if (!targetAgencyDid) {
      json(res, 400, { ok: false, error: 'targetAgencyDid is required' });
      return;
    }

    const subjectDid = session.subjectDid || deriveSubjectDidFromWebId(session.webId);
    const expiryHours = Number.isFinite(expiresInHours) && expiresInHours > 0 ? expiresInHours : 24;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
    const grant = grantInterAgencyConsent({
      subjectDid,
      targetAgencyDid,
      scope,
      grantedByWebId: session.webId,
      expiresAt
    });

    json(res, 200, {
      ok: true,
      issuer: siteProfile.issuerName,
      authenticatedWebId: session.webId,
      subjectDid,
      grant
    });
  } catch (err) {
    json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
  }
};

const handleRevokeInterAgencyConsent = async (req, res) => {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const grantId = String(body.grantId || '').trim();
    const targetAgencyDid = String(body.targetAgencyDid || '').trim();
    const scope = String(body.scope || '').trim();
    const subjectDid = session.subjectDid || deriveSubjectDidFromWebId(session.webId);
    const revokedCount = revokeInterAgencyConsent({
      subjectDid,
      grantId: grantId || null,
      targetAgencyDid: targetAgencyDid || null,
      scope: scope || null,
      revokedByWebId: session.webId
    });

    json(res, 200, {
      ok: true,
      issuer: siteProfile.issuerName,
      authenticatedWebId: session.webId,
      subjectDid,
      revokedCount
    });
  } catch (err) {
    json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
  }
};

const handleExportSharedSubjectRecords = async (req, res) => {
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const subjectDid = String(body.subjectDid || '').trim();
    const targetAgencyDid = String(body.targetAgencyDid || '').trim();
    const scope = String(body.scope || 'subject_records').trim();
    if (!subjectDid) {
      json(res, 400, { ok: false, error: 'subjectDid is required' });
      return;
    }
    if (!targetAgencyDid) {
      json(res, 400, { ok: false, error: 'targetAgencyDid is required' });
      return;
    }

    const grant = findActiveInterAgencyConsent({ subjectDid, targetAgencyDid, scope });
    if (!grant) {
      json(res, 403, {
        ok: false,
        error: 'sovereign inter-agency consent required before export',
        subjectDid,
        targetAgencyDid,
        scope
      });
      return;
    }

    const records = await listIssuerPodRecordsForSubject(subjectDid);
    if (!records.ok) {
      json(res, 500, {
        ok: false,
        error: 'failed to load issuer subject records',
        reason: records.reason
      });
      return;
    }

    const sealedExport = sealPayloadForSovereign(
      {
        ownerIssuerDid: issuerDid,
        issuerName: siteProfile.issuerName,
        subjectDid,
        scope,
        records
      },
      {
        exportedAt: new Date().toISOString(),
        targetAgencyDid,
        consentGrantId: grant.id
      }
    );

    json(res, 200, {
      ok: true,
      issuer: siteProfile.issuerName,
      ownerIssuerDid: issuerDid,
      subjectDid,
      targetAgencyDid,
      scope,
      grantedBy: {
        grantId: grant.id,
        grantedByWebId: grant.grantedByWebId,
        grantedAt: grant.grantedAt,
        expiresAt: grant.expiresAt
      },
      export: sealedExport
    });
  } catch (err) {
    json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
  }
};

const handleGrantDoctorRecordConsent = async (req, res) => {
  if (siteDir !== 'doctors-office') {
    json(res, 404, { ok: false, error: 'consent management is only available for doctors-office issuer' });
    return;
  }

  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const recordId = String(body.recordId || '').trim();
    const requesterWebId = String(body.requesterWebId || '').trim();
    const purpose = String(body.purpose || 'medical-claim-review').trim();
    const expiresInHours = Number(body.expiresInHours || 24);
    if (!recordId) {
      json(res, 400, { ok: false, error: 'recordId is required' });
      return;
    }
    if (!requesterWebId) {
      json(res, 400, { ok: false, error: 'requesterWebId is required' });
      return;
    }

    const stored = doctorRecords.get(recordId);
    if (!stored) {
      json(res, 404, { ok: false, error: 'record not found at doctor pod', recordId });
      return;
    }
    if (stored.subjectDid !== session.subjectDid) {
      json(res, 403, { ok: false, error: 'only the sovereign subject can grant consent for this record' });
      return;
    }

    const expiryHours = Number.isFinite(expiresInHours) && expiresInHours > 0 ? expiresInHours : 24;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
    const grant = issueDoctorRecordConsentGrant({
      recordId,
      subjectDid: session.subjectDid,
      grantedByWebId: session.webId,
      requesterWebId,
      purpose,
      expiresAt
    });

    const issuedAt = new Date().toISOString();
    const consentCredential = {
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'RecordAccessConsentCredential'],
      issuer: { id: issuerDid, name: siteProfile.issuerName },
      issuanceDate: issuedAt,
      validFrom: issuedAt,
      expirationDate: expiresAt,
      credentialSubject: {
        id: session.subjectDid,
        recordId,
        requesterWebId,
        purpose,
        consentGrantId: grant.id,
        grantedByWebId: session.webId
      }
    };
    consentCredential.proof = {
      type: 'MockIssuerSignature2026',
      created: issuedAt,
      verificationMethod: `${issuerDid}#key-1`,
      proofPurpose: 'assertionMethod',
      jws: hashString(`${siteDir}:grant_record_consent:${recordId}:${requesterWebId}:${expiresAt}`)
    };
    applyRelationshipMetadata({
      credential: consentCredential,
      actionId: 'grant_record_consent',
      actorMode: 'self_service',
      sessionWebId: session.webId,
      subjectDid: session.subjectDid,
      recordCustody: {
        fullRecordLocation: 'issuer_pod_encrypted_store',
        subjectProofLocation: 'sovereign_pod'
      },
      lifecycleStatus: 'active'
    });
    const proofStore = await storeCredentialProofToSovereign(session.webId, consentCredential);

    json(res, 200, {
      ok: true,
      issuer: siteProfile.issuerName,
      authenticatedWebId: session.webId,
      subjectDid: session.subjectDid,
      recordId,
      grant,
      sovereignProofStorage: proofStore.ok ? proofStore : { ok: false, reason: proofStore.reason || 'not stored' }
    });
  } catch (err) {
    json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
  }
};

const handleRevokeDoctorRecordConsent = async (req, res) => {
  if (siteDir !== 'doctors-office') {
    json(res, 404, { ok: false, error: 'consent management is only available for doctors-office issuer' });
    return;
  }

  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const recordId = String(body.recordId || '').trim();
    const requesterWebId = String(body.requesterWebId || '').trim();
    if (!recordId) {
      json(res, 400, { ok: false, error: 'recordId is required' });
      return;
    }

    const stored = doctorRecords.get(recordId);
    if (!stored) {
      json(res, 404, { ok: false, error: 'record not found at doctor pod', recordId });
      return;
    }
    if (stored.subjectDid !== session.subjectDid) {
      json(res, 403, { ok: false, error: 'only the sovereign subject can revoke consent for this record' });
      return;
    }

    const revokedCount = revokeDoctorRecordConsentGrant({
      recordId,
      requesterWebId: requesterWebId || null,
      revokedByWebId: session.webId
    });

    json(res, 200, {
      ok: true,
      issuer: siteProfile.issuerName,
      authenticatedWebId: session.webId,
      recordId,
      requesterWebId: requesterWebId || null,
      revokedCount
    });
  } catch (err) {
    json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
  }
};

const handleCommand = async (req, res) => {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};

    const actionId = String(body.actionId || '').trim();
    const action = scopedActions.find((a) => a.id === actionId);
    if (!action) {
      json(res, 400, { ok: false, error: 'invalid actionId' });
      return;
    }

    const subjectDid = session.subjectDid || deriveSubjectDidFromWebId(session.webId);
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};
    const actorMode = String(body.actorMode || '').trim();
    let issuerBusinessCheck = null;
    if (siteDir === 'car-repair-shop') {
      issuerBusinessCheck = await fetchIssuerBusinessRegistrationCredential();
      if (!issuerBusinessCheck.ok) {
        json(res, 403, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'active issuer business registration credential required before transactions',
          reason: issuerBusinessCheck.reason,
          issuerWebId: issuerBusinessCheck.issuerWebId || issuerWebId || null,
          trustedBusinessRegistryVerifierDids: issuerBusinessCheck.trustedIssuers || trustedIssuersForType('BusinessRegistrationCredential'),
          guidance: 'Issue BusinessRegistrationCredential from Business Registry Verifier (8097) to issuer webid and retry.'
        });
        return;
      }
    }
    const issuerBusinessSummary = siteDir === 'car-repair-shop' ? issuerBusinessCheck?.summary || null : null;

    if (siteDir === 'doctors-office' && actionId === 'request_xray') {
      const identityCheck = await verifyIdentityWithSovereign(session.webId);
      if (!identityCheck.ok) {
        json(res, 403, {
          ok: false,
          error: 'valid identity credential required before xray request',
          reason: identityCheck.reason
        });
        return;
      }

      const selfPresenceCheck = await verifyCredentialWithSovereign(session.webId, 'SelfPresenceCredential', []);
      if (!selfPresenceCheck.ok) {
        json(res, 403, {
          ok: false,
          error: 'self presence credential required before xray request',
          reason: selfPresenceCheck.reason
        });
        return;
      }

      const requestedAt = new Date().toISOString();
      const xrayDocument =
        payload.xrayDocument && typeof payload.xrayDocument === 'object'
          ? payload.xrayDocument
          : { category: 'general-radiology-request' };
      const recordId = `xray-${crypto.randomUUID()}`;
      const recordPayload = {
        recordId,
        recordType: 'xray',
        subjectDid,
        webId: session.webId,
        xrayDocument,
        requestedAt,
        ticket: {
          id: `xray-ticket-${crypto.randomUUID()}`,
          room: 'Radiology-Room-2',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        },
        verification: {
          identity: identityCheck.verification,
          selfPresence: selfPresenceCheck.verification
        },
        issuer: {
          id: issuerDid,
          name: siteProfile.issuerName
        }
      };
      const recordDigest = hashString(JSON.stringify(recordPayload));
      const recordSignature = hashString(`${siteDir}:xray-record:${recordId}:${recordDigest}`);
      const baseUrl = `http://${req.headers.host || `localhost:${port}`}`;
      const { vc: recordLinkCredential, linkProofJws } = createDoctorRecordLinkCredential({
        subjectDid,
        recordId,
        recordDigest,
        issuedAt: requestedAt,
        baseUrl,
        relationshipMetadata: {
          actionId,
          actorMode,
          sessionWebId: session.webId,
          verificationDependencies: [
            { credentialType: 'DriversLicenseCredential', policy: 'one_of', requiredFlags: ['isOver18', 'isOver21'] },
            { credentialType: 'PassportCredential', policy: 'one_of' },
            { credentialType: 'SelfPresenceCredential', policy: 'required' }
          ]
        }
      });

      doctorRecords.set(recordId, {
        ...recordPayload,
        recordDigest,
        recordSignature,
        linkProofJws
      });
      const doctorPodStore = await storeDoctorRecordToIssuerPod({
        recordId,
        recordPayload,
        recordDigest,
        recordSignature,
        subjectDid,
        webId: session.webId
      });
      if (!doctorPodStore.ok) {
        json(res, 500, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'doctor record must be stored in doctor pod',
          reason: doctorPodStore.reason
        });
        return;
      }
      recordEncryptedDoctorPayload({
        recordId,
        payload: recordPayload,
        subjectDid,
        webId: session.webId,
        recordType: 'xray'
      });

      const proofStore = await storeCredentialProofToSovereign(session.webId, recordLinkCredential);
      if (!proofStore.ok) {
        json(res, 500, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'xray proof credential must be stored in sovereign pod',
          reason: proofStore.reason,
          recordStoredAtDoctorPod: true,
          recordCopiedToSovereignPod: false,
          doctorRecordReference: {
            recordId,
            recordType: 'xray'
          }
        });
        return;
      }

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        requestType: 'xray',
        status: 'authorized',
        requirement: 'DriversLicenseCredential (isOver18 + isOver21) OR PassportCredential, plus SelfPresenceCredential',
        matchedIdentityCredential: identityCheck.matchedCredentialType,
        subjectDid,
        xrayDocument,
        requestedAt,
        recordStoredAtDoctorPod: true,
        recordCopiedToSovereignPod: true,
        doctorPodStorage: doctorPodStore,
        sovereignProofStorage: {
          walletUrl: proofStore.walletUrl,
          credentialCount: proofStore.count
        },
        doctorRecordReference: {
          recordId,
          recordType: 'xray',
          resolutionModel: 'holder shares signed link credential; verifier fetches from doctor',
          fetchEndpoint: `${baseUrl}/api/records/fetch`,
          verifyEndpoint: `${baseUrl}/api/records/verify`
        },
        recordLinkCredential
      });
      return;
    }

    if (siteDir === 'doctors-office' && actionId === 'draw_blood') {
      const issuedAt = new Date().toISOString();
      const orderDocument =
        payload.orderDocument && typeof payload.orderDocument === 'object'
          ? payload.orderDocument
          : { category: 'standard-bloodwork-panel' };

      const issuedCredential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', 'BloodworkResultCredential'],
        issuer: {
          id: `did:example:issuer:${siteDir}`,
          name: siteProfile.issuerName
        },
        issuanceDate: issuedAt,
        validFrom: issuedAt,
        credentialSubject: {
          id: subjectDid,
          webId: session.webId,
          specimenType: 'venous-blood',
          panelName: 'CBC and Basic Metabolic Panel',
          resultStatus: 'final',
          collectedAt: issuedAt,
          labResults: {
            hemoglobin_g_dL: 14.2,
            wbc_k_uL: 6.4,
            platelets_k_uL: 265,
            glucose_mg_dL: 96,
            sodium_mmol_L: 139,
            potassium_mmol_L: 4.3
          },
          note: orderDocument.notes || 'Mock bloodwork result for demo'
        }
      };
      issuedCredential.proof = {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `did:example:issuer:${siteDir}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: crypto.createHash('sha256').update(`${siteDir}:draw_blood:${issuedAt}:${subjectDid}`).digest('base64url')
      };
      applyRelationshipMetadata({
        credential: issuedCredential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'issuer_pod',
          subjectProofLocation: 'sovereign_pod'
        }
      });

      const proofStore = await storeCredentialProofToSovereign(session.webId, issuedCredential);
      if (!proofStore.ok) {
        json(res, 500, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'doctor-issued proof must be stored in sovereign pod',
          reason: proofStore.reason
        });
        return;
      }

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        status: 'completed',
        requirement: 'No ID credential required for demo draw-blood action',
        subjectDid,
        bloodworkDocument: orderDocument,
        issuedAt,
        result: {
          id: `bloodwork-result-${crypto.randomUUID()}`,
          lab: 'Clinical Lab',
          verifiedAt: issuedAt
        },
        sovereignProofStorage: {
          walletUrl: proofStore.walletUrl,
          credentialCount: proofStore.count
        },
        credential: issuedCredential
      });
      return;
    }

    if (siteDir === 'doctors-office' && actionId === 'issue_allergy_profile') {
      const issuedAt = new Date().toISOString();
      const allergies = Array.isArray(payload.allergies) && payload.allergies.length > 0 ? payload.allergies : ['penicillin'];
      const severity = String(payload.severity || 'moderate').trim();
      const reactionNotes = String(payload.reactionNotes || 'Carries elevated allergy risk').trim();

      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', 'AllergyProfileCredential'],
        issuer: { id: issuerDid, name: siteProfile.issuerName },
        issuanceDate: issuedAt,
        validFrom: issuedAt,
        credentialSubject: {
          id: subjectDid,
          webId: session.webId,
          allergies,
          severity,
          reactionNotes,
          issuedByClinic: siteProfile.issuerName
        }
      };
      credential.proof = {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `${issuerDid}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: hashString(`${siteDir}:issue_allergy_profile:${issuedAt}:${subjectDid}:${JSON.stringify(allergies)}`)
      };
      applyRelationshipMetadata({
        credential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'issuer_pod',
          subjectProofLocation: 'sovereign_pod'
        }
      });

      const proofStore = await storeCredentialProofToSovereign(session.webId, credential);
      if (!proofStore.ok) {
        json(res, 500, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'doctor-issued proof must be stored in sovereign pod',
          reason: proofStore.reason
        });
        return;
      }

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        status: 'completed',
        subjectDid,
        sovereignProofStorage: {
          walletUrl: proofStore.walletUrl,
          credentialCount: proofStore.count
        },
        credential
      });
      return;
    }

    if (siteDir === 'car-repair-shop' && actionId === 'issue_shop_access_badge') {
      const issuedAt = new Date().toISOString();
      const badgeId = String(payload.badgeId || `dirigo-badge-${Math.floor(Math.random() * 1000000)}`).trim();
      const zone = String(payload.zone || 'shop-floor').trim();
      const validUntil = String(payload.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
      const credentialId = `urn:uuid:${crypto.randomUUID()}`;

      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: credentialId,
        type: ['VerifiableCredential', 'ShopAccessBadgeCredential'],
        issuer: { id: issuerDid, name: siteProfile.issuerName },
        issuanceDate: issuedAt,
        validFrom: issuedAt,
        credentialSubject: {
          id: subjectDid,
          webId: session.webId,
          badgeId,
          zone,
          status: 'active',
          validUntil
        }
      };
      credential.proof = {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `${issuerDid}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: hashString(`${siteDir}:issue_shop_access_badge:${issuedAt}:${subjectDid}:${badgeId}`)
      };
      attachIssuerBusinessProof(credential, issuerBusinessCheck);
      applyRelationshipMetadata({
        credential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'issuer_service_memory',
          subjectProofLocation: 'response_only'
        }
      });

      issuedAccessBadges.set(credentialId, {
        credentialId,
        subjectDid,
        badgeId,
        zone,
        issuedAt,
        validUntil,
        status: 'active'
      });

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        status: 'completed',
        subjectDid,
        issuerBusinessRegistration: issuerBusinessSummary,
        credential
      });
      return;
    }

    if (siteDir === 'car-repair-shop' && actionId === 'revoke_access_badge') {
      const credentialId = String(payload.credentialId || '').trim();
      if (!credentialId) {
        json(res, 400, { ok: false, error: 'payload.credentialId is required to revoke access badge' });
        return;
      }

      const existing = issuedAccessBadges.get(credentialId);
      if (!existing) {
        json(res, 404, { ok: false, error: 'credential not found for revocation', credentialId });
        return;
      }

      const revokedAt = new Date().toISOString();
      revokedCredentialIds.set(credentialId, {
        revokedAt,
        reason: String(payload.reason || 'access-revoked').trim(),
        subjectDid: existing.subjectDid
      });
      issuedAccessBadges.set(credentialId, {
        ...existing,
        status: 'revoked'
      });

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        credentialId,
        status: 'revoked',
        revokedAt
      });
      return;
    }

    if (siteDir === 'car-repair-shop' && actionId === 'verify_access_badge') {
      const credentialId = String(payload.credentialId || '').trim();
      if (!credentialId) {
        json(res, 400, { ok: false, error: 'payload.credentialId is required to verify access badge' });
        return;
      }

      const existing = issuedAccessBadges.get(credentialId);
      if (!existing) {
        json(res, 404, { ok: false, error: 'credential not found', credentialId });
        return;
      }

      const revoked = revokedCredentialIds.get(credentialId);
      const valid = !revoked;
      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        credentialId,
        valid,
        status: valid ? 'active' : 'revoked',
        revocation: revoked || null
      });
      return;
    }

    if (siteDir === 'national-metal-works' && actionId === 'issue_employee_status') {
      const issuedAt = new Date().toISOString();
      const employeeId = String(payload.employeeId || `nmw-${Math.floor(Math.random() * 100000)}`).trim();
      const employmentStatus = String(payload.employmentStatus || 'active').trim();
      const department = String(payload.department || 'operations').trim();

      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', 'EmployeeStatusCredential'],
        issuer: { id: issuerDid, name: siteProfile.issuerName },
        issuanceDate: issuedAt,
        validFrom: issuedAt,
        credentialSubject: {
          id: subjectDid,
          webId: session.webId,
          employeeId,
          employmentStatus,
          employer: 'Buffalo Mountain Metal Works',
          department
        }
      };
      credential.proof = {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `${issuerDid}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: hashString(`${siteDir}:issue_employee_status:${issuedAt}:${subjectDid}:${employeeId}`)
      };
      applyRelationshipMetadata({
        credential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'issuer_pod',
          subjectProofLocation: 'issuer_pod'
        }
      });

      const issuerStore = await storeCredentialToIssuerPod({
        credential,
        subjectDid,
        webId: session.webId,
        actionId
      });
      if (!issuerStore.ok) {
        json(res, 500, { ok: false, error: 'failed to store credential in issuer pod', reason: issuerStore.reason });
        return;
      }

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        status: 'completed',
        subjectDid,
        issuerPodStorage: issuerStore,
        credential
      });
      return;
    }

    if (siteDir === 'national-metal-works' && actionId === 'issue_facility_access_badge') {
      const identityCheck = await verifyIdentityWithSovereign(session.webId);
      if (!identityCheck.ok) {
        json(res, 403, { ok: false, error: 'identity credential required for facility badge', reason: identityCheck.reason });
        return;
      }

      const itarCheck = await verifyCredentialWithSovereign(session.webId, 'ITARComplianceCredential', []);
      if (!itarCheck.ok) {
        json(res, 403, { ok: false, error: 'itar credential required for facility badge', reason: itarCheck.reason });
        return;
      }

      const presenceCheck = await verifyCredentialWithSovereign(session.webId, 'SelfPresenceCredential', []);
      if (!presenceCheck.ok) {
        json(res, 403, { ok: false, error: 'self presence credential required for facility badge', reason: presenceCheck.reason });
        return;
      }

      const issuedAt = new Date().toISOString();
      const badgeId = String(payload.badgeId || `dwm-badge-${Math.floor(Math.random() * 1000000)}`).trim();
      const zone = String(payload.zone || 'controlled-zone-a').trim();
      const validUntil = String(payload.validUntil || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', 'FacilityAccessBadgeCredential'],
        issuer: { id: issuerDid, name: siteProfile.issuerName },
        issuanceDate: issuedAt,
        validFrom: issuedAt,
        credentialSubject: {
          id: subjectDid,
          webId: session.webId,
          badgeId,
          zone,
          status: 'active',
          validUntil,
          requiredChecks: ['identity', 'itar', 'self_presence']
        }
      };
      credential.proof = {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `${issuerDid}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: hashString(`${siteDir}:issue_facility_access_badge:${issuedAt}:${subjectDid}:${badgeId}`)
      };
      applyRelationshipMetadata({
        credential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'issuer_pod',
          subjectProofLocation: 'issuer_pod'
        },
        verificationDependencies: [
          { credentialType: 'DriversLicenseCredential', policy: 'one_of', requiredFlags: ['isOver18', 'isOver21'] },
          { credentialType: 'PassportCredential', policy: 'one_of' },
          { credentialType: 'ITARComplianceCredential', policy: 'required' },
          { credentialType: 'SelfPresenceCredential', policy: 'required' }
        ]
      });

      const issuerStore = await storeCredentialToIssuerPod({
        credential,
        subjectDid,
        webId: session.webId,
        actionId
      });
      if (!issuerStore.ok) {
        json(res, 500, { ok: false, error: 'failed to store credential in issuer pod', reason: issuerStore.reason });
        return;
      }

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        status: 'completed',
        subjectDid,
        verification: {
          identity: identityCheck.verification,
          itar: itarCheck.verification,
          selfPresence: presenceCheck.verification
        },
        issuerPodStorage: issuerStore,
        credential
      });
      return;
    }

    if (siteDir === 'national-metal-works' && actionId === 'validate_employee_address_for_benefits') {
      const walletRead = await fetchWalletCredentialsForWebId(session.webId);
      if (!walletRead.ok) {
        json(res, 400, {
          ok: false,
          error: 'could not read sovereign wallet for address validation',
          reason: walletRead.reason
        });
        return;
      }

      const maxAgeDays = Number(payload.maxAgeDays || 90);
      const now = Date.now();
      const trustedUtilityIssuers = trustedIssuersForType('UtilityBillCredential');
      const utility = walletRead.credentials.find((cred) => {
        const types = credentialTypes(cred);
        if (!types.includes('UtilityBillCredential')) return false;
        if (trustedUtilityIssuers.length > 0 && !trustedUtilityIssuers.includes(credentialIssuerDid(cred))) return false;
        const lastPaidDate = cred?.credentialSubject?.lastPaidDate;
        const ms = Date.parse(lastPaidDate || '');
        if (!Number.isFinite(ms)) return false;
        const ageDays = (now - ms) / (24 * 60 * 60 * 1000);
        return ageDays <= maxAgeDays;
      });

      const issuedAt = new Date().toISOString();
      const approved = Boolean(utility);
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', approved ? 'BenefitEligibilityCredential' : 'BenefitEligibilityDeniedCredential'],
        issuer: { id: issuerDid, name: siteProfile.issuerName },
        issuanceDate: issuedAt,
        validFrom: issuedAt,
        credentialSubject: {
          id: subjectDid,
          webId: session.webId,
          benefit: 'address-based-benefit',
          status: approved ? 'eligible' : 'ineligible',
          maxAgeDays,
          evaluatedAt: issuedAt
        }
      };
      credential.proof = {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `${issuerDid}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: hashString(`${siteDir}:validate_employee_address_for_benefits:${issuedAt}:${subjectDid}:${approved}`)
      };
      applyRelationshipMetadata({
        credential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'issuer_pod',
          subjectProofLocation: 'issuer_pod'
        },
        verificationDependencies: [
          { credentialType: 'UtilityBillCredential', policy: 'required' }
        ],
        trustSources: [
          {
            credentialType: 'UtilityBillCredential',
            trustedIssuerDids: trustedUtilityIssuers
          }
        ]
      });

      const issuerStore = await storeCredentialToIssuerPod({
        credential,
        subjectDid,
        webId: session.webId,
        actionId
      });
      if (!issuerStore.ok) {
        json(res, 500, { ok: false, error: 'failed to store credential in issuer pod', reason: issuerStore.reason });
        return;
      }

      json(res, approved ? 200 : 403, {
        ok: approved,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        subjectDid,
        decision: approved ? 'eligible' : 'ineligible',
        checkedCredentialType: 'UtilityBillCredential',
        issuerPodStorage: issuerStore,
        credential
      });
      return;
    }

    if (siteDir === 'national-metal-works' && actionId === 'issue_season_ticket_entitlement') {
      const issuedAt = new Date().toISOString();
      const seasonYear = Number(payload.seasonYear || new Date().getUTCFullYear());
      const validFrom = String(payload.validFrom || `${seasonYear}-03-01T00:00:00.000Z`);
      const validUntil = String(payload.validUntil || `${seasonYear}-11-30T23:59:59.000Z`);
      const benefitType = String(payload.benefitType || 'tricities-baseball-season').trim();
      const ticketClass = String(payload.ticketClass || 'general').trim();

      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', 'SeasonTicketEntitlementCredential'],
        issuer: { id: issuerDid, name: siteProfile.issuerName },
        issuanceDate: issuedAt,
        validFrom: issuedAt,
        credentialSubject: {
          id: subjectDid,
          webId: session.webId,
          employer: 'Buffalo Mountain Metal Works',
          benefitType,
          seasonYear,
          ticketClass,
          entitlementStatus: 'active',
          benefitIssuer: 'Buffalo Mountain Metal Works',
          redeemableAt: 'Boone Lake Sports Park',
          validFrom,
          validUntil
        }
      };
      credential.proof = {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `${issuerDid}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: hashString(`${siteDir}:issue_season_ticket_entitlement:${issuedAt}:${subjectDid}:${seasonYear}:${ticketClass}`)
      };
      applyRelationshipMetadata({
        credential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'issuer_pod',
          subjectProofLocation: 'issuer_pod'
        }
      });

      const issuerStore = await storeCredentialToIssuerPod({
        credential,
        subjectDid,
        webId: session.webId,
        actionId
      });
      if (!issuerStore.ok) {
        json(res, 500, { ok: false, error: 'failed to store credential in issuer pod', reason: issuerStore.reason });
        return;
      }

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        status: 'completed',
        subjectDid,
        issuerPodStorage: issuerStore,
        credential
      });
      return;
    }

    if (siteDir === 'sports-park' && actionId === 'redeem_employee_season_ticket') {
      const walletRead = await fetchWalletCredentialsForWebId(session.webId);
      if (!walletRead.ok) {
        json(res, 400, {
          ok: false,
          error: 'could not read sovereign wallet for entitlement verification',
          reason: walletRead.reason
        });
        return;
      }

      const employeeStatus = walletRead.credentials.find((cred) => {
        const types = credentialTypes(cred);
        const issuer = credentialIssuerDid(cred);
        return types.includes('EmployeeStatusCredential') && issuer === 'did:example:issuer:national-metal-works';
      });

      if (!employeeStatus) {
        json(res, 403, {
          ok: false,
          error: 'missing EmployeeStatusCredential from Buffalo Mountain Metal Works'
        });
        return;
      }

      const entitlement = walletRead.credentials.find((cred) => {
        const types = credentialTypes(cred);
        const issuer = credentialIssuerDid(cred);
        if (!types.includes('SeasonTicketEntitlementCredential') || issuer !== 'did:example:issuer:national-metal-works') {
          return false;
        }
        const subject = cred.credentialSubject || {};
        const from = Date.parse(subject.validFrom || '');
        const until = Date.parse(subject.validUntil || '');
        const now = Date.now();
        if (Number.isFinite(from) && now < from) return false;
        if (Number.isFinite(until) && now > until) return false;
        if (String(subject.entitlementStatus || 'active').toLowerCase() !== 'active') return false;
        return true;
      });

      if (!entitlement) {
        json(res, 403, {
          ok: false,
          error: 'missing active SeasonTicketEntitlementCredential from Buffalo Mountain Metal Works'
        });
        return;
      }

      const issuedAt = new Date().toISOString();
      const eventId = String(payload.eventId || `tricities-game-${new Date().toISOString().slice(0, 10)}`).trim();
      const ticketClass = String(entitlement?.credentialSubject?.ticketClass || payload.ticketClass || 'general').trim();
      const entryStart = String(payload.entryStart || new Date(Date.now() - 30 * 60 * 1000).toISOString());
      const entryEnd = String(payload.entryEnd || new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString());

      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', 'GameEntryCredential'],
        issuer: { id: issuerDid, name: siteProfile.issuerName },
        issuanceDate: issuedAt,
        validFrom: issuedAt,
        credentialSubject: {
          id: subjectDid,
          webId: session.webId,
          eventId,
          venue: 'Boone Lake Sports Park',
          entryWindow: {
            start: entryStart,
            end: entryEnd
          },
          ticketClass,
          sourceEntitlementIssuer: 'did:example:issuer:national-metal-works'
        }
      };
      credential.proof = {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `${issuerDid}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: hashString(`${siteDir}:redeem_employee_season_ticket:${issuedAt}:${subjectDid}:${eventId}:${ticketClass}`)
      };
      applyRelationshipMetadata({
        credential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'sovereign_pod',
          subjectProofLocation: 'sovereign_pod'
        },
        verificationDependencies: [
          { credentialType: 'EmployeeStatusCredential', policy: 'required' },
          { credentialType: 'SeasonTicketEntitlementCredential', policy: 'required' }
        ]
      });

      const proofStore = await storeCredentialProofToSovereign(session.webId, credential);
      if (!proofStore.ok) {
        json(res, 500, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'sports credential must be stored in sovereign pod',
          reason: proofStore.reason
        });
        return;
      }

      const operationalLogEntry = addSportsOperationalLog({
        actionId: action.id,
        subjectDid,
        webId: session.webId,
        credentialId: credential.id,
        credentialType: 'GameEntryCredential',
        eventId
      });

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        status: 'completed',
        verification: {
          employeeStatusVerified: true,
          entitlementVerified: true,
          walletCredentialCount: walletRead.credentials.length
        },
        subjectDid,
        credentialStoredInSovereignPod: true,
        sovereignProofStorage: {
          walletUrl: proofStore.walletUrl,
          credentialCount: proofStore.count
        },
        operationalLogEntry,
        credential
      });
      return;
    }

    if ((siteDir === 'car-repair-shop' || siteDir === 'national-metal-works') && actionId === 'apply_for_employment') {
      const walletRead = await fetchWalletCredentialsForWebId(session.webId);
      if (!walletRead.ok) {
        json(res, 400, {
          ok: false,
          error: 'could not read sovereign wallet for hiring policy checks',
          reason: walletRead.reason
        });
        return;
      }

      const hasDriversLicense = hasCredentialInWallet(
        walletRead.credentials,
        'DriversLicenseCredential',
        trustedIssuersForType('DriversLicenseCredential')
      );
      const hasPassport = hasCredentialInWallet(
        walletRead.credentials,
        'PassportCredential',
        trustedIssuersForType('PassportCredential')
      );
      const hasIdentity = hasDriversLicense || hasPassport;
      const hasItar = hasCredentialInWallet(
        walletRead.credentials,
        'ITARComplianceCredential',
        trustedIssuersForType('ITARComplianceCredential')
      );

      const requiredPolicy =
        siteDir === 'national-metal-works'
          ? 'DriversLicenseCredential OR PassportCredential, plus ITARComplianceCredential'
          : 'DriversLicenseCredential OR PassportCredential';

      const approved = siteDir === 'national-metal-works' ? hasIdentity && hasItar : hasIdentity;
      const issuedAt = new Date().toISOString();
      const employmentId = `${siteDir.replaceAll('-', '_')}-${Math.floor(Math.random() * 1000000)}`;
      const registryKey = `${siteDir}:${subjectDid}`;
      const status = approved ? 'approved' : 'denied';

      if (approved) {
        employmentRegistry.set(registryKey, {
          employmentId,
          siteDir,
          subjectDid,
          webId: session.webId,
          status: 'active',
          hiredAt: issuedAt
        });
      }

      const credentialType = approved ? 'EmploymentOfferCredential' : 'EmploymentDeniedCredential';
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', credentialType],
        issuer: { id: issuerDid, name: siteProfile.issuerName },
        issuanceDate: issuedAt,
        validFrom: issuedAt,
        credentialSubject: {
          id: subjectDid,
          webId: session.webId,
          employmentId,
          employer: siteProfile.issuerName,
          status,
          requiredPolicy,
          checks: {
            hasDriversLicense,
            hasPassport,
            hasItar
          }
        }
      };
      credential.proof = {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `${issuerDid}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: hashString(`${siteDir}:apply_for_employment:${issuedAt}:${subjectDid}:${status}`)
      };
      if (siteDir === 'car-repair-shop') {
        attachIssuerBusinessProof(credential, issuerBusinessCheck);
      }
      applyRelationshipMetadata({
        credential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: siteDir === 'national-metal-works' ? 'issuer_pod' : 'issuer_service_memory',
          subjectProofLocation: siteDir === 'national-metal-works' ? 'issuer_pod' : 'response_only'
        },
        verificationDependencies: [
          { credentialType: 'DriversLicenseCredential', policy: 'one_of' },
          { credentialType: 'PassportCredential', policy: 'one_of' },
          ...(siteDir === 'national-metal-works' ? [{ credentialType: 'ITARComplianceCredential', policy: 'required' }] : [])
        ],
        lifecycleStatus: approved ? 'active' : 'denied'
      });

      let issuerStore = null;
      if (siteDir === 'national-metal-works') {
        issuerStore = await storeCredentialToIssuerPod({
          credential,
          subjectDid,
          webId: session.webId,
          actionId
        });
        if (!issuerStore.ok) {
          json(res, 500, { ok: false, error: 'failed to store credential in issuer pod', reason: issuerStore.reason });
          return;
        }
      }

      json(res, approved ? 200 : 403, {
        ok: approved,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        subjectDid,
        policy: requiredPolicy,
        decision: status,
        issuerBusinessRegistration: issuerBusinessSummary,
        issuerPodStorage: issuerStore,
        credential
      });
      return;
    }

    if ((siteDir === 'car-repair-shop' || siteDir === 'national-metal-works') && actionId === 'terminate_employment') {
      const registryKey = `${siteDir}:${subjectDid}`;
      const current = employmentRegistry.get(registryKey);
      const issuedAt = new Date().toISOString();
      const terminationReason = String(payload.reason || 'voluntary-separation').trim();

      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', 'EmploymentTerminationCredential'],
        issuer: { id: issuerDid, name: siteProfile.issuerName },
        issuanceDate: issuedAt,
        validFrom: issuedAt,
        credentialSubject: {
          id: subjectDid,
          webId: session.webId,
          employmentId: current?.employmentId || null,
          employer: siteProfile.issuerName,
          status: 'terminated',
          reason: terminationReason,
          terminatedAt: issuedAt
        }
      };
      credential.proof = {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `${issuerDid}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: hashString(`${siteDir}:terminate_employment:${issuedAt}:${subjectDid}:${terminationReason}`)
      };
      if (siteDir === 'car-repair-shop') {
        attachIssuerBusinessProof(credential, issuerBusinessCheck);
      }
      applyRelationshipMetadata({
        credential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: siteDir === 'national-metal-works' ? 'issuer_pod' : 'issuer_service_memory',
          subjectProofLocation: siteDir === 'national-metal-works' ? 'issuer_pod' : 'response_only'
        },
        lifecycleStatus: 'terminated'
      });

      employmentRegistry.set(registryKey, {
        employmentId: current?.employmentId || `${siteDir.replaceAll('-', '_')}-${Math.floor(Math.random() * 1000000)}`,
        siteDir,
        subjectDid,
        webId: session.webId,
        status: 'terminated',
        terminatedAt: issuedAt
      });

      let issuerStore = null;
      if (siteDir === 'national-metal-works') {
        issuerStore = await storeCredentialToIssuerPod({
          credential,
          subjectDid,
          webId: session.webId,
          actionId
        });
        if (!issuerStore.ok) {
          json(res, 500, { ok: false, error: 'failed to store credential in issuer pod', reason: issuerStore.reason });
          return;
        }
      }

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        subjectDid,
        previousStatus: current?.status || 'none',
        currentStatus: 'terminated',
        issuerBusinessRegistration: issuerBusinessSummary,
        issuerPodStorage: issuerStore,
        credential
      });
      return;
    }

    if (siteDir === 'assistance-charity' && (actionId === 'process_food_assistance' || actionId === 'process_housing_assistance')) {
      const walletRead = await fetchWalletCredentialsForWebId(session.webId);
      if (!walletRead.ok) {
        json(res, 400, {
          ok: false,
          error: 'could not read sovereign wallet for assistance checks',
          reason: walletRead.reason
        });
        return;
      }

      const trustedUtilityIssuers = trustedIssuersForType('UtilityBillCredential');
      const utilityBill = walletRead.credentials.find((cred) => {
        const types = credentialTypes(cred);
        if (!types.includes('UtilityBillCredential')) return false;
        if (trustedUtilityIssuers.length > 0 && !trustedUtilityIssuers.includes(credentialIssuerDid(cred))) return false;
        return true;
      });

      const decision = Boolean(utilityBill);
      const issuedAt = new Date().toISOString();
      const program = actionId === 'process_food_assistance' ? 'food_assistance' : 'housing_assistance';
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: [
          'VerifiableCredential',
          decision ? 'AssistanceEligibilityCredential' : 'AssistanceEligibilityDeniedCredential'
        ],
        issuer: { id: issuerDid, name: siteProfile.issuerName },
        issuanceDate: issuedAt,
        validFrom: issuedAt,
        credentialSubject: {
          id: subjectDid,
          webId: session.webId,
          program,
          status: decision ? 'approved' : 'denied',
          requiredDocuments: ['DriversLicenseCredential OR PassportCredential', 'UtilityBillCredential'],
          reviewedAt: issuedAt
        }
      };
      credential.proof = {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `${issuerDid}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: hashString(`${siteDir}:${actionId}:${issuedAt}:${subjectDid}:${decision}`)
      };
      applyRelationshipMetadata({
        credential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'sovereign_pod',
          subjectProofLocation: 'sovereign_pod'
        },
        verificationDependencies: [
          { credentialType: 'UtilityBillCredential', policy: 'required' }
        ],
        trustSources: [
          {
            credentialType: 'UtilityBillCredential',
            trustedIssuerDids: trustedUtilityIssuers
          }
        ],
        lifecycleStatus: decision ? 'active' : 'denied'
      });

      const proofStore = await storeCredentialProofToSovereign(session.webId, credential);
      if (!proofStore.ok) {
        json(res, 500, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'assistance decision credential must be stored in sovereign pod',
          reason: proofStore.reason
        });
        return;
      }

      json(res, decision ? 200 : 403, {
        ok: decision,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        subjectDid,
        decision: decision ? 'approved' : 'denied',
        checkedCredentialType: 'UtilityBillCredential',
        sovereignProofStorage: {
          walletUrl: proofStore.walletUrl,
          credentialCount: proofStore.count
        },
        credential
      });
      return;
    }

    const issuedAt = new Date().toISOString();
    const { issuedCredential, template } = buildCredentialFromActionTemplate({
      action,
      payload,
      subjectDid,
      webId: session.webId,
      issuedAt,
      actorMode
    });
    const storagePolicy = String(template.storage || '').trim().toLowerCase();
    const templateDependencies = normalizeDependencies(template.verificationDependencies);
    const templateTrustSources = Array.isArray(template.trustSources) ? template.trustSources : [];
    if (siteDir === 'car-repair-shop') {
      attachIssuerBusinessProof(issuedCredential, issuerBusinessCheck);
    }

    if (storagePolicy === 'issuer') {
      applyRelationshipMetadata({
        credential: issuedCredential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'issuer_pod',
          subjectProofLocation: 'issuer_pod'
        },
        verificationDependencies: templateDependencies,
        trustSources: templateTrustSources
      });
      const issuerStore = await storeCredentialToIssuerPod({
        credential: issuedCredential,
        subjectDid,
        webId: session.webId,
        actionId: action.id
      });
      if (!issuerStore.ok) {
        json(res, 500, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'failed to store credential in issuer pod',
          reason: issuerStore.reason
        });
        return;
      }
      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        summary: `Action ${action.id} completed for ${subjectDid}`,
        templateUsed: template,
        issuerBusinessRegistration: issuerBusinessSummary,
        issuerPodStorage: issuerStore,
        credential: issuedCredential
      });
      return;
    }

    if (storagePolicy === 'sovereign' || siteDir === 'doctors-office') {
      applyRelationshipMetadata({
        credential: issuedCredential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'issuer_pod',
          subjectProofLocation: 'sovereign_pod'
        },
        verificationDependencies: templateDependencies,
        trustSources: templateTrustSources
      });
      const proofStore = await storeCredentialProofToSovereign(session.webId, issuedCredential);
      if (!proofStore.ok) {
        json(res, 500, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'doctor-issued proof must be stored in sovereign pod',
          reason: proofStore.reason
        });
        return;
      }

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        summary: `Action ${action.id} completed for ${subjectDid}`,
        templateUsed: template,
        issuerBusinessRegistration: issuerBusinessSummary,
        sovereignProofStorage: {
          walletUrl: proofStore.walletUrl,
          credentialCount: proofStore.count
        },
        credential: issuedCredential
      });
      return;
    }

    if (siteDir === 'sports-park' || storagePolicy === 'sovereign_with_log') {
      applyRelationshipMetadata({
        credential: issuedCredential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'sovereign_pod',
          subjectProofLocation: 'sovereign_pod'
        },
        verificationDependencies: templateDependencies,
        trustSources: templateTrustSources
      });
      const proofStore = await storeCredentialProofToSovereign(session.webId, issuedCredential);
      if (!proofStore.ok) {
        json(res, 500, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'sports credential must be stored in sovereign pod',
          reason: proofStore.reason
        });
        return;
      }

      const operationalLogEntry = addSportsOperationalLog({
        actionId: action.id,
        subjectDid,
        webId: session.webId,
        credentialId: issuedCredential.id,
        credentialType: issuedCredential.type?.[1] || 'IssuerActionCredential'
      });

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        summary: `Action ${action.id} completed for ${subjectDid}`,
        templateUsed: template,
        issuerBusinessRegistration: issuerBusinessSummary,
        credentialStoredInSovereignPod: true,
        sovereignProofStorage: {
          walletUrl: proofStore.walletUrl,
          credentialCount: proofStore.count
        },
        operationalLogEntry,
        credential: issuedCredential
      });
      return;
    }

    if (siteDir === 'national-metal-works' || storagePolicy === 'issuer') {
      applyRelationshipMetadata({
        credential: issuedCredential,
        action,
        actorMode,
        sessionWebId: session.webId,
        subjectDid,
        recordCustody: {
          fullRecordLocation: 'issuer_pod',
          subjectProofLocation: 'issuer_pod'
        },
        verificationDependencies: templateDependencies,
        trustSources: templateTrustSources
      });
      const issuerStore = await storeCredentialToIssuerPod({
        credential: issuedCredential,
        subjectDid,
        webId: session.webId,
        actionId: action.id
      });
      if (!issuerStore.ok) {
        json(res, 500, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'failed to store credential in issuer pod',
          reason: issuerStore.reason
        });
        return;
      }

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        summary: `Action ${action.id} completed for ${subjectDid}`,
        templateUsed: template,
        issuerBusinessRegistration: issuerBusinessSummary,
        issuerPodStorage: issuerStore,
        credential: issuedCredential
      });
      return;
    }

    applyRelationshipMetadata({
      credential: issuedCredential,
      action,
      actorMode,
      sessionWebId: session.webId,
      subjectDid,
      recordCustody: {
        fullRecordLocation: 'issuer_service_memory',
        subjectProofLocation: 'response_only'
      },
      verificationDependencies: templateDependencies,
      trustSources: templateTrustSources
    });
    json(res, 200, {
      ok: true,
      issuer: siteProfile.issuerName,
      authenticatedWebId: session.webId,
      action,
      summary: `Action ${action.id} completed for ${subjectDid}`,
      issuerBusinessRegistration: issuerBusinessSummary,
      credential: issuedCredential
    });
  } catch (err) {
    json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
  }
};

const handleRequestXray = async (req, res) => {
  if (siteDir !== 'doctors-office') {
    json(res, 404, { ok: false, error: 'xray endpoint only available for doctors-office issuer' });
    return;
  }

  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  const identityCheck = await verifyIdentityWithSovereign(session.webId);
  if (!identityCheck.ok) {
    json(res, 403, {
      ok: false,
      error: 'valid identity credential required before xray request',
      reason: identityCheck.reason
    });
    return;
  }

  const selfPresenceCheck = await verifyCredentialWithSovereign(session.webId, 'SelfPresenceCredential', []);
  if (!selfPresenceCheck.ok) {
    json(res, 403, {
      ok: false,
      error: 'self presence credential required before xray request',
      reason: selfPresenceCheck.reason
    });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const subjectDid = session.subjectDid || deriveSubjectDidFromWebId(session.webId);
    const xrayDocument =
      body.xrayDocument && typeof body.xrayDocument === 'object'
        ? body.xrayDocument
        : { category: 'general-radiology-request' };
    const requestedAt = new Date().toISOString();
    const recordId = `xray-${crypto.randomUUID()}`;
    const recordPayload = {
      recordId,
      recordType: 'xray',
      subjectDid,
      webId: session.webId,
      xrayDocument,
      requestedAt,
      ticket: {
        id: `xray-ticket-${crypto.randomUUID()}`,
        room: 'Radiology-Room-2',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      },
      verification: {
        identity: identityCheck.verification,
        selfPresence: selfPresenceCheck.verification
      },
      issuer: {
        id: issuerDid,
        name: siteProfile.issuerName
      }
    };
    const recordDigest = hashString(JSON.stringify(recordPayload));
    const recordSignature = hashString(`${siteDir}:xray-record:${recordId}:${recordDigest}`);
    const baseUrl = `http://${req.headers.host || `localhost:${port}`}`;
    const { vc: recordLinkCredential, linkProofJws } = createDoctorRecordLinkCredential({
      subjectDid,
      recordId,
      recordDigest,
      issuedAt: requestedAt,
      baseUrl,
      relationshipMetadata: {
        actionId: 'request_xray',
        actorMode: 'self_service',
        sessionWebId: session.webId,
        verificationDependencies: [
          { credentialType: 'DriversLicenseCredential', policy: 'one_of', requiredFlags: ['isOver18', 'isOver21'] },
          { credentialType: 'PassportCredential', policy: 'one_of' },
          { credentialType: 'SelfPresenceCredential', policy: 'required' }
        ]
      }
    });
    doctorRecords.set(recordId, {
      ...recordPayload,
      recordDigest,
      recordSignature,
      linkProofJws
    });
    const doctorPodStore = await storeDoctorRecordToIssuerPod({
      recordId,
      recordPayload,
      recordDigest,
      recordSignature,
      subjectDid,
      webId: session.webId
    });
    if (!doctorPodStore.ok) {
      json(res, 500, {
        ok: false,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        error: 'doctor record must be stored in doctor pod',
        reason: doctorPodStore.reason
      });
      return;
    }
    recordEncryptedDoctorPayload({
      recordId,
      payload: recordPayload,
      subjectDid,
      webId: session.webId,
      recordType: 'xray'
    });

    const proofStore = await storeCredentialProofToSovereign(session.webId, recordLinkCredential);
    if (!proofStore.ok) {
      json(res, 500, {
        ok: false,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        error: 'xray proof credential must be stored in sovereign pod',
        reason: proofStore.reason,
        recordStoredAtDoctorPod: true,
        recordCopiedToSovereignPod: false,
        doctorRecordReference: {
          recordId,
          recordType: 'xray'
        }
      });
      return;
    }

    json(res, 200, {
      ok: true,
      issuer: siteProfile.issuerName,
      authenticatedWebId: session.webId,
      requestType: 'xray',
      status: 'authorized',
      requirement: 'DriversLicenseCredential (isOver18 + isOver21) OR PassportCredential, plus SelfPresenceCredential',
      matchedIdentityCredential: identityCheck.matchedCredentialType,
      xrayDocument,
      subjectDid,
      requestedAt,
      recordStoredAtDoctorPod: true,
      recordCopiedToSovereignPod: true,
      doctorPodStorage: doctorPodStore,
      sovereignProofStorage: {
        walletUrl: proofStore.walletUrl,
        credentialCount: proofStore.count
      },
      doctorRecordReference: {
        recordId,
        recordType: 'xray',
        resolutionModel: 'holder shares signed link credential; verifier fetches from doctor',
        fetchEndpoint: `${baseUrl}/api/records/fetch`,
        verifyEndpoint: `${baseUrl}/api/records/verify`
      },
      recordLinkCredential
    });
  } catch (err) {
    json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
  }
};

const handleDrawBlood = async (req, res) => {
  if (siteDir !== 'doctors-office') {
    json(res, 404, { ok: false, error: 'draw blood endpoint only available for doctors-office issuer' });
    return;
  }

  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const subjectDid = session.subjectDid || deriveSubjectDidFromWebId(session.webId);
    const webId = session.webId;
    const orderDocument =
      body.orderDocument && typeof body.orderDocument === 'object'
        ? body.orderDocument
        : { category: 'standard-bloodwork-panel' };
    const issuedAt = new Date().toISOString();
    const issuedCredential = {
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'BloodworkResultCredential'],
      issuer: {
        id: `did:example:issuer:${siteDir}`,
        name: siteProfile.issuerName
      },
      issuanceDate: issuedAt,
      validFrom: issuedAt,
      credentialSubject: {
        id: subjectDid,
        webId: webId || null,
        specimenType: 'venous-blood',
        panelName: 'CBC and Basic Metabolic Panel',
        resultStatus: 'final',
        collectedAt: issuedAt,
        labResults: {
          hemoglobin_g_dL: 14.2,
          wbc_k_uL: 6.4,
          platelets_k_uL: 265,
          glucose_mg_dL: 96,
          sodium_mmol_L: 139,
          potassium_mmol_L: 4.3
        },
        note: orderDocument.notes || 'Mock bloodwork result for demo'
      }
    };
    issuedCredential.proof = {
      type: 'MockIssuerSignature2026',
      created: issuedAt,
      verificationMethod: `did:example:issuer:${siteDir}#key-1`,
      proofPurpose: 'assertionMethod',
      jws: crypto
        .createHash('sha256')
        .update(`${siteDir}:draw_blood:${issuedAt}:${subjectDid}`)
        .digest('base64url')
    };
    applyRelationshipMetadata({
      credential: issuedCredential,
      actionId: 'draw_blood',
      actorMode: 'issuer_staff',
      sessionWebId: session.webId,
      subjectDid,
      recordCustody: {
        fullRecordLocation: 'issuer_pod',
        subjectProofLocation: 'sovereign_pod'
      }
    });

    const proofStore = await storeCredentialProofToSovereign(session.webId, issuedCredential);
    if (!proofStore.ok) {
      json(res, 500, {
        ok: false,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        actionId: 'draw_blood',
        error: 'doctor-issued proof must be stored in sovereign pod',
        reason: proofStore.reason
      });
      return;
    }

    json(res, 200, {
      ok: true,
      issuer: siteProfile.issuerName,
      actionId: 'draw_blood',
      status: 'completed',
      requirement: 'No ID credential required for demo draw-blood action',
      webId: webId || null,
      subjectDid,
      bloodworkDocument: orderDocument,
      issuedAt,
      result: {
        id: `bloodwork-result-${crypto.randomUUID()}`,
        lab: 'Clinical Lab',
        verifiedAt: issuedAt
      },
      sovereignProofStorage: {
        walletUrl: proofStore.walletUrl,
        credentialCount: proofStore.count
      },
      credential: issuedCredential
    });
  } catch (err) {
    json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
  }
};

const handleFetchDoctorRecord = async (req, res) => {
  if (siteDir !== 'doctors-office') {
    json(res, 404, { ok: false, error: 'records fetch endpoint only available for doctors-office issuer' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const linkCredential = body.linkCredential;
    if (!linkCredential || typeof linkCredential !== 'object') {
      json(res, 400, { ok: false, error: 'linkCredential object is required' });
      return;
    }

    const subject = linkCredential.credentialSubject || {};
    const recordId = String(subject.recordId || '').trim();
    if (!recordId) {
      json(res, 400, { ok: false, error: 'recordId is required in linkCredential.credentialSubject' });
      return;
    }

    const stored = doctorRecords.get(recordId);
    if (!stored) {
      encryptedDatastoreStats.fetchAttempts += 1;
      encryptedDatastoreStats.fetchDenied += 1;
      encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
      json(res, 404, { ok: false, error: 'record not found at doctor pod', recordId });
      return;
    }

    const presentedJws = String(linkCredential?.proof?.jws || '').trim();
    if (!presentedJws || presentedJws !== stored.linkProofJws) {
      encryptedDatastoreStats.fetchAttempts += 1;
      encryptedDatastoreStats.fetchDenied += 1;
      encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
      json(res, 403, { ok: false, error: 'invalid record link credential proof', recordId });
      return;
    }

    const requesterWebId = String(body.requesterWebId || '').trim();
    if (!requesterWebId) {
      encryptedDatastoreStats.fetchAttempts += 1;
      encryptedDatastoreStats.fetchDenied += 1;
      encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
      json(res, 400, { ok: false, error: 'requesterWebId is required for third-party access', recordId });
      return;
    }

    const activeConsent = getActiveDoctorRecordConsent({
      recordId,
      requesterWebId,
      subjectDid: stored.subjectDid
    });
    if (!activeConsent) {
      encryptedDatastoreStats.fetchAttempts += 1;
      encryptedDatastoreStats.fetchDenied += 1;
      encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
      json(res, 403, {
        ok: false,
        error: 'consent grant required from sovereign before sharing record',
        recordId,
        requesterWebId
      });
      return;
    }

    const encrypted = encryptedDoctorRecords.get(recordId);
    if (!encrypted) {
      encryptedDatastoreStats.fetchAttempts += 1;
      encryptedDatastoreStats.fetchDenied += 1;
      encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
      json(res, 500, { ok: false, error: 'encrypted datastore record missing', recordId });
      return;
    }
    encryptedDatastoreStats.fetchAttempts += 1;
    encryptedDatastoreStats.fetchAllowed += 1;
    encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
    const sealedRecord = encrypted.envelope && typeof encrypted.envelope === 'object'
      ? {
        ...encrypted.envelope,
        context: {
          ...(encrypted.envelope.context && typeof encrypted.envelope.context === 'object' ? encrypted.envelope.context : {}),
          accessPurpose: activeConsent.purpose || null,
          consentGrantId: activeConsent.id
        }
      }
      : null;
    if (!sealedRecord) {
      json(res, 500, { ok: false, error: 'encrypted envelope missing', recordId });
      return;
    }

    json(res, 200, {
      ok: true,
      recordId,
      issuer: siteProfile.issuerName,
      requesterWebId,
      accessGrantedBy: {
        consentGrantId: activeConsent.id,
        purpose: activeConsent.purpose,
        grantedByWebId: activeConsent.grantedByWebId,
        expiresAt: activeConsent.expiresAt
      },
      record: sealedRecord,
      verification: {
        linkCredentialVerified: true,
        recordDigest: stored.recordDigest,
        recordSignature: stored.recordSignature,
        encryptedDatastore: true
      }
    });
  } catch (err) {
    json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
  }
};

const handleVerifyDoctorRecord = async (req, res) => {
  if (siteDir !== 'doctors-office') {
    json(res, 404, { ok: false, error: 'records verify endpoint only available for doctors-office issuer' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const linkCredential = body.linkCredential;
    if (!linkCredential || typeof linkCredential !== 'object') {
      json(res, 400, { ok: false, error: 'linkCredential object is required' });
      return;
    }

    const recordId = String(linkCredential?.credentialSubject?.recordId || '').trim();
    if (!recordId) {
      json(res, 400, { ok: false, error: 'recordId is required in linkCredential.credentialSubject' });
      return;
    }

    const stored = doctorRecords.get(recordId);
    if (!stored) {
      json(res, 404, { ok: false, error: 'record not found at doctor pod', recordId });
      return;
    }

    const presentedJws = String(linkCredential?.proof?.jws || '').trim();
    const valid = Boolean(presentedJws) && presentedJws === stored.linkProofJws;

    json(res, 200, {
      ok: true,
      recordId,
      valid,
      issuer: siteProfile.issuerName,
      checks: {
        recordExists: true,
        linkProofValid: valid,
        expectedIssuerDid: issuerDid,
        presentedIssuerDid: linkCredential?.issuer?.id || null
      },
      recordDigest: stored.recordDigest,
      recordSignature: stored.recordSignature
    });
  } catch (err) {
    json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
  }
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') {
    json(res, 200, { ok: true, siteDir, issuer: siteProfile.issuerName });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/login-webid') {
    await handleLoginWebId(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/actions') {
    handleActions(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/pod/data') {
    handlePodDataDownload(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/public/business-license') {
    await handlePublicBusinessLicense(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/pod/issued-records') {
    await handleIssuerPodIssuedRecords(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/encrypted-datastore/stats') {
    handleEncryptedDatastoreStats(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/sharing/grants') {
    handleListInterAgencyConsents(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/request-xray') {
    await handleRequestXray(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/draw-blood') {
    await handleDrawBlood(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/records/fetch') {
    await handleFetchDoctorRecord(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/records/verify') {
    await handleVerifyDoctorRecord(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/records/consent/grant') {
    await handleGrantDoctorRecordConsent(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/records/consent/revoke') {
    await handleRevokeDoctorRecordConsent(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/sharing/grant') {
    await handleGrantInterAgencyConsent(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/sharing/revoke') {
    await handleRevokeInterAgencyConsent(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/sharing/export') {
    await handleExportSharedSubjectRecords(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/command') {
    await handleCommand(req, res);
    return;
  }

  if (req.url !== '/' && req.url !== '/index.html') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  fs.readFile(indexPath, 'utf8', async (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Site unavailable for SITE_DIR=${siteDir}`);
      return;
    }

    const apiPanelHtml = await getApiPanelHtml();
    const html = data.includes('</body>') ? data.replace('</body>', `${apiPanelHtml}</body>`) : `${data}${apiPanelHtml}`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
});

server.listen(port, () => {
  console.log(`Issuer site '${siteDir}' listening on port ${port} using pod ${solidPodUrl || 'not-set'}`);
});
