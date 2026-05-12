import { describe, it, expect } from "vitest"
import { isToolAllowedForMode, TaskPermissionError } from "../validateToolUse"
import type { TaskPermissions } from "@roo-code/types"
import { toTaskPermissions, mergeTaskPermissions } from "@roo-code/types"
import type { ModeConfig } from "@roo-code/types"

const codeMode: ModeConfig = {
	slug: "code",
	name: "Code",
	roleDefinition: "You are a coder",
	groups: ["read", "edit", "command", "mcp"],
}

describe("TaskPermissions enforcement in isToolAllowedForMode", () => {
	describe("deniedTools", () => {
		it("throws TaskPermissionError when tool is in deniedTools", () => {
			const permissions: TaskPermissions = {
				deniedTools: ["execute_command"],
			}
			expect(() =>
				isToolAllowedForMode(
					"execute_command",
					"code",
					[codeMode],
					undefined,
					undefined,
					undefined,
					undefined,
					permissions,
				),
			).toThrow(TaskPermissionError)
		})

		it("allows tools not in deniedTools", () => {
			const permissions: TaskPermissions = {
				deniedTools: ["execute_command"],
			}
			expect(
				isToolAllowedForMode(
					"read_file",
					"code",
					[codeMode],
					undefined,
					undefined,
					undefined,
					undefined,
					permissions,
				),
			).toBe(true)
		})

		it("never denies ALWAYS_AVAILABLE_TOOLS even when in deniedTools", () => {
			const permissions: TaskPermissions = {
				deniedTools: ["attempt_completion", "ask_followup_question"],
			}
			// attempt_completion should always be allowed
			expect(
				isToolAllowedForMode(
					"attempt_completion",
					"code",
					[codeMode],
					undefined,
					undefined,
					undefined,
					undefined,
					permissions,
				),
			).toBe(true)
			// ask_followup_question should always be allowed
			expect(
				isToolAllowedForMode(
					"ask_followup_question",
					"code",
					[codeMode],
					undefined,
					undefined,
					undefined,
					undefined,
					permissions,
				),
			).toBe(true)
		})
	})

	describe("allowedTools", () => {
		it("throws TaskPermissionError when tool is not in allowedTools", () => {
			const permissions: TaskPermissions = {
				allowedTools: ["read_file", "search_files"],
			}
			expect(() =>
				isToolAllowedForMode(
					"write_to_file",
					"code",
					[codeMode],
					undefined,
					undefined,
					undefined,
					undefined,
					permissions,
				),
			).toThrow(TaskPermissionError)
		})

		it("allows tools in allowedTools", () => {
			const permissions: TaskPermissions = {
				allowedTools: ["read_file", "write_to_file"],
			}
			expect(
				isToolAllowedForMode(
					"read_file",
					"code",
					[codeMode],
					undefined,
					undefined,
					undefined,
					undefined,
					permissions,
				),
			).toBe(true)
		})

		it("always allows ALWAYS_AVAILABLE_TOOLS even when allowedTools is set", () => {
			const permissions: TaskPermissions = {
				allowedTools: ["read_file"],
			}
			// attempt_completion and ask_followup_question should always be allowed
			expect(
				isToolAllowedForMode(
					"attempt_completion",
					"code",
					[codeMode],
					undefined,
					undefined,
					undefined,
					undefined,
					permissions,
				),
			).toBe(true)
		})
	})

	describe("filePatterns", () => {
		it("throws TaskPermissionError when file path doesn't match any pattern", () => {
			const permissions = toTaskPermissions({
				filePatterns: ["src/components/.*"],
			})
			expect(() =>
				isToolAllowedForMode(
					"write_to_file",
					"code",
					[codeMode],
					undefined,
					{ path: "src/utils/helper.ts" },
					undefined,
					undefined,
					permissions,
				),
			).toThrow(TaskPermissionError)
		})

		it("allows file paths matching a pattern", () => {
			const permissions = toTaskPermissions({
				filePatterns: ["src/components/.*"],
			})
			expect(
				isToolAllowedForMode(
					"write_to_file",
					"code",
					[codeMode],
					undefined,
					{ path: "src/components/Button.tsx" },
					undefined,
					undefined,
					permissions,
				),
			).toBe(true)
		})

		it("does not restrict tools without file paths", () => {
			const permissions = toTaskPermissions({
				filePatterns: ["src/components/.*"],
			})
			expect(
				isToolAllowedForMode(
					"search_files",
					"code",
					[codeMode],
					undefined,
					{ regex: "TODO" },
					undefined,
					undefined,
					permissions,
				),
			).toBe(true)
		})
	})

	describe("filePatterns layered enforcement", () => {
		it("enforces all pattern layers (AND between layers)", () => {
			const parent = toTaskPermissions({ filePatterns: ["src/.*"] })
			const child = toTaskPermissions({ filePatterns: ["src/components/.*"] })
			const merged = mergeTaskPermissions(parent, child)!

			// src/components/Button.tsx matches both layers
			expect(
				isToolAllowedForMode(
					"write_to_file",
					"code",
					[codeMode],
					undefined,
					{ path: "src/components/Button.tsx" },
					undefined,
					undefined,
					merged,
				),
			).toBe(true)

			// src/utils/helper.ts matches parent layer but not child layer
			expect(() =>
				isToolAllowedForMode(
					"write_to_file",
					"code",
					[codeMode],
					undefined,
					{ path: "src/utils/helper.ts" },
					undefined,
					undefined,
					merged,
				),
			).toThrow(TaskPermissionError)

			// tests/test.ts matches neither layer
			expect(() =>
				isToolAllowedForMode(
					"write_to_file",
					"code",
					[codeMode],
					undefined,
					{ path: "tests/test.ts" },
					undefined,
					undefined,
					merged,
				),
			).toThrow(TaskPermissionError)
		})
	})

	describe("commandPatterns", () => {
		it("throws TaskPermissionError when command doesn't match any pattern", () => {
			const permissions = toTaskPermissions({
				commandPatterns: ["npm test.*", "npm run lint"],
			})
			expect(() =>
				isToolAllowedForMode(
					"execute_command",
					"code",
					[codeMode],
					undefined,
					{ command: "rm -rf /" },
					undefined,
					undefined,
					permissions,
				),
			).toThrow(TaskPermissionError)
		})

		it("allows commands matching a pattern", () => {
			const permissions = toTaskPermissions({
				commandPatterns: ["npm test.*", "npm run lint"],
			})
			expect(
				isToolAllowedForMode(
					"execute_command",
					"code",
					[codeMode],
					undefined,
					{ command: "npm test -- --coverage" },
					undefined,
					undefined,
					permissions,
				),
			).toBe(true)
		})
	})

	describe("no permissions", () => {
		it("allows all tools when taskPermissions is undefined", () => {
			expect(
				isToolAllowedForMode(
					"execute_command",
					"code",
					[codeMode],
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
				),
			).toBe(true)
		})
	})
})
