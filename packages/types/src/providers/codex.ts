import type { ModelInfo, ReasoningEffortWithMinimal } from "../model.js"
import { openAiNativeModels } from "./openai.js"

export type CodexModelId =
	| "gpt-5-codex"
	| "gpt-5-codex-minimal"
	| "gpt-5-codex-low"
	| "gpt-5-codex-medium"
	| "gpt-5-codex-high"
	| "gpt-5"
	| "gpt-5-minimal"
	| "gpt-5-low"
	| "gpt-5-medium"
	| "gpt-5-high"
	| "codex-mini-latest"

export type CodexCliModelInfo = {
	id: string
	label?: string
	description?: string
	model?: string
	effort?: ReasoningEffortWithMinimal
}

export interface CodexCliPreset {
	id: CodexModelId
	label: string
	description: string
	cliModel: string
	effort?: ReasoningEffortWithMinimal
}

export const codexDefaultModelId: CodexModelId = "gpt-5-codex"

const CLI_DEFAULT_MODEL = "gpt-5"

const codexBaseModelInfo: ModelInfo = {
	...openAiNativeModels["gpt-5-2025-08-07"],
	supportsReasoningEffort: true,
}

export const codexCliPresets: CodexCliPreset[] = [
	{
		id: "gpt-5-codex",
		label: "gpt-5-codex (auto)",
		description: "— uses your Codex CLI default reasoning effort",
		cliModel: CLI_DEFAULT_MODEL,
	},
	{
		id: "gpt-5-codex-minimal",
		label: "gpt-5-codex minimal",
		description: "— fastest responses with limited reasoning; ideal for lightweight edits and quick fixes",
		cliModel: CLI_DEFAULT_MODEL,
		effort: "minimal",
	},
	{
		id: "gpt-5-codex-low",
		label: "gpt-5-codex low",
		description: "— prioritises speed while keeping some reasoning depth for straightforward coding tasks",
		cliModel: CLI_DEFAULT_MODEL,
		effort: "low",
	},
	{
		id: "gpt-5-codex-medium",
		label: "gpt-5-codex medium",
		description: "— balanced reasoning for everyday development work (Codex CLI default)",
		cliModel: CLI_DEFAULT_MODEL,
		effort: "medium",
	},
	{
		id: "gpt-5-codex-high",
		label: "gpt-5-codex high",
		description: "— maximum reasoning depth for complex or ambiguous engineering problems",
		cliModel: CLI_DEFAULT_MODEL,
		effort: "high",
	},
]

const legacyRedirectEntries: ReadonlyArray<[string, CodexModelId]> = [
	["gpt-5", "gpt-5-codex"],
	["gpt-5-minimal", "gpt-5-codex-minimal"],
	["gpt-5-low", "gpt-5-codex-low"],
	["gpt-5-medium", "gpt-5-codex-medium"],
	["gpt-5-high", "gpt-5-codex-high"],
	["gpt-5-codex", "gpt-5-codex"],
	["gpt-5-codex-minimal", "gpt-5-codex-minimal"],
	["gpt-5-codex-low", "gpt-5-codex-low"],
	["gpt-5-codex-medium", "gpt-5-codex-medium"],
	["gpt-5-codex-high", "gpt-5-codex-high"],
	["codex-mini-latest", "codex-mini-latest"],
]

export const codexLegacyModelRedirects: Record<string, CodexModelId> = Object.fromEntries(legacyRedirectEntries)

const presetMap = new Map<CodexModelId, CodexCliPreset>()

for (const preset of codexCliPresets) {
	presetMap.set(preset.id, preset)
}

for (const [legacyId, targetId] of legacyRedirectEntries) {
	const target = presetMap.get(targetId as CodexModelId)
	if (target && !presetMap.has(legacyId as CodexModelId)) {
		presetMap.set(legacyId as CodexModelId, {
			...target,
			id: legacyId as CodexModelId,
		})
	}
}

const derivedModels: Record<string, ModelInfo> = {}

for (const preset of presetMap.values()) {
	derivedModels[preset.id] = {
		...codexBaseModelInfo,
		description: preset.description || codexBaseModelInfo.description,
	}
}

if (openAiNativeModels["codex-mini-latest"]) {
	derivedModels["codex-mini-latest"] = {
		...openAiNativeModels["codex-mini-latest"],
		supportsReasoningEffort: true,
	}
}

export const codexModels = derivedModels as Record<CodexModelId, ModelInfo>

export const fallbackCodexCliModels: CodexCliModelInfo[] = codexCliPresets.map((preset) => ({
	id: preset.id,
	label: preset.label,
	description: preset.description,
	model: preset.cliModel,
	effort: preset.effort,
}))

export const normalizeCodexModelId = (id?: string | null): CodexModelId => {
	const trimmed = (id ?? "").trim()
	if (!trimmed) {
		return codexDefaultModelId
	}
	return (codexLegacyModelRedirects[trimmed] ?? trimmed) as CodexModelId
}

export const getCodexPreset = (id: string | undefined) => {
	const normalized = normalizeCodexModelId(id)
	return presetMap.get(normalized)
}
