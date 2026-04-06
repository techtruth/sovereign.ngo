# Sovereign Individual Demo

## Purpose

This repository centers on one primary experience: the **Individual Demo** at `demo_webapp/individual/`.

It demonstrates a sovereign data model where:

- each provider remains the source of truth for its own records,
- the resident controls consent and sharing,
- cross-provider coordination happens through explicit, auditable handoffs.

## What The Individual Demo Does Today

- Runs guided tutorial chains across common service pathways (health, housing, legal, workforce, identity documents, and related handoffs).
- Highlights the exact next control to click and advances only when the expected action is completed.
- Models resident login, service actions, referral issuance, and referral fulfillment.
- Enforces credential requirements for selected transactions.
- Demonstrates Record Access Pass behavior:
  - a source provider can issue access for a specific source record,
  - long-term passes can be saved by another provider in its provider-pod context for future reuse.

## Supporting Surfaces Behind The Individual Demo

The following pages support the Individual experience and are not intended as separate top-level demo products:

- `demo_webapp/services/provider/`
- `demo_webapp/services/verifier/`
- `demo_webapp/services/credential-manager/`
- `demo_webapp/services/solid-pod/`

## How The Demo Works

- State is shared through `demo_webapp/lib/demo-store.js`, so all supporting views stay in sync.
- Static local mode uses browser storage.
- Container mode can switch to a Solid Pod backend for shared persistence.

## Container Topology

`containerization/docker-compose.yml` models a multi-provider deployment with:

- per-provider web portal container,
- per-provider API container,
- per-provider Solid pod container,
- sovereign holder pod and gateway.

This keeps provider boundaries explicit while reusing modular code paths.

## Current Boundaries

This is a policy and interoperability demonstration, not a production system.

It is not:

- production security/compliance implementation,
- a full EHR/HMIS/claims platform,
- real clinical or legal decision automation.

## Near-Term Direction

1. Strengthen provider API contracts and service boundaries.
2. Expand consent policy simulation (purpose, duration, revocation behavior).
3. Add more end-to-end workflow templates mapped to common city pressure points.
4. Keep backend adapters swappable so production infrastructure can replace demo storage/services with minimal UI change.
5. Improve non-identifying observability and audit reporting.

## Run The Individual Demo

### Static Local Mode

Open `demo_webapp/individual/index.html` directly (`file://`).

### Container Mode

From repo root:

```bash
docker compose -f containerization/docker-compose.yml up --build
```

Then open:

- `http://localhost:8180/demo_webapp/individual/`

## Repository Anchors

- Demo app: `demo_webapp/`
- Container orchestration: `containerization/`
- Public website: `website/`
- Demo docs: `docs/`
