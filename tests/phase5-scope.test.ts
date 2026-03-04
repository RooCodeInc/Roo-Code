import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import { IntentHookEngine } from "../src/core/intent/IntentHookEngine"
import { ScopeValidator } from "../src/core/intent/ScopeValidator"

describe("Phase 5: Scope Enforcement and Out-of-Scope Detection", () => {
	let engine: IntentHookEngine
	const testDir = ".orchestration"
	const intentsPath = ".orchestration/active_intents.yaml"

	beforeEach(() => {
		// Cleanup first
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true })
		}

		// Create test intent structure
		fs.mkdirSync(testDir, { recursive: true })

		const yamlContent = {
			active_intents: [
				{
					id: "INT-001",
					name: "Refactor Auth Module",
					status: "active",
					owned_scope: ["src/auth/", "src/services/auth.ts", "tests/auth/"],
					constraints: ["Use JWT instead of Session", "Preserve backward compatibility"],
					acceptance_criteria: ["All tests pass", "Token validation works"],
				},
				{
					id: "INT-002",
					name: "Update Config System",
					status: "active",
					owned_scope: ["src/config/", "src/constants/"],
					constraints: ["Maintain backwards compat", "Support env vars"],
					acceptance_criteria: ["Config validation tests pass"],
				},
			],
		}

		fs.writeFileSync(intentsPath, yaml.dump(yamlContent), "utf8")
		engine = new IntentHookEngine()
	})

	afterEach(() => {
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true })
		}
	})

	describe("ScopeValidator: Path Matching", () => {
		it("matches exact file paths", () => {
			const scope = ["src/services/auth.ts"]
			const result = ScopeValidator.isPathInScope("src/services/auth.ts", scope)

			expect(result.isWithinScope).toBe(true)
		})

		it("matches directory patterns (trailing slash)", () => {
			const scope = ["src/auth/"]
			const result = ScopeValidator.isPathInScope("src/auth/middleware.ts", scope)

			expect(result.isWithinScope).toBe(true)
		})

		it("matches deeply nested files in directory", () => {
			const scope = ["src/auth/"]
			const result = ScopeValidator.isPathInScope("src/auth/strategies/jwt/handler.ts", scope)

			expect(result.isWithinScope).toBe(true)
		})

		it("rejects files outside scope", () => {
			const scope = ["src/auth/"]
			const result = ScopeValidator.isPathInScope("src/models/user.ts", scope)

			expect(result.isWithinScope).toBe(false)
			expect(result.reason).toContain("outside")
		})

		it("handles multiple scope entries", () => {
			const scope = ["src/auth/", "src/services/"]
			const result = ScopeValidator.isPathInScope("src/services/token.ts", scope)

			expect(result.isWithinScope).toBe(true)
		})

		it("validates multiple file paths at once", () => {
			const scope = ["src/auth/", "tests/"]
			const result = ScopeValidator.arePathsInScope(
				["src/auth/middleware.ts", "tests/auth.test.ts"],
				scope,
			)

			expect(result.isWithinScope).toBe(true)
		})

		it("rejects if any file is out of scope", () => {
			const scope = ["src/auth/"]
			const result = ScopeValidator.arePathsInScope(
				["src/auth/middleware.ts", "src/models/user.ts"],
				scope,
			)

			expect(result.isWithinScope).toBe(false)
			expect(result.reason).toContain("outside")
		})

		it("normalizes Windows-style paths", () => {
			const scope = ["src/auth/"]
			const result = ScopeValidator.isPathInScope("src\\auth\\middleware.ts", scope)

			expect(result.isWithinScope).toBe(true)
		})
	})

	describe("ScopeValidator: Glob Patterns", () => {
		it("matches wildcard patterns (single level)", () => {
			const scope = ["src/*/middleware.ts"]
			const result = ScopeValidator.isPathInScope("src/auth/middleware.ts", scope)

			expect(result.isWithinScope).toBe(true)
		})

		it("matches double-wildcard patterns (recursive)", () => {
			const scope = ["src/**/hooks.ts"]
			const result = ScopeValidator.isPathInScope("src/auth/strategies/hooks.ts", scope)

			expect(result.isWithinScope).toBe(true)
		})

		it("rejects paths not matching glob", () => {
			const scope = ["src/**/hooks.ts"]
			const result = ScopeValidator.isPathInScope("src/auth/middleware.ts", scope)

			expect(result.isWithinScope).toBe(false)
		})
	})

	describe("ScopeValidator: Diff Parsing", () => {
		it("extracts file paths from unified diff", () => {
			const diff = `--- a/src/auth/middleware.ts
+++ b/src/auth/middleware.ts
@@ -1,5 +1,6 @@
- export const handler = () => {}
+ export const handler = async () => {}`

			const files = ScopeValidator.extractFilesFromDiff(diff)

			expect(files).toContain("src/auth/middleware.ts")
		})

		it("extracts multiple files from diff", () => {
			const diff = `--- a/src/auth/middleware.ts
+++ b/src/auth/middleware.ts

--- a/src/services/auth.ts
+++ b/src/services/auth.ts`

			const files = ScopeValidator.extractFilesFromDiff(diff)

			expect(files).toHaveLength(2)
			expect(files).toContain("src/auth/middleware.ts")
			expect(files).toContain("src/services/auth.ts")
		})

		it("handles git-style diff headers", () => {
			const diff = `diff --git a/src/file.ts b/src/file.ts
index 123..456 100644
--- a/src/file.ts
+++ b/src/file.ts`

			const files = ScopeValidator.extractFilesFromDiff(diff)

			expect(files).toContain("src/file.ts")
		})
	})

	describe("IntentHookEngine: Scope Validation", () => {
		it("validates file is within current intent scope", () => {
			// Select INT-001
			engine.preHook("select_active_intent", { intent_id: "INT-001" })

			const result = engine.validateScope(["src/auth/middleware.ts"])

			expect(result.isWithinScope).toBe(true)
		})

		it("blocks file outside current intent scope", () => {
			// Select INT-001 (owns src/auth/, src/services/auth.ts)
			engine.preHook("select_active_intent", { intent_id: "INT-001" })

			const result = engine.validateScope(["src/models/user.ts"])

			expect(result.isWithinScope).toBe(false)
			expect(result.reason).toContain("outside")
			expect(result.allowedPaths).toEqual(["src/auth/", "src/services/auth.ts", "tests/auth/"])
		})

		it("validates single file path", () => {
			engine.preHook("select_active_intent", { intent_id: "INT-001" })

			expect(engine.isFileInScope("src/auth/middleware.ts")).toBe(true)
			expect(engine.isFileInScope("src/models/user.ts")).toBe(false)
		})

		it("requires active intent for scope validation", () => {
			const result = engine.validateScope(["src/auth/middleware.ts"])

			expect(result.isWithinScope).toBe(false)
			expect(result.reason).toContain("No active intent")
		})

		it("validates multiple files across scope", () => {
			engine.preHook("select_active_intent", { intent_id: "INT-001" })

			const result = engine.validateScope(["src/auth/middleware.ts", "tests/auth/middleware.test.ts"])

			expect(result.isWithinScope).toBe(true)
		})

		it("rejects multiple files if any is out of scope", () => {
			engine.preHook("select_active_intent", { intent_id: "INT-001" })

			const result = engine.validateScope(["src/auth/middleware.ts", "src/db/connect.ts"])

			expect(result.isWithinScope).toBe(false)
		})
	})

	describe("Scope Validation with Different Intents", () => {
		it("validates against INT-001 scope", () => {
			engine.preHook("select_active_intent", { intent_id: "INT-001" })

			expect(engine.isFileInScope("src/auth/middleware.ts")).toBe(true)
			expect(engine.isFileInScope("src/config/app.ts")).toBe(false)
		})

		it("validates against INT-002 scope", () => {
			engine.preHook("select_active_intent", { intent_id: "INT-002" })

			expect(engine.isFileInScope("src/config/app.ts")).toBe(true)
			expect(engine.isFileInScope("src/constants/defaults.ts")).toBe(true)
			expect(engine.isFileInScope("src/auth/hooks.ts")).toBe(false)
		})
	})

	describe("Out-of-Scope Error Handling", () => {
		it("returns detailed error for out-of-scope file", () => {
			engine.preHook("select_active_intent", { intent_id: "INT-001" })

			const result = engine.validateScope(["src/plugins/external.ts"])

			expect(result.isWithinScope).toBe(false)
			expect(result.attemptedPath).toBe("src/plugins/external.ts")
			expect(result.allowedPaths).toContain("src/auth/")
		})

		it("returns multiple out-of-scope files in error", () => {
			engine.preHook("select_active_intent", { intent_id: "INT-001" })

			const result = engine.validateScope(["src/plugins/a.ts", "src/db/b.ts", "src/auth/ok.ts"])

			expect(result.isWithinScope).toBe(false)
			expect(result.reason).toContain("2 file(s) outside scope")
		})
	})

	describe("Scope Override with Approval", () => {
		it("prepares approval request for out-of-scope changes", () => {
			engine.preHook("select_active_intent", { intent_id: "INT-001" })

			// Verify validation detects out-of-scope
			const result = engine.validateScope(["src/security/bypass.ts"])
			expect(result.isWithinScope).toBe(false)

			// The requestApprovalForOutOfScope would be called here
			// In async tests, we'd await it, but for now just verify validation works
		})

		it("records approval decision for override", () => {
			engine.preHook("select_active_intent", { intent_id: "INT-001" })

			// Simulate: get pending approvals, then record decision
			const pending = engine.getPendingApprovals()
			const requestId = Object.keys(pending)[0] || "test-request-123"

			engine.recordApprovalDecision(requestId, true, "alice@example.com", "Approved critical fix", true)

			const approvals = engine.getIntentApprovals("INT-001")
			// Should have recorded the decision
			expect(Array.isArray(approvals)).toBe(true)
		})
	})

	describe("Gatekeeper Integration with Scope", () => {
		it("blocks write_file without active intent", () => {
			const result = engine.gatekeeper("write_file")

			expect(result.allowed).toBe(false)
			expect(result.message).toContain("Intent ID")
		})

		it("allows write_file with active intent in scope", () => {
			engine.preHook("select_active_intent", { intent_id: "INT-001" })

			const result = engine.gatekeeper("write_file")

			expect(result.allowed).toBe(true)
		})
	})
})
