import { SUPPORTED_PROGRAMMATIC_TOOLS, DEFAULT_SANDBOX_CONFIG, isSupportedProgrammaticTool } from "../types"

describe("programmatic-tool-calling types", () => {
	describe("SUPPORTED_PROGRAMMATIC_TOOLS", () => {
		it("should include the initial subset of tools", () => {
			expect(SUPPORTED_PROGRAMMATIC_TOOLS).toContain("read_file")
			expect(SUPPORTED_PROGRAMMATIC_TOOLS).toContain("write_to_file")
			expect(SUPPORTED_PROGRAMMATIC_TOOLS).toContain("execute_command")
			expect(SUPPORTED_PROGRAMMATIC_TOOLS).toContain("search_files")
			expect(SUPPORTED_PROGRAMMATIC_TOOLS).toContain("list_files")
		})

		it("should have exactly 5 tools in the initial implementation", () => {
			expect(SUPPORTED_PROGRAMMATIC_TOOLS).toHaveLength(5)
		})
	})

	describe("DEFAULT_SANDBOX_CONFIG", () => {
		it("should use python:3.12-slim as the default image", () => {
			expect(DEFAULT_SANDBOX_CONFIG.image).toBe("python:3.12-slim")
		})

		it("should have a 256MB memory limit", () => {
			expect(DEFAULT_SANDBOX_CONFIG.memoryLimit).toBe(256 * 1024 * 1024)
		})

		it("should have a 0.5 CPU limit", () => {
			expect(DEFAULT_SANDBOX_CONFIG.cpuLimit).toBe(0.5)
		})

		it("should have a 30 second timeout", () => {
			expect(DEFAULT_SANDBOX_CONFIG.timeoutMs).toBe(30_000)
		})

		it("should have network disabled by default", () => {
			expect(DEFAULT_SANDBOX_CONFIG.networkEnabled).toBe(false)
		})
	})

	describe("isSupportedProgrammaticTool", () => {
		it("should return true for supported tools", () => {
			expect(isSupportedProgrammaticTool("read_file")).toBe(true)
			expect(isSupportedProgrammaticTool("write_to_file")).toBe(true)
			expect(isSupportedProgrammaticTool("execute_command")).toBe(true)
			expect(isSupportedProgrammaticTool("search_files")).toBe(true)
			expect(isSupportedProgrammaticTool("list_files")).toBe(true)
		})

		it("should return false for unsupported tools", () => {
			expect(isSupportedProgrammaticTool("apply_diff")).toBe(false)
			expect(isSupportedProgrammaticTool("attempt_completion")).toBe(false)
			expect(isSupportedProgrammaticTool("switch_mode")).toBe(false)
			expect(isSupportedProgrammaticTool("nonexistent_tool")).toBe(false)
			expect(isSupportedProgrammaticTool("")).toBe(false)
		})
	})
})
