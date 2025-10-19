## Summary

Enables the Roo Code extension to dynamically load available models from the Roo Code Cloud provider via the `/v1/models` endpoint.

## Changes

- **New fetcher**: Added `getRooModels()` function to fetch models from Roo Code Cloud `/v1/models` endpoint
- **Dynamic provider**: Added "roo" to the list of dynamic providers
- **Type updates**: Updated RooHandler to support dynamic model IDs (changed from `RooModelId` to `string`)
- **Model caching**: Integrated with existing modelCache infrastructure for efficient caching
- **Graceful fallback**: Falls back to static model definitions if dynamic loading fails

## Technical Details

### Model Loading Strategy

- Models are loaded asynchronously on handler initialization
- Dynamic models are merged with static models (static definitions take precedence)
- Uses 5-minute memory cache + file cache from existing infrastructure
- 10-second timeout prevents hanging on network issues

### Type Safety

- Maintains backward compatibility with existing static models
- Generic type changed from `RooModelId` to `string` to support dynamic model IDs
- All type definitions updated across shared/api.ts and provider-settings.ts

## Testing

- Linting passes
- Type checks pass
- Follows patterns from other dynamic providers (requesty, glama, unbound)
- Error handling with descriptive logging

## Related

This PR works in conjunction with Roo-Code-Cloud PR #1316 which adds the `/v1/models` endpoint.
