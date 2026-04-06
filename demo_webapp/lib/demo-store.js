(function () {
  const STORAGE_KEY = 'sovereign_demo_state_v2';
  const EVENT_KEY = 'sovereign_demo_event_v2';
  const VERSION = 2;
  const CHANNEL_NAME = 'sovereign_demo_channel_v2';

  const sharedProviderCatalog = typeof globalThis !== 'undefined' ? globalThis.SovereignProviderCatalog : null;
  if (!Array.isArray(sharedProviderCatalog)) {
    throw new Error('Provider catalog failed to load.');
  }

  const providerCatalog = sharedProviderCatalog.map((entry) => ({
    ...entry,
    taxonomies: entry && entry.taxonomies && typeof entry.taxonomies === 'object'
      ? { ...entry.taxonomies }
      : undefined,
    capabilities: Array.isArray(entry && entry.capabilities) ? entry.capabilities.slice() : []
  }));

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
      recordAccessPasses: [],
      providerPodAccessLinks: [],
      events: []
    };
  };

  const parseState = (raw) => {
    if (!raw) return null;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.version !== VERSION) return null;
      if (!Array.isArray(parsed.identities) || !Array.isArray(parsed.providers)) return null;
      if (!Array.isArray(parsed.credentials) || !Array.isArray(parsed.records)) return null;
      if (!Array.isArray(parsed.consents) || !Array.isArray(parsed.referrals)) return null;
      if (!Array.isArray(parsed.recordAccessPasses)) parsed.recordAccessPasses = [];
      if (!Array.isArray(parsed.providerPodAccessLinks)) parsed.providerPodAccessLinks = [];
      if (!Array.isArray(parsed.events)) parsed.events = [];
      return parsed;
    } catch {
      return null;
    }
  };

  const createInlineLocalStorageBackend = () => {
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

    const readState = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    const writeState = (state) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    };

    const notify = (payload) => {
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

    return {
      mode: 'local',
      readState,
      writeState,
      notify,
      subscribe
    };
  };

  const resolveBackend = () => {
    const configRoot = typeof globalThis !== 'undefined' ? globalThis.SovereignDemoStoreConfig : null;
    const backendConfig = configRoot && typeof configRoot.backend === 'object' ? configRoot.backend : {};

    if (backendConfig && backendConfig.instance && typeof backendConfig.instance === 'object') {
      return backendConfig.instance;
    }

    const backendMode = String(backendConfig.mode || 'local').trim().toLowerCase();
    const backendFactories = typeof globalThis !== 'undefined' ? globalThis.SovereignDemoStoreBackends : null;

    if (backendMode === 'solid-pod') {
      if (!backendFactories || typeof backendFactories.createSolidPodBackend !== 'function') {
        throw new Error('Solid pod backend requested, but SovereignDemoStoreBackends is unavailable.');
      }
      return backendFactories.createSolidPodBackend({
        storageKey: STORAGE_KEY,
        eventKey: EVENT_KEY,
        channelName: CHANNEL_NAME,
        podBaseUrl: backendConfig.podBaseUrl,
        resourcePath: backendConfig.resourcePath,
        bearerToken: backendConfig.bearerToken,
        fetchInit: backendConfig.fetchInit
      });
    }

    if (backendFactories && typeof backendFactories.createLocalStorageBackend === 'function') {
      return backendFactories.createLocalStorageBackend({
        storageKey: STORAGE_KEY,
        eventKey: EVENT_KEY,
        channelName: CHANNEL_NAME
      });
    }

    return createInlineLocalStorageBackend();
  };

  const backend = resolveBackend();

  const emitChange = (reason) => {
    const payload = {
      type: 'state-updated',
      reason: String(reason || 'update'),
      at: nowIso()
    };
    if (backend && typeof backend.notify === 'function') {
      backend.notify(payload);
    }
  };

  const saveState = (state, reason) => {
    state.meta = state.meta || {};
    state.meta.updatedAt = nowIso();
    try {
      if (!backend || typeof backend.writeState !== 'function') {
        throw new Error('Demo store backend is missing writeState.');
      }
      backend.writeState(state);
    } catch (error) {
      console.error('Sovereign demo state write failed:', error);
      throw error;
    }
    emitChange(reason || 'update');
    return state;
  };

  const ensureState = () => {
    const existingRaw = backend && typeof backend.readState === 'function' ? backend.readState() : null;
    const existing = parseState(existingRaw);
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
    rows = rows.map((entry) => {
      const provider = providerById(entry.providerId);
      if (!provider) return entry;
      return {
        ...entry,
        providerLabel: provider.label
      };
    });
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

  const listRecordAccessPasses = (subjectWebId, options) => {
    const opts = options || {};
    const state = ensureState();
    let rows = state.recordAccessPasses.slice();

    if (subjectWebId) {
      rows = rows.filter((entry) => entry.subjectWebId === subjectWebId);
    }

    if (opts.sourceProviderId) {
      rows = rows.filter((entry) => entry.sourceProviderId === opts.sourceProviderId);
    }

    if (opts.providerId) {
      rows = rows.filter((entry) => !entry.sharedWithProviderId || entry.sharedWithProviderId === opts.providerId);
    }

    if (!opts.includeInactive) {
      rows = rows.filter((entry) => entry.status === 'active');
    }

    if (!opts.includeExpired) {
      const now = Date.now();
      rows = rows.filter((entry) => {
        if (!entry.expiresAt) return true;
        const expiresAtMs = Date.parse(entry.expiresAt);
        if (!Number.isFinite(expiresAtMs)) return true;
        return expiresAtMs > now;
      });
    }

    rows = rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return deepClone(rows);
  };

  const issueRecordAccessPass = ({
    subjectWebId,
    sourceProviderId,
    sourceRecordId,
    sharedWithProviderId,
    consentMode,
    actorWebId
  }) => withState((state) => {
    if (!subjectWebId || !sourceProviderId || !sourceRecordId) {
      return { accessPass: null, credential: null, error: 'Missing required fields for record access pass issuance.' };
    }

    const identity = state.identities.find((entry) => entry.webId === subjectWebId);
    if (!identity || identity.status === 'inactive') {
      return { accessPass: null, credential: null, error: 'Subject identity is not available.' };
    }

    const record = state.records.find((entry) => (
      entry.id === sourceRecordId &&
      entry.subjectWebId === subjectWebId &&
      entry.providerId === sourceProviderId
    ));
    if (!record) {
      return { accessPass: null, credential: null, error: 'Source record was not found for this subject and provider.' };
    }

    const normalizedConsentMode = String(consentMode || '').trim() === 'long_term' ? 'long_term' : 'one_time';
    const now = nowIso();
    const expiresAt = normalizedConsentMode === 'one_time'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : '';
    const normalizedSharedWithProviderId = String(sharedWithProviderId || '').trim();

    const accessPass = {
      id: uid('rap'),
      subjectWebId,
      sourceProviderId,
      sourceProviderDid: providerDidFromId(sourceProviderId),
      sourceRecordId,
      sourceRecordCategory: record.category || '',
      sourceRecordSummary: record.summary || '',
      sharedWithProviderId: normalizedSharedWithProviderId,
      sharedWithProviderDid: providerDidFromId(normalizedSharedWithProviderId),
      consentMode: normalizedConsentMode,
      accessHandle: uid('hdl'),
      accessEndpoint: `/provider-api/${encodeURIComponent(sourceProviderId)}/api/records/access`,
      createdAt: now,
      expiresAt,
      status: 'active',
      issuedByWebId: actorWebId || '',
      metadata: {
        sourceProviderLabel: record.providerLabel || sourceProviderId
      }
    };
    state.recordAccessPasses.push(accessPass);

    const credential = {
      id: uid('cred'),
      type: 'RecordAccessPassCredential',
      issuerProviderId: sourceProviderId,
      issuerProviderDid: providerDidFromId(sourceProviderId),
      subjectWebId,
      subjectName: identity.displayName || subjectWebId,
      createdAt: now,
      status: 'active',
      metadata: {
        accessPassId: accessPass.id,
        sourceRecordId,
        sourceProviderId,
        sharedWithProviderId: normalizedSharedWithProviderId,
        consentMode: normalizedConsentMode,
        expiresAt
      }
    };
    state.credentials.push(credential);

    return { accessPass: deepClone(accessPass), credential: deepClone(credential), error: '' };
  }, 'record-access-pass-issued');

  const saveRecordAccessPassToProviderPod = ({
    accessPassId,
    providerId,
    subjectWebId,
    savedByWebId
  }) => withState((state) => {
    if (!accessPassId || !providerId || !subjectWebId) {
      return { savedLink: null, error: 'Missing required fields to save record access pass.' };
    }

    const accessPass = state.recordAccessPasses.find((entry) => entry.id === accessPassId);
    if (!accessPass) {
      return { savedLink: null, error: 'Record access pass not found.' };
    }
    if (accessPass.subjectWebId !== subjectWebId) {
      return { savedLink: null, error: 'Record access pass does not belong to the logged-in subject.' };
    }
    if (accessPass.status !== 'active') {
      return { savedLink: null, error: 'Record access pass is not active.' };
    }
    if (accessPass.sharedWithProviderId && accessPass.sharedWithProviderId !== providerId) {
      return { savedLink: null, error: 'This record access pass is scoped to a different provider.' };
    }
    if (accessPass.consentMode !== 'long_term') {
      return { savedLink: null, error: 'Only long-term record access passes can be saved for future provider access.' };
    }
    if (accessPass.expiresAt) {
      const expiresAtMs = Date.parse(accessPass.expiresAt);
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
        return { savedLink: null, error: 'Record access pass has expired.' };
      }
    }

    const existing = state.providerPodAccessLinks.find((entry) => (
      entry.accessPassId === accessPass.id &&
      entry.providerId === providerId &&
      entry.subjectWebId === subjectWebId &&
      entry.status === 'active'
    ));
    if (existing) {
      return { savedLink: deepClone(existing), error: '' };
    }

    const savedLink = {
      id: uid('podlink'),
      accessPassId: accessPass.id,
      providerId,
      providerDid: providerDidFromId(providerId),
      subjectWebId,
      sourceProviderId: accessPass.sourceProviderId,
      sourceProviderDid: accessPass.sourceProviderDid,
      sourceRecordId: accessPass.sourceRecordId,
      accessHandle: accessPass.accessHandle,
      accessEndpoint: accessPass.accessEndpoint,
      consentMode: accessPass.consentMode,
      savedAt: nowIso(),
      savedByWebId: savedByWebId || '',
      status: 'active'
    };
    state.providerPodAccessLinks.push(savedLink);
    return { savedLink: deepClone(savedLink), error: '' };
  }, 'provider-pod-access-link-saved');

  const listProviderPodAccessLinks = (providerId, options) => {
    const opts = options || {};
    const state = ensureState();
    let rows = state.providerPodAccessLinks.slice();

    if (providerId) {
      rows = rows.filter((entry) => entry.providerId === providerId);
    }
    if (opts.subjectWebId) {
      rows = rows.filter((entry) => entry.subjectWebId === opts.subjectWebId);
    }
    if (!opts.includeInactive) {
      rows = rows.filter((entry) => entry.status === 'active');
    }

    rows = rows.slice().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
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
    if (!backend || typeof backend.subscribe !== 'function') {
      return function noop() {};
    }
    return backend.subscribe(listener);
  };

  const initializeBackend = () => {
    if (!backend || typeof backend.initialize !== 'function') return;
    backend.initialize({
      parseState,
      onHydrated: () => {
        // state was refreshed from remote source; notify active views
        emitChange('backend-hydrated');
      },
      onError: (error) => {
        console.error('Sovereign demo backend init failed:', error);
      }
    });
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
    storageMode: backend && backend.mode ? backend.mode : 'unknown',
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
    fulfillReferral,
    issueRecordAccessPass,
    listRecordAccessPasses,
    saveRecordAccessPassToProviderPod,
    listProviderPodAccessLinks
  };

  window.SovereignDemoStore = api;
  ensureState();
  initializeBackend();
})();
