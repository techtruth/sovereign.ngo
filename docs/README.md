# Sovereign Individual Demo

## Purpose

This repository centers on one primary experience: the **Individual Demo** at `demo_webapp/individual/`.

It demonstrates a sovereign data model where:

- each provider remains the source of truth for its own records,
- the resident controls consent and sharing,
- cross-provider coordination happens through explicit, auditable handoffs.

## Documentation Map

- `docs/README.md` (this file): high-level architecture and run guidance.
- `docs/executive-summary.md`: first-principles, non-technical explanation of what the demo proves and why it matters.
- `docs/standards-profile.md`: standards adopted now vs standards intentionally out of scope in demo mode.
- `docs/compliance-baseline.md`: demo-safe compliance baseline and production hardening requirements.
- `docs/production-hardening-checklist.md`: actionable implementation checklist before any real-world data use.
- `docs/control-matrix.md`: control-by-control evidence matrix mapped to concrete implementation anchors.
- `docs/transaction-classes.md`: the six transaction classes used in the demo, with abilities, use cases, and examples.
- `docs/implementation-roadmap.md`: phased path from current demo posture to production readiness.

## What The Individual Demo Does Today

- Runs guided tutorial chains across common service pathways (health, housing, legal, workforce, identity documents, and related handoffs).
- Highlights the exact next control to click and advances only when the expected action is completed.
- Models resident login, service actions, referral issuance, and referral fulfillment.
- Enforces credential requirements for selected transactions.
- Stores and exchanges credentials in W3C VC JSON-LD shape across issuer, provider, and audit flows.
- Organizes workflows into six repeatable transaction classes:
  - direct service action,
  - sovereign-mediated record sharing,
  - cross-org workflow handoff,
  - shared-state coordination,
  - credential trust lifecycle,
  - consent and audit governance.
- Demonstrates record access pass behavior:
  - a source provider can issue access for a specific source record,
  - long-term passes can be saved by another provider in its provider-pod context for future reuse.

## Supporting Surfaces Behind The Individual Demo

The following pages support the Individual experience and are not intended as separate top-level demo products:

- `demo_webapp/services/provider/`
- `demo_webapp/services/verifier/`
- `demo_webapp/services/credential-manager/`
- `demo_webapp/services/solid-pod/`

## Runtime Modes

- **Static local mode**: session-scoped browser storage (`sessionStorage` + broadcast sync).
- **Container mode**: same UI, with configurable Solid Pod-backed persistence.

Shared demo state logic lives in `demo_webapp/lib/demo-store.js`.

## Cloudflare Function Scope

Cloudflare Functions in `demo_webapp/functions/[[path]].js` are intentionally limited to one purpose:

- Basic auth challenge on `/` and `/index.html` only.
- No standards API, issuance, verification, or status-list logic runs in Cloudflare Functions.

## Container Topology

`containerization/docker-compose.yml` models a multi-provider deployment with:

- provider-scoped web portal routes under `/provider-sites/{providerId}/...`,
- per-provider API container,
- per-provider Solid pod container,
- sovereign holder pod and gateway.

Provider pod/API hops are wrapped in TLS and upstream certificates are verified at the gateway.

## Compliance And Security Posture (Demo)

This is a policy and interoperability demonstration, not a production system.

It is not:

- production security/compliance implementation,
- a full EHR/HMIS/claims platform,
- real clinical or legal decision automation.

For exact details, see:

- `docs/standards-profile.md`
- `docs/compliance-baseline.md`
- `docs/production-hardening-checklist.md`

## Current Limits

- Provider API submission routes require bearer authorization and signed `vp_token` payloads.
- Core service-portal exchange events are still demo-oriented operational traffic and not a full production wallet or trust framework.
- Status-list URLs in demo credentials are identifier-style references used for policy demonstration, not live public dereference endpoints in the static website deployment.

## Run The Individual Demo

### Static Local Mode

Open `demo_webapp/individual/index.html` directly (`file://`).

### Container Mode

From repo root:

```bash
docker compose -f containerization/docker-compose.yml up --build
```

Then open:

- `https://localhost:8180/demo_webapp/individual/`

Notes:

- Container mode uses a self-signed dev certificate in `containerization/certs/`, so your browser will show a local certificate warning until trusted.
- Provider API containers require `PROVIDER_API_SHARED_SECRET`; the compose file currently sets this for all provider API services and the gateway injects service authorization headers server-side.

## Near-Term Direction

1. Strengthen provider API contracts and service boundaries.
2. Expand consent policy simulation (purpose, duration, revocation behavior).
3. Add more end-to-end workflow templates mapped to common city pressure points.
4. Keep backend adapters swappable so production infrastructure can replace demo storage/services with minimal UI change.
5. Improve non-identifying observability and audit reporting.

## Repository Anchors

- Demo app: `demo_webapp/`
- Container orchestration: `containerization/`
- Public website: `website/`
- Demo docs: `docs/`
