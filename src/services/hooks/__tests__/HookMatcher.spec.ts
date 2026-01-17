/**
 * Tests for HookMatcher
 *
 * Covers:
 * - Exact matching
 * - Regex pattern matching
 * - Glob pattern matching
 * - Match-all behavior
 * - Cache behavior
 */

import { vi } from "vitest"
import { compileMatcher, getMatcher, clearMatcherCache, filterMatchingHooks, hookMatchesTool } from "../HookMatcher"
import type { ResolvedHook } from "../types"

describe("HookMatcher", () => {
	beforeEach(() => {
		clearMatcherCache()
	})

	describe("compileMatcher", () => {
		describe("match-all patterns", () => {
			it('should match all tools with "*" pattern', () => {
				const matcher = compileMatcher("*")
				expect(matcher.type).toBe("all")
				expect(matcher.matches("Write")).toBe(true)
				expect(matcher.matches("Read")).toBe(true)
				expect(matcher.matches("Bash")).toBe(true)
				expect(matcher.matches("anything")).toBe(true)
			})

			it("should match all tools with undefined pattern", () => {
				const matcher = compileMatcher(undefined)
				expect(matcher.type).toBe("all")
				expect(matcher.matches("Write")).toBe(true)
				expect(matcher.matches("Read")).toBe(true)
			})

			it("should match all tools with empty string pattern", () => {
				const matcher = compileMatcher("")
				expect(matcher.type).toBe("all")
				expect(matcher.matches("Write")).toBe(true)
			})
		})

		describe("exact matching", () => {
			it("should match exact tool name (case-insensitive)", () => {
				const matcher = compileMatcher("Write")
				expect(matcher.type).toBe("exact")
				expect(matcher.matches("Write")).toBe(true)
				expect(matcher.matches("write")).toBe(true)
				expect(matcher.matches("WRITE")).toBe(true)
				expect(matcher.matches("Read")).toBe(false)
			})

			it("should not match partial names", () => {
				const matcher = compileMatcher("Write")
				expect(matcher.matches("WriteFile")).toBe(false)
				expect(matcher.matches("FileWrite")).toBe(false)
			})
		})

		describe("regex pattern matching", () => {
			it("should match regex with pipe (|) alternation", () => {
				const matcher = compileMatcher("Edit|Write")
				expect(matcher.type).toBe("regex")
				expect(matcher.matches("Edit")).toBe(true)
				expect(matcher.matches("Write")).toBe(true)
				expect(matcher.matches("Read")).toBe(false)
			})

			it("should match regex with character classes", () => {
				const matcher = compileMatcher("File[RW].*")
				expect(matcher.type).toBe("regex")
				expect(matcher.matches("FileRead")).toBe(true)
				expect(matcher.matches("FileWrite")).toBe(true)
				expect(matcher.matches("FileDelete")).toBe(false)
			})

			it("should be case-insensitive", () => {
				const matcher = compileMatcher("foo|bar")
				expect(matcher.matches("FOO")).toBe(true)
				expect(matcher.matches("BAR")).toBe(true)
			})

			it("should fall back to exact match on invalid regex", () => {
				// Unclosed bracket is invalid regex
				const matcher = compileMatcher("Edit[")
				expect(matcher.type).toBe("exact")
				expect(matcher.matches("Edit[")).toBe(true)
			})
		})

		describe("glob pattern matching", () => {
			it("should match glob with * wildcard", () => {
				const matcher = compileMatcher("mcp__*")
				expect(matcher.type).toBe("glob")
				expect(matcher.matches("mcp__tool1")).toBe(true)
				expect(matcher.matches("mcp__server__action")).toBe(true)
				expect(matcher.matches("mcp_")).toBe(false)
				expect(matcher.matches("other_tool")).toBe(false)
			})

			it("should match glob with ? single-char wildcard", () => {
				const matcher = compileMatcher("Tool?")
				expect(matcher.type).toBe("glob")
				expect(matcher.matches("Tool1")).toBe(true)
				expect(matcher.matches("ToolA")).toBe(true)
				expect(matcher.matches("Tool")).toBe(false)
				expect(matcher.matches("Tool12")).toBe(false)
			})

			it("should match glob with * in middle", () => {
				const matcher = compileMatcher("*File*")
				expect(matcher.type).toBe("glob")
				expect(matcher.matches("FileRead")).toBe(true)
				expect(matcher.matches("ReadFile")).toBe(true)
				expect(matcher.matches("ReadFileNow")).toBe(true)
				expect(matcher.matches("Tool")).toBe(false)
			})

			it("should be case-insensitive", () => {
				const matcher = compileMatcher("MCP__*")
				expect(matcher.matches("mcp__tool")).toBe(true)
				expect(matcher.matches("MCP__TOOL")).toBe(true)
			})
		})

		describe("group expansion", () => {
			it('should expand "edit" group to all edit tools', () => {
				const matcher = compileMatcher("edit")
				expect(matcher.type).toBe("regex")
				expect(matcher.matches("apply_diff")).toBe(true)
				expect(matcher.matches("write_to_file")).toBe(true)
				expect(matcher.matches("generate_image")).toBe(true)
				expect(matcher.matches("search_and_replace")).toBe(true)
				expect(matcher.matches("search_replace")).toBe(true)
				expect(matcher.matches("edit_file")).toBe(true)
				expect(matcher.matches("apply_patch")).toBe(true)
				expect(matcher.matches("read_file")).toBe(false)
			})

			it('should expand "read" group to all read tools', () => {
				const matcher = compileMatcher("read")
				expect(matcher.matches("read_file")).toBe(true)
				expect(matcher.matches("fetch_instructions")).toBe(true)
				expect(matcher.matches("search_files")).toBe(true)
				expect(matcher.matches("list_files")).toBe(true)
				expect(matcher.matches("codebase_search")).toBe(true)
				expect(matcher.matches("write_to_file")).toBe(false)
			})

			it('should expand "browser" group', () => {
				const matcher = compileMatcher("browser")
				expect(matcher.matches("browser_action")).toBe(true)
				expect(matcher.matches("read_file")).toBe(false)
			})

			it('should expand "command" group', () => {
				const matcher = compileMatcher("command")
				expect(matcher.matches("execute_command")).toBe(true)
				expect(matcher.matches("read_file")).toBe(false)
			})

			it('should expand "mcp" group', () => {
				const matcher = compileMatcher("mcp")
				expect(matcher.matches("use_mcp_tool")).toBe(true)
				expect(matcher.matches("access_mcp_resource")).toBe(true)
				expect(matcher.matches("read_file")).toBe(false)
			})

			it('should expand "modes" group', () => {
				const matcher = compileMatcher("modes")
				expect(matcher.matches("switch_mode")).toBe(true)
				expect(matcher.matches("new_task")).toBe(true)
				expect(matcher.matches("read_file")).toBe(false)
			})

			it("should be case insensitive for groups", () => {
				const matcher = compileMatcher("EDIT")
				expect(matcher.matches("apply_diff")).toBe(true)
				expect(matcher.matches("write_to_file")).toBe(true)
			})

			it("should still work with individual tool names", () => {
				const matcher = compileMatcher("read_file")
				expect(matcher.matches("read_file")).toBe(true)
				expect(matcher.matches("write_to_file")).toBe(false)
			})

			it("should expand single group name", () => {
				const matcher = compileMatcher("edit")
				expect(matcher.matches("apply_diff")).toBe(true)
				expect(matcher.matches("write_to_file")).toBe(true)
				expect(matcher.matches("read_file")).toBe(false)
			})

			it("should treat unknown groups as literal tool names", () => {
				// Mock console.warn to capture warnings
				const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

				const matcher = compileMatcher("unknown_group")
				expect(matcher.matches("unknown_group")).toBe(true)
				expect(matcher.matches("read_file")).toBe(false)

				// Should have warned about unknown group
				expect(consoleWarnSpy).toHaveBeenCalledWith(
					expect.stringContaining('Unknown tool group "unknown_group"'),
				)

				consoleWarnSpy.mockRestore()
			})

			it("should not warn for glob patterns that look like groups", () => {
				const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

				const matcher = compileMatcher("edit*")
				expect(matcher.type).toBe("glob")
				expect(matcher.matches("edit_file")).toBe(true)

				// Should not warn because it contains *
				expect(consoleWarnSpy).not.toHaveBeenCalled()

				consoleWarnSpy.mockRestore()
			})
		})
	})

	describe("getMatcher (caching)", () => {
		it("should return same matcher for same pattern", () => {
			const matcher1 = getMatcher("Write")
			const matcher2 = getMatcher("Write")
			expect(matcher1).toBe(matcher2)
		})

		it("should cache undefined as '*'", () => {
			const matcher1 = getMatcher(undefined)
			const matcher2 = getMatcher("*")
			expect(matcher1).toBe(matcher2)
		})

		it("should return different matchers for different patterns", () => {
			const matcher1 = getMatcher("Write")
			const matcher2 = getMatcher("Read")
			expect(matcher1).not.toBe(matcher2)
		})
	})

	describe("filterMatchingHooks", () => {
		const createMockHook = (id: string, matcher?: string): ResolvedHook =>
			({
				id,
				matcher,
				enabled: true,
				command: "echo test",
				timeout: 60,
				source: "project",
				event: "PreToolUse",
				filePath: "/test/hooks.yaml",
			}) as ResolvedHook

		it("should filter hooks by tool name", () => {
			const hooks = [
				createMockHook("hook1", "Write"),
				createMockHook("hook2", "Read"),
				createMockHook("hook3", "Edit|Write"),
			]

			const matching = filterMatchingHooks(hooks, "Write")
			expect(matching).toHaveLength(2)
			expect(matching.map((h) => h.id)).toEqual(["hook1", "hook3"])
		})

		it("should include match-all hooks", () => {
			const hooks = [
				createMockHook("hook1", "*"),
				createMockHook("hook2", undefined),
				createMockHook("hook3", "Read"),
			]

			const matching = filterMatchingHooks(hooks, "Write")
			expect(matching).toHaveLength(2)
			expect(matching.map((h) => h.id)).toEqual(["hook1", "hook2"])
		})

		it("should return empty array when no hooks match", () => {
			const hooks = [createMockHook("hook1", "Read"), createMockHook("hook2", "Edit")]

			const matching = filterMatchingHooks(hooks, "Write")
			expect(matching).toHaveLength(0)
		})

		it("should NOT treat Claude Code-style tool labels as Roo Code internal tool ids", () => {
			// Roo Code hook matching is against tool ids like write_to_file/apply_diff.
			// A Claude Code-style matcher like Write|Edit should not match apply_diff.
			const hooks = [createMockHook("hook1", "Write|Edit")]
			const matching = filterMatchingHooks(hooks, "apply_diff")
			expect(matching).toHaveLength(0)
		})
	})

	describe("hookMatchesTool", () => {
		const createMockHook = (matcher?: string): ResolvedHook =>
			({
				id: "test",
				matcher,
				enabled: true,
				command: "echo test",
				timeout: 60,
				source: "project",
				event: "PreToolUse",
				filePath: "/test/hooks.yaml",
			}) as ResolvedHook

		it("should return true for matching hook", () => {
			expect(hookMatchesTool(createMockHook("Write"), "Write")).toBe(true)
		})

		it("should return false for non-matching hook", () => {
			expect(hookMatchesTool(createMockHook("Read"), "Write")).toBe(false)
		})

		it("should return true for match-all hook", () => {
			expect(hookMatchesTool(createMockHook("*"), "AnyTool")).toBe(true)
		})
	})
})
