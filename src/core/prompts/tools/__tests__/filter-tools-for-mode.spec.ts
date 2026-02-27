// npx vitest run core/prompts/tools/__tests__/filter-tools-for-mode.spec.ts

import type OpenAI from "openai"

import { filterNativeToolsForMode } from "../filter-tools-for-mode"

function makeTool(name: string): OpenAI.Chat.ChatCompletionTool {
	return {
		type: "function",
		function: {
			name,
			description: `${name} tool`,
			parameters: { type: "object", properties: {} },
		},
	} as OpenAI.Chat.ChatCompletionTool
}

describe("filterNativeToolsForMode - disabledTools", () => {
	const nativeTools: OpenAI.Chat.ChatCompletionTool[] = [
		makeTool("execute_command"),
		makeTool("read_file"),
		makeTool("write_to_file"),
		makeTool("apply_diff"),
		makeTool("edit"),
	]

	it("removes tools listed in settings.disabledTools", () => {
		const settings = {
			disabledTools: ["execute_command"],
		}

		const result = filterNativeToolsForMode(nativeTools, "code", undefined, undefined, undefined, settings)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).not.toContain("execute_command")
		expect(resultNames).toContain("read_file")
		expect(resultNames).toContain("write_to_file")
		expect(resultNames).toContain("apply_diff")
	})

	it("does not remove any tools when disabledTools is empty", () => {
		const settings = {
			disabledTools: [],
		}

		const result = filterNativeToolsForMode(nativeTools, "code", undefined, undefined, undefined, settings)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).toContain("execute_command")
		expect(resultNames).toContain("read_file")
		expect(resultNames).toContain("write_to_file")
		expect(resultNames).toContain("apply_diff")
	})

	it("does not remove any tools when disabledTools is undefined", () => {
		const settings = {}

		const result = filterNativeToolsForMode(nativeTools, "code", undefined, undefined, undefined, settings)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).toContain("execute_command")
		expect(resultNames).toContain("read_file")
	})

	it("combines disabledTools with other setting-based exclusions", () => {
		const settings = {
			disabledTools: ["execute_command"],
		}

		const result = filterNativeToolsForMode(nativeTools, "code", undefined, undefined, undefined, settings)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).not.toContain("execute_command")
		expect(resultNames).toContain("read_file")
	})

	it("disables canonical tool when disabledTools contains alias name", () => {
		const settings = {
			disabledTools: ["search_and_replace"],
			modelInfo: {
				includedTools: ["search_and_replace"],
			},
		}

		const result = filterNativeToolsForMode(nativeTools, "code", undefined, undefined, undefined, settings)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).not.toContain("search_and_replace")
		expect(resultNames).not.toContain("edit")
	})
})

describe("filterNativeToolsForMode - subagent experiment", () => {
	const codeMode = {
		slug: "code",
		name: "Code",
		roleDefinition: "Test",
		groups: ["read", "edit", "command", "mcp"] as ("read" | "edit" | "command" | "mcp")[],
	}

	const mockSubagentTool: OpenAI.Chat.ChatCompletionTool = {
		type: "function",
		function: {
			name: "subagent",
			description: "Run subagent",
			parameters: {},
		},
	}

	const mockNativeTools: OpenAI.Chat.ChatCompletionTool[] = [
		makeTool("read_file"),
		makeTool("write_to_file"),
		mockSubagentTool,
	]

	it("should exclude subagent when experiment is not enabled", () => {
		const filtered = filterNativeToolsForMode(
			mockNativeTools,
			"code",
			[codeMode],
			{ subagent: false },
			undefined,
			{},
			undefined,
		)
		const toolNames = filtered.map((t) => ("function" in t ? t.function.name : ""))
		expect(toolNames).not.toContain("subagent")
	})

	it("should include subagent when experiment is enabled", () => {
		const filtered = filterNativeToolsForMode(
			mockNativeTools,
			"code",
			[codeMode],
			{ subagent: true },
			undefined,
			{},
			undefined,
		)
		const toolNames = filtered.map((t) => ("function" in t ? t.function.name : ""))
		expect(toolNames).toContain("subagent")
	})
})
