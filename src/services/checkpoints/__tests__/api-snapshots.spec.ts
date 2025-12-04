import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { ShadowCheckpointService } from "../ShadowCheckpointService"
import { fileExistsAtPath } from "../../../utils/fs"
import { safeWriteJson } from "../../../utils/safeWriteJson"
import type { ApiMessage } from "../../../core/task-persistence"

vi.mock("fs/promises")
vi.mock("../../../utils/fs")
vi.mock("../../../utils/safeWriteJson")

describe("API History Snapshots", () => {
	let service: ShadowCheckpointService
	const mockTaskId = "test-task-123"
	const mockCheckpointsDir = "/mock/checkpoints"
	const mockWorkspaceDir = "/mock/workspace"
	const mockLog = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		// Create a concrete subclass for testing
		class TestCheckpointService extends ShadowCheckpointService {
			constructor() {
				super(mockTaskId, mockCheckpointsDir, mockWorkspaceDir, mockLog)
			}
		}
		service = new TestCheckpointService()
	})

	describe("saveApiHistorySnapshot", () => {
		it("should save API history snapshot to the correct path", async () => {
			const commitHash = "abc123"
			const apiHistory: ApiMessage[] = [
				{
					role: "user",
					content: "Test message 1",
					ts: 1000,
				},
				{
					role: "assistant",
					content: "Test response 1",
					ts: 2000,
				},
			]

			await service.saveApiHistorySnapshot(commitHash, apiHistory)

			const expectedPath = path.join(mockCheckpointsDir, "api_snapshots", `${commitHash}.json`)
			expect(safeWriteJson).toHaveBeenCalledWith(expectedPath, apiHistory)
		})

		it("should handle empty API history", async () => {
			const commitHash = "def456"
			const apiHistory: ApiMessage[] = []

			await service.saveApiHistorySnapshot(commitHash, apiHistory)

			const expectedPath = path.join(mockCheckpointsDir, "api_snapshots", `${commitHash}.json`)
			expect(safeWriteJson).toHaveBeenCalledWith(expectedPath, apiHistory)
		})

		it("should handle API history with context compression markers", async () => {
			const commitHash = "ghi789"
			const apiHistory: ApiMessage[] = [
				{
					role: "user",
					content: "Initial message",
					ts: 1000,
				},
				{
					role: "assistant",
					content: "Response",
					ts: 2000,
				},
				{
					role: "user",
					content: "Compressed context summary",
					ts: 3000,
					isSummary: true,
				},
				{
					role: "assistant",
					content: "After compression",
					ts: 4000,
				},
			]

			await service.saveApiHistorySnapshot(commitHash, apiHistory)

			const expectedPath = path.join(mockCheckpointsDir, "api_snapshots", `${commitHash}.json`)
			expect(safeWriteJson).toHaveBeenCalledWith(expectedPath, apiHistory)
		})
	})

	describe("restoreApiHistorySnapshot", () => {
		it("should restore API history snapshot when file exists", async () => {
			const commitHash = "abc123"
			const expectedHistory: ApiMessage[] = [
				{
					role: "user",
					content: "Test message 1",
					ts: 1000,
				},
				{
					role: "assistant",
					content: "Test response 1",
					ts: 2000,
				},
			]

			const snapshotPath = path.join(mockCheckpointsDir, "api_snapshots", `${commitHash}.json`)
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(expectedHistory))

			const result = await service.restoreApiHistorySnapshot(commitHash)

			expect(result).toEqual(expectedHistory)
			expect(fileExistsAtPath).toHaveBeenCalledWith(snapshotPath)
			expect(fs.readFile).toHaveBeenCalledWith(snapshotPath, "utf8")
		})

		it("should return null when snapshot file does not exist", async () => {
			const commitHash = "nonexistent"
			const snapshotPath = path.join(mockCheckpointsDir, "api_snapshots", `${commitHash}.json`)
			vi.mocked(fileExistsAtPath).mockResolvedValue(false)

			const result = await service.restoreApiHistorySnapshot(commitHash)

			expect(result).toBeNull()
			expect(fileExistsAtPath).toHaveBeenCalledWith(snapshotPath)
			expect(fs.readFile).not.toHaveBeenCalled()
		})

		it("should handle invalid JSON gracefully", async () => {
			const commitHash = "invalid"
			const snapshotPath = path.join(mockCheckpointsDir, "api_snapshots", `${commitHash}.json`)
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue("{ invalid json")

			const result = await service.restoreApiHistorySnapshot(commitHash)

			expect(result).toBeNull()
			expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("Failed to restore snapshot"))
		})

		it("should handle file read errors gracefully", async () => {
			const commitHash = "error"
			const snapshotPath = path.join(mockCheckpointsDir, "api_snapshots", `${commitHash}.json`)
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockRejectedValue(new Error("File read error"))

			const result = await service.restoreApiHistorySnapshot(commitHash)

			expect(result).toBeNull()
			expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("Failed to restore snapshot"))
		})

		it("should restore API history with preserved context compression state", async () => {
			const commitHash = "with-compression"
			const expectedHistory: ApiMessage[] = [
				{
					role: "user",
					content: "Original message 1",
					ts: 1000,
				},
				{
					role: "assistant",
					content: "Original response 1",
					ts: 2000,
				},
				{
					role: "user",
					content: "Original message 2",
					ts: 3000,
				},
				{
					role: "assistant",
					content: "Original response 2",
					ts: 4000,
				},
				// No compression markers - full history preserved
			]

			const snapshotPath = path.join(mockCheckpointsDir, "api_snapshots", `${commitHash}.json`)
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(expectedHistory))

			const result = await service.restoreApiHistorySnapshot(commitHash)

			expect(result).toEqual(expectedHistory)
			expect(result).toHaveLength(4)
			expect(result?.every((msg) => !msg.isSummary)).toBe(true)
		})
	})
})
