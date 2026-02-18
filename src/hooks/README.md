# Hook System Scaffold

This directory is the clean scaffold for the TRP1 hook middleware.

## Goal

Provide an isolated pre-tool and post-tool interception layer that can be wired into the extension host runtime without mixing hook logic into the main tool loop.

## Current Contents

- `types.ts`: Shared contracts for pre and post hooks.
- `HookEngine.ts`: Composable middleware runner with fail-safe behavior.
- `builtin/RequireIntentPreHook.ts`: Starter pre-hook for intent handshake enforcement.
- `builtin/TraceMutationPostHook.ts`: Starter post-hook for mutation trace updates.
- `index.ts`: Exports for hook module entry.

## Integration Target

Wire `HookEngine` into `src/core/assistant-message/presentAssistantMessage.ts` at:

- pre-hook stage before the native tool dispatch switch
- post-hook stage after each tool execution and before next content block
