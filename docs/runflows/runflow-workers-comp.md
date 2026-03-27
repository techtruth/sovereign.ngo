# Run Flow: Workman's Comp (Mr. Whang)

## Scenario
Mr. Whang works at Iron Mile Auto Repair and is injured on the job (possible broken hand).
He visits Nolichucky Family Clinic, gets an X-ray, and then shares verifiable proof with his employer for insurance submission.

## Goal
Use the current stack so that:
1. The doctor keeps the full medical record.
2. The sovereign side stores only a signed record-link credential.
3. Employer/insurer can verify and fetch doctor-origin data directly from Harbor.

## Actors
1. Sovereign user (Mr. Whang)
2. Nolichucky Family Clinic (doctor issuer)
3. Iron Mile Auto Repair (employer issuer)
4. Insurance reviewer (external verifier role)

## Preconditions
1. Docker stack is running.
2. Mr. Whang can login with WebID.
3. Mr. Whang has identity VC in sovereign storage:
   1. `DriversLicenseCredential` (with required flags) OR
   2. `PassportCredential`
4. Mr. Whang has `SelfPresenceCredential`.

## Runbook

### 1. Login at Nolichucky Family Clinic
1. Open `http://localhost:8081`.
2. In Issuer Console API, login with WebID.
3. Confirm session DID appears as "Subject DID (from login)".

### 2. Request X-ray via action dropdown
1. Select action `X-Ray`.
2. Click `Run Action`.
3. Expected result:
   1. Identity + self-presence checks pass.
   2. Response includes:
      1. `recordStoredAtDoctorPod: true`
      2. `recordCopiedToSovereignPod: false`
      3. `recordLinkCredential` (type: `ExternalMedicalRecordLinkCredential`)

### 3. Share proof package
1. Mr. Whang shares the `recordLinkCredential` with Iron Mile (and/or insurer).
2. This is the portable proof reference for doctor-owned data.

### 4. Employer/insurer verifies link with Harbor
1. POST `recordLinkCredential` to Harbor endpoint:
   1. `POST /api/records/verify`
2. Expected:
   1. `valid: true`
   2. Record existence and proof checks are returned.

### 5. Employer/insurer fetches doctor record from Harbor
1. POST the same `recordLinkCredential` to:
   1. `POST /api/records/fetch`
2. Expected:
   1. X-ray record payload from doctor pod.
   2. Verification metadata (`recordDigest`, `recordSignature`).

### 6. Insurance packet submission
1. Employer submits:
   1. `recordLinkCredential`
   2. verification output (`/api/records/verify`)
   3. fetched doctor record (`/api/records/fetch`)
2. This demonstrates direct source-of-truth provenance from Harbor.

## Trust/ownership model
1. Harbor owns and stores full X-ray record.
2. Sovereign controls who receives the signed link credential.
3. Third parties validate and retrieve from doctor directly.

## Suggested Next Scenarios

### Scenario A: Return-to-work clearance
1. Clinic issues a signed clearance record link after follow-up.
2. Employer verifies before assigning heavy-duty tasks.

### Scenario B: Tool-related injury chain
1. Iron Mile issues internal incident credential.
2. Harbor issues X-ray link credential.
3. Insurer correlates both for claim decision.

### Scenario C: Sports injury with shared care
1. Appalachian issues incident participation record.
2. Harbor issues medical imaging link.
3. Parent/guardian grants selective sharing to coach and insurer.

## Potential ability updates by entity

### Nolichucky Family Clinic
Add:
1. "Doctor Note" action that issues a signed doctor-note record link (doctor-owned).
2. Record lifecycle states (`prelim`, `final`, `amended`).

Remove / restrict:
1. Direct raw-record disclosure without valid link credential.

### Iron Mile Auto Repair
Add:
1. "Create incident report" signed credential with timestamp and supervisor signature.
2. "Submit insurance packet" action that bundles references, not raw copied medical records.

Remove / restrict:
1. Permanent local storage of full medical records.

### Sovereign (Identity and Record Storage)
Add:
1. Share-policy controls on each link credential (who, when, expiration).
2. Audit log of which verifier fetched a doctor record.

Remove / restrict:
1. Storing full doctor-owned medical payloads by default.

### Verifiers
Add:
1. Time-bound verification receipts (proof of who checked what/when).
2. Revocation checks for link credentials.

Remove / restrict:
1. Any write capability beyond explicitly consented credential writes.

## Optional implementation ideas
1. Add a dedicated "Insurance Portal" verifier page that accepts link credentials and runs `/verify` + `/fetch` automatically.
2. Add expiring one-time access grants for doctor record fetch endpoints.
3. Add `DoctorNoteRecordLinkCredential` alongside X-ray link credentials.
