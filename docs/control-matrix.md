# Control Matrix (Demo Baseline)

Date of this snapshot: **April 6, 2026**.

This matrix links key controls to implementation evidence and identifies what still needs to be hardened for production.

| Control Area | Current Demo Status | Evidence Anchor(s) | Gap To Production |
|---|---|---|---|
| Root access gate | Implemented | `demo_webapp/functions/[[path]].js`, `demo_webapp/_routes.json` | Auth covers only `/` and `/index.html`; no production IAM or MFA |
| Exchange signing and verification | Implemented in container mode | `demo_webapp/services/provider/index.html`, `containerization/provider-api-server.js` | Needs persistent trust/key lifecycle and formal verifier policy management |
| VC data model shape (W3C VC v2 + status entry metadata) | Implemented | `demo_webapp/lib/demo-store.js` | Needs live dereference status infrastructure and ecosystem trust integration |
| Consent grant/revoke flow | Implemented | `demo_webapp/services/credential-manager/index.html`, `demo_webapp/lib/demo-store.js` | Needs policy-grade purpose binding, retention, and governance controls |
| Referral lifecycle controls | Implemented | `demo_webapp/services/provider/index.html`, `demo_webapp/lib/demo-store.js` | Needs policy enforcement for role, purpose, and stronger org-level authorization |
| Record access pass model | Implemented | `demo_webapp/services/provider/index.html`, `demo_webapp/lib/demo-store.js` | Needs production-grade token/access governance and service-side validation controls |
| Provider API audit trail | Implemented (hash-chained rows) | `containerization/provider-api-server.js` | Needs retention policy, external integrity verification, and compliance operations integration |
| Transport security in container topology | Implemented (dev TLS) | `containerization/sovereign-gateway.nginx.conf`, `containerization/solid-pod-tls-proxy.js` | Needs production certificates/PKI, secret hygiene, and hardened deployment practices |
| Replay resistance | Partial | `containerization/provider-api-server.js` | Add persistent nonce/jti replay store and challenge lifecycle enforcement |
| Shared secret management | Demo-only | `containerization/docker-compose.yml`, `containerization/sovereign-gateway.nginx.conf` | Replace static shared secret and gateway header injection with service identity and rotation |
| Key custody | Demo-only | `demo_webapp/services/provider/index.html` | Remove browser-stored signing private keys for operational trust assertions |
| Data minimization in UI | Partial | `demo_webapp/services/provider/index.html`, `demo_webapp/services/verifier/index.html`, `demo_webapp/services/credential-manager/index.html` | Reduce direct identifiers in operational views by default and introduce role-sensitive redaction |
| Non-identifiable export for accountability | Implemented | `demo_webapp/individual/index.html` | Needs policy alignment, evidence retention strategy, and auditing governance for production |
| Cloudflare function responsibility boundary | Implemented | `demo_webapp/functions/[[path]].js` | Keep boundary strict and avoid control sprawl into edge functions without governance design |

## Notes

- “Implemented” here means implemented for demonstration behavior, not automatically compliant for regulated production use.
- The authoritative production transition path remains:
  - `docs/compliance-baseline.md`
  - `docs/production-hardening-checklist.md`
  - `docs/implementation-roadmap.md`
