// Tests for simplified FileChangeManager - Pure diff calculation service
// npx vitest run src/services/file-changes/__tests__/FileChangeManager.test.ts

import { describe, beforeEach, afterEach, it, expect, vi } from "vitest"
import { FileChangeManager } from "../FileChangeManager"
import { FileChange, FileChangeType } from "@roo-code/types"
import type { FileContextTracker } from "../../../core/context-tracking/FileContextTracker"
import type { TaskMetadata } from "../../../core/context-tracking/FileContextTrackerTypes"

describe("FileChangeManager (Simplified)", () => {
	let fileChangeManager: FileChangeManager

	beforeEach(() => {
		fileChangeManager = new FileChangeManager("initial-checkpoint")
	})

	afterEach(() => {
		fileChangeManager.dispose()
	})

	describe("Constructor", () => {
		it("should create manager with baseline checkpoint", () => {
			const manager = new FileChangeManager("test-checkpoint")
			const changes = manager.getChanges()

			expect(changes.baseCheckpoint).toBe("test-checkpoint")
			expect(changes.files).toEqual([])
		})
	})

	describe("getChanges", () => {
		it("should return empty changeset initially", () => {
			const changes = fileChangeManager.getChanges()

			expect(changes.baseCheckpoint).toBe("initial-checkpoint")
			expect(changes.files).toEqual([])
		})

		it("should filter out rejected files", () => {
			// Setup some files
			const testFiles: FileChange[] = [
				{
					uri: "file1.txt",
					type: "edit",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 5,
					linesRemoved: 2,
				},
				{
					uri: "file2.txt",
					type: "create",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 10,
					linesRemoved: 0,
				},
			]

			fileChangeManager.setFiles(testFiles)

			// Reject one file
			fileChangeManager.rejectChange("file1.txt")

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(1)
			expect(changes.files[0].uri).toBe("file2.txt")
		})

		it("should filter out rejected files", () => {
			const testFiles: FileChange[] = [
				{
					uri: "file1.txt",
					type: "edit",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 5,
					linesRemoved: 2,
				},
				{
					uri: "file2.txt",
					type: "create",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 10,
					linesRemoved: 0,
				},
			]

			fileChangeManager.setFiles(testFiles)

			// Reject one file
			fileChangeManager.rejectChange("file1.txt")

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(1)
			expect(changes.files[0].uri).toBe("file2.txt")
		})
	})

	describe("getFileChange", () => {
		it("should return specific file change", () => {
			const testFile: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "initial-checkpoint",
				toCheckpoint: "current",
				linesAdded: 3,
				linesRemoved: 1,
			}

			fileChangeManager.setFiles([testFile])

			const result = fileChangeManager.getFileChange("test.txt")
			expect(result).toEqual(testFile)
		})

		it("should return undefined for non-existent file", () => {
			const result = fileChangeManager.getFileChange("non-existent.txt")
			expect(result).toBeUndefined()
		})
	})

	describe("acceptChange", () => {
		it("should mark file as accepted and store checkpoint", async () => {
			const testFile: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "initial-checkpoint",
				toCheckpoint: "current",
				linesAdded: 3,
				linesRemoved: 1,
			}

			fileChangeManager.setFiles([testFile])

			await fileChangeManager.acceptChange("test.txt")

			// Accepted files are not filtered out by getChanges anymore
			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(1)

			// Check that the accepted baseline was stored correctly
			const acceptedBaseline = fileChangeManager["acceptedBaselines"].get("test.txt")
			expect(acceptedBaseline).toBe("current")
		})

		it("should remove from rejected if previously rejected", async () => {
			const testFile: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "initial-checkpoint",
				toCheckpoint: "current",
				linesAdded: 3,
				linesRemoved: 1,
			}

			fileChangeManager.setFiles([testFile])

			// First reject, then accept
			await fileChangeManager.rejectChange("test.txt")
			// File should be hidden when rejected
			let rejectedChanges = fileChangeManager.getChanges()
			expect(rejectedChanges.files).toHaveLength(0)

			await fileChangeManager.acceptChange("test.txt")

			// File should reappear when accepted (no longer filtered as rejected)
			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(1)

			// Should have correct accepted baseline
			const acceptedBaseline = fileChangeManager["acceptedBaselines"].get("test.txt")
			expect(acceptedBaseline).toBe("current")
		})
	})

	describe("rejectChange", () => {
		it("should mark file as rejected", async () => {
			const testFile: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "initial-checkpoint",
				toCheckpoint: "current",
				linesAdded: 3,
				linesRemoved: 1,
			}

			fileChangeManager.setFiles([testFile])

			await fileChangeManager.rejectChange("test.txt")

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(0) // File filtered out
		})
	})

	describe("acceptAll", () => {
		it("should accept all files", async () => {
			const testFiles: FileChange[] = [
				{
					uri: "file1.txt",
					type: "edit",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 5,
					linesRemoved: 2,
				},
				{
					uri: "file2.txt",
					type: "create",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 10,
					linesRemoved: 0,
				},
			]

			fileChangeManager.setFiles(testFiles)

			await fileChangeManager.acceptAll()

			// Accepted files are not filtered out by getChanges anymore
			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(2) // All files still present

			// Check that both files have their baselines stored correctly
			const baseline1 = fileChangeManager["acceptedBaselines"].get("file1.txt")
			const baseline2 = fileChangeManager["acceptedBaselines"].get("file2.txt")
			expect(baseline1).toBe("current")
			expect(baseline2).toBe("current")
		})
	})

	describe("rejectAll", () => {
		it("should reject all files", async () => {
			const testFiles: FileChange[] = [
				{
					uri: "file1.txt",
					type: "edit",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 5,
					linesRemoved: 2,
				},
				{
					uri: "file2.txt",
					type: "create",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 10,
					linesRemoved: 0,
				},
			]

			fileChangeManager.setFiles(testFiles)

			await fileChangeManager.rejectAll()

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(0) // All files filtered out
		})
	})

	describe("updateBaseline", () => {
		it("should update baseline checkpoint", async () => {
			await fileChangeManager.updateBaseline("new-baseline")

			const changes = fileChangeManager.getChanges()
			expect(changes.baseCheckpoint).toBe("new-baseline")
		})

		it("should clear files and reset state on baseline update", async () => {
			const testFile: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "initial-checkpoint",
				toCheckpoint: "current",
				linesAdded: 3,
				linesRemoved: 1,
			}

			fileChangeManager.setFiles([testFile])
			await fileChangeManager.acceptChange("test.txt")

			// Update baseline should clear everything
			await fileChangeManager.updateBaseline("new-baseline")

			// Add the same file again
			fileChangeManager.setFiles([testFile])

			// File should appear again (accepted state cleared)
			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(1)
		})
	})

	describe("setFiles", () => {
		it("should set the files in changeset", () => {
			const testFiles: FileChange[] = [
				{
					uri: "file1.txt",
					type: "edit",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 5,
					linesRemoved: 2,
				},
			]

			fileChangeManager.setFiles(testFiles)

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toEqual(testFiles)
		})
	})

	describe("calculateLineDifferences", () => {
		it("should calculate lines added", () => {
			const original = "line1\nline2"
			const modified = "line1\nline2\nline3\nline4"

			const result = FileChangeManager.calculateLineDifferences(original, modified)

			expect(result.linesAdded).toBe(2)
			expect(result.linesRemoved).toBe(0)
		})

		it("should calculate lines removed", () => {
			const original = "line1\nline2\nline3\nline4"
			const modified = "line1\nline2"

			const result = FileChangeManager.calculateLineDifferences(original, modified)

			expect(result.linesAdded).toBe(0)
			expect(result.linesRemoved).toBe(2)
		})

		it("should handle equal length changes", () => {
			const original = "line1\nline2"
			const modified = "line1\nline2"

			const result = FileChangeManager.calculateLineDifferences(original, modified)

			expect(result.linesAdded).toBe(0)
			expect(result.linesRemoved).toBe(0)
		})

		it("should handle line modifications (search and replace)", () => {
			const original = "function test() {\n  return 'old';\n}"
			const modified = "function test() {\n  return 'new';\n}"

			const result = FileChangeManager.calculateLineDifferences(original, modified)

			expect(result.linesAdded).toBe(1) // Modified line counts as added
			expect(result.linesRemoved).toBe(1) // Modified line counts as removed
		})

		it("should handle mixed changes", () => {
			const original = "line1\nold_line\nline3"
			const modified = "line1\nnew_line\nline3\nextra_line"

			const result = FileChangeManager.calculateLineDifferences(original, modified)

			expect(result.linesAdded).toBe(2) // 1 modified + 1 added
			expect(result.linesRemoved).toBe(1) // 1 modified
		})

		it("should handle empty original file", () => {
			const original = ""
			const modified = "line1\nline2\nline3"

			const result = FileChangeManager.calculateLineDifferences(original, modified)

			expect(result.linesAdded).toBe(3)
			expect(result.linesRemoved).toBe(0)
		})

		it("should handle empty modified file", () => {
			const original = "line1\nline2\nline3"
			const modified = ""

			const result = FileChangeManager.calculateLineDifferences(original, modified)

			expect(result.linesAdded).toBe(0)
			expect(result.linesRemoved).toBe(3)
		})

		it("should handle both files empty", () => {
			const original = ""
			const modified = ""

			const result = FileChangeManager.calculateLineDifferences(original, modified)

			expect(result.linesAdded).toBe(0)
			expect(result.linesRemoved).toBe(0)
		})

		it("should handle single line files", () => {
			const original = "single line"
			const modified = "different line"

			const result = FileChangeManager.calculateLineDifferences(original, modified)

			expect(result.linesAdded).toBe(1)
			expect(result.linesRemoved).toBe(1)
		})

		it("should handle whitespace-only changes", () => {
			const original = "line1\n  indented\nline3"
			const modified = "line1\n    indented\nline3"

			const result = FileChangeManager.calculateLineDifferences(original, modified)

			expect(result.linesAdded).toBe(1) // Whitespace change counts as modification
			expect(result.linesRemoved).toBe(1)
		})
	})

	describe("getLLMOnlyChanges", () => {
		it("should filter files to only show LLM-modified files", async () => {
			// Mock FileContextTracker
			const mockFileContextTracker = {
				getTaskMetadata: vi.fn().mockResolvedValue({
					files_in_context: [
						{ path: "file1.txt", record_source: "roo_edited" },
						{ path: "file2.txt", record_source: "user_edited" },
						{ path: "file3.txt", record_source: "roo_edited" },
					],
				} as TaskMetadata),
			} as unknown as FileContextTracker

			const testFiles: FileChange[] = [
				{
					uri: "file1.txt",
					type: "edit",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 5,
					linesRemoved: 2,
				},
				{
					uri: "file2.txt", // This should be filtered out (user_edited)
					type: "edit",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 3,
					linesRemoved: 1,
				},
				{
					uri: "file3.txt",
					type: "create",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 10,
					linesRemoved: 0,
				},
			]

			fileChangeManager.setFiles(testFiles)

			const llmOnlyChanges = await fileChangeManager.getLLMOnlyChanges("test-task-id", mockFileContextTracker)

			expect(llmOnlyChanges.files).toHaveLength(2)
			expect(llmOnlyChanges.files.map((f) => f.uri)).toEqual(["file1.txt", "file3.txt"])
		})

		it("should filter out accepted and rejected files from LLM-only changes", async () => {
			const mockFileContextTracker = {
				getTaskMetadata: vi.fn().mockResolvedValue({
					files_in_context: [
						{ path: "file1.txt", record_source: "roo_edited" },
						{ path: "file2.txt", record_source: "roo_edited" },
						{ path: "file3.txt", record_source: "roo_edited" },
					],
				} as TaskMetadata),
			} as unknown as FileContextTracker

			const testFiles: FileChange[] = [
				{
					uri: "file1.txt",
					type: "edit",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 5,
					linesRemoved: 2,
				},
				{
					uri: "file2.txt",
					type: "edit",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 3,
					linesRemoved: 1,
				},
				{
					uri: "file3.txt",
					type: "create",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 10,
					linesRemoved: 0,
				},
			]

			fileChangeManager.setFiles(testFiles)

			// Accept one file, reject another
			await fileChangeManager.acceptChange("file1.txt")
			await fileChangeManager.rejectChange("file2.txt")

			const llmOnlyChanges = await fileChangeManager.getLLMOnlyChanges("test-task-id", mockFileContextTracker)

			expect(llmOnlyChanges.files).toHaveLength(1)
			expect(llmOnlyChanges.files[0].uri).toBe("file3.txt")
		})

		it("should return empty changeset when no LLM-modified files exist", async () => {
			const mockFileContextTracker = {
				getTaskMetadata: vi.fn().mockResolvedValue({
					files_in_context: [
						{ path: "file1.txt", record_source: "user_edited" },
						{ path: "file2.txt", record_source: "read_tool" },
					],
				} as TaskMetadata),
			} as unknown as FileContextTracker

			const testFiles: FileChange[] = [
				{
					uri: "file1.txt",
					type: "edit",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 5,
					linesRemoved: 2,
				},
				{
					uri: "file2.txt",
					type: "edit",
					fromCheckpoint: "initial-checkpoint",
					toCheckpoint: "current",
					linesAdded: 3,
					linesRemoved: 1,
				},
			]

			fileChangeManager.setFiles(testFiles)

			const llmOnlyChanges = await fileChangeManager.getLLMOnlyChanges("test-task-id", mockFileContextTracker)

			expect(llmOnlyChanges.files).toHaveLength(0)
		})
	})

	describe("Per-File Baseline Behavior", () => {
		let mockCheckpointService: any

		beforeEach(() => {
			mockCheckpointService = {
				getDiff: vi.fn(),
			}
		})

		describe("applyPerFileBaselines", () => {
			it("should show only incremental changes for accepted files", async () => {
				const initialChange: FileChange = {
					uri: "test.txt",
					type: "edit",
					fromCheckpoint: "baseline",
					toCheckpoint: "checkpoint1",
					linesAdded: 5,
					linesRemoved: 2,
				}

				// Set initial file and accept it
				fileChangeManager.setFiles([initialChange])
				await fileChangeManager.acceptChange("test.txt")

				// Mock incremental diff from acceptance point to new checkpoint
				mockCheckpointService.getDiff.mockResolvedValue([
					{
						paths: { relative: "test.txt", newFile: false, deletedFile: false },
						content: { before: "line1\nline2", after: "line1\nline2\nline3" },
					},
				])

				const baseChanges: FileChange[] = [
					{
						uri: "test.txt",
						type: "edit",
						fromCheckpoint: "baseline", // This would be cumulative
						toCheckpoint: "checkpoint2",
						linesAdded: 10, // Cumulative
						linesRemoved: 3, // Cumulative
					},
				]

				const result = await fileChangeManager.applyPerFileBaselines(
					baseChanges,
					mockCheckpointService,
					"checkpoint2",
				)

				expect(result).toHaveLength(1)
				expect(result[0]).toEqual({
					uri: "test.txt",
					type: "edit",
					fromCheckpoint: "checkpoint1", // Per-file baseline
					toCheckpoint: "checkpoint2",
					linesAdded: 1, // Only incremental changes
					linesRemoved: 0,
				})

				expect(mockCheckpointService.getDiff).toHaveBeenCalledWith({
					from: "checkpoint1",
					to: "checkpoint2",
				})
			})

			it("should not show accepted files that haven't changed", async () => {
				const initialChange: FileChange = {
					uri: "test.txt",
					type: "edit",
					fromCheckpoint: "baseline",
					toCheckpoint: "checkpoint1",
					linesAdded: 5,
					linesRemoved: 2,
				}

				// Set initial file and accept it
				fileChangeManager.setFiles([initialChange])
				await fileChangeManager.acceptChange("test.txt")

				// Mock no incremental changes
				mockCheckpointService.getDiff.mockResolvedValue([])

				const baseChanges: FileChange[] = [
					{
						uri: "test.txt",
						type: "edit",
						fromCheckpoint: "baseline",
						toCheckpoint: "checkpoint2",
						linesAdded: 5, // Same as before - no new changes
						linesRemoved: 2,
					},
				]

				const result = await fileChangeManager.applyPerFileBaselines(
					baseChanges,
					mockCheckpointService,
					"checkpoint2",
				)

				// File with no incremental changes shouldn't appear
				expect(result).toHaveLength(0)
			})

			it("should use original changes for never-accepted files", async () => {
				const baseChanges: FileChange[] = [
					{
						uri: "new-file.txt",
						type: "create",
						fromCheckpoint: "baseline",
						toCheckpoint: "checkpoint1",
						linesAdded: 10,
						linesRemoved: 0,
					},
				]

				const result = await fileChangeManager.applyPerFileBaselines(
					baseChanges,
					mockCheckpointService,
					"checkpoint1",
				)

				// Never-accepted file should use original change
				expect(result).toHaveLength(1)
				expect(result[0]).toEqual(baseChanges[0])

				// Should not call getDiff for never-accepted files
				expect(mockCheckpointService.getDiff).not.toHaveBeenCalled()
			})

			it("should handle mixed scenario with accepted and new files", async () => {
				// Set up an accepted file
				const acceptedFile: FileChange = {
					uri: "accepted.txt",
					type: "edit",
					fromCheckpoint: "baseline",
					toCheckpoint: "checkpoint1",
					linesAdded: 3,
					linesRemoved: 1,
				}
				fileChangeManager.setFiles([acceptedFile])
				await fileChangeManager.acceptChange("accepted.txt")

				// Mock incremental changes for accepted file
				mockCheckpointService.getDiff.mockResolvedValue([
					{
						paths: { relative: "accepted.txt", newFile: false, deletedFile: false },
						content: { before: "old content", after: "old content\nnew line" },
					},
				])

				const baseChanges: FileChange[] = [
					{
						uri: "accepted.txt",
						type: "edit",
						fromCheckpoint: "baseline",
						toCheckpoint: "checkpoint2",
						linesAdded: 5, // Cumulative
						linesRemoved: 2,
					},
					{
						uri: "new-file.txt",
						type: "create",
						fromCheckpoint: "baseline",
						toCheckpoint: "checkpoint2",
						linesAdded: 10,
						linesRemoved: 0,
					},
				]

				const result = await fileChangeManager.applyPerFileBaselines(
					baseChanges,
					mockCheckpointService,
					"checkpoint2",
				)

				expect(result).toHaveLength(2)

				// Accepted file should show incremental changes
				const acceptedFileResult = result.find((f) => f.uri === "accepted.txt")
				expect(acceptedFileResult).toEqual({
					uri: "accepted.txt",
					type: "edit",
					fromCheckpoint: "checkpoint1", // Per-file baseline
					toCheckpoint: "checkpoint2",
					linesAdded: 1, // Only incremental
					linesRemoved: 0,
				})

				// New file should use original change
				const newFileResult = result.find((f) => f.uri === "new-file.txt")
				expect(newFileResult).toEqual(baseChanges[1])
			})

			it("should fall back to original change if incremental diff fails", async () => {
				const initialChange: FileChange = {
					uri: "test.txt",
					type: "edit",
					fromCheckpoint: "baseline",
					toCheckpoint: "checkpoint1",
					linesAdded: 5,
					linesRemoved: 2,
				}

				fileChangeManager.setFiles([initialChange])
				await fileChangeManager.acceptChange("test.txt")

				// Mock getDiff to throw an error
				mockCheckpointService.getDiff.mockRejectedValue(new Error("Checkpoint not found"))

				const baseChanges: FileChange[] = [
					{
						uri: "test.txt",
						type: "edit",
						fromCheckpoint: "baseline",
						toCheckpoint: "checkpoint2",
						linesAdded: 8,
						linesRemoved: 3,
					},
				]

				const result = await fileChangeManager.applyPerFileBaselines(
					baseChanges,
					mockCheckpointService,
					"checkpoint2",
				)

				// Should fall back to original change
				expect(result).toHaveLength(1)
				expect(result[0]).toEqual(baseChanges[0])
			})

			it("should handle multiple accept cycles on same file", async () => {
				// First change and acceptance
				const firstChange: FileChange = {
					uri: "test.txt",
					type: "edit",
					fromCheckpoint: "baseline",
					toCheckpoint: "checkpoint1",
					linesAdded: 3,
					linesRemoved: 1,
				}
				fileChangeManager.setFiles([firstChange])
				await fileChangeManager.acceptChange("test.txt")

				// Second change and acceptance
				const secondChange: FileChange = {
					uri: "test.txt",
					type: "edit",
					fromCheckpoint: "checkpoint1",
					toCheckpoint: "checkpoint2",
					linesAdded: 2,
					linesRemoved: 0,
				}
				fileChangeManager.setFiles([secondChange])
				await fileChangeManager.acceptChange("test.txt")

				// Third change - should calculate from checkpoint2
				mockCheckpointService.getDiff.mockResolvedValue([
					{
						paths: { relative: "test.txt", newFile: false, deletedFile: false },
						content: { before: "content v2", after: "content v3" },
					},
				])

				const baseChanges: FileChange[] = [
					{
						uri: "test.txt",
						type: "edit",
						fromCheckpoint: "baseline", // Cumulative from original baseline
						toCheckpoint: "checkpoint3",
						linesAdded: 10, // Cumulative
						linesRemoved: 4,
					},
				]

				const result = await fileChangeManager.applyPerFileBaselines(
					baseChanges,
					mockCheckpointService,
					"checkpoint3",
				)

				expect(result).toHaveLength(1)
				expect(result[0]).toEqual({
					uri: "test.txt",
					type: "edit",
					fromCheckpoint: "checkpoint2", // Latest acceptance point
					toCheckpoint: "checkpoint3",
					linesAdded: 1, // Only changes since last acceptance
					linesRemoved: 1,
				})

				expect(mockCheckpointService.getDiff).toHaveBeenCalledWith({
					from: "checkpoint2",
					to: "checkpoint3",
				})
			})
		})
	})

	describe("Rejected Files Behavior", () => {
		let mockCheckpointService: any

		beforeEach(() => {
			mockCheckpointService = {
				getDiff: vi.fn(),
			}
		})

		it("should show rejected file again when edited after rejection", async () => {
			const initialChange: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "baseline",
				toCheckpoint: "checkpoint1",
				linesAdded: 5,
				linesRemoved: 2,
			}

			// Set initial file and reject it
			fileChangeManager.setFiles([initialChange])
			await fileChangeManager.rejectChange("test.txt")

			// File should be hidden after rejection
			let changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(0)

			// File is edited again with new changes
			const newChange: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "baseline",
				toCheckpoint: "checkpoint2", // Different checkpoint = file changed
				linesAdded: 8,
				linesRemoved: 3,
			}

			const result = await fileChangeManager.applyPerFileBaselines(
				[newChange],
				mockCheckpointService,
				"checkpoint2",
			)

			// Should reappear with cumulative changes from global baseline
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "baseline", // Global baseline
				toCheckpoint: "checkpoint2",
				linesAdded: 8,
				linesRemoved: 3,
			})
		})

		it("should preserve accepted baseline through rejection", async () => {
			// First accept a file
			const acceptedChange: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "baseline",
				toCheckpoint: "checkpoint1",
				linesAdded: 3,
				linesRemoved: 1,
			}
			fileChangeManager.setFiles([acceptedChange])
			await fileChangeManager.acceptChange("test.txt")

			// Then reject the same file (simulating new changes that user rejects)
			const rejectedChange: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "checkpoint1",
				toCheckpoint: "checkpoint2",
				linesAdded: 2,
				linesRemoved: 0,
			}
			fileChangeManager.setFiles([rejectedChange])
			await fileChangeManager.rejectChange("test.txt")

			// File should be hidden after rejection
			let changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(0)

			// File is edited again after rejection
			mockCheckpointService.getDiff.mockResolvedValue([
				{
					paths: { relative: "test.txt", newFile: false, deletedFile: false },
					content: { before: "accepted content", after: "accepted content\nnew line" },
				},
			])

			const newChange: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "baseline",
				toCheckpoint: "checkpoint3",
				linesAdded: 10, // Cumulative from baseline
				linesRemoved: 4,
			}

			const result = await fileChangeManager.applyPerFileBaselines(
				[newChange],
				mockCheckpointService,
				"checkpoint3",
			)

			// Should show incremental changes from accepted baseline, not global baseline
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "checkpoint1", // Preserved accepted baseline
				toCheckpoint: "checkpoint3",
				linesAdded: 1, // Only incremental since acceptance
				linesRemoved: 0,
			})

			expect(mockCheckpointService.getDiff).toHaveBeenCalledWith({
				from: "checkpoint1", // Uses accepted baseline
				to: "checkpoint3",
			})
		})

		it("should keep rejected file hidden if no changes since rejection", async () => {
			const initialChange: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "baseline",
				toCheckpoint: "checkpoint1",
				linesAdded: 5,
				linesRemoved: 2,
			}

			fileChangeManager.setFiles([initialChange])
			await fileChangeManager.rejectChange("test.txt")

			// Same change (no new edits since rejection)
			const sameChange: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "baseline",
				toCheckpoint: "checkpoint1", // Same checkpoint = no changes
				linesAdded: 5,
				linesRemoved: 2,
			}

			const result = await fileChangeManager.applyPerFileBaselines(
				[sameChange],
				mockCheckpointService,
				"checkpoint1",
			)

			// Should remain hidden (not in results)
			expect(result).toHaveLength(0)
		})

		it("should handle rejectAll properly", async () => {
			const testFiles: FileChange[] = [
				{
					uri: "file1.txt",
					type: "edit",
					fromCheckpoint: "baseline",
					toCheckpoint: "checkpoint1",
					linesAdded: 3,
					linesRemoved: 1,
				},
				{
					uri: "file2.txt",
					type: "create",
					fromCheckpoint: "baseline",
					toCheckpoint: "checkpoint1",
					linesAdded: 10,
					linesRemoved: 0,
				},
			]

			fileChangeManager.setFiles(testFiles)
			await fileChangeManager.rejectAll()

			// All files should be hidden
			let changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(0)

			// Edit one file
			const newChanges: FileChange[] = [
				{
					uri: "file1.txt",
					type: "edit",
					fromCheckpoint: "baseline",
					toCheckpoint: "checkpoint2", // Changed
					linesAdded: 5,
					linesRemoved: 2,
				},
				{
					uri: "file2.txt",
					type: "create",
					fromCheckpoint: "baseline",
					toCheckpoint: "checkpoint1", // Same - no changes
					linesAdded: 10,
					linesRemoved: 0,
				},
			]

			const result = await fileChangeManager.applyPerFileBaselines(
				newChanges,
				mockCheckpointService,
				"checkpoint2",
			)

			// Only the changed file should reappear
			expect(result).toHaveLength(1)
			expect(result[0].uri).toBe("file1.txt")
		})

		it("should handle accept then reject then accept again", async () => {
			// First acceptance
			const firstChange: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "baseline",
				toCheckpoint: "checkpoint1",
				linesAdded: 3,
				linesRemoved: 1,
			}
			fileChangeManager.setFiles([firstChange])
			await fileChangeManager.acceptChange("test.txt")

			// Rejection (but baseline should be preserved)
			const rejectedChange: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "checkpoint1",
				toCheckpoint: "checkpoint2",
				linesAdded: 2,
				linesRemoved: 0,
			}
			fileChangeManager.setFiles([rejectedChange])
			await fileChangeManager.rejectChange("test.txt")

			// Accept again after new edits
			const newChange: FileChange = {
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "checkpoint1", // Should still use original accepted baseline
				toCheckpoint: "checkpoint3",
				linesAdded: 4,
				linesRemoved: 1,
			}
			fileChangeManager.setFiles([newChange])
			await fileChangeManager.acceptChange("test.txt")

			// The accepted baseline should be updated
			const acceptedBaseline = fileChangeManager["acceptedBaselines"].get("test.txt")
			expect(acceptedBaseline).toBe("checkpoint3")
		})
	})
})
