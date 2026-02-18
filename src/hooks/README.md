# Hooks Directory

This directory is reserved for the Hook Engine.

### Implementation Note:

[cite_start]For the Phase 1 Handshake, the **Pre-Hook** logic (The Gatekeeper) has been integrated directly into `src/core/tools/WriteToFileTool.ts` and `ExecuteCommandTool.ts`. [cite_start]This ensures deterministic enforcement of the **Two-Stage State Machine**, preventing any file modifications unless a valid Intent ID is globally active.
