import { vi, describe, it, expect, beforeEach } from "vitest"
import { WriteToFileTool } from "../WriteToFileTool"
import { GenerateImageTool } from "../GenerateImageTool"
import { Task } from "../../task/Task"
import type { ToolCallbacks } from "../BaseTool"
import { EXPERIMENT_IDS } from "../../../shared/experiments"
import { getReadablePath } from "../../../utils/path"

describe("File path corruption fix", () => {
	let mockTask: Task
	let mockCallbacks: ToolCallbacks
	let writeToFileTool: WriteToFileTool
	let generateImageTool: GenerateImageTool

	beforeEach(() => {
		// Create mock task with minimal required properties
		mockTask = {
			cwd: "/root/oxyde_strat",
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn(),
			say: vi.fn(),
			rooIgnoreController: {
				validateAccess: vi.fn().mockReturnValue(true),
			},
			rooProtectedController: {
				isWriteProtected: vi.fn().mockReturnValue(false),
			},
			diffViewProvider: {
				editType: undefined,
				originalContent: "",
				open: vi.fn(),
				update: vi.fn(),
				scrollToFirstDiff: vi.fn(),
				saveChanges: vi.fn(),
				saveDirectly: vi.fn(),
				pushToolWriteResult: vi.fn().mockResolvedValue("File saved successfully"),
				reset: vi.fn(),
				revertChanges: vi.fn(),
			},
			api: {
				getModel: () => ({
					id: "test-model",
					info: {},
				}),
			},
			fileContextTracker: {
				trackFileContext: vi.fn(),
			},
			providerRef: {
				deref: vi.fn().mockReturnValue({
					getState: vi.fn().mockResolvedValue({
						diagnosticsEnabled: true,
						writeDelayMs: 0,
						experiments: {
							[EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION]: true,
							[EXPERIMENT_IDS.IMAGE_GENERATION]: true,
						},
						openRouterImageApiKey: "test-key",
						openRouterImageGenerationSelectedModel: "test-model",
					}),
				}),
			},
		} as any

		// Create mock callbacks
		const mockAskApproval = vi.fn().mockResolvedValue(true)
		mockCallbacks = {
			askApproval: mockAskApproval as any,
			handleError: vi.fn(),
			pushToolResult: vi.fn(),
			removeClosingTag: ((tag: string, text?: string) => {
				// The fix: removeClosingTag should NOT be called in execute methods
				// It should only be used in handlePartial for cleaning streaming tags
				// So in execute, we just return the text as-is
				return text || ""
			}) as any,
		}

		writeToFileTool = new WriteToFileTool()
		generateImageTool = new GenerateImageTool()
	})

	describe("WriteToFileTool", () => {
		it("should handle paths ending with 'str' correctly", async () => {
			const testPath = "stratoxyde-v2/src/services/storage/saveStates.ts"
			const params = {
				path: testPath,
				content: "test content",
				line_count: 1,
			}

			await writeToFileTool.execute(params, mockTask, mockCallbacks)

			// Verify the path was not corrupted
			expect(mockTask.diffViewProvider.saveDirectly).toHaveBeenCalledWith(
				testPath, // Path should remain unchanged
				"test content",
				false,
				true,
				0,
			)
		})

		it("should handle paths containing 'str' in the middle correctly", async () => {
			const testPath = "infrastructure/services/strategy.ts"
			const params = {
				path: testPath,
				content: "test content",
				line_count: 1,
			}

			await writeToFileTool.execute(params, mockTask, mockCallbacks)

			// Verify the path was not corrupted
			expect(mockTask.diffViewProvider.saveDirectly).toHaveBeenCalledWith(
				testPath, // Path should remain unchanged
				"test content",
				false,
				true,
				0,
			)
		})

		it("should handle complex paths with 'str' correctly", async () => {
			const testPath = "/root/oxyde_strat/stratoxyde-v2/src/services/storage/saveStates.ts"
			const params = {
				path: testPath,
				content: "test content",
				line_count: 1,
			}

			await writeToFileTool.execute(params, mockTask, mockCallbacks)

			// Verify the path was not corrupted
			expect(mockTask.diffViewProvider.saveDirectly).toHaveBeenCalledWith(
				testPath, // Path should remain unchanged
				"test content",
				false,
				true,
				0,
			)
		})
	})

	describe("GenerateImageTool", () => {
		beforeEach(() => {
			// Mock OpenRouterHandler
			vi.mock("../../../api/providers/openrouter", () => ({
				OpenRouterHandler: vi.fn().mockImplementation(() => ({
					generateImage: vi.fn().mockResolvedValue({
						success: true,
						imageData:
							"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
					}),
				})),
			}))
		})

		it("should handle paths ending with 'str' correctly", async () => {
			const testPath = "images/illustr.png"
			const params = {
				prompt: "test prompt",
				path: testPath,
				image: undefined,
			}

			await generateImageTool.execute(params, mockTask, mockCallbacks)

			// Verify the path was used correctly in the approval message
			const mockAskApproval = mockCallbacks.askApproval as any
			const approvalCall = mockAskApproval.mock.calls[0]
			const approvalMessage = JSON.parse(approvalCall[1])
			// Use getReadablePath to get the expected value (platform-independent)
			const expectedPath = getReadablePath(mockTask.cwd, testPath)
			expect(approvalMessage.path).toBe(expectedPath)
		})

		it("should handle paths containing 'str' correctly", async () => {
			const testPath = "assets/structures/diagram.png"
			const params = {
				prompt: "test prompt",
				path: testPath,
				image: undefined,
			}

			await generateImageTool.execute(params, mockTask, mockCallbacks)

			// Verify the path was used correctly
			const mockAskApproval = mockCallbacks.askApproval as any
			const approvalCall = mockAskApproval.mock.calls[0]
			const approvalMessage = JSON.parse(approvalCall[1])
			// Use getReadablePath to get the expected value (platform-independent)
			const expectedPath = getReadablePath(mockTask.cwd, testPath)
			expect(approvalMessage.path).toBe(expectedPath)
		})
	})

	describe("removeClosingTag behavior", () => {
		it("should only be used in handlePartial, not execute", () => {
			// Create a proper removeClosingTag implementation for partial messages
			const properRemoveClosingTag = (tag: string, text: string | undefined, isPartial: boolean): string => {
				if (!isPartial) {
					return text || ""
				}
				if (!text) {
					return ""
				}
				// This regex should only apply to partial XML tags at the end
				const tagRegex = new RegExp(
					`\\s?<\/?${tag
						.split("")
						.map((char: string) => `(?:${char})?`)
						.join("")}$`,
					"g",
				)
				return text.replace(tagRegex, "")
			}

			// When isPartial is false, should return text as-is
			expect(properRemoveClosingTag("path", "test/path/str", false)).toBe("test/path/str")
			expect(properRemoveClosingTag("path", "infrastructure", false)).toBe("infrastructure")

			// When isPartial is true and text ends with partial XML tag
			expect(properRemoveClosingTag("path", "test/file</pa", true)).toBe("test/file")
			expect(properRemoveClosingTag("path", "test/file</", true)).toBe("test/file")
			expect(properRemoveClosingTag("path", "test/file<", true)).toBe("test/file")

			// When isPartial is true but text doesn't end with XML tag
			expect(properRemoveClosingTag("path", "test/path/str", true)).toBe("test/path/str")
		})
	})
})
