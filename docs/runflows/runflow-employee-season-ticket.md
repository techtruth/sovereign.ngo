# Run Flow: Employee Season Ticket (National Metal Works -> Riverbend Sports Park)

## Scenario
National Metal Works wants to provide a baseball season-ticket benefit to employees.
Mr. Whang is an employee and wants to use that benefit at Riverbend Sports Park.

## Goal
1. National Metal Works issues employee and benefit credentials.
2. Mr. Whang stores them in Personal Identity and Record Storage.
3. Riverbend verifies entitlement and issues gate-ready access proof.

## Actors
1. Employee (Mr. Whang)
2. National Metal Works (benefit issuer)
3. Riverbend Sports Park (benefit redeemer / access issuer)
4. Gate verifier (event entry check)

## Proposed credentials
1. `EmployeeStatusCredential` (issuer: National Metal Works)
   1. `employmentStatus`: active
   2. `employeeId`: internal ID
   3. `department`: optional
2. `SeasonTicketEntitlementCredential` (issuer: National Metal Works)
   1. `benefitType`: riverbend-baseball-season
   2. `seasonYear`: 2026
   3. `validFrom` / `validUntil`
   4. `ticketClass`: example `general` or `premium`
3. `GameEntryCredential` (issuer: Riverbend Sports Park)
   1. `eventId`
   2. `entryWindow`
   3. `holderDid`
   4. `ticketClass`

## Preconditions
1. Docker stack is running.
2. Mr. Whang can login with sovereign WebID.
3. Baseline identity checks are available in the environment.

## Runbook

### 1. Employee login and identity context
1. Mr. Whang logs in with sovereign WebID.
2. Session DID is derived from login and used for issued credentials.

### 2. National Metal Works issues employee status
1. Open `http://localhost:8084`.
2. Login with WebID in Issuer Console API.
3. Select action for employee status issuance (new action to add).
4. Run action.
5. Expected output includes signed `EmployeeStatusCredential`.

### 3. National Metal Works issues season-ticket entitlement
1. Still on National Metal Works page, select season-ticket entitlement action (new action to add).
2. Include payload fields if needed:
   1. `benefitType`: `riverbend-baseball-season`
   2. `seasonYear`: `2026`
   3. `ticketClass`: `general`
3. Run action.
4. Expected output includes signed `SeasonTicketEntitlementCredential`.

### 4. Store credentials in sovereign record storage
1. Save both credentials to sovereign storage using the existing wallet write flow.
2. Confirm credentials are visible in Personal Identity and Record Storage (`http://localhost:8180`).

### 5. Redeem at Riverbend Sports Park
1. Open `http://localhost:8083`.
2. Login with same WebID.
3. Select action `Redeem Employee Season Ticket` (new action to add).
4. Riverbend verifies:
   1. issuer is National Metal Works
   2. entitlement is active and in valid date range
   3. ticket class and season values are acceptable
5. If valid, Riverbend issues signed `GameEntryCredential`.

### 6. Gate check
1. Present Riverbend-issued `GameEntryCredential`.
2. Gate verifier validates:
   1. Riverbend signature/proof
   2. entry window and event ID
   3. optional anti-replay check
3. Entry granted.

## Trust model
1. National Metal Works is source of employee-benefit eligibility.
2. Riverbend is source of event-entry authority.
3. Sovereign storage is user-controlled sharing and consent layer.

## Suggested ability updates

### National Metal Works
Add:
1. `Issue Employee Status` action.
2. `Issue Season Ticket Entitlement` action.
3. Optional revocation list endpoint for inactive employees.

Remove / restrict:
1. Issuing venue entry credentials directly (that should belong to Riverbend).

### Riverbend Sports Park
Add:
1. `Redeem Employee Season Ticket` action.
2. Verification logic for National Metal Works credentials.
3. `GameEntryCredential` issuance action with event-scoped validity.

Remove / restrict:
1. Accepting unsigned/manual entitlement claims.

### Sovereign (Identity and Record Storage)
Add:
1. Credential sharing presets (Employer Benefit, Event Entry, Insurance).
2. Expiration reminders for season entitlements.

Remove / restrict:
1. Unnecessary duplication of event-specific credentials when expired.

### Verifiers / Gate system
Add:
1. Fast verifier endpoint for `GameEntryCredential` checks.
2. Revocation and replay protection checks.

Remove / restrict:
1. Any access decision based only on unsigned payload data.

## Optional implementation ideas
1. Add a dedicated Riverbend endpoint: `POST /api/redeem-season-ticket`.
2. Add National Metal Works endpoint: `GET /api/benefits/revocations`.
3. Add a QR payload format for gate scanning that references `GameEntryCredential`.
