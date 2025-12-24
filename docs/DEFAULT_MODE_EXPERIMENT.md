# Default Mode Feature Flag Experiment

This document describes the PostHog feature flag experiment for controlling the default mode shown to new users.

## Overview

The default mode experiment allows us to A/B test whether new users should see **Code** mode or **Architect** mode as their default starting mode.

## Feature Flag

- **Flag Key**: `default-mode-experiment`
- **Location**: `src/shared/modes.ts` - `DEFAULT_MODE_FEATURE_FLAG` constant

## How It Works

1. When a new user first uses Roo Code (no mode has been set), the system checks the PostHog feature flag
2. Based on the flag value, the default mode is set:

    - `undefined` or `null`: Falls back to **Code** mode (control)
    - `"architect"` (string): Sets **Architect** mode
    - `"code"` (string): Sets **Code** mode
    - `true` (boolean): Sets **Architect** mode (experiment variant)
    - `false` (boolean): Sets **Code** mode (control variant)

3. The mode is only set once for new users - existing users with a mode already set are not affected

## Implementation Details

### Key Files

- `packages/telemetry/src/PostHogTelemetryClient.ts`: Added `getFeatureFlag()` method
- `packages/telemetry/src/TelemetryService.ts`: Added feature flag checking
- `src/shared/modes.ts`: Added feature flag constants and logic
- `src/core/webview/ClineProvider.ts`: Integrated feature flag checking on initialization

### Code Flow

```
ClineProvider constructor
  ↓
initializeDefaultModeForNewUsers()
  ↓
Check if mode is already set
  ↓ (only for new users)
TelemetryService.getFeatureFlag(DEFAULT_MODE_FEATURE_FLAG)
  ↓
PostHogTelemetryClient.getFeatureFlag()
  ↓
getDefaultModeFromFeatureFlag(flagValue)
  ↓
Set mode in global state
```

### Feature Flag Values

Configure the feature flag in PostHog with one of these values:

- **String values**: `"architect"` or `"code"`
- **Boolean values**: `true` (architect) or `false` (code)
- **Rollout**: Use PostHog's percentage rollout to A/B test

## Testing

Tests are located in:

- `src/shared/__tests__/modes-feature-flag.spec.ts` - Tests for mode selection logic
- `packages/telemetry/src/__tests__/PostHogTelemetryClient.featureFlags.test.ts` - Tests for feature flag fetching

Run tests:

```bash
cd src && npx vitest run shared/__tests__/modes-feature-flag.spec.ts
```

## Metrics to Track

Track in PostHog:

- New user signups with each variant
- Task completion rates by default mode
- Mode switching behavior (do users stay in default mode or switch?)
- Time to first task completion
- User retention by initial mode

## Rollback

If issues arise, set the feature flag to `false` or `"code"` to revert all new users to Code mode.

## Future Enhancements

- Add telemetry event when default mode is set via feature flag
- Track which users were part of the experiment
- Consider adding more mode options to the experiment
