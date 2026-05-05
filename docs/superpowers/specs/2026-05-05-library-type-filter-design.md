# Library Type Filter Design

## Goal

Add a new `类型` filter to the `全息装备库` page and make it work together with the existing `性别` filter.

The feature should help users narrow products by a category they can understand immediately, instead of forcing them to infer from technical attributes such as `physicalForm` or `motorType`.

## User Need

The current library can filter by:

- gender
- price
- max dB
- brand
- origin
- material

This is useful for narrowing the list, but it still leaves a gap:

- users cannot quickly scan by product category
- the current product structure is too technical for a library-browsing experience
- category choices should feel different for female, male, and unisex routes

The explicit product direction from discussion is:

- `类型` must be a formal product field, not only a UI-derived helper
- labels should be user-friendly and immediately understandable
- categories such as `吮吸类` must be represented clearly
- the available `类型` options must change with `性别`

## Confirmed Product Direction

Agreed direction from discussion:

- store a formal category field in product data
- use stable internal codes for data and filtering logic
- show human-readable Chinese labels in the UI
- keep category names oriented around user understanding, not internal taxonomy

This means the library filter is backed by real normalized data rather than temporary inference in the page component.

## Chosen Approach

Recommended approach: `Formal type code with UI label mapping`

### Why this approach

- it keeps the database stable even if UI copy changes later
- it avoids storing presentation labels directly as business logic
- it supports filtering, analytics, and future data cleaning more safely
- it allows us to keep the UI simple while the underlying data remains structured

### Alternatives considered

- derive the category only inside the UI from existing fields
  - lower implementation cost, but fragile and hard to maintain
- store the final Chinese label directly in the database
  - faster at first, but expensive to rename and normalize later
- build a two-level category system now
  - expressive, but more complexity than this feature needs right now

## Scope

This design covers:

- a formal `type_code` field in recommender product data
- category mapping rules for current historical products
- linked `性别` and `类型` filter behavior in the library page
- API payload changes needed by the frontend
- fallback behavior for uncategorized items
- tests for category mapping and filter interaction

Out of scope:

- changing quiz routing or recommendation scoring
- redesigning product card visuals
- introducing nested category trees
- reworking unrelated product standardization fields

## Data Model

### New normalized field

Add a nullable `type_code` field to the recommender product table used by the app.

Primary target:

- `public.recommender_items`

Compatibility target during transition:

- `public.recommender_toys`, if it still exists in the connected database

The current code path that powers the library API reads from `public.recommender_items`, so that table is the source of truth for implementation. Compatibility with `recommender_toys` is only to avoid leaving older maintenance flows behind.

### Stored value strategy

Store stable codes in the database, not direct presentation labels.

Recommended initial codes:

- `suction`
- `external_vibe`
- `insertable`
- `dual_stimulation`
- `masturbator`
- `prostate`
- `cock_ring`
- `couples`
- `wearable_remote`
- `unknown`

`unknown` is a valid transitional value for products that cannot be classified confidently during backfill.

## User-Facing Type Labels

The UI should use a single shared mapping from `type_code` to Chinese display text.

Initial display labels:

- `suction` -> `吮吸类`
- `external_vibe` -> `外部震动`
- `insertable` -> `入体探索`
- `dual_stimulation` -> `双刺激`
- `masturbator` -> `飞机杯`
- `prostate` -> `前列腺探索`
- `cock_ring` -> `环类/穿戴`
- `couples` -> `双人互动`
- `wearable_remote` -> `远控穿戴`

The label layer must live in one centralized mapping module so the same vocabulary is used by the page, tests, and any future admin tooling.

## Gender-to-Type Availability

The `类型` options shown to the user should be constrained by the selected `性别`.

### Female

When `性别 = 女性向`, show:

- `吮吸类`
- `外部震动`
- `入体探索`
- `双刺激`

### Male

When `性别 = 男性向`, show:

- `飞机杯`
- `前列腺探索`
- `环类/穿戴`

### Unisex

When `性别 = 通用型`, show:

- `双人互动`
- `远控穿戴`

### All genders

When `性别 = 全部性别`, show all user-facing types except `unknown`.

## Historical Data Classification Rules

Backfill should classify existing products using current structured fields first, then description/name signals where needed.

### Female-oriented products

- `physical_form = external` and suction-related signals present -> `suction`
- `physical_form = external` without suction signals -> `external_vibe`
- `physical_form = internal` -> `insertable`
- `physical_form = composite` -> `dual_stimulation`

### Male-oriented products

Use product name and description signals to split:

- cup / masturbator signals -> `masturbator`
- prostate / anal / P-spot signals -> `prostate`
- ring / wearable ring signals -> `cock_ring`

### Unisex products

Use relationship and usage signals to split:

- couples / partner / shared interaction signals -> `couples`
- remote wearable / app wearable / discreet wear signals -> `wearable_remote`

### Unknown handling

If classification confidence is low:

- write `unknown`
- do not force a guess

This keeps the visible category set clean while preserving the item for later manual cleanup.

## Classification Signal Strategy

The classification pipeline should prefer existing normalized fields and reuse repository terminology where possible.

Priority order:

1. explicit normalized field if already present in future ingestion
2. `gender`
3. `physical_form`
4. `raw_description`
5. `name`
6. `tags`

Suction detection should recognize common signals such as:

- `吮吸`
- `吸吮`
- `吸感`
- `吸吸`
- `air pulse`
- `气脉冲`

Male category detection should recognize common signals such as:

- `飞机杯`
- `masturbator`
- `cup`
- `前列腺`
- `prostate`
- `肛`
- `环`
- `cock ring`

Unisex category detection should recognize common signals such as:

- `情侣`
- `双人`
- `共玩`
- `远控`
- `穿戴`
- `wearable`

The implementation should be rule-based and deterministic, not AI-generated.

## API Contract Changes

The library endpoint currently returns normalized product payloads from `/api/recommender/toys`.

It should be extended to include:

- `typeCode`

The frontend `Product` type should add:

- `typeCode?: string | null`

The API should pass through `unknown` or `null` without failing normalization.

## Library Filter Behavior

### Filter placement

Add the new `类型` filter in the primary filter area of `全息装备库`, alongside the current main browsing filters.

### Default state

- default selection: `全部类型`

### Interaction rules

- when `性别` changes, recalculate allowed `类型` options
- if the currently selected `类型` is no longer valid under the new `性别`, reset it to `全部类型`
- the options should be derived from a central availability map, not hard-coded in JSX conditionals

### Filtering rules

- if `类型 = 全部类型`, do not restrict by `typeCode`
- if a specific `类型` is selected, only products with matching `typeCode` should match
- products with `typeCode = unknown` or `null` should still appear under `全部类型`
- products with `typeCode = unknown` or `null` should not match any specific type filter

## Error Handling and Transition Safety

The rollout should tolerate partially backfilled data.

Required behavior:

- frontend must not crash if `typeCode` is missing
- missing or `unknown` categories should not create visible garbage options
- the library should remain usable before the full backfill finishes

This allows incremental migration without forcing a hard cutover.

## Implementation Shape

The feature should be organized around small, focused units.

Recommended responsibilities:

- one shared type metadata module for codes, labels, and gender availability
- one server-side classification/backfill utility for historical data
- one library-page filter update for UI and product filtering
- one app-state update for persisted `filterType`

This keeps category vocabulary and behavior centralized instead of scattering logic across the app.

## Testing

Add focused coverage for:

- metadata mapping from `type_code` to Chinese label
- available type options for each gender
- reset behavior when a selected type becomes invalid after changing gender
- library filtering by `typeCode`
- handling of `unknown` and missing values
- historical classification rules, especially:
  - `吮吸类`
  - `飞机杯`
  - `前列腺探索`
  - `双人互动`
  - `远控穿戴`

## Migration Strategy

Recommended rollout order:

1. add nullable `type_code` to `recommender_items`
2. update ingestion / sync code so new records can carry `type_code`
3. add a deterministic backfill script for historical rows
4. extend `/api/recommender/toys` to return `typeCode`
5. add frontend state, filter UI, and linked filtering behavior
6. run tests against filter and classification behavior

If `recommender_toys` still exists in production workflows, the backfill script should detect and update it as a compatibility step, but the app should continue treating `recommender_items` as the primary runtime table.

## Risks and Mitigations

### Risk: category ambiguity

Some product names and descriptions may not be specific enough for confident classification.

Mitigation:

- use `unknown` instead of forced guesses
- cover edge cases with classification tests
- keep the mapping rules centralized for iterative refinement

### Risk: two table names in the ecosystem

The codebase and prior maintenance conversations reference both `recommender_items` and `recommender_toys`.

Mitigation:

- implement against `recommender_items` as the active app table
- make maintenance scripts table-aware where practical
- document the compatibility behavior explicitly

### Risk: UI and data vocabulary drifting

If labels are hard-coded in multiple places, future cleanup becomes error-prone.

Mitigation:

- keep all type labels and availability rules in one shared metadata module

## Success Criteria

The feature is successful when:

- users can filter the library by a clear `类型`
- available type options change correctly with `性别`
- `男性向` does not show female-only categories and vice versa
- suction-style products are grouped under an immediately understandable category
- historical products can be backfilled without forcing low-confidence guesses
- missing category data does not break browsing
