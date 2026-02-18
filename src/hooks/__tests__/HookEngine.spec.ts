/**
 * Phase 2 — HookEngine Unit Tests
 *
 * Tests for the Hook Engine, command classifier, scope enforcer,
 * authorization hook, and tool error builder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock vscode before importing modules that use it
vi.mock("vscode", () => ({
	window: {
		showWarningMessage: vi.fn(),
	},
}))

// Mock fs for intentIgnore
vi.mock("fs", () => ({
	readFileSync: vi.fn(),
}))

// Mock activeIntents for scope enforcer
vi.mock("../../core/context/activeIntents", () => ({
	isGovernedWorkspace: vi.fn(),
	loadActiveIntents: vi.fn(),
	findIntentById: vi.fn(),
}))

import * as vscode from "vscode"
import * as fs from "fs"
import { classifyTool, isExplicitlyDestructive } from "../commandClassifier"
import { buildToolError, buildScopeViolationError, buildAuthorizationRejectedError, HookErrorCode } from "../toolError"
import { parseIntentIgnore, isIgnoredByIntent } from "../intentIgnore"
import { isPathInScope, extractTargetPath, checkScopeViolation } from "../scopeEnforcer"
import { scopeEnforcerHook } from "../scopeEnforcer"
import { authorizationHook } from "../authorizationHook"
import { HookEngine } from "../HookEngine"
import { isGovernedWorkspace, loadActiveIntents, findIntentById } from "../../core/context/activeIntents"
import type { HookContext } from "../types"

// ============================================================================
// Command Classification
// ============================================================================

describe("commandClassifier", () => {
	describe("classifyTool", () => {
		it("classifies read-only tools as safe", () => {
			expect(classifyTool("read_file")).toBe("safe")
			expect(classifyTool("search_files")).toBe("safe")
			expect(classifyTool("list_files")).toBe("safe")
			expect(classifyTool("codebase_search")).toBe("safe")
			expect(classifyTool("read_command_output")).toBe("safe")
		})

		it("classifies meta tools as safe", () => {
			expect(classifyTool("ask_followup_question")).toBe("safe")
			expect(classifyTool("attempt_completion")).toBe("safe")
			expect(classifyTool("switch_mode")).toBe("safe")
			expect(classifyTool("new_task")).toBe("safe")
			expect(classifyTool("select_active_intent")).toBe("safe")
		})

		it("classifies writing tools as destructive", () => {
			expect(classifyTool("write_to_file")).toBe("destructive")
			expect(classifyTool("apply_diff")).toBe("destructive")
			expect(classifyTool("edit")).toBe("destructive")
			expect(classifyTool("search_and_replace")).toBe("destructive")
			expect(classifyTool("execute_command")).toBe("destructive")
		})

		it("classifies unknown tools as destructive (safe default)", () => {
			expect(classifyTool("some_unknown_tool")).toBe("destructive")
		})
	})

	describe("isExplicitlyDestructive", () => {
		it("returns true for known destructive tools", () => {
			expect(isExplicitlyDestructive("write_to_file")).toBe(true)
			expect(isExplicitlyDestructive("execute_command")).toBe(true)
		})

		it("returns false for unknown tools (even if classified as destructive)", () => {
			expect(isExplicitlyDestructive("some_unknown_tool")).toBe(false)
		})
	})
})

// ============================================================================
// Tool Error Builder
// ============================================================================

describe("toolError", () => {
	describe("buildToolError", () => {
		it("produces valid JSON with correct shape", () => {
			const result = buildToolError(HookErrorCode.HOOK_BLOCKED, "Test message")
			const parsed = JSON.parse(result)

			expect(parsed.status).toBe("error")
			expect(parsed.message).toBe("Test message")
			expect(parsed.error.code).toBe("HOOK_BLOCKED")
		})

		it("includes details when provided", () => {
			const result = buildToolError(HookErrorCode.HOOK_BLOCKED, "msg", { foo: "bar" })
			const parsed = JSON.parse(result)

			expect(parsed.error.details).toEqual({ foo: "bar" })
		})

		it("omits details key when not provided", () => {
			const result = buildToolError(HookErrorCode.HOOK_BLOCKED, "msg")
			const parsed = JSON.parse(result)

			expect(parsed.error).not.toHaveProperty("details")
		})
	})

	describe("buildScopeViolationError", () => {
		it("contains the REQ-001 wording", () => {
			const result = buildScopeViolationError("refactor-auth", "src/billing/invoice.ts", ["src/auth/*"])
			expect(result).toContain("refactor-auth")
			expect(result).toContain("src/billing/invoice.ts")
			expect(result).toContain("Request scope expansion")

			const parsed = JSON.parse(result)
			expect(parsed.error.code).toBe("SCOPE_VIOLATION")
			expect(parsed.error.details.intentId).toBe("refactor-auth")
		})
	})

	describe("buildAuthorizationRejectedError", () => {
		it("contains tool name and rejection wording", () => {
			const result = buildAuthorizationRejectedError("write_to_file", "refactor-auth")
			const parsed = JSON.parse(result)

			expect(parsed.error.code).toBe("AUTHORIZATION_REJECTED")
			expect(parsed.message).toContain("write_to_file")
			expect(parsed.error.details.intentId).toBe("refactor-auth")
		})
	})
})

// ============================================================================
// Intent Ignore
// ============================================================================

describe("intentIgnore", () => {
	describe("parseIntentIgnore", () => {
		it("parses lines and skips comments and blanks", () => {
			const content = `
# Comment
dist/
*.log

node_modules/
# Another comment
`
			const patterns = parseIntentIgnore(content)
			expect(patterns).toEqual(["dist/", "*.log", "node_modules/"])
		})

		it("returns empty array for empty content", () => {
			expect(parseIntentIgnore("")).toEqual([])
		})
	})

	describe("isIgnoredByIntent", () => {
		it("matches prefix (directory)", () => {
			expect(isIgnoredByIntent("dist/index.js", ["dist/"])).toBe(true)
		})

		it("matches suffix (extension)", () => {
			expect(isIgnoredByIntent("app.log", ["*.log"])).toBe(true)
			expect(isIgnoredByIntent("src/debug.log", ["*.log"])).toBe(true)
		})

		it("matches contains (node_modules)", () => {
			expect(isIgnoredByIntent("foo/node_modules/bar.js", ["node_modules"])).toBe(true)
		})

		it("does not match unrelated paths", () => {
			expect(isIgnoredByIntent("src/auth/login.ts", ["dist/", "*.log"])).toBe(false)
		})

		it("returns false for empty patterns", () => {
			expect(isIgnoredByIntent("anything.ts", [])).toBe(false)
		})
	})
})

// ============================================================================
// Scope Enforcer
// ============================================================================

describe("scopeEnforcer", () => {
	describe("isPathInScope", () => {
		it("allows everything when scope is empty", () => {
			expect(isPathInScope("any/file.ts", [])).toBe(true)
		})

		it("matches exact path", () => {
			expect(isPathInScope("src/auth/login.ts", ["src/auth/login.ts"])).toBe(true)
		})

		it("matches single-level wildcard (dir/*)", () => {
			expect(isPathInScope("src/auth/login.ts", ["src/auth/*"])).toBe(true)
			// Should NOT match subdirectories
			expect(isPathInScope("src/auth/sub/deep.ts", ["src/auth/*"])).toBe(false)
		})

		it("matches recursive wildcard (dir/**)", () => {
			expect(isPathInScope("src/auth/login.ts", ["src/auth/**"])).toBe(true)
			expect(isPathInScope("src/auth/sub/deep.ts", ["src/auth/**"])).toBe(true)
		})

		it("matches plain directory prefix", () => {
			expect(isPathInScope("src/auth/login.ts", ["src/auth"])).toBe(true)
		})

		it("rejects out-of-scope paths", () => {
			expect(isPathInScope("src/billing/invoice.ts", ["src/auth/*"])).toBe(false)
		})
	})

	describe("extractTargetPath", () => {
		it("extracts 'path' param", () => {
			expect(extractTargetPath({ path: "src/file.ts" })).toBe("src/file.ts")
		})

		it("extracts 'file_path' param", () => {
			expect(extractTargetPath({ file_path: "src/file.ts" })).toBe("src/file.ts")
		})

		it("returns undefined when no path param exists", () => {
			expect(extractTargetPath({ command: "ls" })).toBeUndefined()
		})
	})

	describe("checkScopeViolation", () => {
		it("returns allowed for in-scope path", () => {
			const result = checkScopeViolation("src/auth/login.ts", "refactor-auth", ["src/auth/*"])
			expect(result.allowed).toBe(true)
		})

		it("returns violation for out-of-scope path", () => {
			const result = checkScopeViolation("src/billing/invoice.ts", "refactor-auth", ["src/auth/*"])
			expect(result.allowed).toBe(false)
			expect(result.violation).toContain("refactor-auth")
			expect(result.violation).toContain("src/billing/invoice.ts")
		})
	})

	describe("scopeEnforcerHook", () => {
		it("proceeds when no active intent", async () => {
			const ctx: HookContext = {
				toolName: "write_to_file",
				params: { path: "src/auth/login.ts" },
				cwd: "/workspace",
			}
			const result = await scopeEnforcerHook(ctx)
			expect(result.proceed).toBe(true)
		})

		it("proceeds when tool has no file path param", async () => {
			vi.mocked(loadActiveIntents).mockResolvedValue([
				{ id: "test", goal: "test", status: "IN_PROGRESS", constraints: [], scope: ["src/auth/*"] },
			])
			vi.mocked(findIntentById).mockReturnValue({
				id: "test",
				goal: "test",
				status: "IN_PROGRESS",
				constraints: [],
				scope: ["src/auth/*"],
			})

			const ctx: HookContext = {
				toolName: "execute_command",
				params: { command: "ls" },
				cwd: "/workspace",
				activeIntentId: "test",
			}
			const result = await scopeEnforcerHook(ctx)
			expect(result.proceed).toBe(true)
		})

		it("blocks when file is outside scope", async () => {
			vi.mocked(loadActiveIntents).mockResolvedValue([
				{ id: "refactor-auth", goal: "g", status: "IN_PROGRESS", constraints: [], scope: ["src/auth/*"] },
			])
			vi.mocked(findIntentById).mockReturnValue({
				id: "refactor-auth",
				goal: "g",
				status: "IN_PROGRESS",
				constraints: [],
				scope: ["src/auth/*"],
			})

			// Mock fs to return empty .intentignore
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("ENOENT")
			})

			const ctx: HookContext = {
				toolName: "write_to_file",
				params: { path: "src/billing/invoice.ts" },
				cwd: "/workspace",
				activeIntentId: "refactor-auth",
			}
			const result = await scopeEnforcerHook(ctx)
			expect(result.proceed).toBe(false)
			expect(result.error).toBeDefined()

			const parsed = JSON.parse(result.error!)
			expect(parsed.error.code).toBe("SCOPE_VIOLATION")
		})

		it("allows when file is within scope", async () => {
			vi.mocked(loadActiveIntents).mockResolvedValue([
				{ id: "refactor-auth", goal: "g", status: "IN_PROGRESS", constraints: [], scope: ["src/auth/*"] },
			])
			vi.mocked(findIntentById).mockReturnValue({
				id: "refactor-auth",
				goal: "g",
				status: "IN_PROGRESS",
				constraints: [],
				scope: ["src/auth/*"],
			})
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("ENOENT")
			})

			const ctx: HookContext = {
				toolName: "write_to_file",
				params: { path: "src/auth/login.ts" },
				cwd: "/workspace",
				activeIntentId: "refactor-auth",
			}
			const result = await scopeEnforcerHook(ctx)
			expect(result.proceed).toBe(true)
		})
	})
})

// ============================================================================
// Authorization Hook
// ============================================================================

describe("authorizationHook", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("proceeds when user approves", async () => {
		vi.mocked(vscode.window.showWarningMessage).mockResolvedValue("Approve" as any)

		const ctx: HookContext = {
			toolName: "write_to_file",
			params: { path: "src/auth/login.ts" },
			cwd: "/workspace",
			activeIntentId: "refactor-auth",
		}
		const result = await authorizationHook(ctx)
		expect(result.proceed).toBe(true)
	})

	it("blocks when user rejects", async () => {
		vi.mocked(vscode.window.showWarningMessage).mockResolvedValue("Reject" as any)

		const ctx: HookContext = {
			toolName: "write_to_file",
			params: { path: "src/auth/login.ts" },
			cwd: "/workspace",
			activeIntentId: "refactor-auth",
		}
		const result = await authorizationHook(ctx)
		expect(result.proceed).toBe(false)
		expect(result.error).toBeDefined()

		const parsed = JSON.parse(result.error!)
		expect(parsed.error.code).toBe("AUTHORIZATION_REJECTED")
	})

	it("blocks when user dismisses dialog (undefined)", async () => {
		vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined as any)

		const ctx: HookContext = {
			toolName: "execute_command",
			params: { command: "rm -rf /" },
			cwd: "/workspace",
		}
		const result = await authorizationHook(ctx)
		expect(result.proceed).toBe(false)
	})
})

// ============================================================================
// HookEngine
// ============================================================================

describe("HookEngine", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("bypasses all hooks for safe tools", async () => {
		vi.mocked(isGovernedWorkspace).mockReturnValue(true)

		const engine = new HookEngine()
		const ctx: HookContext = {
			toolName: "read_file",
			params: { path: "src/auth/login.ts" },
			cwd: "/workspace",
			activeIntentId: "refactor-auth",
		}
		const result = await engine.runPre(ctx)
		expect(result.proceed).toBe(true)
	})

	it("bypasses all hooks for ungoverned workspace", async () => {
		vi.mocked(isGovernedWorkspace).mockReturnValue(false)

		const engine = new HookEngine()
		const ctx: HookContext = {
			toolName: "write_to_file",
			params: { path: "src/auth/login.ts" },
			cwd: "/workspace",
		}
		const result = await engine.runPre(ctx)
		expect(result.proceed).toBe(true)
	})

	it("runs pre-hooks for destructive tools in governed mode", async () => {
		vi.mocked(isGovernedWorkspace).mockReturnValue(true)
		vi.mocked(vscode.window.showWarningMessage).mockResolvedValue("Approve" as any)

		const engine = new HookEngine()
		// Clear default hooks and add a simple pass-through
		engine.clearHooks()
		const mockHook = vi.fn().mockResolvedValue({ proceed: true })
		engine.addPreHook(mockHook)

		const ctx: HookContext = {
			toolName: "write_to_file",
			params: { path: "src/auth/login.ts" },
			cwd: "/workspace",
			activeIntentId: "refactor-auth",
		}
		const result = await engine.runPre(ctx)
		expect(result.proceed).toBe(true)
		expect(mockHook).toHaveBeenCalledOnce()
	})

	it("short-circuits on first blocking hook", async () => {
		vi.mocked(isGovernedWorkspace).mockReturnValue(true)

		const engine = new HookEngine()
		engine.clearHooks()

		const blockingHook = vi.fn().mockResolvedValue({
			proceed: false,
			error: '{"status":"error","message":"blocked"}',
		})
		const secondHook = vi.fn().mockResolvedValue({ proceed: true })

		engine.addPreHook(blockingHook)
		engine.addPreHook(secondHook)

		const ctx: HookContext = {
			toolName: "write_to_file",
			params: { path: "src/file.ts" },
			cwd: "/workspace",
			activeIntentId: "test",
		}
		const result = await engine.runPre(ctx)

		expect(result.proceed).toBe(false)
		expect(blockingHook).toHaveBeenCalledOnce()
		expect(secondHook).not.toHaveBeenCalled()
	})

	it("runs post-hooks without propagating errors", async () => {
		const engine = new HookEngine()
		const failingPostHook = vi.fn().mockRejectedValue(new Error("post-hook error"))
		engine.addPostHook(failingPostHook)

		const ctx: HookContext = {
			toolName: "write_to_file",
			params: {},
			cwd: "/workspace",
		}

		// Should not throw
		await expect(engine.runPost(ctx, { success: true })).resolves.toBeUndefined()
		expect(failingPostHook).toHaveBeenCalledOnce()
	})
})
