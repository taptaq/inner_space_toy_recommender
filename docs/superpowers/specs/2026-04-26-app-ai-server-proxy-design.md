# App AI Server Proxy Design

## Goal

Move the main app recommendation AI chain from direct browser-side model calls to server-side proxy endpoints.

This change should eliminate browser CORS failures and stop exposing model-provider credentials to the frontend runtime.

## User Need

The current app recommendation flow calls third-party AI providers directly from the browser.

This causes two practical problems:

- NVIDIA calls hit browser CORS restrictions
- provider API keys are exposed to frontend runtime code

The expected behavior is:

- frontend only calls the local app server
- the server owns all external AI provider requests
- the existing provider fallback order still works

## Confirmed Direction

Agreed direction:

- fix the issue by moving app AI calls to the backend
- do not keep direct browser-side NVIDIA calls
- do not special-case only one provider
- keep the app-level provider ladder on the server side

## Scope

In scope:

- `src/App.tsx`
- `src/server/index.ts`
- app-level top-3 rerank call
- app-level backup explanation and shopping-guidance enhancement call
- server-side provider execution and fallback

Out of scope:

- scraper model chains
- cleaner model chains
- database schema changes
- redesigning prompts or ranking logic

## Chosen Approach

Recommended approach: `frontend-to-local-server proxy for app AI calls`

### How it works

1. The browser sends app AI requests to local server endpoints under `/api/...`
2. The local Express server builds the provider clients and calls external AI services
3. The server applies the full provider ladder and returns JSON to the frontend
4. The frontend keeps prompt inputs and result handling, but no longer owns third-party credentials

### Why this approach

- fixes the actual CORS root cause
- removes provider secrets from browser execution
- keeps fallback control in one trusted place
- preserves current app UX and result flow

## Provider Order

The server-side app recommendation chain should use this order:

1. `NVIDIA DeepSeek`
2. `NVIDIA Qwen`
3. `NVIDIA GLM`
4. `NVIDIA Kimi`
5. self-hosted `DeepSeek`
6. self-hosted `Qwen`
7. self-hosted `GLM`
8. local non-AI fallback in the app flow

The frontend should not know or care which provider ultimately produced the answer.

## API Shape

Two local server endpoints should cover the app AI needs:

### 1. Rerank endpoint

- path suggestion: `/api/ai/rerank`
- input: the current rerank prompt or the structured context needed to build it
- output: the same JSON array shape currently expected by the frontend

### 2. Result enhancement endpoint

- path suggestion: `/api/ai/result-enhancement`
- input: the current enhancement prompt or the structured context needed to build it
- output: the same JSON object shape currently expected by the frontend

The response format should stay aligned with the current frontend parsing logic so this migration remains low-risk.

## Frontend Behavior

`App.tsx` should:

- stop constructing provider clients in the browser
- call the new local `/api` endpoints instead
- preserve existing local fallback behavior when the local server returns an error

This keeps the current user-facing behavior stable while changing the transport layer.

## Server Behavior

`src/server/index.ts` should:

- parse JSON request bodies
- own all provider API key access
- execute provider fallback order
- normalize provider output to the existing app contract
- return clear HTTP errors when all providers fail

The server already exists for library data, so this is an extension of an existing pattern rather than a new backend system.

## Security And Reliability

This design improves the current state by:

- removing third-party AI calls from browser code
- removing practical dependency on provider CORS headers
- centralizing provider logging and error handling

The frontend should no longer need `dangerouslyAllowBrowser` for these app AI flows after the migration.

## Testing

Given the current repo setup, focused verification should include:

- type-check after moving app AI calls to the server boundary
- production build after frontend changes
- targeted server-side unit or helper tests where practical

No browser-side third-party AI call should remain in the app recommendation flow after the change.

## Risks

Main risks:

- duplicating prompt logic between frontend and backend if the boundary is chosen poorly
- changing response shapes accidentally during the migration

This design stays low-risk by preserving the existing response contracts and moving only the provider execution layer behind the server boundary.
