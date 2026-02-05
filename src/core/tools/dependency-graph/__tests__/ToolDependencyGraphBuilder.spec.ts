// npx vitest src/core/tools/dependency-graph/__tests__/ToolDependencyGraphBuilder.spec.ts

import { describe, it, expect, beforeEach } from "vitest"

import { ToolDependencyGraphBuilder } from "../ToolDependencyGraphBuilder"
import type { ToolUse, McpToolUse } from "../../../../shared/tools"

/**
 * Helper to create a mock ToolUse
 */
function createToolUse(id: string, name: string, params: Record<string, string> = {}): ToolUse {
	return {
		type: "tool_use",
		id,
		name: name as any,
		params,
		partial: false,
	}
}

/**
 * Helper to create a mock McpToolUse
 */
function createMcpToolUse(
	id: string,
	serverName: string,
	toolName: string,
	args: Record<string, unknown> = {},
): McpToolUse {
	return {
		type: "mcp_tool_use",
		id,
		name: `mcp_${serverName}_${toolName}`,
		serverName,
		toolName,
		arguments: args,
		partial: false,
	}
}

const DEFAULT_OPTIONS = {
	mode: "code",
	customModes: [],
	experiments: {},
}

describe("ToolDependencyGraphBuilder", () => {
	let builder: ToolDependencyGraphBuilder

	beforeEach(() => {
		builder = new ToolDependencyGraphBuilder()
	})

	describe("Empty and Single Tool Cases", () => {
		it("should handle empty tool list", () => {
			const graph = builder.build([], DEFAULT_OPTIONS)

			expect(graph.nodes.size).toBe(0)
			expect(graph.executionGroups.length).toBe(0)
			expect(graph.totalTools).toBe(0)
			expect(graph.hasExclusiveTools).toBe(false)
			expect(graph.requiresSequentialExecution).toBe(false)
		})

		it("should handle single tool", () => {
			const toolUses = [createToolUse("1", "read_file", { path: "a.txt" })]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.nodes.size).toBe(1)
			expect(graph.executionGroups.length).toBe(1)
			expect(graph.executionGroups[0].length).toBe(1)
			expect(graph.totalTools).toBe(1)
		})
	})

	describe("Independent Tools", () => {
		it("should run read_file and list_files in parallel", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "list_files", { path: "src" }),
				createToolUse("3", "codebase_search", { query: "test" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.requiresSequentialExecution).toBe(false)
			expect(graph.executionGroups.length).toBe(1)
			expect(graph.executionGroups[0].length).toBe(3)
		})

		it("should run multiple read operations on different files in parallel", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "read_file", { path: "b.txt" }),
				createToolUse("3", "read_file", { path: "c.txt" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.executionGroups.length).toBe(1)
			expect(graph.executionGroups[0].length).toBe(3)
			expect(graph.hasExclusiveTools).toBe(false)
		})
	})

	describe("Dependent Tools - File Dependencies", () => {
		it("should run write_to_file before read_file for same file", () => {
			const toolUses = [
				createToolUse("1", "write_to_file", { path: "a.txt", content: "test" }),
				createToolUse("2", "read_file", { path: "a.txt" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			// write should be in first group, read in second
			expect(graph.executionGroups.length).toBe(2)
			expect(graph.executionGroups[0][0].toolName).toBe("write_to_file")
			expect(graph.executionGroups[1][0].toolName).toBe("read_file")
		})

		it("should handle write then read on same file with other parallel reads", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "b.txt" }),
				createToolUse("2", "write_to_file", { path: "a.txt", content: "test" }),
				createToolUse("3", "read_file", { path: "a.txt" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			// Group 1: read_file b.txt, write_to_file a.txt (parallel)
			// Group 2: read_file a.txt (depends on write)
			const group1Names = graph.executionGroups[0].map((n) => n.toolName)
			expect(group1Names).toContain("read_file")
			expect(group1Names).toContain("write_to_file")
		})

		it("should detect apply_diff as file writing tool", () => {
			const toolUses = [
				createToolUse("1", "apply_diff", { path: "a.txt", diff: "some diff" }),
				createToolUse("2", "read_file", { path: "a.txt" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.executionGroups.length).toBe(2)
			expect(graph.executionGroups[0][0].toolName).toBe("apply_diff")
		})

		it("should detect edit_file as file writing tool", () => {
			const toolUses = [
				createToolUse("1", "edit_file", { file_path: "a.txt" }),
				createToolUse("2", "read_file", { path: "a.txt" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.executionGroups.length).toBe(2)
		})
	})

	describe("Exclusive Tools", () => {
		it("should require sequential execution for new_task", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "new_task", { mode: "code", message: "test" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.hasExclusiveTools).toBe(true)
			expect(graph.requiresSequentialExecution).toBe(true)
		})

		it("should require sequential execution for attempt_completion", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "attempt_completion", { result: "done" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.hasExclusiveTools).toBe(true)
		})

		it("should mark browser_action as exclusive", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "browser_action", { action: "screenshot" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.hasExclusiveTools).toBe(true)
		})

		it("should mark execute_command as exclusive", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "execute_command", { command: "ls" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.hasExclusiveTools).toBe(true)
		})
	})

	describe("MCP Tools", () => {
		it("should mark use_mcp_tool as exclusive", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "use_mcp_tool", { server_name: "test", tool_name: "tool1" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.hasExclusiveTools).toBe(true)
		})

		it("should handle McpToolUse type", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createMcpToolUse("2", "filesystem", "read_file", { path: "/test" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.nodes.size).toBe(2)
			expect(graph.nodes.get("2")?.toolName).toBe("mcp_filesystem_read_file")
		})
	})

	describe("Terminal Tools", () => {
		it("should make new_task depend on all previous tools", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "read_file", { path: "b.txt" }),
				createToolUse("3", "new_task", { mode: "code", message: "test" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			const newTaskNode = graph.nodes.get("3")!
			expect(newTaskNode.dependencies.size).toBe(2)
			expect(newTaskNode.dependencies.has("1")).toBe(true)
			expect(newTaskNode.dependencies.has("2")).toBe(true)
		})

		it("should make attempt_completion depend on all previous tools", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "write_to_file", { path: "b.txt", content: "test" }),
				createToolUse("3", "attempt_completion", { result: "done" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			const completionNode = graph.nodes.get("3")!
			expect(completionNode.dependencies.size).toBe(2)
		})
	})

	describe("Complex Dependencies", () => {
		it("should handle mixed dependencies correctly", () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "read_file", { path: "b.txt" }),
				createToolUse("3", "write_to_file", { path: "c.txt", content: "from a and b" }),
				createToolUse("4", "read_file", { path: "c.txt" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			// Group 1: read a, read b, write c (parallel, no deps between them)
			// Group 2: read c (depends on write c)
			expect(graph.executionGroups.length).toBe(2)
		})

		it("should handle multiple writes to same file sequentially", () => {
			const toolUses = [
				createToolUse("1", "write_to_file", { path: "a.txt", content: "first" }),
				createToolUse("2", "write_to_file", { path: "a.txt", content: "second" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			// Writes to same file should be sequential
			expect(graph.executionGroups.length).toBe(2)
		})
	})

	describe("Edge Cases", () => {
		it("should handle tools without IDs", () => {
			const toolUses = [
				{ type: "tool_use" as const, name: "read_file" as any, params: { path: "a.txt" }, partial: false },
				{ type: "tool_use" as const, name: "read_file" as any, params: { path: "b.txt" }, partial: false },
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			expect(graph.nodes.size).toBe(2)
			expect(graph.nodes.has("tool_0")).toBe(true)
			expect(graph.nodes.has("tool_1")).toBe(true)
		})

		it("should handle directory path matching", () => {
			const toolUses = [
				createToolUse("1", "write_to_file", { path: "src/utils/helper.ts" }),
				createToolUse("2", "read_file", { path: "src/utils/helper.ts" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			// Should detect same file
			expect(graph.executionGroups.length).toBe(2)
		})

		it("should preserve original order in results", () => {
			const toolUses = [
				createToolUse("3", "read_file", { path: "c.txt" }),
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "read_file", { path: "b.txt" }),
			]

			const graph = builder.build(toolUses, DEFAULT_OPTIONS)

			const priorities = graph.executionGroups[0].map((n) => n.priority)
			expect(priorities).toEqual([0, 1, 2])
		})
	})
})
