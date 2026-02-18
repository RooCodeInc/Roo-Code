import * as vscode from "vscode"

// Core hook types and a minimal HookEngine scaffolding.
// This file provides registration and invocation primitives for Pre/Post hooks.

export type HookContext = {
	toolName: string
	params: Record<string, unknown>
	intentId?: string
	userSessionId?: string
}

export type PreHookResult =
	| { action: "allow" }
	| { action: "block"; error: { code: string; message: string } }
	| { action: "waitForApproval"; approvalId: string }

export type PreHook = (ctx: HookContext) => Promise<PreHookResult>
export type PostHook = (ctx: HookContext & { result: unknown }) => Promise<void>

export class HookEngine {
	private preHooks: PreHook[] = []
	private postHooks: PostHook[] = []

	registerPreHook(hook: PreHook) {
		this.preHooks.push(hook)
	}

	unregisterPreHook(hook: PreHook) {
		this.preHooks = this.preHooks.filter((h) => h !== hook)
	}

	registerPostHook(hook: PostHook) {
		this.postHooks.push(hook)
	}

	unregisterPostHook(hook: PostHook) {
		this.postHooks = this.postHooks.filter((h) => h !== hook)
	}

	// Run PreHooks in sequence. If any hook blocks, short-circuit and return it.
	async runPreHooks(ctx: HookContext): Promise<PreHookResult> {
		for (const hook of this.preHooks) {
			try {
				const res = await hook(ctx)
				if (res.action === "block" || res.action === "waitForApproval") {
					return res
				}
			} catch (err) {
				console.error("PreHook threw error:", err)
				// Fail-safe: block on unexpected errors to avoid unsafely permitting destructive actions
				return { action: "block", error: { code: "HOOK_ERROR", message: String(err) } }
			}
		}
		return { action: "allow" }
	}

	// Run PostHooks but don't block on errors; log them instead.
	async runPostHooks(ctx: HookContext & { result: unknown }): Promise<void> {
		for (const hook of this.postHooks) {
			try {
				await hook(ctx)
			} catch (err) {
				console.error("PostHook threw error:", err)
			}
		}
	}

	// Utility: small approval helper that shows a VS Code modal and returns boolean.
	// Consumers may implement more advanced UI via the webview.
	async requestApproval(prompt: string): Promise<boolean> {
		const choice = await vscode.window.showWarningMessage(prompt, { modal: true }, "Approve", "Reject")
		return choice === "Approve"
	}
}

export const defaultHookEngine = new HookEngine()

// Small helper to classify destructive tools (expand as needed)
export function isDestructiveTool(toolName: string): boolean {
	const destructive = ["write_to_file", "execute_command", "apply_patch", "edit_file", "apply_diff"]
	return destructive.includes(toolName)
}
