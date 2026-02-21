/**
 * HookEngine Tests
 *
 * Tests for the intent-code traceability middleware
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { HookEngine } from "../../hooks/HookEngine"
import {
	type ActiveIntent,
	type ActiveIntentsData,
	loadActiveIntents,
	saveActiveIntents,
	ensureOrchestrationDir,
} from "../../hooks/types"

// Test utilities
function createMockIntent(overrides: Partial<ActiveIntent> = {}): ActiveIntent {
	return {
		id: "test-intent-1",
		name: "Test Intent",
		status: "PENDING",
		owned_scope: ["src/**/*.ts", "tests/**/*"],
		constraints: ["Must not modify production code"],
		acceptance_criteria: ["Tests pass", "Code compiles"],
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		...overrides,
	}
}

function createMockIntentsData(intents: ActiveIntent[] = []): ActiveIntentsData {
	return {
		active_intents: intents.length > 0 ? intents : [createMockIntent()],
	}
}

// Test fixtures
describe("HookEngine", () => {
	let tempDir: string
	let hookEngine: HookEngine

	beforeEach(() => {
		// Create a temporary directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-engine-test-"))
		hookEngine = HookEngine.getInstance()
		hookEngine.reset() // Reset singleton state
	})

	afterEach(() => {
		// Clean up temporary directory
		if (tempDir && fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
	})

	describe("initialization", () => {
		it("should initialize with workspace path", () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")

			expect(hookEngine.getActiveIntentId()).toBeNull()
		})

		it("should reset session state", () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")
			hookEngine.reset()

			expect(hookEngine.getActiveIntentId()).toBeNull()
		})
	})

	describe("setActiveIntent", () => {
		beforeEach(async () => {
			// Set up the orchestration directory with active_intents.yaml
			await ensureOrchestrationDir(tempDir)
			const intentsData = createMockIntentsData([createMockIntent({ id: "intent-1", name: "Feature A" })])
			await saveActiveIntents(tempDir, intentsData)
		})

		it("should set active intent and return injected context", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")

			const result = await hookEngine.setActiveIntent("intent-1")

			expect(result.allowed).toBe(true)
			expect(result.injectedContext).toContain("intent_context")
			expect(result.injectedContext).toContain("intent-1")
			expect(result.injectedContext).toContain("Feature A")
		})

		it("should fail when HookEngine is not initialized", async () => {
			// Don't initialize - test uninitialized state
			const result = await hookEngine.setActiveIntent("intent-1")

			expect(result.allowed).toBe(false)
			expect(result.errorMessage).toContain("not initialized")
		})

		it("should fail when intent ID does not exist", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")

			const result = await hookEngine.setActiveIntent("non-existent-intent")

			expect(result.allowed).toBe(false)
			expect(result.errorMessage).toContain("not found")
		})

		it("should update intent status to IN_PROGRESS", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")

			await hookEngine.setActiveIntent("intent-1")

			const intentsData = await loadActiveIntents(tempDir)
			const intent = intentsData?.active_intents.find((i) => i.id === "intent-1")
			expect(intent?.status).toBe("IN_PROGRESS")
		})
	})

	describe("preHook", () => {
		beforeEach(async () => {
			await ensureOrchestrationDir(tempDir)
			const intentsData = createMockIntentsData([
				createMockIntent({
					id: "intent-1",
					name: "Feature A",
					owned_scope: ["src/**/*", "tests/**/*"],
				}),
			])
			await saveActiveIntents(tempDir, intentsData)
		})

		it("should allow safe tools without active intent", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")

			const result = await hookEngine.preHook({
				taskId: "task-123",
				instanceId: "instance-456",
				cwd: tempDir,
				activeIntentId: null,
				toolName: "read_file",
				toolParams: { path: "src/test.ts" },
			})

			expect(result.allowed).toBe(true)
		})

		it("should block destructive tools without active intent", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")

			const result = await hookEngine.preHook({
				taskId: "task-123",
				instanceId: "instance-456",
				cwd: tempDir,
				activeIntentId: null,
				toolName: "write_to_file",
				toolParams: { path: "src/test.ts" },
			})

			expect(result.allowed).toBe(false)
			expect(result.errorMessage).toContain("No active intent selected")
		})

		it("should allow write operations within scope", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")
			await hookEngine.setActiveIntent("intent-1")

			const result = await hookEngine.preHook({
				taskId: "task-123",
				instanceId: "instance-456",
				cwd: tempDir,
				activeIntentId: "intent-1",
				toolName: "write_to_file",
				toolParams: { path: "src/components/Test.tsx" },
			})

			expect(result.allowed).toBe(true)
		})

		it("should block write operations outside scope", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")
			await hookEngine.setActiveIntent("intent-1")

			const result = await hookEngine.preHook({
				taskId: "task-123",
				instanceId: "instance-456",
				cwd: tempDir,
				activeIntentId: "intent-1",
				toolName: "write_to_file",
				// Use a file clearly outside the scope (dist folder is not in owned_scope)
				toolParams: { path: "dist/outside-scope.ts" },
			})

			// Note: Current implementation returns false when file is outside scope
			expect(result.allowed).toBe(false)
			// Verify error message mentions scope violation
			expect(result.errorMessage).toContain("Scope Violation")
		})
	})

	describe("postHook", () => {
		beforeEach(async () => {
			await ensureOrchestrationDir(tempDir)
			const intentsData = createMockIntentsData([
				createMockIntent({
					id: "intent-1",
					name: "Feature A",
					owned_scope: ["src/**/*"],
				}),
			])
			await saveActiveIntents(tempDir, intentsData)
		})

		it("should not trace safe tools", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")
			await hookEngine.setActiveIntent("intent-1")

			const result = await hookEngine.postHook(
				{
					taskId: "task-123",
					instanceId: "instance-456",
					cwd: tempDir,
					activeIntentId: "intent-1",
					toolName: "read_file",
					toolParams: { path: "src/test.ts" },
				},
				"file content",
			)

			expect(result.success).toBe(true)
			expect(result.traceEntry).toBeUndefined()
		})

		it("should not trace when no active intent", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")

			const result = await hookEngine.postHook(
				{
					taskId: "task-123",
					instanceId: "instance-456",
					cwd: tempDir,
					activeIntentId: null,
					toolName: "write_to_file",
					toolParams: { path: "src/test.ts" },
				},
				"file content",
			)

			expect(result.success).toBe(true)
			expect(result.traceEntry).toBeUndefined()
		})

		it("should trace destructive tools and create trace entry", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")
			await hookEngine.setActiveIntent("intent-1")

			// Create a test file
			const testFilePath = path.join(tempDir, "src", "test.ts")
			fs.mkdirSync(path.dirname(testFilePath), { recursive: true })
			fs.writeFileSync(testFilePath, "test content", "utf-8")

			const result = await hookEngine.postHook(
				{
					taskId: "task-123",
					instanceId: "instance-456",
					cwd: tempDir,
					activeIntentId: "intent-1",
					toolName: "write_to_file",
					toolParams: { path: "src/test.ts" },
				},
				"file content",
			)

			expect(result.success).toBe(true)
			expect(result.traceEntry).toBeDefined()
			expect(result.traceEntry?.files[0].relative_path).toBe("src/test.ts")
			expect(result.traceEntry?.files[0].conversations[0].related[0].value).toBe("intent-1")
		})
	})

	describe("checkFileConcurrency", () => {
		beforeEach(async () => {
			await ensureOrchestrationDir(tempDir)
			const intentsData = createMockIntentsData([createMockIntent({ id: "intent-1" })])
			await saveActiveIntents(tempDir, intentsData)
		})

		it("should detect unchanged file", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")

			// Create a test file
			const testFilePath = path.join(tempDir, "src", "test.ts")
			fs.mkdirSync(path.dirname(testFilePath), { recursive: true })
			fs.writeFileSync(testFilePath, "test content", "utf-8")

			const { computeContentHash } = await import("../../hooks/types")
			const originalHash = computeContentHash("test content")

			const result = await hookEngine.checkFileConcurrency("src/test.ts", originalHash)

			expect(result.stale).toBe(false)
			expect(result.currentHash).toBe(originalHash)
		})

		it("should detect changed file", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")

			// Create a test file
			const testFilePath = path.join(tempDir, "src", "test.ts")
			fs.mkdirSync(path.dirname(testFilePath), { recursive: true })
			fs.writeFileSync(testFilePath, "original content", "utf-8")

			const { computeContentHash } = await import("../../hooks/types")
			const originalHash = computeContentHash("original content")

			// Modify the file
			fs.writeFileSync(testFilePath, "modified content", "utf-8")

			const result = await hookEngine.checkFileConcurrency("src/test.ts", originalHash)

			expect(result.stale).toBe(true)
			expect(result.currentHash).not.toBe(originalHash)
		})

		it("should handle non-existent file", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")

			const result = await hookEngine.checkFileConcurrency("non-existent.ts", "some-hash")

			expect(result.stale).toBe(false)
			expect(result.currentHash).toBe("")
		})
	})

	describe("updateIntentStatus", () => {
		beforeEach(async () => {
			await ensureOrchestrationDir(tempDir)
			const intentsData = createMockIntentsData([createMockIntent({ id: "intent-1", status: "IN_PROGRESS" })])
			await saveActiveIntents(tempDir, intentsData)
		})

		it("should update intent status to COMPLETED", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")
			await hookEngine.setActiveIntent("intent-1")

			await hookEngine.updateIntentStatus("intent-1", "COMPLETED")

			const intentsData = await loadActiveIntents(tempDir)
			const intent = intentsData?.active_intents.find((i) => i.id === "intent-1")
			expect(intent?.status).toBe("COMPLETED")
		})

		it("should clear active intent when status is updated", async () => {
			hookEngine.initialize(tempDir, "task-123", "instance-456")
			await hookEngine.setActiveIntent("intent-1")

			expect(hookEngine.getActiveIntentId()).toBe("intent-1")

			await hookEngine.updateIntentStatus("intent-1", "COMPLETED")

			expect(hookEngine.getActiveIntentId()).toBeNull()
		})
	})
})

// Type helper tests
describe("HookEngine types", () => {
	describe("classifyTool", () => {
		it("should classify read_file as SAFE", async () => {
			const { classifyTool } = await import("../../hooks/types")
			expect(classifyTool("read_file")).toBe("SAFE")
		})

		it("should classify write_to_file as DESTRUCTIVE", async () => {
			const { classifyTool } = await import("../../hooks/types")
			expect(classifyTool("write_to_file")).toBe("DESTRUCTIVE")
		})

		it("should classify execute_command as DESTRUCTIVE", async () => {
			const { classifyTool } = await import("../../hooks/types")
			expect(classifyTool("execute_command")).toBe("DESTRUCTIVE")
		})

		it("should classify unknown tools as UNKNOWN", async () => {
			const { classifyTool } = await import("../../hooks/types")
			expect(classifyTool("some_unknown_tool")).toBe("UNKNOWN")
		})
	})

	describe("isFileInScope", () => {
		it("should match exact file path", async () => {
			const { isFileInScope } = await import("../../hooks/types")
			expect(isFileInScope("src/test.ts", ["src/test.ts"])).toBe(true)
		})

		it("should match glob pattern with wildcard", async () => {
			const { isFileInScope } = await import("../../hooks/types")
			expect(isFileInScope("src/components/Test.ts", ["src/**/*.ts"])).toBe(true)
		})

		it("should not match files outside scope", async () => {
			const { isFileInScope } = await import("../../hooks/types")
			expect(isFileInScope("dist/index.js", ["src/**/*"])).toBe(false)
		})

		it("should match multiple scope patterns", async () => {
			const { isFileInScope } = await import("../../hooks/types")
			// Use exact patterns that will match
			expect(isFileInScope("src/test.ts", ["src/test.ts", "src/**/*"])).toBe(true)
		})
	})

	describe("computeContentHash", () => {
		it("should compute consistent hash for same content", async () => {
			const { computeContentHash } = await import("../../hooks/types")
			const hash1 = computeContentHash("test content")
			const hash2 = computeContentHash("test content")
			expect(hash1).toBe(hash2)
		})

		it("should compute different hash for different content", async () => {
			const { computeContentHash } = await import("../../hooks/types")
			const hash1 = computeContentHash("test content 1")
			const hash2 = computeContentHash("test content 2")
			expect(hash1).not.toBe(hash2)
		})

		it("should return sha256 prefixed hash", async () => {
			const { computeContentHash } = await import("../../hooks/types")
			const hash = computeContentHash("test")
			expect(hash.startsWith("sha256:")).toBe(true)
		})
	})
})
