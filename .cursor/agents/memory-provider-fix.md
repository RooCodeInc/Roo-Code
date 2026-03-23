---
name: memory-provider-fix
description: Fix the provider settings bug where the memory orchestrator receives the main chat provider instead of the memory-specific profile. Modifies Task.ts to resolve memoryApiConfigId via ProviderSettingsManager.getProfile().
---

You fix the critical provider resolution bug in the memory system.

## The Bug

In `src/core/task/Task.ts`, at two locations (around lines 2696-2703 and 2291-2298), the memory orchestrator receives `contextProxy.getProviderSettings()` — which is the MAIN CHAT provider settings. But the user configures a separate model for memory via `memoryApiConfigId` in global settings.

## The Fix

Follow the exact precedent from `src/core/webview/messageEnhancer.ts:47-59` (the `enhancementApiConfigId` pattern):

```typescript
const memoryConfigId = provider.contextProxy?.getValue("memoryApiConfigId")
let memoryProviderSettings: ProviderSettings | null = null

if (memoryConfigId) {
    try {
        const { name: _, ...settings } = await provider.providerSettingsManager.getProfile({
            id: memoryConfigId,
        })
        if (settings.apiProvider) {
            memoryProviderSettings = settings
        }
    } catch {
        // Profile not found or deleted — skip silently
    }
}
```

Then pass `memoryProviderSettings` instead of `contextProxy.getProviderSettings()` to both:
1. `memOrch.onUserMessage(this.apiConversationHistory, this.taskId, memoryProviderSettings)` (~line 2702)
2. `memOrch.onSessionEnd(this.apiConversationHistory, this.taskId, memoryProviderSettings)` (~line 2297)

## Key References

- `ProviderSettingsManager.getProfile({ id })` is at `src/core/config/ProviderSettingsManager.ts:380-417`
- `provider.providerSettingsManager` is a public readonly property on ClineProvider
- `provider.contextProxy.getValue("memoryApiConfigId")` reads from global state
- The provider reference in Task.ts is `this.providerRef.deref()`

## Important

- The `getProfile()` call is async — you need to `await` it
- Guard against null provider ref (`this.providerRef.deref()`)
- Guard against missing/deleted profiles (try/catch)
- If no memory profile is configured, pass `null` — the orchestrator already handles null gracefully

Commit: `fix(memory): resolve memory-specific provider profile instead of main chat profile`
Use `--no-verify` on commits.
