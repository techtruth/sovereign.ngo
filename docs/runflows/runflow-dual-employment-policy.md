# Run Flow: Dual Employment Policy (Iron Mile vs National Metal Works)

## Scenario
Mr. Whang applies for employment at both:
1. Iron Mile Auto Repair
2. National Metal Works

Policy difference:
1. Iron Mile requires identity (`DriversLicenseCredential` OR `PassportCredential`).
2. National Metal Works requires identity plus `ITARComplianceCredential`.

Both employers also support terminating employment when needed.

## Preconditions
1. Docker stack running.
2. Sovereign WebID available.
3. Identity credentials present for Mr. Whang.
4. ITAR credential present only when applying to National Metal Works.

## Actions implemented
1. `apply_for_employment` on:
   1. Iron Mile (`http://localhost:8082`)
   2. National Metal Works (`http://localhost:8084`)
2. `terminate_employment` on both issuers.

## Expected outcomes
1. Iron Mile apply:
   1. Approves if identity exists.
   2. Issues `EmploymentOfferCredential` on success.
   3. Issues `EmploymentDeniedCredential` if missing policy requirements.
2. National Metal Works apply:
   1. Approves only if identity + ITAR exist.
   2. Same offer/deny credential pattern.
3. Terminate employment:
   1. Always available to logged-in subject.
   2. Issues `EmploymentTerminationCredential`.

## Manual runbook

### 1. Iron Mile application
1. Open `http://localhost:8082`.
2. Login with sovereign WebID.
3. Select `Apply For Employment`.
4. Click `Run Action`.
5. Verify response decision and issued credential type.

### 2. National Metal Works application
1. Open `http://localhost:8084`.
2. Login with same WebID.
3. Select `Apply For Employment`.
4. Click `Run Action`.
5. Verify policy check includes ITAR and decision is correct.

### 3. Termination flow
1. On either issuer page, select `Terminate Employment`.
2. Optional payload: `{"reason":"voluntary-separation"}`
3. Click `Run Action`.
4. Verify `EmploymentTerminationCredential` is returned.

## Notes
1. Employment state is demo in-memory state per issuer service.
2. Credentials are signed mock VCs for flow validation.
