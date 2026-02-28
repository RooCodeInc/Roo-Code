import { enforceIntentScope, getToolTargetPaths } from "../ScopeEnforcer"

describe("ScopeEnforcer", () => {
	it("extracts target path for write_to_file", () => {
		const paths = getToolTargetPaths("write_to_file", { path: "src/core/task/Task.ts" })
		expect(paths).toEqual(["src/core/task/Task.ts"])
	})

	it("extracts target paths from apply_patch headers", () => {
		const patch = `*** Begin Patch\n*** Update File: src/core/task/Task.ts\n*** End Patch`
		const paths = getToolTargetPaths("apply_patch", { patch })
		expect(paths).toEqual(["src/core/task/Task.ts"])
	})

	it("allows path inside scope", () => {
		const result = enforceIntentScope("REQ-001", "/workspace", { files: ["src/core/**"] }, [
			"src/core/task/Task.ts",
		])
		expect(result).toEqual({ allowed: true })
	})

	it("blocks path outside scope with required message shape", () => {
		const result = enforceIntentScope("REQ-001", "/workspace", { files: ["src/core/**"] }, [
			"src/webview-ui/App.tsx",
		])
		expect(result.allowed).toBe(false)
		if (!result.allowed) {
			expect(result.error).toBe(
				"Scope Violation: REQ-001 is not authorized to edit [src/webview-ui/App.tsx]. Request scope expansion.",
			)
		}
	})
})
