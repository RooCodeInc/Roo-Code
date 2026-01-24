/**
 * Terminal Output Handling Module
 *
 * This module provides utilities for capturing, persisting, and retrieving
 * command output from terminal executions.
 *
 * ## Overview
 *
 * When the LLM executes commands via `execute_command`, the output can be
 * very large (build logs, test output, etc.). To prevent context window
 * overflow while still allowing access to full output, this module
 * implements a "persisted output" pattern:
 *
 * 1. **OutputInterceptor**: Buffers command output during execution. If
 *    output exceeds a configurable threshold, it "spills" to disk and
 *    keeps only a preview in memory.
 *
 * 2. **Artifact Storage**: Full outputs are stored as text files in the
 *    task's `command-output/` directory with names like `cmd-{timestamp}.txt`.
 *
 * 3. **ReadCommandOutputTool**: Allows the LLM to retrieve the full output
 *    later via the `read_command_output` tool, with support for search
 *    and pagination.
 *
 * ## Data Flow
 *
 * ```
 * execute_command
 *       │
 *       ▼
 * OutputInterceptor.write()  ──► Buffer accumulates
 *       │
 *       ▼ (threshold exceeded)
 * OutputInterceptor.spillToDisk()  ──► Artifact file created
 *       │
 *       ▼
 * OutputInterceptor.finalize()  ──► Returns PersistedCommandOutput
 *       │
 *       ▼
 * LLM receives preview + artifact_id
 *       │
 *       ▼ (if needs full output)
 * read_command_output(artifact_id)  ──► Full content/search results
 * ```
 *
 * ## Configuration
 *
 * Preview size is controlled by `terminalOutputPreviewSize` setting:
 * - `small`: 2KB preview
 * - `medium`: 4KB preview (default)
 * - `large`: 8KB preview
 *
 * @module terminal
 */

export { OutputInterceptor } from "./OutputInterceptor"
export type { OutputInterceptorOptions } from "./OutputInterceptor"
