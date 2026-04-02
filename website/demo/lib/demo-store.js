(function () {
  const STORAGE_KEY = 'sovereign_demo_state_v2';
  const EVENT_KEY = 'sovereign_demo_event_v2';
  const VERSION = 2;
  const CHANNEL_NAME = 'sovereign_demo_channel_v2';

  const providerCatalog = [
    {
      id: 'nolichucky_family_clinic',
      did: 'did:web:demo.sovereign.ngo:provider:nolichucky_family_clinic',
      label: 'Nolichucky Family Clinic',
      type: 'primary-care',
      capabilities: ['primary-care', 'medical-records', 'referral-source']
    },
    {
      id: 'riverstone_radiology_center',
      did: 'did:web:demo.sovereign.ngo:provider:riverstone_radiology_center',
      label: 'Riverstone Radiology Center',
      type: 'imaging-services',
      capabilities: ['imaging', 'xray', 'ultrasound', 'referral-fulfillment']
    },
    {
      id: 'summitview_emergency_department',
      did: 'did:web:demo.sovereign.ngo:provider:summitview_emergency_department',
      label: 'Summitview Emergency Department',
      type: 'acute-emergency-care',
      capabilities: ['emergency-care', 'medical-records']
    },
    {
      id: 'fairmannor_house',
      did: 'did:web:demo.sovereign.ngo:provider:fairmannor_house',
      label: 'FairMannor House',
      type: 'homelessness-prevention',
      capabilities: ['prevention-intake', 'housing-coordination']
    },
    {
      id: 'safeharbor_shelter',
      did: 'did:web:demo.sovereign.ngo:provider:safeharbor_shelter',
      label: 'SafeHarbor Shelter',
      type: 'emergency-shelter',
      capabilities: ['shelter-access', 'housing-coordination']
    },
    {
      id: 'bridgeway_family_services',
      did: 'did:web:demo.sovereign.ngo:provider:bridgeway_family_services',
      label: 'Bridgeway Family Services',
      type: 'family-stabilization',
      capabilities: ['family-support', 'stabilization']
    },
    {
      id: 'salutation_army',
      did: 'did:web:demo.sovereign.ngo:provider:salutation_army',
      label: 'Salutation Army',
      type: 'community-assistance',
      capabilities: ['community-assistance', 'outreach']
    },
    {
      id: 'pioneer_legal_benefits_navigation',
      did: 'did:web:demo.sovereign.ngo:provider:pioneer_legal_benefits_navigation',
      label: 'Pioneer Legal and Benefits Navigation',
      type: 'legal-and-benefits-navigation',
      capabilities: ['benefits-navigation', 'legal-aid']
    },
    {
      id: 'transport_services',
      did: 'did:web:demo.sovereign.ngo:provider:transport_services',
      label: 'Transport Services',
      type: 'service-transport',
      capabilities: ['transport-coordination']
    }
  ];

  const identitySeed = [
    {
      webId: 'did:web:demo.sovereign.ngo:person:a4f9k2p1',
      displayName: 'Alex Sovereign',
      isStaff: false
    },
    {
      webId: 'did:web:demo.sovereign.ngo:person:b7m3q8t4',
      displayName: 'Betty Medina',
      isStaff: false
    },
    {
      webId: 'did:web:demo.sovereign.ngo:person:c2r6v1n9',
      displayName: 'Charlie Krier',
      isStaff: false
    },
    {
      webId: 'did:web:demo.sovereign.ngo:person:d9h5w3s7',
      displayName: 'Debra Harbor',
      isStaff: false
    },
    {
      webId: 'did:web:demo.sovereign.ngo:person:e1x8j4l6',
      displayName: 'Ed Erins',
      isStaff: false
    },
    {
      webId: 'did:web:demo.sovereign.ngo:person:s5t7p2h9',
      displayName: 'Stephen Staffer',
      isStaff: true
    }
  ];

  const staffWebId = identitySeed.find((entry) => entry.isStaff).webId;

  const consentScopes = [
    'all_records',
    'imaging_records',
    'emergency_records',
    'housing_records',
    'benefits_records'
  ];

  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

  const nowIso = () => new Date().toISOString();

  const deepClone = (value) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  };

  const uid = (prefix) => {
    const rand = Math.random().toString(36).slice(2, 10);
    const stamp = Date.now().toString(36);
    return `${prefix}_${rand}${stamp.slice(-4)}`;
  };

  const providerById = (providerId) => providerCatalog.find((entry) => entry.id === providerId) || null;

  const providerDidFromId = (providerId) => {
    const entry = providerById(providerId);
    return entry ? entry.did : '';
  };

  const credentialSubjectName = (webId) => {
    const found = identitySeed.find((entry) => entry.webId === webId);
    return found ? found.displayName : webId;
  };

  const buildSeedState = () => {
    const ts = nowIso();
    const identities = identitySeed.map((entry) => ({
      webId: entry.webId,
      displayName: entry.displayName,
      isStaff: Boolean(entry.isStaff),
      createdAt: ts,
      status: 'active'
    }));

    const credentials = providerCatalog.map((provider) => ({
      id: uid('cred'),
      type: 'StaffAccessCredential',
      issuerProviderId: provider.id,
      issuerProviderDid: provider.did,
      subjectWebId: staffWebId,
      subjectName: credentialSubjectName(staffWebId),
      grantedRole: 'issuer_staff',
      createdAt: ts,
      status: 'active',
      metadata: {
        providerLabel: provider.label,
        providerType: provider.type,
        startupProvisioned: true
      }
    }));

    return {
      version: VERSION,
      meta: {
        createdAt: ts,
        updatedAt: ts,
        lastResetAt: ts
      },
      providers: providerCatalog.map((entry) => ({ ...entry })),
      identities,
      credentials,
      records: [],
      consents: [],
      referrals: [],
      events: []
    };
  };

  const parseState = (raw) => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.version !== VERSION) return null;
      if (!Array.isArray(parsed.identities) || !Array.isArray(parsed.providers)) return null;
      if (!Array.isArray(parsed.credentials) || !Array.isArray(parsed.records)) return null;
      if (!Array.isArray(parsed.consents) || !Array.isArray(parsed.referrals)) return null;
      if (!Array.isArray(parsed.events)) parsed.events = [];
      return parsed;
    } catch {
      return null;
    }
  };

  const emitChange = (reason) => {
    const payload = {
      type: 'state-updated',
      reason: String(reason || 'update'),
      at: nowIso()
    };

    if (channel) {
      try {
        channel.postMessage(payload);
      } catch {
        // no-op
      }
    }

    try {
      localStorage.setItem(EVENT_KEY, JSON.stringify(payload));
      localStorage.removeItem(EVENT_KEY);
    } catch {
      // no-op
    }
  };

  const saveState = (state, reason) => {
    state.meta = state.meta || {};
    state.meta.updatedAt = nowIso();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Sovereign demo state write failed:', error);
      throw error;
    }
    emitChange(reason || 'update');
    return state;
  };

  const ensureState = () => {
    const existing = parseState(localStorage.getItem(STORAGE_KEY));
    if (existing) {
      return existing;
    }
    const seeded = buildSeedState();
    saveState(seeded, 'seed');
    return seeded;
  };

  const withState = (mutator, reason) => {
    const state = ensureState();
    const result = mutator(state) || {};
    saveState(state, reason || 'update');
    return {
      state: deepClone(state),
      ...result
    };
  };

  const addEvent = ({
    type,
    providerId,
    subjectWebId,
    actorWebId,
    message,
    payload,
    severity
  }) => withState((state) => {
    const entry = {
      id: uid('evt'),
      type: type || 'event',
      providerId: providerId || '',
      providerDid: providerDidFromId(providerId),
      subjectWebId: subjectWebId || '',
      actorWebId: actorWebId || '',
      message: String(message || '').trim(),
      payload: payload ? deepClone(payload) : {},
      severity: severity || 'info',
      createdAt: nowIso()
    };
    state.events.unshift(entry);
    if (state.events.length > 800) {
      state.events.length = 800;
    }
    return { event: deepClone(entry) };
  }, 'event-added').event;

  const upsertIdentity = (webId, displayName, isStaff) => withState((state) => {
    const existing = state.identities.find((entry) => entry.webId === webId);
    if (existing) {
      existing.displayName = displayName;
      existing.isStaff = Boolean(isStaff);
      existing.status = 'active';
      return { identity: deepClone(existing), created: false };
    }
    const identity = {
      webId,
      displayName,
      isStaff: Boolean(isStaff),
      status: 'active',
      createdAt: nowIso()
    };
    state.identities.push(identity);
    return { identity: deepClone(identity), created: true };
  }, 'identity-upsert');

  const createJohnDoe = (attributes) => {
    const state = ensureState();
    const count = state.identities.filter((entry) => /^John Doe/.test(entry.displayName || '')).length + 1;
    const suffix = Math.random().toString(36).slice(2, 10);
    const webId = `did:web:demo.sovereign.ngo:person:${suffix}`;
    const displayName = `John Doe ${count}`;
    const foundNotes = attributes && attributes.foundNotes ? String(attributes.foundNotes) : '';
    const output = upsertIdentity(webId, displayName, false);

    if (foundNotes) {
      addEvent({
        type: 'identity-created',
        subjectWebId: webId,
        actorWebId: staffWebId,
        message: `Emergency override created ${displayName}.`,
        payload: { foundNotes },
        severity: 'warning'
      });
    }

    return output.identity;
  };

  const listIdentities = (options) => {
    const opts = options || {};
    const state = ensureState();
    let rows = state.identities.filter((entry) => entry.status !== 'inactive');
    if (opts.excludeStaff) {
      rows = rows.filter((entry) => !entry.isStaff);
    }
    if (opts.staffOnly) {
      rows = rows.filter((entry) => entry.isStaff);
    }
    rows = rows.slice().sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
    return deepClone(rows);
  };

  const issueCredential = ({ subjectWebId, type, issuerProviderId, metadata }) => withState((state) => {
    const identity = state.identities.find((entry) => entry.webId === subjectWebId);
    const cred = {
      id: uid('cred'),
      type: type || 'ServiceCredential',
      issuerProviderId: issuerProviderId || 'sovereign_ngo',
      issuerProviderDid: providerDidFromId(issuerProviderId),
      subjectWebId,
      subjectName: identity ? identity.displayName : subjectWebId,
      createdAt: nowIso(),
      status: 'active',
      metadata: metadata ? deepClone(metadata) : {}
    };
    state.credentials.push(cred);
    return { credential: deepClone(cred) };
  }, 'credential-issued').credential;

  const listCredentials = (subjectWebId) => {
    const state = ensureState();
    const rows = state.credentials
      .filter((entry) => !subjectWebId || entry.subjectWebId === subjectWebId)
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return deepClone(rows);
  };

  const addRecord = ({ subjectWebId, providerId, category, summary, details, actorWebId }) => withState((state) => {
    const provider = providerById(providerId);
    const record = {
      id: uid('rec'),
      subjectWebId,
      providerId,
      providerDid: providerDidFromId(providerId),
      providerLabel: provider ? provider.label : providerId,
      category: category || 'general',
      summary: String(summary || '').trim() || 'Service action recorded.',
      details: details ? deepClone(details) : {},
      actorWebId: actorWebId || '',
      createdAt: nowIso()
    };
    state.records.push(record);
    return { record: deepClone(record) };
  }, 'record-added').record;

  const listRecords = (subjectWebId, options) => {
    const opts = options || {};
    const state = ensureState();
    let rows = state.records.filter((entry) => !subjectWebId || entry.subjectWebId === subjectWebId);
    if (opts.providerId) {
      rows = rows.filter((entry) => entry.providerId === opts.providerId);
    }
    rows = rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return deepClone(rows);
  };

  const listProvidersWithRecordsForSubject = (subjectWebId) => {
    if (!subjectWebId) return [];
    const state = ensureState();
    const providerIds = Array.from(new Set(
      state.records
        .filter((entry) => entry.subjectWebId === subjectWebId)
        .map((entry) => entry.providerId)
        .filter(Boolean)
    ));
    const rows = providerIds
      .map((providerId) => providerById(providerId))
      .filter(Boolean)
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return deepClone(rows);
  };

  const grantConsent = ({ subjectWebId, providerId, scope, grantedByWebId }) => withState((state) => {
    const normalizedScope = consentScopes.includes(scope) ? scope : 'all_records';

    for (const consent of state.consents) {
      if (
        consent.subjectWebId === subjectWebId &&
        consent.providerId === providerId &&
        consent.scope === normalizedScope &&
        consent.status === 'active'
      ) {
        consent.status = 'revoked';
        consent.revokedAt = nowIso();
        consent.revokedByWebId = grantedByWebId || subjectWebId;
      }
    }

    const entry = {
      id: uid('con'),
      subjectWebId,
      providerId,
      providerDid: providerDidFromId(providerId),
      scope: normalizedScope,
      status: 'active',
      grantedAt: nowIso(),
      grantedByWebId: grantedByWebId || subjectWebId,
      revokedAt: '',
      revokedByWebId: ''
    };
    state.consents.push(entry);
    return { consent: deepClone(entry) };
  }, 'consent-granted').consent;

  const revokeConsent = ({ subjectWebId, providerId, scope, revokedByWebId }) => withState((state) => {
    let revokedCount = 0;
    const when = nowIso();
    for (const consent of state.consents) {
      const scopeMatch = !scope || consent.scope === scope;
      if (
        consent.subjectWebId === subjectWebId &&
        consent.providerId === providerId &&
        scopeMatch &&
        consent.status === 'active'
      ) {
        consent.status = 'revoked';
        consent.revokedAt = when;
        consent.revokedByWebId = revokedByWebId || subjectWebId;
        revokedCount += 1;
      }
    }
    return { revokedCount };
  }, 'consent-revoked').revokedCount;

  const listConsents = (subjectWebId, options) => {
    const opts = options || {};
    const state = ensureState();
    let rows = state.consents.filter((entry) => !subjectWebId || entry.subjectWebId === subjectWebId);
    if (!opts.includeRevoked) {
      rows = rows.filter((entry) => entry.status === 'active');
    }
    rows = rows.slice().sort((a, b) => {
      const aDate = a.grantedAt || a.revokedAt || '';
      const bDate = b.grantedAt || b.revokedAt || '';
      return String(bDate).localeCompare(String(aDate));
    });
    return deepClone(rows);
  };

  const addReferral = ({ subjectWebId, fromProviderId, targetCapability, summary, details, actorWebId }) => withState((state) => {
    const referral = {
      id: uid('ref'),
      subjectWebId,
      fromProviderId,
      fromProviderDid: providerDidFromId(fromProviderId),
      targetCapability: targetCapability || 'general-referral',
      summary: String(summary || '').trim() || 'Referral issued.',
      details: details ? deepClone(details) : {},
      status: 'open',
      issuedByWebId: actorWebId || '',
      issuedAt: nowIso(),
      fulfilledByProviderId: '',
      fulfilledByProviderDid: '',
      fulfilledAt: ''
    };
    state.referrals.push(referral);
    return { referral: deepClone(referral) };
  }, 'referral-added').referral;

  const providerCanFulfillReferral = (providerId, referral) => {
    if (!providerId || !referral) return false;
    const provider = providerById(providerId);
    if (!provider) return false;
    if (referral.status !== 'open') return false;
    const capability = String(referral.targetCapability || '').trim();
    if (!capability || capability === 'any') return true;
    return provider.capabilities.includes(capability);
  };

  const listReferrals = (options) => {
    const opts = options || {};
    const state = ensureState();
    let rows = state.referrals.slice();

    if (opts.subjectWebId) {
      rows = rows.filter((entry) => entry.subjectWebId === opts.subjectWebId);
    }

    if (opts.providerId) {
      rows = rows.filter((entry) => providerCanFulfillReferral(opts.providerId, entry) || entry.fulfilledByProviderId === opts.providerId);
    }

    if (!opts.includeClosed) {
      rows = rows.filter((entry) => entry.status === 'open');
    }

    rows.sort((a, b) => {
      const aDate = a.issuedAt || '';
      const bDate = b.issuedAt || '';
      return String(bDate).localeCompare(String(aDate));
    });

    return deepClone(rows);
  };

  const fulfillReferral = ({ referralId, providerId, actorWebId }) => withState((state) => {
    const referral = state.referrals.find((entry) => entry.id === referralId);
    if (!referral) {
      return { referral: null, error: 'Referral not found.' };
    }
    if (!providerCanFulfillReferral(providerId, referral)) {
      return { referral: null, error: 'Selected provider cannot fulfill this referral.' };
    }

    referral.status = 'fulfilled';
    referral.fulfilledByProviderId = providerId;
    referral.fulfilledByProviderDid = providerDidFromId(providerId);
    referral.fulfilledAt = nowIso();
    referral.fulfilledByWebId = actorWebId || '';
    return { referral: deepClone(referral), error: '' };
  }, 'referral-fulfilled');

  const listEvents = (options) => {
    const opts = options || {};
    const state = ensureState();
    let rows = state.events.slice();
    if (opts.subjectWebId) {
      rows = rows.filter((entry) => entry.subjectWebId === opts.subjectWebId);
    }
    if (opts.providerId) {
      rows = rows.filter((entry) => entry.providerId === opts.providerId);
    }
    if (opts.limit && Number.isFinite(opts.limit)) {
      rows = rows.slice(0, Math.max(1, Number(opts.limit)));
    }
    return deepClone(rows);
  };

  const subscribe = (listener) => {
    if (typeof listener !== 'function') {
      return function noop() {};
    }

    const onStorage = (event) => {
      if (event.key !== EVENT_KEY || !event.newValue) return;
      try {
        listener(JSON.parse(event.newValue));
      } catch {
        listener({ type: 'state-updated', reason: 'storage-event-parse-failed' });
      }
    };

    const onChannel = (event) => {
      listener(event && event.data ? event.data : { type: 'state-updated', reason: 'broadcast' });
    };

    window.addEventListener('storage', onStorage);
    if (channel) {
      channel.addEventListener('message', onChannel);
    }

    return function unsubscribe() {
      window.removeEventListener('storage', onStorage);
      if (channel) {
        channel.removeEventListener('message', onChannel);
      }
    };
  };

  const resetDemoData = () => {
    const seeded = buildSeedState();
    saveState(seeded, 'demo-reset');
    return deepClone(seeded);
  };

  const getState = () => deepClone(ensureState());

  const api = {
    version: VERSION,
    storageKey: STORAGE_KEY,
    staffWebId,
    consentScopes: deepClone(consentScopes),
    getState,
    resetDemoData,
    subscribe,
    addEvent,
    listEvents,
    listProviders: () => deepClone(providerCatalog),
    providerById: (providerId) => deepClone(providerById(providerId)),
    providerDidFromId,
    listIdentities,
    createJohnDoe,
    listCredentials,
    issueCredential,
    listRecords,
    addRecord,
    listProvidersWithRecordsForSubject,
    listConsents,
    grantConsent,
    revokeConsent,
    addReferral,
    listReferrals,
    fulfillReferral
  };

  window.SovereignDemoStore = api;
  ensureState();
})();
