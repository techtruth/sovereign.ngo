(function () {
  const STORAGE_KEY = 'sovereign_demo_state';
  const EVENT_KEY = 'sovereign_demo_event';
  const CHANNEL_NAME = 'sovereign_demo_channel';

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
      displayName: 'Staphen Staffer',
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

  const VC_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
  const VC_STATUS_LIST_CONTEXT = 'https://w3id.org/vc/status-list/2021/v1';
  const STATUS_LIST_ENTRY_TYPE = 'StatusList2021Entry';
  const STATUS_LIST_PURPOSE = 'revocation';
  const DEMO_HOST = 'demo.sovereign.ngo';
  const STATUS_LIST_BASE_URL = `https://${DEMO_HOST}/vc/status-lists`;

  const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  const asTrimmed = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };

  const resolveParentTargetOrigin = () => {
    if (typeof window === 'undefined') return '*';
    const referrer = asTrimmed(typeof document !== 'undefined' ? document.referrer : '');
    if (!referrer) return '*';
    try {
      const parsed = new URL(referrer, window.location.href);
      const protocol = asTrimmed(parsed.protocol).toLowerCase();
      if (protocol === 'http:' || protocol === 'https:') return parsed.origin;
    } catch {
      // keep wildcard for local file mode or unparseable referrer
    }
    return '*';
  };

  const uniqueStrings = (rows) => {
    const out = [];
    rows.forEach((value) => {
      const text = asTrimmed(value);
      if (!text || out.includes(text)) return;
      out.push(text);
    });
    return out;
  };

  const nextCredentialUrn = () => {
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === 'function'
    ) {
      return `urn:uuid:${globalThis.crypto.randomUUID()}`;
    }
    return `urn:uuid:${uid('cred')}`;
  };

  const asCredentialTypeArray = (value, defaultType) => {
    const raw = Array.isArray(value) ? value : [value];
    const normalized = uniqueStrings(
      raw
        .map((entry) => asTrimmed(entry))
        .filter(Boolean)
        .filter((entry) => entry !== 'VerifiableCredential')
    );
    const primary = asTrimmed(defaultType) || 'ServiceCredential';
    if (!normalized.includes(primary)) {
      normalized.unshift(primary);
    }
    return ['VerifiableCredential'].concat(normalized);
  };

  const primaryTypeFromTypeArray = (rows) => {
    const found = (Array.isArray(rows) ? rows : []).find((entry) => asTrimmed(entry) && asTrimmed(entry) !== 'VerifiableCredential');
    return asTrimmed(found);
  };

  const canonicalIssuerDidFromProviderId = (providerId) => {
    const normalizedProviderId = asTrimmed(providerId) || 'sovereign_ngo';
    const known = providerDidFromId(normalizedProviderId);
    if (known) return known;
    return `did:web:demo.sovereign.ngo:issuer:${normalizedProviderId}`;
  };

  const statusListCredentialUrlForIssuer = (issuerDid) => {
    const encodedIssuer = encodeURIComponent(asTrimmed(issuerDid) || 'did:web:demo.sovereign.ngo:issuer:default');
    return `${STATUS_LIST_BASE_URL}/${encodedIssuer}`;
  };

  const credentialStatusFromEntry = ({
    issuerDid,
    statusListIndex
  }) => {
    const normalizedIssuerDid = asTrimmed(issuerDid);
    const normalizedStatusListIndex = String(
      Number.isFinite(Number(statusListIndex)) && Number(statusListIndex) >= 0
        ? Math.floor(Number(statusListIndex))
        : 0
    );
    const statusListCredential = statusListCredentialUrlForIssuer(normalizedIssuerDid);
    return {
      id: `${statusListCredential}#${normalizedStatusListIndex}`,
      type: STATUS_LIST_ENTRY_TYPE,
      statusPurpose: STATUS_LIST_PURPOSE,
      statusListIndex: normalizedStatusListIndex,
      statusListCredential
    };
  };

  const ensureStatusListsContainer = (state) => {
    if (!isObject(state.statusLists)) {
      state.statusLists = {};
    }
    return state.statusLists;
  };

  const statusListKeyForIssuer = (issuerDid) => asTrimmed(issuerDid);

  const ensureStatusListForIssuer = (state, issuerDid) => {
    const lists = ensureStatusListsContainer(state);
    const key = statusListKeyForIssuer(issuerDid);
    if (!isObject(lists[key])) {
      lists[key] = {
        issuerDid: key,
        statusPurpose: STATUS_LIST_PURPOSE,
        statusListCredential: statusListCredentialUrlForIssuer(key),
        nextStatusListIndex: 0,
        entries: {}
      };
    }
    const row = lists[key];
    if (!isObject(row.entries)) row.entries = {};
    if (!Number.isFinite(Number(row.nextStatusListIndex)) || Number(row.nextStatusListIndex) < 0) {
      row.nextStatusListIndex = Object.keys(row.entries).length;
    }
    return row;
  };

  const reserveCredentialStatusEntry = (state, issuerDid, credentialId, requestedStatusListIndex, credentialStatus) => {
    const list = ensureStatusListForIssuer(state, issuerDid);
    const normalizedCredentialId = asTrimmed(credentialId);
    if (!normalizedCredentialId) {
      throw new Error('Credential id is required to reserve status list entry.');
    }

    const parsedFromCredential = credentialStatus && Number.isFinite(Number(credentialStatus.statusListIndex))
      ? Math.floor(Number(credentialStatus.statusListIndex))
      : null;
    const parsedRequested = Number.isFinite(Number(requestedStatusListIndex))
      ? Math.floor(Number(requestedStatusListIndex))
      : null;
    const existing = isObject(list.entries[normalizedCredentialId]) ? list.entries[normalizedCredentialId] : null;

    if (existing && Number.isFinite(Number(existing.statusListIndex)) && Number(existing.statusListIndex) >= 0) {
      return Number(existing.statusListIndex);
    }

    const usedIndexes = new Set(
      Object.values(list.entries)
        .map((entry) => Number(entry && entry.statusListIndex))
        .filter((value) => Number.isFinite(value) && value >= 0)
    );

    let statusListIndex = parsedFromCredential;
    if (!Number.isFinite(statusListIndex) || statusListIndex < 0 || usedIndexes.has(statusListIndex)) {
      statusListIndex = parsedRequested;
    }
    if (!Number.isFinite(statusListIndex) || statusListIndex < 0 || usedIndexes.has(statusListIndex)) {
      statusListIndex = Number(list.nextStatusListIndex) || 0;
      while (usedIndexes.has(statusListIndex)) {
        statusListIndex += 1;
      }
    }

    list.entries[normalizedCredentialId] = {
      credentialId: normalizedCredentialId,
      statusListIndex,
      status: 'active',
      updatedAt: nowIso()
    };

    list.nextStatusListIndex = Math.max(Number(list.nextStatusListIndex) || 0, statusListIndex + 1);
    return statusListIndex;
  };

  const buildVerifiableCredential = (options) => {
    const opts = options && typeof options === 'object' ? options : {};
    const id = asTrimmed(opts.id) || nextCredentialUrn();
    const credentialType = asTrimmed(opts.credentialType || opts.type) || 'ServiceCredential';
    const type = asCredentialTypeArray(opts.type || credentialType, credentialType);
    const issuerDid = asTrimmed(opts.issuerDid)
      || canonicalIssuerDidFromProviderId(opts.issuerProviderId);
    const issuerName = asTrimmed(opts.issuerName);
    const issuer = issuerName ? { id: issuerDid, name: issuerName } : { id: issuerDid };
    const validFrom = asTrimmed(opts.issuedAt) || nowIso();
    const mergedClaims = isObject(opts.claims) ? deepClone(opts.claims) : {};
    const credentialSubject = {
      id: asTrimmed(opts.subjectWebId),
      ...mergedClaims
    };
    const subjectName = asTrimmed(opts.subjectName);
    if (subjectName && !asTrimmed(credentialSubject.name)) {
      credentialSubject.name = subjectName;
    }
    if (!asTrimmed(credentialSubject.id)) {
      throw new Error('Credential subject WebID is required.');
    }

    const statusListIndex = Number.isFinite(Number(opts.statusListIndex))
      ? Math.floor(Number(opts.statusListIndex))
      : 0;
    const vc = {
      '@context': [VC_CONTEXT, VC_STATUS_LIST_CONTEXT],
      id,
      type,
      issuer,
      validFrom,
      issuanceDate: validFrom,
      credentialStatus: credentialStatusFromEntry({
        issuerDid,
        statusListIndex
      }),
      credentialSubject
    };
    return vc;
  };

  const isValidVerifiableCredential = (vc) => {
    if (!isObject(vc)) return false;
    if (!Array.isArray(vc['@context']) || !vc['@context'].includes(VC_CONTEXT)) return false;
    if (!vc['@context'].includes(VC_STATUS_LIST_CONTEXT)) return false;
    if (!asTrimmed(vc.id)) return false;
    if (!Array.isArray(vc.type) || !vc.type.includes('VerifiableCredential')) return false;
    if (!isObject(vc.issuer) || !asTrimmed(vc.issuer.id)) return false;
    if (!asTrimmed(vc.validFrom)) return false;
    if (!isObject(vc.credentialStatus)) return false;
    if (asTrimmed(vc.credentialStatus.type) !== STATUS_LIST_ENTRY_TYPE) return false;
    if (asTrimmed(vc.credentialStatus.statusPurpose) !== STATUS_LIST_PURPOSE) return false;
    if (!asTrimmed(vc.credentialStatus.statusListCredential)) return false;
    const statusListIndex = Number(vc.credentialStatus.statusListIndex);
    if (!Number.isFinite(statusListIndex) || statusListIndex < 0) return false;
    if (!isObject(vc.credentialSubject) || !asTrimmed(vc.credentialSubject.id)) return false;
    return true;
  };

  const isValidCredentialEntry = (entry, state) => {
    if (!isObject(entry)) return false;
    if (asTrimmed(entry.format) !== 'w3c-vc-jsonld') return false;
    if (!asTrimmed(entry.id)) return false;
    if (!asTrimmed(entry.type)) return false;
    if (!asTrimmed(entry.issuerProviderId)) return false;
    if (!asTrimmed(entry.issuerProviderDid)) return false;
    if (!asTrimmed(entry.subjectWebId)) return false;
    if (!asTrimmed(entry.createdAt)) return false;
    if (!asTrimmed(entry.status)) return false;
    const statusListIndex = Number(entry.statusListIndex);
    if (!Number.isFinite(statusListIndex) || statusListIndex < 0) return false;
    if (!asTrimmed(entry.statusListCredential)) return false;
    if (!isObject(entry.metadata)) return false;
    if (!isValidVerifiableCredential(entry.credential)) return false;
    if (asTrimmed(entry.credential.id) !== asTrimmed(entry.id)) return false;
    if (asTrimmed(entry.credential.credentialSubject.id) !== asTrimmed(entry.subjectWebId)) return false;
    const vcPrimaryType = primaryTypeFromTypeArray(entry.credential.type);
    if (!vcPrimaryType || vcPrimaryType !== asTrimmed(entry.type)) return false;
    if (state && isObject(state)) {
      const issuerDid = asTrimmed(entry.issuerProviderDid) || asTrimmed(entry.credential.issuer && entry.credential.issuer.id);
      const list = ensureStatusListForIssuer(state, issuerDid);
      const statusEntry = list.entries && list.entries[asTrimmed(entry.id)];
      if (!isObject(statusEntry)) return false;
      const vcStatusListIndex = Number(entry.credential.credentialStatus.statusListIndex);
      const rowStatusListIndex = Number(statusEntry.statusListIndex);
      if (!Number.isFinite(vcStatusListIndex) || !Number.isFinite(rowStatusListIndex)) return false;
      if (vcStatusListIndex !== rowStatusListIndex) return false;
      if (statusListIndex !== vcStatusListIndex) return false;
      if (asTrimmed(entry.statusListCredential) !== asTrimmed(entry.credential.credentialStatus.statusListCredential)) return false;
      if (asTrimmed(entry.credential.credentialStatus.statusListCredential) !== asTrimmed(list.statusListCredential)) return false;
      const normalizedStatus = asTrimmed(statusEntry.status) || 'active';
      if (normalizedStatus !== asTrimmed(entry.status)) return false;
    }
    return true;
  };

  const createCredentialEntry = ({
    id,
    credentialType,
    issuerProviderId,
    issuerProviderDid,
    subjectWebId,
    subjectName,
    claims,
    metadata,
    issuedAt,
    status,
    state,
    statusListIndex,
    credentialStatus
  }) => {
    if (!isObject(state)) {
      throw new Error('State reference is required for credential issuance.');
    }
    const normalizedType = asTrimmed(credentialType) || 'ServiceCredential';
    const normalizedIssuerProviderId = asTrimmed(issuerProviderId) || 'sovereign_ngo';
    const normalizedIssuerProviderDid = asTrimmed(issuerProviderDid)
      || canonicalIssuerDidFromProviderId(normalizedIssuerProviderId);
    const normalizedSubjectWebId = asTrimmed(subjectWebId);
    const normalizedIssuedAt = asTrimmed(issuedAt) || nowIso();
    const normalizedMetadata = isObject(metadata) ? deepClone(metadata) : {};
    const normalizedCredentialId = asTrimmed(id) || nextCredentialUrn();
    const normalizedStatus = asTrimmed(status) || 'active';
    const reservedStatusListIndex = reserveCredentialStatusEntry(
      state,
      normalizedIssuerProviderDid,
      normalizedCredentialId,
      statusListIndex,
      credentialStatus
    );

    const provider = providerById(normalizedIssuerProviderId);
    const vc = buildVerifiableCredential({
      id: normalizedCredentialId,
      credentialType: normalizedType,
      issuerProviderId: normalizedIssuerProviderId,
      issuerDid: normalizedIssuerProviderDid,
      issuerName: provider ? provider.label : normalizedIssuerProviderId,
      subjectWebId: normalizedSubjectWebId,
      subjectName: asTrimmed(subjectName) || credentialSubjectName(normalizedSubjectWebId),
      claims: isObject(claims) ? claims : {},
      issuedAt: normalizedIssuedAt,
      statusListIndex: reservedStatusListIndex
    });

    const list = ensureStatusListForIssuer(state, normalizedIssuerProviderDid);
    const statusRow = list.entries[normalizedCredentialId];
    statusRow.status = normalizedStatus === 'revoked' ? 'revoked' : 'active';
    statusRow.updatedAt = nowIso();

    const entry = {
      id: vc.id,
      format: 'w3c-vc-jsonld',
      type: primaryTypeFromTypeArray(vc.type) || normalizedType,
      issuerProviderId: normalizedIssuerProviderId,
      issuerProviderDid: normalizedIssuerProviderDid,
      subjectWebId: asTrimmed(vc.credentialSubject.id),
      subjectName: asTrimmed(vc.credentialSubject.name) || credentialSubjectName(normalizedSubjectWebId),
      createdAt: normalizedIssuedAt,
      status: statusRow.status,
      statusListIndex: reservedStatusListIndex,
      statusListCredential: list.statusListCredential,
      metadata: normalizedMetadata,
      credential: vc
    };

    if (!isValidCredentialEntry(entry, state)) {
      throw new Error('Credential entry failed strict validation.');
    }
    return entry;
  };

  const credentialTypes = (entry) => {
    if (!isValidCredentialEntry(entry)) return [];
    return entry.credential.type.filter((value) => value !== 'VerifiableCredential');
  };

  const credentialPrimaryType = (entry) => {
    const types = credentialTypes(entry);
    return primaryTypeFromTypeArray(types) || 'ServiceCredential';
  };

  const credentialHasType = (entry, type) => {
    const needle = asTrimmed(type);
    if (!needle) return false;
    return credentialTypes(entry).includes(needle);
  };

  const credentialIssuerProviderId = (entry) => {
    if (!isValidCredentialEntry(entry)) return '';
    return asTrimmed(entry.issuerProviderId);
  };

  const credentialIssuedAt = (entry) => {
    if (!isValidCredentialEntry(entry)) return '';
    return asTrimmed(entry.createdAt);
  };

  const credentialSubjectWebId = (entry) => {
    if (!isValidCredentialEntry(entry)) return '';
    return asTrimmed(entry.subjectWebId);
  };

  const credentialStatusRowFromState = (state, entry) => {
    if (!isValidCredentialEntry(entry)) return null;
    if (!isObject(state)) return null;
    const issuerDid = asTrimmed(entry.issuerProviderDid) || asTrimmed(entry.credential && entry.credential.issuer && entry.credential.issuer.id);
    if (!issuerDid) return null;
    const list = ensureStatusListForIssuer(state, issuerDid);
    if (!isObject(list.entries)) return null;
    const row = list.entries[asTrimmed(entry.id)];
    return isObject(row) ? row : null;
  };

  const isCredentialActive = (entry) => {
    if (!isValidCredentialEntry(entry)) return false;
    if (asTrimmed(entry.status) !== 'active') return false;
    const state = ensureState();
    const row = credentialStatusRowFromState(state, entry);
    if (!row) return false;
    return asTrimmed(row.status) !== 'revoked';
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

    const seededState = {
      meta: {
        createdAt: ts,
        updatedAt: ts,
        lastResetAt: ts
      },
      providers: providerCatalog.map((entry) => ({ ...entry })),
      identities,
      credentials: [],
      records: [],
      consents: [],
      referrals: [],
      recordAccessPasses: [],
      providerPodAccessLinks: [],
      events: [],
      statusLists: {}
    };

    const credentials = providerCatalog.map((provider) => createCredentialEntry({
      credentialType: 'StaffAccessCredential',
      issuerProviderId: provider.id,
      issuerProviderDid: provider.did,
      subjectWebId: staffWebId,
      subjectName: credentialSubjectName(staffWebId),
      issuedAt: ts,
      status: 'active',
      state: seededState,
      claims: {
        grantedRole: 'issuer_staff'
      },
      metadata: {
        providerLabel: provider.label,
        providerType: provider.type,
        grantedRole: 'issuer_staff',
        startupProvisioned: true
      }
    }));
    seededState.credentials = credentials;
    return seededState;
  };

  const parseState = (raw) => {
    if (!raw) return null;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!parsed || typeof parsed !== 'object') return null;
      if (!Array.isArray(parsed.identities) || !Array.isArray(parsed.providers)) return null;
      if (!Array.isArray(parsed.credentials) || !Array.isArray(parsed.records)) return null;
      if (!Array.isArray(parsed.consents) || !Array.isArray(parsed.referrals)) return null;
      if (!Array.isArray(parsed.recordAccessPasses) || !Array.isArray(parsed.providerPodAccessLinks) || !Array.isArray(parsed.events)) {
        return null;
      }
      if (!isObject(parsed.statusLists)) return null;
      const allCredentialsValid = parsed.credentials.every((entry) => isValidCredentialEntry(entry, parsed));
      if (!allCredentialsValid) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const resolveBackend = () => {
    const configRoot = typeof globalThis !== 'undefined' ? globalThis.SovereignDemoStoreConfig : null;
    const backendConfig = configRoot && typeof configRoot.backend === 'object' ? configRoot.backend : {};

    if (backendConfig && backendConfig.instance && typeof backendConfig.instance === 'object') {
      return backendConfig.instance;
    }

    const backendMode = String(backendConfig.mode || 'local').trim().toLowerCase();
    const backendFactories = typeof globalThis !== 'undefined' ? globalThis.SovereignDemoStoreBackends : null;
    if (!backendFactories || typeof backendFactories !== 'object') {
      throw new Error('Demo store backend factories are unavailable.');
    }

    if (backendMode === 'solid-pod') {
      if (typeof backendFactories.createSolidPodBackend !== 'function') {
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

    if (typeof backendFactories.createLocalStorageBackend !== 'function') {
      throw new Error('Local demo store backend factory is unavailable.');
    }

    return backendFactories.createLocalStorageBackend({
      storageKey: STORAGE_KEY,
      eventKey: EVENT_KEY,
      channelName: CHANNEL_NAME
    });
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
  }) => {
    const event = withState((state) => {
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

    try {
      if (
        typeof window !== 'undefined' &&
        window.parent &&
        window.parent !== window
      ) {
        window.parent.postMessage({
          channel: 'sovereign_tutorial',
          type: 'tutorial-event',
          event: deepClone(event)
        }, resolveParentTargetOrigin());
      }
    } catch {
      // no-op
    }

    return event;
  };

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

  const issueCredential = ({
    subjectWebId,
    type,
    credentialType,
    issuerProviderId,
    issuerProviderDid,
    metadata,
    claims,
    issuedAt
  }) => withState((state) => {
    const identity = state.identities.find((entry) => entry.webId === subjectWebId);
    const effectiveIssuerProviderId = asTrimmed(issuerProviderId) || 'sovereign_ngo';
    const effectiveIssuerProviderDid = asTrimmed(issuerProviderDid)
      || canonicalIssuerDidFromProviderId(effectiveIssuerProviderId);
    const normalized = createCredentialEntry({
      credentialType: credentialType || type || 'ServiceCredential',
      issuerProviderId: effectiveIssuerProviderId,
      issuerProviderDid: effectiveIssuerProviderDid,
      subjectWebId,
      subjectName: identity ? identity.displayName : subjectWebId,
      issuedAt: asTrimmed(issuedAt) || nowIso(),
      status: 'active',
      state,
      metadata: metadata ? deepClone(metadata) : {},
      claims: isObject(claims) ? claims : {}
    });

    state.credentials.push(normalized);
    return { credential: deepClone(normalized) };
  }, 'credential-issued').credential;

  const listCredentials = (subjectWebId) => {
    const state = ensureState();
    const rows = state.credentials
      .filter((entry) => !subjectWebId || credentialSubjectWebId(entry) === subjectWebId)
      .map((entry) => {
        const row = credentialStatusRowFromState(state, entry);
        if (!row) return entry;
        const status = asTrimmed(row.status) === 'revoked' ? 'revoked' : 'active';
        if (status === asTrimmed(entry.status)) return entry;
        return {
          ...entry,
          status
        };
      })
      .slice()
      .sort((a, b) => String(credentialIssuedAt(b)).localeCompare(String(credentialIssuedAt(a))));
    return deepClone(rows);
  };

  const revokeCredential = ({ credentialId, revokedByWebId, reason } = {}) => withState((state) => {
    const normalizedCredentialId = asTrimmed(credentialId);
    if (!normalizedCredentialId) {
      return { credential: null, error: 'Credential id is required.' };
    }
    const entry = state.credentials.find((row) => asTrimmed(row.id) === normalizedCredentialId);
    if (!entry) {
      return { credential: null, error: 'Credential not found.' };
    }
    const row = credentialStatusRowFromState(state, entry);
    if (!row) {
      return { credential: null, error: 'Credential status list entry not found.' };
    }
    row.status = 'revoked';
    row.revokedAt = nowIso();
    row.updatedAt = row.revokedAt;
    row.revokedByWebId = asTrimmed(revokedByWebId) || '';
    row.reason = asTrimmed(reason) || '';

    entry.status = 'revoked';
    entry.revokedAt = row.revokedAt;
    entry.revokedByWebId = row.revokedByWebId;
    entry.revocationReason = row.reason;

    return { credential: deepClone(entry), error: '' };
  }, 'credential-revoked');

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
      accessEndpoint: `/provider-api/${encodeURIComponent(sourceProviderId)}/api/presentations/submit`,
      createdAt: now,
      expiresAt,
      status: 'active',
      issuedByWebId: actorWebId || '',
      metadata: {
        sourceProviderLabel: record.providerLabel || sourceProviderId
      }
    };
    state.recordAccessPasses.push(accessPass);

    const credential = createCredentialEntry({
      credentialType: 'RecordAccessPassCredential',
      issuerProviderId: sourceProviderId,
      issuerProviderDid: providerDidFromId(sourceProviderId),
      subjectWebId,
      subjectName: identity.displayName || subjectWebId,
      issuedAt: now,
      status: 'active',
      state,
      claims: {
        accessPassId: accessPass.id,
        sourceRecordId,
        sourceProviderId,
        sharedWithProviderId: normalizedSharedWithProviderId,
        consentMode: normalizedConsentMode,
        expiresAt,
        accessHandle: accessPass.accessHandle,
        accessEndpoint: accessPass.accessEndpoint
      },
      metadata: {
        accessPassId: accessPass.id,
        sourceRecordId,
        sourceProviderId,
        sharedWithProviderId: normalizedSharedWithProviderId,
        consentMode: normalizedConsentMode,
        expiresAt
      }
    });
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
    buildVerifiableCredential: (options) => deepClone(buildVerifiableCredential(options)),
    credentialTypes: (entry) => deepClone(credentialTypes(entry)),
    credentialPrimaryType,
    credentialHasType,
    isCredentialActive,
    credentialIssuerProviderId,
    credentialIssuedAt,
    credentialSubjectWebId,
    credentialAsW3cVc: (entry) => {
      if (!isValidCredentialEntry(entry)) return null;
      return deepClone(entry.credential);
    },
    listIdentities,
    createJohnDoe,
    listCredentials,
    issueCredential,
    revokeCredential,
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
