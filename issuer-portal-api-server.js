const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const parsePositiveInt = (value, fallback, min = 1) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return parsed;
};

const port = Number(process.env.PORT || 3000);
const siteDir = process.env.SITE_DIR || 'doctors-office';
const solidPodUrl = process.env.SOLID_POD_URL || '';
const sovereignPodUrl = process.env.SOVEREIGN_POD_URL || 'http://holder_sovereign:3000/';
const sovereignInternalOrigin = process.env.SOVEREIGN_INTERNAL_ORIGIN || 'http://sovereign_gateway';
const demoWebId = process.env.DEMO_WEBID || 'http://holder_sovereign:3000/profile/card#me';
const demoOrigin = (() => {
  try {
    return new URL(demoWebId).origin;
  } catch {
    return 'http://localhost:8180';
  }
})();
const defaultDemoIdentityWebId = demoWebId.endsWith('/profile/card#me')
  ? `${demoOrigin}/profile/card#8N4Q7Z2K`
  : demoWebId;
const stephenStafferWebId = `${demoOrigin}/profile/card#S7T4F9R2`;
const demoIdentityOptions = [
  { label: 'Alex Sovereign', webId: `${demoOrigin}/profile/card#8N4Q7Z2K` },
  { label: 'Betty Medina', webId: `${demoOrigin}/profile/card#3H9X5M1R` },
  { label: 'Charlie Krier', webId: `${demoOrigin}/profile/card#W2C8J6P4` },
  { label: 'Debra Harbor', webId: `${demoOrigin}/profile/card#7T1B9LQ5` },
  { label: 'Ed Erins', webId: `${demoOrigin}/profile/card#K4D3R8X2` },
  { label: 'Stephen Staffer', webId: stephenStafferWebId }
];
if (!demoIdentityOptions.some((entry) => entry.webId === defaultDemoIdentityWebId)) {
  demoIdentityOptions.unshift({ label: 'Default Demo Identity', webId: defaultDemoIdentityWebId });
}
const subjectIdentityOptions = demoIdentityOptions.filter((entry) => entry.webId !== stephenStafferWebId);
const emergencyJohnDoeWebIdPrefix = `${demoOrigin}/profile/card#john-doe-`;
const providerStaffCredentialType = 'ProviderStaffCredential';
const providerStaffIssuerDid = 'did:example:issuer:sovereign-platform';
const providerStaffIssuerName = 'Sovereign Platform';
const businessRegistrationCredentialType = 'BusinessRegistrationCredential';
const businessRegistryVerifierDid = 'did:example:verifier:business-registry';
const businessRegistryVerifierName = 'Business Registry Verifier';
const startupStephenProvisionMaxAttempts = parsePositiveInt(process.env.STEPHEN_PROVISION_MAX_ATTEMPTS, 20);
const startupStephenProvisionDelayMs = parsePositiveInt(process.env.STEPHEN_PROVISION_DELAY_MS, 1500, 100);
const sovereignJweKeyId = process.env.SOVEREIGN_JWE_KEY_ID || 'sovereign-x25519-2026-01';
const sovereignJwePublicKeyPem = process.env.SOVEREIGN_JWE_PUBLIC_KEY_PEM || `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VuAyEA3yhC17XK8kTPNz3LmHGMDwbIsgTtq9orDm0eKLnud0E=
-----END PUBLIC KEY-----`;
const indexPath = path.join(__dirname, 'issuer-sites', siteDir, 'index.html');
const templatePolicyPath = path.join(__dirname, 'issuer-policies', `${siteDir}.json`);

const sanitizeEmergencyCaseId = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 24);

const randomBase36Token = (length = 8) => {
  let token = '';
  while (token.length < length) {
    token += crypto.randomBytes(8).toString('base64url').replace(/[^a-z0-9]/gi, '').toLowerCase();
  }
  return token.slice(0, length);
};

const createEmergencyJohnDoeIdentity = ({ incidentId = '' } = {}) => {
  const caseSlug = sanitizeEmergencyCaseId(incidentId);
  const suffix = randomBase36Token(8);
  const fragment = caseSlug ? `john-doe-${caseSlug}-${suffix}` : `john-doe-${suffix}`;
  const alias = caseSlug
    ? `John Doe ${caseSlug.toUpperCase()}-${suffix.toUpperCase()}`
    : `John Doe ${suffix.toUpperCase()}`;
  return {
    webId: `${demoOrigin}/profile/card#${fragment}`,
    alias,
    caseSlug,
    suffix
  };
};

const issuerProfiles = {
  'doctors-office': {
    issuerName: 'Nolichucky Family Clinic',
    actions: [
      { id: 'schedule_appointment', label: 'Schedule Appointment', description: 'Book a clinic appointment request as the resident.', actorScope: 'self_service' },
      { id: 'walk_in_check_in', label: 'Arrive, with or without an appointment', description: 'Register arrival at the clinic, whether scheduled or walk-in.', actorScope: 'self_service' },
      { id: 'request_treatment', label: 'Request Treatment', description: 'Request treatment services from Nolichucky care staff.', actorScope: 'self_service' },
      { id: 'issue_visit_credential', label: 'Issue Visit Credential', description: 'Generate a proof of clinical visit.', actorScope: 'issuer_staff' },
      { id: 'schedule_follow_up', label: 'Schedule Follow-Up', description: 'Create a follow-up appointment action record.', actorScope: 'issuer_staff' },
      { id: 'draw_blood', label: 'Draw Blood', description: 'Issue a signed bloodwork result credential.', actorScope: 'issuer_staff' },
      { id: 'request_xray', label: 'Issue X-Ray Referral', description: 'Issue a referral that any qualified X-ray provider can fulfill.', actorScope: 'issuer_staff' },
      { id: 'request_ultrasound', label: 'Issue Ultrasound Referral', description: 'Issue a referral that any qualified ultrasound provider can fulfill.', actorScope: 'issuer_staff' },
      { id: 'issue_allergy_profile', label: 'Issue Allergy Profile', description: 'Issue a signed allergy profile credential.', actorScope: 'issuer_staff' }
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
      { id: 'issue_service_record', label: 'Issue Service Record', description: 'Issue credential for completed service.', actorScope: 'issuer_staff' },
      { id: 'issue_safety_inspection', label: 'Issue Safety Inspection', description: 'Issue vehicle inspection credential.', actorScope: 'issuer_staff' },
      { id: 'create_repair_estimate', label: 'Create Repair Estimate', description: 'Create estimate action with credential receipt.', actorScope: 'self_service' },
      { id: 'apply_for_employment', label: 'Apply For Employment', description: 'Hiring policy: requires Driver License OR Passport.', actorScope: 'self_service' },
      { id: 'terminate_employment', label: 'Terminate Employment', description: 'End employment for logged-in subject.', actorScope: 'issuer_staff' },
      { id: 'issue_shop_access_badge', label: 'Issue Shop Access Badge', description: 'Issue signed shop-access credential.', actorScope: 'issuer_staff' },
      { id: 'revoke_access_badge', label: 'Revoke Access Badge', description: 'Revoke previously issued access credential.', actorScope: 'issuer_staff' },
      { id: 'verify_access_badge', label: 'Verify Access Badge', description: 'Verify if access credential is active or revoked.', actorScope: 'issuer_staff' }
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
      { id: 'issue_membership_pass', label: 'Issue Membership Pass', description: 'Issue seasonal membership credential.', actorScope: 'self_service' },
      { id: 'register_tournament_entry', label: 'Register Tournament Entry', description: 'Register athlete/team for tournament.', actorScope: 'self_service' },
      { id: 'validate_coach_access', label: 'Validate Coach Access', description: 'Issue coach/volunteer access credential.', actorScope: 'issuer_staff' },
      { id: 'redeem_employee_season_ticket', label: 'Redeem Employee Season Ticket', description: 'Verify Buffalo Mountain Metal Works entitlement and issue game entry credential.', actorScope: 'self_service' }
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
      { id: 'issue_vendor_approval', label: 'Issue Vendor Approval', description: 'Issue approved-vendor credential.', actorScope: 'issuer_staff' },
      { id: 'issue_shipment_provenance', label: 'Issue Shipment Provenance', description: 'Issue shipment traceability credential.', actorScope: 'issuer_staff' },
      { id: 'issue_material_certificate', label: 'Issue Material Certificate', description: 'Issue materials quality certificate credential.', actorScope: 'issuer_staff' },
      { id: 'apply_for_employment', label: 'Apply For Employment', description: 'Hiring policy: requires Driver License OR Passport, plus ITAR.', actorScope: 'self_service' },
      { id: 'terminate_employment', label: 'Terminate Employment', description: 'End employment for logged-in subject.', actorScope: 'issuer_staff' },
      { id: 'issue_employee_status', label: 'Issue Employee Status', description: 'Issue active employee status credential.', actorScope: 'issuer_staff' },
      { id: 'issue_season_ticket_entitlement', label: 'Issue Season Ticket Entitlement', description: 'Issue employee season-ticket benefit credential for Boone Lake Sports Park.', actorScope: 'issuer_staff' },
      { id: 'issue_facility_access_badge', label: 'Issue Facility Access Badge', description: 'Requires identity + ITAR + self-presence.', actorScope: 'issuer_staff' },
      { id: 'validate_employee_address_for_benefits', label: 'Validate Address For Benefits', description: 'Requires recent utility bill credential.', actorScope: 'self_service' }
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
      { id: 'issue_policy_verification', label: 'Issue Policy Verification', description: 'Issue active policy verification credential.', actorScope: 'self_service' },
      { id: 'issue_claim_intake_receipt', label: 'Issue Claim Intake Receipt', description: 'Issue claim intake receipt credential.', actorScope: 'self_service' },
      { id: 'issue_benefit_eligibility', label: 'Issue Benefit Eligibility', description: 'Issue benefit eligibility decision credential.', actorScope: 'issuer_staff' }
    ],
    podData: {
      reports: ['policy-verification-ledger', 'claim-intake-ledger', 'benefit-eligibility-decisions'],
      retentionPolicy: 'Insurance records retention policy',
      lastSyncDate: '2026-03-25'
    }
  },
  'assistance-charity': {
    issuerName: 'Salutation Army',
    actions: [
      { id: 'process_food_assistance', label: 'Process Food Assistance', description: 'Evaluate and issue food assistance decision credential.', actorScope: 'issuer_staff' },
      { id: 'process_housing_assistance', label: 'Process Housing Assistance', description: 'Evaluate and issue housing assistance decision credential.', actorScope: 'issuer_staff' },
      { id: 'issue_assistance_intake_receipt', label: 'Issue Intake Receipt', description: 'Issue assistance intake receipt credential.', actorScope: 'self_service' }
    ],
    podData: {
      reports: ['assistance-intake-ledger', 'food-assistance-decisions', 'housing-assistance-decisions'],
      retentionPolicy: 'Community assistance record retention policy',
      lastSyncDate: '2026-03-25'
    }
  },
  'legal-benefits-aid': {
    issuerName: 'Pioneer Legal and Benefits Navigation',
    actions: [
      { id: 'issue_assistance_intake_receipt', label: 'Issue Legal and Benefits Intake Receipt', description: 'Issue signed intake receipt for legal aid and benefits navigation.', actorScope: 'self_service' },
      { id: 'process_food_assistance', label: 'Process Benefit Navigation', description: 'Evaluate and issue benefits-navigation decision credential.', actorScope: 'issuer_staff' },
      { id: 'process_housing_assistance', label: 'Process Legal Aid Navigation', description: 'Evaluate and issue legal-aid navigation decision credential.', actorScope: 'issuer_staff' }
    ],
    podData: {
      reports: ['legal-intake-ledger', 'benefits-navigation-decisions', 'legal-navigation-decisions'],
      retentionPolicy: 'Legal aid and benefits navigation record retention policy',
      lastSyncDate: '2026-03-28'
    }
  },
  'fairmannor-house': {
    issuerName: 'FairMannor House',
    actions: [
      { id: 'issue_assistance_intake_receipt', label: 'Issue Prevention Intake Receipt', description: 'Issue signed intake receipt for homelessness prevention services.', actorScope: 'self_service' },
      { id: 'process_housing_assistance', label: 'Process Prevention Housing Support', description: 'Evaluate prevention-focused housing support eligibility decision.', actorScope: 'issuer_staff' },
      { id: 'process_food_assistance', label: 'Process Stabilization Support', description: 'Evaluate stabilization support decision for at-risk residents.', actorScope: 'issuer_staff' }
    ],
    podData: {
      reports: ['prevention-intake-ledger', 'housing-stabilization-decisions', 'stabilization-support-decisions'],
      retentionPolicy: 'Homelessness prevention service retention policy',
      lastSyncDate: '2026-03-27'
    }
  },
  'safeharbor-shelter': {
    issuerName: 'SafeHarbor Shelter',
    actions: [
      { id: 'issue_assistance_intake_receipt', label: 'Issue Emergency Shelter Intake Receipt', description: 'Issue signed intake receipt for emergency shelter entry.', actorScope: 'self_service' },
      { id: 'process_housing_assistance', label: 'Process Emergency Shelter Placement', description: 'Evaluate emergency shelter and transitional placement decision.', actorScope: 'issuer_staff' },
      { id: 'process_food_assistance', label: 'Process Crisis Stabilization Support', description: 'Evaluate urgent stabilization support while sheltered.', actorScope: 'issuer_staff' }
    ],
    podData: {
      reports: ['shelter-intake-ledger', 'shelter-placement-decisions', 'crisis-stabilization-decisions'],
      retentionPolicy: 'Emergency shelter operations retention policy',
      lastSyncDate: '2026-03-27'
    }
  },
  'family-services': {
    issuerName: 'Bridgeway Family Services',
    actions: [
      { id: 'issue_assistance_intake_receipt', label: 'Issue Family Services Intake Receipt', description: 'Issue signed intake receipt for family stabilization support.', actorScope: 'self_service' },
      { id: 'process_food_assistance', label: 'Process Family Stabilization Support', description: 'Evaluate and issue family stabilization support decision credential.', actorScope: 'issuer_staff' },
      { id: 'process_housing_assistance', label: 'Process Family Crisis Prevention', description: 'Evaluate and issue family crisis-prevention support decision credential.', actorScope: 'issuer_staff' }
    ],
    podData: {
      reports: ['family-intake-ledger', 'family-stabilization-decisions', 'family-crisis-prevention-decisions'],
      retentionPolicy: 'Family services record retention policy',
      lastSyncDate: '2026-03-28'
    }
  },
  'transport-services': {
    issuerName: 'Transport Services',
    actions: [
      { id: 'issue_transport_request_receipt', label: 'Issue Transport Request Receipt', description: 'Issue signed receipt for a ride-to-services request.', actorScope: 'self_service' },
      { id: 'dispatch_transport_assistance', label: 'Dispatch Transport Assistance', description: 'Dispatch ride support to approved service destinations.', actorScope: 'issuer_staff' },
      { id: 'issue_transport_completion_record', label: 'Issue Transport Completion Record', description: 'Issue signed completion record after transport handoff.', actorScope: 'issuer_staff' }
    ],
    podData: {
      reports: ['transport-request-ledger', 'dispatch-log', 'transport-completion-records'],
      retentionPolicy: 'Transport support operations retention policy',
      lastSyncDate: '2026-03-31'
    }
  },
  'radiology-center': {
    issuerName: 'Riverstone Radiology Center',
    actions: [
      { id: 'present_imaging_referral', label: 'Present Imaging Referral', description: 'Present a doctor-issued imaging referral after login.', actorScope: 'self_service' },
      { id: 'issue_xray_result', label: 'Issue X-Ray Result', description: 'Issue a signed X-ray result credential.', actorScope: 'issuer_staff' },
      { id: 'issue_ultrasound_result', label: 'Issue Ultrasound Result', description: 'Issue a signed ultrasound result credential.', actorScope: 'issuer_staff' }
    ],
    podData: {
      reports: ['radiology-appointments', 'xray-results', 'ultrasound-results'],
      retentionPolicy: 'Imaging and appointment retention policy',
      lastSyncDate: '2026-03-27'
    }
  },
  'emergency-department': {
    issuerName: 'Summitview Emergency Department',
    actions: [
      { id: 'confirm_er_intake', label: 'Confirm ER Intake', description: 'Confirm emergency intake and triage initiation.', actorScope: 'issuer_staff' },
      { id: 'issue_er_disposition', label: 'Issue ER Disposition', description: 'Issue signed ER disposition (admit, discharge, or transfer).', actorScope: 'issuer_staff' },
      { id: 'issue_er_discharge_summary', label: 'Issue ER Discharge Summary', description: 'Issue signed emergency discharge summary credential.', actorScope: 'issuer_staff' }
    ],
    podData: {
      reports: ['er-intake-log', 'er-triage-status', 'er-disposition-records'],
      retentionPolicy: 'Emergency care and disposition retention policy',
      lastSyncDate: '2026-03-27'
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
  'schedule_appointment',
  'walk_in_check_in',
  'request_treatment',
  'apply_for_employment',
  'redeem_employee_season_ticket'
]);
const inferActionScope = (actionId) => (selfServiceActionIds.has(actionId) ? 'self_service' : 'issuer_staff');
const scopedActions = siteProfile.actions.map((action) => ({
  ...action,
  actorScope: action.actorScope || inferActionScope(action.id)
}));
const siteActionIds = new Set(scopedActions.map((action) => String(action.id || '').trim()).filter(Boolean));
const normalizeImagingModality = (value) => {
  const raw = String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (!raw) return null;
  if (raw === 'xray' || raw === 'x-ray') return 'xray';
  if (raw === 'ultrasound') return 'ultrasound';
  return null;
};
const actionIdForImagingModality = (modality) => {
  if (modality === 'xray') return 'issue_xray_result';
  if (modality === 'ultrasound') return 'issue_ultrasound_result';
  return null;
};
const currentProviderCanFulfillImagingModality = (modality) => {
  const actionId = actionIdForImagingModality(modality);
  return Boolean(actionId && siteActionIds.has(actionId));
};
const currentProviderCanProcessImagingReferrals = () => (
  siteActionIds.has('present_imaging_referral') ||
  siteActionIds.has('issue_xray_result') ||
  siteActionIds.has('issue_ultrasound_result')
);
const businessRegistrationRequiredSites = new Set([
  'car-repair-shop',
  'doctors-office',
  'radiology-center',
  'emergency-department'
]);
const sessions = new Map();
const doctorRecords = new Map();
const employmentRegistry = new Map();
const issuedAccessBadges = new Map();
const revokedCredentialIds = new Map();
const sportsOperationalLogs = [];
const encryptedDoctorRecords = new Map();
const doctorRecordConsentGrants = new Map();
const interAgencyConsentGrantsBySubject = new Map();
const emergencyBreakGlassAccessLog = [];
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
    SelfPresenceCredential: ['did:example:verifier:self-presence'],
    BusinessRegistrationCredential: ['did:example:verifier:business-registry']
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
  },
  'legal-benefits-aid': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    UtilityBillCredential: ['did:example:verifier:utility-bill']
  },
  'fairmannor-house': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    UtilityBillCredential: ['did:example:verifier:utility-bill']
  },
  'safeharbor-shelter': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    UtilityBillCredential: ['did:example:verifier:utility-bill']
  },
  'family-services': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    UtilityBillCredential: ['did:example:verifier:utility-bill']
  },
  'transport-services': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    UtilityBillCredential: ['did:example:verifier:utility-bill']
  },
  'radiology-center': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    SelfPresenceCredential: ['did:example:verifier:self-presence'],
    ExternalMedicalRecordLinkCredential: ['did:example:issuer:doctors-office'],
    BusinessRegistrationCredential: ['did:example:verifier:business-registry']
  },
  'emergency-department': {
    DriversLicenseCredential: ['did:example:verifier:drivers-license'],
    PassportCredential: ['did:example:verifier:passport'],
    ExternalMedicalRecordLinkCredential: ['did:example:issuer:doctors-office'],
    BusinessRegistrationCredential: ['did:example:verifier:business-registry']
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
  const toDidComponent = (value) =>
    encodeURIComponent(String(value || '').trim())
      .replace(/%20/g, '+');

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

const issuerDid = `did:example:issuer:${siteDir}`;
const emergencyDepartmentSiteDir = 'emergency-department';
const emergencyDepartmentIssuerDid = `did:example:issuer:${emergencyDepartmentSiteDir}`;
const issuerWebId = (() => {
  try {
    const base = new URL(solidPodUrl);
    return `${base.origin}/profile/card#me`;
  } catch {
    return '';
  }
})();
const credentialExplorerInternalOrigin = String(process.env.CREDENTIAL_EXPLORER_INTERNAL_ORIGIN || 'http://credential_explorer:3000').trim().replace(/\/+$/, '');
const normalizeIssuerDidKey = (value) => String(value || '').trim().toLowerCase();
const defaultIssuerInternalOriginByDid = {
  'did:example:issuer:doctors-office': 'http://sovereign-issuer-doctors-office:3000',
  'did:example:issuer:car-repair-shop': 'http://sovereign-issuer-car-repair-shop:3000',
  'did:example:issuer:sports-park': 'http://sovereign-issuer-sports-park:3000',
  'did:example:issuer:national-metal-works': 'http://sovereign-issuer-national-metal-works:3000',
  'did:example:issuer:apple-seed-insurance': 'http://sovereign-issuer-apple-seed-insurance:3000',
  'did:example:issuer:assistance-charity': 'http://sovereign-issuer-salutation-army:3000',
  'did:example:issuer:family-services': 'http://sovereign-issuer-family-services:3000',
  'did:example:issuer:transport-services': 'http://sovereign-issuer-transport-services:3000',
  'did:example:issuer:fairmannor-house': 'http://sovereign-issuer-car-repair-shop:3000',
  'did:example:issuer:safeharbor-shelter': 'http://sovereign-issuer-sports-park:3000',
  'did:example:issuer:radiology-center': 'http://sovereign-issuer-national-metal-works:3000',
  'did:example:issuer:emergency-department': 'http://sovereign-issuer-apple-seed-insurance:3000',
  'did:example:issuer:legal-benefits-aid': 'http://sovereign-issuer-assistance-charity:3000'
};

const envIssuerInternalOriginByDid = (() => {
  const raw = String(process.env.ISSUER_INTERNAL_ORIGIN_BY_DID || '').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    for (const [did, origin] of Object.entries(parsed)) {
      const didKey = normalizeIssuerDidKey(did);
      const cleanedOrigin = String(origin || '').trim().replace(/\/+$/, '');
      if (!didKey || !cleanedOrigin) continue;
      out[didKey] = cleanedOrigin;
    }
    return out;
  } catch {
    return {};
  }
})();
const issuerInternalOriginByDid = {
  ...defaultIssuerInternalOriginByDid,
  ...envIssuerInternalOriginByDid
};

const hashString = (value) => crypto.createHash('sha256').update(String(value)).digest('base64url');

const parseStringList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
};

const uniq = (values) => Array.from(new Set(values));

const normalizeInterAgencyConstraints = (input) => {
  const sources = [];
  const root = input && typeof input === 'object' ? input : {};
  sources.push(root);
  if (root.constraints && typeof root.constraints === 'object') sources.push(root.constraints);
  if (root.filters && typeof root.filters === 'object') sources.push(root.filters);

  const normalized = {
    categories: [],
    recordTypes: [],
    recordIds: [],
    actionIds: [],
    sourceContainers: []
  };

  for (const source of sources) {
    normalized.categories.push(...parseStringList(source.categories || source.allowedCategories || source.kinds));
    normalized.recordTypes.push(...parseStringList(source.recordTypes || source.allowedRecordTypes));
    normalized.recordIds.push(...parseStringList(source.recordIds || source.allowedRecordIds));
    normalized.actionIds.push(...parseStringList(source.actionIds || source.allowedActionIds));
    normalized.sourceContainers.push(...parseStringList(source.sourceContainers || source.allowedSourceContainers));
  }

  const out = {};
  const categories = uniq(normalized.categories.map((entry) => entry.toLowerCase()));
  const recordTypes = uniq(normalized.recordTypes.map((entry) => entry.toLowerCase()));
  const recordIds = uniq(normalized.recordIds);
  const actionIds = uniq(normalized.actionIds.map((entry) => entry.toLowerCase()));
  const sourceContainers = uniq(normalized.sourceContainers.map((entry) => entry.toLowerCase()));

  if (categories.length > 0) out.categories = categories;
  if (recordTypes.length > 0) out.recordTypes = recordTypes;
  if (recordIds.length > 0) out.recordIds = recordIds;
  if (actionIds.length > 0) out.actionIds = actionIds;
  if (sourceContainers.length > 0) out.sourceContainers = sourceContainers;
  return out;
};

const hasInterAgencyConstraints = (constraints) => Object.keys(constraints || {}).length > 0;

const interAgencyConstraintKeys = ['categories', 'recordTypes', 'recordIds', 'actionIds', 'sourceContainers'];
const emergencyBreakGlassAllowedScopes = new Set(['subject_records', 'doctor_record_access', 'medical_record_access']);
const emergencyBreakGlassReasonCodes = new Set([
  'unconscious',
  'life_threatening',
  'critical_trauma',
  'serious_harm_prevention',
  'unknown_history'
]);

const isRequestWithinGrantConstraints = (grantConstraints, requestConstraints) => {
  const violations = {};
  for (const key of interAgencyConstraintKeys) {
    const grantValues = Array.isArray(grantConstraints?.[key]) ? grantConstraints[key] : [];
    const requestValues = Array.isArray(requestConstraints?.[key]) ? requestConstraints[key] : [];
    if (requestValues.length === 0 || grantValues.length === 0) continue;
    const denied = requestValues.filter((value) => !grantValues.includes(value));
    if (denied.length > 0) violations[key] = denied;
  }
  return {
    ok: Object.keys(violations).length === 0,
    violations
  };
};

const combineInterAgencyConstraints = (grantConstraints, requestConstraints) => {
  const combined = {};
  for (const key of interAgencyConstraintKeys) {
    const grantValues = Array.isArray(grantConstraints?.[key]) ? grantConstraints[key] : [];
    const requestValues = Array.isArray(requestConstraints?.[key]) ? requestConstraints[key] : [];
    if (grantValues.length === 0 && requestValues.length === 0) continue;
    if (grantValues.length === 0) {
      combined[key] = requestValues;
      continue;
    }
    if (requestValues.length === 0) {
      combined[key] = grantValues;
      continue;
    }
    combined[key] = requestValues.filter((value) => grantValues.includes(value));
  }
  return combined;
};

const recordMatchesInterAgencyConstraints = (record, constraints) => {
  if (!hasInterAgencyConstraints(constraints)) return true;

  const category = String(record?.kind || '').trim().toLowerCase();
  const recordId = String(record?.id || '').trim();
  const sourceContainer = String(record?.sourceContainer || '').trim().toLowerCase();
  const actionId = String(record?.actionId || '').trim().toLowerCase();
  const recordTypes = uniq([
    ...(Array.isArray(record?.recordTypes) ? record.recordTypes : []),
    ...(typeof record?.recordType === 'string' && record.recordType.trim() ? [record.recordType.trim()] : []),
    ...(record?.kind === 'credential' ? credentialTypes(record?.credential).filter((type) => type !== 'VerifiableCredential') : [])
  ].map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean));

  if (Array.isArray(constraints?.categories) && constraints.categories.length > 0 && !constraints.categories.includes(category)) {
    return false;
  }
  if (Array.isArray(constraints?.recordIds) && constraints.recordIds.length > 0 && !constraints.recordIds.includes(recordId)) {
    return false;
  }
  if (Array.isArray(constraints?.sourceContainers) && constraints.sourceContainers.length > 0 && !constraints.sourceContainers.includes(sourceContainer)) {
    return false;
  }
  if (Array.isArray(constraints?.actionIds) && constraints.actionIds.length > 0 && !constraints.actionIds.includes(actionId)) {
    return false;
  }
  if (Array.isArray(constraints?.recordTypes) && constraints.recordTypes.length > 0) {
    const overlaps = recordTypes.some((type) => constraints.recordTypes.includes(type));
    if (!overlaps) return false;
  }
  return true;
};

const grantInterAgencyConsent = ({ subjectDid, targetAgencyDid, scope, grantedByWebId, expiresAt = null, constraints = {} }) => {
  const grants = interAgencyConsentGrantsBySubject.get(subjectDid) || [];
  const normalizedConstraints = normalizeInterAgencyConstraints(constraints);
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
    status: 'active',
    constraints: normalizedConstraints
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
  const allowedScopes = Array.isArray(scope)
    ? scope.map((entry) => String(entry || '').trim()).filter(Boolean)
    : (scope ? [String(scope).trim()] : []);
  return grants.find((grant) => {
    if (grant.status !== 'active') return false;
    if (grant.targetAgencyDid !== targetAgencyDid) return false;
    if (allowedScopes.length > 0 && !allowedScopes.includes(grant.scope)) return false;
    if (!grant.expiresAt) return true;
    const expMs = Date.parse(String(grant.expiresAt));
    return Number.isFinite(expMs) && expMs > Date.now();
  }) || null;
};

const normalizeEmergencyBreakGlassRequest = (input) => {
  const raw = input && typeof input === 'object' ? input : {};
  const enabledRaw = raw.enabled ?? raw.breakGlass ?? raw.override ?? false;
  const enabled = typeof enabledRaw === 'string'
    ? ['1', 'true', 'yes', 'on'].includes(enabledRaw.trim().toLowerCase())
    : Boolean(enabledRaw);
  const reasonCode = String(raw.reasonCode || raw.reason || '').trim().toLowerCase().replace(/\s+/g, '_');
  const incidentId = String(raw.incidentId || raw.caseId || '').trim();
  const justification = String(raw.justification || raw.note || raw.details || '').trim();
  const requestedByStaffWebId = String(raw.requestedByStaffWebId || raw.staffWebId || '').trim();
  return {
    enabled,
    reasonCode,
    incidentId,
    justification,
    requestedByStaffWebId
  };
};

const recordEmergencyBreakGlassEvent = (entry) => {
  const event = {
    id: `breakglass-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    ...entry
  };
  emergencyBreakGlassAccessLog.push(event);
  if (emergencyBreakGlassAccessLog.length > 500) {
    emergencyBreakGlassAccessLog.splice(0, emergencyBreakGlassAccessLog.length - 500);
  }
  return event;
};

const authorizeEmergencyBreakGlassRequest = async ({ subjectDid, targetAgencyDid, scope, request }) => {
  const emergencyRequest = normalizeEmergencyBreakGlassRequest(request);
  if (!emergencyRequest.enabled) {
    return { ok: false, reason: 'emergency break-glass override not requested' };
  }
  if (normalizeMatchToken(targetAgencyDid) !== normalizeMatchToken(emergencyDepartmentIssuerDid)) {
    return { ok: false, reason: 'emergency break-glass is only permitted for emergency-department target' };
  }
  if (!emergencyBreakGlassAllowedScopes.has(String(scope || '').trim())) {
    return { ok: false, reason: 'scope not allowed for emergency break-glass access' };
  }
  if (!emergencyBreakGlassReasonCodes.has(emergencyRequest.reasonCode)) {
    return {
      ok: false,
      reason: 'valid emergency reasonCode is required',
      allowedReasonCodes: Array.from(emergencyBreakGlassReasonCodes)
    };
  }
  if (emergencyRequest.justification.length < 12) {
    return { ok: false, reason: 'emergency justification must be at least 12 characters' };
  }
  if (!emergencyRequest.requestedByStaffWebId) {
    return { ok: false, reason: 'requestedByStaffWebId is required for emergency break-glass access' };
  }

  const staffAuthorization = await verifyProviderStaffAccessWithSovereign(
    emergencyRequest.requestedByStaffWebId,
    {
      issuerDid: emergencyDepartmentIssuerDid,
      siteDir: emergencyDepartmentSiteDir
    }
  );
  if (!staffAuthorization.ok) {
    return {
      ok: false,
      reason: 'active emergency-department staff credential required for break-glass access',
      detail: staffAuthorization.reason
    };
  }

  return {
    ok: true,
    emergencyAccess: {
      mode: 'emergency_break_glass',
      subjectDid,
      targetAgencyDid,
      scope,
      reasonCode: emergencyRequest.reasonCode,
      incidentId: emergencyRequest.incidentId || `incident-${crypto.randomUUID()}`,
      justification: emergencyRequest.justification,
      requestedByStaffWebId: emergencyRequest.requestedByStaffWebId,
      staffCredentialId: staffAuthorization.credentialId || null,
      staffCredentialIssuerDid: staffAuthorization.credentialIssuerDid || null
    }
  };
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
  return grants.find((grant) => {
    if (grant.status !== 'active') return false;
    if (subjectDid && grant.subjectDid !== subjectDid) return false;
    if (grant.requesterWebId !== requesterWebId) return false;
    if (!grant.expiresAt) return true;
    const expMs = Date.parse(String(grant.expiresAt));
    return Number.isFinite(expMs) && expMs > Date.now();
  }) || null;
};

const createDoctorRecordLinkCredential = ({ subjectDid, recordId, recordType = 'xray', recordDigest, issuedAt, baseUrl, relationshipMetadata = {} }) => {
  const linkProofJws = hashString(`${siteDir}:${recordType}-link:${recordId}:${issuedAt}:${subjectDid}:${recordDigest}`);
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
      recordType,
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
          const issuedTypes = credentialTypes(credential).filter((type) => type !== 'VerifiableCredential');
          candidateSubjectDid = String(payload.subjectDid || credential?.credentialSubject?.id || '').trim();
          if (candidateSubjectDid !== subjectDid) continue;
          records.push({
            sourceContainer: container.kind,
            resourceUrl,
            kind: 'credential',
            id: payload.id || credential.id || resourceUrl,
            storedAt: payload.storedAt || null,
            actionId: payload.actionId || credential?.credentialSubject?.relationshipMetadata?.transaction?.actionId || null,
            recordTypes: issuedTypes,
            credential
          });
          continue;
        }

        candidateSubjectDid = String(payload.subjectDid || payload?.record?.subjectDid || '').trim();
        if (candidateSubjectDid !== subjectDid) continue;
        const rawRecordType = payload.recordType || payload?.record?.recordType || '';
        records.push({
          sourceContainer: container.kind,
          resourceUrl,
          kind: 'record',
          id: payload.id || payload.recordId || resourceUrl,
          storedAt: payload.storedAt || null,
          actionId: payload.actionId || null,
          recordType: String(rawRecordType || '').trim() || null,
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

const resolveIssuerInternalOriginFromDid = (sourceIssuerDid) => {
  const didKey = normalizeIssuerDidKey(sourceIssuerDid);
  if (!didKey) return '';
  const mapped = String(issuerInternalOriginByDid[didKey] || '').trim().replace(/\/+$/, '');
  if (mapped) return mapped;
  const prefix = 'did:example:issuer:';
  if (!didKey.startsWith(prefix)) return '';
  const siteToken = didKey.slice(prefix.length).trim();
  if (!siteToken) return '';
  return `http://sovereign-issuer-${siteToken}:3000`;
};

const decryptSharedEnvelopeForWebId = async ({ webId, envelope }) => {
  if (!credentialExplorerInternalOrigin) {
    return { ok: false, reason: 'credential explorer internal origin is not configured' };
  }
  try {
    const response = await fetch(`${credentialExplorerInternalOrigin}/api/decrypt-shared-envelope`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webId, envelope })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reason: payload?.error || `decrypt failed (${response.status})`,
        detail: payload
      };
    }
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const fetchSharedSubjectRecordsFromSourceIssuer = async ({
  sourceIssuerDid,
  subjectDid,
  targetAgencyDid,
  scope = 'subject_records',
  constraints = {},
  emergencyAccess = null
}) => {
  const sourceOrigin = resolveIssuerInternalOriginFromDid(sourceIssuerDid);
  if (!sourceOrigin) {
    return {
      ok: false,
      status: 400,
      reason: `no internal issuer origin mapping available for ${sourceIssuerDid}`
    };
  }

  const exportBody = {
    subjectDid,
    targetAgencyDid,
    scope
  };
  const normalizedConstraints = normalizeInterAgencyConstraints(constraints);
  if (hasInterAgencyConstraints(normalizedConstraints)) {
    if (Array.isArray(normalizedConstraints.categories) && normalizedConstraints.categories.length > 0) {
      exportBody.allowedCategories = normalizedConstraints.categories.join(',');
    }
    if (Array.isArray(normalizedConstraints.recordTypes) && normalizedConstraints.recordTypes.length > 0) {
      exportBody.allowedRecordTypes = normalizedConstraints.recordTypes.join(',');
    }
    if (Array.isArray(normalizedConstraints.recordIds) && normalizedConstraints.recordIds.length > 0) {
      exportBody.allowedRecordIds = normalizedConstraints.recordIds.join(',');
    }
    if (Array.isArray(normalizedConstraints.actionIds) && normalizedConstraints.actionIds.length > 0) {
      exportBody.allowedActionIds = normalizedConstraints.actionIds.join(',');
    }
    if (Array.isArray(normalizedConstraints.sourceContainers) && normalizedConstraints.sourceContainers.length > 0) {
      exportBody.allowedSourceContainers = normalizedConstraints.sourceContainers.join(',');
    }
  }
  const emergencyRequest = normalizeEmergencyBreakGlassRequest(emergencyAccess);
  if (emergencyRequest.enabled) {
    exportBody.emergencyAccess = {
      enabled: true,
      reasonCode: emergencyRequest.reasonCode,
      incidentId: emergencyRequest.incidentId,
      justification: emergencyRequest.justification,
      requestedByStaffWebId: emergencyRequest.requestedByStaffWebId
    };
  }

  try {
    const response = await fetch(`${sourceOrigin}/api/sharing/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exportBody)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reason: payload?.error || `source export failed (${response.status})`,
        detail: payload
      };
    }
    return { ok: true, payload, sourceOrigin };
  } catch (err) {
    return { ok: false, status: 502, reason: err.message };
  }
};

const summarizeSharedRecordForIntake = (record) => {
  if (!record || typeof record !== 'object') return {};
  const out = {};
  if (record.kind === 'record' && record.record && typeof record.record === 'object') {
    const recommendationType = String(record.record?.recommendation?.recommendationType || '').trim();
    const recommendationNote = String(record.record?.recommendation?.note || '').trim();
    const imagingCategory = String(record.record?.imagingOrder?.category || '').trim();
    if (recommendationType) out.recommendationType = recommendationType;
    if (imagingCategory) out.imagingOrderCategory = imagingCategory;
    if (recommendationNote) out.recommendationNote = recommendationNote;
  }
  if (record.kind === 'credential' && record.credential && typeof record.credential === 'object') {
    const credentialTypesList = credentialTypes(record.credential).filter((type) => type !== 'VerifiableCredential');
    if (credentialTypesList.length > 0) out.credentialTypes = credentialTypesList;
  }
  return out;
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

const isStephenStafferIdentity = (webId) => normalizeMatchToken(webId) === normalizeMatchToken(stephenStafferWebId);

const getStaffCredentialGrants = (credential) => {
  const subject = credential?.credentialSubject && typeof credential.credentialSubject === 'object'
    ? credential.credentialSubject
    : {};
  const allProviders = Boolean(
    subject.allProviders ||
    subject.globalStaffAccess ||
    subject?.staffAccess?.allProviders
  );
  const allowedIssuerDids = uniq(parseStringList(subject.allowedIssuerDids || subject.providerIssuerDids || subject.providerDids));
  const allowedSiteDirs = uniq(parseStringList(subject.allowedSiteDirs || subject.providerSiteDirs || subject.sites));
  const allowedActionScopes = uniq(parseStringList(subject.allowedActionScopes || subject.actionScopes));
  return {
    allProviders,
    allowedIssuerDids,
    allowedSiteDirs,
    allowedActionScopes
  };
};

const isStaffCredentialActiveForWebId = (credential, webId) => {
  const subject = credential?.credentialSubject && typeof credential.credentialSubject === 'object'
    ? credential.credentialSubject
    : {};
  const subjectWebId = String(subject.webId || '').trim();
  const subjectDid = String(subject.id || '').trim();
  const expectedDid = deriveSubjectDidFromWebId(webId);
  const lifecycle = String(subject.lifecycleStatus || subject.status || '').trim().toLowerCase();
  if (lifecycle === 'revoked' || lifecycle === 'terminated' || lifecycle === 'inactive') return false;
  if (subjectWebId && normalizeMatchToken(subjectWebId) !== normalizeMatchToken(webId)) return false;
  if (subjectDid && subjectDid !== expectedDid) return false;
  const expMs = Date.parse(String(subject.expiryDate || credential?.expirationDate || ''));
  if (Number.isFinite(expMs) && expMs < Date.now()) return false;
  return true;
};

const hasStaffAccessForIssuer = (credential, { issuerDid: targetIssuerDid, siteDir: targetSiteDir }) => {
  const grants = getStaffCredentialGrants(credential);
  if (grants.allowedActionScopes.length > 0 && !grants.allowedActionScopes.includes('issuer_staff')) return false;
  if (grants.allProviders) return true;
  if (grants.allowedIssuerDids.includes(targetIssuerDid)) return true;
  if (grants.allowedSiteDirs.includes(targetSiteDir)) return true;
  return false;
};

const findMatchingProviderStaffCredential = (credentials, webId, target) => {
  for (const credential of credentials) {
    const types = credentialTypes(credential);
    if (!types.includes(providerStaffCredentialType)) continue;
    if (!isStaffCredentialActiveForWebId(credential, webId)) continue;
    if (!hasStaffAccessForIssuer(credential, target)) continue;
    return credential;
  }
  return null;
};

const verifyProviderStaffAccessWithSovereign = async (webId, target = { issuerDid, siteDir }) => {
  const walletRead = await fetchWalletCredentialsForWebId(webId);
  if (!walletRead.ok) {
    return { ok: false, reason: walletRead.reason, mode: 'wallet_read_failed' };
  }
  const matched = findMatchingProviderStaffCredential(walletRead.credentials, webId, target);
  if (!matched) {
    return {
      ok: false,
      reason: `Missing active ${providerStaffCredentialType} for staff actions`,
      mode: 'staff_credential_missing'
    };
  }
  return {
    ok: true,
    mode: 'staff_credential',
    credentialId: matched.id || null,
    credentialIssuerDid: credentialIssuerDid(matched) || null
  };
};

const buildGlobalProviderStaffCredential = (webId) => {
  const issuedAt = new Date().toISOString();
  const subjectDid = deriveSubjectDidFromWebId(webId);
  const allowedSiteDirs = Object.keys(issuerProfiles);
  const allowedIssuerDids = allowedSiteDirs.map((entry) => `did:example:issuer:${entry}`);
  const credential = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: ['VerifiableCredential', providerStaffCredentialType],
    issuer: {
      id: providerStaffIssuerDid,
      name: providerStaffIssuerName
    },
    issuanceDate: issuedAt,
    validFrom: issuedAt,
    credentialSubject: {
      id: subjectDid,
      webId,
      staffName: 'Stephen Staffer',
      roleTitle: 'Provider Operations Staff',
      organization: 'Sovereign NGO',
      lifecycleStatus: 'active',
      allProviders: true,
      allowedSiteDirs,
      allowedIssuerDids,
      allowedActionScopes: ['issuer_staff']
    },
    proof: {
      type: 'MockIssuerSignature2026',
      created: issuedAt,
      verificationMethod: `${providerStaffIssuerDid}#key-1`,
      proofPurpose: 'assertionMethod',
      jws: hashString(`provider_staff:${webId}:${issuedAt}`)
    }
  };
  return credential;
};

const buildIssuerBusinessRegistrationCredential = () => {
  const issuedAt = new Date().toISOString();
  const expiryAt = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString();
  const registrationStamp = issuedAt.slice(0, 10).replaceAll('-', '');
  const registrationSuffix = String(siteDir || 'issuer').toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  const registrationNumber = `REG-${registrationSuffix}-${registrationStamp}`;
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: ['VerifiableCredential', businessRegistrationCredentialType],
    issuer: {
      id: businessRegistryVerifierDid,
      name: businessRegistryVerifierName
    },
    issuanceDate: issuedAt,
    validFrom: issuedAt,
    credentialSubject: {
      id: deriveSubjectDidFromWebId(issuerWebId || `did:web:issuer:${siteDir}`),
      businessName: siteProfile.issuerName,
      registrationNumber,
      jurisdiction: 'Regional Service Registry',
      registrationStatus: 'active',
      issuedDate: issuedAt.slice(0, 10),
      expiryDate: expiryAt.slice(0, 10),
      businessType: 'Essential Services Provider'
    },
    proof: {
      type: 'MockVerifierSignature2026',
      created: issuedAt,
      verificationMethod: `${businessRegistryVerifierDid}#key-1`,
      proofPurpose: 'assertionMethod',
      jws: hashString(`business_registration:${siteDir}:${registrationNumber}:${issuedAt}`)
    }
  };
};

const ensureIssuerBusinessRegistrationCredential = async () => {
  if (!businessRegistrationRequiredSites.has(siteDir)) {
    return { ok: true, seeded: false, reason: 'not_required_for_site' };
  }
  if (!issuerWebId) {
    return { ok: false, seeded: false, reason: 'issuer webid is not configured' };
  }

  const existing = await fetchIssuerBusinessRegistrationCredential();
  if (existing.ok) {
    return { ok: true, seeded: false, credentialId: existing.summary?.credentialId || null, source: 'existing' };
  }

  const credential = buildIssuerBusinessRegistrationCredential();
  const stored = await storeCredentialProofToSovereign(issuerWebId, credential);
  if (!stored.ok) {
    return { ok: false, seeded: false, reason: stored.reason };
  }
  return { ok: true, seeded: true, credentialId: credential.id || null, source: 'provisioned' };
};

const ensureStephenStafferCredential = async (webId) => {
  if (!isStephenStafferIdentity(webId)) {
    return { ok: true, seeded: false, reason: 'not_staff_identity' };
  }

  const walletRead = await fetchWalletCredentialsForWebId(webId);
  if (!walletRead.ok) {
    return { ok: false, seeded: false, reason: walletRead.reason };
  }

  const existing = findMatchingProviderStaffCredential(walletRead.credentials, webId, { issuerDid, siteDir });
  if (existing) {
    return { ok: true, seeded: false, credentialId: existing.id || null, source: 'existing' };
  }

  const credential = buildGlobalProviderStaffCredential(webId);
  const stored = await storeCredentialProofToSovereign(webId, credential);
  if (!stored.ok) {
    return { ok: false, seeded: false, reason: stored.reason };
  }
  return { ok: true, seeded: true, credentialId: credential.id || null, source: 'provisioned' };
};

const waitMs = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

const provisionIssuerBusinessRegistrationOnStartup = async () => {
  if (!businessRegistrationRequiredSites.has(siteDir)) return;

  for (let attempt = 1; attempt <= startupStephenProvisionMaxAttempts; attempt += 1) {
    const provision = await ensureIssuerBusinessRegistrationCredential();
    if (provision.ok) {
      const statusLabel = provision.seeded ? 'seeded' : 'already-present';
      console.log(`[startup][${siteDir}] Issuer business registration credential ${statusLabel} on attempt ${attempt}/${startupStephenProvisionMaxAttempts}`);
      return;
    }

    console.warn(`[startup][${siteDir}] Issuer business registration credential provisioning failed on attempt ${attempt}/${startupStephenProvisionMaxAttempts}: ${provision.reason || 'unknown'}`);
    if (attempt < startupStephenProvisionMaxAttempts) {
      await waitMs(startupStephenProvisionDelayMs);
    }
  }

  console.error(`[startup][${siteDir}] Issuer business registration credential provisioning failed after ${startupStephenProvisionMaxAttempts} attempts`);
};

const provisionStephenStaffCredentialOnStartup = async () => {
  for (let attempt = 1; attempt <= startupStephenProvisionMaxAttempts; attempt += 1) {
    const provision = await ensureStephenStafferCredential(stephenStafferWebId);
    if (provision.ok) {
      const statusLabel = provision.seeded ? 'seeded' : 'already-present';
      console.log(`[startup][${siteDir}] Stephen staff credential ${statusLabel} on attempt ${attempt}/${startupStephenProvisionMaxAttempts}`);
      return;
    }

    console.warn(`[startup][${siteDir}] Stephen staff credential provisioning failed on attempt ${attempt}/${startupStephenProvisionMaxAttempts}: ${provision.reason || 'unknown'}`);
    if (attempt < startupStephenProvisionMaxAttempts) {
      await waitMs(startupStephenProvisionDelayMs);
    }
  }

  console.error(`[startup][${siteDir}] Stephen staff credential provisioning failed after ${startupStephenProvisionMaxAttempts} attempts`);
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

    const entries = [];
    for (const resourceUrl of listed.resources) {
      const response = await fetch(resourceUrl, { headers: { Accept: 'application/json' } });
      if (!response.ok) continue;
      const payload = await response.json().catch(() => null);
      if (!payload || typeof payload !== 'object') continue;
      const types = credentialTypes(payload);
      if (types.length === 0) continue;
      entries.push({ resourceUrl, credential: payload });
    }

    return {
      ok: true,
      entries,
      credentials: entries.map((entry) => entry.credential),
      credentialsContainer: resolution.credentialsContainer,
      resources: listed.resources
    };
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
  if (!businessRegistrationRequiredSites.has(siteDir)) {
    json(res, 404, { ok: false, error: 'public business license endpoint only available for business-registered issuer sites' });
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

const storeDoctorRecordToIssuerPod = async ({ recordId, recordType = 'xray', recordPayload, recordDigest, recordSignature, subjectDid, webId }) => {
  if (!solidPodUrl) return { ok: false, reason: 'issuer solid pod url not configured' };

  const baseUrl = mapToInternalSovereignOrigin(solidPodUrl).replace(/\/+$/, '');
  const containerUrl = `${baseUrl}/records/`;
  const resourceUrl = `${containerUrl}${recordId}.json`;
  const record = {
    id: recordId,
    recordType,
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

const normalizeMatchToken = (value) => String(value || '').trim().toLowerCase().replace(/\/+$/, '');

const addMatchToken = (set, value) => {
  if (!(set instanceof Set)) return;
  const normalized = normalizeMatchToken(value);
  if (normalized) set.add(normalized);
};

const collectCredentialRoutingTokens = (credential) => {
  const tokens = new Set();
  if (!credential || typeof credential !== 'object') return tokens;
  const subject = credential.credentialSubject && typeof credential.credentialSubject === 'object'
    ? credential.credentialSubject
    : {};
  const payload = subject.payload && typeof subject.payload === 'object' ? subject.payload : {};
  const candidates = [
    subject.recommendedProviderDid,
    subject.recommendedProviderName,
    subject.recommendedProviderPortal,
    subject.targetAgencyDid,
    subject.targetAgencyPortal,
    subject.targetIssuerDid,
    subject.providerDid,
    subject.providerPortal,
    payload.recommendedProviderDid,
    payload.recommendedProviderPortal,
    payload.targetAgencyDid,
    payload.targetAgencyPortal,
    payload.targetIssuerDid,
    payload.providerDid,
    payload.providerPortal
  ];
  for (const candidate of candidates) addMatchToken(tokens, candidate);
  return tokens;
};

const credentialTargetsCurrentIssuer = ({ credential, currentIssuerTokens, currentPortalOrigin, currentIssuerName }) => {
  const routingTokens = collectCredentialRoutingTokens(credential);
  for (const token of routingTokens) {
    if (currentIssuerTokens.has(token)) return { matched: true, reason: 'explicit_target_match' };
    if (currentPortalOrigin && token.startsWith(`${currentPortalOrigin}/`)) {
      return { matched: true, reason: 'portal_origin_match' };
    }
  }

  const subject = credential?.credentialSubject && typeof credential.credentialSubject === 'object'
    ? credential.credentialSubject
    : {};
  const payload = subject?.payload && typeof subject.payload === 'object' ? subject.payload : {};
  const types = credentialTypes(credential);
  const issuingDid = normalizeMatchToken(credentialIssuerDid(credential));
  const trustedReferralIssuers = trustedIssuersForType('ExternalMedicalRecordLinkCredential')
    .map((entry) => normalizeMatchToken(entry))
    .filter(Boolean);
  const trustedBusinessRegistryIssuers = trustedIssuersForType('BusinessRegistrationCredential')
    .map((entry) => normalizeMatchToken(entry))
    .filter(Boolean);
  const recordTypeToken = String(subject.recordType || payload.recordType || '').trim();
  const modalityToken = String(subject.modality || payload.modality || '').trim();
  const referralModality = normalizeImagingModality(recordTypeToken) || normalizeImagingModality(modalityToken);
  const fulfillmentModel = normalizeMatchToken(subject.fulfillmentModel || payload.fulfillmentModel || '');
  const fulfillmentProviderClass = normalizeMatchToken(subject.fulfillmentProviderClass || payload.fulfillmentProviderClass || '');
  const issuerBusinessRegistration = subject.issuerBusinessRegistration && typeof subject.issuerBusinessRegistration === 'object'
    ? subject.issuerBusinessRegistration
    : (payload.issuerBusinessRegistration && typeof payload.issuerBusinessRegistration === 'object' ? payload.issuerBusinessRegistration : null);
  const issuerBusinessStatus = normalizeMatchToken(issuerBusinessRegistration?.registrationStatus || '');
  const issuerBusinessVerifierDid = normalizeMatchToken(issuerBusinessRegistration?.verifierDid || '');
  const hasTrustedIssuerBusinessProof = Boolean(issuerBusinessRegistration) &&
    (!issuerBusinessStatus || issuerBusinessStatus === 'active') &&
    (trustedBusinessRegistryIssuers.length === 0 || (issuerBusinessVerifierDid && trustedBusinessRegistryIssuers.includes(issuerBusinessVerifierDid)));
  const allowsAnyQualifiedProvider = fulfillmentModel === 'any_qualified_provider' ||
    fulfillmentProviderClass === 'xray_processing_provider' ||
    fulfillmentProviderClass === 'ultrasound_processing_provider';
  if (
    types.includes('ExternalMedicalRecordLinkCredential') &&
    (trustedReferralIssuers.length === 0 || trustedReferralIssuers.includes(issuingDid)) &&
    currentProviderCanProcessImagingReferrals() &&
    hasTrustedIssuerBusinessProof &&
    allowsAnyQualifiedProvider
  ) {
    if (!referralModality) {
      return { matched: true, reason: 'qualified_provider_referral_match' };
    }
    if (currentProviderCanFulfillImagingModality(referralModality)) {
      return { matched: true, reason: 'qualified_provider_referral_match' };
    }
  }

  const recommendedProviderName = normalizeMatchToken(subject.recommendedProviderName);
  if (recommendedProviderName && currentIssuerName && recommendedProviderName === currentIssuerName) {
    return { matched: true, reason: 'provider_name_match' };
  }

  return { matched: false, reason: null };
};

const collectProviderDataHolderDidCandidatesFromCredential = (credential) => {
  const subject = credential?.credentialSubject && typeof credential.credentialSubject === 'object'
    ? credential.credentialSubject
    : {};
  const relationships = subject.relationships && typeof subject.relationships === 'object'
    ? subject.relationships
    : {};
  const authority = relationships.authority && typeof relationships.authority === 'object'
    ? relationships.authority
    : {};
  const custody = relationships.recordCustody && typeof relationships.recordCustody === 'object'
    ? relationships.recordCustody
    : {};
  return [
    credentialIssuerDid(credential),
    authority.approvedByIssuerDid,
    custody.sourceIssuerDid,
    custody.recordIssuerDid
  ];
};

const credentialAppearsBoundToSubject = (credential, subjectDid) => {
  const normalizedSubjectDid = normalizeMatchToken(subjectDid);
  if (!normalizedSubjectDid) return true;
  const credentialSubjectDid = normalizeMatchToken(credential?.credentialSubject?.id || '');
  if (!credentialSubjectDid) return true;
  return credentialSubjectDid === normalizedSubjectDid;
};

const isProviderAgencyDid = (value) => {
  const normalized = normalizeMatchToken(value);
  if (!normalized || !normalized.startsWith('did:')) return false;
  if (normalized.includes(':verifier:')) return false;
  return true;
};

const collectAvailableInterAgencyTargetDidOptions = ({ session, walletCredentials = [] }) => {
  const subjectDid = session.subjectDid || deriveSubjectDidFromWebId(session.webId);
  const optionsByDid = new Map();

  const addOption = (didValue, label, source) => {
    const did = String(didValue || '').trim();
    if (!isProviderAgencyDid(did)) return;
    if (normalizeMatchToken(did) === normalizeMatchToken(issuerDid)) return;
    if (normalizeMatchToken(did) === normalizeMatchToken(providerStaffIssuerDid)) return;
    const key = normalizeMatchToken(did);
    if (!optionsByDid.has(key)) {
      optionsByDid.set(key, {
        did,
        label: String(label || did).trim() || did,
        sources: new Set()
      });
    }
    const entry = optionsByDid.get(key);
    if (label && !entry.label) entry.label = String(label).trim();
    if (source) entry.sources.add(source);
  };

  for (const credential of walletCredentials) {
    if (!credentialAppearsBoundToSubject(credential, subjectDid)) continue;
    const issuerName = typeof credential?.issuer === 'object'
      ? String(credential.issuer.name || '').trim()
      : '';
    const issuerDidCandidate = credentialIssuerDid(credential);
    const didCandidates = collectProviderDataHolderDidCandidatesFromCredential(credential);
    const normalizedIssuerDid = normalizeMatchToken(issuerDidCandidate);
    for (const didCandidate of didCandidates) {
      const normalizedCandidate = normalizeMatchToken(didCandidate);
      const label = normalizedCandidate === normalizedIssuerDid
        ? (issuerName || didCandidate)
        : didCandidate;
      addOption(didCandidate, label, 'wallet_credential_data_holder');
    }
  }

  return Array.from(optionsByDid.values())
    .map((entry) => ({
      did: entry.did,
      label: entry.label || entry.did,
      sources: Array.from(entry.sources.values())
    }))
    .sort((a, b) => String(a.label || a.did).localeCompare(String(b.label || b.did)));
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
  const actionsJson = JSON.stringify(scopedActions);
  const isDoctorSite = siteDir === 'doctors-office';
  const isEmergencySite = siteDir === 'emergency-department';

  return `
  <section style="max-width:920px;margin:0 auto 2rem;padding:0 1rem;">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:1rem;box-shadow:0 10px 24px rgba(0,0,0,.06);">
      <h2 style="margin-top:0;">Issuer Console API</h2>
      <p style="margin:.4rem 0;color:#4b5563;">WebID-authenticated actions for <strong>${escapeHtml(siteProfile.issuerName)}</strong>.</p>

      <label for="issuerIdentityPreset" style="display:block;font-weight:600;margin-bottom:4px;">Sovereign Identity</label>
      <select id="issuerIdentityPreset" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;">
        ${subjectIdentityOptions.map((entry) => `<option value="${escapeHtml(entry.webId)}"${entry.webId === defaultDemoIdentityWebId ? ' selected' : ''}>${escapeHtml(entry.label)}</option>`).join('')}
        <option value="__custom__">Custom WebID</option>
      </select>

      <label for="issuerWebId" style="display:block;font-weight:600;margin:8px 0 4px;">Sovereign WebID</label>
      <input id="issuerWebId" value="${escapeHtml(defaultDemoIdentityWebId)}" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;">

      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
        <button id="issuerLoginBtn" style="background:#0f766e;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Login With WebID</button>
        ${isEmergencySite
    ? '<button id="issuerEmergencyOverrideBtn" style="background:#9a3412;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Emergency Override (New John Doe)</button>'
    : ''}
      </div>
      ${isEmergencySite
    ? '<input id="issuerEmergencyCaseId" placeholder="Emergency case ID (optional)" style="margin-top:8px;width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;">'
    : ''}
      <p style="margin:.6rem 0 0;color:#334155;"><strong>Subject DID (active session):</strong> <span id="issuerSessionDid">not logged in</span></p>
      ${isEmergencySite
    ? '<p style="margin:.2rem 0 0;color:#7c2d12;"><strong>Emergency subject:</strong> <span id="issuerEmergencySubjectLabel">none</span></p>'
    : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
        <div style="border:1px solid #dbeafe;background:#f8fbff;border-radius:10px;padding:10px;">
          <label style="display:block;font-weight:700;margin-bottom:6px;color:#1e40af;">Issuer Staff Portal</label>
          <p style="margin:0 0 8px;color:#334155;font-size:12px;"><strong>Staff actor:</strong> Stephen Staffer (always signed in)</p>
          <select id="issuerStaffActionSelect" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;"></select>
          <label style="display:block;font-weight:600;margin:8px 0 4px;">Payload JSON</label>
          <textarea id="issuerStaffPayload" style="width:100%;min-height:80px;padding:8px;border:1px solid #d1d5db;border-radius:8px;">{"priority":"normal"}</textarea>
          <button id="issuerStaffRunBtn" disabled title="Staff credential required to run staff actions" style="margin-top:10px;background:#1f2937;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:not-allowed;opacity:.55;">Run Staff Action</button>
        </div>
        <div style="border:1px solid #dcfce7;background:#f7fff9;border-radius:10px;padding:10px;">
          <label style="display:block;font-weight:700;margin-bottom:6px;color:#166534;">Self-Service Portal</label>
          <select id="selfServiceActionSelect" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;"></select>
          <label style="display:block;font-weight:600;margin:8px 0 4px;">Payload JSON</label>
          <textarea id="selfServicePayload" style="width:100%;min-height:80px;padding:8px;border:1px solid #d1d5db;border-radius:8px;">{"priority":"normal"}</textarea>
          <button id="selfServiceRunBtn" disabled title="Login with WebID to run self-service actions" style="margin-top:10px;background:#166534;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:not-allowed;opacity:.55;">Run Self-Service Action</button>
        </div>
      </div>
      <div style="margin-top:10px;border:1px solid #fde68a;background:#fffbeb;border-radius:10px;padding:10px;">
        <label style="display:block;font-weight:700;margin-bottom:6px;color:#92400e;">Third-Party Referrals Fulfillable by This Provider</label>
        <div style="margin-bottom:8px;">
          <button id="thirdPartyEntriesBtn" style="background:#b45309;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Refresh Third-Party Referrals</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:8px;">
          <select id="thirdPartyReferralSelect" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;">
            <option value="">No fulfillable referrals loaded yet</option>
          </select>
          <button id="thirdPartyUseReferralBtn" disabled title="Load third-party entries first" style="background:#92400e;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:not-allowed;opacity:.55;">Load Selected Referral</button>
        </div>
        <pre id="thirdPartyEntriesOut" style="margin:0;background:#0b1020;color:#e5e7eb;border-radius:8px;padding:8px;overflow:auto;max-height:220px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;">{"entries":[]}</pre>
      </div>

      <div id="agencySharingControls" style="margin-top:12px;border:1px solid #c7d2fe;background:#f8faff;border-radius:10px;padding:10px;">
        <label style="display:block;font-weight:700;color:#1e3a8a;margin-bottom:6px;">Sovereign Inter-Agency Sharing Consent</label>
        <p style="margin:0 0 8px;color:#334155;font-size:12px;">Use this consent section for all third-party record release permissions, including medical records.</p>
        <select id="agencyTargetDid" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
          <option value="">Select provider DID...</option>
          <option value="__custom__">Custom DID</option>
        </select>
        <input id="agencyTargetDidCustom" placeholder="Custom provider DID (ex: did:example:issuer:apple-seed-insurance)" style="display:none;width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
        <select id="agencyAccessPreset" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
          <option value="everything">Allow Everything From This Provider</option>
          <option value="all_xray">Allow All X-Ray Records</option>
          <option value="all_ultrasound">Allow All Ultrasound Records</option>
          <option value="custom">Allow Specific Granular Access</option>
        </select>
        <div id="agencyCustomFields" style="display:none;border:1px dashed #bfdbfe;border-radius:8px;padding:8px;margin-bottom:8px;">
          <input id="agencyScopeCustom" value="${isDoctorSite ? 'medical_record_access' : 'subject_records'}" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;" placeholder="scope (ex: medical_record_access)">
          <input id="agencyCategoriesCustom" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;" placeholder="allowedCategories (comma-separated, ex: record,credential)">
          <input id="agencyRecordTypesCustom" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;" placeholder="allowedRecordTypes (comma-separated, ex: xray,ultrasound)">
          <input id="agencyActionIdsCustom" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;" placeholder="allowedActionIds (comma-separated)">
          <input id="agencyRecordIdsCustom" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;" placeholder="allowedRecordIds (comma-separated)">
          <input id="agencySourceContainersCustom" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;" placeholder="allowedSourceContainers (comma-separated, ex: issuer_records)">
        </div>
        <button id="agencyGrantBtn" style="background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Grant Inter-Agency Consent</button>
        <button id="agencyRevokeBtn" style="margin-left:8px;background:#334155;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Revoke Inter-Agency Consent</button>
      </div>

      ${isEmergencySite ? `
      <div id="erSharedRecordControls" style="margin-top:12px;border:1px solid #fed7aa;background:#fff7ed;border-radius:10px;padding:10px;">
        <label style="display:block;font-weight:700;color:#9a3412;margin-bottom:6px;">ER Shared Record Access</label>
        <p style="margin:0 0 8px;color:#7c2d12;font-size:12px;">Load records from the selected provider DID and attach one to ER intake. Emergency break-glass is available for life-threatening scenarios.</p>
        <label style="display:flex;align-items:center;gap:6px;margin:0 0 8px;color:#7c2d12;font-size:12px;font-weight:700;">
          <input id="erEmergencyBypassToggle" type="checkbox">
          Use Emergency Break-Glass Access
        </label>
        <div id="erEmergencyBypassFields" style="display:none;border:1px dashed #fdba74;border-radius:8px;padding:8px;margin-bottom:8px;">
          <select id="erEmergencyReason" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
            <option value="unconscious">Unconscious / unable to consent</option>
            <option value="life_threatening">Life-threatening condition</option>
            <option value="critical_trauma">Critical trauma</option>
            <option value="serious_harm_prevention">Serious harm prevention</option>
            <option value="unknown_history">Unknown history affecting urgent care</option>
          </select>
          <input id="erEmergencyIncidentId" placeholder="Incident ID (optional)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
          <input id="erEmergencyJustification" placeholder="Clinical justification (required for break-glass)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;">
        </div>
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;margin-bottom:8px;">
          <select id="erSharedRecordTypeFilter" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;">
            <option value="xray" selected>X-Ray Records</option>
            <option value="ultrasound">Ultrasound Records</option>
            <option value="all">All Shared Records</option>
          </select>
          <button id="erSharedLoadBtn" style="background:#c2410c;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Load Shared Records</button>
          <button id="erAttachSharedRecordBtn" disabled title="Load and select a shared record first" style="background:#7c2d12;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:not-allowed;opacity:.55;">Attach To ER Intake</button>
        </div>
        <select id="erSharedRecordSelect" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px;">
          <option value="">No shared records loaded yet</option>
        </select>
        <pre id="erSharedRecordsOut" style="margin:0;background:#0b1020;color:#e5e7eb;border-radius:8px;padding:8px;overflow:auto;max-height:200px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;">{"records":[]}</pre>
      </div>
      ` : ''}

      <p id="issuerApiStatus" style="margin:.6rem 0 0;color:#334155;font-weight:600;">Not logged in.</p>
      <pre id="issuerApiOut" style="margin-top:10px;background:#111827;color:#f9fafb;border-radius:10px;padding:10px;overflow:auto;max-height:320px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;">{}</pre>

      <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
        <button id="issuerIssuedRecordsBtn" style="background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Refresh Issuer Pod Records</button>
        <button id="encryptedStatsBtn" style="background:#7c3aed;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;">Refresh Encrypted Store Stats</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
        <div style="border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;padding:10px;">
          <label style="display:block;font-weight:700;margin-bottom:6px;color:#1e3a8a;">Issuer Pod Records</label>
          <pre id="issuerIssuedRecordsOut" style="margin:0;background:#0b1020;color:#e5e7eb;border-radius:8px;padding:8px;overflow:auto;max-height:220px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;">{}</pre>
        </div>
        <div style="border:1px solid #ddd6fe;background:#f5f3ff;border-radius:10px;padding:10px;">
          <label style="display:block;font-weight:700;margin-bottom:6px;color:#5b21b6;">Encrypted Third-Party Access Store</label>
          <pre id="encryptedStatsOut" style="margin:0;background:#0b1020;color:#e5e7eb;border-radius:8px;padding:8px;overflow:auto;max-height:220px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;">{}</pre>
        </div>
      </div>
    </div>
  </section>

  <script>
    (() => {
      const staticActions = ${actionsJson};
      const namedIdentityPresets = ${JSON.stringify(subjectIdentityOptions)};
      const customIdentityPresetValue = '__custom__';
      let token = '';
      let actions = [...staticActions];
      let staffAuthorization = { authorized: false, reason: 'Stephen Staffer staff credential required to run staff actions.' };

      const identityPresetEl = document.getElementById('issuerIdentityPreset');
      const webIdEl = document.getElementById('issuerWebId');
      const issuerStaffActionEl = document.getElementById('issuerStaffActionSelect');
      const selfServiceActionEl = document.getElementById('selfServiceActionSelect');
      const sessionDidEl = document.getElementById('issuerSessionDid');
      const issuerStaffPayloadEl = document.getElementById('issuerStaffPayload');
      const selfServicePayloadEl = document.getElementById('selfServicePayload');
      const outEl = document.getElementById('issuerApiOut');
      const statusEl = document.getElementById('issuerApiStatus');
      const isDoctorIssuer = ${isDoctorSite ? 'true' : 'false'};
      const isEmergencyIssuer = ${isEmergencySite ? 'true' : 'false'};
      const loginBtn = document.getElementById('issuerLoginBtn');
      const emergencyOverrideBtn = document.getElementById('issuerEmergencyOverrideBtn');
      const emergencyCaseIdEl = document.getElementById('issuerEmergencyCaseId');
      const emergencySubjectLabelEl = document.getElementById('issuerEmergencySubjectLabel');
      const issuerStaffRunBtn = document.getElementById('issuerStaffRunBtn');
      const selfServiceRunBtn = document.getElementById('selfServiceRunBtn');
      const issuedRecordsBtn = document.getElementById('issuerIssuedRecordsBtn');
      const encryptedStatsBtn = document.getElementById('encryptedStatsBtn');
      const thirdPartyEntriesBtn = document.getElementById('thirdPartyEntriesBtn');
      const issuedRecordsOutEl = document.getElementById('issuerIssuedRecordsOut');
      const encryptedStatsOutEl = document.getElementById('encryptedStatsOut');
      const thirdPartyEntriesOutEl = document.getElementById('thirdPartyEntriesOut');
      const thirdPartyReferralSelectEl = document.getElementById('thirdPartyReferralSelect');
      const thirdPartyUseReferralBtn = document.getElementById('thirdPartyUseReferralBtn');
      const erSharedLoadBtn = document.getElementById('erSharedLoadBtn');
      const erSharedRecordTypeFilterEl = document.getElementById('erSharedRecordTypeFilter');
      const erSharedRecordSelectEl = document.getElementById('erSharedRecordSelect');
      const erAttachSharedRecordBtn = document.getElementById('erAttachSharedRecordBtn');
      const erSharedRecordsOutEl = document.getElementById('erSharedRecordsOut');
      const erEmergencyBypassToggleEl = document.getElementById('erEmergencyBypassToggle');
      const erEmergencyBypassFieldsEl = document.getElementById('erEmergencyBypassFields');
      const erEmergencyReasonEl = document.getElementById('erEmergencyReason');
      const erEmergencyIncidentIdEl = document.getElementById('erEmergencyIncidentId');
      const erEmergencyJustificationEl = document.getElementById('erEmergencyJustification');
      const agencyTargetDidEl = document.getElementById('agencyTargetDid');
      const agencyTargetDidCustomEl = document.getElementById('agencyTargetDidCustom');
      const agencyAccessPresetEl = document.getElementById('agencyAccessPreset');
      const agencyCustomFieldsEl = document.getElementById('agencyCustomFields');
      const agencyScopeCustomEl = document.getElementById('agencyScopeCustom');
      const agencyCategoriesCustomEl = document.getElementById('agencyCategoriesCustom');
      const agencyRecordTypesCustomEl = document.getElementById('agencyRecordTypesCustom');
      const agencyActionIdsCustomEl = document.getElementById('agencyActionIdsCustom');
      const agencyRecordIdsCustomEl = document.getElementById('agencyRecordIdsCustom');
      const agencySourceContainersCustomEl = document.getElementById('agencySourceContainersCustom');
      const agencyGrantBtn = document.getElementById('agencyGrantBtn');
      const agencyRevokeBtn = document.getElementById('agencyRevokeBtn');
      const identityPresetByWebId = new Map(namedIdentityPresets.map((entry) => [String(entry.webId || '').trim(), entry]));
      const customAgencyTargetDidValue = '__custom__';
      const defaultAgencyTargetDidOptions = [
        { value: '', label: 'Select provider DID...' },
        { value: customAgencyTargetDidValue, label: 'Custom DID' }
      ];
      let fulfillableThirdPartyEntries = [];
      let erSharedRecordEntries = [];
      let staffActorWebId = '';
      const fulfilledReferralKeys = new Set();

      const syncIdentityPresetFromWebId = () => {
        if (!identityPresetEl || !webIdEl) return;
        const currentWebId = webIdEl.value.trim();
        if (!currentWebId) {
          identityPresetEl.value = customIdentityPresetValue;
          return;
        }
        identityPresetEl.value = identityPresetByWebId.has(currentWebId) ? currentWebId : customIdentityPresetValue;
      };

      const applyIdentityPresetToWebId = () => {
        if (!identityPresetEl || !webIdEl) return;
        const selectedWebId = String(identityPresetEl.value || '').trim();
        if (!selectedWebId || selectedWebId === customIdentityPresetValue) return;
        webIdEl.value = selectedWebId;
        syncIdentityPresetFromWebId();
      };

      const normalizeImagingModalityFromRecordType = (recordType) => {
        const normalized = String(recordType || '').trim().toLowerCase();
        if (!normalized) return '';
        if (normalized.includes('xray') || normalized.includes('x-ray')) return 'xray';
        if (normalized.includes('ultrasound')) return 'ultrasound';
        return '';
      };

      const suggestedFulfillmentActionForEntry = (entry) => {
        const modality = normalizeImagingModalityFromRecordType(entry && entry.recordType);
        if (modality === 'xray') return 'issue_xray_result';
        if (modality === 'ultrasound') return 'issue_ultrasound_result';
        return '';
      };

      const isStaffActionAvailable = (actionId) => actions.some((action) => action.id === actionId && action.actorScope !== 'self_service');

      const buildReferralFulfillmentPayload = (entry) => {
        const modality = normalizeImagingModalityFromRecordType(entry && entry.recordType);
        return {
          referralRecordId: entry && entry.recordId ? entry.recordId : null,
          referralRecordType: entry && entry.recordType ? entry.recordType : null,
          referralCredentialId: entry && entry.credentialId ? entry.credentialId : null,
          resultSummary: modality === 'ultrasound'
            ? 'Ultrasound completed; report available.'
            : 'X-ray completed; report available.'
        };
      };

      const referralEntryKey = (entry) => {
        if (!entry || typeof entry !== 'object') return '';
        const recordId = String(entry.recordId || '').trim();
        if (recordId) return 'record:' + recordId;
        const credentialId = String(entry.credentialId || '').trim();
        if (credentialId) return 'credential:' + credentialId;
        return '';
      };

      const getSelectedFulfillableEntry = () => {
        const selectedIndex = Number.parseInt(String(thirdPartyReferralSelectEl && thirdPartyReferralSelectEl.value || ''), 10);
        if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= fulfillableThirdPartyEntries.length) return null;
        const selectedEntry = fulfillableThirdPartyEntries[selectedIndex] || null;
        if (!selectedEntry || selectedEntry.isFulfilled) return null;
        return selectedEntry;
      };

      const renderErSharedRecordOptions = (entries) => {
        if (!erSharedRecordSelectEl) return;
        const previousSelection = Number.parseInt(String(erSharedRecordSelectEl.value || ''), 10);
        erSharedRecordEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
        erSharedRecordSelectEl.innerHTML = '';
        if (erSharedRecordEntries.length === 0) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No shared records loaded yet';
          erSharedRecordSelectEl.appendChild(option);
          erSharedRecordSelectEl.value = '';
          return;
        }
        erSharedRecordEntries.forEach((entry, idx) => {
          const option = document.createElement('option');
          option.value = String(idx);
          const typeLabel = String(entry && entry.recordType || 'record').trim() || 'record';
          const idLabel = String(entry && (entry.id || entry.recordId || entry.credentialId) || 'shared-record').trim() || 'shared-record';
          option.textContent = typeLabel + ' · ' + idLabel;
          erSharedRecordSelectEl.appendChild(option);
        });
        if (Number.isFinite(previousSelection) && previousSelection >= 0 && previousSelection < erSharedRecordEntries.length) {
          erSharedRecordSelectEl.value = String(previousSelection);
        } else {
          erSharedRecordSelectEl.value = '0';
        }
      };

      const getSelectedErSharedRecord = () => {
        const selectedIndex = Number.parseInt(String(erSharedRecordSelectEl && erSharedRecordSelectEl.value || ''), 10);
        if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= erSharedRecordEntries.length) return null;
        return erSharedRecordEntries[selectedIndex] || null;
      };

      const renderFulfillableThirdPartyEntries = (entries) => {
        if (!thirdPartyReferralSelectEl) return;
        const previousSelection = Number.parseInt(String(thirdPartyReferralSelectEl.value || ''), 10);
        fulfillableThirdPartyEntries = Array.isArray(entries)
          ? entries
            .map((entry) => {
              const actionId = suggestedFulfillmentActionForEntry(entry);
              const referralKey = referralEntryKey(entry);
              return actionId && isStaffActionAvailable(actionId)
                ? {
                    ...entry,
                    suggestedActionId: actionId,
                    referralKey,
                    isFulfilled: Boolean(referralKey && fulfilledReferralKeys.has(referralKey))
                  }
                : null;
            })
            .filter(Boolean)
          : [];

        thirdPartyReferralSelectEl.innerHTML = '';
        if (fulfillableThirdPartyEntries.length === 0) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No fulfillable referrals loaded yet';
          thirdPartyReferralSelectEl.appendChild(option);
          thirdPartyReferralSelectEl.value = '';
        } else {
          fulfillableThirdPartyEntries.forEach((entry, idx) => {
            const option = document.createElement('option');
            option.value = String(idx);
            const actionLabel = entry.suggestedActionId === 'issue_ultrasound_result' ? 'Ultrasound' : 'X-Ray';
            const recordLabel = String(entry.recordId || entry.credentialId || 'referral').trim();
            option.textContent = actionLabel + ' referral · ' + recordLabel + (entry.isFulfilled ? ' (fulfilled)' : '');
            if (entry.isFulfilled) {
              option.disabled = true;
              option.style.color = '#94a3b8';
              option.style.textDecoration = 'line-through';
            }
            thirdPartyReferralSelectEl.appendChild(option);
          });
          const firstActiveSelection = fulfillableThirdPartyEntries.findIndex((entry) => !entry.isFulfilled);
          if (
            Number.isFinite(previousSelection) &&
            previousSelection >= 0 &&
            previousSelection < fulfillableThirdPartyEntries.length &&
            !fulfillableThirdPartyEntries[previousSelection].isFulfilled
          ) {
            thirdPartyReferralSelectEl.value = String(previousSelection);
          } else if (firstActiveSelection >= 0) {
            thirdPartyReferralSelectEl.value = String(firstActiveSelection);
          } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'All loaded referrals are already fulfilled';
            thirdPartyReferralSelectEl.insertBefore(option, thirdPartyReferralSelectEl.firstChild || null);
            thirdPartyReferralSelectEl.value = '';
          }
        }
      };

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
        const canRunStaff = Boolean(staffAuthorization && staffAuthorization.authorized) && issuerStaffActionEl.options.length > 0;
        issuerStaffRunBtn.disabled = !canRunStaff;
        issuerStaffRunBtn.style.cursor = canRunStaff ? 'pointer' : 'not-allowed';
        issuerStaffRunBtn.style.opacity = canRunStaff ? '1' : '.55';
        issuerStaffRunBtn.title = canRunStaff
          ? 'Run staff actions as Stephen Staffer.'
          : String(staffAuthorization && staffAuthorization.reason ? staffAuthorization.reason : 'Stephen Staffer staff credential required to run staff actions.');

        const canRunSelfService = Boolean(token) && selfServiceActionEl.options.length > 0;
        selfServiceRunBtn.disabled = !canRunSelfService;
        selfServiceRunBtn.style.cursor = canRunSelfService ? 'pointer' : 'not-allowed';
        selfServiceRunBtn.style.opacity = canRunSelfService ? '1' : '.55';
        selfServiceRunBtn.title = canRunSelfService
          ? 'Run self-service action as logged-in WebID subject.'
          : (token ? 'No self-service actions available.' : 'Login with WebID to run self-service actions.');

        const hasFulfillableReferral = fulfillableThirdPartyEntries.length > 0 && Boolean(getSelectedFulfillableEntry());
        const canUseReferral = Boolean(token) && hasFulfillableReferral;
        if (thirdPartyUseReferralBtn) {
          thirdPartyUseReferralBtn.disabled = !canUseReferral;
          thirdPartyUseReferralBtn.style.cursor = canUseReferral ? 'pointer' : 'not-allowed';
          thirdPartyUseReferralBtn.style.opacity = canUseReferral ? '1' : '.55';
          thirdPartyUseReferralBtn.title = canUseReferral
            ? 'Load selected referral into staff action payload.'
            : (token ? 'No fulfillable referral selected.' : 'Login with WebID and load third-party entries first.');
        }
        if (erSharedLoadBtn) {
          const canLoadErShared = Boolean(token);
          erSharedLoadBtn.disabled = !canLoadErShared;
          erSharedLoadBtn.style.cursor = canLoadErShared ? 'pointer' : 'not-allowed';
          erSharedLoadBtn.style.opacity = canLoadErShared ? '1' : '.55';
          erSharedLoadBtn.title = canLoadErShared
            ? (
                erEmergencyBypassToggleEl && erEmergencyBypassToggleEl.checked
                  ? 'Load shared records using emergency break-glass override.'
                  : 'Load consented shared records from selected provider DID.'
              )
            : 'Login with WebID first.';
        }

        if (erAttachSharedRecordBtn) {
          const canAttachErShared = Boolean(token) && isEmergencyIssuer && Boolean(getSelectedErSharedRecord()) && isStaffActionAvailable('confirm_er_intake');
          erAttachSharedRecordBtn.disabled = !canAttachErShared;
          erAttachSharedRecordBtn.style.cursor = canAttachErShared ? 'pointer' : 'not-allowed';
          erAttachSharedRecordBtn.style.opacity = canAttachErShared ? '1' : '.55';
          erAttachSharedRecordBtn.title = canAttachErShared
            ? 'Attach selected shared record to ER intake payload.'
            : (token ? 'Load and select a shared record first.' : 'Login with WebID first.');
        }
      };

      const readElValue = (el) => (el && el.value || '').trim();
      const updateEmergencySubjectLabel = (value) => {
        if (!emergencySubjectLabelEl) return;
        emergencySubjectLabelEl.textContent = String(value || '').trim() || 'none';
      };

      const syncEmergencyBypassVisibility = () => {
        if (!erEmergencyBypassFieldsEl) return;
        const enabled = Boolean(erEmergencyBypassToggleEl && erEmergencyBypassToggleEl.checked);
        erEmergencyBypassFieldsEl.style.display = enabled ? 'block' : 'none';
      };

      const resetEmergencyBypassInputs = () => {
        if (erEmergencyBypassToggleEl) erEmergencyBypassToggleEl.checked = false;
        if (erEmergencyReasonEl) erEmergencyReasonEl.value = 'unconscious';
        if (erEmergencyIncidentIdEl) erEmergencyIncidentIdEl.value = '';
        if (erEmergencyJustificationEl) erEmergencyJustificationEl.value = '';
        syncEmergencyBypassVisibility();
      };

      const syncAgencyCustomVisibility = () => {
        if (!agencyCustomFieldsEl) return;
        const preset = readElValue(agencyAccessPresetEl) || 'everything';
        agencyCustomFieldsEl.style.display = preset === 'custom' ? 'block' : 'none';
      };

      const syncAgencyTargetDidCustomVisibility = () => {
        if (!agencyTargetDidCustomEl) return;
        const selectedDid = readElValue(agencyTargetDidEl);
        agencyTargetDidCustomEl.style.display = selectedDid === customAgencyTargetDidValue ? 'block' : 'none';
      };

      const resolveAgencyTargetDid = () => {
        const selectedDid = readElValue(agencyTargetDidEl);
        if (selectedDid === customAgencyTargetDidValue) {
          return readElValue(agencyTargetDidCustomEl);
        }
        return selectedDid;
      };

      const renderAgencyTargetDidOptions = (options) => {
        if (!agencyTargetDidEl) return;
        const currentValue = String(agencyTargetDidEl.value || '').trim();
        const nextOptions = Array.isArray(options) ? options : [];
        agencyTargetDidEl.innerHTML = '';
        defaultAgencyTargetDidOptions.forEach((entry) => {
          const option = document.createElement('option');
          option.value = entry.value;
          option.textContent = entry.label;
          agencyTargetDidEl.appendChild(option);
        });
        nextOptions.forEach((entry) => {
          const did = String(entry && entry.did || '').trim();
          if (!did || did === customAgencyTargetDidValue) return;
          const label = String(entry && entry.label || did).trim() || did;
          const option = document.createElement('option');
          option.value = did;
          option.textContent = label === did ? did : (label + ' (' + did + ')');
          agencyTargetDidEl.appendChild(option);
        });

        const selectableValues = new Set(Array.from(agencyTargetDidEl.options).map((entry) => String(entry.value || '').trim()));
        if (currentValue && selectableValues.has(currentValue)) {
          agencyTargetDidEl.value = currentValue;
        } else if (!currentValue) {
          agencyTargetDidEl.value = '';
        } else {
          agencyTargetDidEl.value = customAgencyTargetDidValue;
          if (agencyTargetDidCustomEl && currentValue !== customAgencyTargetDidValue) {
            agencyTargetDidCustomEl.value = currentValue;
          }
        }
        syncAgencyTargetDidCustomVisibility();
      };

      const loadAgencyTargetDidOptions = async () => {
        if (!token) {
          renderAgencyTargetDidOptions([]);
          return;
        }
        try {
          const res = await fetch('/api/sharing/available-target-dids', {
            headers: { Authorization: 'Bearer ' + token }
          });
          const data = await res.json();
          if (!res.ok) {
            renderAgencyTargetDidOptions([]);
            return;
          }
          renderAgencyTargetDidOptions(Array.isArray(data.targetAgencyDids) ? data.targetAgencyDids : []);
        } catch {
          renderAgencyTargetDidOptions([]);
        }
      };

      if (agencyAccessPresetEl) {
        agencyAccessPresetEl.addEventListener('change', syncAgencyCustomVisibility);
      }
      if (agencyTargetDidEl) {
        agencyTargetDidEl.addEventListener('change', syncAgencyTargetDidCustomVisibility);
      }
      if (erEmergencyBypassToggleEl) {
        erEmergencyBypassToggleEl.addEventListener('change', () => {
          syncEmergencyBypassVisibility();
          renderActions();
        });
      }
      syncAgencyCustomVisibility();
      syncAgencyTargetDidCustomVisibility();
      syncEmergencyBypassVisibility();
      updateEmergencySubjectLabel('none');
      if (identityPresetEl) {
        identityPresetEl.addEventListener('change', applyIdentityPresetToWebId);
      }
      if (webIdEl) {
        webIdEl.addEventListener('input', syncIdentityPresetFromWebId);
        webIdEl.addEventListener('blur', syncIdentityPresetFromWebId);
      }
      syncIdentityPresetFromWebId();
      renderAgencyTargetDidOptions([]);
      renderFulfillableThirdPartyEntries([]);
      renderErSharedRecordOptions([]);

      const buildInterAgencyGrantPayload = () => {
        const payload = {
          targetAgencyDid: resolveAgencyTargetDid()
        };
        const preset = readElValue(agencyAccessPresetEl) || 'everything';

        if (preset === 'everything') {
          payload.scope = 'subject_records';
          return payload;
        }

        if (preset === 'all_xray') {
          payload.scope = isDoctorIssuer ? 'medical_record_access' : 'subject_records';
          payload.allowedCategories = 'record';
          payload.allowedRecordTypes = 'xray';
          payload.allowedSourceContainers = 'issuer_records';
          return payload;
        }

        if (preset === 'all_ultrasound') {
          payload.scope = isDoctorIssuer ? 'medical_record_access' : 'subject_records';
          payload.allowedCategories = 'record';
          payload.allowedRecordTypes = 'ultrasound';
          payload.allowedSourceContainers = 'issuer_records';
          return payload;
        }

        payload.scope = readElValue(agencyScopeCustomEl) || (isDoctorIssuer ? 'medical_record_access' : 'subject_records');
        const allowedCategories = readElValue(agencyCategoriesCustomEl);
        const allowedRecordTypes = readElValue(agencyRecordTypesCustomEl);
        const allowedActionIds = readElValue(agencyActionIdsCustomEl);
        const allowedRecordIds = readElValue(agencyRecordIdsCustomEl);
        const allowedSourceContainers = readElValue(agencySourceContainersCustomEl);
        if (allowedCategories) payload.allowedCategories = allowedCategories;
        if (allowedRecordTypes) payload.allowedRecordTypes = allowedRecordTypes;
        if (allowedActionIds) payload.allowedActionIds = allowedActionIds;
        if (allowedRecordIds) payload.allowedRecordIds = allowedRecordIds;
        if (allowedSourceContainers) payload.allowedSourceContainers = allowedSourceContainers;
        return payload;
      };

      const buildInterAgencyRevokePayload = () => {
        const payload = {
          targetAgencyDid: resolveAgencyTargetDid()
        };
        const preset = readElValue(agencyAccessPresetEl) || 'everything';
        if (preset === 'everything') return payload;
        if (preset === 'all_xray' || preset === 'all_ultrasound') {
          payload.scope = isDoctorIssuer ? 'medical_record_access' : 'subject_records';
          return payload;
        }
        const scope = readElValue(agencyScopeCustomEl);
        if (scope) payload.scope = scope;
        return payload;
      };

      renderActions();

      const resetSessionViewState = () => {
        token = '';
        staffActorWebId = '';
        fulfilledReferralKeys.clear();
        erSharedRecordEntries = [];
        staffAuthorization = { authorized: false, reason: 'Stephen Staffer staff credential required to run staff actions.' };
        actions = [...staticActions];
        renderFulfillableThirdPartyEntries([]);
        renderErSharedRecordOptions([]);
        resetEmergencyBypassInputs();
        updateEmergencySubjectLabel('none');
        if (sessionDidEl) sessionDidEl.textContent = 'not logged in';
        if (erSharedRecordsOutEl) erSharedRecordsOutEl.textContent = '{"records":[]}';
        renderActions();
      };

      const applySessionData = async (data) => {
        token = data.token;
        staffActorWebId = String(data && data.staffActor && data.staffActor.webId || '').trim();
        actions = data.availableActions || staticActions;
        staffAuthorization = data.staffAuthorization || { authorized: false, reason: 'Stephen Staffer staff credential required to run staff actions.' };
        if (webIdEl && data && data.authenticatedWebId) {
          webIdEl.value = String(data.authenticatedWebId).trim();
          syncIdentityPresetFromWebId();
        }
        renderActions();
        await loadAgencyTargetDidOptions();
        if (sessionDidEl) sessionDidEl.textContent = data.subjectDid || 'unknown';
        updateEmergencySubjectLabel(data?.emergencyOverride?.subjectAlias || 'none');
      };

      loginBtn.addEventListener('click', async () => {
        statusEl.textContent = 'Logging in with WebID...';
        resetSessionViewState();
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
          await applySessionData(data);
          statusEl.textContent = staffAuthorization.authorized
            ? 'WebID login successful. Staff actions are enabled for Stephen Staffer.'
            : 'WebID login successful. Credential checks run only when required by specific actions.';
        } catch (err) {
          statusEl.textContent = 'Login error.';
          resetSessionViewState();
          outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
        }
      });

      if (emergencyOverrideBtn) {
        emergencyOverrideBtn.addEventListener('click', async () => {
          statusEl.textContent = 'Creating emergency override session...';
          resetSessionViewState();
          const incidentId = readElValue(emergencyCaseIdEl);
          const requestBody = {};
          if (incidentId) requestBody.incidentId = incidentId;
          try {
            const res = await fetch('/api/login-emergency-override', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody)
            });
            const data = await res.json();
            outEl.textContent = JSON.stringify(data, null, 2);
            if (!res.ok) {
              statusEl.textContent = 'Emergency override failed.';
              return;
            }
            await applySessionData(data);
            const emergencyAlias = String(data?.emergencyOverride?.subjectAlias || data?.authenticatedWebId || 'John Doe').trim();
            statusEl.textContent = 'Emergency override session created for ' + emergencyAlias + '.';
          } catch (err) {
            statusEl.textContent = 'Emergency override request error.';
            resetSessionViewState();
            outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
          }
        });
      }

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

      const loadThirdPartyEntries = async () => {
        if (!token) {
          statusEl.textContent = 'Please login with WebID first.';
          return;
        }
        statusEl.textContent = 'Loading third-party referrals fulfillable by this provider...';
        try {
          const res = await fetch('/api/third-party-entries', {
            headers: { Authorization: 'Bearer ' + token }
          });
          const data = await res.json();
          thirdPartyEntriesOutEl.textContent = JSON.stringify(data, null, 2);
          if (res.ok) {
            renderFulfillableThirdPartyEntries(Array.isArray(data.entries) ? data.entries : []);
            renderActions();
          } else {
            renderFulfillableThirdPartyEntries([]);
            renderActions();
          }
          statusEl.textContent = res.ok ? 'Third-party referrals refreshed.' : 'Third-party referrals request failed.';
        } catch (err) {
          statusEl.textContent = 'Third-party referrals request error.';
          thirdPartyEntriesOutEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
          renderFulfillableThirdPartyEntries([]);
          renderActions();
        }
      };

      const loadEmergencySharedRecords = async () => {
        if (!isEmergencyIssuer) return;
        if (!token) {
          statusEl.textContent = 'Please login with WebID first.';
          return;
        }
        const sourceIssuerDid = resolveAgencyTargetDid();
        if (!sourceIssuerDid) {
          statusEl.textContent = 'Select provider DID in Sovereign Inter-Agency Sharing Consent first.';
          return;
        }
        const typeFilter = String(erSharedRecordTypeFilterEl && erSharedRecordTypeFilterEl.value || 'xray').trim().toLowerCase();
        const emergencyBypassEnabled = Boolean(erEmergencyBypassToggleEl && erEmergencyBypassToggleEl.checked);
        const payload = {
          sourceIssuerDid,
          scope: 'subject_records',
          allowedCategories: 'record'
        };
        if (typeFilter && typeFilter !== 'all') {
          payload.allowedRecordTypes = typeFilter;
        }
        if (emergencyBypassEnabled) {
          const emergencyReasonCode = String(erEmergencyReasonEl && erEmergencyReasonEl.value || 'unconscious').trim().toLowerCase();
          const emergencyIncidentId = readElValue(erEmergencyIncidentIdEl);
          const emergencyJustification = readElValue(erEmergencyJustificationEl);
          if (emergencyJustification.length < 12) {
            statusEl.textContent = 'Emergency break-glass requires a clear justification (at least 12 characters).';
            return;
          }
          payload.emergencyAccess = {
            enabled: true,
            reasonCode: emergencyReasonCode || 'unconscious',
            incidentId: emergencyIncidentId || undefined,
            justification: emergencyJustification,
            requestedByStaffWebId: staffActorWebId || undefined
          };
        }
        statusEl.textContent = emergencyBypassEnabled
          ? 'Loading shared records with emergency break-glass access...'
          : 'Loading consented shared records for ER intake...';
        try {
          const res = await fetch('/api/sharing/source-records', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token
            },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (erSharedRecordsOutEl) erSharedRecordsOutEl.textContent = JSON.stringify(data, null, 2);
          if (!res.ok) {
            renderErSharedRecordOptions([]);
            renderActions();
            statusEl.textContent = 'Shared record load failed.';
            return;
          }
          renderErSharedRecordOptions(Array.isArray(data.records) ? data.records : []);
          renderActions();
          statusEl.textContent = emergencyBypassEnabled
            ? 'Shared records loaded with emergency break-glass access.'
            : 'Shared records loaded for ER intake.';
        } catch (err) {
          if (erSharedRecordsOutEl) {
            erSharedRecordsOutEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
          }
          renderErSharedRecordOptions([]);
          renderActions();
          statusEl.textContent = 'Shared record request error.';
        }
      };

      const attachSelectedSharedRecordToErIntake = () => {
        if (!isEmergencyIssuer) return;
        if (!token) {
          statusEl.textContent = 'Please login with WebID first.';
          return;
        }
        const selected = getSelectedErSharedRecord();
        if (!selected) {
          statusEl.textContent = 'Select a shared record first.';
          return;
        }
        if (!isStaffActionAvailable('confirm_er_intake')) {
          statusEl.textContent = 'ER intake staff action is not available.';
          return;
        }

        let payload = {};
        try {
          payload = issuerStaffPayloadEl.value.trim() ? JSON.parse(issuerStaffPayloadEl.value) : {};
        } catch {
          payload = {};
        }
        if (!payload || typeof payload !== 'object') payload = {};
        if (!Array.isArray(payload.linkedSharedRecords)) payload.linkedSharedRecords = [];

        const attachment = {
          sourceIssuerDid: String(selected.sourceIssuerDid || '').trim() || null,
          recordId: String(selected.id || '').trim() || null,
          recordType: String(selected.recordType || '').trim() || null,
          sourceContainer: String(selected.sourceContainer || '').trim() || null,
          attachedAt: new Date().toISOString(),
          summary: selected.summary && typeof selected.summary === 'object' ? selected.summary : null
        };
        const duplicate = payload.linkedSharedRecords.some((entry) =>
          String(entry && entry.sourceIssuerDid || '').trim() === String(attachment.sourceIssuerDid || '').trim() &&
          String(entry && entry.recordId || '').trim() === String(attachment.recordId || '').trim()
        );
        if (!duplicate) {
          payload.linkedSharedRecords.push(attachment);
        }
        if (!payload.arrivalMode) payload.arrivalMode = 'walk-in';
        if (!payload.acuityLevel) payload.acuityLevel = 'urgent';
        if (!payload.triageStartedAt) payload.triageStartedAt = new Date().toISOString();

        issuerStaffActionEl.value = 'confirm_er_intake';
        issuerStaffPayloadEl.value = JSON.stringify(payload, null, 2);
        statusEl.textContent = duplicate
          ? 'Selected shared record is already attached to ER intake payload.'
          : 'Attached shared record to ER intake payload.';
      };

      if (thirdPartyEntriesBtn) {
        thirdPartyEntriesBtn.addEventListener('click', async () => loadThirdPartyEntries());
      }

      if (thirdPartyReferralSelectEl) {
        thirdPartyReferralSelectEl.addEventListener('change', () => {
          renderActions();
        });
      }

      if (erSharedRecordSelectEl) {
        erSharedRecordSelectEl.addEventListener('change', () => {
          renderActions();
        });
      }

      if (erSharedLoadBtn) {
        erSharedLoadBtn.addEventListener('click', async () => {
          await loadEmergencySharedRecords();
        });
      }

      if (erAttachSharedRecordBtn) {
        erAttachSharedRecordBtn.addEventListener('click', () => {
          attachSelectedSharedRecordToErIntake();
          renderActions();
        });
      }

      if (thirdPartyUseReferralBtn) {
        thirdPartyUseReferralBtn.addEventListener('click', () => {
          if (!token) {
            statusEl.textContent = 'Please login with WebID first.';
            return;
          }
          const selected = getSelectedFulfillableEntry();
          if (!selected || !selected.suggestedActionId) {
            statusEl.textContent = 'Select a fulfillable referral first.';
            return;
          }
          if (!isStaffActionAvailable(selected.suggestedActionId)) {
            statusEl.textContent = 'Selected referral action is not available for this provider.';
            return;
          }
          issuerStaffActionEl.value = selected.suggestedActionId;
          issuerStaffPayloadEl.value = JSON.stringify(buildReferralFulfillmentPayload(selected), null, 2);
          statusEl.textContent = 'Loaded selected referral into staff action payload.';
        });
      }

      if (agencyGrantBtn) {
        agencyGrantBtn.addEventListener('click', async () => {
          if (!token) {
            statusEl.textContent = 'Please login with WebID first.';
            return;
          }
          statusEl.textContent = 'Granting inter-agency consent...';
          try {
            const payload = buildInterAgencyGrantPayload();
            const res = await fetch('/api/sharing/grant', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token
              },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            outEl.textContent = JSON.stringify(data, null, 2);
            statusEl.textContent = res.ok ? 'Inter-agency consent grant created.' : 'Inter-agency consent grant failed.';
          } catch (err) {
            statusEl.textContent = 'Inter-agency consent grant error.';
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
          statusEl.textContent = 'Revoking inter-agency consent...';
          try {
            const payload = buildInterAgencyRevokePayload();
            const res = await fetch('/api/sharing/revoke', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token
              },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            outEl.textContent = JSON.stringify(data, null, 2);
            statusEl.textContent = res.ok ? 'Inter-agency consent revoked.' : 'Inter-agency consent revoke failed.';
          } catch (err) {
            statusEl.textContent = 'Inter-agency consent revoke error.';
            outEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
          }
        });
      }

    })();
  </script>`;
};

const createAuthenticatedSession = async ({
  webId,
  authenticationMethod = 'webid',
  verificationMode = 'webid_login',
  verificationNote = 'credential checks are enforced per protected action',
  emergencyOverride = null
}) => {
  const token = crypto.randomUUID();
  const subjectDid = deriveSubjectDidFromWebId(webId);
  const staffWebId = stephenStafferWebId;
  const staffProvisioning = await ensureStephenStafferCredential(staffWebId);
  const staffAuthorization = await verifyProviderStaffAccessWithSovereign(staffWebId, { issuerDid, siteDir });
  const verification = {
    authorized: true,
    mode: verificationMode,
    note: verificationNote
  };
  const emergencySessionContext = emergencyOverride && typeof emergencyOverride === 'object'
    ? {
      active: true,
      subjectAlias: String(emergencyOverride.subjectAlias || '').trim() || 'John Doe',
      incidentId: String(emergencyOverride.incidentId || '').trim() || null,
      caseSlug: String(emergencyOverride.caseSlug || '').trim() || null
    }
    : null;

  sessions.set(token, {
    webId,
    subjectDid,
    staffWebId,
    staffName: 'Stephen Staffer',
    createdAt: new Date().toISOString(),
    authenticationMethod,
    verification,
    matchedCredentialType: null,
    emergencyOverride: emergencySessionContext,
    staffAuthorization: staffAuthorization.ok
      ? { authorized: true, mode: staffAuthorization.mode, credentialId: staffAuthorization.credentialId || null }
      : { authorized: false, mode: staffAuthorization.mode || 'staff_credential_missing', reason: staffAuthorization.reason }
  });

  return {
    token,
    subjectDid,
    staffWebId,
    staffProvisioning,
    staffAuthorization,
    verification,
    emergencyOverride: emergencySessionContext
  };
};

const buildLoginSuccessPayload = ({ webId, sessionData }) => ({
  ok: true,
  token: sessionData.token,
  issuer: siteProfile.issuerName,
  authenticatedWebId: webId,
  subjectDid: sessionData.subjectDid,
  matchedCredentialType: null,
  verification: sessionData.verification,
  staffActor: {
    label: 'Stephen Staffer',
    webId: sessionData.staffWebId
  },
  staffProvisioning: {
    attempted: true,
    staffWebId: sessionData.staffWebId,
    ok: sessionData.staffProvisioning.ok,
    seeded: Boolean(sessionData.staffProvisioning.seeded),
    reason: sessionData.staffProvisioning.reason || null
  },
  staffAuthorization: {
    authorized: sessionData.staffAuthorization.ok,
    webId: sessionData.staffWebId,
    mode: sessionData.staffAuthorization.mode || null,
    reason: sessionData.staffAuthorization.ok ? null : sessionData.staffAuthorization.reason,
    credentialId: sessionData.staffAuthorization.credentialId || null
  },
  emergencyOverride: sessionData.emergencyOverride || null,
  availableActions: scopedActions
});

const handleLoginWebId = async (req, res) => {
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const webId = String(body.webId || '').trim();

    if (!webId) {
      json(res, 400, { ok: false, error: 'webId is required' });
      return;
    }

    const sessionData = await createAuthenticatedSession({
      webId,
      authenticationMethod: 'webid',
      verificationMode: 'webid_login',
      verificationNote: 'credential checks are enforced per protected action'
    });

    json(res, 200, buildLoginSuccessPayload({ webId, sessionData }));
  } catch (err) {
    json(res, 500, { ok: false, error: 'webid login request failed', detail: err.message });
  }
};

const handleLoginEmergencyOverride = async (req, res) => {
  if (siteDir !== emergencyDepartmentSiteDir) {
    json(res, 404, { ok: false, error: 'emergency override login is only available for emergency-department issuer' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const incidentId = String(body.incidentId || body.caseId || '').trim();
    const johnDoeIdentity = createEmergencyJohnDoeIdentity({ incidentId });
    const sessionData = await createAuthenticatedSession({
      webId: johnDoeIdentity.webId,
      authenticationMethod: 'emergency_override',
      verificationMode: 'emergency_override_staff',
      verificationNote: 'emergency override session created for unidentified patient',
      emergencyOverride: {
        subjectAlias: johnDoeIdentity.alias,
        incidentId: incidentId || null,
        caseSlug: johnDoeIdentity.caseSlug || null
      }
    });

    json(res, 200, buildLoginSuccessPayload({ webId: johnDoeIdentity.webId, sessionData }));
  } catch (err) {
    json(res, 500, { ok: false, error: 'emergency override login request failed', detail: err.message });
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
    accessGrantedBy: session.matchedCredentialType
      ? `${session.matchedCredentialType} on sovereign pod`
      : 'WebID login session (credential checks run on protected actions)',
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

const handleListThirdPartyEntries = async (req, res) => {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  const walletRead = await fetchWalletCredentialsForWebId(session.webId);
  if (!walletRead.ok) {
    json(res, 500, {
      ok: false,
      issuer: siteProfile.issuerName,
      authenticatedWebId: session.webId,
      error: 'failed to read sovereign wallet credentials',
      reason: walletRead.reason
    });
    return;
  }

  const currentPortalOrigin = (() => {
    try {
      return normalizeMatchToken(new URL(`http://${req.headers.host || `localhost:${port}`}`).origin);
    } catch {
      return '';
    }
  })();

  const currentIssuerName = normalizeMatchToken(siteProfile.issuerName);
  const currentIssuerTokens = new Set();
  addMatchToken(currentIssuerTokens, issuerDid);
  addMatchToken(currentIssuerTokens, issuerWebId);
  addMatchToken(currentIssuerTokens, currentPortalOrigin);
  try {
    const mappedSolidUrl = mapToInternalSovereignOrigin(solidPodUrl);
    addMatchToken(currentIssuerTokens, new URL(mappedSolidUrl).origin);
  } catch {
    // ignore invalid pod URL when building routing tokens
  }

  const normalizedCurrentIssuerDid = normalizeMatchToken(issuerDid);
  const entries = [];
  for (const credential of walletRead.credentials) {
    const types = credentialTypes(credential);
    if (types.length === 0) continue;

    const sourceIssuerDid = credentialIssuerDid(credential);
    const normalizedSourceIssuerDid = normalizeMatchToken(sourceIssuerDid);
    if (normalizedSourceIssuerDid && normalizedSourceIssuerDid === normalizedCurrentIssuerDid) continue;

    const routing = credentialTargetsCurrentIssuer({
      credential,
      currentIssuerTokens,
      currentPortalOrigin,
      currentIssuerName
    });
    if (!routing.matched) continue;

    const subject = credential.credentialSubject && typeof credential.credentialSubject === 'object'
      ? credential.credentialSubject
      : {};
    const relationshipActionId = subject?.relationships?.actor?.actionId || null;
    const normalizedRecordType = normalizeImagingModality(subject.recordType || null);
    const suggestedFulfillmentActionId = normalizedRecordType ? actionIdForImagingModality(normalizedRecordType) : null;

    entries.push({
      credentialId: credential.id || null,
      issuedAt: credential.issuanceDate || credential.validFrom || null,
      sourceIssuerDid: sourceIssuerDid || null,
      sourceIssuerName: typeof credential.issuer === 'object'
        ? credential.issuer.name || null
        : (typeof credential.issuer === 'string' ? credential.issuer : null),
      credentialTypes: types.filter((type) => type !== 'VerifiableCredential'),
      actionId: subject.actionId || relationshipActionId,
      recordId: subject.recordId || null,
      recordType: subject.recordType || null,
      recommendedProviderDid: subject.recommendedProviderDid || null,
      recommendedProviderName: subject.recommendedProviderName || null,
      recommendedProviderPortal: subject.recommendedProviderPortal || null,
      suggestedFulfillmentActionId: suggestedFulfillmentActionId || null,
      routingMatch: routing.reason,
      credential
    });
  }

  entries.sort((a, b) => (Date.parse(b.issuedAt || '') || 0) - (Date.parse(a.issuedAt || '') || 0));

  json(res, 200, {
    ok: true,
    issuer: siteProfile.issuerName,
    authenticatedWebId: session.webId,
    subjectDid: session.subjectDid || deriveSubjectDidFromWebId(session.webId),
    totalWalletCredentials: walletRead.credentials.length,
    matchedThirdPartyEntries: entries.length,
    entries
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

const handleListAvailableInterAgencyTargetDids = async (req, res) => {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  const walletRead = await fetchWalletCredentialsForWebId(session.webId);
  if (!walletRead.ok) {
    json(res, 500, {
      ok: false,
      issuer: siteProfile.issuerName,
      authenticatedWebId: session.webId,
      error: 'failed to read sovereign wallet credentials',
      reason: walletRead.reason
    });
    return;
  }

  const subjectDid = session.subjectDid || deriveSubjectDidFromWebId(session.webId);
  const targetAgencyDids = collectAvailableInterAgencyTargetDidOptions({
    session,
    walletCredentials: walletRead.credentials
  });

  json(res, 200, {
    ok: true,
    issuer: siteProfile.issuerName,
    authenticatedWebId: session.webId,
    subjectDid,
    targetAgencyDids
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
    const constraints = normalizeInterAgencyConstraints(body);
    if (!targetAgencyDid) {
      json(res, 400, { ok: false, error: 'targetAgencyDid is required' });
      return;
    }

    const subjectDid = session.subjectDid || deriveSubjectDidFromWebId(session.webId);
    const grant = grantInterAgencyConsent({
      subjectDid,
      targetAgencyDid,
      scope,
      grantedByWebId: session.webId,
      constraints
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
    const requestConstraints = normalizeInterAgencyConstraints(body);
    if (!subjectDid) {
      json(res, 400, { ok: false, error: 'subjectDid is required' });
      return;
    }
    if (!targetAgencyDid) {
      json(res, 400, { ok: false, error: 'targetAgencyDid is required' });
      return;
    }

    const emergencyRequest = normalizeEmergencyBreakGlassRequest(body.emergencyAccess);
    const grant = findActiveInterAgencyConsent({ subjectDid, targetAgencyDid, scope });
    const grantConstraints = grant ? normalizeInterAgencyConstraints(grant.constraints || {}) : {};
    let effectiveConstraints = {};
    let emergencyAccessContext = null;

    if (grant) {
      const requestCheck = isRequestWithinGrantConstraints(grantConstraints, requestConstraints);
      if (!requestCheck.ok) {
        json(res, 403, {
          ok: false,
          error: 'requested filters exceed granted inter-agency consent scope',
          subjectDid,
          targetAgencyDid,
          scope,
          violations: requestCheck.violations
        });
        return;
      }
      effectiveConstraints = combineInterAgencyConstraints(grantConstraints, requestConstraints);
    } else if (emergencyRequest.enabled) {
      const emergencyAuthorization = await authorizeEmergencyBreakGlassRequest({
        subjectDid,
        targetAgencyDid,
        scope,
        request: emergencyRequest
      });
      if (!emergencyAuthorization.ok) {
        json(res, 403, {
          ok: false,
          error: 'emergency break-glass access denied',
          reason: emergencyAuthorization.reason,
          detail: emergencyAuthorization.detail || null,
          allowedReasonCodes: emergencyAuthorization.allowedReasonCodes || undefined,
          subjectDid,
          targetAgencyDid,
          scope
        });
        return;
      }
      emergencyAccessContext = emergencyAuthorization.emergencyAccess;
      const auditEntry = recordEmergencyBreakGlassEvent({
        ownerIssuerDid: issuerDid,
        ownerIssuerName: siteProfile.issuerName,
        subjectDid,
        targetAgencyDid,
        scope,
        reasonCode: emergencyAccessContext.reasonCode,
        incidentId: emergencyAccessContext.incidentId,
        justification: emergencyAccessContext.justification,
        requestedByStaffWebId: emergencyAccessContext.requestedByStaffWebId,
        staffCredentialId: emergencyAccessContext.staffCredentialId,
        staffCredentialIssuerDid: emergencyAccessContext.staffCredentialIssuerDid
      });
      emergencyAccessContext = {
        ...emergencyAccessContext,
        auditId: auditEntry.id
      };
      effectiveConstraints = requestConstraints;
    } else {
      json(res, 403, {
        ok: false,
        error: 'sovereign inter-agency consent required before export',
        subjectDid,
        targetAgencyDid,
        scope
      });
      return;
    }

    const recordsResult = await listIssuerPodRecordsForSubject(subjectDid);
    if (!recordsResult.ok) {
      json(res, 500, {
        ok: false,
        error: 'failed to load issuer subject records',
        reason: recordsResult.reason
      });
      return;
    }
    const filteredRecords = recordsResult.records.filter((record) => recordMatchesInterAgencyConstraints(record, effectiveConstraints));
    const exportRecords = {
      ...recordsResult,
      totalRecords: filteredRecords.length,
      records: filteredRecords,
      appliedConstraints: hasInterAgencyConstraints(effectiveConstraints) ? effectiveConstraints : null
    };

    const sealedExport = sealPayloadForSovereign(
      {
        ownerIssuerDid: issuerDid,
        issuerName: siteProfile.issuerName,
        subjectDid,
        scope,
        records: exportRecords
      },
      {
        exportedAt: new Date().toISOString(),
        targetAgencyDid,
        consentGrantId: grant ? grant.id : null,
        emergencyAccess: emergencyAccessContext
          ? {
            mode: emergencyAccessContext.mode,
            reasonCode: emergencyAccessContext.reasonCode,
            incidentId: emergencyAccessContext.incidentId,
            requestedByStaffWebId: emergencyAccessContext.requestedByStaffWebId,
            auditId: emergencyAccessContext.auditId
          }
          : null,
        appliedConstraints: hasInterAgencyConstraints(effectiveConstraints) ? effectiveConstraints : null
      }
    );

    json(res, 200, {
      ok: true,
      issuer: siteProfile.issuerName,
      ownerIssuerDid: issuerDid,
      subjectDid,
      targetAgencyDid,
      scope,
      constraints: hasInterAgencyConstraints(effectiveConstraints) ? effectiveConstraints : null,
      grantedBy: grant
        ? {
          mode: 'sovereign_interagency_consent',
          grantId: grant.id,
          grantedByWebId: grant.grantedByWebId,
          grantedAt: grant.grantedAt,
          expiresAt: grant.expiresAt,
          constraints: hasInterAgencyConstraints(grantConstraints) ? grantConstraints : null
        }
        : {
          mode: 'emergency_break_glass',
          reasonCode: emergencyAccessContext?.reasonCode || null,
          incidentId: emergencyAccessContext?.incidentId || null,
          requestedByStaffWebId: emergencyAccessContext?.requestedByStaffWebId || null,
          staffCredentialId: emergencyAccessContext?.staffCredentialId || null,
          auditId: emergencyAccessContext?.auditId || null
        },
      export: sealedExport
    });
  } catch (err) {
    json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
  }
};

const handleListSharedSourceRecords = async (req, res) => {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const sourceIssuerDid = String(body.sourceIssuerDid || body.targetAgencyDid || '').trim();
    if (!sourceIssuerDid) {
      json(res, 400, { ok: false, error: 'sourceIssuerDid is required' });
      return;
    }

    const scope = String(body.scope || 'subject_records').trim() || 'subject_records';
    const subjectDid = session.subjectDid || deriveSubjectDidFromWebId(session.webId);
    const requestedConstraints = normalizeInterAgencyConstraints(body);
    const requestedEmergencyAccess = normalizeEmergencyBreakGlassRequest(body.emergencyAccess);
    let emergencyAccess = null;
    if (requestedEmergencyAccess.enabled) {
      if (siteDir !== emergencyDepartmentSiteDir) {
        json(res, 403, {
          ok: false,
          error: 'emergency break-glass requests are only available from emergency-department portal'
        });
        return;
      }
      const staffWebId = session.staffWebId || stephenStafferWebId;
      const staffAuthorization = await verifyProviderStaffAccessWithSovereign(staffWebId, { issuerDid, siteDir });
      if (!staffAuthorization.ok) {
        json(res, 403, {
          ok: false,
          error: 'active emergency-department staff credential required for emergency break-glass requests',
          reason: staffAuthorization.reason
        });
        return;
      }
      emergencyAccess = {
        enabled: true,
        reasonCode: requestedEmergencyAccess.reasonCode,
        incidentId: requestedEmergencyAccess.incidentId,
        justification: requestedEmergencyAccess.justification,
        requestedByStaffWebId: staffWebId
      };
    }

    const exportResult = await fetchSharedSubjectRecordsFromSourceIssuer({
      sourceIssuerDid,
      subjectDid,
      targetAgencyDid: issuerDid,
      scope,
      constraints: requestedConstraints,
      emergencyAccess
    });
    if (!exportResult.ok) {
      json(res, exportResult.status || 502, {
        ok: false,
        error: exportResult.reason || 'failed to load source shared records',
        sourceIssuerDid,
        targetAgencyDid: issuerDid,
        detail: exportResult.detail || null
      });
      return;
    }

    const sealedEnvelope = exportResult.payload?.export;
    if (!sealedEnvelope || typeof sealedEnvelope !== 'object') {
      json(res, 502, {
        ok: false,
        error: 'source issuer export envelope missing',
        sourceIssuerDid,
        sourceOrigin: exportResult.sourceOrigin
      });
      return;
    }

    const decryptResult = await decryptSharedEnvelopeForWebId({
      webId: session.webId,
      envelope: sealedEnvelope
    });
    if (!decryptResult.ok) {
      json(res, decryptResult.status || 502, {
        ok: false,
        error: decryptResult.reason || 'failed to decrypt shared export envelope',
        sourceIssuerDid,
        sourceOrigin: exportResult.sourceOrigin,
        detail: decryptResult.detail || null
      });
      return;
    }

    const decryptedPayload = decryptResult.payload?.decrypted && typeof decryptResult.payload.decrypted === 'object'
      ? decryptResult.payload.decrypted
      : {};
    const exportRecords = decryptedPayload.records && typeof decryptedPayload.records === 'object'
      ? decryptedPayload.records
      : {};
    const rawRecords = Array.isArray(exportRecords.records) ? exportRecords.records : [];
    const effectiveConstraints = hasInterAgencyConstraints(requestedConstraints)
      ? requestedConstraints
      : normalizeInterAgencyConstraints(exportRecords.appliedConstraints || {});
    const records = rawRecords
      .filter((record) => recordMatchesInterAgencyConstraints(record, effectiveConstraints))
      .map((record) => ({
        id: String(record?.id || '').trim() || null,
        sourceIssuerDid,
        sourceIssuerName: String(exportResult.payload?.issuer || '').trim() || null,
        kind: String(record?.kind || '').trim() || null,
        recordType: String(record?.recordType || '').trim() || null,
        storedAt: String(record?.storedAt || '').trim() || null,
        actionId: String(record?.actionId || '').trim() || null,
        sourceContainer: String(record?.sourceContainer || '').trim() || null,
        summary: summarizeSharedRecordForIntake(record),
        record
      }));

    json(res, 200, {
      ok: true,
      issuer: siteProfile.issuerName,
      authenticatedWebId: session.webId,
      subjectDid,
      sourceIssuerDid,
      sourceOrigin: exportResult.sourceOrigin,
      scope,
      emergencyAccessUsed: emergencyAccess
        ? {
          mode: 'emergency_break_glass',
          reasonCode: emergencyAccess.reasonCode,
          incidentId: emergencyAccess.incidentId || null
        }
        : null,
      recordCount: records.length,
      records
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
    if (!recordId) {
      json(res, 400, { ok: false, error: 'recordId is required' });
      return;
    }
    if (!requesterWebId) {
      json(res, 400, { ok: false, error: 'requesterWebId is required' });
      return;
    }
    const requesterDid = deriveSubjectDidFromWebId(requesterWebId);
    if (requesterDid === session.subjectDid) {
      json(res, 400, {
        ok: false,
        error: 'self-access does not require a release consent grant; requester must be a third party'
      });
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

    const expiresAt = null;
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
      credentialSubject: {
        id: session.subjectDid,
        recordId,
        requesterWebId,
        purpose,
        consentGrantId: grant.id,
        grantedByWebId: session.webId
      }
    };
    if (expiresAt) consentCredential.expirationDate = expiresAt;
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
    if (requesterWebId) {
      const requesterDid = deriveSubjectDidFromWebId(requesterWebId);
      if (requesterDid === session.subjectDid) {
        json(res, 400, {
          ok: false,
          error: 'self-access does not require a release consent revoke; requester must be a third party'
        });
        return;
      }
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
    let payload = body.payload && typeof body.payload === 'object' ? body.payload : {};
    const actorMode = String(action.actorScope || inferActionScope(action.id)).trim();
    const staffWebId = session.staffWebId || stephenStafferWebId;
    const effectiveActorWebId = actorMode === 'issuer_staff' ? staffWebId : session.webId;
    if (actorMode === 'issuer_staff') {
      const staffAuthorization = await verifyProviderStaffAccessWithSovereign(staffWebId, { issuerDid, siteDir });
      if (!staffAuthorization.ok) {
        json(res, 403, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          staffWebId,
          action,
          error: 'staff credential required for staff actions',
          reason: staffAuthorization.reason,
          requiredCredentialType: providerStaffCredentialType
        });
        return;
      }
    }
    let issuerBusinessCheck = null;
    if (businessRegistrationRequiredSites.has(siteDir)) {
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
    const issuerBusinessSummary = issuerBusinessCheck?.summary || null;

    if (
      actionId === 'present_imaging_referral' ||
      actionId === 'issue_xray_result' ||
      actionId === 'issue_ultrasound_result'
    ) {
      const walletRead = await fetchWalletCredentialsForWebId(session.webId);
      if (!walletRead.ok) {
        json(res, 400, {
          ok: false,
          error: 'could not read sovereign wallet for radiology referral checks',
          reason: walletRead.reason
        });
        return;
      }

      const trustedReferralIssuers = trustedIssuersForType('ExternalMedicalRecordLinkCredential');
      const trustedBusinessRegistryIssuers = trustedIssuersForType('BusinessRegistrationCredential');
      const requiredRecordType = actionId === 'issue_ultrasound_result'
        ? 'ultrasound'
        : actionId === 'issue_xray_result'
          ? 'xray'
          : null;
      const requestedReferralRecordId = String(payload.referralRecordId || '').trim();
      const requestedReferralCredentialId = String(payload.referralCredentialId || payload.linkedCredentialId || '').trim();

      const matchedReferral = walletRead.credentials.find((cred) => {
        const types = credentialTypes(cred);
        if (!types.includes('ExternalMedicalRecordLinkCredential')) return false;
        if (trustedReferralIssuers.length > 0 && !trustedReferralIssuers.includes(credentialIssuerDid(cred))) return false;
        if (requestedReferralCredentialId && String(cred.id || '').trim() !== requestedReferralCredentialId) return false;
        if (requestedReferralRecordId && String(cred?.credentialSubject?.recordId || '').trim() !== requestedReferralRecordId) return false;
        const issuerBusinessRegistration = cred?.credentialSubject?.issuerBusinessRegistration;
        if (!issuerBusinessRegistration || typeof issuerBusinessRegistration !== 'object') return false;
        const registrationStatus = String(issuerBusinessRegistration.registrationStatus || '').trim().toLowerCase();
        if (registrationStatus && registrationStatus !== 'active') return false;
        const businessVerifierDid = String(issuerBusinessRegistration.verifierDid || '').trim();
        if (trustedBusinessRegistryIssuers.length > 0 && !trustedBusinessRegistryIssuers.includes(businessVerifierDid)) return false;
        if (!requiredRecordType) return true;
        const recordType = String(cred?.credentialSubject?.recordType || '').trim().toLowerCase();
        return recordType === requiredRecordType;
      });

      if (!matchedReferral) {
        json(res, 403, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: 'doctor referral required before radiology processing',
          reason: requiredRecordType
            ? `Missing ExternalMedicalRecordLinkCredential for ${requiredRecordType}`
            : 'Missing ExternalMedicalRecordLinkCredential',
          trustedReferralIssuerDids: trustedReferralIssuers,
          requestedReferralRecordId: requestedReferralRecordId || null,
          requestedReferralCredentialId: requestedReferralCredentialId || null,
          requiredIssuerBusinessRegistration: {
            status: 'active',
            trustedVerifierDids: trustedBusinessRegistryIssuers
          }
        });
        return;
      }

      const referralRecordId = String(matchedReferral?.credentialSubject?.recordId || '').trim();
      const referralRecordType = String(matchedReferral?.credentialSubject?.recordType || '').trim().toLowerCase();
      payload = {
        ...payload,
        referralRecordId: payload.referralRecordId || referralRecordId || null,
        referralRecordType: payload.referralRecordType || referralRecordType || null
      };

      if (actionId === 'present_imaging_referral') {
        json(res, 200, {
          ok: true,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          status: 'referral_presented',
          requirement: 'Doctor-issued referral proof',
          referral: {
            credentialId: matchedReferral.id || null,
            recordId: referralRecordId || null,
            recordType: referralRecordType || null,
            issuedByDid: credentialIssuerDid(matchedReferral) || null,
            fulfillmentProviderClass: String(matchedReferral?.credentialSubject?.fulfillmentProviderClass || '').trim() || null,
            fulfillmentModel: String(matchedReferral?.credentialSubject?.fulfillmentModel || '').trim() || null
          },
          nextStep: 'Provider staff can issue imaging results after service completion.'
        });
        return;
      }
    }

    if (siteDir === 'doctors-office' && (actionId === 'request_xray' || actionId === 'request_ultrasound')) {
      const modality = actionId === 'request_ultrasound' ? 'ultrasound' : 'xray';
      const requestedAt = new Date().toISOString();
      const isStaffReferral = actorMode === 'issuer_staff';
      const targetPatientWebId = session.webId;
      if (!targetPatientWebId) {
        json(res, 400, {
          ok: false,
          error: 'webId is required for referral request'
        });
        return;
      }
      const targetSubjectDid = deriveSubjectDidFromWebId(targetPatientWebId);
      const fulfillmentProviderClass = modality === 'ultrasound'
        ? 'ultrasound_processing_provider'
        : 'xray_processing_provider';
      let identityCheck = null;
      let selfPresenceCheck = null;
      let requirement = 'Doctor-issued referral from Nolichucky Family Clinic, valid with any qualified imaging provider';
      let matchedIdentityCredential = null;
      let verificationDependencies = [];

      if (!isStaffReferral) {
        identityCheck = await verifyIdentityWithSovereign(session.webId);
        if (!identityCheck.ok) {
          json(res, 403, {
            ok: false,
            error: `valid identity credential required before ${modality} request`,
            reason: identityCheck.reason
          });
          return;
        }

        selfPresenceCheck = await verifyCredentialWithSovereign(session.webId, 'SelfPresenceCredential', []);
        if (!selfPresenceCheck.ok) {
          json(res, 403, {
            ok: false,
            error: `self presence credential required before ${modality} request`,
            reason: selfPresenceCheck.reason
          });
          return;
        }

        requirement = 'DriversLicenseCredential (isOver18 + isOver21) OR PassportCredential, plus SelfPresenceCredential';
        matchedIdentityCredential = identityCheck.matchedCredentialType;
        verificationDependencies = [
          { credentialType: 'DriversLicenseCredential', policy: 'one_of', requiredFlags: ['isOver18', 'isOver21'] },
          { credentialType: 'PassportCredential', policy: 'one_of' },
          { credentialType: 'SelfPresenceCredential', policy: 'required' }
        ];
      } else {
        verificationDependencies = [
          { credentialType: providerStaffCredentialType, policy: 'required', note: 'Active staff credential required for issuer staff actions.' }
        ];
      }

      const imagingOrder =
        payload.imagingOrder && typeof payload.imagingOrder === 'object'
          ? payload.imagingOrder
          : { category: `general-${modality}-request` };
      const recordId = `${modality}-${crypto.randomUUID()}`;
      const recordPayload = {
        recordId,
        recordType: modality,
        subjectDid: targetSubjectDid,
        webId: targetPatientWebId,
        referredByWebId: effectiveActorWebId,
        referredByDid: deriveSubjectDidFromWebId(effectiveActorWebId),
        imagingOrder,
        recommendation: {
          recommendationType: `${modality}_referral`,
          fulfillmentProviderClass,
          fulfillmentModel: 'any_qualified_provider',
          note: String(payload.recommendationNote || '').trim() || null
        },
        requestedAt,
        ticket: {
          id: `${modality}-ticket-${crypto.randomUUID()}`,
          room: modality === 'ultrasound' ? 'Radiology-Room-3' : 'Radiology-Room-2',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        },
        verification: isStaffReferral
          ? { mode: 'staff_referral' }
          : {
              identity: identityCheck.verification,
              selfPresence: selfPresenceCheck.verification
            },
        issuer: {
          id: issuerDid,
          name: siteProfile.issuerName
        }
      };
      const recordDigest = hashString(JSON.stringify(recordPayload));
      const recordSignature = hashString(`${siteDir}:${modality}-record:${recordId}:${recordDigest}`);
      const baseUrl = `http://${req.headers.host || `localhost:${port}`}`;
      const { vc: recordLinkCredential, linkProofJws } = createDoctorRecordLinkCredential({
        subjectDid: targetSubjectDid,
        recordId,
        recordType: modality,
        recordDigest,
        issuedAt: requestedAt,
        baseUrl,
        relationshipMetadata: {
          actionId,
          actorMode,
          sessionWebId: effectiveActorWebId,
          verificationDependencies
        }
      });
      recordLinkCredential.credentialSubject.fulfillmentProviderClass = fulfillmentProviderClass;
      recordLinkCredential.credentialSubject.fulfillmentModel = 'any_qualified_provider';
      recordLinkCredential.credentialSubject.recommendedByWebId = effectiveActorWebId;
      if (issuerBusinessCheck?.ok) {
        attachIssuerBusinessProof(recordLinkCredential, issuerBusinessCheck);
      }

      doctorRecords.set(recordId, {
        ...recordPayload,
        recordDigest,
        recordSignature,
        linkProofJws
      });
      const doctorPodStore = await storeDoctorRecordToIssuerPod({
        recordId,
        recordType: modality,
        recordPayload,
        recordDigest,
        recordSignature,
        subjectDid: targetSubjectDid,
        webId: targetPatientWebId
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
        subjectDid: targetSubjectDid,
        webId: targetPatientWebId,
        recordType: modality
      });

      const proofStore = await storeCredentialProofToSovereign(targetPatientWebId, recordLinkCredential);
      if (!proofStore.ok) {
        json(res, 500, {
          ok: false,
          issuer: siteProfile.issuerName,
          authenticatedWebId: session.webId,
          action,
          error: `${modality} proof credential must be stored in sovereign pod`,
          reason: proofStore.reason,
          recordStoredAtDoctorPod: true,
          recordCopiedToSovereignPod: false,
          doctorRecordReference: {
            recordId,
            recordType: modality
          }
        });
        return;
      }

      json(res, 200, {
        ok: true,
        issuer: siteProfile.issuerName,
        authenticatedWebId: session.webId,
        action,
        requestType: modality,
        status: 'authorized',
        requirement,
        matchedIdentityCredential,
        subjectDid: targetSubjectDid,
        patientWebId: targetPatientWebId,
        imagingOrder,
        requestedAt,
        fulfillmentProviderClass,
        fulfillmentModel: 'any_qualified_provider',
        issuerBusinessRegistration: issuerBusinessSummary,
        recordStoredAtDoctorPod: true,
        recordCopiedToSovereignPod: true,
        doctorPodStorage: doctorPodStore,
        sovereignProofStorage: {
          walletUrl: proofStore.walletUrl,
          credentialCount: proofStore.count
        },
        doctorRecordReference: {
          recordId,
          recordType: modality,
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
      if (issuerBusinessCheck?.ok) {
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
      if (issuerBusinessCheck?.ok) {
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

    if ((siteDir === 'assistance-charity' || siteDir === 'legal-benefits-aid' || siteDir === 'fairmannor-house' || siteDir === 'safeharbor-shelter' || siteDir === 'family-services') && (actionId === 'process_food_assistance' || actionId === 'process_housing_assistance')) {
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
    if (issuerBusinessCheck?.ok) {
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

    const session = getSession(req);
    const requesterWebId = String(body.requesterWebId || '').trim();
    const isSubjectSession = Boolean(session && session.subjectDid === stored.subjectDid);
    let effectiveRequesterWebId = requesterWebId || '';
    let activeConsent = null;
    let accessMode = '';
    let accessGrantedBy = null;

    if (isSubjectSession) {
      effectiveRequesterWebId = session.webId;
      accessMode = 'self_access';
      accessGrantedBy = {
        mode: 'self-service-identity-verification',
        authenticatedWebId: session.webId,
        verifiedCredentialType: session.matchedCredentialType || null
      };
    } else {
      if (!effectiveRequesterWebId && session?.webId) {
        effectiveRequesterWebId = session.webId;
      }
      if (!effectiveRequesterWebId) {
        encryptedDatastoreStats.fetchAttempts += 1;
        encryptedDatastoreStats.fetchDenied += 1;
        encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
        json(res, 400, {
          ok: false,
          error: 'requesterWebId is required for third-party access unless the sovereign subject is authenticated'
        });
        return;
      }
      const requesterDid = deriveSubjectDidFromWebId(effectiveRequesterWebId);
      if (requesterDid === stored.subjectDid) {
        encryptedDatastoreStats.fetchAttempts += 1;
        encryptedDatastoreStats.fetchDenied += 1;
        encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
        json(res, 403, {
          ok: false,
          error: 'self-access requires authenticated subject session; third-party requester identity cannot be the subject'
        });
        return;
      }
      activeConsent = getActiveDoctorRecordConsent({
        recordId,
        requesterWebId: effectiveRequesterWebId,
        subjectDid: stored.subjectDid
      });
      if (activeConsent) {
        accessMode = 'third_party_consent';
        accessGrantedBy = {
          mode: 'third-party-consent-grant',
          consentGrantId: activeConsent.id,
          purpose: activeConsent.purpose,
          grantedByWebId: activeConsent.grantedByWebId,
          expiresAt: activeConsent.expiresAt
        };
      } else {
        const interAgencyGrant = findActiveInterAgencyConsent({
          subjectDid: stored.subjectDid,
          targetAgencyDid: requesterDid,
          scope: ['subject_records', 'doctor_record_access', 'medical_record_access']
        });
        if (!interAgencyGrant) {
          encryptedDatastoreStats.fetchAttempts += 1;
          encryptedDatastoreStats.fetchDenied += 1;
          encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
          json(res, 403, {
            ok: false,
            error: 'consent grant required from sovereign before sharing record',
            recordId,
            requesterWebId: effectiveRequesterWebId
          });
          return;
        }
        const interAgencyConstraints = normalizeInterAgencyConstraints(interAgencyGrant.constraints || {});
        const matchesInterAgencyScope = recordMatchesInterAgencyConstraints({
          kind: 'record',
          sourceContainer: 'issuer_records',
          id: recordId,
          recordType: String(stored.recordType || '').trim() || null,
          actionId: String(stored.actionId || '').trim() || null
        }, interAgencyConstraints);
        if (!matchesInterAgencyScope) {
          encryptedDatastoreStats.fetchAttempts += 1;
          encryptedDatastoreStats.fetchDenied += 1;
          encryptedDatastoreStats.lastUpdatedAt = new Date().toISOString();
          json(res, 403, {
            ok: false,
            error: 'inter-agency consent exists but does not cover this record',
            recordId,
            requesterWebId: effectiveRequesterWebId,
            constraints: hasInterAgencyConstraints(interAgencyConstraints) ? interAgencyConstraints : null
          });
          return;
        }
        accessMode = 'third_party_interagency_consent';
        accessGrantedBy = {
          mode: 'third-party-interagency-consent',
          consentGrantId: interAgencyGrant.id,
          scope: interAgencyGrant.scope,
          grantedByWebId: interAgencyGrant.grantedByWebId,
          expiresAt: interAgencyGrant.expiresAt,
          constraints: hasInterAgencyConstraints(interAgencyConstraints) ? interAgencyConstraints : null
        };
      }
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
          accessMode,
          accessPurpose: activeConsent?.purpose || (isSubjectSession ? 'subject-self-access' : null),
          consentGrantId: activeConsent?.id || null
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
      requesterWebId: effectiveRequesterWebId,
      accessGrantedBy,
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

  if (req.method === 'POST' && req.url === '/api/login-emergency-override') {
    await handleLoginEmergencyOverride(req, res);
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

  if (req.method === 'GET' && req.url === '/api/sharing/available-target-dids') {
    await handleListAvailableInterAgencyTargetDids(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/third-party-entries') {
    await handleListThirdPartyEntries(req, res);
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

  if (req.method === 'POST' && req.url === '/api/sharing/source-records') {
    await handleListSharedSourceRecords(req, res);
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
    const html = data.includes('</body>')
      ? data.replace('</body>', `${apiPanelHtml}</body>`)
      : `${data}${apiPanelHtml}`;

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    });
    res.end(html);
  });
});

server.listen(port, () => {
  console.log(`Issuer site '${siteDir}' listening on port ${port} using pod ${solidPodUrl || 'not-set'}`);
  void provisionIssuerBusinessRegistrationOnStartup();
  void provisionStephenStaffCredentialOnStartup();
});
