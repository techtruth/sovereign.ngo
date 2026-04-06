# Compliance Baseline (Demo Capacity)

This document defines what is currently acceptable in **demo mode** and what must change before any production or real-world sensitive data use.

Date of this snapshot: **April 6, 2026**.

## Scope

- Primary scope: `demo_webapp/individual/` and supporting service portals.
- Deployment contexts:
  - local static (`file://`),
  - containerized demo (`https://localhost:8180/...`).
- This baseline assumes **synthetic demo data only**.

## What Is Already Enforced In Demo

### 1) Explicit consent and handoff model

- Consent can be granted and revoked.
- Referrals are explicit and auditable.
- Cross-provider record access pass flow is explicit and scoped.

### 2) Cryptographic exchange checks in containerized provider API

- `vp_token` signature and claims checks.
- VC proof JWT checks (`vc+jwt`, EdDSA).
- VC structure checks, status-list metadata checks, issuer/subject matching checks.

### 3) Auditable provider API trail

- Provider API writes hash-chained JSONL audit rows.

### 4) Transport security in container topology

- Gateway-to-provider API and gateway-to-provider pod hops are TLS-wrapped and certificate-verified in demo topology.

### 5) Basic perimeter gate for root entry

- Basic auth is enforced at `/` and `/index.html`.

### 6) Non-identifiable export path for accountability

- Individual view supports non-identifiable audit export for demonstration of accountability without raw source-document disclosure.

## Demo-Only Controls (Not Production Compliant)

### 1) Authentication model is not production identity assurance

- Login is selection-based in UI (no production IAM, no MFA, no hardware-backed auth).

### 2) Shared secret model is static and global in compose

- Provider API shared secret is static demo value.
- Gateway injects provider API authorization header server-side.

### 3) Replay protection is partial

- Challenge/nonce consistency is checked, but there is no persistent nonce/jti replay ledger.

### 4) Key custody is browser-session level

- Signing key material is generated and cached in browser session storage in portal UI.

### 5) Privacy minimization is not strict in interactive screens

- Service views still expose human-readable identifiers and raw event feeds.

### 6) Status-list URLs are modeled, not published as live registries

- Status-list references are present in credentials but are not served as live dereference endpoints in static deployment.

### 7) Administrative and operational controls are incomplete

- No production BAA workflow,
- no full retention/legal-hold policy enforcement in runtime,
- no formal incident SLAs wired into runtime controls,
- no formalized least-privilege IAM model for each operational actor.

## HIPAA-Oriented Interpretation For This Demo

- This demo can be used to explain HIPAA-relevant design patterns (minimum necessary sharing, consented flows, auditable exchanges).
- It is **not HIPAA compliant by default for live PHI operations**.
- Treat the entire demo as non-production unless the hardening checklist is completed and validated.

## Go / No-Go Rule

- **Go (demo use):** synthetic data, workshop/training, architecture validation, interoperability prototyping.
- **No-Go (production use):** real PHI/PII, real claims operations, real clinical/legal decisions, regulated operational deployment.

## Next Document

Use `docs/production-hardening-checklist.md` as the implementation plan for closing these gaps.
