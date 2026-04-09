# Transaction Classes

Date of this snapshot: **April 7, 2026**.

This document defines the six transaction classes used across the Individual Demo.

The goal is to make it clear which interactions are simple, which require shared state, and which require stronger trust controls.

## 1) Direct Service Action

Definition:
- A single provider serves a sovereign directly.
- No cross-provider data exchange is required.

Core abilities:
- Intake, check-in, request support, and record internal service updates.
- Issue service records and credentials that remain anchored to provider source-of-record.

Common use cases:
- Clinic check-in and visit summary.
- Shelter intake and case updates.
- Legal aid intake.

Example:
- The sovereign logs into one provider portal, runs a self or staff action, and the provider records that action locally with an auditable event.

## 2) Sovereign-Mediated Record Sharing

Definition:
- A source provider issues a record access packet.
- Sovereign data stores the record reference and decryption material needed for authorized reuse.
- A receiving provider can use sovereign-presented material to process the shared record.

Core abilities:
- Minimum-necessary sharing by reference instead of bulk account linking.
- Scoped access term support: one-time, time-bound, indefinite.
- Portable sharing that follows the person across providers.

Common use cases:
- Imaging second opinion (x-ray from one provider to another).
- Emergency to follow-up continuity.
- Medical-necessity documentation for utility accommodation.

Example:
- A clinic issues a record sharing packet, the sovereign keeps it in sovereign data, and later presents it to another provider for authorized access.

## 3) Cross-Org Workflow Handoff

Definition:
- One provider creates a referral or handoff that another provider fulfills.
- This is lifecycle coordination, not just document viewing.

Core abilities:
- Explicit issued and fulfilled states.
- Target-capability routing (for example pharmacy, housing, home health).
- Traceable responsibility across organizations.

Common use cases:
- Clinic to pharmacy.
- Ambulance to emergency department.
- Shelter to housing navigation.

Example:
- A provider issues a referral credential for a target capability and another provider fulfills it, producing a fulfillment record and event trail.

## 4) Shared-State Coordination

Definition:
- Transactions where multiple fulfillers must agree on current state before execution.
- Used when rights are scarce, one-time, or exhaustible.

Core abilities:
- Prevent double-use and replay of rights.
- Provide authoritative status for eligibility and fulfillment.
- Synchronize mutable state across independent organizations.

Common use cases:
- Prescription fill rights and refill consumption.
- One-time benefit voucher usage.
- Eligibility and claim-state checks.

Example:
- A pharmacy can verify a prescription right is still available before dispense, then mark usage so the same right cannot be consumed again elsewhere.

## 5) Credential Trust Lifecycle

Definition:
- End-to-end credential behavior from issuance to verification and status change.

Core abilities:
- Issue VC-shaped credentials.
- Verify issuer, subject, and status-list state.
- Revoke credentials and reflect trust-state change.

Common use cases:
- Identity and proof document credentials.
- Provider-issued service credentials.
- Fulfillment and access credentials used in downstream workflows.

Example:
- A provider requires specific credential categories before an action can proceed, then checks active status before accepting the credential.

## 6) Consent and Audit Governance

Definition:
- Policy and accountability layer over all transaction classes.

Core abilities:
- Explicit grant and revoke behavior.
- Non-identifiable audit export for transparency without raw-document disclosure.
- Hash-linked evidence patterns in container mode.

Common use cases:
- Demonstrating minimum-necessary sharing controls.
- Showing who performed each action and when.
- Producing reviewable accountability logs for stakeholders.

Example:
- The sovereign grants consent for a scoped action, a provider performs the transaction, and the event appears in auditable logs without exposing full personal record payloads.

## How To Use These Classes In Design

Recommended sequence:
1. Start with direct service action.
2. Add sovereign-mediated record sharing where continuity needs cross-provider context.
3. Add workflow handoff for referral-style coordination.
4. Add shared-state coordination only where replay or double-use risk exists.
5. Apply credential trust checks for all externally presented proofs.
6. Keep consent and audit governance active across every class.

Design note:
- Most community workflows are handled by classes 1, 2, 3, 5, and 6.
- Class 4 is the special case for scarce or mutable rights.
