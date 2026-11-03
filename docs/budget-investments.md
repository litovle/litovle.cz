# Citizen investment comparison

The main view is `/rozpocet/`. The previous dashboard is preserved at
`/rozpocet/podklady/`. Old `place` and `month` parameters select the same scope;
old links with `mode=all` or `q` open the supporting dashboard with their query
and fragment preserved. `unit=total` selects absolute amounts; per resident is
the default. Comparison fixtures live only in `tests/fixtures/` and are excluded
from the built site.

## Current source gap

Checked against the city's [2026 budget documents](https://www.litovel.eu/cs/mesto/finance-a-investice/rozpocet-mesta/rozpocet-mesta-rok-2026.html).
The approved annual summary groups expenditure by ODPA but does not provide
the opening investment rows with POL and ORJ needed for locality comparisons.
The binding indicators' combined local-parts allocation mixes expenditure
types and is not a substitute. The linked budget portal could not be read
(404/502); no verified complete population snapshot for the 11 ORJ localities
has been obtained. This is a gap in our acquired data, not a claim that the
city does not hold the records.

`2026-investments.json` therefore explicitly contains null opening, population
and reconciliation snapshots. The public page explains that comparison is
unavailable and links to existing documents. It shows no estimated figures,
rankings or changes masquerading as totals. See the adjacent draft request;
it has not been sent.

## Supplying the official snapshots

Keep `schema_version: 1` and `year: 2026`, set `status` to `ready`, and set
`scope` to `city_and_funds_capital_excluding_internal_transfers`. The annual
snapshot is maintained separately from the existing amendment exporter, which
continues generating `2026.json` and its audit ledger without overwriting it.

Every `source` object has `title`, official `url`, an archived `copy` under
`/assets/rozpocet/<filename>` and its lowercase SHA-256 in `sha256`. Archive
the exact source files; the publication checker verifies their hashes.

- `opening`: `approved_date` (no later than 1 January), `complete: true`,
  `source`, `included_document_ids`, `rows`, and `control`.
- Each opening row: unique `id`, integer `amount_minor` in haléře,
  `verified: true`, original `description`, `source_page` when applicable,
  and named `codes` including POL and ODPA and any ORJ, ORG, UZ and other
  accounting dimensions. Only investment rows (POL class 6) belong here.
  Include all city and fund investment rows, including investment contributions;
  exclude own-account transfers. Missing locality codes stay unassigned.
- `included_document_ids` explicitly lists amendments already incorporated in
  the opening schedule. It must be reviewed even when empty. Same-day amendments
  are not assumed incorporated. Amendments before the schedule's approval must
  be listed; amendments approved after 1 January cannot be included in opening.
- `opening.control`: independently read `total_minor`, `by_place`, and `source`.
  `by_place` must explicitly cover ORJ 301–311 and `unassigned`, including
  verified zeros. Its values must match all opening rows. Never populate zeros
  merely because a source omits a locality.
- `population`: `date`, `definition`, `source`, and `by_place` for every ORJ
  301–311. Use one official reference date and population definition, preferably
  1 January 2026, never later. Keep that denominator fixed throughout 2026.
  Do not mix census boundaries, cadastral areas or combined Litovel/Chořelice
  counts with separately coded localities. Every count must be positive.
- `reconciliation`: `date`, `total_minor`, `by_place`, and `source`, from an
  independent official revised-budget snapshot on the same accounting basis.
  The date must equal the latest amendment approval date; the figures must
  equal opening plus all amendments not already incorporated. Obtain a matching
  dated export rather than substituting an unrelated month-end statement.

The model additionally checks amendment document coverage, balanced financial
summaries, complete capital-row coverage and unique row IDs. Negative remaining
account allocations in any available month prevent publication. Updating
amendments past the reconciliation date automatically withholds the comparison
until its independent control snapshot is updated.

The ORJ mapping remains the one documented in the city's 2025 final accounts,
section 3.6, table 14. ODPA divisions map to the citizen-facing categories in
`investments-model.js`; divisions 31/32 combine into education and 35/43 into
health/social care. Unknown divisions stay in Ostatní investice. Before importing
a new official schedule, review its codes against the source sector labels and
confirm every investment row is classified exactly once. No AI or description
matching assigns localities or categories.

## Calculations and review

Amounts stay in haléře; only displayed Kč and per-resident values are rounded.
Allocations are grouped by the complete normalized accounting-code tuple, not
by inferred project identity. Descriptions and all supporting links are retained.
If an official export uses different code dimensions from the amendment PDFs,
normalize them against documented source definitions before import; do not
drop dimensions to hide negative balances.

Review locality totals plus unassigned against citywide totals, categories
against the selected scope, and an October addition against the unchanged
September view. Check the 11 populations, zero allocations and archived sources.
The per-resident view never assigns an unassigned total to central Litovel.

Run:

```sh
node scripts/check-investments.cjs
node --check rozpocet/investments-model.js
node --check rozpocet/investments.js
node --test tests/*.test.cjs
jekyll build --destination /tmp/litovel-budget-preview
```

`node scripts/check-investments.cjs --require-ready` is the release gate for
publishing numeric comparisons: it fails until complete snapshots reconcile
and archived source hashes match. The default checker accepts the intentionally
withheld initial state, but rejects partially populated or inconsistent data.
Browser verification also covers mobile widths, keyboard selection, filters,
source links, legacy URLs, failed fetches, invalid controls and the withheld
state. Ready-state browser tests inject synthetic fixtures into responses;
those fixtures are never written into public assets.
