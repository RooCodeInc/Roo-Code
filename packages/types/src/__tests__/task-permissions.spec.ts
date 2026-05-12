import { describe, it, expect } from "vitest"
import {
	mergeTaskPermissions,
	matchesAnyPattern,
	matchesAllPatternLayers,
	taskPermissionsSchema,
	toTaskPermissions,
	isSafeRegex,
} from "../task-permissions.js"
import type { TaskPermissions } from "../task-permissions.js"

describe("TaskPermissions", () => {
	describe("taskPermissionsSchema", () => {
		it("validates a valid permissions object", () => {
			const result = taskPermissionsSchema.safeParse({
				filePatterns: ["src/components/.*"],
				commandPatterns: ["npm test.*"],
				allowedTools: ["read_file", "write_to_file"],
				deniedTools: ["execute_command"],
			})
			expect(result.success).toBe(true)
		})

		it("validates an empty object", () => {
			const result = taskPermissionsSchema.safeParse({})
			expect(result.success).toBe(true)
		})

		it("validates partial permissions", () => {
			const result = taskPermissionsSchema.safeParse({
				filePatterns: ["src/.*"],
			})
			expect(result.success).toBe(true)
		})

		it("rejects non-string array values", () => {
			const result = taskPermissionsSchema.safeParse({
				filePatterns: [123],
			})
			expect(result.success).toBe(false)
		})

		it("rejects invalid regex patterns in filePatterns", () => {
			const result = taskPermissionsSchema.safeParse({
				filePatterns: ["[invalid"],
			})
			expect(result.success).toBe(false)
		})

		it("rejects invalid regex patterns in commandPatterns", () => {
			const result = taskPermissionsSchema.safeParse({
				commandPatterns: ["(unclosed"],
			})
			expect(result.success).toBe(false)
		})
	})

	describe("toTaskPermissions", () => {
		it("wraps flat filePatterns into a single layer", () => {
			const input = { filePatterns: ["src/.*"] }
			const result = toTaskPermissions(input)
			expect(result._filePatternLayers).toEqual([["src/.*"]])
			expect(result.filePatterns).toEqual(["src/.*"])
		})

		it("wraps flat commandPatterns into a single layer", () => {
			const input = { commandPatterns: ["npm test.*"] }
			const result = toTaskPermissions(input)
			expect(result._commandPatternLayers).toEqual([["npm test.*"]])
		})

		it("leaves layers undefined when patterns are not set", () => {
			const input = { allowedTools: ["read_file"] }
			const result = toTaskPermissions(input)
			expect(result._filePatternLayers).toBeUndefined()
			expect(result._commandPatternLayers).toBeUndefined()
		})
	})

	describe("mergeTaskPermissions", () => {
		it("returns undefined when both are undefined", () => {
			expect(mergeTaskPermissions(undefined, undefined)).toBeUndefined()
		})

		it("returns child when parent is undefined", () => {
			const child: TaskPermissions = { filePatterns: ["src/.*"] }
			expect(mergeTaskPermissions(undefined, child)).toEqual(child)
		})

		it("returns parent when child is undefined", () => {
			const parent: TaskPermissions = { filePatterns: ["src/.*"] }
			expect(mergeTaskPermissions(parent, undefined)).toEqual(parent)
		})

		it("accumulates filePatterns as separate layers when both defined", () => {
			const parent = toTaskPermissions({ filePatterns: ["src/.*", "tests/.*"] })
			const child = toTaskPermissions({ filePatterns: ["src/.*", "docs/.*"] })
			const merged = mergeTaskPermissions(parent, child)
			// Both layers are kept (AND semantics between layers)
			expect(merged?._filePatternLayers).toEqual([
				["src/.*", "tests/.*"],
				["src/.*", "docs/.*"],
			])
		})

		it("accumulates commandPatterns as separate layers when both defined", () => {
			const parent = toTaskPermissions({ commandPatterns: ["npm test.*", "npm run lint"] })
			const child = toTaskPermissions({ commandPatterns: ["npm test.*", "npm run build"] })
			const merged = mergeTaskPermissions(parent, child)
			expect(merged?._commandPatternLayers).toEqual([
				["npm test.*", "npm run lint"],
				["npm test.*", "npm run build"],
			])
		})

		it("intersects allowedTools when both defined", () => {
			const parent: TaskPermissions = { allowedTools: ["read_file", "write_to_file", "search_files"] }
			const child: TaskPermissions = { allowedTools: ["read_file", "execute_command"] }
			const merged = mergeTaskPermissions(parent, child)
			expect(merged?.allowedTools).toEqual(["read_file"])
		})

		it("unions deniedTools when both defined", () => {
			const parent: TaskPermissions = { deniedTools: ["execute_command"] }
			const child: TaskPermissions = { deniedTools: ["write_to_file"] }
			const merged = mergeTaskPermissions(parent, child)
			expect(merged?.deniedTools).toEqual(["execute_command", "write_to_file"])
		})

		it("deduplicates deniedTools in union", () => {
			const parent: TaskPermissions = { deniedTools: ["execute_command", "write_to_file"] }
			const child: TaskPermissions = { deniedTools: ["execute_command", "search_files"] }
			const merged = mergeTaskPermissions(parent, child)
			expect(merged?.deniedTools).toEqual(["execute_command", "write_to_file", "search_files"])
		})

		it("uses parent filePatterns when child has none", () => {
			const parent = toTaskPermissions({ filePatterns: ["src/.*"] })
			const child: TaskPermissions = { deniedTools: ["execute_command"] }
			const merged = mergeTaskPermissions(parent, child)
			expect(merged?._filePatternLayers).toEqual([["src/.*"]])
			expect(merged?.deniedTools).toEqual(["execute_command"])
		})

		it("returns empty array when allowedTools intersection is empty", () => {
			const parent: TaskPermissions = { allowedTools: ["read_file"] }
			const child: TaskPermissions = { allowedTools: ["write_to_file"] }
			const merged = mergeTaskPermissions(parent, child)
			expect(merged?.allowedTools).toEqual([])
		})

		it("handles nested delegation where child narrows scope", () => {
			const grandparent = toTaskPermissions({
				filePatterns: ["src/.*"],
				commandPatterns: ["npm.*"],
				allowedTools: ["read_file", "write_to_file", "search_files"],
				deniedTools: ["execute_command"],
			})
			const parent = toTaskPermissions({
				filePatterns: ["src/components/.*"],
				allowedTools: ["read_file", "write_to_file"],
			})

			const merged = mergeTaskPermissions(grandparent, parent)

			// Both layers are kept -- runtime enforces AND between them
			expect(merged?._filePatternLayers).toEqual([["src/.*"], ["src/components/.*"]])
			// allowedTools intersection: read_file and write_to_file are in both
			expect(merged?.allowedTools).toEqual(["read_file", "write_to_file"])
			// commandPatterns: only grandparent has them, so they pass through
			expect(merged?._commandPatternLayers).toEqual([["npm.*"]])
			// deniedTools: only grandparent has them, so they pass through
			expect(merged?.deniedTools).toEqual(["execute_command"])
		})

		it("deduplicates identical pattern layers", () => {
			const parent = toTaskPermissions({ filePatterns: ["src/.*"] })
			const child = toTaskPermissions({ filePatterns: ["src/.*"] })
			const merged = mergeTaskPermissions(parent, child)
			// Identical layers are deduplicated
			expect(merged?._filePatternLayers).toEqual([["src/.*"]])
		})
	})

	describe("matchesAnyPattern", () => {
		it("matches a simple regex pattern", () => {
			expect(matchesAnyPattern("src/components/Button.tsx", ["src/components/.*"])).toBe(true)
		})

		it("does not match when no patterns match", () => {
			expect(matchesAnyPattern("tests/unit/test.ts", ["src/components/.*"])).toBe(false)
		})

		it("matches when at least one pattern matches", () => {
			expect(matchesAnyPattern("tests/unit/test.ts", ["src/.*", "tests/.*"])).toBe(true)
		})

		it("handles invalid regex gracefully", () => {
			expect(matchesAnyPattern("test.ts", ["[invalid"])).toBe(false)
		})

		it("matches command patterns", () => {
			expect(matchesAnyPattern("npm test -- --coverage", ["npm test.*"])).toBe(true)
		})

		it("does not match restricted commands", () => {
			expect(matchesAnyPattern("rm -rf /", ["npm.*", "yarn.*"])).toBe(false)
		})

		it("anchors patterns so substrings do not match", () => {
			// "src/.*" should NOT match a path that merely contains "src/" as a substring
			expect(matchesAnyPattern("evil/src/components/foo.ts", ["src/.*"])).toBe(false)
			// But should still match paths that start with src/
			expect(matchesAnyPattern("src/components/foo.ts", ["src/.*"])).toBe(true)
		})

		it("respects pre-anchored patterns (starting with ^)", () => {
			// A pattern already starting with ^ should not be double-wrapped
			expect(matchesAnyPattern("src/foo.ts", ["^src/.*$"])).toBe(true)
			expect(matchesAnyPattern("evil/src/foo.ts", ["^src/.*$"])).toBe(false)
		})
	})

	describe("matchesAllPatternLayers", () => {
		it("returns true when layers is undefined", () => {
			expect(matchesAllPatternLayers("anything", undefined)).toBe(true)
		})

		it("returns true when layers is empty", () => {
			expect(matchesAllPatternLayers("anything", [])).toBe(true)
		})

		it("returns true when value matches all layers", () => {
			const layers = [["src/.*"], ["src/components/.*"]]
			expect(matchesAllPatternLayers("src/components/Button.tsx", layers)).toBe(true)
		})

		it("returns false when value fails to match one layer", () => {
			const layers = [["src/.*"], ["src/components/.*"]]
			// Matches src/.* but not src/components/.*
			expect(matchesAllPatternLayers("src/utils/helper.ts", layers)).toBe(false)
		})

		it("handles single layer like matchesAnyPattern", () => {
			const layers = [["src/.*", "tests/.*"]]
			expect(matchesAllPatternLayers("tests/unit/test.ts", layers)).toBe(true)
			expect(matchesAllPatternLayers("docs/readme.md", layers)).toBe(false)
		})
	})

	describe("isSafeRegex", () => {
		it("accepts simple file path patterns", () => {
			expect(isSafeRegex("src/.*")).toBe(true)
			expect(isSafeRegex("src/components/.*\\.tsx")).toBe(true)
			expect(isSafeRegex("npm test.*")).toBe(true)
		})

		it("rejects nested quantifiers (classic ReDoS)", () => {
			expect(isSafeRegex("(a+)+")).toBe(false)
			expect(isSafeRegex("(a*)+")).toBe(false)
			expect(isSafeRegex("(a+)*")).toBe(false)
			expect(isSafeRegex("(a+){2,}")).toBe(false)
		})

		it("rejects overlapping alternations in repeated groups", () => {
			expect(isSafeRegex("(a|a)+")).toBe(false)
			expect(isSafeRegex("(.|a)*")).toBe(false)
		})

		it("rejects patterns exceeding maximum length", () => {
			const longPattern = "a".repeat(201)
			expect(isSafeRegex(longPattern)).toBe(false)
		})

		it("accepts patterns at maximum length", () => {
			const maxPattern = "a".repeat(200)
			expect(isSafeRegex(maxPattern)).toBe(true)
		})
	})

	describe("schema ReDoS rejection", () => {
		it("rejects ReDoS-vulnerable patterns in filePatterns", () => {
			const result = taskPermissionsSchema.safeParse({
				filePatterns: ["(a+)+"],
			})
			expect(result.success).toBe(false)
		})

		it("rejects ReDoS-vulnerable patterns in commandPatterns", () => {
			const result = taskPermissionsSchema.safeParse({
				commandPatterns: ["(cmd|cmd)*"],
			})
			expect(result.success).toBe(false)
		})

		it("rejects overly long patterns at schema level", () => {
			const result = taskPermissionsSchema.safeParse({
				filePatterns: ["a".repeat(201)],
			})
			expect(result.success).toBe(false)
		})
	})

	describe("persistence round-trip", () => {
		it("taskPermissionsSchema can parse persisted permissions (without internal fields)", () => {
			// Simulate what gets persisted: only the input-level fields
			const persisted = {
				filePatterns: ["src/.*"],
				commandPatterns: ["npm test.*"],
				allowedTools: ["read_file"],
				deniedTools: ["execute_command"],
			}
			const result = taskPermissionsSchema.safeParse(persisted)
			expect(result.success).toBe(true)
			if (result.success) {
				// Can be converted back to internal representation
				const restored = toTaskPermissions(result.data)
				expect(restored._filePatternLayers).toEqual([["src/.*"]])
				expect(restored._commandPatternLayers).toEqual([["npm test.*"]])
				expect(restored.allowedTools).toEqual(["read_file"])
				expect(restored.deniedTools).toEqual(["execute_command"])
			}
		})
	})
})
