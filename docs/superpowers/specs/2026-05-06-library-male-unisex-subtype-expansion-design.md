# Library Male And Unisex Subtype Expansion Design

## Goal

Extend the library type system so male-oriented and unisex products support the same two-level filtering model that female-oriented products already use:

- top-level `type_code`
- second-level `subtype_code`
- frontend filter linkage by gender -> type -> subtype
- database backfill into `recommender_toys`

The target outcome is consistency for users and safer classification for legacy data without changing the current top-level type set.

## Confirmed Direction

From the current discussion, the agreed direction is:

- keep the existing top-level type structure
- add subtype coverage for male and unisex categories
- make the interaction pattern match the current female filter experience
- keep subtype labels easy to understand at a glance
- prefer leaving ambiguous products in a stable parent type or `unknown` instead of forcing an overconfident subtype

## Problem

The current subtype system is female-only in practice:

- female products already expose subtype filtering
- male and unisex products stop at the top-level type
- the frontend subtype control is already generic, but the metadata and classifier rules are incomplete for male and unisex categories
- the backfill script can derive `subtype_code`, but current rules do not meaningfully split male and unisex products

This creates two user-facing gaps:

- filter behavior feels inconsistent across genders
- many male and unisex products remain broad buckets even when product text is clear enough to support a more specific subtype

## Chosen Approach

Recommended approach: extend the existing shared subtype system instead of adding parallel gender-specific filter logic.

### Why this approach

- the current frontend already supports linked subtype filters
- `type_code` plus `subtype_code` is enough to represent the desired structure
- one classifier path is easier to maintain than separate male/female/unisex pipelines
- a single backfill script can refresh both old and new subtype coverage

### Alternatives considered

- only improve top-level male and unisex type precision
  - safer short term, but does not deliver consistent UI behavior
- add separate filter logic just for male and unisex flows
  - would duplicate behavior that already exists in the generic library filter model
- force every male and unisex type into multiple subtypes
  - looks complete on paper, but increases misclassification risk and maintenance churn

## Scope

This design covers:

- expanding subtype metadata in `src/lib/library-product-types.ts`
- extending classifier rules in `src/lib/library-product-type-classifier.ts`
- extending subtype backfill behavior in `src/db/backfill-item-type-code.ts`
- extending library filter tests and classifier tests
- making male and unisex filters behave like female filters in the library page

Out of scope:

- adding new top-level type codes
- redesigning the library page layout
- changing recommendation ranking logic
- introducing database columns beyond `type_code` and `subtype_code`

## Subtype Taxonomy

### Male

Top-level `masturbator`:

- `manual_masturbator` -> `手动杯`
- `vibrating_masturbator` -> `震动杯`
- `interactive_masturbator` -> `互动杯`

Top-level `prostate`:

- `prostate_vibe` -> `震动前列腺`
- `prostate_plug` -> `前列腺塞`

Top-level `cock_ring`:

- `classic_cock_ring` -> `基础环`
- `vibrating_cock_ring` -> `震动环`

### Unisex

Top-level `couples`:

- `insertable_couples` -> `双人入体`
- `external_couples` -> `双人外用`

Top-level `wearable_remote`:

- `panty_wearable` -> `隐形穿戴`
- `insertable_remote` -> `入体远控`
- `dual_wearable_remote` -> `双人远控`

### Shared constraints

- `unknown` stays top-level only and does not get a subtype
- parent types without reliable subtype evidence should still allow `subtype_code = null`
- subtype labels should optimize for quick recognition, not technical completeness

## Classification Strategy

Classification continues to use the current shared signal model:

- `name`
- `rawDescription`
- `tags`
- `physicalForm` as a weak supporting signal only

The classifier should keep using parent-first flow:

1. resolve the top-level `type_code`
2. evaluate subtype rules only within that parent type
3. return `null` when subtype evidence is weak or contradictory

### Male `masturbator`

Priority order:

- `interactive_masturbator`
- `vibrating_masturbator`
- `manual_masturbator`

Signal intent:

- `interactive_masturbator` requires strong interaction language such as `互动`, `远控`, `app`, `同步`, `视频联动`, `感应互动`
- `vibrating_masturbator` requires power or motion signals such as `震动`, `加温`, `旋转`, `抽动`, `电动`, `自动`
- `manual_masturbator` is the fallback inside `masturbator` when the product is clearly a cup/stroker but lacks strong powered or interactive signals

### Male `prostate`

Priority order:

- `prostate_vibe`
- `prostate_plug`

Signal intent:

- `prostate_vibe` needs prostate-targeting language plus powered stimulation signals
- `prostate_plug` needs prostate-targeting language plus plug or static-wear signals such as `塞`, `plug`, `肛塞`, `后庭塞`

### Male `cock_ring`

Priority order:

- `vibrating_cock_ring`
- `classic_cock_ring`

Signal intent:

- `vibrating_cock_ring` requires ring signals plus powered or remote-control signals
- `classic_cock_ring` is the fallback for clear ring products without powered signals

### Unisex `couples`

Priority order:

- `insertable_couples`
- `external_couples`

Signal intent:

- `insertable_couples` requires couples/shared-play language plus insertable/internal signals
- `external_couples` requires couples/shared-play language but stays focused on external/body-surface use

### Unisex `wearable_remote`

Priority order:

- `dual_wearable_remote`
- `insertable_remote`
- `panty_wearable`

Signal intent:

- `dual_wearable_remote` requires strong couples/shared-play signals plus remote/wearable evidence
- `insertable_remote` requires remote-control evidence plus insertable/internal signals
- `panty_wearable` requires wearable scene signals such as `内裤`, `隐形佩戴`, `贴身穿戴`, `外出穿戴`

## Misclassification Guards

To keep subtype expansion safe:

- accessory, connector, adapter, replacement-head, and machine-platform products should continue to fall back to `unknown`
- `physicalForm` must not create a subtype on its own
- remote/app language alone is insufficient without a matching parent-type context
- when multiple subtype signals overlap, the classifier should prefer the more specific subtype according to the priority order above
- weak evidence inside a valid parent type should return `null` for subtype rather than inventing a guess

## Frontend Behavior

The frontend should continue using the existing generic subtype flow:

- `getAllowedLibraryTypeCodes(gender)` limits available top-level types
- `getAllowedLibrarySubtypeCodes(gender, type)` returns subtypes for the selected parent type
- `sanitizeLibrarySubtypeSelection` resets invalid subtype choices to `all`
- `LibraryPage` shows subtype select only when the selected parent type has configured subtypes

Expected result:

- male and unisex users see the same linked filter pattern that female users already have
- selecting another gender or top-level type automatically hides invalid subtype choices
- `其他` remains a top-level only filter option

## Database And Backfill

Database representation stays unchanged:

- `public.recommender_toys.type_code`
- `public.recommender_toys.subtype_code`

Backfill behavior:

- use the current joined signal sources from `recommender_toys` and `products`
- classify top-level type first
- classify subtype from the resolved parent type
- only update rows whose derived values differ from stored values
- allow `subtype_code` to remain `null` when evidence is not strong enough

No new database columns are required for this feature.

## Testing Strategy

### Metadata tests

Extend `src/lib/library-product-types.test.ts` to cover:

- allowed male subtypes by parent type
- allowed unisex subtypes by parent type
- invalid subtype reset behavior for male and unisex flows

### Classifier tests

Extend `src/lib/library-product-type-classifier.test.ts` with representative cases:

- interaction-led masturbators -> `interactive_masturbator`
- powered masturbators -> `vibrating_masturbator`
- plain strokers/cups -> `manual_masturbator`
- vibrating prostate products -> `prostate_vibe`
- static plug-style prostate products -> `prostate_plug`
- powered rings -> `vibrating_cock_ring`
- plain rings -> `classic_cock_ring`
- couples insertable products -> `insertable_couples`
- couples external products -> `external_couples`
- panty-style wearables -> `panty_wearable`
- remote insertables -> `insertable_remote`
- couples remote wearables -> `dual_wearable_remote`
- accessories/adapters remain `unknown`

### Page tests

Extend `src/pages/LibraryPage.test.tsx` to verify:

- male subtype controls appear for supported parent types
- unisex subtype controls appear for supported parent types
- subtype filtering narrows product cards correctly

### Backfill tests

Extend `src/db/backfill-item-type-code.test.ts` to verify:

- joined metadata can derive male subtypes
- joined metadata can derive unisex subtypes
- ambiguous inputs keep `subtype_code` empty instead of forcing a split

## Implementation Sequence

1. expand subtype metadata and add failing tests
2. extend subtype classifier rules for male and unisex products
3. update page tests and backfill tests
4. run targeted verification
5. run the full subtype backfill for `recommender_toys`
6. validate frontend filtering against the refreshed dataset

## Expected Outcome

After this change:

- male and unisex library filters behave the same way as female filters
- subtype labels remain easy to scan and understand
- more products become filterable at a meaningful second level
- subtype backfill stays conservative when evidence is weak
- the system remains on a single shared `type_code + subtype_code` model
