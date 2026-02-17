import * as vscode from "vscode"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { defaultModeSlug } from "../../shared/modes"
import { buildApiHandler } from "../../api"

import { SYSTEM_PROMPT } from "../prompts/system"
import { PreHook } from "../../hooks/engines/PreHook"
import { buildIntentContextBlock, buildIntentHandshakeInstruction } from "../../hooks/utilities/intentContext"
import { MultiSearchReplaceDiffStrategy } from "../diff/strategies/multi-search-replace"
import { Package } from "../../shared/package"

import { ClineProvider } from "./ClineProvider"

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

	const basePrompt = await SYSTEM_PROMPT(
		provider.context,
		cwd,
		false, // supportsComputerUse — browser removed
		mcpEnabled ? provider.getMcpHub() : undefined,
		diffStrategy,
		mode,
		customModePrompts,
		customModes,
		customInstructions,
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

	// Reasoning Intercept: dynamically inject intent context into the final prompt
	const state = await provider.getState()
	const activeIntentId = state?.activeIntentId ?? "INT-001"
	const intent = await PreHook.validate(activeIntentId)
	const intentBlock = buildIntentContextBlock(intent)
	const handshake = buildIntentHandshakeInstruction()

	return `${handshake}\n\n${intentBlock}\n\n${basePrompt}`
}
