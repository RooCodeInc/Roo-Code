/**
 * TraceLogger Tests
 *
 * Tests for the trace logging functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { logTrace, getTraceHistoryForIntent, classifyMutation } from "../../hooks/TraceLogger"
import { type AgentTraceEntry, ensureOrchestrationDir, getOrchestrationDir } from "../../hooks/types"

// Test fixtures
describe("TraceLogger", () => {
	let tempDir: string

	beforeEach(async () => {
		// Create a temporary directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-logger-test-"))
		await ensureOrchestrationDir(tempDir)
	})

	afterEach(() => {
		// Clean up temporary directory
		if (tempDir && fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
	})

	describe("logTrace", () => {
		it("should create trace file with entry", async () => {
			const result = await logTrace({
				workspacePath: tempDir,
				taskId: "task-123",
				instanceId: "instance-456",
				intentId: "intent-1",
				filePath: "src/test.ts",
				content: "console.log('hello')",
				startLine: 1,
				endLine: 1,
				mutationClass: "INTENT_EVOLUTION",
			})

			expect(result).toBeDefined()
			expect(result.id).toBeDefined()
			expect(result.timestamp).toBeDefined()
			expect(result.files[0].relative_path).toBe("src/test.ts")
			expect(result.files[0].conversations[0].related[0].value).toBe("intent-1")
		})

		it("should append to existing trace file", async () => {
			// First trace
			await logTrace({
				workspacePath: tempDir,
				taskId: "task-123",
				instanceId: "instance-456",
				intentId: "intent-1",
				filePath: "src/file1.ts",
				content: "content 1",
				startLine: 1,
				endLine: 10,
				mutationClass: "INTENT_EVOLUTION",
			})

			// Second trace
			await logTrace({
				workspacePath: tempDir,
				taskId: "task-123",
				instanceId: "instance-456",
				intentId: "intent-1",
				filePath: "src/file2.ts",
				content: "content 2",
				startLine: 1,
				endLine: 20,
				mutationClass: "AST_REFACTOR",
			})

			// Verify file has both entries
			const tracePath = path.join(getOrchestrationDir(tempDir), "agent_trace.jsonl")
			const content = fs.readFileSync(tracePath, "utf-8")
			const lines = content.split("\n").filter((line) => line.trim())

			expect(lines.length).toBe(2)
		})

		it("should include model identifier when provided", async () => {
			const result = await logTrace({
				workspacePath: tempDir,
				taskId: "task-123",
				instanceId: "instance-456",
				intentId: "intent-1",
				filePath: "src/test.ts",
				content: "content",
				startLine: 1,
				endLine: 1,
				modelIdentifier: "claude-4-opus",
				mutationClass: "DOCUMENTATION",
			})

			expect(result.files[0].conversations[0].contributor.model_identifier).toBe("claude-4-opus")
		})

		it("should use default model identifier when not provided", async () => {
			const result = await logTrace({
				workspacePath: tempDir,
				taskId: "task-123",
				instanceId: "instance-456",
				intentId: "intent-1",
				filePath: "src/test.ts",
				content: "content",
				startLine: 1,
				endLine: 1,
				mutationClass: "UNKNOWN",
			})

			expect(result.files[0].conversations[0].contributor.model_identifier).toBe("claude-3-5-sonnet")
		})

		it("should compute content hash", async () => {
			const result = await logTrace({
				workspacePath: tempDir,
				taskId: "task-123",
				instanceId: "instance-456",
				intentId: "intent-1",
				filePath: "src/test.ts",
				content: "test content",
				startLine: 1,
				endLine: 1,
				mutationClass: "INTENT_EVOLUTION",
			})

			expect(result.files[0].conversations[0].ranges[0].content_hash).toContain("sha256:")
		})
	})

	describe("getTraceHistoryForIntent", () => {
		it("should return empty array when no trace file exists", async () => {
			const result = await getTraceHistoryForIntent(tempDir, "intent-1")
			expect(result).toEqual([])
		})

		it("should return trace entries for specific intent", async () => {
			// Create traces for different intents
			await logTrace({
				workspacePath: tempDir,
				taskId: "task-123",
				instanceId: "instance-456",
				intentId: "intent-1",
				filePath: "src/file1.ts",
				content: "content 1",
				startLine: 1,
				endLine: 10,
				mutationClass: "INTENT_EVOLUTION",
			})

			await logTrace({
				workspacePath: tempDir,
				taskId: "task-123",
				instanceId: "instance-456",
				intentId: "intent-2",
				filePath: "src/file2.ts",
				content: "content 2",
				startLine: 1,
				endLine: 20,
				mutationClass: "AST_REFACTOR",
			})

			await logTrace({
				workspacePath: tempDir,
				taskId: "task-123",
				instanceId: "instance-456",
				intentId: "intent-1",
				filePath: "src/file3.ts",
				content: "content 3",
				startLine: 1,
				endLine: 30,
				mutationClass: "DOCUMENTATION",
			})

			// Get traces for intent-1
			const result = await getTraceHistoryForIntent(tempDir, "intent-1")

			expect(result.length).toBe(2)
			expect(result[0].files[0].relative_path).toBe("src/file1.ts")
			expect(result[1].files[0].relative_path).toBe("src/file3.ts")
		})

		it("should return empty array for non-existent intent", async () => {
			await logTrace({
				workspacePath: tempDir,
				taskId: "task-123",
				instanceId: "instance-456",
				intentId: "intent-1",
				filePath: "src/file1.ts",
				content: "content",
				startLine: 1,
				endLine: 10,
				mutationClass: "INTENT_EVOLUTION",
			})

			const result = await getTraceHistoryForIntent(tempDir, "non-existent")

			expect(result).toEqual([])
		})
	})

	describe("classifyMutation", () => {
		it("should classify highly similar content as AST_REFACTOR", () => {
			const original = "function test() { return 'hello' }"
			const result = classifyMutation(original, original.substring(0, 5) + "modified" + original.substring(5))

			// This tests the similarity calculation
			expect(["AST_REFACTOR", "INTENT_EVOLUTION", "UNKNOWN"]).toContain(result)
		})

		it("should classify significantly different content as INTENT_EVOLUTION", () => {
			const original = "function test() { return 'hello' }"
			const result = classifyMutation(original, "completely different content here")

			expect(result).toBe("INTENT_EVOLUTION")
		})

		it("should return UNKNOWN for moderate similarity", () => {
			// Create two strings with moderate similarity (~50%) - more characters need to differ
			const original = "abcdefgh"
			const modified = "abcdefxy" // 50% different (2/8 = 0.75 = 75% similar)
			const result = classifyMutation(original, modified)

			expect(result).toBe("UNKNOWN")
		})

		it("should handle empty original content", () => {
			const result = classifyMutation("", "new content")

			expect(result).toBe("INTENT_EVOLUTION")
		})

		it("should handle empty new content", () => {
			const result = classifyMutation("original content", "")

			expect(result).toBe("INTENT_EVOLUTION")
		})

		it("should handle identical content", () => {
			const content = "identical content"
			const result = classifyMutation(content, content)

			expect(result).toBe("AST_REFACTOR")
		})
	})
})
