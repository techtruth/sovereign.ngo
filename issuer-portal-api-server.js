const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const port = Number(process.env.PORT || 3000);
const siteDir = process.env.SITE_DIR || 'doctors-office';
const solidPodUrl = process.env.SOLID_POD_URL || '';
const sovereignPodAuthUrl = process.env.SOVEREIGN_POD_AUTH_URL || 'http://holder_sovereign:4000/auth/verify-webid';
const demoWebId = process.env.DEMO_WEBID || 'http://holder_sovereign:4000/profile/card#me';
const indexPath = path.join(__dirname, 'issuer-sites', siteDir, 'index.html');

const issuerProfiles = {
  'doctors-office': {
    issuerName: 'Harbor Family Clinic',
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
    issuerName: 'Dirigo Auto Repair Shop',
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
    issuerName: 'Pine Tree Sports Park',
    actions: [
      { id: 'issue_membership_pass', label: 'Issue Membership Pass', description: 'Issue seasonal membership credential.' },
      { id: 'register_tournament_entry', label: 'Register Tournament Entry', description: 'Register athlete/team for tournament.' },
      { id: 'validate_coach_access', label: 'Validate Coach Access', description: 'Issue coach/volunteer access credential.' },
      { id: 'redeem_employee_season_ticket', label: 'Redeem Employee Season Ticket', description: 'Verify Downeast Metal Works entitlement and issue game entry credential.' }
    ],
    podData: {
      reports: ['member-roster', 'tournament-enrollment', 'coach-clearance-list', 'employee-season-ticket-redemptions'],
      retentionPolicy: 'Season-based roster archival',
      lastSyncDate: '2026-03-19'
    }
  },
  'national-metal-works': {
    issuerName: 'Downeast Metal Works',
    actions: [
      { id: 'issue_vendor_approval', label: 'Issue Vendor Approval', description: 'Issue approved-vendor credential.' },
      { id: 'issue_shipment_provenance', label: 'Issue Shipment Provenance', description: 'Issue shipment traceability credential.' },
      { id: 'issue_material_certificate', label: 'Issue Material Certificate', description: 'Issue materials quality certificate credential.' },
      { id: 'apply_for_employment', label: 'Apply For Employment', description: 'Hiring policy: requires Driver License OR Passport, plus ITAR.' },
      { id: 'terminate_employment', label: 'Terminate Employment', description: 'End employment for logged-in subject.' },
      { id: 'issue_employee_status', label: 'Issue Employee Status', description: 'Issue active employee status credential.' },
      { id: 'issue_season_ticket_entitlement', label: 'Issue Season Ticket Entitlement', description: 'Issue employee season-ticket benefit credential for Pine Tree Sports Park.' },
      { id: 'issue_facility_access_badge', label: 'Issue Facility Access Badge', description: 'Requires identity + ITAR + self-presence.' },
      { id: 'validate_employee_address_for_benefits', label: 'Validate Address For Benefits', description: 'Requires recent utility bill credential.' }
    ],
    podData: {
      reports: ['vendor-certification-ledger', 'shipment-provenance-index', 'material-compliance-records', 'employee-benefit-ledger'],
      retentionPolicy: 'Compliance archive retention for audits',
      lastSyncDate: '2026-03-22'
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
const sessions = new Map();
const doctorRecords = new Map();
const employmentRegistry = new Map();
const issuedAccessBadges = new Map();
const revokedCredentialIds = new Map();

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

const hashString = (value) => crypto.createHash('sha256').update(String(value)).digest('base64url');

const createDoctorRecordLinkCredential = ({ subjectDid, recordId, recordDigest, issuedAt, baseUrl }) => {
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

  return { vc, linkProofJws };
};

const verifyCredentialWithSovereign = async (webId, requiredCredentialType, requiredFlags = []) => {
  const response = await fetch(sovereignPodAuthUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webId,
      requiredCredentialType,
      requiredFlags
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.authorized) {
    return {
      ok: false,
      reason: payload.reason || payload.error || 'WebID credential verification failed'
    };
  }

  return {
    ok: true,
    verification: payload
  };
};

const verifyIdentityWithSovereign = async (webId) => {
  const driversLicenseCheck = await verifyCredentialWithSovereign(webId, 'DriversLicenseCredential', ['isOver18', 'isOver21']);
  if (driversLicenseCheck.ok) {
    return {
      ok: true,
      matchedCredentialType: 'DriversLicenseCredential',
      verification: driversLicenseCheck.verification
    };
  }

  const passportCheck = await verifyCredentialWithSovereign(webId, 'PassportCredential', []);
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
    const docUrl = webId.split('#')[0];
    const response = await fetch(docUrl);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, reason: `webid document request failed (${response.status})` };
    const walletApi = payload.walletApi || payload?.service?.walletApi || payload?.profile?.walletApi;
    if (!walletApi) return { ok: false, reason: 'walletApi not present in webid document' };
    return { ok: true, walletApi };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const fetchWalletCredentialsForWebId = async (webId) => {
  const resolution = await resolveWalletFromWebId(webId);
  if (!resolution.ok) return { ok: false, reason: resolution.reason };

  try {
    const walletUrl = new URL(resolution.walletApi);
    walletUrl.searchParams.set('webId', webId);
    const response = await fetch(walletUrl.toString());
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, reason: payload.error || `wallet read failed (${response.status})` };
    const credentials = Array.isArray(payload.credentials) ? payload.credentials : [];
    return { ok: true, credentials, walletApi: resolution.walletApi };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
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

const hasCredentialInWallet = (credentials, type, issuerDid) =>
  credentials.some((cred) => {
    const types = credentialTypes(cred);
    if (!types.includes(type)) return false;
    if (!issuerDid) return true;
    return credentialIssuerDid(cred) === issuerDid;
  });

const getSolidPodStatusHtml = async () => {
  if (!solidPodUrl) {
    return '<p style="margin:.4rem 0;color:#b91c1c;"><strong>Solid pod:</strong> not configured</p>';
  }

  try {
    const response = await fetch(solidPodUrl);
    if (!response.ok) {
      return `<p style="margin:.4rem 0;color:#b91c1c;"><strong>Solid pod:</strong> unreachable (${response.status}) at ${escapeHtml(solidPodUrl)}</p>`;
    }

    const profile = await response.json();
    const podName = profile.podName || 'holder-pod';
    const did = profile.did || 'did:example:holder';
    return `<p style="margin:.4rem 0;color:#065f46;"><strong>Connected issuer holder pod:</strong> ${escapeHtml(podName)} (${escapeHtml(did)})</p>`;
  } catch (err) {
    return `<p style="margin:.4rem 0;color:#b91c1c;"><strong>Solid pod:</strong> connection failed at ${escapeHtml(solidPodUrl)}</p>`;
  }
};

const getApiPanelHtml = async () => {
  const podStatusHtml = await getSolidPodStatusHtml();
  const actionsJson = JSON.stringify(siteProfile.actions);

  return `
  <section style="max-width:920px;margin:0 auto 2rem;padding:0 1rem;">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:1rem;box-shadow:0 10px 24px rgba(0,0,0,.06);">
      <h2 style="margin-top:0;">Issuer Console API</h2>
      <p style="margin:.4rem 0;color:#4b5563;">WebID-authenticated actions for <strong>${escapeHtml(siteProfile.issuerName)}</strong>.</p>
      ${podStatusHtml}
      <p style="margin:.4rem 0;color:#4b5563;"><strong>Sovereign auth source:</strong> ${escapeHtml(sovereignPodAuthUrl)}</p>

      <label style="display:block;font-weight:600;margin-bottom:4px;">Sovereign WebID</label>
      <input id="issuerWebId" value="${escapeHtml(demoWebId)}" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;">

      <button id="issuerLoginBtn" style="margin-top:10px;background:#0f766e;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Login With WebID</button>

      <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:12px;">
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px;">Action</label>
          <select id="issuerActionSelect" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;"></select>
        </div>
      </div>
      <p style="margin:.6rem 0 0;color:#334155;"><strong>Subject DID (from login):</strong> <span id="issuerSessionDid">not logged in</span></p>

      <label style="display:block;font-weight:600;margin:10px 0 4px;">Payload JSON</label>
      <textarea id="issuerPayload" style="width:100%;min-height:90px;padding:8px;border:1px solid #d1d5db;border-radius:8px;">{"priority":"normal"}</textarea>

      <button id="issuerRunBtn" style="margin-top:10px;background:#1f2937;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Run Action</button>
      <button id="issuerDownloadBtn" style="margin-top:10px;background:#334155;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Download Issuer Pod Data</button>

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
      const actionEl = document.getElementById('issuerActionSelect');
      const sessionDidEl = document.getElementById('issuerSessionDid');
      const payloadEl = document.getElementById('issuerPayload');
      const outEl = document.getElementById('issuerApiOut');
      const statusEl = document.getElementById('issuerApiStatus');
      const loginBtn = document.getElementById('issuerLoginBtn');
      const runBtn = document.getElementById('issuerRunBtn');
      const downloadBtn = document.getElementById('issuerDownloadBtn');

      const renderActions = () => {
        actionEl.innerHTML = '';
        actions.forEach((a) => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = a.label + ' - ' + a.description;
          actionEl.appendChild(opt);
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

      runBtn.addEventListener('click', async () => {
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

        statusEl.textContent = 'Running action...';
        try {
          const res = await fetch('/api/command', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token
            },
            body: JSON.stringify({
              actionId: actionEl.value,
              payload: parsedPayload
            })
          });

          const data = await res.json();
          outEl.textContent = JSON.stringify(data, null, 2);
          statusEl.textContent = res.ok ? 'Action completed.' : 'Action failed.';
        } catch (err) {
          statusEl.textContent = 'Action request error.';
          outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
        }
      });

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
      availableActions: siteProfile.actions
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
    actions: siteProfile.actions
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
    const action = siteProfile.actions.find((a) => a.id === actionId);
    if (!action) {
      json(res, 400, { ok: false, error: 'invalid actionId' });
      return;
    }

    const subjectDid = session.subjectDid || deriveSubjectDidFromWebId(session.webId);
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

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
        baseUrl
      });

      doctorRecords.set(recordId, {
        ...recordPayload,
        recordDigest,
        recordSignature,
        linkProofJws
      });

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
        recordCopiedToSovereignPod: false,
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
          lab: 'Harbor Clinical Lab',
          verifiedAt: issuedAt
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

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        status: 'completed',
        subjectDid,
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
          employer: 'Downeast Metal Works',
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

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        status: 'completed',
        subjectDid,
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
      const utility = walletRead.credentials.find((cred) => {
        const types = credentialTypes(cred);
        if (!types.includes('UtilityBillCredential')) return false;
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

      json(res, approved ? 200 : 403, {
        ok: approved,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        subjectDid,
        decision: approved ? 'eligible' : 'ineligible',
        checkedCredentialType: 'UtilityBillCredential',
        credential
      });
      return;
    }

    if (siteDir === 'national-metal-works' && actionId === 'issue_season_ticket_entitlement') {
      const issuedAt = new Date().toISOString();
      const seasonYear = Number(payload.seasonYear || new Date().getUTCFullYear());
      const validFrom = String(payload.validFrom || `${seasonYear}-03-01T00:00:00.000Z`);
      const validUntil = String(payload.validUntil || `${seasonYear}-11-30T23:59:59.000Z`);
      const benefitType = String(payload.benefitType || 'riverbend-baseball-season').trim();
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
          employer: 'Downeast Metal Works',
          benefitType,
          seasonYear,
          ticketClass,
          entitlementStatus: 'active',
          benefitIssuer: 'Downeast Metal Works',
          redeemableAt: 'Pine Tree Sports Park',
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

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        status: 'completed',
        subjectDid,
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
          error: 'missing EmployeeStatusCredential from Downeast Metal Works'
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
          error: 'missing active SeasonTicketEntitlementCredential from Downeast Metal Works'
        });
        return;
      }

      const issuedAt = new Date().toISOString();
      const eventId = String(payload.eventId || `riverbend-game-${new Date().toISOString().slice(0, 10)}`).trim();
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
          venue: 'Pine Tree Sports Park',
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

      const hasDriversLicense = hasCredentialInWallet(walletRead.credentials, 'DriversLicenseCredential');
      const hasPassport = hasCredentialInWallet(walletRead.credentials, 'PassportCredential');
      const hasIdentity = hasDriversLicense || hasPassport;
      const hasItar = hasCredentialInWallet(walletRead.credentials, 'ITARComplianceCredential');

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

      json(res, approved ? 200 : 403, {
        ok: approved,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        subjectDid,
        policy: requiredPolicy,
        decision: status,
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

      employmentRegistry.set(registryKey, {
        employmentId: current?.employmentId || `${siteDir.replaceAll('-', '_')}-${Math.floor(Math.random() * 1000000)}`,
        siteDir,
        subjectDid,
        webId: session.webId,
        status: 'terminated',
        terminatedAt: issuedAt
      });

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        subjectDid,
        previousStatus: current?.status || 'none',
        currentStatus: 'terminated',
        credential
      });
      return;
    }

    const issuedAt = new Date().toISOString();
    const issuedCredential = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'IssuerActionCredential'],
      issuer: {
        id: `did:example:issuer:${siteDir}`,
        name: siteProfile.issuerName
      },
      issuanceDate: issuedAt,
      credentialSubject: {
        id: subjectDid,
        actionId: action.id,
        actionLabel: action.label,
        actionDescription: action.description,
        payload,
        authorizedWebId: session.webId
      },
      proof: {
        type: 'MockIssuerSignature2026',
        created: issuedAt,
        verificationMethod: `did:example:issuer:${siteDir}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: crypto.createHash('sha256').update(`${siteDir}:${action.id}:${issuedAt}:${session.webId}`).digest('base64url')
      }
    };

    json(res, 200, {
      ok: true,
      issuer: siteProfile.issuerName,
      authenticatedWebId: session.webId,
      action,
      summary: `Action ${action.id} completed for ${subjectDid}`,
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
      baseUrl
    });
    doctorRecords.set(recordId, {
      ...recordPayload,
      recordDigest,
      recordSignature,
      linkProofJws
    });

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
      recordCopiedToSovereignPod: false,
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
        lab: 'Harbor Clinical Lab',
        verifiedAt: issuedAt
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
      json(res, 404, { ok: false, error: 'record not found at doctor pod', recordId });
      return;
    }

    const presentedJws = String(linkCredential?.proof?.jws || '').trim();
    if (!presentedJws || presentedJws !== stored.linkProofJws) {
      json(res, 403, { ok: false, error: 'invalid record link credential proof', recordId });
      return;
    }

    json(res, 200, {
      ok: true,
      recordId,
      issuer: siteProfile.issuerName,
      record: {
        recordId: stored.recordId,
        recordType: stored.recordType,
        subjectDid: stored.subjectDid,
        xrayDocument: stored.xrayDocument,
        requestedAt: stored.requestedAt,
        ticket: stored.ticket,
        issuer: stored.issuer
      },
      verification: {
        linkCredentialVerified: true,
        recordDigest: stored.recordDigest,
        recordSignature: stored.recordSignature
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
