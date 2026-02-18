export type PreHookResult =
  | { allowed: true; injectedContext?: string }
  | { allowed: false; error: string }

export type PreHook = (toolUse: any, ctx: { cwd: string; intentId?: string }) => Promise<PreHookResult>

export type PostHook = (toolResult: any, ctx: { cwd: string; intentId?: string }) => Promise<void>

// Simple in-memory registries for Phase 0.
const preHooks: PreHook[] = []
const postHooks: PostHook[] = []

export function registerPreHook(h: PreHook) {
  preHooks.push(h)
}

export function registerPostHook(h: PostHook) {
  postHooks.push(h)
}

export async function applyPreHooks(toolUse: any, ctx: { cwd: string; intentId?: string }) {
  for (const h of preHooks) {
    const res = await h(toolUse, ctx)
    if (!res.allowed) return res
    if (res.injectedContext) toolUse._injectedContext = (toolUse._injectedContext || "") + res.injectedContext
  }
  return { allowed: true } as PreHookResult
}

export async function applyPostHooks(toolResult: any, ctx: { cwd: string; intentId?: string }) {
  for (const h of postHooks) {
    await h(toolResult, ctx)
  }
}

// Example placeholder hook: validates presence of intentId for destructive tools.
export async function requireIntentForDestructive(toolUse: any, ctx: { cwd: string; intentId?: string }) {
  const destructive = ["write_to_file", "execute_command", "edit_file", "apply_patch"]
  if (destructive.includes(toolUse.name) && !ctx.intentId) {
    return { allowed: false, error: "Missing intentId: use select_active_intent before mutating operations." }
  }
  return { allowed: true }
}

// Register example hook for Phase 0 automatically so it's visible during review.
registerPreHook(requireIntentForDestructive)
