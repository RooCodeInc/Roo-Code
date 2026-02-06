import type { ToolName, ProviderSettings, Experiments } from "@roo-code/types"

import { ModelRouter, classifyToolUsage, getToolGroup, type ModelTier } from "../ModelRouter"

describe("getToolGroup", () => {
	it("returns 'read' for read group tools", () => {
		expect(getToolGroup("read_file")).toBe("read")
		expect(getToolGroup("search_files")).toBe("read")
		expect(getToolGroup("list_files")).toBe("read")
		expect(getToolGroup("codebase_search")).toBe("read")
	})

	it("returns 'edit' for edit group tools", () => {
		expect(getToolGroup("apply_diff")).toBe("edit")
		expect(getToolGroup("write_to_file")).toBe("edit")
	})

	it("returns 'command' for command group tools", () => {
		expect(getToolGroup("execute_command")).toBe("command")
		expect(getToolGroup("read_command_output")).toBe("command")
	})

	it("returns 'browser' for browser group tools", () => {
		expect(getToolGroup("browser_action")).toBe("browser")
	})

	it("returns 'mcp' for mcp group tools", () => {
		expect(getToolGroup("use_mcp_tool")).toBe("mcp")
		expect(getToolGroup("access_mcp_resource")).toBe("mcp")
	})

	it("returns undefined for always-available tools including mode tools (tier-neutral)", () => {
		// switch_mode and new_task are in ALWAYS_AVAILABLE_TOOLS, so they are tier-neutral
		expect(getToolGroup("switch_mode")).toBeUndefined()
		expect(getToolGroup("new_task")).toBeUndefined()
		expect(getToolGroup("ask_followup_question")).toBeUndefined()
		expect(getToolGroup("attempt_completion")).toBeUndefined()
		expect(getToolGroup("update_todo_list")).toBeUndefined()
		expect(getToolGroup("run_slash_command")).toBeUndefined()
		expect(getToolGroup("skill")).toBeUndefined()
	})
})

describe("classifyToolUsage", () => {
	it('returns "standard" when no tools were used', () => {
		expect(classifyToolUsage(new Set())).toBe("standard")
	})

	it('returns "light" when only read tools were used', () => {
		expect(classifyToolUsage(new Set(["read_file"]))).toBe("light")
		expect(classifyToolUsage(new Set(["read_file", "search_files"]))).toBe("light")
		expect(classifyToolUsage(new Set(["read_file", "list_files", "codebase_search"]))).toBe("light")
	})

	it('returns "light" when read tools and always-available tools are used', () => {
		expect(classifyToolUsage(new Set(["read_file", "ask_followup_question"]))).toBe("light")
		expect(classifyToolUsage(new Set(["search_files", "update_todo_list"]))).toBe("light")
	})

	it('returns "standard" when only always-available tools are used (no read tools)', () => {
		// Only always-available tools - no light tools present, so "standard"
		expect(classifyToolUsage(new Set(["ask_followup_question"]))).toBe("standard")
		expect(classifyToolUsage(new Set(["update_todo_list"]))).toBe("standard")
		expect(classifyToolUsage(new Set(["attempt_completion"]))).toBe("standard")
	})

	it('returns "standard" when any edit tool is used', () => {
		expect(classifyToolUsage(new Set(["read_file", "apply_diff"]))).toBe("standard")
		expect(classifyToolUsage(new Set(["write_to_file"]))).toBe("standard")
	})

	it('returns "standard" when any command tool is used', () => {
		expect(classifyToolUsage(new Set(["read_file", "execute_command"]))).toBe("standard")
	})

	it('returns "standard" when any browser tool is used', () => {
		expect(classifyToolUsage(new Set(["read_file", "browser_action"]))).toBe("standard")
	})

	it('returns "standard" when any mcp tool is used', () => {
		expect(classifyToolUsage(new Set(["use_mcp_tool"]))).toBe("standard")
	})
})

describe("ModelRouter", () => {
	let router: ModelRouter

	beforeEach(() => {
		router = new ModelRouter()
	})

	describe("shouldUseLightModel", () => {
		it("returns false on first turn (no previous turn)", () => {
			expect(router.shouldUseLightModel()).toBe(false)
		})

		it("returns false after first turn with no tools", () => {
			router.endTurn()
			expect(router.shouldUseLightModel()).toBe(false)
		})

		it("returns true after a turn with only read tools", () => {
			router.recordToolUse("read_file" as ToolName)
			router.recordToolUse("search_files" as ToolName)
			router.endTurn()
			expect(router.shouldUseLightModel()).toBe(true)
		})

		it("returns false after a turn with edit tools", () => {
			router.recordToolUse("read_file" as ToolName)
			router.recordToolUse("apply_diff" as ToolName)
			router.endTurn()
			expect(router.shouldUseLightModel()).toBe(false)
		})

		it("returns false after a turn with command tools", () => {
			router.recordToolUse("execute_command" as ToolName)
			router.endTurn()
			expect(router.shouldUseLightModel()).toBe(false)
		})

		it("returns true when read tools + always-available tools used", () => {
			router.recordToolUse("read_file" as ToolName)
			router.recordToolUse("update_todo_list" as ToolName)
			router.endTurn()
			expect(router.shouldUseLightModel()).toBe(true)
		})

		it("tracks multiple turns correctly", () => {
			// Turn 1: read only -> next should use light
			router.recordToolUse("read_file" as ToolName)
			router.endTurn()
			expect(router.shouldUseLightModel()).toBe(true)

			// Turn 2: edit -> next should use standard
			router.recordToolUse("write_to_file" as ToolName)
			router.endTurn()
			expect(router.shouldUseLightModel()).toBe(false)

			// Turn 3: read only again -> next should use light
			router.recordToolUse("list_files" as ToolName)
			router.endTurn()
			expect(router.shouldUseLightModel()).toBe(true)
		})
	})

	describe("getCurrentTier", () => {
		it('returns "standard" before any turn completes', () => {
			expect(router.getCurrentTier()).toBe("standard")
		})

		it('returns "light" after a read-only turn', () => {
			router.recordToolUse("read_file" as ToolName)
			router.endTurn()
			expect(router.getCurrentTier()).toBe("light")
		})
	})

	describe("reset", () => {
		it("resets router state to initial", () => {
			router.recordToolUse("read_file" as ToolName)
			router.endTurn()
			expect(router.shouldUseLightModel()).toBe(true)

			router.reset()
			expect(router.shouldUseLightModel()).toBe(false)
			expect(router.getCurrentTier()).toBe("standard")
		})
	})

	describe("isEnabled", () => {
		it("returns false when experiments is undefined", () => {
			expect(ModelRouter.isEnabled(undefined, "some-model")).toBe(false)
		})

		it("returns false when lightModelId is undefined", () => {
			const experiments: Experiments = { modelRouting: true }
			expect(ModelRouter.isEnabled(experiments, undefined)).toBe(false)
		})

		it("returns false when lightModelId is empty string", () => {
			const experiments: Experiments = { modelRouting: true }
			expect(ModelRouter.isEnabled(experiments, "")).toBe(false)
			expect(ModelRouter.isEnabled(experiments, "  ")).toBe(false)
		})

		it("returns false when experiment is not enabled", () => {
			const experiments: Experiments = { modelRouting: false }
			expect(ModelRouter.isEnabled(experiments, "some-model")).toBe(false)
		})

		it("returns true when experiment is enabled and lightModelId is set", () => {
			const experiments: Experiments = { modelRouting: true }
			expect(ModelRouter.isEnabled(experiments, "claude-3-haiku-20241022")).toBe(true)
		})
	})

	describe("buildLightModelConfig", () => {
		it("returns null for unsupported provider types", () => {
			const config: ProviderSettings = {
				apiProvider: "fake-ai" as any,
			}
			expect(ModelRouter.buildLightModelConfig(config, "some-model")).toBeNull()
		})

		it("returns null when apiProvider is not set", () => {
			const config: ProviderSettings = {}
			expect(ModelRouter.buildLightModelConfig(config, "some-model")).toBeNull()
		})

		it("creates config with light model ID for anthropic provider", () => {
			const config: ProviderSettings = {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4-20250514",
				apiKey: "test-key",
			}
			const result = ModelRouter.buildLightModelConfig(config, "claude-3-haiku-20241022")
			expect(result).not.toBeNull()
			expect(result!.apiProvider).toBe("anthropic")
			expect(result!.apiModelId).toBe("claude-3-haiku-20241022")
			expect(result!.apiKey).toBe("test-key")
		})

		it("creates config with light model ID for openrouter provider", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "anthropic/claude-sonnet-4-20250514",
				openRouterApiKey: "test-key",
			}
			const result = ModelRouter.buildLightModelConfig(config, "anthropic/claude-3-haiku-20241022")
			expect(result).not.toBeNull()
			expect(result!.apiProvider).toBe("openrouter")
			expect(result!.openRouterModelId).toBe("anthropic/claude-3-haiku-20241022")
			expect(result!.openRouterApiKey).toBe("test-key")
		})

		it("creates config with light model ID for gemini provider", () => {
			const config: ProviderSettings = {
				apiProvider: "gemini",
				apiModelId: "gemini-2.5-pro",
				geminiApiKey: "test-key",
			}
			const result = ModelRouter.buildLightModelConfig(config, "gemini-2.0-flash")
			expect(result).not.toBeNull()
			expect(result!.apiProvider).toBe("gemini")
			expect(result!.apiModelId).toBe("gemini-2.0-flash")
			expect(result!.geminiApiKey).toBe("test-key")
		})

		it("preserves all other settings from base config", () => {
			const config: ProviderSettings = {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4-20250514",
				apiKey: "test-key",
				modelTemperature: 0.5,
				enableReasoningEffort: true,
				reasoningEffort: "medium",
			}
			const result = ModelRouter.buildLightModelConfig(config, "claude-3-haiku-20241022")
			expect(result).not.toBeNull()
			expect(result!.modelTemperature).toBe(0.5)
			expect(result!.enableReasoningEffort).toBe(true)
			expect(result!.reasoningEffort).toBe("medium")
		})
	})
})
