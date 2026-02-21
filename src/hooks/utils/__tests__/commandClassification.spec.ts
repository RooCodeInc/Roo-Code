import { describe, it, expect, vi } from "vitest"
import { CommandType, classifyCommand, isDestructiveCommand, requiresApproval } from "../commandClassification"

describe("commandClassification", () => {
	describe("classifyCommand", () => {
		it("returns SAFE for read-only tools", () => {
			expect(classifyCommand("read_file")).toBe(CommandType.SAFE)
			expect(classifyCommand("search_files")).toBe(CommandType.SAFE)
			expect(classifyCommand("list_files")).toBe(CommandType.SAFE)
			expect(classifyCommand("codebase_search")).toBe(CommandType.SAFE)
			expect(classifyCommand("read_command_output")).toBe(CommandType.SAFE)
			expect(classifyCommand("select_active_intent")).toBe(CommandType.SAFE)
			expect(classifyCommand("access_mcp_resource")).toBe(CommandType.SAFE)
		})

		it("returns DESTRUCTIVE for file/command tools", () => {
			expect(classifyCommand("write_to_file")).toBe(CommandType.DESTRUCTIVE)
			expect(classifyCommand("execute_command")).toBe(CommandType.DESTRUCTIVE)
			expect(classifyCommand("apply_diff")).toBe(CommandType.DESTRUCTIVE)
			expect(classifyCommand("edit_file")).toBe(CommandType.DESTRUCTIVE)
			expect(classifyCommand("apply_patch")).toBe(CommandType.DESTRUCTIVE)
			expect(classifyCommand("update_todo_list")).toBe(CommandType.DESTRUCTIVE)
			expect(classifyCommand("use_mcp_tool")).toBe(CommandType.DESTRUCTIVE)
		})

		it("normalizes tool name (lowercase, trim)", () => {
			expect(classifyCommand("  READ_FILE  ")).toBe(CommandType.SAFE)
			expect(classifyCommand("Write_To_File")).toBe(CommandType.DESTRUCTIVE)
		})

		it("classifies alias write_file as DESTRUCTIVE", () => {
			expect(classifyCommand("write_file")).toBe(CommandType.DESTRUCTIVE)
		})

		it("defaults unknown tools to DESTRUCTIVE and warns", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
			expect(classifyCommand("unknown_tool")).toBe(CommandType.DESTRUCTIVE)
			expect(warn).toHaveBeenCalledWith("Unknown tool classification: unknown_tool, defaulting to DESTRUCTIVE")
			warn.mockRestore()
		})
	})

	describe("isDestructiveCommand", () => {
		it("returns false for safe tools", () => {
			expect(isDestructiveCommand("read_file")).toBe(false)
			expect(isDestructiveCommand("list_files")).toBe(false)
		})

		it("returns true for destructive tools", () => {
			expect(isDestructiveCommand("write_to_file")).toBe(true)
			expect(isDestructiveCommand("execute_command")).toBe(true)
		})
	})

	describe("requiresApproval", () => {
		it("returns true when blocked", () => {
			expect(requiresApproval("read_file", true, false)).toBe(true)
			expect(requiresApproval("write_to_file", true, false)).toBe(true)
		})

		it("returns true when scope violation", () => {
			expect(requiresApproval("read_file", false, true)).toBe(true)
			expect(requiresApproval("write_to_file", false, true)).toBe(true)
		})

		it("returns true for destructive commands when not blocked and no scope violation", () => {
			expect(requiresApproval("write_to_file", false, false)).toBe(true)
			expect(requiresApproval("execute_command", false, false)).toBe(true)
		})

		it("returns false for safe commands when not blocked and no scope violation", () => {
			expect(requiresApproval("read_file", false, false)).toBe(false)
			expect(requiresApproval("search_files", false, false)).toBe(false)
		})

		it("blocked takes precedence over tool type", () => {
			expect(requiresApproval("read_file", true, false)).toBe(true)
		})

		it("scope violation takes precedence over safe tool", () => {
			expect(requiresApproval("read_file", false, true)).toBe(true)
		})
	})
})
