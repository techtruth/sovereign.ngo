# Standards Profile (Demo)

This document records which standards are actively modeled in the Individual Demo, and which are intentionally deferred because the project is still demo-stage.

Date of this snapshot: **April 6, 2026**.

## In Scope Today

### 1) W3C Verifiable Credentials Data Model v2 (shape-level)

- Demo credentials use `@context: https://www.w3.org/ns/credentials/v2`.
- Credential entries are validated in the shared store before use.
- VC status includes Status List 2021 entry metadata.

Implementation anchors:

- `demo_webapp/lib/demo-store.js`

### 2) Status List 2021 entry metadata

- `credentialStatus` fields are modeled as `StatusList2021Entry` with revocation purpose.
- Issuance and revocation state are kept internally and validated.

Implementation anchors:

- `demo_webapp/lib/demo-store.js`
- `containerization/provider-api-server.js`

### 3) DID-based identifiers (`did:web` namespace in demo domain)

- Providers, issuers, verifiers, and subjects are represented with `did:web:demo.sovereign.ngo:*` identifiers.

Implementation anchors:

- `demo_webapp/data/provider-catalog.global.js`
- `demo_webapp/data/verifier-profiles.global.js`
- `demo_webapp/lib/demo-store.js`

### 4) JWT proof envelopes for provider-to-provider exchange

- Outbound presentation envelope uses `vp_token` as `vp+jwt` (EdDSA).
- VC proof in exchange path uses `vc+jwt` (EdDSA) and is validated by provider API.

Implementation anchors:

- `demo_webapp/services/provider/index.html`
- `containerization/provider-api-server.js`

### 5) Consent and auditable handoff model

- Consent grant/revoke is explicit in the credential manager.
- Referrals and cross-provider record access passes are explicitly modeled.
- Provider API audit uses hash-chained JSONL rows.

Implementation anchors:

- `demo_webapp/services/credential-manager/index.html`
- `demo_webapp/lib/demo-store.js`
- `containerization/provider-api-server.js`

### 6) Taxonomy alignment in service catalog

- Service providers are tagged with NAICS and AIRS/211 mappings.
- HUD HMIS mappings appear where relevant in catalog entries.

Implementation anchors:

- `demo_webapp/data/provider-catalog.global.js`
- `demo_webapp/data/naics-sectors.global.js`

## Intentionally Deferred (Not Full Standard Implementations Yet)

### 1) OID4VCI / OID4VP protocol flows

- The demo uses direct signed envelopes between UI and provider API.
- Full OID4 challenge endpointing, metadata discovery, wallet-style redirect flows, and verifier-initiated protocol exchange are not implemented as formal OID4 profiles.

### 2) DID method resolution and trust registry

- DID strings are used as identifiers.
- Full DID document resolution, key lifecycle governance, and production trust registry integration are not implemented.

### 3) Public, dereferenceable status-list endpoints

- Status-list URLs are issued in credentials for policy modeling.
- Static deployment does not host live status list documents for external dereference.

### 4) Full wallet interoperability test profile

- The demo illustrates architecture and exchange controls.
- It is not yet a certified interoperability profile against external wallet ecosystems.

## Interpretation Guide

- This project is **standards-aligned in structure** and **demo-enforced in critical exchange checks**, but not yet complete as a production-grade standards implementation.
- See `docs/compliance-baseline.md` for security/compliance implications.
