import { PreHook } from "./PreHook"
import { PostHook } from "./PostHook"
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

    // Run tool
    const result = await fn()

    // Post: Append ledger entry when file context is provided
    if (meta?.filePath && typeof meta.content === "string") {
      await PostHook.log({
        filePath: meta.filePath,
        content: meta.content,
        intentId,
        mutationClass: meta.mutationClass ?? ("INTENT_EVOLUTION" as MutationClass),
        contributorModel: meta.contributorModel,
        astNodeType: meta.astNodeType,
      })
    }
    return result
  }
}
