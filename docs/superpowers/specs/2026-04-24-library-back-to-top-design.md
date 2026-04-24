# Library Back To Top Design

## Goal

Add a back-to-top button to the holographic equipment library page.

The button should help users quickly return to the top of a long product list without affecting the rest of the app.

## User Need

The library page can become long after filters and product cards render.

The expected interaction is:

- the button does not distract users at the top of the page
- it appears after the user has scrolled down a meaningful distance
- clicking it smoothly returns the user to the top
- the interaction works on both mobile and desktop

## Confirmed Direction

Agreed direction:

- use a floating button
- only show it after the user scrolls down
- place it near the lower-right corner
- keep the change scoped to the library page

## Scope

In scope:

- `src/pages/LibraryPage.tsx`
- scroll-position tracking for the library page
- floating button visibility state
- smooth scroll back to top
- mobile and desktop spacing

Out of scope:

- adding the same behavior to other pages
- changing the product-card layout
- changing library filters or data loading behavior

## Chosen Approach

Recommended approach: `library-local floating action button`

### How it works

1. Track the current vertical scroll position inside the library page container.
2. Keep the button hidden near the top of the page.
3. Once the user scrolls past a threshold, reveal the button with a lightweight transition.
4. On click, scroll the same container back to the top with smooth behavior.

### Why this approach

- minimal change surface
- matches long-list browsing patterns
- avoids clutter on first load
- does not require global scroll management

## UI Behavior

The button should:

- be fixed or visually anchored near the lower-right corner of the library view
- use the app's existing holographic style
- remain readable on small screens
- avoid covering important content by using conservative spacing

The label can stay compact and Chinese-only.

## Accessibility And Interaction

The button should:

- be keyboard clickable
- include clear text or accessible labeling
- only appear when useful

If JavaScript scroll tracking is delayed for any reason, the page should still behave normally without blocking browsing.

## Testing

Given the current repo setup, use focused verification rather than a new DOM testing stack.

Validation should include:

- type-check after the state and event wiring is added
- production build after the button is rendered in the page

## Risks

Main risk:

- listening to the wrong scroll container would make the button never appear or scroll the wrong element

This design avoids that by keeping both the listener and the scroll-to-top action inside `LibraryPage`.
