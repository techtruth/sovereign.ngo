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

  const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

  const requireWebCrypto = () => {
    const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function' || !cryptoApi.subtle) {
      throw new Error('Web Crypto API is required for record access packet encryption.');
    }
    return cryptoApi;
  };

  const randomBytes = (size) => {
    const cryptoApi = requireWebCrypto();
    const out = new Uint8Array(size);
    cryptoApi.getRandomValues(out);
    return out;
  };

  const bytesToBase64Url = (bytes) => {
    if (!bytes || typeof bytes.length !== 'number') return '';
    if (typeof btoa !== 'function') {
      throw new Error('btoa is required for base64url encoding.');
    }
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const base64UrlToBytes = (value) => {
    const normalized = asTrimmed(value).replace(/-/g, '+').replace(/_/g, '/');
    if (!normalized) return new Uint8Array(0);
    if (typeof atob !== 'function') {
      throw new Error('atob is required for base64url decoding.');
    }
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
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

  const ensureSubjectPodCryptoProfile = (state, subjectWebId) => {
    const normalizedSubjectWebId = asTrimmed(subjectWebId);
    if (!normalizedSubjectWebId) {
      throw new Error('Subject WebID is required for pod crypto profile.');
    }
    const identity = state.identities.find((entry) => entry.webId === normalizedSubjectWebId);
    if (!identity || identity.status === 'inactive') {
      throw new Error('Subject identity is not available for pod crypto profile.');
    }
    if (!isObject(identity.podCrypto)) {
      identity.podCrypto = {};
    }
    if (!asTrimmed(identity.podCrypto.keyRef)) {
      identity.podCrypto.keyRef = uid('kek');
    }
    if (!asTrimmed(identity.podCrypto.wrappingKey)) {
      identity.podCrypto.wrappingKey = bytesToBase64Url(randomBytes(32));
      identity.podCrypto.createdAt = nowIso();
    }
    identity.podCrypto.updatedAt = nowIso();
    return identity.podCrypto;
  };

  const encryptRecordForAccessPacket = async ({
    state,
    subjectWebId,
    record
  }) => {
    if (!textEncoder) {
      throw new Error('TextEncoder is required for record access packet encryption.');
    }
    const cryptoApi = requireWebCrypto();
    const subtle = cryptoApi.subtle;
    const podCrypto = ensureSubjectPodCryptoProfile(state, subjectWebId);

    const envelopePayload = {
      recordId: asTrimmed(record.id),
      subjectWebId: asTrimmed(record.subjectWebId),
      sourceProviderId: asTrimmed(record.providerId),
      sourceProviderDid: asTrimmed(record.providerDid),
      sourceProviderLabel: asTrimmed(record.providerLabel),
      category: asTrimmed(record.category),
      summary: asTrimmed(record.summary),
      details: isObject(record.details) ? deepClone(record.details) : {},
      createdAt: asTrimmed(record.createdAt),
      encryptedAt: nowIso()
    };
    const plaintext = textEncoder.encode(JSON.stringify(envelopePayload));

    const contentKey = await subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const iv = randomBytes(12);
    const ciphertext = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      contentKey,
      plaintext
    );

    const wrappingKeyRaw = base64UrlToBytes(podCrypto.wrappingKey);
    const wrappingKey = await subtle.importKey(
      'raw',
      wrappingKeyRaw,
      { name: 'AES-KW' },
      false,
      ['wrapKey', 'unwrapKey']
    );
    const wrappedKey = await subtle.wrapKey(
      'raw',
      contentKey,
      wrappingKey,
      { name: 'AES-KW' }
    );

    return {
      recordReference: `urn:sovereign:record-ref:${encodeURIComponent(asTrimmed(record.providerId))}:${encodeURIComponent(asTrimmed(record.id))}`,
      decryptionKeyRef: asTrimmed(podCrypto.keyRef),
      decryptionKeyCiphertext: bytesToBase64Url(new Uint8Array(wrappedKey)),
      decryptionKeyWrapAlg: 'A256KW',
      recordCipherAlg: 'A256GCM',
      encryptedRecordEnvelope: {
        alg: 'A256GCM',
        iv: bytesToBase64Url(iv),
        ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
        mediaType: 'application/json',
        createdAt: nowIso()
      }
    };
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
      recordAccessRequests: [],
      recordAccessPasses: [],
      prescriptionAuthorizations: [],
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
      if (parsed.recordAccessRequests === undefined) {
        parsed.recordAccessRequests = [];
      } else if (!Array.isArray(parsed.recordAccessRequests)) {
        return null;
      }
      if (parsed.prescriptionAuthorizations === undefined) {
        parsed.prescriptionAuthorizations = [];
      } else if (!Array.isArray(parsed.prescriptionAuthorizations)) {
        return null;
      }
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

  const withStateAsync = async (mutator, reason) => {
    const state = ensureState();
    const result = await mutator(state) || {};
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
    const normalizedProviderId = asTrimmed(providerId);
    if (!normalizedProviderId || !referral) return false;
    if (asTrimmed(referral.fromProviderId) === normalizedProviderId) return false;
    const provider = providerById(normalizedProviderId);
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
      const normalizedProviderId = asTrimmed(opts.providerId);
      rows = rows.filter((entry) => {
        if (asTrimmed(entry.fromProviderId) === normalizedProviderId) return false;
        return providerCanFulfillReferral(normalizedProviderId, entry) || asTrimmed(entry.fulfilledByProviderId) === normalizedProviderId;
      });
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

  const listRecordAccessRequests = (subjectWebId, options) => {
    const opts = options || {};
    const state = ensureState();
    let rows = Array.isArray(state.recordAccessRequests) ? state.recordAccessRequests.slice() : [];

    if (subjectWebId) {
      rows = rows.filter((entry) => entry.subjectWebId === subjectWebId);
    }

    if (opts.requestedByProviderId) {
      rows = rows.filter((entry) => entry.requestedByProviderId === opts.requestedByProviderId);
    }

    if (opts.sourceProviderId) {
      rows = rows.filter((entry) => !entry.sourceProviderId || entry.sourceProviderId === opts.sourceProviderId);
    }

    if (!opts.includeClosed) {
      rows = rows.filter((entry) => entry.status === 'open');
    }

    rows = rows.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return deepClone(rows);
  };

  const getRecordAccessRequest = (requestId) => {
    const normalizedRequestId = String(requestId || '').trim();
    if (!normalizedRequestId) return null;
    const state = ensureState();
    const found = Array.isArray(state.recordAccessRequests)
      ? state.recordAccessRequests.find((entry) => entry.id === normalizedRequestId)
      : null;
    return found ? deepClone(found) : null;
  };

  const addRecordAccessRequest = ({
    subjectWebId,
    requestedByProviderId,
    sourceProviderId,
    requestedRecordCategory,
    reasonSummary,
    requestedAccessMode,
    requestedAccessDays,
    requestedByWebId
  }) => withState((state) => {
    const normalizedSubjectWebId = String(subjectWebId || '').trim();
    const normalizedRequestedByProviderId = String(requestedByProviderId || '').trim();
    const normalizedSourceProviderId = String(sourceProviderId || '').trim();
    const normalizedRequestedRecordCategory = String(requestedRecordCategory || '').trim() || 'general-record';
    const normalizedReasonSummary = String(reasonSummary || '').trim() || 'Record review requested.';
    const requestedModeRaw = String(requestedAccessMode || '').trim();
    const normalizedRequestedAccessMode = (
      requestedModeRaw === 'time_bound' || requestedModeRaw === 'indefinite' || requestedModeRaw === 'one_time'
    ) ? requestedModeRaw : 'one_time';
    const normalizedRequestedAccessDays = normalizedRequestedAccessMode === 'time_bound'
      ? Math.min(3650, Math.max(1, Math.floor(Number(requestedAccessDays) || 30)))
      : 0;
    const requestedExpiresAt = normalizedRequestedAccessMode === 'one_time'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : (normalizedRequestedAccessMode === 'time_bound'
        ? new Date(Date.now() + normalizedRequestedAccessDays * 24 * 60 * 60 * 1000).toISOString()
        : '');

    if (!normalizedSubjectWebId || !normalizedRequestedByProviderId) {
      return { request: null, error: 'Missing required fields for record access request.' };
    }

    const identity = state.identities.find((entry) => entry.webId === normalizedSubjectWebId);
    if (!identity || identity.status === 'inactive') {
      return { request: null, error: 'Subject identity is not available.' };
    }

    const requestingProvider = providerById(normalizedRequestedByProviderId);
    if (!requestingProvider) {
      return { request: null, error: 'Requesting provider is not recognized.' };
    }

    if (normalizedSourceProviderId && !providerById(normalizedSourceProviderId)) {
      return { request: null, error: 'Requested source provider is not recognized.' };
    }

    const request = {
      id: uid('rar'),
      subjectWebId: normalizedSubjectWebId,
      requestedByProviderId: normalizedRequestedByProviderId,
      requestedByProviderDid: providerDidFromId(normalizedRequestedByProviderId),
      sourceProviderId: normalizedSourceProviderId,
      sourceProviderDid: providerDidFromId(normalizedSourceProviderId),
      requestedRecordCategory: normalizedRequestedRecordCategory,
      reasonSummary: normalizedReasonSummary,
      requestedAccessMode: normalizedRequestedAccessMode,
      requestedAccessDays: normalizedRequestedAccessDays,
      requestedExpiresAt,
      status: 'open',
      createdAt: nowIso(),
      requestedByWebId: String(requestedByWebId || '').trim(),
      fulfilledAt: '',
      fulfilledByProviderId: '',
      fulfilledByProviderDid: '',
      fulfilledByWebId: '',
      accessPassId: ''
    };

    state.recordAccessRequests.push(request);
    return { request: deepClone(request), error: '' };
  }, 'record-access-request-added');

  const fulfillRecordAccessRequest = ({
    requestId,
    accessPassId,
    fulfilledByProviderId,
    fulfilledByWebId
  }) => withState((state) => {
    const normalizedRequestId = String(requestId || '').trim();
    if (!normalizedRequestId) {
      return { request: null, error: 'Record access request id is required.' };
    }
    const request = state.recordAccessRequests.find((entry) => entry.id === normalizedRequestId);
    if (!request) {
      return { request: null, error: 'Record access request was not found.' };
    }
    if (request.status !== 'open') {
      return { request: null, error: 'Record access request is not open.' };
    }

    request.status = 'fulfilled';
    request.fulfilledAt = nowIso();
    request.fulfilledByProviderId = String(fulfilledByProviderId || '').trim();
    request.fulfilledByProviderDid = providerDidFromId(request.fulfilledByProviderId);
    request.fulfilledByWebId = String(fulfilledByWebId || '').trim();
    request.accessPassId = String(accessPassId || '').trim();

    return { request: deepClone(request), error: '' };
  }, 'record-access-request-fulfilled');

  const issuePrescriptionAuthorizationFromReferral = ({
    referralId,
    subjectWebId,
    issuedByProviderId,
    maxFills,
    expiresAt,
    actorWebId
  }) => withState((state) => {
    const normalizedReferralId = asTrimmed(referralId);
    const normalizedSubjectWebId = asTrimmed(subjectWebId);
    const normalizedIssuerProviderId = asTrimmed(issuedByProviderId);
    if (!normalizedReferralId || !normalizedSubjectWebId || !normalizedIssuerProviderId) {
      return { authorization: null, error: 'Missing required fields for prescription fill-right authorization.' };
    }

    const referral = state.referrals.find((entry) => asTrimmed(entry.id) === normalizedReferralId);
    if (!referral) {
      return { authorization: null, error: 'Referral not found for prescription fill-right authorization.' };
    }
    if (asTrimmed(referral.subjectWebId) !== normalizedSubjectWebId) {
      return { authorization: null, error: 'Referral subject mismatch for prescription fill-right authorization.' };
    }
    if (asTrimmed(referral.fromProviderId) !== normalizedIssuerProviderId) {
      return { authorization: null, error: 'Only referral issuer can create prescription fill-right authorization.' };
    }
    if (asTrimmed(referral.targetCapability) !== 'pharmacy-services') {
      return { authorization: null, error: 'Referral is not a pharmacy-services referral.' };
    }

    if (!Array.isArray(state.prescriptionAuthorizations)) {
      state.prescriptionAuthorizations = [];
    }
    const existing = state.prescriptionAuthorizations.find((entry) => (
      asTrimmed(entry.referralId) === normalizedReferralId &&
      asTrimmed(entry.subjectWebId) === normalizedSubjectWebId &&
      (asTrimmed(entry.status) === 'active' || asTrimmed(entry.status) === 'exhausted')
    ));
    if (existing) {
      return { authorization: deepClone(existing), error: '' };
    }

    const normalizedTotalFills = Math.min(12, Math.max(1, Math.floor(Number(maxFills) || 1)));
    const parsedExpiresAt = Date.parse(asTrimmed(expiresAt));
    const normalizedExpiresAt = Number.isFinite(parsedExpiresAt)
      ? new Date(parsedExpiresAt).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const authorization = {
      id: uid('rxauth'),
      referralId: normalizedReferralId,
      subjectWebId: normalizedSubjectWebId,
      issuedByProviderId: normalizedIssuerProviderId,
      issuedByProviderDid: providerDidFromId(normalizedIssuerProviderId),
      totalFills: normalizedTotalFills,
      remainingFills: normalizedTotalFills,
      consumedEntries: [],
      status: 'active',
      createdAt: nowIso(),
      expiresAt: normalizedExpiresAt,
      lastConsumedAt: '',
      issuedByWebId: asTrimmed(actorWebId)
    };
    state.prescriptionAuthorizations.push(authorization);
    return { authorization: deepClone(authorization), error: '' };
  }, 'prescription-fill-right-issued');

  const getPrescriptionAuthorizationByReferral = (referralId) => {
    const normalizedReferralId = asTrimmed(referralId);
    if (!normalizedReferralId) return null;
    const state = ensureState();
    const found = Array.isArray(state.prescriptionAuthorizations)
      ? state.prescriptionAuthorizations.find((entry) => asTrimmed(entry.referralId) === normalizedReferralId)
      : null;
    return found ? deepClone(found) : null;
  };

  const listPrescriptionAuthorizations = (subjectWebId, options) => {
    const normalizedSubjectWebId = asTrimmed(subjectWebId);
    const opts = options || {};
    const state = ensureState();
    let rows = Array.isArray(state.prescriptionAuthorizations)
      ? state.prescriptionAuthorizations.slice()
      : [];
    if (normalizedSubjectWebId) {
      rows = rows.filter((entry) => asTrimmed(entry.subjectWebId) === normalizedSubjectWebId);
    }
    if (!opts.includeClosed) {
      rows = rows.filter((entry) => asTrimmed(entry.status) === 'active');
    }
    rows = rows.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return deepClone(rows);
  };

  const consumePrescriptionFillRight = ({
    referralId,
    providerId,
    subjectWebId,
    actorWebId
  }) => withState((state) => {
    const normalizedReferralId = asTrimmed(referralId);
    const normalizedProviderId = asTrimmed(providerId);
    const normalizedSubjectWebId = asTrimmed(subjectWebId);
    if (!normalizedReferralId || !normalizedProviderId || !normalizedSubjectWebId) {
      return { authorization: null, fill: null, error: 'Missing required fields for prescription fill-right consume.' };
    }
    const provider = providerById(normalizedProviderId);
    if (!provider || !Array.isArray(provider.capabilities) || !provider.capabilities.includes('pharmacy-services')) {
      return { authorization: null, fill: null, error: 'Only pharmacy-capable providers can consume prescription fill-right state.' };
    }
    if (!Array.isArray(state.prescriptionAuthorizations)) {
      state.prescriptionAuthorizations = [];
    }
    const authorization = state.prescriptionAuthorizations.find((entry) => (
      asTrimmed(entry.referralId) === normalizedReferralId &&
      asTrimmed(entry.subjectWebId) === normalizedSubjectWebId
    ));
    if (!authorization) {
      return { authorization: null, fill: null, error: 'No prescription fill-right authorization found for this referral.' };
    }
    if (asTrimmed(authorization.status) !== 'active') {
      return { authorization: null, fill: null, error: 'Prescription fill-right authorization is not active.' };
    }
    const expiresAtMs = Date.parse(asTrimmed(authorization.expiresAt));
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      authorization.status = 'expired';
      return { authorization: null, fill: null, error: 'Prescription fill-right authorization has expired.' };
    }
    const remaining = Math.max(0, Math.floor(Number(authorization.remainingFills) || 0));
    if (remaining <= 0) {
      authorization.status = 'exhausted';
      return { authorization: null, fill: null, error: 'No remaining prescription fill rights for this referral.' };
    }
    if (!Array.isArray(authorization.consumedEntries)) {
      authorization.consumedEntries = [];
    }
    const fill = {
      id: uid('rxfill'),
      referralId: normalizedReferralId,
      providerId: normalizedProviderId,
      providerDid: providerDidFromId(normalizedProviderId),
      consumedByWebId: asTrimmed(actorWebId),
      consumedAt: nowIso()
    };
    authorization.consumedEntries.unshift(fill);
    authorization.remainingFills = remaining - 1;
    authorization.lastConsumedAt = fill.consumedAt;
    if (authorization.remainingFills <= 0) {
      authorization.status = 'exhausted';
    }
    return {
      authorization: deepClone(authorization),
      fill: deepClone(fill),
      error: ''
    };
  }, 'prescription-fill-right-consumed');

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

  const issueRecordAccessPass = async ({
    subjectWebId,
    sourceProviderId,
    sourceRecordId,
    requestId,
    sharedWithProviderId,
    consentMode,
    timeBoundDays,
    actorWebId
  }) => withStateAsync(async (state) => {
    if (!subjectWebId || !sourceProviderId || !sourceRecordId) {
      return { accessPass: null, credential: null, request: null, error: 'Missing required fields for record access pass issuance.' };
    }

    const identity = state.identities.find((entry) => entry.webId === subjectWebId);
    if (!identity || identity.status === 'inactive') {
      return { accessPass: null, credential: null, request: null, error: 'Subject identity is not available.' };
    }

    const record = state.records.find((entry) => (
      entry.id === sourceRecordId &&
      entry.subjectWebId === subjectWebId &&
      entry.providerId === sourceProviderId
    ));
    if (!record) {
      return { accessPass: null, credential: null, request: null, error: 'Source record was not found for this subject and provider.' };
    }

    const requestedConsentMode = String(consentMode || '').trim();
    const normalizedConsentMode = (
      requestedConsentMode === 'time_bound' ||
      requestedConsentMode === 'indefinite' ||
      requestedConsentMode === 'one_time'
    ) ? requestedConsentMode : 'one_time';
    const normalizedTimeBoundDays = Math.min(3650, Math.max(1, Math.floor(Number(timeBoundDays) || 30)));
    const now = nowIso();
    const normalizedRequestId = String(requestId || '').trim();
    let matchedRequest = null;
    let normalizedSharedWithProviderId = String(sharedWithProviderId || '').trim();

    if (normalizedRequestId) {
      matchedRequest = state.recordAccessRequests.find((entry) => entry.id === normalizedRequestId) || null;
      if (!matchedRequest) {
        return { accessPass: null, credential: null, request: null, error: 'Selected record access request was not found.' };
      }
      if (matchedRequest.subjectWebId !== subjectWebId) {
        return { accessPass: null, credential: null, request: null, error: 'Record access request does not belong to this subject.' };
      }
      if (matchedRequest.status !== 'open') {
        return { accessPass: null, credential: null, request: null, error: 'Record access request is no longer open.' };
      }
      if (matchedRequest.sourceProviderId && matchedRequest.sourceProviderId !== sourceProviderId) {
        return { accessPass: null, credential: null, request: null, error: 'Record access request is scoped to a different source provider.' };
      }
      const requesterProviderId = String(matchedRequest.requestedByProviderId || '').trim();
      if (!requesterProviderId) {
        return { accessPass: null, credential: null, request: null, error: 'Record access request has no target provider.' };
      }
      if (normalizedSharedWithProviderId && normalizedSharedWithProviderId !== requesterProviderId) {
        return { accessPass: null, credential: null, request: null, error: 'Selected request target does not match the pass target provider.' };
      }
      normalizedSharedWithProviderId = requesterProviderId;
    }

    const effectiveConsentMode = matchedRequest
      ? String(matchedRequest.requestedAccessMode || 'one_time').trim() || 'one_time'
      : normalizedConsentMode;
    const effectiveTimeBoundDays = matchedRequest
      ? Math.min(3650, Math.max(1, Math.floor(Number(matchedRequest.requestedAccessDays) || 30)))
      : normalizedTimeBoundDays;
    const matchedRequestExpiresAt = matchedRequest ? String(matchedRequest.requestedExpiresAt || '').trim() : '';
    let expiresAt = '';
    if (effectiveConsentMode === 'one_time') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    } else if (effectiveConsentMode === 'time_bound') {
      const matchedExpiresAtMs = Date.parse(matchedRequestExpiresAt);
      if (matchedRequest && Number.isFinite(matchedExpiresAtMs) && matchedExpiresAtMs > Date.now()) {
        expiresAt = new Date(matchedExpiresAtMs).toISOString();
      } else {
        expiresAt = new Date(Date.now() + effectiveTimeBoundDays * 24 * 60 * 60 * 1000).toISOString();
      }
    }
    const encryptedPacket = await encryptRecordForAccessPacket({
      state,
      subjectWebId,
      record
    });
    const recordReference = encryptedPacket.recordReference;
    const decryptionKeyRef = encryptedPacket.decryptionKeyRef;
    const decryptionKeyCiphertext = encryptedPacket.decryptionKeyCiphertext;
    const decryptionKeyWrapAlg = encryptedPacket.decryptionKeyWrapAlg;
    const recordCipherAlg = encryptedPacket.recordCipherAlg;
    const encryptedRecordEnvelope = encryptedPacket.encryptedRecordEnvelope;

    const accessPass = {
      id: uid('rap'),
      subjectWebId,
      sourceProviderId,
      sourceProviderDid: providerDidFromId(sourceProviderId),
      sourceRecordId,
      sourceRecordCategory: record.category || '',
      sourceRecordSummary: record.summary || '',
      requestId: normalizedRequestId,
      sharedWithProviderId: normalizedSharedWithProviderId,
      sharedWithProviderDid: providerDidFromId(normalizedSharedWithProviderId),
      consentMode: effectiveConsentMode,
      timeBoundDays: effectiveConsentMode === 'time_bound' ? effectiveTimeBoundDays : 0,
      recordReference,
      decryptionKeyRef,
      decryptionKeyCiphertext,
      decryptionKeyWrapAlg,
      recordCipherAlg,
      encryptedRecordEnvelope,
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
        requestId: normalizedRequestId,
        sourceRecordId,
        sourceProviderId,
        sharedWithProviderId: normalizedSharedWithProviderId,
        consentMode: effectiveConsentMode,
        timeBoundDays: effectiveConsentMode === 'time_bound' ? effectiveTimeBoundDays : 0,
        expiresAt,
        recordReference,
        decryptionKeyRef,
        decryptionKeyCiphertext,
        decryptionKeyWrapAlg,
        recordCipherAlg,
        encryptedRecordEnvelope: deepClone(encryptedRecordEnvelope),
        accessHandle: accessPass.accessHandle,
        accessEndpoint: accessPass.accessEndpoint
      },
      metadata: {
        accessPassId: accessPass.id,
        requestId: normalizedRequestId,
        sourceRecordId,
        sourceProviderId,
        sharedWithProviderId: normalizedSharedWithProviderId,
        consentMode: effectiveConsentMode,
        timeBoundDays: effectiveConsentMode === 'time_bound' ? effectiveTimeBoundDays : 0,
        expiresAt,
        recordReference,
        decryptionKeyRef,
        decryptionKeyWrapAlg,
        recordCipherAlg,
        encryptedRecordEnvelope: deepClone(encryptedRecordEnvelope)
      }
    });
    state.credentials.push(credential);

    if (matchedRequest) {
      matchedRequest.status = 'fulfilled';
      matchedRequest.fulfilledAt = now;
      matchedRequest.fulfilledByProviderId = sourceProviderId;
      matchedRequest.fulfilledByProviderDid = providerDidFromId(sourceProviderId);
      matchedRequest.fulfilledByWebId = actorWebId || '';
      matchedRequest.accessPassId = accessPass.id;
    }

    return {
      accessPass: deepClone(accessPass),
      credential: deepClone(credential),
      request: matchedRequest ? deepClone(matchedRequest) : null,
      error: ''
    };
  }, 'record-access-pass-issued');

  const resolveSharedRecordFromAccessPass = async ({
    accessPassId,
    providerId,
    subjectWebId,
    actorWebId
  }) => withStateAsync(async (state) => {
    if (!textDecoder) {
      return { accessPass: null, record: null, oneTimeConsumed: false, error: 'TextDecoder is required for shared record decryption.' };
    }
    const normalizedAccessPassId = asTrimmed(accessPassId);
    const normalizedProviderId = asTrimmed(providerId);
    const normalizedSubjectWebId = asTrimmed(subjectWebId);
    if (!normalizedAccessPassId || !normalizedProviderId || !normalizedSubjectWebId) {
      return { accessPass: null, record: null, oneTimeConsumed: false, error: 'Missing required fields to resolve shared record from access pass.' };
    }
    const accessPass = state.recordAccessPasses.find((entry) => asTrimmed(entry.id) === normalizedAccessPassId);
    if (!accessPass) {
      return { accessPass: null, record: null, oneTimeConsumed: false, error: 'Record access pass not found.' };
    }
    if (asTrimmed(accessPass.subjectWebId) !== normalizedSubjectWebId) {
      return { accessPass: null, record: null, oneTimeConsumed: false, error: 'Record access pass does not belong to this subject.' };
    }
    if (asTrimmed(accessPass.status) !== 'active') {
      return { accessPass: null, record: null, oneTimeConsumed: false, error: 'Record access pass is not active.' };
    }
    if (asTrimmed(accessPass.sharedWithProviderId) && asTrimmed(accessPass.sharedWithProviderId) !== normalizedProviderId) {
      return { accessPass: null, record: null, oneTimeConsumed: false, error: 'Record access pass is scoped to a different provider.' };
    }
    if (asTrimmed(accessPass.expiresAt)) {
      const expiresAtMs = Date.parse(asTrimmed(accessPass.expiresAt));
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
        accessPass.status = 'expired';
        return { accessPass: null, record: null, oneTimeConsumed: false, error: 'Record access pass has expired.' };
      }
    }
    const encryptedEnvelope = isObject(accessPass.encryptedRecordEnvelope)
      ? accessPass.encryptedRecordEnvelope
      : null;
    if (!encryptedEnvelope) {
      return { accessPass: null, record: null, oneTimeConsumed: false, error: 'Record access pass has no encrypted record payload.' };
    }

    const podCrypto = ensureSubjectPodCryptoProfile(state, normalizedSubjectWebId);
    const wrappingKeyRaw = base64UrlToBytes(podCrypto.wrappingKey);
    const subtle = requireWebCrypto().subtle;
    const wrappingKey = await subtle.importKey(
      'raw',
      wrappingKeyRaw,
      { name: 'AES-KW' },
      false,
      ['unwrapKey']
    );
    const wrappedKeyBytes = base64UrlToBytes(asTrimmed(accessPass.decryptionKeyCiphertext));
    const contentKey = await subtle.unwrapKey(
      'raw',
      wrappedKeyBytes,
      wrappingKey,
      { name: 'AES-KW' },
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const iv = base64UrlToBytes(asTrimmed(encryptedEnvelope.iv));
    const ciphertext = base64UrlToBytes(asTrimmed(encryptedEnvelope.ciphertext));
    const plaintextBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      contentKey,
      ciphertext
    );
    const plaintextJson = textDecoder.decode(plaintextBuffer);
    let recordPayload = null;
    try {
      recordPayload = JSON.parse(plaintextJson);
    } catch {
      return { accessPass: null, record: null, oneTimeConsumed: false, error: 'Shared record payload failed JSON decode.' };
    }

    if (!Array.isArray(accessPass.accessedBy)) {
      accessPass.accessedBy = [];
    }
    accessPass.accessedBy.unshift({
      providerId: normalizedProviderId,
      providerDid: providerDidFromId(normalizedProviderId),
      actorWebId: asTrimmed(actorWebId),
      accessedAt: nowIso()
    });
    accessPass.lastAccessedAt = accessPass.accessedBy[0].accessedAt;
    accessPass.accessCount = Math.max(0, Math.floor(Number(accessPass.accessCount) || 0)) + 1;

    let oneTimeConsumed = false;
    if (asTrimmed(accessPass.consentMode) === 'one_time') {
      accessPass.status = 'consumed';
      accessPass.consumedAt = nowIso();
      accessPass.consumedByProviderId = normalizedProviderId;
      accessPass.consumedByProviderDid = providerDidFromId(normalizedProviderId);
      accessPass.consumedByWebId = asTrimmed(actorWebId);
      oneTimeConsumed = true;
    }

    return {
      accessPass: deepClone(accessPass),
      record: deepClone(recordPayload),
      oneTimeConsumed,
      error: ''
    };
  }, 'record-access-pass-resolved');

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
    if (String(accessPass.consentMode || '').trim() === 'one_time') {
      return { savedLink: null, error: 'Only reusable record access passes (time-bound or indefinite) can be saved for future provider access.' };
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
      recordReference: accessPass.recordReference,
      decryptionKeyRef: accessPass.decryptionKeyRef,
      decryptionKeyCiphertext: accessPass.decryptionKeyCiphertext,
      decryptionKeyWrapAlg: accessPass.decryptionKeyWrapAlg,
      recordCipherAlg: accessPass.recordCipherAlg,
      encryptedRecordEnvelope: deepClone(accessPass.encryptedRecordEnvelope || {}),
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
    if (asTrimmed(referral.fromProviderId) === asTrimmed(providerId)) {
      return { referral: null, error: 'Providers cannot fulfill referrals they issued themselves.' };
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
    addRecordAccessRequest,
    getRecordAccessRequest,
    listRecordAccessRequests,
    fulfillRecordAccessRequest,
    issuePrescriptionAuthorizationFromReferral,
    getPrescriptionAuthorizationByReferral,
    listPrescriptionAuthorizations,
    consumePrescriptionFillRight,
    issueRecordAccessPass,
    resolveSharedRecordFromAccessPass,
    listRecordAccessPasses,
    saveRecordAccessPassToProviderPod,
    listProviderPodAccessLinks
  };

  window.SovereignDemoStore = api;
  ensureState();
  initializeBackend();
})();
