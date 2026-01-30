import { describe, it, expect } from "vitest"
import * as YAML from "yaml"

import type { HooksFile, HookConfig, HookWithMetadata } from "@roo-code/types"

import {
	parseHooksFile,
	serializeHooksFile,
	createEmptyHooksFile,
	extractHooksWithMetadata,
	mergeHooks,
	stripHookMetadata,
	updateHookInFile,
	removeHookFromFile,
	reorderHooksInFile,
	moveHookInFile,
	HOOKS_FILE_EXTENSION,
} from "../hooks-file-parser"

describe("hooks-file-parser", () => {
	describe("HOOKS_FILE_EXTENSION", () => {
		it("should be .hooks.yaml", () => {
			expect(HOOKS_FILE_EXTENSION).toBe(".hooks.yaml")
		})
	})

	describe("parseHooksFile", () => {
		it("should parse valid hooks file content (YAML)", () => {
			const content = YAML.stringify({
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{
							id: "test-hook",
							name: "Test Hook",
							enabled: true,
							action: {
								type: "command",
								command: "echo hello",
								timeout: 30,
							},
						},
					],
				},
			})

			const result = parseHooksFile(content)
			expect(result.version).toBe("1.0")
			expect(result.hooks.PreToolUse).toHaveLength(1)
			expect(result.hooks.PreToolUse![0].id).toBe("test-hook")
		})

		it("should parse empty hooks file", () => {
			const content = YAML.stringify({
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {},
			})

			const result = parseHooksFile(content)
			expect(result.version).toBe("1.0")
			expect(result.hooks).toEqual({})
		})

		it("should throw on invalid YAML", () => {
			expect(() => parseHooksFile("not: valid: yaml: content: [")).toThrow()
		})

		it("should throw on missing required fields", () => {
			// Missing version field - should throw
			const content = YAML.stringify({ hooks: {} })
			expect(() => parseHooksFile(content)).toThrow()
		})

		it("should parse hooks with matchers", () => {
			const content = YAML.stringify({
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{
							id: "matcher-hook",
							name: "Matcher Hook",
							enabled: true,
							action: {
								type: "command",
								command: "echo test",
								timeout: 30,
							},
							matchers: {
								tools: ["edit", "read"],
								customPattern: "write_to_file|apply_diff",
							},
						},
					],
				},
			})

			const result = parseHooksFile(content)
			const hook = result.hooks.PreToolUse![0]
			expect(hook.matchers).toBeDefined()
			expect((hook.matchers as any).tools).toEqual(["edit", "read"])
		})

		it("should handle empty content", () => {
			const result = parseHooksFile("")
			expect(result.version).toBe("1.0")
			expect(result.hooks).toEqual({})
		})

		it("should handle whitespace-only content", () => {
			const result = parseHooksFile("   \n\t  ")
			expect(result.version).toBe("1.0")
			expect(result.hooks).toEqual({})
		})
	})

	describe("serializeHooksFile", () => {
		it("should serialize hooks file to YAML", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PostToolUse: [
						{
							id: "test-hook",
							name: "Test",
							enabled: true,
							action: { type: "command", command: "echo", timeout: 30 },
						},
					],
				},
			}

			const result = serializeHooksFile(hooksFile)
			const parsed = YAML.parse(result)
			expect(parsed.version).toBe("1.0")
			expect(parsed.hooks.PostToolUse).toHaveLength(1)
		})

		it("should produce valid YAML with newlines", () => {
			const hooksFile = createEmptyHooksFile()
			const result = serializeHooksFile(hooksFile)
			expect(result).toContain("\n")
		})

		it("should remove empty event type arrays when serializing", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [],
					PostToolUse: [
						{
							id: "test",
							name: "Test",
							enabled: true,
							action: { type: "command", command: "echo", timeout: 30 },
						},
					],
				},
			}

			const result = serializeHooksFile(hooksFile)
			const parsed = YAML.parse(result)
			expect(parsed.hooks.PreToolUse).toBeUndefined()
			expect(parsed.hooks.PostToolUse).toHaveLength(1)
		})
	})

	describe("createEmptyHooksFile", () => {
		it("should create empty hooks file with schema and version", () => {
			const result = createEmptyHooksFile()
			expect(result.$schema).toBe("https://roo.dev/schemas/hooks.json")
			expect(result.version).toBe("1.0")
			expect(result.hooks).toEqual({})
		})
	})

	describe("extractHooksWithMetadata", () => {
		it("should extract hooks with source and filePath metadata", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{
							id: "hook1",
							name: "Hook 1",
							enabled: true,
							action: { type: "command", command: "cmd1", timeout: 30 },
						},
					],
					PostToolUse: [
						{
							id: "hook2",
							name: "Hook 2",
							enabled: false,
							action: { type: "slashCommand", command: "/test" },
						},
					],
				},
			}

			const result = extractHooksWithMetadata(hooksFile, "global", "/path/to/.hooks.yaml")

			expect(result).toHaveLength(2)

			const hook1 = result.find((h) => h.id === "hook1")
			expect(hook1).toBeDefined()
			expect(hook1!.source).toBe("global")
			expect(hook1!.filePath).toBe("/path/to/.hooks.yaml")
			expect(hook1!.eventType).toBe("PreToolUse")

			const hook2 = result.find((h) => h.id === "hook2")
			expect(hook2).toBeDefined()
			expect(hook2!.source).toBe("global")
			expect(hook2!.eventType).toBe("PostToolUse")
		})

		it("should return empty array for empty hooks file", () => {
			const hooksFile = createEmptyHooksFile()
			const result = extractHooksWithMetadata(hooksFile, "project", "/path")
			expect(result).toHaveLength(0)
		})
	})

	describe("mergeHooks", () => {
		it("should merge global and project hooks", () => {
			const globalHooks: HookWithMetadata[] = [
				{
					id: "global-hook",
					name: "Global Hook",
					enabled: true,
					eventType: "PreToolUse",
					source: "global",
					filePath: "~/.roo/hooks/.hooks.yaml",
					action: { type: "command", command: "global cmd", timeout: 30 },
				},
			]

			const projectHooks: HookWithMetadata[] = [
				{
					id: "project-hook",
					name: "Project Hook",
					enabled: true,
					eventType: "PreToolUse",
					source: "project",
					filePath: ".roo/hooks/.hooks.yaml",
					action: { type: "command", command: "project cmd", timeout: 30 },
				},
			]

			const result = mergeHooks(globalHooks, projectHooks)
			expect(result).toHaveLength(2)
			expect(result.some((h) => h.id === "global-hook")).toBe(true)
			expect(result.some((h) => h.id === "project-hook")).toBe(true)
		})

		it("should let project hooks override global hooks with same ID", () => {
			const globalHooks: HookWithMetadata[] = [
				{
					id: "shared-id",
					name: "Global Version",
					enabled: true,
					eventType: "PreToolUse",
					source: "global",
					filePath: "~/.roo/hooks/.hooks.yaml",
					action: { type: "command", command: "global cmd", timeout: 30 },
				},
			]

			const projectHooks: HookWithMetadata[] = [
				{
					id: "shared-id",
					name: "Project Version",
					enabled: false,
					eventType: "PreToolUse",
					source: "project",
					filePath: ".roo/hooks/.hooks.yaml",
					action: { type: "command", command: "project cmd", timeout: 60 },
				},
			]

			const result = mergeHooks(globalHooks, projectHooks)
			expect(result).toHaveLength(1)
			expect(result[0].name).toBe("Project Version")
			expect(result[0].source).toBe("project")
		})

		it("should return global hooks when no project hooks", () => {
			const globalHooks: HookWithMetadata[] = [
				{
					id: "global-only",
					name: "Global Only",
					enabled: true,
					eventType: "SessionStart",
					source: "global",
					filePath: "~/.roo/hooks/.hooks.yaml",
					action: { type: "command", command: "cmd", timeout: 30 },
				},
			]

			const result = mergeHooks(globalHooks, [])
			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("global-only")
		})

		it("should return project hooks when no global hooks", () => {
			const projectHooks: HookWithMetadata[] = [
				{
					id: "project-only",
					name: "Project Only",
					enabled: true,
					eventType: "Stop",
					source: "project",
					filePath: ".roo/hooks/.hooks.yaml",
					action: { type: "command", command: "cmd", timeout: 30 },
				},
			]

			const result = mergeHooks([], projectHooks)
			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("project-only")
		})
	})

	describe("stripHookMetadata", () => {
		it("should remove source and filePath from hook", () => {
			const hookWithMetadata: HookWithMetadata = {
				id: "test",
				name: "Test",
				enabled: true,
				eventType: "PreToolUse",
				source: "global",
				filePath: "/path",
				action: { type: "command", command: "echo", timeout: 30 },
			}

			const result = stripHookMetadata(hookWithMetadata)
			expect(result.id).toBe("test")
			expect(result.name).toBe("Test")
			expect((result as any).source).toBeUndefined()
			expect((result as any).filePath).toBeUndefined()
		})
	})

	describe("updateHookInFile", () => {
		it("should add new hook to empty event type", () => {
			const hooksFile = createEmptyHooksFile()
			const hook: HookConfig = {
				id: "new-hook",
				name: "New Hook",
				enabled: true,
				action: { type: "command", command: "echo", timeout: 30 },
			}

			const result = updateHookInFile(hooksFile, hook, "PreToolUse")
			expect(result.hooks.PreToolUse).toHaveLength(1)
			expect(result.hooks.PreToolUse![0].id).toBe("new-hook")
		})

		it("should update existing hook", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{
							id: "existing",
							name: "Original Name",
							enabled: true,
							action: { type: "command", command: "original", timeout: 30 },
						},
					],
				},
			}

			const updatedHook: HookConfig = {
				id: "existing",
				name: "Updated Name",
				enabled: false,
				action: { type: "command", command: "updated", timeout: 60 },
			}

			const result = updateHookInFile(hooksFile, updatedHook, "PreToolUse")
			expect(result.hooks.PreToolUse).toHaveLength(1)
			expect(result.hooks.PreToolUse![0].name).toBe("Updated Name")
			expect(result.hooks.PreToolUse![0].enabled).toBe(false)
		})

		it("should not modify original hooks file", () => {
			const hooksFile = createEmptyHooksFile()
			const hook: HookConfig = {
				id: "new",
				name: "New",
				enabled: true,
				action: { type: "command", command: "cmd", timeout: 30 },
			}

			updateHookInFile(hooksFile, hook, "Stop")
			expect(hooksFile.hooks.Stop).toBeUndefined()
		})
	})

	describe("removeHookFromFile", () => {
		it("should remove hook from event type", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{
							id: "hook1",
							name: "Hook 1",
							enabled: true,
							action: { type: "command", command: "1", timeout: 30 },
						},
						{
							id: "hook2",
							name: "Hook 2",
							enabled: true,
							action: { type: "command", command: "2", timeout: 30 },
						},
					],
				},
			}

			const result = removeHookFromFile(hooksFile, "hook1", "PreToolUse")
			expect(result.hooks.PreToolUse).toHaveLength(1)
			expect(result.hooks.PreToolUse![0].id).toBe("hook2")
		})

		it("should handle removing non-existent hook gracefully", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{
							id: "hook1",
							name: "Hook 1",
							enabled: true,
							action: { type: "command", command: "1", timeout: 30 },
						},
					],
				},
			}

			const result = removeHookFromFile(hooksFile, "non-existent", "PreToolUse")
			expect(result.hooks.PreToolUse).toHaveLength(1)
		})

		it("should handle removing from empty event type", () => {
			const hooksFile = createEmptyHooksFile()
			const result = removeHookFromFile(hooksFile, "any", "PreToolUse")
			expect(result.hooks.PreToolUse).toBeUndefined()
		})
	})

	describe("reorderHooksInFile", () => {
		it("should reorder hooks within event type", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{ id: "a", name: "A", enabled: true, action: { type: "command", command: "a", timeout: 30 } },
						{ id: "b", name: "B", enabled: true, action: { type: "command", command: "b", timeout: 30 } },
						{ id: "c", name: "C", enabled: true, action: { type: "command", command: "c", timeout: 30 } },
					],
				},
			}

			const result = reorderHooksInFile(hooksFile, "PreToolUse", ["c", "a", "b"])
			expect(result.hooks.PreToolUse![0].id).toBe("c")
			expect(result.hooks.PreToolUse![1].id).toBe("a")
			expect(result.hooks.PreToolUse![2].id).toBe("b")
		})

		it("should handle partial reorder (some IDs not found)", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{ id: "a", name: "A", enabled: true, action: { type: "command", command: "a", timeout: 30 } },
						{ id: "b", name: "B", enabled: true, action: { type: "command", command: "b", timeout: 30 } },
					],
				},
			}

			// Reorder with a non-existent ID
			const result = reorderHooksInFile(hooksFile, "PreToolUse", ["b", "x", "a"])
			// Should still contain both hooks
			expect(result.hooks.PreToolUse).toHaveLength(2)
		})

		it("should handle empty event type", () => {
			const hooksFile = createEmptyHooksFile()
			const result = reorderHooksInFile(hooksFile, "PreToolUse", ["a", "b"])
			// Returns empty array when no existing hooks
			expect(result.hooks.PreToolUse).toEqual([])
		})
	})

	describe("moveHookInFile", () => {
		it("should move hook from one event type to another atomically", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{
							id: "hook1",
							name: "Hook 1",
							enabled: true,
							action: { type: "command", command: "cmd1", timeout: 30 },
						},
						{
							id: "hook2",
							name: "Hook 2",
							enabled: true,
							action: { type: "command", command: "cmd2", timeout: 30 },
						},
					],
					PostToolUse: [
						{
							id: "hook3",
							name: "Hook 3",
							enabled: true,
							action: { type: "command", command: "cmd3", timeout: 30 },
						},
					],
				},
			}

			const hookToMove: HookConfig = {
				id: "hook1",
				name: "Hook 1",
				enabled: true,
				action: { type: "command", command: "cmd1", timeout: 30 },
			}

			const result = moveHookInFile(hooksFile, hookToMove, "PreToolUse", "PostToolUse")

			// Hook should be removed from PreToolUse
			expect(result.hooks.PreToolUse).toHaveLength(1)
			expect(result.hooks.PreToolUse![0].id).toBe("hook2")

			// Hook should be added to PostToolUse
			expect(result.hooks.PostToolUse).toHaveLength(2)
			expect(result.hooks.PostToolUse!.some((h) => h.id === "hook1")).toBe(true)
			expect(result.hooks.PostToolUse!.some((h) => h.id === "hook3")).toBe(true)
		})

		it("should remove source event type if it becomes empty", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{
							id: "only-hook",
							name: "Only Hook",
							enabled: true,
							action: { type: "command", command: "cmd", timeout: 30 },
						},
					],
				},
			}

			const hookToMove: HookConfig = {
				id: "only-hook",
				name: "Only Hook",
				enabled: true,
				action: { type: "command", command: "cmd", timeout: 30 },
			}

			const result = moveHookInFile(hooksFile, hookToMove, "PreToolUse", "PostToolUse")

			// PreToolUse should be removed (empty)
			expect(result.hooks.PreToolUse).toBeUndefined()

			// Hook should be in PostToolUse
			expect(result.hooks.PostToolUse).toHaveLength(1)
			expect(result.hooks.PostToolUse![0].id).toBe("only-hook")
		})

		it("should create target event type if it does not exist", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{
							id: "hook1",
							name: "Hook 1",
							enabled: true,
							action: { type: "command", command: "cmd", timeout: 30 },
						},
					],
				},
			}

			const hookToMove: HookConfig = {
				id: "hook1",
				name: "Hook 1",
				enabled: true,
				action: { type: "command", command: "cmd", timeout: 30 },
			}

			const result = moveHookInFile(hooksFile, hookToMove, "PreToolUse", "SessionStart")

			// PreToolUse should be removed (empty)
			expect(result.hooks.PreToolUse).toBeUndefined()

			// SessionStart should be created with the hook
			expect(result.hooks.SessionStart).toHaveLength(1)
			expect(result.hooks.SessionStart![0].id).toBe("hook1")
		})

		it("should not modify original hooks file", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{
							id: "hook1",
							name: "Hook 1",
							enabled: true,
							action: { type: "command", command: "cmd", timeout: 30 },
						},
					],
				},
			}

			const hookToMove: HookConfig = {
				id: "hook1",
				name: "Hook 1",
				enabled: true,
				action: { type: "command", command: "cmd", timeout: 30 },
			}

			moveHookInFile(hooksFile, hookToMove, "PreToolUse", "PostToolUse")

			// Original should be unchanged
			expect(hooksFile.hooks.PreToolUse).toHaveLength(1)
			expect(hooksFile.hooks.PostToolUse).toBeUndefined()
		})

		it("should handle hook not existing in source (add to target)", () => {
			const hooksFile: HooksFile = {
				$schema: "https://roo.dev/schemas/hooks.json",
				version: "1.0",
				hooks: {
					PreToolUse: [
						{
							id: "other-hook",
							name: "Other",
							enabled: true,
							action: { type: "command", command: "other", timeout: 30 },
						},
					],
				},
			}

			const hookToMove: HookConfig = {
				id: "new-hook",
				name: "New Hook",
				enabled: true,
				action: { type: "command", command: "new", timeout: 30 },
			}

			const result = moveHookInFile(hooksFile, hookToMove, "PreToolUse", "PostToolUse")

			// PreToolUse should still have other-hook
			expect(result.hooks.PreToolUse).toHaveLength(1)
			expect(result.hooks.PreToolUse![0].id).toBe("other-hook")

			// PostToolUse should have new-hook
			expect(result.hooks.PostToolUse).toHaveLength(1)
			expect(result.hooks.PostToolUse![0].id).toBe("new-hook")
		})
	})
})
