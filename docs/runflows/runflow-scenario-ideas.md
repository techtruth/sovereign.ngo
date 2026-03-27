# Scenario Ideas (High-Value, Cross-Entity)

## 1) Employee Season Ticket Redemption (Implemented)
Summary:
1. National Metal Works issues employee + season-ticket entitlement credentials.
2. Appalachian redeems and issues game entry credential.

Entity ability updates:
1. National Metal Works: `issue_employee_status`, `issue_season_ticket_entitlement`.
2. Appalachian: `redeem_employee_season_ticket` with sovereign-wallet verification.

## 2) Work Injury Claim Package (Implemented core)
Summary:
1. Harbor issues X-ray reference credential while keeping full record in doctor pod.
2. Employer/insurer verifies and fetches doctor-owned record via link credential.

Entity ability updates:
1. Harbor: doctor-owned record + `/api/records/verify` and `/api/records/fetch`.
2. Sovereign: stores/share link credential instead of copying full medical data.

## 3) Return-to-Work Clearance
Summary:
1. After treatment, Harbor issues a signed clearance record link.
2. Iron Mile verifies status before assigning duty level.

Add:
1. Harbor action: `issue_return_to_work_clearance`.
2. Iron Mile action: `verify_return_to_work_clearance`.

Remove/restrict:
1. Iron Mile should not accept unsigned PDF-only clearance uploads.

## 4) Restricted Facility Access (ITAR + Presence)
Summary:
1. User presents ITAR compliance + self-presence credentials.
2. National Metal Works issues a time-bounded facility access credential.

Add:
1. National Metal Works action: `issue_facility_access_badge`.
2. Verifier policy: ITAR + presence + date-window checks.

Remove/restrict:
1. No access issuance when ITAR status is stale or missing.

## 5) Coach/Volunteer Child-Safety Gate
Summary:
1. Appalachian verifies identity + required safety credential.
2. Appalachian issues coach sideline credential with schedule scope.

Add:
1. Appalachian action: `issue_coach_sideline_access`.
2. Verifier check: role + event schedule + expiry.

Remove/restrict:
1. Reuse of last season credential for current season events.

## 6) Vehicle Service + Insurance Evidence Chain
Summary:
1. Iron Mile issues service/inspection credential after repair.
2. Customer shares credential with insurer for premium/claim support.

Add:
1. Iron Mile action: `issue_post_repair_safety_packet`.
2. Verifier endpoint for inspection validity and signature checks.

Remove/restrict:
1. Manual attestation without signed service credential.

## 7) Utility Address Validation for Employer Benefits
Summary:
1. Utility verifier issues address VC.
2. National Metal Works accepts it for payroll tax/geofence benefit logic.

Add:
1. National Metal Works action: `validate_employee_address_for_benefits`.
2. Verification rule: utility VC recency threshold.

Remove/restrict:
1. Address changes from unsigned self-declaration only.

## 8) Delegated Record Sharing With Expiring Grants
Summary:
1. Sovereign shares a record link credential with an expiry and audience.
2. Third party can fetch only within grant window.

Add:
1. Sovereign policy object for audience/time-bound grant metadata.
2. Doctor fetch endpoint to enforce grant expiration/audience.

Remove/restrict:
1. Perpetual broad access from one-time sharing.

---

## Best next implementation picks
1. Return-to-work clearance flow (extends current doctor record-link model directly).
2. Facility access badge flow (combines ITAR + self-presence in a practical way).
3. Expiring delegated grants (big security/value upgrade for real sharing behavior).
