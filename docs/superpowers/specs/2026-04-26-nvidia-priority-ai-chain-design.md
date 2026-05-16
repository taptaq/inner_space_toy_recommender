# NVIDIA Priority AI Chain Design

## Goal

Adjust the main app recommendation AI chain so NVIDIA-hosted models are always tried before the project's self-hosted model endpoints.

The app should only fall back to the current self-hosted providers after all NVIDIA-backed options fail.

## User Need

The current app chain prefers the project's own model endpoints too early.

The requested behavior is:

- try all NVIDIA-backed providers first
- only if all NVIDIA options fail, try the current self-hosted providers
- keep local non-AI fallback behavior at the end

## Confirmed Direction

Agreed direction:

- scope stays limited to the main app recommendation chain
- do not change scraper / cleaner / translator model chains in this round
- do not hardcode any NVIDIA secret in source code
- continue using environment variables for credentials

## Scope

In scope:

- `src/App.tsx`
- `vite.config.ts`
- top-3 rerank AI call
- backup explanation and shopping-guidance AI call
- app-level provider order, logging, and env wiring

Out of scope:

- scraper AI chains
- cleaner AI chains
- backend API changes
- global provider abstraction for the entire repo

## Chosen Approach

Recommended approach: `NVIDIA-first provider ladder for app-only recommendation calls`

### How it works

For each app-level recommendation call:

1. try NVIDIA DeepSeek
2. try NVIDIA Qwen
3. try NVIDIA GLM
4. try NVIDIA Kimi
5. try self-hosted DeepSeek
6. try self-hosted Qwen
7. try self-hosted GLM
8. if all fail, return to the existing local fallback behavior

### Why this approach

- matches the requested operational priority exactly
- keeps the existing self-hosted chain intact as a backup layer
- avoids touching unrelated scraper logic
- keeps rollback simple if NVIDIA behavior changes

## Provider Order

The app recommendation chain after this change should be:

1. `NVIDIA DeepSeek`
   - base URL: `https://integrate.api.nvidia.com/v1`
   - model: `deepseek-ai/deepseek-v4-pro`
2. `NVIDIA Qwen`
   - base URL: `https://integrate.api.nvidia.com/v1`
   - model: `qwen/qwen3.5-397b-a17b`
3. `NVIDIA GLM`
   - base URL: `https://integrate.api.nvidia.com/v1`
   - model: `z-ai/glm-5.1`
4. `NVIDIA Kimi`
   - base URL: `https://integrate.api.nvidia.com/v1`
   - model: `moonshotai/kimi-k2.6`
5. `DeepSeek`
   - base URL: `https://api.deepseek.com/v1`
   - model: `deepseek-v4-flash`
6. `Qwen`
   - base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - model: `qwen-turbo`
7. `GLM`
   - base URL: `https://open.bigmodel.cn/api/paas/v4/`
   - model: `glm-4.6v`
8. local structured fallback or local guidance fallback

## Affected App Flows

This provider ladder must apply consistently to both app-level AI entry points:

- Top-3 rerank
- backup explanation and shopping-guidance enhancement

The two flows should not drift into different provider orders.

## Configuration

The frontend runtime must receive:

- `NVIDIA_API_KEY`
- existing self-hosted provider keys that are already in use

The implementation should not embed secrets in the repository.

If `NVIDIA_API_KEY` is missing, the chain should fail NVIDIA providers quickly and continue to the self-hosted providers.

## Request Behavior

The NVIDIA providers should remain compatible with the current JSON-response workflow:

- use non-streaming completion requests
- keep the existing prompts unchanged
- preserve existing JSON normalization and parsing logic

Provider-specific request hints may be used only on the NVIDIA requests, for example:

- `chat_template_kwargs`
- `top_p`
- `top_k`
- `max_tokens`

These should not force changes onto the existing self-hosted providers.

## Logging

Logs should clearly show:

- NVIDIA DeepSeek start / failure
- NVIDIA Qwen start / failure
- NVIDIA GLM start / failure
- NVIDIA Kimi start / failure
- self-hosted DeepSeek start / failure
- self-hosted Qwen start / failure
- self-hosted GLM start / failure
- final local fallback activation

This will make provider debugging much easier.

## Testing

Given the current repo setup, focused verification is sufficient:

- test the app-level provider order helper
- run type-check after provider insertion
- run production build after app chain changes

No new browser or network-dependent end-to-end verification is required for this design.

## Risks

Main risks:

- NVIDIA-compatible response behavior may differ by model family
- app-level provider order may be duplicated across the two call sites if not carefully shared

This design keeps the scope intentionally narrow. If the NVIDIA-first ladder works well, a later round can extract a shared app-level multi-provider executor.
