# Merge Conflict Resolution Notes

### Changes Made:

#### 1. Conservative Token Limits:

- Introduced `CEREBRAS_DEFAULT_MAX_TOKENS` with a value of `8_192` to avoid premature rate limiting.
- Updated logic to use this conservative default instead of the model maximum.

#### 2. Integration Tracking:

- Added `X-Cerebras-3rd-Party-Integration: roocode` header to all Cerebras API requests.

#### 3. Model Cleanup:

- Removed outdated models:
    - `qwen-3-coder-480b-free`
    - `qwen-3-coder-480b`
    - `qwen-3-235b-a22b-thinking-2507`
- Updated `src/api/providers/cerebras.ts` to remove deprecated model mapping logic.

### Files Affected:

1. **`packages/types/src/providers/cerebras.ts`**

    - Removed outdated models.

2. **`src/api/providers/cerebras.ts`**
    - Added `CEREBRAS_DEFAULT_MAX_TOKENS` and `CEREBRAS_INTEGRATION_HEADER` constants.
    - Updated `getModel` logic to validate model IDs.
    - Updated API request logic to include the new header and use conservative token limits.

### Testing Notes:

- Verified functionality with `zai-glm-4.6` and `gpt-oss-120b` models.
- Confirmed that the new headers are included in API requests.
- Ensured that the application builds and passes all linting/type checks.

### Next Steps:

- Copy these changes into the appropriate files to resolve conflicts.
- Re-test the application to ensure everything works as expected.
