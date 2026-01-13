import type { ModelInfo, SessionMode } from "@agentclientprotocol/sdk"

export const DEFAULT_MODELS: ModelInfo[] = [
	{
		modelId: "anthropic/claude-opus-4.5",
		name: "Claude Opus 4.5",
		description: "Most capable for complex work",
	},
	{
		modelId: "anthropic/claude-sonnet-4.5",
		name: "Claude Sonnet 4.5",
		description: "Best balance of speed and capability",
	},
	{
		modelId: "anthropic/claude-haiku-4.5",
		name: "Claude Haiku 4.5",
		description: "Fastest for quick answers",
	},
]

export const AVAILABLE_MODES: SessionMode[] = [
	{
		id: "code",
		name: "Code",
		description: "Write, modify, and refactor code",
	},
	{
		id: "architect",
		name: "Architect",
		description: "Plan and design system architecture",
	},
	{
		id: "ask",
		name: "Ask",
		description: "Ask questions and get explanations",
	},
	{
		id: "debug",
		name: "Debug",
		description: "Debug issues and troubleshoot problems",
	},
]
