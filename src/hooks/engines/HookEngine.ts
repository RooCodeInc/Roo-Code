import { PreHook } from "./PreHook"
import { PostHook } from "./PostHook"
import { IntentLockManager } from "./IntentLockManager"
import { detectAstNodeType } from "../utilities/astCapture"
import type { MutationClass } from "../models/AgentTrace"

export type HookMeta = {
  filePath?: string
  content?: string
  mutationClass?: MutationClass
  contributorModel?: string
  astNodeType?: string
}

/**
 * HookEngine provides a deterministic wrapper around tool executions, enforcing
 * intent validation (PreHook) and immutable trace logging (PostHook).
 *
 * Governance-first: No action should proceed without a valid intent.
 */
export class HookEngine {
  static async executeWithHooks<T>(
    fn: () => Promise<T>,
    intentId: string,
    meta?: HookMeta,
  ): Promise<T> {
    // Pre: Validate intent (will throw on invalid/missing)
    await PreHook.validate(intentId)

    // Acquire intent lock to avoid parallel collisions
    const locks = new IntentLockManager()
    const owner = meta?.contributorModel ?? "HookEngine"
    const acquired = await locks.acquire(intentId, owner)
    if (!acquired) {
      throw new Error(`Intent lock is held for ${intentId}. Try again later.`)
    }

    let result: T
    try {
      // Run tool
      result = await fn()

      // Post: Append ledger entry when file context is provided
      if (meta?.filePath && typeof meta.content === "string") {
        const astNodeType =
          meta.astNodeType ?? detectAstNodeType(meta.filePath, meta.content)
        await PostHook.log({
          filePath: meta.filePath,
          content: meta.content,
          intentId,
          mutationClass: meta.mutationClass ?? ("INTENT_EVOLUTION" as MutationClass),
          contributorModel: meta.contributorModel,
          astNodeType,
        })
      }
      return result
    } finally {
      // Always release the lock
      await locks.release(intentId, owner)
    }
  }
}
