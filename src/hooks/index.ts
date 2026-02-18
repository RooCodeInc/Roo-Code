/**
 * Hook registry for the governed execution pipeline.
 *
 * NOTE:
 * This module is intentionally not wired yet.
 * Integration will occur at the tool execution boundary
 * (agent → tool runner) in Phase 1.
 *
 * Planned call site:
 *   extension → toolRunner → HookEngine(preHooks/postHooks)
 */

import { contextLoader } from "./preHooks/contextLoader"
import { intentValidator } from "./preHooks/intentValidator"
import { traceLogger } from "./postHooks/traceLogger"
import { docUpdater } from "./postHooks/docUpdater"
import { selectActiveIntent } from "./tools/selectActiveIntent"
import { runWithHooks } from "./engine"

export const preHooks = [contextLoader, intentValidator]
export const postHooks = [traceLogger, docUpdater]

export { selectActiveIntent, runWithHooks }
