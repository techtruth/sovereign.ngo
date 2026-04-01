const http = require('http');
const crypto = require('crypto');

const port = Number(process.env.PORT || 5000);
const verifierProfile = process.env.VERIFIER_PROFILE || 'drivers_license';
const verifierName = process.env.VERIFIER_NAME || 'Generic Verifier';
const verifierDid = process.env.VERIFIER_DID || 'did:example:verifier:generic';
const signingSecret = process.env.SIGNING_SECRET || 'local-dev-secret';
const mockAlwaysAccept = (process.env.MOCK_ALWAYS_ACCEPT || 'true').toLowerCase() === 'true';
const sovereignInternalOrigin = process.env.SOVEREIGN_INTERNAL_ORIGIN || 'http://sovereign_gateway';
const credentialExplorerInternalOrigin = String(process.env.CREDENTIAL_EXPLORER_INTERNAL_ORIGIN || 'http://credential_explorer:3000').trim().replace(/\/+$/, '');
const demoWebId = process.env.DEMO_WEBID || 'http://holder_sovereign:3000/profile/card#me';
const demoOrigin = (() => {
  try {
    return new URL(demoWebId).origin;
  } catch {
    return 'http://localhost:8180';
  }
})();

const sessions = new Map();
const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const schemas = {
  drivers_license: {
    credentialType: 'DriversLicenseCredential',
    requiredClaims: ['name', 'dob', 'address', 'eyes', 'hairColor', 'height', 'weight'],
    schemaPath: '/schemas/drivers-license.json',
    schemaName: 'Driver License Evidence Schema',
    contextPath: '/contexts/drivers-license.jsonld',
    standards: [
      { name: 'W3C Verifiable Credentials Data Model v2.0', url: 'https://www.w3.org/TR/vc-data-model-2.0/' },
      { name: 'W3C vCard RDF Vocabulary', url: 'https://www.w3.org/TR/vcard-rdf/' },
      { name: 'JSON Schema Draft 2020-12', url: 'https://json-schema.org/draft/2020-12' }
    ]
  },
  bogus_id: {
    credentialType: 'DriversLicenseCredential',
    requiredClaims: ['name', 'dob', 'address', 'eyes', 'hairColor', 'height', 'weight'],
    schemaPath: '/schemas/bogus-id.json',
    schemaName: 'Bogus ID Evidence Schema (Untrusted Demo)',
    contextPath: '/contexts/bogus-id.jsonld',
    standards: [
      { name: 'Demo Untrusted Verifier', url: 'https://example.invalid/untrusted' },
      { name: 'W3C Verifiable Credentials Data Model v2.0', url: 'https://www.w3.org/TR/vc-data-model-2.0/' }
    ]
  },
  utility_bill: {
    credentialType: 'UtilityBillCredential',
    requiredClaims: ['name', 'address', 'lastPaidDate', 'billingPeriod', 'provider'],
    schemaPath: '/schemas/utility-bill.json',
    schemaName: 'Utility Bill Evidence Schema',
    contextPath: '/contexts/utility-bill.jsonld',
    standards: [
      { name: 'W3C Verifiable Credentials Data Model v2.0', url: 'https://www.w3.org/TR/vc-data-model-2.0/' },
      { name: 'W3C vCard RDF Vocabulary', url: 'https://www.w3.org/TR/vcard-rdf/' },
      { name: 'JSON Schema Draft 2020-12', url: 'https://json-schema.org/draft/2020-12' }
    ]
  },
  passport: {
    credentialType: 'PassportCredential',
    requiredClaims: ['name', 'dob', 'passportNumber', 'nationality', 'issuingCountry', 'expiryDate'],
    schemaPath: '/schemas/passport.json',
    schemaName: 'Passport Evidence Schema',
    contextPath: '/contexts/passport.jsonld',
    standards: [
      { name: 'W3C Verifiable Credentials Data Model v2.0', url: 'https://www.w3.org/TR/vc-data-model-2.0/' },
      { name: 'W3C vCard RDF Vocabulary', url: 'https://www.w3.org/TR/vcard-rdf/' },
      { name: 'JSON Schema Draft 2020-12', url: 'https://json-schema.org/draft/2020-12' }
    ]
  },
  itar: {
    credentialType: 'ITARComplianceCredential',
    requiredClaims: ['name', 'citizenship', 'company', 'itarStatus', 'screeningDate'],
    schemaPath: '/schemas/itar-compliance.json',
    schemaName: 'ITAR Compliance Evidence Schema',
    contextPath: '/contexts/itar-compliance.jsonld',
    standards: [
      { name: 'W3C Verifiable Credentials Data Model v2.0', url: 'https://www.w3.org/TR/vc-data-model-2.0/' },
      { name: 'W3C vCard RDF Vocabulary', url: 'https://www.w3.org/TR/vcard-rdf/' },
      { name: 'JSON Schema Draft 2020-12', url: 'https://json-schema.org/draft/2020-12' }
    ]
  },
  self_presence: {
    credentialType: 'SelfPresenceCredential',
    requiredClaims: ['name', 'presenceStatus', 'verifiedAt', 'verificationMethod'],
    schemaPath: '/schemas/self-presence.json',
    schemaName: 'Self Presence Evidence Schema',
    contextPath: '/contexts/self-presence.jsonld',
    standards: [
      { name: 'W3C Verifiable Credentials Data Model v2.0', url: 'https://www.w3.org/TR/vc-data-model-2.0/' },
      { name: 'W3C vCard RDF Vocabulary', url: 'https://www.w3.org/TR/vcard-rdf/' },
      { name: 'JSON Schema Draft 2020-12', url: 'https://json-schema.org/draft/2020-12' }
    ]
  },
  business_registry: {
    credentialType: 'BusinessRegistrationCredential',
    requiredClaims: ['businessName', 'registrationNumber', 'jurisdiction', 'registrationStatus', 'issuedDate', 'expiryDate'],
    schemaPath: '/schemas/business-registration.json',
    schemaName: 'Business Registration Evidence Schema',
    contextPath: '/contexts/business-registration.jsonld',
    standards: [
      { name: 'W3C Verifiable Credentials Data Model v2.0', url: 'https://www.w3.org/TR/vc-data-model-2.0/' },
      { name: 'JSON Schema Draft 2020-12', url: 'https://json-schema.org/draft/2020-12' }
    ]
  }
};

const buildVerifierSchemas = () => ({
  '/schemas/drivers-license.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://verifier.local${schemas.drivers_license.schemaPath}`,
    title: schemas.drivers_license.schemaName,
    type: 'object',
    additionalProperties: true,
    properties: {
      name: { type: 'string' },
      dob: { type: 'string', format: 'date' },
      address: { type: 'string' },
      eyes: { type: 'string' },
      hairColor: { type: 'string' },
      height: { type: 'string' },
      weight: { type: 'string' },
      organDonor: { type: ['boolean', 'string'] }
    },
    required: schemas.drivers_license.requiredClaims
  },
  '/schemas/utility-bill.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://verifier.local${schemas.utility_bill.schemaPath}`,
    title: schemas.utility_bill.schemaName,
    type: 'object',
    additionalProperties: true,
    properties: {
      name: { type: 'string' },
      address: { type: 'string' },
      lastPaidDate: { type: 'string', format: 'date' },
      billingPeriod: { type: 'string' },
      provider: { type: 'string' },
      accountNumber: { type: 'string' }
    },
    required: schemas.utility_bill.requiredClaims
  },
  '/schemas/bogus-id.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://verifier.local${schemas.bogus_id.schemaPath}`,
    title: schemas.bogus_id.schemaName,
    type: 'object',
    additionalProperties: true,
    properties: {
      name: { type: 'string' },
      dob: { type: 'string', format: 'date' },
      address: { type: 'string' },
      eyes: { type: 'string' },
      hairColor: { type: 'string' },
      height: { type: 'string' },
      weight: { type: 'string' },
      licenseNumber: { type: 'string' },
      state: { type: 'string' }
    },
    required: schemas.bogus_id.requiredClaims
  },
  '/schemas/passport.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://verifier.local${schemas.passport.schemaPath}`,
    title: schemas.passport.schemaName,
    type: 'object',
    additionalProperties: true,
    properties: {
      name: { type: 'string' },
      dob: { type: 'string', format: 'date' },
      passportNumber: { type: 'string' },
      nationality: { type: 'string' },
      issuingCountry: { type: 'string' },
      expiryDate: { type: 'string', format: 'date' }
    },
    required: schemas.passport.requiredClaims
  },
  '/schemas/itar-compliance.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://verifier.local${schemas.itar.schemaPath}`,
    title: schemas.itar.schemaName,
    type: 'object',
    additionalProperties: true,
    properties: {
      name: { type: 'string' },
      citizenship: { type: 'string' },
      company: { type: 'string' },
      itarStatus: { type: 'string' },
      screeningDate: { type: 'string', format: 'date' },
      clearanceLevel: { type: 'string' }
    },
    required: schemas.itar.requiredClaims
  },
  '/schemas/self-presence.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://verifier.local${schemas.self_presence.schemaPath}`,
    title: schemas.self_presence.schemaName,
    type: 'object',
    additionalProperties: true,
    properties: {
      name: { type: 'string' },
      presenceStatus: { type: 'string' },
      verifiedAt: { type: 'string', format: 'date-time' },
      verificationMethod: { type: 'string' },
      identityBasisCredentialType: { type: 'string' }
    },
    required: schemas.self_presence.requiredClaims
  },
  '/schemas/business-registration.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://verifier.local${schemas.business_registry.schemaPath}`,
    title: schemas.business_registry.schemaName,
    type: 'object',
    additionalProperties: true,
    properties: {
      businessName: { type: 'string' },
      registrationNumber: { type: 'string' },
      jurisdiction: { type: 'string' },
      registrationStatus: { type: 'string' },
      issuedDate: { type: 'string', format: 'date' },
      expiryDate: { type: 'string', format: 'date' },
      businessType: { type: 'string' }
    },
    required: schemas.business_registry.requiredClaims
  }
});

const buildVerifierContexts = () => ({
  '/contexts/drivers-license.jsonld': {
    '@context': {
      '@version': 1.1,
      id: '@id',
      type: '@type',
      vcard: 'http://www.w3.org/2006/vcard/ns#',
      schema: 'https://schema.org/',
      identity: 'https://sovereign.ngo/ns/identity#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      name: 'vcard:fn',
      birthDate: { '@id': 'vcard:bday', '@type': 'xsd:date' },
      address: 'vcard:hasAddress',
      eyes: 'schema:eyeColor',
      hairColor: 'schema:hairColor',
      height: 'schema:height',
      weight: 'schema:weight',
      licenseNumber: 'schema:identifier',
      state: 'schema:addressRegion',
      stateIdType: 'identity:stateIdType',
      stateIdFlags: 'identity:stateIdFlags',
      isOver18: 'identity:isOver18',
      isOver21: 'identity:isOver21',
      organDonor: 'identity:organDonor'
    }
  },
  '/contexts/utility-bill.jsonld': {
    '@context': {
      '@version': 1.1,
      id: '@id',
      type: '@type',
      vcard: 'http://www.w3.org/2006/vcard/ns#',
      schema: 'https://schema.org/',
      identity: 'https://sovereign.ngo/ns/identity#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      name: 'vcard:fn',
      address: 'vcard:hasAddress',
      lastPaidDate: { '@id': 'schema:paymentDueDate', '@type': 'xsd:date' },
      billingPeriod: 'schema:billingPeriod',
      provider: 'schema:provider',
      accountNumber: 'schema:accountId'
    }
  },
  '/contexts/bogus-id.jsonld': {
    '@context': {
      '@version': 1.1,
      id: '@id',
      type: '@type',
      vcard: 'http://www.w3.org/2006/vcard/ns#',
      schema: 'https://schema.org/',
      identity: 'https://sovereign.ngo/ns/identity#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      name: 'vcard:fn',
      birthDate: { '@id': 'vcard:bday', '@type': 'xsd:date' },
      address: 'vcard:hasAddress',
      eyes: 'schema:eyeColor',
      hairColor: 'schema:hairColor',
      height: 'schema:height',
      weight: 'schema:weight',
      licenseNumber: 'schema:identifier',
      state: 'schema:addressRegion',
      stateIdType: 'identity:stateIdType',
      stateIdFlags: 'identity:stateIdFlags',
      isOver18: 'identity:isOver18',
      isOver21: 'identity:isOver21',
      organDonor: 'identity:organDonor'
    }
  },
  '/contexts/passport.jsonld': {
    '@context': {
      '@version': 1.1,
      id: '@id',
      type: '@type',
      vcard: 'http://www.w3.org/2006/vcard/ns#',
      schema: 'https://schema.org/',
      identity: 'https://sovereign.ngo/ns/identity#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      name: 'vcard:fn',
      birthDate: { '@id': 'vcard:bday', '@type': 'xsd:date' },
      passportNumber: 'schema:identifier',
      nationality: 'schema:nationality',
      issuingCountry: 'schema:countryOfOrigin',
      expiryDate: { '@id': 'identity:expiryDate', '@type': 'xsd:date' }
    }
  },
  '/contexts/itar-compliance.jsonld': {
    '@context': {
      '@version': 1.1,
      id: '@id',
      type: '@type',
      vcard: 'http://www.w3.org/2006/vcard/ns#',
      schema: 'https://schema.org/',
      identity: 'https://sovereign.ngo/ns/identity#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      name: 'vcard:fn',
      citizenship: 'schema:nationality',
      company: 'vcard:organization-name',
      itarStatus: 'identity:itarStatus',
      screeningDate: { '@id': 'identity:screeningDate', '@type': 'xsd:date' },
      clearanceLevel: 'identity:clearanceLevel'
    }
  },
  '/contexts/self-presence.jsonld': {
    '@context': {
      '@version': 1.1,
      id: '@id',
      type: '@type',
      vcard: 'http://www.w3.org/2006/vcard/ns#',
      identity: 'https://sovereign.ngo/ns/identity#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      name: 'vcard:fn',
      presenceStatus: 'identity:presenceStatus',
      verifiedAt: { '@id': 'identity:verifiedAt', '@type': 'xsd:dateTime' },
      verificationMethod: 'identity:verificationMethod',
      identityBasisCredentialType: 'identity:identityBasisCredentialType'
    }
  },
  '/contexts/business-registration.jsonld': {
    '@context': {
      '@version': 1.1,
      id: '@id',
      type: '@type',
      schema: 'https://schema.org/',
      identity: 'https://sovereign.ngo/ns/identity#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      businessName: 'schema:legalName',
      registrationNumber: 'schema:identifier',
      jurisdiction: 'identity:jurisdiction',
      registrationStatus: 'identity:registrationStatus',
      issuedDate: { '@id': 'identity:issuedDate', '@type': 'xsd:date' },
      expiryDate: { '@id': 'identity:expiryDate', '@type': 'xsd:date' },
      businessType: 'schema:additionalType'
    }
  }
});

const mockClaimsByProfile = {
  drivers_license: {
    name: 'Alex Sovereign',
    dob: '1990-01-15',
    address: '100 Buffalo St, Northeast Tennessee 37604, USA',
    eyes: 'Brown',
    hairColor: 'Black',
    height: '5ft 11in',
    weight: '180 lb',
    licenseNumber: 'DL-000-123-456',
    stateIdType: 'drivers_license',
    state: 'TN',
    organDonor: true
  },
  bogus_id: {
    name: 'Pat Fakeperson',
    dob: '1990-01-15',
    address: '999 Fake Street, Faketown, USA',
    eyes: 'Green',
    hairColor: 'Purple',
    height: '6ft 0in',
    weight: '170 lb',
    licenseNumber: 'FAKE-000-000',
    stateIdType: 'drivers_license',
    state: 'ZZ',
    organDonor: false
  },
  utility_bill: {
    name: 'Alex Sovereign',
    address: '100 Buffalo St, Northeast Tennessee 37604, USA',
    lastPaidDate: '2026-02-28',
    billingPeriod: '2026-02',
    provider: 'Mock Utility Electric Co.',
    accountNumber: 'UTIL-998877'
  },
  passport: {
    name: 'Alex Sovereign',
    dob: '1990-01-15',
    passportNumber: 'XK1200099',
    nationality: 'US',
    issuingCountry: 'US',
    expiryDate: '2032-08-30'
  },
  itar: {
    name: 'Alex Sovereign',
    citizenship: 'US',
    company: 'Sovereign Aerospace Systems',
    itarStatus: 'Cleared',
    screeningDate: '2026-03-01',
    clearanceLevel: 'Technical Data Access'
  },
  self_presence: {
    name: 'Alex Sovereign',
    presenceStatus: 'present',
    verifiedAt: new Date().toISOString(),
    verificationMethod: 'live-selfie-upload'
  },
  business_registry: {
    businessName: 'State of Franklin Auto Repair',
    registrationNumber: 'JC-BIZ-AR-2026-0012',
    jurisdiction: 'Northeast Tennessee',
    registrationStatus: 'active',
    issuedDate: '2026-01-01',
    expiryDate: '2027-01-01',
    businessType: '621111'
  }
};

const naicsBusinessTypeLabels = Object.freeze({
  '621111': 'Offices of Physicians (except Mental Health Specialists)',
  '621512': 'Diagnostic Imaging Centers',
  '622110': 'General Medical and Surgical Hospitals'
});

const formatNaicsBusinessType = (code) => {
  const normalized = String(code || '').trim();
  if (!normalized) return '';
  const label = naicsBusinessTypeLabels[normalized];
  return label ? `${normalized} (${label})` : normalized;
};

const submitRouteByProfile = {
  drivers_license: '/submit/drivers-license',
  bogus_id: '/submit/bogus-id',
  utility_bill: '/submit/utility-bill',
  passport: '/submit/passport',
  self_presence: '/submit/self-presence',
  itar: '/submit/itar',
  business_registry: '/submit/business-registration'
};

const documentStandardsByProfile = {
  drivers_license: {
    authority: 'AAMVA',
    regulationId: 'AAMVA-DLID-Card-Design-Standard',
    version: '2020',
    uri: 'https://www.aamva.org/',
    subjectType: 'drivers_license'
  },
  bogus_id: {
    authority: 'UNTRUSTED-DEMO',
    regulationId: 'NONE-UNTRUSTED',
    version: '0',
    uri: 'https://example.invalid/untrusted',
    subjectType: 'drivers_license'
  },
  passport: {
    authority: 'ICAO',
    regulationId: 'ICAO-Doc-9303',
    version: '8',
    uri: 'https://www.icao.int/publications/doc-series/pages/doc-9303.aspx',
    subjectType: 'passport'
  },
  utility_bill: {
    authority: 'CIQ-Address',
    regulationId: 'OASIS-xAL',
    version: '3.0',
    uri: 'https://www.oasis-open.org/committees/ciq/',
    subjectType: 'utility_bill'
  },
  itar: {
    authority: 'US-DDTC',
    regulationId: '22-CFR-120-130',
    version: 'current',
    uri: 'https://www.ecfr.gov/current/title-22/chapter-I/subchapter-M',
    subjectType: 'itar_compliance'
  },
  self_presence: {
    authority: 'NIST',
    regulationId: 'SP-800-63A',
    version: '3',
    uri: 'https://pages.nist.gov/800-63-3/sp800-63a.html',
    subjectType: 'self_presence'
  },
  business_registry: {
    authority: 'TENNESSEE-SOS',
    regulationId: 'TN-Business-Registry',
    version: 'current',
    uri: 'https://tnbear.tn.gov/',
    subjectType: 'business_registration'
  }
};

const activeSchema = schemas[verifierProfile] || schemas.drivers_license;
const activeSubmitRoute = submitRouteByProfile[verifierProfile] || '/verify';
const activeDocumentStandard = documentStandardsByProfile[verifierProfile] || documentStandardsByProfile.drivers_license;

const standardsProfileByVerifier = {
  drivers_license: [
    { standard: 'W3C VC Data Model v2.0', uri: 'https://www.w3.org/TR/vc-data-model-2.0/' },
    { standard: 'AAMVA DL/ID Card Design Standard', uri: 'https://www.aamva.org/' },
    { standard: 'JSON Schema Draft 2020-12', uri: 'https://json-schema.org/draft/2020-12' }
  ],
  bogus_id: [
    { standard: 'W3C VC Data Model v2.0', uri: 'https://www.w3.org/TR/vc-data-model-2.0/' },
    { standard: 'UNTRUSTED-DEMO', uri: 'https://example.invalid/untrusted' }
  ],
  utility_bill: [
    { standard: 'W3C VC Data Model v2.0', uri: 'https://www.w3.org/TR/vc-data-model-2.0/' },
    { standard: 'OASIS CIQ xAL', uri: 'https://www.oasis-open.org/committees/ciq/' },
    { standard: 'JSON Schema Draft 2020-12', uri: 'https://json-schema.org/draft/2020-12' }
  ],
  passport: [
    { standard: 'W3C VC Data Model v2.0', uri: 'https://www.w3.org/TR/vc-data-model-2.0/' },
    { standard: 'ICAO Doc 9303', uri: 'https://www.icao.int/publications/doc-series/pages/doc-9303.aspx' },
    { standard: 'JSON Schema Draft 2020-12', uri: 'https://json-schema.org/draft/2020-12' }
  ],
  itar: [
    { standard: 'W3C VC Data Model v2.0', uri: 'https://www.w3.org/TR/vc-data-model-2.0/' },
    { standard: '22 CFR 120-130', uri: 'https://www.ecfr.gov/current/title-22/chapter-I/subchapter-M' },
    { standard: 'JSON Schema Draft 2020-12', uri: 'https://json-schema.org/draft/2020-12' }
  ],
  self_presence: [
    { standard: 'W3C VC Data Model v2.0', uri: 'https://www.w3.org/TR/vc-data-model-2.0/' },
    { standard: 'NIST SP 800-63A', uri: 'https://pages.nist.gov/800-63-3/sp800-63a.html' },
    { standard: 'JSON Schema Draft 2020-12', uri: 'https://json-schema.org/draft/2020-12' }
  ],
  business_registry: [
    { standard: 'W3C VC Data Model v2.0', uri: 'https://www.w3.org/TR/vc-data-model-2.0/' },
    { standard: 'Tennessee Business Registry', uri: 'https://tnbear.tn.gov/' },
    { standard: 'JSON Schema Draft 2020-12', uri: 'https://json-schema.org/draft/2020-12' }
  ]
};

const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...baseHeaders });
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const getAuthToken = (req) => {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return '';
};

const getSession = (req) => {
  const token = getAuthToken(req);
  if (!token) return null;
  return sessions.get(token) || null;
};

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const yearsBetween = (fromDate, toDate) => {
  const from = new Date(fromDate);
  if (Number.isNaN(from.getTime())) return null;

  let age = toDate.getUTCFullYear() - from.getUTCFullYear();
  const monthDiff = toDate.getUTCMonth() - from.getUTCMonth();
  const dayDiff = toDate.getUTCDate() - from.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return age;
};

const buildStateIdFlags = (claims) => {
  const now = new Date();
  const age = yearsBetween(claims.dob, now);
  const normalizedDonor =
    claims.organDonor === true ||
    String(claims.organDonor || '').toLowerCase() === 'yes' ||
    String(claims.organDonor || '').toLowerCase() === 'true';

  return {
    isOver18: age !== null ? age >= 18 : true,
    isOver21: age !== null ? age >= 21 : true,
    organDonor: normalizedDonor
  };
};

const signPayload = (payload) =>
  crypto
    .createHmac('sha256', signingSecret)
    .update(JSON.stringify(payload))
    .digest('base64url');

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

const sanitizeIdPart = (value) => String(value || '').trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();

const buildStandardDocumentId = (profile, claims, issuanceDate) => {
  if (profile === 'drivers_license') {
    return `urn:aamva:dlid:${sanitizeIdPart(claims.state || 'na')}:${sanitizeIdPart(claims.licenseNumber || crypto.randomUUID())}`;
  }
  if (profile === 'bogus_id') {
    return `urn:bogus:id:${sanitizeIdPart(claims.state || 'zz')}:${sanitizeIdPart(claims.licenseNumber || crypto.randomUUID())}`;
  }
  if (profile === 'passport') {
    return `urn:icao:doc9303:passport:${sanitizeIdPart(claims.issuingCountry || 'na')}:${sanitizeIdPart(claims.passportNumber || crypto.randomUUID())}`;
  }
  if (profile === 'utility_bill') {
    return `urn:oasis:xal:utility:${sanitizeIdPart(claims.provider || 'provider')}:${sanitizeIdPart(claims.accountNumber || crypto.randomUUID())}:${sanitizeIdPart(claims.billingPeriod || issuanceDate.slice(0, 10))}`;
  }
  if (profile === 'itar') {
    return `urn:us:itar:22cfr120-130:${sanitizeIdPart(claims.company || 'company')}:${sanitizeIdPart(claims.screeningDate || issuanceDate.slice(0, 10))}`;
  }
  if (profile === 'self_presence') {
    return `urn:nist:sp800-63a:self-presence:${sanitizeIdPart(issuanceDate.slice(0, 10))}:${sanitizeIdPart(crypto.randomUUID())}`;
  }
  if (profile === 'business_registry') {
    return `urn:tn:bizreg:${sanitizeIdPart(claims.jurisdiction || 'tn')}:${sanitizeIdPart(claims.registrationNumber || crypto.randomUUID())}`;
  }
  return `urn:doc:${sanitizeIdPart(crypto.randomUUID())}`;
};

const buildCredential = ({ subjectDid, claims, evidenceSummary }) => {
  const issuanceDate = new Date().toISOString();
  const schemaUrl = `http://localhost:${port}${activeSchema.schemaPath}`;
  const contextUrl = `http://localhost:${port}${activeSchema.contextPath}`;
  const documentId = buildStandardDocumentId(verifierProfile, claims, issuanceDate);
  const standardsProfile = standardsProfileByVerifier[verifierProfile] || standardsProfileByVerifier.drivers_license;

  const vc = {
    '@context': ['https://www.w3.org/ns/credentials/v2', contextUrl],
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: ['VerifiableCredential', activeSchema.credentialType],
    issuer: { id: verifierDid, name: verifierName },
    issuanceDate,
    validFrom: issuanceDate,
    credentialSchema: {
      id: schemaUrl,
      type: 'JsonSchema',
      standardReference: {
        authority: activeDocumentStandard.authority,
        regulationId: activeDocumentStandard.regulationId,
        version: activeDocumentStandard.version,
        uri: activeDocumentStandard.uri
      }
    },
    credentialSubject: {
      id: subjectDid || 'did:example:subject:unknown',
      documentId,
      documentType: activeDocumentStandard.subjectType,
      documentStandard: {
        authority: activeDocumentStandard.authority,
        regulationId: activeDocumentStandard.regulationId,
        version: activeDocumentStandard.version
      },
      standardsProfile,
      ...claims
    },
    evidence: {
      type: 'DocumentSubmission',
      verifierProfile,
      documentId,
      standard: {
        authority: activeDocumentStandard.authority,
        regulationId: activeDocumentStandard.regulationId,
        version: activeDocumentStandard.version,
        uri: activeDocumentStandard.uri
      },
      receivedAt: issuanceDate,
      summary: evidenceSummary,
      standardsProfile
    }
  };

  vc.proof = {
    type: 'HmacSignature2026',
    created: issuanceDate,
    proofPurpose: 'assertionMethod',
    verificationMethod: `${verifierDid}#hmac-key-1`,
    jws: signPayload(vc)
  };

  return vc;
};

const mapToInternalSovereignOrigin = (url) => {
  const source = new URL(url);
  if (source.hostname === 'localhost' || source.hostname === '127.0.0.1') {
    const mapped = new URL(sovereignInternalOrigin);
    return `${mapped.origin}${source.pathname}${source.search}${source.hash}`;
  }
  return source.toString();
};

const sanitizeFilePart = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

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

const resolveWalletFromWebId = async (webId) => {
  if (!webId) return { ok: false, reason: 'webId not provided' };

  try {
    const webIdUrl = new URL(mapToInternalSovereignOrigin(webId));
    const docUrl = webId.split('#')[0];
    const credentialsContainer = `${webIdUrl.origin}/credentials/`;
    return { ok: true, credentialsContainer, source: 'derived-from-webid', webIdDoc: docUrl };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const storeCredentialToSovereignWallet = async (webId, credential) => {
  if (!webId) return { ok: false, skipped: true, reason: 'webId not provided' };

  const resolution = await resolveWalletFromWebId(webId);
  if (!resolution.ok) {
    return { ok: false, skipped: true, reason: `wallet discovery failed: ${resolution.reason}` };
  }

  const containerUrl = resolution.credentialsContainer;
  const types = credentialTypes(credential).filter((t) => t !== 'VerifiableCredential');
  const typePart = sanitizeFilePart(types[0] || verifierProfile || 'credential');
  const resourceUrl = `${containerUrl}vc-${typePart}-${crypto.randomUUID()}.json`;
  const resolutionMeta = { method: resolution.source, webIdDoc: resolution.webIdDoc };

  try {
    const writeResponse = await fetch(resourceUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credential, null, 2)
    });

    if (!writeResponse.ok) {
      const payload = await writeResponse.text().catch(() => '');
      return {
        ok: false,
        skipped: false,
        reason: `credential write failed (${writeResponse.status})`,
        walletUrl: resourceUrl,
        resolution: resolutionMeta,
        detail: payload
      };
    }

    return { ok: true, skipped: false, walletUrl: resourceUrl, resolution: resolutionMeta, detail: { count: 1 } };
  } catch (err) {
    return { ok: false, skipped: false, reason: err.message, walletUrl: resourceUrl, resolution: resolutionMeta };
  }
};

const fetchSovereignCredentials = async (webId) => {
  const resolution = await resolveWalletFromWebId(webId);
  if (!resolution.ok) {
    return { ok: false, reason: `wallet discovery failed: ${resolution.reason}` };
  }

  try {
    const listed = await listCredentialResourceUrls(resolution.credentialsContainer);
    if (!listed.ok) {
      return { ok: false, reason: listed.reason, detail: listed.detail };
    }

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
    return { ok: true, credentials };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const credentialTypes = (credential) => {
  const value = credential?.type;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) return [value];
  return [];
};

const checkSelfPresencePrerequisite = async (webId) => {
  const walletRead = await fetchSovereignCredentials(webId);
  if (!walletRead.ok) {
    return {
      ok: false,
      reason: walletRead.reason,
      requiredAnyOf: ['DriversLicenseCredential', 'PassportCredential']
    };
  }

  const matched = walletRead.credentials.find((cred) => {
    const types = credentialTypes(cred);
    return types.includes('DriversLicenseCredential') || types.includes('PassportCredential');
  });

  if (!matched) {
    return {
      ok: false,
      reason: 'Missing identity credential in sovereign pod',
      requiredAnyOf: ['DriversLicenseCredential', 'PassportCredential'],
      walletCredentialCount: walletRead.credentials.length
    };
  }

  const matchedCredentialType = credentialTypes(matched).find(
    (t) => t === 'DriversLicenseCredential' || t === 'PassportCredential'
  );

  return {
    ok: true,
    matchedCredentialType,
    walletCredentialCount: walletRead.credentials.length
  };
};

const issueCredentialFromBody = async (body, session) => {
  let claims = mockAlwaysAccept ? { ...mockClaimsByProfile[verifierProfile] } : body.claims || {};
  const missingClaims = activeSchema.requiredClaims.filter((field) => isBlank(claims[field]));
  if (!mockAlwaysAccept && missingClaims.length > 0) {
    return {
      ok: false,
      status: 400,
      payload: { ok: false, error: 'Missing required claims', verifierProfile, missingClaims }
    };
  }

  let selfPresenceGate = null;
  if (verifierProfile === 'self_presence') {
    selfPresenceGate = await checkSelfPresencePrerequisite(session.webId);
    if (!selfPresenceGate.ok) {
      return {
        ok: false,
        status: 403,
        payload: {
          ok: false,
          verifierProfile,
          error: 'Self-presence verification requires Drivers License OR Passport credential in sovereign pod',
          gate: selfPresenceGate
        }
      };
    }

    claims = {
      ...claims,
      verifiedAt: claims.verifiedAt || new Date().toISOString(),
      identityBasisCredentialType: selfPresenceGate.matchedCredentialType
    };
  }

  const evidenceSummary = {
    imageProvided: Boolean(body.imageBase64 || body.imageUrl || body.image || body.file),
    imageUrl: body.imageUrl || null,
    submittedAt: new Date().toISOString(),
    mockAlwaysAccept
  };

  const credential = buildCredential({
    subjectDid: session.subjectDid,
    claims,
    evidenceSummary
  });

  const stateIdFlags = verifierProfile === 'drivers_license' || verifierProfile === 'bogus_id' ? buildStateIdFlags(claims) : undefined;
  if (stateIdFlags) credential.credentialSubject.stateIdFlags = stateIdFlags;

  const consentToStore = body.consentToStore === true;
  const walletStore = consentToStore
    ? await storeCredentialToSovereignWallet(session.webId, credential)
    : { ok: true, skipped: true, reason: 'permission not granted to write to sovereign pod' };

  return {
    ok: true,
    status: 200,
    payload: {
      ok: true,
      verifierProfile,
      verifierDid,
      authenticatedWebId: session.webId,
      subjectDid: session.subjectDid,
      extractedData: claims,
      stateIdFlags,
      selfPresenceGate,
      consentToStore,
      credential,
      walletStore
    }
  };
};

const fetchSovereignSubjectIdentities = async () => {
  if (!credentialExplorerInternalOrigin) {
    return { ok: false, reason: 'credential explorer internal origin is not configured' };
  }

  const normalizeOptions = (options) => {
    const list = Array.isArray(options) ? options : [];
    const deduped = [];
    const seen = new Set();
    for (const entry of list) {
      const webId = String(entry && entry.webId || '').trim();
      if (!webId || seen.has(webId)) continue;
      const label = String(entry && entry.label || '').trim() || webId;
      deduped.push({ label, webId });
      seen.add(webId);
    }
    return deduped;
  };

  try {
    const response = await fetch(`${credentialExplorerInternalOrigin}/api/subject-identities`);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reason: payload && payload.error ? payload.error : `subject identity request failed (${response.status})`
      };
    }
    const options = normalizeOptions(payload && payload.subjectIdentityOptions);
    const defaultWebId = String(payload && payload.defaultDemoIdentityWebId || '').trim();
    return {
      ok: true,
      source: 'subject-identities',
      defaultWebId: defaultWebId || (options[0] && options[0].webId) || '',
      options
    };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

const renderHomePage = () => {
  const businessRegistryTypeCode = verifierProfile === 'business_registry'
    ? String(mockClaimsByProfile.business_registry?.businessType || '').trim()
    : '';
  const businessRegistryTypeDisplay = verifierProfile === 'business_registry'
    ? formatNaicsBusinessType(businessRegistryTypeCode)
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${verifierName}</title>
  <style>
    :root { --bg:#f8fafc; --panel:#ffffff; --line:#e2e8f0; --text:#1f2937; --muted:#64748b; --primary:#0f766e; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Arial, sans-serif; background: linear-gradient(180deg, #eef5f6, var(--bg)); color: var(--text); }
    .wrap { max-width: 900px; margin: 0 auto; padding: 12px; }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px; margin-bottom: 10px; }
    h1, h2 { margin-top: 0; }
    p { color: var(--muted); }
    label { display: block; margin: 8px 0 4px; font-weight: 700; }
    input, select, button { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font: inherit; }
    button { background: var(--primary); color: #fff; border: 0; font-weight: 700; cursor: pointer; margin-top: 10px; }
    pre { background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 10px; min-height: 180px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-all; }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="panel">
      <h1>${verifierName}</h1>
      <p><strong>Profile:</strong> ${verifierProfile} | <strong>Submit route:</strong> ${activeSubmitRoute}</p>
      <p>Login with WebID, upload a document, and verify.</p>
      <p>Credential write to sovereign pod happens only with explicit permission.</p>
      ${
        verifierProfile === 'self_presence'
          ? '<p><strong>Requirement:</strong> Drivers License VC or Passport VC must already exist in personal identity and record storage.</p>'
          : ''
      }
      ${
        verifierProfile === 'business_registry' && businessRegistryTypeCode
          ? `<p><strong>Business Type (NAICS):</strong> ${escapeHtml(businessRegistryTypeDisplay)}</p>
             <p>Stored credential value is code-only: <code>${escapeHtml(businessRegistryTypeCode)}</code></p>`
          : ''
      }
    </section>

    <section class="panel">
      <h2>WebID Login</h2>
      <label for="identityPreset">Sovereign Identity</label>
      <select id="identityPreset">
        <option value="">Loading sovereign identities...</option>
      </select>
      <button id="loginBtn">Login With WebID</button>
      <p id="loginStatus">Not logged in.</p>
    </section>

    <section class="panel">
      <h2>${verifierProfile === 'self_presence' ? 'Verify Presence' : 'Verify Document'}</h2>
      <label style="display:flex;align-items:center;gap:8px;font-weight:600;margin-top:8px;">
        <input id="consentToStore" type="checkbox" style="width:auto;">
        Allow verifier to add issued credential to sovereign pod
      </label>

      ${
        verifierProfile === 'self_presence'
          ? '<button id="mockCaptureBtn" type="button">Mock Capture Live Video</button>'
          : '<label for="docFile">Document / Image</label><input id="docFile" type="file" accept="image/*,.pdf">'
      }

      <button id="submitBtn">Verify Submission</button>
      <p id="status"></p>
    </section>

    <section class="panel">
      <h2>Response</h2>
      <pre id="output">{}</pre>
    </section>
  </div>

  <script>
    const endpoint = '${activeSubmitRoute}';
    const isSelfPresence = ${verifierProfile === 'self_presence' ? 'true' : 'false'};
    let token = '';
    let mockLiveVideoBase64 = '';
    const identityPresetByWebId = new Map();
    let identityOptionsLoaded = false;

    const toBase64 = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const loginStatusEl = document.getElementById('loginStatus');
    const statusEl = document.getElementById('status');
    const outputEl = document.getElementById('output');
    const mockCaptureBtn = document.getElementById('mockCaptureBtn');
    const identityPresetEl = document.getElementById('identityPreset');
    const loginBtn = document.getElementById('loginBtn');

    const selectedSovereignWebId = () => String(identityPresetEl && identityPresetEl.value || '').trim();

    const renderSovereignIdentityOptions = (identities, preferredWebId) => {
      if (!identityPresetEl) return;
      const list = Array.isArray(identities) ? identities : [];
      identityPresetByWebId.clear();
      identityPresetEl.innerHTML = '';
      const seen = new Set();
      for (const entry of list) {
        const webId = String(entry && entry.webId || '').trim();
        if (!webId || seen.has(webId)) continue;
        const label = String(entry && entry.label || '').trim() || webId;
        seen.add(webId);
        identityPresetByWebId.set(webId, { label, webId });
        const option = document.createElement('option');
        option.value = webId;
        option.textContent = label;
        identityPresetEl.appendChild(option);
      }
      if (identityPresetEl.options.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No sovereign identities available';
        identityPresetEl.appendChild(option);
        identityPresetEl.value = '';
      } else {
        const requestedWebId = String(preferredWebId || '').trim();
        const fallbackWebId = String(identityPresetEl.options[0].value || '').trim();
        identityPresetEl.value = identityPresetByWebId.has(requestedWebId) ? requestedWebId : fallbackWebId;
      }
      if (loginBtn) {
        const canLogin = identityOptionsLoaded && Boolean(selectedSovereignWebId());
        loginBtn.disabled = !canLogin;
      }
    };

    const loadSovereignIdentityOptions = async () => {
      identityOptionsLoaded = false;
      try {
        const res = await fetch('/api/sovereign-identities');
        const data = await res.json();
        if (!res.ok) {
          renderSovereignIdentityOptions([], '');
          loginStatusEl.textContent = 'Unable to load sovereign identities.';
          outputEl.textContent = JSON.stringify(data, null, 2);
          return;
        }
        identityOptionsLoaded = true;
        renderSovereignIdentityOptions(Array.isArray(data.identities) ? data.identities : [], data.defaultWebId || '');
        if (!token) {
          loginStatusEl.textContent = 'Select a sovereign identity.';
        }
      } catch (err) {
        renderSovereignIdentityOptions([], '');
        loginStatusEl.textContent = 'Unable to load sovereign identities.';
        outputEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
      }
    };

    if (isSelfPresence && mockCaptureBtn) {
      mockCaptureBtn.addEventListener('click', () => {
        mockLiveVideoBase64 = btoa('mock-live-video-capture-' + new Date().toISOString());
        statusEl.textContent = 'Mock live video captured.';
      });
    }
    if (identityPresetEl) {
      identityPresetEl.addEventListener('change', () => {
        if (!token) loginStatusEl.textContent = 'Select a sovereign identity.';
        if (loginBtn) loginBtn.disabled = !(identityOptionsLoaded && Boolean(selectedSovereignWebId()));
      });
    }
    if (loginBtn) loginBtn.disabled = true;
    loadSovereignIdentityOptions();

    document.getElementById('loginBtn').addEventListener('click', async () => {
      loginStatusEl.textContent = 'Logging in...';
      try {
        const webId = selectedSovereignWebId();
        if (!webId) {
          loginStatusEl.textContent = 'Select a sovereign identity first.';
          return;
        }
        const res = await fetch('/api/login-webid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webId })
        });
        const data = await res.json();
        outputEl.textContent = JSON.stringify(data, null, 2);
        if (!res.ok) {
          loginStatusEl.textContent = 'Login failed.';
          token = '';
          return;
        }
        token = data.token;
        loginStatusEl.textContent = 'Logged in as ' + data.webId;
      } catch (err) {
        loginStatusEl.textContent = 'Login error.';
        outputEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
      }
    });

    document.getElementById('submitBtn').addEventListener('click', async () => {
      if (!token) {
        statusEl.textContent = 'Login with WebID first.';
        return;
      }

      statusEl.textContent = 'Submitting...';
      outputEl.textContent = '{}';

      const consentToStore = document.getElementById('consentToStore').checked;
      const fileInput = document.getElementById('docFile');
      const file = fileInput && fileInput.files ? fileInput.files[0] : null;

      try {
        let imageBase64 = null;
        if (isSelfPresence && mockLiveVideoBase64) {
          imageBase64 = mockLiveVideoBase64;
        } else if (file) {
          imageBase64 = await toBase64(file);
        }

        if (isSelfPresence && !imageBase64) {
          statusEl.textContent = 'Click "Mock Capture Live Video" first.';
          return;
        }

        const payload = {
          consentToStore,
          imageBase64,
          captureMode: isSelfPresence && mockLiveVideoBase64 ? 'mock-live-video' : 'file-upload'
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        outputEl.textContent = JSON.stringify(data, null, 2);
        if (!res.ok) {
          statusEl.textContent = 'Submission failed.';
        } else if (data.walletStore && data.walletStore.skipped) {
          statusEl.textContent = 'Verified. VC issued without writing to sovereign pod.';
        } else {
          statusEl.textContent = 'Verified. VC issued and written to sovereign pod.';
        }
      } catch (err) {
        outputEl.textContent = JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2);
        statusEl.textContent = 'Request error.';
      }
    });
  </script>
</body>
</html>`;
};

const server = http.createServer(async (req, res) => {
  const verifierSchemas = buildVerifierSchemas();
  const verifierContexts = buildVerifierContexts();

  if (req.method === 'OPTIONS') {
    res.writeHead(204, baseHeaders);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderHomePage());
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, { ok: true, verifierProfile, verifierName, verifierDid });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/sovereign-identities') {
    const result = await fetchSovereignSubjectIdentities();
    if (!result.ok) {
      json(res, 502, {
        ok: false,
        error: 'failed to load sovereign identities',
        reason: result.reason || 'unknown'
      });
      return;
    }
    json(res, 200, {
      ok: true,
      source: result.source,
      defaultWebId: result.defaultWebId || '',
      identities: result.options
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/schema') {
    json(res, 200, {
      verifierProfile,
      verifierName,
      mockAlwaysAccept,
      documentStandard: activeDocumentStandard,
      standards: activeSchema.standards,
      credentialType: activeSchema.credentialType,
      requiredClaims: activeSchema.requiredClaims,
      context: `http://localhost:${port}${activeSchema.contextPath}`,
      credentialSchema: {
        id: `http://localhost:${port}${activeSchema.schemaPath}`,
        type: 'JsonSchema'
      },
      submitRoute: activeSubmitRoute
    });
    return;
  }

  if (req.method === 'GET' && verifierSchemas[req.url]) {
    json(res, 200, verifierSchemas[req.url]);
    return;
  }

  if (req.method === 'GET' && verifierContexts[req.url]) {
    json(res, 200, verifierContexts[req.url]);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/login-webid') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const webId = String(body.webId || '').trim();
      if (!webId) {
        json(res, 400, { ok: false, error: 'webId is required' });
        return;
      }

      const resolution = await resolveWalletFromWebId(webId);
      if (!resolution.ok) {
        json(res, 400, { ok: false, error: `invalid webid for login: ${resolution.reason}` });
        return;
      }

      const subjectDid = deriveSubjectDidFromWebId(webId);
      const token = crypto.randomUUID();
      sessions.set(token, { webId, subjectDid, createdAt: new Date().toISOString() });

      json(res, 200, {
        ok: true,
        token,
        webId,
        subjectDid,
        walletResolution: { method: resolution.source, webIdDoc: resolution.webIdDoc }
      });
      return;
    } catch (err) {
      json(res, 400, { ok: false, error: 'invalid login payload', detail: err.message });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/session') {
    const session = getSession(req);
    if (!session) {
      json(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }

    json(res, 200, { ok: true, session });
    return;
  }

  if (req.method === 'POST' && (req.url === '/verify' || req.url === activeSubmitRoute)) {
    const session = getSession(req);
    if (!session) {
      json(res, 401, { ok: false, error: 'webid login required before submission' });
      return;
    }

    try {
      const rawBody = await readBody(req);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const result = await issueCredentialFromBody(body, session);
      json(res, result.status, result.payload);
      return;
    } catch (err) {
      json(res, 400, {
        ok: false,
        error: 'Invalid JSON body or payload format',
        detail: err.message
      });
      return;
    }
  }

  json(res, 404, { ok: false, error: 'Not found' });
});

server.listen(port, () => {
  console.log(`Verifier API '${verifierProfile}' listening on ${port}`);
});
