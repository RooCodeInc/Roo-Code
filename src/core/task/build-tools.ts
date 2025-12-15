import type OpenAI from "openai"
import type { ProviderSettings, ModeConfig, ModelInfo } from "@roo-code/types"
import type { ClineProvider } from "../webview/ClineProvider"
import { getNativeTools, getMcpServerTools } from "../prompts/tools/native-tools"
import { filterNativeToolsForMode, filterMcpToolsForMode } from "../prompts/tools/filter-tools-for-mode"
import { experiments as experimentsModule, EXPERIMENT_IDS } from "../../shared/experiments"

interface BuildToolsOptions {
	provider: ClineProvider
	cwd: string
	mode: string | undefined
	customModes: ModeConfig[] | undefined
	experiments: Record<string, boolean> | undefined
	apiConfiguration: ProviderSettings | undefined
	maxReadFileLine: number
	browserToolEnabled: boolean
	modelInfo?: ModelInfo
	diffEnabled: boolean
}

/**
 * Builds the complete tools array for native protocol requests.
 * Combines native tools and MCP tools, filtered by mode restrictions.
 *
 * @param options - Configuration options for building the tools
 * @returns Array of filtered native and MCP tools
 */
export async function buildNativeToolsArray(options: BuildToolsOptions): Promise<OpenAI.Chat.ChatCompletionTool[]> {
	const {
		provider,
		cwd,
		mode,
		customModes,
		experiments,
		apiConfiguration,
		maxReadFileLine,
		browserToolEnabled,
		modelInfo,
		diffEnabled,
	} = options

	const mcpHub = provider.getMcpHub()

	// Get CodeIndexManager for feature checking
	const { CodeIndexManager } = await import("../../services/code-index/manager")
	const codeIndexManager = CodeIndexManager.getInstance(provider.context, cwd)

	// Build settings object for tool filtering
	const filterSettings = {
		todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
		browserToolEnabled: browserToolEnabled ?? true,
		modelInfo,
		diffEnabled,
	}

	// Determine if partial reads are enabled based on maxReadFileLine setting
	const partialReadsEnabled = maxReadFileLine !== -1

	// Determine if multi-file apply_diff is enabled based on experiment flag
	const multiFileApplyDiffEnabled = experimentsModule.isEnabled(
		experiments ?? {},
		EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF,
	)

	// Build native tools with dynamic read_file and apply_diff tools based on settings
	const nativeTools = getNativeTools(partialReadsEnabled, multiFileApplyDiffEnabled)

	// Filter native tools based on mode restrictions
	const filteredNativeTools = filterNativeToolsForMode(
		nativeTools,
		mode,
		customModes,
		experiments,
		codeIndexManager,
		filterSettings,
		mcpHub,
	)

	// Filter MCP tools based on mode restrictions
	const mcpTools = getMcpServerTools(mcpHub)
	const filteredMcpTools = filterMcpToolsForMode(mcpTools, mode, customModes, experiments)

	return [...filteredNativeTools, ...filteredMcpTools]
}
