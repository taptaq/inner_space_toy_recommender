# Vercel API Migration Design

## Context

The current production deployment serves the Vite frontend on Vercel, but all `/api/*`
routes only exist inside the local Express server started from `src/server/index.ts`.
This is why the online frontend loads while `/api/recommender/toys` returns `404`.

## Goal

Keep the existing Express routing structure and migrate it to a single-entry Vercel
Function so the current frontend can call the same `/api/*` endpoints in production
without rewriting route modules.

## Chosen Approach

Use one reusable Express app module for both environments:

- `src/server/app.ts` becomes the shared server composition root
- `src/server/index.ts` becomes a thin local-only listener for development
- `api/index.ts` becomes the Vercel serverless entry
- `vercel.json` rewrites `/api/*` requests to the serverless entry

This keeps the current route paths, stores, and services intact while removing the
deployment mismatch between local development and Vercel production.

## Design Details

### Shared App Composition

`src/server/app.ts` will own:

- environment loading
- database pool creation
- service and store creation
- route registration
- a reusable `ensureServerReady()` initializer

The Express app should be created once per runtime instance and exported for both local
and Vercel use.

### Serverless-Safe Initialization

The current startup path runs schema setup and then starts `app.listen(...)`. In
serverless mode there is no persistent startup hook, so initialization needs to be
explicit and idempotent.

`ensureServerReady()` will:

- lazily run schema setup on first request
- cache the initialization promise
- reset the cached promise if initialization fails so a later request can retry

### Local Development Compatibility

`src/server/index.ts` should only:

- import the shared app
- await `ensureServerReady()`
- call `app.listen(...)`

This preserves the current Vite proxy based local workflow.

### Production Routing

`api/index.ts` should:

- await `ensureServerReady()`
- restore the original `/api/*` pathname from the rewrite parameter
- delegate the request to the shared Express app
- return a JSON `500` response if initialization fails

`vercel.json` should rewrite `/api/:path*` to `/api/index?path=:path*` so existing
frontend calls do not need to change while the function can reconstruct the original
Express route path.

## Small Cleanup Included

Move the `subtype_code` column migration into
`src/server/recommender-items-schema.ts` so `/api/recommender/toys` no longer performs
schema mutation during normal requests.

## Validation

- `npm run build`
- `npm run lint`
- redeploy to Vercel and verify `/api/recommender/toys` responds instead of `404`
