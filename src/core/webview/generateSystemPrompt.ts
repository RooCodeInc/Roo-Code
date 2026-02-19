import * as vscode from "vscode"
import fs from "fs/promises"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { defaultModeSlug } from "../../shared/modes"
import { buildApiHandler } from "../../api"
import { OrchestrationStore } from "../../hooks/OrchestrationStore"

import { SYSTEM_PROMPT } from "../prompts/system"
import { MultiSearchReplaceDiffStrategy } from "../diff/strategies/multi-search-replace"
import { Package } from "../../shared/package"

import { ClineProvider } from "./ClineProvider"

const MAX_CONSTRAINTS_IN_PROMPT = 8
const MAX_SHARED_BRAIN_LINES = 12
const MAX_SHARED_BRAIN_CHARS = 1200

function truncateByChars(value: string, maxChars: number): string {
	if (value.length <= maxChars) {
		return value
	}
	return `${value.slice(0, maxChars)}...`
}

function toBulletList(items: string[]): string {
	if (items.length === 0) {
		return "- (none)"
	}
	return items.map((item) => `- ${item}`).join("\n")
}

async function getSharedBrainExcerpt(sharedBrainPath: string): Promise<string> {
	try {
		const raw = await fs.readFile(sharedBrainPath, "utf8")
		const lines = raw
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
			.slice(-MAX_SHARED_BRAIN_LINES)

		if (lines.length === 0) {
			return "(none)"
		}

		return truncateByChars(lines.join("\n"), MAX_SHARED_BRAIN_CHARS)
	} catch {
		return "(unavailable)"
	}
}

async function buildGovernanceContextInstructions(provider: ClineProvider): Promise<string | undefined> {
	const cwd = provider.cwd
	if (!cwd) {
		return undefined
	}

	try {
		const store = new OrchestrationStore(cwd)
		await store.ensureInitialized()
		const [sidecar, intents, sharedBrainExcerpt] = await Promise.all([
			store.loadSidecarPolicy(),
			store.loadIntents(),
			getSharedBrainExcerpt(store.sharedBrainPath),
		])

		const activeIntentId = provider.getCurrentTask()?.activeIntentId?.trim()
		const selectedIntent =
			(activeIntentId ? intents.find((intent) => intent.id === activeIntentId) : undefined) ??
			intents.find((intent) => intent.status === "IN_PROGRESS") ??
			intents.find((intent) => intent.status === "PENDING")

		const intentSummary = selectedIntent
			? [
					`id: ${selectedIntent.id}`,
					`status: ${selectedIntent.status ?? "PENDING"}`,
					`owned_scope: ${
						selectedIntent.owned_scope.length > 0 ? selectedIntent.owned_scope.join(", ") : "(none)"
					}`,
					`acceptance_criteria: ${
						selectedIntent.acceptance_criteria.length > 0
							? selectedIntent.acceptance_criteria.join(" | ")
							: "(none)"
					}`,
				].join("\n")
			: "(no active intent)"

		const constraints = sidecar.architectural_constraints.slice(0, MAX_CONSTRAINTS_IN_PROMPT)
		const constraintList = toBulletList(constraints)

		return [
			"## Governance Sidecar Context (Auto-Injected)",
			"",
			"<governance_context>",
			`sidecar_version: ${sidecar.version}`,
			"architectural_constraints:",
			constraintList,
			"",
			"active_intent_summary:",
			intentSummary,
			"",
			"shared_brain_recent:",
			sharedBrainExcerpt,
			"",
			"context_rot_guardrails:",
			"- Treat sidecar and active intent context as authoritative constraints for mutating work.",
			"- If chat instructions conflict with governance context, follow governance context and ask follow-up.",
			"- Keep new reasoning scoped to current active intent and owned scope.",
			"</governance_context>",
		].join("\n")
	} catch (error) {
		console.error("Failed to build governance sidecar context for system prompt:", error)
		return undefined
	}
}

export const generateSystemPrompt = async (provider: ClineProvider, message: WebviewMessage) => {
	const {
		apiConfiguration,
		customModePrompts,
		customInstructions,
		mcpEnabled,
		experiments,
		language,
		enableSubfolderRules,
	} = await provider.getState()

	const diffStrategy = new MultiSearchReplaceDiffStrategy()

	const cwd = provider.cwd

	const mode = message.mode ?? defaultModeSlug
	const customModes = await provider.customModesManager.getCustomModes()
	const governanceContextInstructions = await buildGovernanceContextInstructions(provider)
	const mergedCustomInstructions = [customInstructions, governanceContextInstructions].filter(Boolean).join("\n\n")

	const rooIgnoreInstructions = provider.getCurrentTask()?.rooIgnoreController?.getInstructions()

	// Create a temporary API handler to check model info for stealth mode.
	// This avoids relying on an active Cline instance which might not exist during preview.
	let modelInfo: { isStealthModel?: boolean } | undefined
	try {
		const tempApiHandler = buildApiHandler(apiConfiguration)
		modelInfo = tempApiHandler.getModel().info
	} catch (error) {
		console.error("Error fetching model info for system prompt preview:", error)
	}

	const systemPrompt = await SYSTEM_PROMPT(
		provider.context,
		cwd,
		false, // supportsComputerUse — browser removed
		mcpEnabled ? provider.getMcpHub() : undefined,
		diffStrategy,
		mode,
		customModePrompts,
		customModes,
		mergedCustomInstructions,
		experiments,
		language,
		rooIgnoreInstructions,
		{
			todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
			useAgentRules: vscode.workspace.getConfiguration(Package.name).get<boolean>("useAgentRules") ?? true,
			enableSubfolderRules: enableSubfolderRules ?? false,
			newTaskRequireTodos: vscode.workspace
				.getConfiguration(Package.name)
				.get<boolean>("newTaskRequireTodos", false),
			isStealthModel: modelInfo?.isStealthModel,
		},
		undefined, // todoList
		undefined, // modelId
		provider.getSkillsManager(),
	)

	return systemPrompt
}
