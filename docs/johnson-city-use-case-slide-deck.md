# Johnson City Bed-Pressure Use-Case Deck (Link-Cited)

Data pack: `jc-locality-data-pack` v`1.0.1`  
Snapshot date: **2026-03-27**

## Use Case (Bed-Focused)

Stand up a **de-identified bed-pressure and bed-access coordination layer** that helps teams move people from intake/referral stages toward available housing pathways faster, with monthly governance-ready reporting.

## Key Terms (Plain Language)

- `ES/TH beds` = emergency shelter + transitional housing bed capacity.
- `CE` = Coordinated Entry (intake/prioritization queue).
- `RRH` = Rapid Re-Housing (one housing pathway, not the only CE outcome).

## Evidence Rule For This Deck

- Every claim shows a number and a direct source link.
- No source IDs in slide body; links only.
- Where data is modeled/sample, that is explicitly labeled.

## Integration Principle (Not Replacement)

- Existing software stays in place as system-of-record.
- We treat current systems as data sources (API/webhook events, status updates, scheduled exports, audit logs).
- The pilot layer listens, normalizes de-identified metrics, and publishes operating views.
- This is integration and orchestration, not rip-and-replace.

---

## Evidence Chain (Direct Links)

| Decision question | Data point | Value | Direct evidence link | Decision implication |
|---|---:|---:|---|---|
| Is there bed pressure now? | Unsheltered vs ES/TH beds | 538 vs 407 (shortfall 131; +32.2% above bed count) | [ARCH FY24-25 CoC Gap Analysis](https://archcoc.org/s/FY24-25-CoC-Gap-Analysis-Final-4lby.pdf#page=1) | Bed-access coordination is immediately relevant. |
| Is there throughput pressure in the same frame? | CE enrolled vs literally homeless rapidly rehoused | 1,737 vs 55 (31.6:1; 3.17%) | [ARCH FY24-25 CoC Gap Analysis](https://archcoc.org/s/FY24-25-CoC-Gap-Analysis-Final-4lby.pdf#page=1) | Strong pressure signal; stage-level bottleneck location still needs measurement. |
| Is demand sustained over time? | Outreach monthly records | 26 months (2024-01 to 2026-02), contacts 129-351, meetings 6-52 | [ArcGIS monthly query](https://services2.arcgis.com/sFeLdas1ukfB6i8T/arcgis/rest/services/HomelessOutreachMonthlyReport_public/FeatureServer/0/query?where=1%3D1&outFields=month,meetings,contacts&f=pjson) | Justifies a recurring monthly review cycle. |
| Is governance channel ready now? | CoC agenda topics | Funding, HMIS fees, ESG allocation, PIT after-action | [CoC agenda 2026-02-10](https://archcoc.org/s/CoC-Meeting-Agenda-20260210.pdf#page=1) | Existing forum can absorb monthly bed/flow metrics. |
| Is partner capacity for rollout visible? | Training attendance snapshot | 59 attendees; avg attendance 1h 27m 13s | [Training attendance CSV](https://archcoc.org/s/December-CoC-Meeting-Human-Trafficking-Training-Attendance-report-12-09-25.csv) | Supports phased onboarding assumptions. |
| Are public de-identified monitoring fields available? | Outreach record count + metadata | 232 records; schema endpoints published | [Record count query](https://services2.arcgis.com/sFeLdas1ukfB6i8T/arcgis/rest/services/Homeless_Outreach_public/FeatureServer/0/query?where=1%3D1&returnCountOnly=true&f=pjson), [Outreach schema](https://services2.arcgis.com/sFeLdas1ukfB6i8T/arcgis/rest/services/Homeless_Outreach_public/FeatureServer/0?f=pjson), [Monthly schema](https://services2.arcgis.com/sFeLdas1ukfB6i8T/arcgis/rest/services/HomelessOutreachMonthlyReport_public/FeatureServer/0?f=pjson) | Data structure exists for integration outputs. |

---

## 10-Slide Bed-Centered Structure

## 1) Decision Frame

**Question:** Should we run a 90-day bed-access coordination pilot now?

**Show:** snapshot date, coverage window, source-link list.

## 2) Bed Pressure Baseline

**Question:** Is bed mismatch material?

**Show:**
- Unsheltered: **538**
- ES/TH beds: **407**
- Shortfall: **131**
- Relative pressure: **+32.2%**

**Link:** [ARCH FY24-25 CoC Gap Analysis](https://archcoc.org/s/FY24-25-CoC-Gap-Analysis-Final-4lby.pdf#page=1)

## 3) Broader Context For Bed Pressure

**Question:** Is this a short-term anomaly or persistent regional strain?

**Show:**
- Regional PIT trend total: **405 (2019) -> 943 (2025)**
- Johnson City 2025 PIT: **243 total**, **94 unsheltered**, **149 sheltered**

**Links:**
- [ARCH PIT trend 2019-2025](https://archcoc.org/s/PIT-Count-Trends-2019-through-2025.pdf#page=2)
- [ARCH 2025 PIT Johnson City](https://archcoc.org/s/ARCH-CoC-2025-PIT-Count-Final-Johnson-City.pdf#page=1)

## 4) Field Demand Persistence

**Question:** Is operational demand sustained month-to-month?

**Show:**
- 26 monthly records
- Contacts range: **129-351/month**
- Meetings range: **6-52/month**
- 2024: **2,762 contacts / 381 meetings**
- 2025: **2,678 contacts / 288 meetings**

**Link:** [ArcGIS monthly query](https://services2.arcgis.com/sFeLdas1ukfB6i8T/arcgis/rest/services/HomelessOutreachMonthlyReport_public/FeatureServer/0/query?where=1%3D1&outFields=month,meetings,contacts&f=pjson)

## 5) Throughput Pressure Signal (With Correct Caveat)

**Question:** Is there a likely flow mismatch in the same reporting frame?

**Show:**
- CE: **1,737**
- Rapidly rehoused: **55**
- Ratio forms: **31.6:1** and **3.17%**
- Plain language: ~**1 RRH per 32 CE enrollments** (same frame)

**Important caveat on slide:** CE does not only route to RRH; this is a pressure signal, not a full pathway conversion model.

**Link:** [ARCH FY24-25 CoC Gap Analysis](https://archcoc.org/s/FY24-25-CoC-Gap-Analysis-Final-4lby.pdf#page=1)

## 6) Integration Architecture (Existing Systems Stay)

**Question:** Can this be done without replacing current tools?

**Show:**
- Source systems continue to operate (HMIS/workflow records, outreach systems, governance artifacts).
- Pilot listens for hooks/events/exports from existing software.
- Outputs are de-identified operating metrics and monthly exports.

**Links:**
- [HMIS Policies and Procedures](https://archcoc.org/s/ARCH-CoC-HMIS-PP-Integrating-HMIS-Charter-Approved-20210318.pdf#page=21)
- [HMIS Written Instructions](https://archcoc.org/s/HMIS-Written-Intstructions-as-of-250528.pdf#page=3)
- [Coordinated Entry referral workflow guide](https://archcoc.org/s/ARCH-CoC-Coordinated-Entry-Referral-in-HMIS-with-Images.pdf#page=1)

## 7) Bed Use-Case Event Model (What We Capture)

**Question:** What data events are required for this pilot?

**Show event types:**
- Bed inventory update event (available/reserved/fill state)
- Referral created/sent/accepted/declined event
- Time-to-next-stage event stamps
- Document-readiness state change (available/pending/missing)
- Consent state change and revocation event

**Implementation note:** Events are emitted by existing systems; pilot normalizes and aggregates de-identified outputs.

## 8) KPI Set For Bed-Access Pilot

**Question:** Which KPIs prove value for this use case?

**KPIs:**
- Bed pressure: unsheltered-to-bed gap trend
- Throughput: median days CE->referral, referral->acceptance, acceptance->housing
- Queue health: pending referral count, acceptance rate, housed count
- Handoff quality: repeat document-request rate, consent-state mismatch rate
- Reporting reliability: on-time monthly export completion

## 9) Data Integrity And Confidence

**Hard evidence:**
- Bed/queue pressure values from snapshot and linked public records.
- Outreach time series from public ArcGIS query.

**Modeled/not baseline historical fact:**
- Sample queue-stage counts and transition-day examples in `ce_rrh_bed_pressure_view.sample.json`.

**Decision implication:** Use sample payloads for implementation design, then lock operational baselines during mirror period.

## 10) Decision Ask

- Approve 90-day **bed-access coordination** pilot.
- Approve connector-based integration with existing systems (no replacement mandate).
- Approve monthly governance review using direct-link evidence outputs.
- Approve first 30 days as mirror/baseline period before target commitments.

---

## Verbatim Positioning Line

"Any system already in place can remain the source-of-record and be treated as a data source. We listen for hooks, events, status updates, and exports from existing software, then normalize de-identified bed and flow metrics. This is integration, not replacement."

## Chart Set (Bed Use Case)

1. Unsheltered vs ES/TH beds bar chart with shortfall annotation.
2. CE vs rapidly rehoused ratio panel (31.6:1 and 3.17%, with caveat text).
3. Monthly outreach trend (contacts and meetings).
4. Bed-access KPI dashboard mock (gap trend + stage-time medians).

## Link Appendix

- https://archcoc.org/s/FY24-25-CoC-Gap-Analysis-Final-4lby.pdf#page=1
- https://archcoc.org/s/PIT-Count-Trends-2019-through-2025.pdf#page=2
- https://archcoc.org/s/ARCH-CoC-2025-PIT-Count-Final-Johnson-City.pdf#page=1
- https://services2.arcgis.com/sFeLdas1ukfB6i8T/arcgis/rest/services/HomelessOutreachMonthlyReport_public/FeatureServer/0/query?where=1%3D1&outFields=month,meetings,contacts&f=pjson
- https://services2.arcgis.com/sFeLdas1ukfB6i8T/arcgis/rest/services/Homeless_Outreach_public/FeatureServer/0/query?where=1%3D1&returnCountOnly=true&f=pjson
- https://services2.arcgis.com/sFeLdas1ukfB6i8T/arcgis/rest/services/Homeless_Outreach_public/FeatureServer/0?f=pjson
- https://services2.arcgis.com/sFeLdas1ukfB6i8T/arcgis/rest/services/HomelessOutreachMonthlyReport_public/FeatureServer/0?f=pjson
- https://archcoc.org/s/ARCH-CoC-HMIS-PP-Integrating-HMIS-Charter-Approved-20210318.pdf#page=21
- https://archcoc.org/s/HMIS-Written-Intstructions-as-of-250528.pdf#page=3
- https://archcoc.org/s/ARCH-CoC-Coordinated-Entry-Referral-in-HMIS-with-Images.pdf#page=1
- https://archcoc.org/s/CoC-Meeting-Agenda-20260210.pdf#page=1
- https://archcoc.org/s/December-CoC-Meeting-Human-Trafficking-Training-Attendance-report-12-09-25.csv
