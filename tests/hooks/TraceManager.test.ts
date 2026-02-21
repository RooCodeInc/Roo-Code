// npx vitest run tests/hooks/TraceManager.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { TraceManager } from "../../src/hooks/TraceManager"
import { OrchestrationStorage } from "../../src/hooks/OrchestrationStorage"
import type { TraceLogEntry, MutationClass } from "../../src/hooks/types"

vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/workspace",
				},
			},
		],
		fs: {
			stat: vi.fn(),
			createDirectory: vi.fn(),
			readFile: vi.fn(),
			writeFile: vi.fn(),
		},
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
	},
}))

vi.mock("fs/promises", () => ({
	appendFile: vi.fn(),
	access: vi.fn(),
}))

describe("TraceManager", () => {
	let traceManager: TraceManager
	let storage: OrchestrationStorage
	const workspaceRoot = "/workspace"
	const traceFilePath = path.join(workspaceRoot, ".orchestration", "agent_trace.jsonl")

	beforeEach(() => {
		storage = new OrchestrationStorage()
		traceManager = new TraceManager(storage)
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("appendTraceEntry", () => {
		it("should create a trace entry and append it to agent_trace.jsonl in spec format", async () => {
			const entry: TraceLogEntry = {
				intentId: "INT-001",
				contentHash: "abc123def456",
				filePath: "src/test.ts",
				mutationClass: "CREATE",
				timestamp: "2026-02-16T10:00:00.000Z",
				toolName: "write_to_file",
			}

			const vscode = await import("vscode")
			vi.mocked(vscode.workspace.fs.stat).mockResolvedValueOnce({} as any)
			vi.mocked(fs.appendFile).mockResolvedValueOnce(undefined)

			await traceManager.appendTraceEntry(entry)

			const expectedPath = path.join(workspaceRoot, ".orchestration", "agent_trace.jsonl")
			const written = vi.mocked(fs.appendFile).mock.calls[0][1] as string
			const parsed = JSON.parse(written.trim())
			expect(parsed).toMatchObject({
				timestamp: "2026-02-16T10:00:00.000Z",
				intent_id: "INT-001",
				operation: "WRITE",
				file_path: "src/test.ts",
				content_hash: "sha256:abc123def456",
				classification: "INTENT_EVOLUTION",
			})
			expect(fs.appendFile).toHaveBeenCalledWith(expectedPath, expect.any(String), "utf-8")
		})

		it("should determine mutation_class as CREATE when file does not exist", async () => {
			const filePath = "src/new-file.ts"
			const absolutePath = path.join(workspaceRoot, filePath)

			// Mock file does not exist
			vi.mocked(fs.access).mockRejectedValueOnce(new Error("File not found"))

			const mutationClass = await traceManager.determineMutationClass(filePath, workspaceRoot)

			expect(mutationClass).toBe("CREATE")
		})

		it("should determine mutation_class as MODIFY when file exists", async () => {
			const filePath = "src/existing-file.ts"
			const absolutePath = path.join(workspaceRoot, filePath)

			// Mock file exists
			vi.mocked(fs.access).mockResolvedValueOnce(undefined)

			const mutationClass = await traceManager.determineMutationClass(filePath, workspaceRoot)

			expect(mutationClass).toBe("MODIFY")
		})

		it("should handle trace logging failures gracefully without blocking", async () => {
			const entry: TraceLogEntry = {
				intentId: "INT-001",
				contentHash: "abc123def456",
				filePath: "src/test.ts",
				mutationClass: "CREATE",
				timestamp: "2026-02-16T10:00:00.000Z",
				toolName: "write_to_file",
			}

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Mock appendFile to fail
			vi.mocked(fs.appendFile).mockRejectedValueOnce(new Error("Disk full"))

			// Should not throw
			await expect(traceManager.appendTraceEntry(entry)).resolves.not.toThrow()

			// Should log error
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Failed to append trace entry"),
				expect.any(Error),
			)

			consoleErrorSpy.mockRestore()
		})

		it("should format trace entry in spec-aligned format (MODIFY -> AST_REFACTOR)", async () => {
			const entry: TraceLogEntry = {
				intentId: "INT-001",
				contentHash: "abc123def4567890123456789012345678901234567890123456789012345678",
				filePath: "src/test.ts",
				mutationClass: "MODIFY",
				lineRanges: [{ start: 1, end: 10 }],
				timestamp: "2026-02-16T10:00:00.000Z",
				toolName: "write_to_file",
				gitSha: "abc123def",
			}

			vi.mocked(fs.appendFile).mockResolvedValueOnce(undefined)

			await traceManager.appendTraceEntry(entry)

			const callArgs = vi.mocked(fs.appendFile).mock.calls[0]
			const writtenContent = callArgs[1] as string
			const parsedEntry = JSON.parse(writtenContent.trim())

			expect(parsedEntry.intent_id).toBe("INT-001")
			expect(parsedEntry.content_hash).toBe(
				"sha256:abc123def4567890123456789012345678901234567890123456789012345678",
			)
			expect(parsedEntry.file_path).toBe("src/test.ts")
			expect(parsedEntry.operation).toBe("WRITE")
			expect(parsedEntry.classification).toBe("AST_REFACTOR")
			expect(parsedEntry.timestamp).toBe("2026-02-16T10:00:00.000Z")
		})
	})

	describe("determineMutationClass", () => {
		it("should return CREATE for non-existent file", async () => {
			const filePath = "src/new.ts"
			vi.mocked(fs.access).mockRejectedValueOnce(new Error("ENOENT"))

			const result = await traceManager.determineMutationClass(filePath, workspaceRoot)

			expect(result).toBe("CREATE")
		})

		it("should return MODIFY for existing file", async () => {
			const filePath = "src/existing.ts"
			vi.mocked(fs.access).mockResolvedValueOnce(undefined)

			const result = await traceManager.determineMutationClass(filePath, workspaceRoot)

			expect(result).toBe("MODIFY")
		})
	})

	describe("computeContentHash", () => {
		it("should compute SHA256 hash from raw file bytes", () => {
			const content = "function hello() {}"
			const hash = traceManager.computeContentHash(content)

			expect(hash).toMatch(/^[a-f0-9]{64}$/) // SHA256 hex string is 64 characters
		})

		it("should produce the same hash for identical content", () => {
			const content = "function hello() {}"
			const hash1 = traceManager.computeContentHash(content)
			const hash2 = traceManager.computeContentHash(content)

			expect(hash1).toBe(hash2)
		})

		it("should produce different hashes for different content", () => {
			const content1 = "function hello() {}"
			const content2 = "function goodbye() {}"
			const hash1 = traceManager.computeContentHash(content1)
			const hash2 = traceManager.computeContentHash(content2)

			expect(hash1).not.toBe(hash2)
		})

		it("should preserve exact content integrity (no normalization)", () => {
			// Test that line endings and whitespace differences produce different hashes
			const content1 = "line1\nline2\n"
			const content2 = "line1\r\nline2\r\n"
			const hash1 = traceManager.computeContentHash(content1)
			const hash2 = traceManager.computeContentHash(content2)

			expect(hash1).not.toBe(hash2)
		})

		it("should compute hash within performance target (<50ms for 1MB)", async () => {
			// Create 1MB content
			const largeContent = "x".repeat(1024 * 1024)

			const startTime = Date.now()
			traceManager.computeContentHash(largeContent)
			const duration = Date.now() - startTime

			expect(duration).toBeLessThan(50)
		})
	})

	describe("createTraceEntry", () => {
		it("should create trace entry with content hash", async () => {
			const params = {
				intentId: "INT-001",
				filePath: "src/test.ts",
				content: "function hello() {}",
				workspaceRoot,
				toolName: "write_to_file",
			}

			vi.mocked(fs.access).mockRejectedValueOnce(new Error("ENOENT"))

			const entry = await traceManager.createTraceEntry(params)

			expect(entry.intentId).toBe("INT-001")
			expect(entry.filePath).toBe("src/test.ts")
			expect(entry.mutationClass).toBe("CREATE")
			expect(entry.contentHash).toMatch(/^[a-f0-9]{64}$/)
			expect(entry.toolName).toBe("write_to_file")
			expect(entry.timestamp).toBeDefined()
		})
	})
})
