# Product Image Fallback Design

## Goal

Make product images degrade gracefully when they cannot be displayed.

If a product image URL is empty or the remote image fails to load, the UI should show one unified default visual instead of a broken image.

## User Need

The current product rendering can still show a failed image state when the source URL is invalid, expired, blocked, or hotlink-protected.

The expected behavior is:

- no broken-image icon
- one consistent default image style
- the same fallback behavior across the main product surfaces

## Confirmed Direction

Agreed implementation direction:

- use frontend-only fallback handling
- keep the current data flow unchanged
- apply one shared fallback presentation to the existing product image entry points

This keeps the change low-risk and fast to ship.

## Scope

In scope:

- result-page product image rendering
- shared product-card image rendering
- empty-image and load-error fallback behavior
- keeping mobile and desktop rendering visually consistent

Out of scope:

- changing scraper image extraction
- changing database image storage
- validating remote image URLs ahead of time
- redesigning the broader card UI

## Chosen Approach

Recommended approach: `shared frontend fallback rendering`

### How it works

1. Detect whether the incoming product image value is a remote image URL.
2. If the value is missing or not a URL, render the default visual immediately.
3. If the value is a URL, try to render the image normally.
4. If image loading fails, switch that render path to the same default visual.

### Why this approach

- smallest change surface
- no scraper or schema risk
- consistent behavior between pages
- easy to reuse anywhere else product images are shown

## UI Behavior

The fallback visual should:

- reuse the existing dark atmospheric style of the app
- avoid English copy
- work at all current product card sizes
- look intentional on both mobile and desktop

The fallback should be visually identical whether the image is missing from the start or fails after attempting to load.

## Implementation Notes

Primary render points currently identified:

- `src/pages/ResultsPage.tsx`
- `src/components/ProductCardContent.tsx`

The preferred implementation is to centralize fallback rendering in a small shared component or helper so these entry points do not drift apart.

## Testing

Add a focused UI test for the fallback behavior:

- remote image path renders an `img` first
- triggering image load failure switches to the shared default visual

Then run:

- targeted test command for the new/updated test
- `npx tsc --noEmit`

## Risks

Main risk:

- if fallback handling is duplicated instead of shared, the two product surfaces may diverge again later

The design avoids that by preferring one shared fallback path.
