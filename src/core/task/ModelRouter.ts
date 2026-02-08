import type { ToolName, ProviderSettings, Experiments, ToolGroup } from "@roo-code/types"

import { modelIdKeysByProvider, isTypicalProvider } from "@roo-code/types"

import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "../../shared/tools"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { buildApiHandler, type ApiHandler } from "../../api"

/**
 * Tool complexity tier used for model routing decisions.
 *
 * - "light": Information-gathering tools (read_file, list_files, search_files, codebase_search)
 * - "standard": All other tools (edit, command, browser, mcp, etc.)
 */
export type ModelTier = "light" | "standard"

/**
 * Set of tool groups considered "light" for routing purposes.
 * Turns that only use tools from these groups (or always-available tools)
 * are eligible for routing to a cheaper model.
 */
const LIGHT_TOOL_GROUPS: ReadonlySet<ToolGroup> = new Set<ToolGroup>(["read"])

/**
 * Build a reverse map from tool name to tool group.
 */
function buildToolToGroupMap(): Map<string, ToolGroup> {
	const map = new Map<string, ToolGroup>()
	for (const [groupName, groupConfig] of Object.entries(TOOL_GROUPS)) {
		for (const tool of groupConfig.tools) {
			map.set(tool, groupName as ToolGroup)
		}
		if (groupConfig.customTools) {
			for (const tool of groupConfig.customTools) {
				map.set(tool, groupName as ToolGroup)
			}
		}
	}
	return map
}

const TOOL_TO_GROUP = buildToolToGroupMap()

/**
 * Always-available tools as a Set for fast lookup.
 * These tools (ask_followup_question, attempt_completion, update_todo_list, etc.)
 * do not affect model tier classification.
 */
const ALWAYS_AVAILABLE_SET = new Set<string>(ALWAYS_AVAILABLE_TOOLS)

/**
 * Determines the tool group for a given tool name.
 * Returns undefined for always-available tools (which are tier-neutral).
 */
export function getToolGroup(toolName: string): ToolGroup | undefined {
	if (ALWAYS_AVAILABLE_SET.has(toolName)) {
		return undefined // Tier-neutral
	}
	return TOOL_TO_GROUP.get(toolName)
}

/**
 * Classifies a set of tool names into a model tier.
 *
 * - If no tools were used → "standard" (pure reasoning, needs full model)
 * - If ALL tools are in light groups or always-available → "light"
 * - If ANY tool is in a non-light group → "standard"
 */
export function classifyToolUsage(toolNames: ReadonlySet<string>): ModelTier {
	if (toolNames.size === 0) {
		return "standard"
	}

	let hasLightTool = false

	for (const toolName of toolNames) {
		const group = getToolGroup(toolName)

		if (group === undefined) {
			// Always-available tool, does not affect classification
			continue
		}

		if (LIGHT_TOOL_GROUPS.has(group)) {
			hasLightTool = true
		} else {
			// Found a non-light tool, immediately classify as standard
			return "standard"
		}
	}

	// If we only found light tools (and possibly always-available ones), classify as light
	return hasLightTool ? "light" : "standard"
}

/**
 * ModelRouter provides heuristic-based model routing for cost optimization.
 *
 * It tracks which tools were used in each API turn and uses that information
 * to decide whether the next API call should use a lighter (cheaper) model
 * or the primary (more capable) model.
 *
 * ## Heuristic (v1)
 * - First turn: always use primary model
 * - If previous turn only used "read" group tools: use light model
 * - If previous turn used edit/command/browser/mcp tools: use primary model
 * - If previous turn had no tool calls (pure reasoning): use primary model
 *
 * ## Usage
 * ```typescript
 * const router = new ModelRouter()
 *
 * // Before each API call
 * if (router.shouldUseLightModel()) {
 *   // Use light model
 * }
 *
 * // During tool execution
 * router.recordToolUse("read_file")
 *
 * // After API turn completes
 * router.endTurn()
 * ```
 */
export class ModelRouter {
	/** Tools used in the current (ongoing) turn */
	private currentTurnTools: Set<string> = new Set()

	/** Classification of the previous (completed) turn */
	private previousTurnTier: ModelTier = "standard"

	/** Whether at least one turn has completed */
	private hasPreviousTurn = false

	/**
	 * Record that a tool was used in the current turn.
	 */
	recordToolUse(toolName: ToolName): void {
		this.currentTurnTools.add(toolName)
	}

	/**
	 * Signal that the current turn has completed.
	 * Moves current turn's tool usage to the "previous turn" classification.
	 */
	endTurn(): void {
		this.previousTurnTier = classifyToolUsage(this.currentTurnTools)
		this.currentTurnTools = new Set()
		this.hasPreviousTurn = true
	}

	/**
	 * Check whether the next API call should use the light model.
	 *
	 * Returns true only if:
	 * - At least one turn has completed (never on first turn)
	 * - The previous turn was classified as "light"
	 */
	shouldUseLightModel(): boolean {
		return this.hasPreviousTurn && this.previousTurnTier === "light"
	}

	/**
	 * Get the current tier classification (for debugging/logging).
	 */
	getCurrentTier(): ModelTier {
		return this.hasPreviousTurn ? this.previousTurnTier : "standard"
	}

	/**
	 * Reset the router state (e.g., when task is restarted).
	 */
	reset(): void {
		this.currentTurnTools = new Set()
		this.previousTurnTier = "standard"
		this.hasPreviousTurn = false
	}

	/**
	 * Check if model routing is enabled based on experiment settings and configuration.
	 *
	 * @param experimentsConfig - The experiments configuration
	 * @param lightModelId - The light model ID from settings
	 * @returns true if model routing is fully configured and enabled
	 */
	static isEnabled(experimentsConfig: Experiments | undefined, lightModelId: string | undefined): boolean {
		if (!experimentsConfig || !lightModelId || lightModelId.trim() === "") {
			return false
		}
		return experiments.isEnabled(experimentsConfig, EXPERIMENT_IDS.MODEL_ROUTING)
	}

	/**
	 * Build a ProviderSettings with the light model ID substituted in place of
	 * the primary model ID. The provider and all other settings remain the same.
	 *
	 * @param baseConfig - The primary provider settings
	 * @param lightModelId - The model ID to use for light tasks
	 * @returns A new ProviderSettings with the light model, or null if the provider
	 *          is not supported for model routing
	 */
	static buildLightModelConfig(baseConfig: ProviderSettings, lightModelId: string): ProviderSettings | null {
		const provider = baseConfig.apiProvider
		if (!provider || !isTypicalProvider(provider)) {
			return null
		}

		const modelIdKey = modelIdKeysByProvider[provider]
		if (!modelIdKey) {
			return null
		}

		return {
			...baseConfig,
			[modelIdKey]: lightModelId,
		}
	}

	/**
	 * Build an ApiHandler configured for the light model.
	 *
	 * @param baseConfig - The primary provider settings
	 * @param lightModelId - The model ID to use for light tasks
	 * @returns An ApiHandler for the light model, or null if routing is not possible
	 */
	static buildLightModelHandler(baseConfig: ProviderSettings, lightModelId: string): ApiHandler | null {
		const lightConfig = ModelRouter.buildLightModelConfig(baseConfig, lightModelId)
		if (!lightConfig) {
			return null
		}
		return buildApiHandler(lightConfig)
	}
}
