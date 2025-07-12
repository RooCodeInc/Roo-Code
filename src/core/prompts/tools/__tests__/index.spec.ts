// npx vitest src/core/prompts/tools/__tests__/index.spec.ts

import { getToolDescriptionsForMode } from "../index"

describe("getToolDescriptionsForMode", () => {
	const mockArgs = {
		mode: "code" as const,
		cwd: "/test",
		supportsComputerUse: false,
		codeIndexManager: undefined,
		diffStrategy: undefined,
		browserViewportSize: undefined,
		mcpHub: undefined,
		customModes: undefined,
		experiments: undefined,
		partialReadsEnabled: undefined,
		settings: undefined,
	}

	it("should include update_todo_list tool when enableTodoList is true", () => {
		const tools = getToolDescriptionsForMode(
			mockArgs.mode,
			mockArgs.cwd,
			mockArgs.supportsComputerUse,
			mockArgs.codeIndexManager,
			mockArgs.diffStrategy,
			mockArgs.browserViewportSize,
			mockArgs.mcpHub,
			mockArgs.customModes,
			mockArgs.experiments,
			mockArgs.partialReadsEnabled,
			{ enableTodoList: true },
		)

		expect(tools).toContain("update_todo_list")
	})

	it("should exclude update_todo_list tool when enableTodoList is false", () => {
		const tools = getToolDescriptionsForMode(
			mockArgs.mode,
			mockArgs.cwd,
			mockArgs.supportsComputerUse,
			mockArgs.codeIndexManager,
			mockArgs.diffStrategy,
			mockArgs.browserViewportSize,
			mockArgs.mcpHub,
			mockArgs.customModes,
			mockArgs.experiments,
			mockArgs.partialReadsEnabled,
			{ enableTodoList: false },
		)

		expect(tools).not.toContain("update_todo_list")
	})

	it("should include update_todo_list tool when enableTodoList is undefined (default true)", () => {
		const tools = getToolDescriptionsForMode(
			mockArgs.mode,
			mockArgs.cwd,
			mockArgs.supportsComputerUse,
			mockArgs.codeIndexManager,
			mockArgs.diffStrategy,
			mockArgs.browserViewportSize,
			mockArgs.mcpHub,
			mockArgs.customModes,
			mockArgs.experiments,
			mockArgs.partialReadsEnabled,
			undefined, // settings
		)

		expect(tools).toContain("update_todo_list")
	})

	it("should include other tools regardless of enableTodoList setting", () => {
		const toolsWithTodo = getToolDescriptionsForMode(
			mockArgs.mode,
			mockArgs.cwd,
			mockArgs.supportsComputerUse,
			mockArgs.codeIndexManager,
			mockArgs.diffStrategy,
			mockArgs.browserViewportSize,
			mockArgs.mcpHub,
			mockArgs.customModes,
			mockArgs.experiments,
			mockArgs.partialReadsEnabled,
			{ enableTodoList: true },
		)

		const toolsWithoutTodo = getToolDescriptionsForMode(
			mockArgs.mode,
			mockArgs.cwd,
			mockArgs.supportsComputerUse,
			mockArgs.codeIndexManager,
			mockArgs.diffStrategy,
			mockArgs.browserViewportSize,
			mockArgs.mcpHub,
			mockArgs.customModes,
			mockArgs.experiments,
			mockArgs.partialReadsEnabled,
			{ enableTodoList: false },
		)

		// Both should have other tools like read_file, write_to_file, etc.
		expect(toolsWithTodo.length).toBeGreaterThan(100) // Should have substantial content
		expect(toolsWithoutTodo.length).toBeGreaterThan(100) // Should have substantial content

		// Tools with todo should be longer than tools without todo
		expect(toolsWithTodo.length).toBeGreaterThan(toolsWithoutTodo.length)

		// Both should contain common tools
		expect(toolsWithTodo).toContain("read_file")
		expect(toolsWithoutTodo).toContain("read_file")
	})
})
