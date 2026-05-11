# OpenAI-compatible reasoning payload shim

Date: 2026-05-09

## Problem

OpenAI-compatible request path currently sends `reasoningEffort` into AI SDK, but it does not add Responses-style `reasoning` payload.

User expectation for OpenAI-compatible requests with reasoning enabled:

- keep `reasoning_effort`
- also send `reasoning: { effort, summary: "auto" }`

This should match OpenAI Codex / OpenAI Native behavior shape, while staying inside OpenAI-compatible chat completions path.

## Goals

- When resolved model params include `reasoningEffort`, send both:
    - `reasoning_effort`
    - `reasoning: { effort, summary: "auto" }`
- Apply same behavior for:
    - `createMessage`
    - `completePrompt`
- Keep `reasoning_effort` value unchanged, including extended values like `xhigh` or `none` when current model/settings resolve them.
- Leave request unchanged when reasoning is off.

## Non-goals

- No change to `openai.ts`.
- No change to `openai-native.ts` or `openai-codex.ts`.
- No UI/settings changes.
- No new provider capability detection.

## Design

### 1) Pass reasoning to AI SDK provider

`OpenAICompatibleHandler` will build `providerOptions` for `streamText` and `generateText`.

Use generic AI SDK key:

```ts
providerOptions: {
  openaiCompatible: {
    reasoningEffort: model.reasoningEffort,
  },
}
```

Only include this block when `model.reasoningEffort` is defined.

### 2) Add request-body transform hook

Extend `OpenAICompatibleConfig` with AI SDK `transformRequestBody` hook and pass it into `createOpenAICompatible(...)`.

Hook behavior:

- if body has no `reasoning_effort`, return body unchanged
- if body has `reasoning_effort`, add/update:
    ```ts
    reasoning: {
      effort: body.reasoning_effort,
      summary: "auto",
    }
    ```
- keep `reasoning_effort` in body
- preserve other fields

This hook must apply to both streaming and non-streaming calls, because AI SDK uses same provider transform for both.

### 3) Keep logic localized

Implement inside `src/api/providers/openai-compatible.ts` only.

Reason:

- current `OpenAICompatibleHandler` is only consumer path
- current OpenAI-compatible provider family is Moonshot
- local change keeps scope tight and avoids touching shared reasoning transforms for unrelated providers

## Data flow

1. `MoonshotHandler.getModel()` resolves final `reasoningEffort` from settings/model defaults.
2. `OpenAICompatibleHandler.createMessage()` / `completePrompt()` pass `providerOptions.openaiCompatible.reasoningEffort` into AI SDK.
3. AI SDK serializes top-level `reasoning_effort`.
4. `transformRequestBody` adds `reasoning: { effort, summary: "auto" }` when `reasoning_effort` exists.
5. Provider receives both fields.

## Fallback behavior

- No reasoning selected: no `providerOptions`, no `reasoning`, no `reasoning_effort`.
- Disabled reasoning: same as above.
- Extended values: pass through unchanged.
- If body already contains `reasoning`, overwrite `effort` and `summary` only; do not drop unrelated keys.

## Tests

Add tests around current Moonshot/OpenAI-compatible path:

1. **Constructor wiring**

    - `createOpenAICompatible` receives `transformRequestBody`.

2. **Streaming request**

    - `createMessage()` passes `providerOptions.openaiCompatible.reasoningEffort` when enabled.
    - transform adds both `reasoning_effort` and `reasoning`.

3. **Non-streaming request**

    - `completePrompt()` uses same providerOptions path.
    - transform adds both fields.

4. **Disabled path**

    - when reasoning is disabled, request has neither `reasoning_effort` nor `reasoning`.

5. **Extended effort path**
    - `xhigh` stays `xhigh` in both fields.

Prefer a small pure helper or captured transform callback in test so request-body mapping is asserted directly, not through SDK internals.

## Acceptance criteria

- OpenAI-compatible requests with reasoning enabled send both fields.
- `reasoning_effort` still exists.
- `reasoning.summary` is always `auto`.
- Behavior matches in stream and completion paths.
- No changes to unrelated provider paths.
