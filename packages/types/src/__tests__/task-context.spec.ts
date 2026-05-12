import { describe, it, expect } from "vitest"

import {
	taskPermissionsSchema,
	taskContextSchema,
	mergePermissions,
	type TaskPermissions,
	type TaskContext,
} from "../task-context.js"

describe("TaskPermissions schema", () => {
	it("accepts empty object", () => {
		const result = taskPermissionsSchema.parse({})
		expect(result).toEqual({})
	})

	it("accepts full permissions object", () => {
		const permissions: TaskPermissions = {
			fileReadPatterns: ["docs/**", "src/**"],
			fileWritePatterns: ["docs/**"],
			allowedCommands: ["npm test"],
			blockedCommands: ["rm -rf"],
			readOnly: true,
			allowedTools: ["read_file", "list_files"],
		}
		const result = taskPermissionsSchema.parse(permissions)
		expect(result).toEqual(permissions)
	})

	it("accepts partial permissions", () => {
		const result = taskPermissionsSchema.parse({ readOnly: true })
		expect(result).toEqual({ readOnly: true })
	})

	it("rejects invalid types", () => {
		expect(() => taskPermissionsSchema.parse({ readOnly: "yes" })).toThrow()
		expect(() => taskPermissionsSchema.parse({ fileReadPatterns: "docs/**" })).toThrow()
	})
})

describe("TaskContext schema", () => {
	it("accepts minimal context", () => {
		const context: TaskContext = { mode: "code" }
		const result = taskContextSchema.parse(context)
		expect(result.mode).toBe("code")
	})

	it("accepts full context", () => {
		const context: TaskContext = {
			mode: "architect",
			apiConfigName: "gpt-4",
			permissions: {
				readOnly: true,
				fileReadPatterns: ["docs/**"],
			},
			inheritSkills: true,
			skillOverrides: ["custom-skill"],
			workspacePath: "/workspace/project",
			parentTaskId: "parent-123",
			rootTaskId: "root-456",
		}
		const result = taskContextSchema.parse(context)
		expect(result).toEqual(context)
	})

	it("rejects missing mode", () => {
		expect(() => taskContextSchema.parse({})).toThrow()
	})
})

describe("mergePermissions", () => {
	it("returns undefined when both are undefined", () => {
		expect(mergePermissions(undefined, undefined)).toBeUndefined()
	})

	it("returns child when parent is undefined", () => {
		const child: TaskPermissions = { readOnly: true }
		expect(mergePermissions(undefined, child)).toEqual(child)
	})

	it("returns parent when child is undefined", () => {
		const parent: TaskPermissions = { readOnly: true }
		expect(mergePermissions(parent, undefined)).toEqual(parent)
	})

	it("merges readOnly with OR logic", () => {
		expect(mergePermissions({ readOnly: true }, { readOnly: false })).toMatchObject({ readOnly: true })
		expect(mergePermissions({ readOnly: false }, { readOnly: true })).toMatchObject({ readOnly: true })
		expect(mergePermissions({ readOnly: false }, { readOnly: false })).toMatchObject({})
	})

	it("intersects fileWritePatterns", () => {
		const parent: TaskPermissions = { fileWritePatterns: ["docs/**", "src/**", "package.json"] }
		const child: TaskPermissions = { fileWritePatterns: ["docs/**", "package.json"] }
		const result = mergePermissions(parent, child)
		expect(result?.fileWritePatterns).toEqual(["docs/**", "package.json"])
	})

	it("intersects allowedTools", () => {
		const parent: TaskPermissions = { allowedTools: ["read_file", "list_files", "search_files"] }
		const child: TaskPermissions = { allowedTools: ["read_file", "search_files", "write_to_file"] }
		const result = mergePermissions(parent, child)
		expect(result?.allowedTools).toEqual(["read_file", "search_files"])
	})

	it("unions blockedCommands", () => {
		const parent: TaskPermissions = { blockedCommands: ["rm -rf"] }
		const child: TaskPermissions = { blockedCommands: ["git push", "rm -rf"] }
		const result = mergePermissions(parent, child)
		expect(result?.blockedCommands).toEqual(["rm -rf", "git push"])
	})

	it("returns defined array when only one side specifies it", () => {
		const parent: TaskPermissions = { fileReadPatterns: ["docs/**"] }
		const child: TaskPermissions = {}
		const result = mergePermissions(parent, child)
		expect(result?.fileReadPatterns).toEqual(["docs/**"])
	})

	it("returns empty array when intersection is empty", () => {
		const parent: TaskPermissions = { allowedTools: ["read_file"] }
		const child: TaskPermissions = { allowedTools: ["write_to_file"] }
		const result = mergePermissions(parent, child)
		expect(result?.allowedTools).toEqual([])
	})
})
