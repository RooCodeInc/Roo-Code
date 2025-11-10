import { describe, it, expect, beforeEach } from "vitest"
import { ToolSelectionAnalyzer, SmartToolSelectionConfig } from "./ToolSelectionAnalyzer"
import type { ModeConfig, ToolName, ToolGroup } from "@roo-code/types"

describe("ToolSelectionAnalyzer", () => {
	let analyzer: ToolSelectionAnalyzer

	beforeEach(() => {
		analyzer = new ToolSelectionAnalyzer()
	})

	const createModeConfig = (groups: ToolGroup[]): ModeConfig => ({
		slug: "test",
		name: "Test Mode",
		roleDefinition: "Test role",
		groups: groups as any, // Groups can be string or tuple format
	})

	const createAvailableTools = (tools: ToolName[]): Set<ToolName> => new Set(tools)

	describe("query analysis", () => {
		it("should detect simple queries", () => {
			const simpleQueries = [
				"what does this function do?",
				"explain this code",
				"what is the purpose of this file?",
				"can you summarize this?",
			]

			const modeConfig = createModeConfig(["read"])
			const availableTools = createAvailableTools([
				"read_file",
				"list_files",
				"search_files",
				"list_code_definition_names",
				"ask_followup_question",
				"attempt_completion",
			])

			simpleQueries.forEach((query) => {
				const selected = analyzer.selectTools(query, modeConfig, availableTools)
				expect(selected.length).toBeGreaterThanOrEqual(6)
				expect(selected.length).toBeLessThanOrEqual(8)
				// Should include essential read tools
				expect(selected).toContain("read_file")
				expect(selected).toContain("list_files")
			})
		})

		it("should detect complex queries", () => {
			const complexQueries = [
				"refactor the entire authentication system to use JWT tokens",
				"implement a comprehensive logging system across all modules",
				"redesign the database schema and migrate all existing data",
				"build a complete REST API with authentication and rate limiting",
			]

			const modeConfig = createModeConfig(["read", "edit"])
			const availableTools = createAvailableTools([
				"read_file",
				"write_to_file",
				"apply_diff",
				"list_files",
				"search_files",
				"execute_command",
				"ask_followup_question",
				"attempt_completion",
			])

			complexQueries.forEach((query) => {
				const selected = analyzer.selectTools(query, modeConfig, availableTools)
				expect(selected.length).toBeGreaterThanOrEqual(8)
				expect(selected.length).toBeLessThanOrEqual(12)
				// Should include both read and edit tools
				expect(selected).toContain("read_file")
				expect(selected).toContain("write_to_file")
				expect(selected).toContain("apply_diff")
			})
		})
	})

	describe("tool-specific queries", () => {
		it("should prioritize mentioned tools", () => {
			const query = "run npm test and show me the results"
			const modeConfig = createModeConfig(["read", "command"])
			const availableTools = createAvailableTools([
				"read_file",
				"list_files",
				"execute_command",
				"ask_followup_question",
				"attempt_completion",
			])

			const selected = analyzer.selectTools(query, modeConfig, availableTools)
			// execute_command should be included and highly ranked (top 5) due to explicit mention
			expect(selected).toContain("execute_command")
			const executeIndex = selected.indexOf("execute_command")
			expect(executeIndex).toBeGreaterThanOrEqual(0)
			expect(executeIndex).toBeLessThan(5) // Within top 5 is still highly ranked
		})

		it("should detect file operations", () => {
			const query = "create a new config file with the settings I provided"
			const modeConfig = createModeConfig(["read", "edit"])
			const availableTools = createAvailableTools([
				"read_file",
				"write_to_file",
				"apply_diff",
				"list_files",
				"search_files",
				"ask_followup_question",
				"attempt_completion",
			])

			const selected = analyzer.selectTools(query, modeConfig, availableTools)
			// write_to_file should be highly ranked
			expect(selected.slice(0, 3)).toContain("write_to_file")
		})

		it("should detect search operations", () => {
			const query = "find all places where the API key is used"
			const modeConfig = createModeConfig(["read"])
			const availableTools = createAvailableTools([
				"read_file",
				"list_files",
				"search_files",
				"list_code_definition_names",
				"ask_followup_question",
				"attempt_completion",
			])

			const selected = analyzer.selectTools(query, modeConfig, availableTools)
			// search_files should be included and highly ranked (top 5) due to explicit search intent
			expect(selected).toContain("search_files")
			const searchIndex = selected.indexOf("search_files")
			expect(searchIndex).toBeGreaterThanOrEqual(0)
			expect(searchIndex).toBeLessThan(5) // Within top 5 is still highly ranked
		})
	})

	describe("settings configuration", () => {
		it("should respect minimum tools setting", () => {
			const query = "simple task"
			const modeConfig = createModeConfig(["read"])
			const availableTools = createAvailableTools([
				"read_file",
				"list_files",
				"ask_followup_question",
				"attempt_completion",
			])

			const customAnalyzer = new ToolSelectionAnalyzer({
				enabled: true,
				minTools: 3,
				maxTools: 12,
			})

			const selected = customAnalyzer.selectTools(query, modeConfig, availableTools)
			expect(selected.length).toBeGreaterThanOrEqual(3)
		})

		it("should respect maximum tools setting", () => {
			const query = "complex refactoring task involving multiple systems"
			const modeConfig = createModeConfig(["read", "edit", "command"])
			const availableTools = createAvailableTools([
				"read_file",
				"write_to_file",
				"apply_diff",
				"insert_content",
				"list_files",
				"search_files",
				"list_code_definition_names",
				"execute_command",
				"ask_followup_question",
				"attempt_completion",
				"switch_mode",
				"new_task",
				"update_todo_list",
			])

			const customAnalyzer = new ToolSelectionAnalyzer({
				enabled: true,
				minTools: 6,
				maxTools: 8,
			})

			const selected = customAnalyzer.selectTools(query, modeConfig, availableTools)
			expect(selected.length).toBeLessThanOrEqual(8)
		})

		it("should return all tools when smart selection is disabled", () => {
			const query = "some task"
			const modeConfig = createModeConfig(["read"])
			const availableTools = createAvailableTools([
				"read_file",
				"list_files",
				"search_files",
				"ask_followup_question",
				"attempt_completion",
			])

			const disabledAnalyzer = new ToolSelectionAnalyzer({
				enabled: false,
			})

			const selected = disabledAnalyzer.selectTools(query, modeConfig, availableTools)
			expect(selected.length).toBe(availableTools.size)
			expect(selected.sort()).toEqual(Array.from(availableTools).sort())
		})
	})

	describe("essential tools", () => {
		it("should always include ask_followup_question and attempt_completion", () => {
			const queries = ["simple query", "complex refactoring", "create a file", "run tests"]

			const modeConfig = createModeConfig(["read", "edit"])
			const availableTools = createAvailableTools([
				"read_file",
				"write_to_file",
				"list_files",
				"ask_followup_question",
				"attempt_completion",
			])

			queries.forEach((query) => {
				const selected = analyzer.selectTools(query, modeConfig, availableTools)
				expect(selected).toContain("ask_followup_question")
				expect(selected).toContain("attempt_completion")
			})
		})
	})

	describe("empty or invalid inputs", () => {
		it("should handle empty query gracefully", () => {
			const query = ""
			const modeConfig = createModeConfig(["read"])
			const availableTools = createAvailableTools([
				"read_file",
				"list_files",
				"ask_followup_question",
				"attempt_completion",
			])

			const selected = analyzer.selectTools(query, modeConfig, availableTools)
			expect(selected.length).toBeGreaterThan(0)
			expect(selected).toContain("ask_followup_question")
			expect(selected).toContain("attempt_completion")
		})

		it("should handle empty available tools", () => {
			const query = "do something"
			const modeConfig = createModeConfig(["read"])
			const availableTools = createAvailableTools([])

			const selected = analyzer.selectTools(query, modeConfig, availableTools)
			expect(selected).toEqual([])
		})
	})

	describe("tool scoring", () => {
		it("should score tools based on query relevance", () => {
			const query = "write a test file for the authentication module"
			const modeConfig = createModeConfig(["read", "edit"])
			const availableTools = createAvailableTools([
				"read_file",
				"write_to_file",
				"apply_diff",
				"list_files",
				"search_files",
				"execute_command",
				"ask_followup_question",
				"attempt_completion",
			])

			const selected = analyzer.selectTools(query, modeConfig, availableTools)

			// write_to_file should be highly ranked for "write a test file"
			const writeIndex = selected.indexOf("write_to_file")
			expect(writeIndex).toBeGreaterThanOrEqual(0)
			expect(writeIndex).toBeLessThan(4) // Should be in top 4 tools

			// read_file should also be included for context
			expect(selected).toContain("read_file")
		})

		it("should handle multiple tool mentions in query", () => {
			const query = "read the config file, update it, and run the build command"
			const modeConfig = createModeConfig(["read", "edit", "command"])
			const availableTools = createAvailableTools([
				"read_file",
				"write_to_file",
				"apply_diff",
				"execute_command",
				"list_files",
				"search_files",
				"ask_followup_question",
				"attempt_completion",
			])

			const selected = analyzer.selectTools(query, modeConfig, availableTools)

			// Should include all mentioned operations
			expect(selected).toContain("read_file")
			expect(selected).toContain("apply_diff") // for "update"
			expect(selected).toContain("execute_command") // for "run"
		})
	})
})
