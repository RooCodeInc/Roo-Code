# Implementation Report: Embedding Indexing Fix

## Summary

Fixed critical issues in the OpenAI Compatible Embedder that caused HTTP 503 errors and infinite waits during codebase indexing. The fix adds timeouts, retry logic for 5xx server errors, and proper error messages.

## Problem

When indexing codebase through OpenAI-compatible API (`http://0.0.0.0:11434/v1`), the following error occurred:

```
Indexing partially failed: Only 780 of 2834 blocks were indexed.
Failed to process batch after 3 attempts:
Failed to create embeddings after 3 attempts: HTTP 503 - 503 status code (no body)
```

**Root Cause:** The OpenAI Compatible Embedder lacked timeouts and did not retry 5xx errors. The server could hang indefinitely — the program needed to handle such situations correctly.

## Changes Made

### 1. Core Code Changes

#### `src/services/code-index/embedders/openai-compatible.ts`

- **Added timeout constants:** `OPENAI_COMPATIBLE_EMBEDDING_TIMEOUT_MS = 60000` (60s), `OPENAI_COMPATIBLE_VALIDATION_TIMEOUT_MS = 30000` (30s)
- **OpenAI SDK constructor:** Added `timeout: 60000` and `maxRetries: 0` (disabled built-in retry to use our own logic)
- **AbortController in fetch:** Added `AbortController` with 60s timeout to `makeDirectEmbeddingRequest()`, converts `AbortError` to HTTP 504 (Gateway Timeout)
- **Retry for 5xx errors:** Extended retry logic in `_embedBatchWithRetries()` to handle both 429 (rate limit) and 500-599 (server errors) with exponential backoff

#### `src/services/code-index/shared/validation-helpers.ts`

- **Updated `getErrorMessageForStatus()`:**
    - 429 → `rateLimitExceeded` (was `serviceUnavailable`)
    - 502 → `badGateway` (new)
    - 503 → `serviceUnavailable` (reused)
    - 504 → `gatewayTimeout` (new)
    - Other 5xx → `serverError` (was `configurationError`)

### 2. Localization (17 files)

Added 5 new i18n keys to `validation` section and 1 new key `serverErrorRetry` to root in all 17 locale files:

| Language              | File                                     |
| --------------------- | ---------------------------------------- |
| English               | `src/i18n/locales/en/embeddings.json`    |
| Russian               | `src/i18n/locales/ru/embeddings.json`    |
| German                | `src/i18n/locales/de/embeddings.json`    |
| Spanish               | `src/i18n/locales/es/embeddings.json`    |
| French                | `src/i18n/locales/fr/embeddings.json`    |
| Hindi                 | `src/i18n/locales/hi/embeddings.json`    |
| Indonesian            | `src/i18n/locales/id/embeddings.json`    |
| Italian               | `src/i18n/locales/it/embeddings.json`    |
| Japanese              | `src/i18n/locales/ja/embeddings.json`    |
| Korean                | `src/i18n/locales/ko/embeddings.json`    |
| Dutch                 | `src/i18n/locales/nl/embeddings.json`    |
| Polish                | `src/i18n/locales/pl/embeddings.json`    |
| Portuguese (BR)       | `src/i18n/locales/pt-BR/embeddings.json` |
| Turkish               | `src/i18n/locales/tr/embeddings.json`    |
| Vietnamese            | `src/i18n/locales/vi/embeddings.json`    |
| Chinese (Simplified)  | `src/i18n/locales/zh-CN/embeddings.json` |
| Chinese (Traditional) | `src/i18n/locales/zh-TW/embeddings.json` |

### 3. Tests

#### `src/services/code-index/embedders/__tests__/openai-compatible.spec.ts`

- Updated existing test: 500 error now retries 3 times (was 1)
- Added `timeout handling` describe block with 2 tests
- Added `5xx retry handling` describe block with 3 tests (502, 503, 504)

#### `src/services/code-index/embedders/__tests__/openai.spec.ts`

- Fixed regression: Updated test expectations for new timeout/maxRetries parameters

#### `src/services/code-index/shared/__tests__/validation-helpers.spec.ts`

- Added `getErrorMessageForStatus` describe block with 10 tests covering all HTTP status codes

## Test Results

- **21 test files** — all passed
- **482 tests** — 0 failed, 0 errors, 0 warnings
- **Duration:** ~9-11s

## Files Changed (21 total)

| File                                                                    | Changes                                         |
| ----------------------------------------------------------------------- | ----------------------------------------------- |
| `src/services/code-index/embedders/openai-compatible.ts`                | Steps 1-4: Timeouts, AbortController, 5xx retry |
| `src/services/code-index/shared/validation-helpers.ts`                  | Step 5: 5xx error messages                      |
| `src/i18n/locales/*/embeddings.json` (17 files)                         | Step 6: i18n keys                               |
| `src/services/code-index/embedders/__tests__/openai-compatible.spec.ts` | Steps 7-8: New tests                            |
| `src/services/code-index/embedders/__tests__/openai.spec.ts`            | Regression fix                                  |
| `src/services/code-index/shared/__tests__/validation-helpers.spec.ts`   | Step 9: New tests                               |

## Architecture

```
Request → {Full URL?} → Yes → makeDirectEmbeddingRequest (AbortController 60s)
                    → No  → OpenAI SDK (timeout 60s, maxRetries 0)
                              ↓
                    Error? → {429 or 5xx?} → Yes → Retry with exponential backoff
                                    → No  → Throw immediately
```

## Impact

- **All OpenAI-compatible embedders benefit:** Gemini, Mistral, VercelAiGateway, OpenRouter
- **No breaking changes:** Existing functionality preserved
- **Better user experience:** Clear error messages for 502/503/504 errors
- **Prevents infinite waits:** 60s timeout on all embedding requests
