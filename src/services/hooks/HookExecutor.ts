/**
 * HookExecutor runs prompt-based hooks by sending the hook prompt (with context)
 * to the configured API provider via the singleCompletionHandler.
 *
 * Hooks are read-only: they have no tool access and can only produce advisory text.
 * The advisory text is injected into the conversation as informational context.
 */

import type { ProviderSettings } from "@roo-code/types"

import { singleCompletionHandler } from "../../utils/single-completion-handler"
import type { HookDefinition, HookEventName, HookContext, HookResult } from "../../shared/hooks"

/**
 * Builds a full prompt string from the hook definition and context.
 */
export function buildHookPrompt(hook: HookDefinition, context: HookContext): string {
	const parts: string[] = []

	parts.push("You are a hook that runs at a specific point in an AI coding assistant's workflow.")
	parts.push("Your role is advisory only - you cannot use tools or take actions.")
	parts.push("Provide concise, actionable feedback based on the context below.")
	parts.push("")

	parts.push(`## Event: ${context.event}`)
	parts.push("")

	if (context.toolName) {
		parts.push(`**Tool:** ${context.toolName}`)
	}

	if (context.toolInput) {
		parts.push(`**Tool Input:**`)
		parts.push("```json")
		try {
			parts.push(JSON.stringify(context.toolInput, null, 2))
		} catch {
			parts.push("(unable to serialize tool input)")
		}
		parts.push("```")
	}

	if (context.toolResult) {
		parts.push(`**Tool Result:**`)
		// Truncate very long results
		const maxResultLen = 2000
		const truncated =
			context.toolResult.length > maxResultLen
				? context.toolResult.slice(0, maxResultLen) + "\n... (truncated)"
				: context.toolResult
		parts.push(truncated)
	}

	if (context.completionResult) {
		parts.push(`**Completion Result:**`)
		parts.push(context.completionResult)
	}

	if (context.conversationSummary) {
		parts.push("")
		parts.push("## Recent Conversation Context")
		// Truncate to keep within reasonable limits
		const maxContextLen = 4000
		const truncated =
			context.conversationSummary.length > maxContextLen
				? context.conversationSummary.slice(0, maxContextLen) + "\n... (truncated)"
				: context.conversationSummary
		parts.push(truncated)
	}

	parts.push("")
	parts.push("## Your Task")
	parts.push(hook.prompt)

	return parts.join("\n")
}

/**
 * Executes a single hook and returns the result.
 */
export async function executeHook(
	hook: HookDefinition,
	context: HookContext,
	apiConfiguration: ProviderSettings,
	hookIndex: number,
): Promise<HookResult | null> {
	try {
		const prompt = buildHookPrompt(hook, context)
		const output = await singleCompletionHandler(apiConfiguration, prompt)

		if (!output || output.trim().length === 0) {
			return null
		}

		return {
			output: output.trim(),
			event: context.event,
			hookIndex,
		}
	} catch (error) {
		console.warn(`[HookExecutor] Failed to execute hook (${context.event}[${hookIndex}]):`, error)
		return null
	}
}

/**
 * Executes all matching hooks for an event and returns their combined results.
 * Hooks are executed sequentially to avoid overwhelming the API.
 */
export async function executeHooks(
	hooks: HookDefinition[],
	context: HookContext,
	apiConfiguration: ProviderSettings,
): Promise<HookResult[]> {
	const results: HookResult[] = []

	for (let i = 0; i < hooks.length; i++) {
		const result = await executeHook(hooks[i], context, apiConfiguration, i)

		if (result) {
			results.push(result)
		}
	}

	return results
}

/**
 * Formats hook results into a text block that can be injected into the
 * conversation context.
 */
export function formatHookResults(results: HookResult[]): string {
	if (results.length === 0) {
		return ""
	}

	const parts: string[] = []
	parts.push("[Hook Advisory Output]")

	for (const result of results) {
		parts.push(result.output)
	}

	parts.push("[End Hook Advisory Output]")

	return parts.join("\n\n")
}
