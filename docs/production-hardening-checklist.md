# Production Hardening Checklist

This checklist is the concrete path from demo posture to production-ready posture.

Date of this snapshot: **April 6, 2026**.

## Phase 0: Required Before Any Real Data

- [ ] Replace shared static provider API secret with per-provider secrets and rotation policy.
- [ ] Remove gateway hardcoded bearer injection; use service identity and short-lived credentials.
- [ ] Introduce real user/staff authentication (OIDC/SAML or equivalent) with MFA support.
- [ ] Replace browser session-stored private signing keys with managed key custody (HSM/KMS/wallet-managed).
- [ ] Add replay protection store for nonce/jti with expiry and one-time use enforcement.
- [ ] Add strict API rate limiting and abuse protections at gateway + service edge.
- [ ] Lock down CORS/origin policy for every API route in deployed environments.
- [ ] Ensure no dev TLS private keys are committed to deployable repos.
- [ ] Formalize incident response runbook and on-call ownership for security events.

## Phase 1: Interoperability and Trust Infrastructure

- [ ] Add DID document resolution and key verification policy for accepted DID methods.
- [ ] Introduce trust registry / trusted issuer registry policy.
- [ ] Publish dereferenceable status list credentials at stable endpoints.
- [ ] Add issuer key rotation and revocation strategy with audit evidence.
- [ ] Add verifier policy profiles (accepted credential types, issuer allowlist, assurance level).
- [ ] Add protocol-level conformance tests for external wallet interoperability targets.

## Phase 2: Privacy, Governance, and Operations

- [ ] Implement role-based and purpose-based authorization for all sensitive operations.
- [ ] Add minimum-necessary filtering defaults for event feeds and UI surfaces.
- [ ] Add retention schedules with automated purge and legal-hold handling.
- [ ] Add structured de-identification strategy for analytics and exported observability.
- [ ] Add data subject rights workflows (access, correction, revocation, deletion where applicable).
- [ ] Add immutable audit retention strategy with secure export and independent verification options.
- [ ] Add periodic controls testing and evidence collection (security, privacy, and governance review cadence).

## Phase 3: Assurance and External Readiness

- [ ] Threat model and penetration testing on gateway, provider APIs, and storage boundaries.
- [ ] Privacy impact assessment and security risk assessment sign-off.
- [ ] Operational tabletop exercises (incident response, key compromise, provider compromise).
- [ ] Deployment policy gates that block release when mandatory controls fail.
- [ ] Documentation package for legal/compliance review and partner onboarding.

## Acceptance Criteria For "Production Ready"

You should not mark this system production-ready until all of the following are true:

- [ ] No static shared secrets in runtime routing path.
- [ ] No browser-held long-term signing private keys for core trust assertions.
- [ ] Replay-resistant proof verification with persistent challenge registry.
- [ ] Live trust and status infrastructure (not placeholder URLs).
- [ ] IAM + authorization model validated for least privilege.
- [ ] Logging/monitoring/retention aligned to operational policy.
- [ ] Security and privacy governance sign-off completed.
