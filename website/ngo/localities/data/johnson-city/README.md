# Johnson City Data Pack

This data pack makes the Johnson City locality evidence machine-readable inside the project.

Snapshot date: `2026-03-27`

## Contents

- `data-pack-index.json`: manifest of all files in this pack.
- `sources.json`: source catalog aligned to the locality page Source Record (`S1` through `S28`).
- `metrics_snapshot_2026-03-27.json`: core metrics used by the locality briefing.
- `outreach_monthly_records_2024-01_to_2026-02.json`: normalized monthly outreach records.
- `ce_rrh_bed_pressure_view.schema.json`: schema for a de-identified bed-pressure and referral queue view.
- `ce_rrh_bed_pressure_view.sample.json`: sample payload that conforms to the schema.
- `portable_referral_packet.schema.json`: schema for a portable referral packet.
- `portable_referral_packet.sample.json`: sample de-identified referral packet.
- `policy_export_spec.json`: export requirements for PIT, HMIS, and ESG evidence bundles.
- `insights_and_interventions.md`: source-backed intervention backlog (software and non-software).
- `export-templates/*.csv`: policy-ready CSV templates.

## Notes

- Client-level personally identifying fields are intentionally excluded.
- Source IDs map directly to `website/ngo/localities/johnson-city-tennessee.html` Source Record IDs.
- Derived fields in this pack are documented with `source_ids`.
