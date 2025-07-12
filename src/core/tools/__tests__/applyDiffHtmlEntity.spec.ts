import { describe, it, expect, vi, beforeEach } from "vitest"
import { applyDiffToolLegacy } from "../applyDiffTool"
import fs from "fs/promises"

// Mock dependencies
vi.mock("fs/promises")
vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(true),
}))

vi.mock("../../../utils/path", () => ({
	getReadablePath: vi.fn((cwd, relPath) => relPath),
}))

describe("HTML Entity Handling in apply_diff Tools", () => {
	let mockCline: any
	let mockBlock: any
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any
	let mockRemoveClosingTag: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock file system
		const mockReadFile = vi.mocked(fs.readFile)
		mockReadFile.mockResolvedValue("// Comment with &amp; entity\nconst value = 'test';")

		mockCline = {
			cwd: "/test",
			api: {
				getModel: vi.fn().mockReturnValue({ id: "gpt-4" }), // Non-Claude model
			},
			diffStrategy: {
				applyDiff: vi.fn().mockResolvedValue({
					success: true,
					content: "// Comment with &amp; entity\nconst value = 'updated';",
				}),
				getProgressStatus: vi.fn(),
			},
			diffViewProvider: {
				editType: "",
				open: vi.fn(),
				update: vi.fn(),
				scrollToFirstDiff: vi.fn(),
				saveChanges: vi.fn(),
				pushToolWriteResult: vi.fn().mockResolvedValue("File updated successfully"),
				reset: vi.fn(),
				revertChanges: vi.fn(),
			},
			fileContextTracker: {
				trackFileContext: vi.fn(),
			},
			rooIgnoreController: {
				validateAccess: vi.fn().mockReturnValue(true),
			},
			rooProtectedController: {
				isWriteProtected: vi.fn().mockReturnValue(false),
			},
			consecutiveMistakeCount: 0,
			consecutiveMistakeCountForApplyDiff: new Map(),
			didEditFile: false,
			ask: vi.fn(),
			say: vi.fn(),
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn(),
		}

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag, value) => value)
	})

	describe("Legacy apply_diff tool", () => {
		it("should not unescape HTML entities in diff content for non-Claude models", async () => {
			const diffContent = `<<<<<<< SEARCH
:start_line:1
-------
// Comment with &amp; entity
=======
// Comment with &amp; entity updated
>>>>>>> REPLACE`

			mockBlock = {
				params: {
					path: "test.js",
					diff: diffContent,
				},
				partial: false,
			}

			await applyDiffToolLegacy(
				mockCline,
				mockBlock,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify that diffStrategy.applyDiff was called with the original diff content (not unescaped)
			expect(mockCline.diffStrategy.applyDiff).toHaveBeenCalledWith(
				"// Comment with &amp; entity\nconst value = 'test';",
				diffContent,
				NaN, // parseInt of undefined start_line
			)
		})

		it("should handle files containing various HTML entities without unescaping search content", async () => {
			const fileContent = `<div>Hello &amp; welcome to &lt;our&gt; site!</div>
<p>Don&apos;t forget to check &quot;special offers&quot;</p>`

			const mockReadFile = vi.mocked(fs.readFile)
			mockReadFile.mockResolvedValue(fileContent)

			const diffContent = `<<<<<<< SEARCH
:start_line:1
-------
<div>Hello &amp; welcome to &lt;our&gt; site!</div>
=======
<div>Hello &amp; welcome to &lt;our updated&gt; site!</div>
>>>>>>> REPLACE`

			mockBlock = {
				params: {
					path: "test.html",
					diff: diffContent,
				},
				partial: false,
			}

			await applyDiffToolLegacy(
				mockCline,
				mockBlock,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify the search content was not unescaped
			expect(mockCline.diffStrategy.applyDiff).toHaveBeenCalledWith(
				fileContent,
				expect.stringContaining("&amp; welcome to &lt;our&gt;"),
				NaN,
			)
		})

		it("should preserve HTML entities in both search and replace content", async () => {
			const diffContent = `<<<<<<< SEARCH
:start_line:1
-------
// Step 5 &amp; 6: Find and validate
=======
// Step 5 &amp; 6: Find, validate &amp; process
>>>>>>> REPLACE`

			mockBlock = {
				params: {
					path: "test.js",
					diff: diffContent,
				},
				partial: false,
			}

			await applyDiffToolLegacy(
				mockCline,
				mockBlock,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			const actualDiffContent = mockCline.diffStrategy.applyDiff.mock.calls[0][1]
			expect(actualDiffContent).toContain("Step 5 &amp; 6: Find and validate")
			expect(actualDiffContent).toContain("Step 5 &amp; 6: Find, validate &amp; process")
		})

		it("should handle apostrophe entities correctly", async () => {
			const fileContent = "// Don&apos;t modify this comment"
			const mockReadFile = vi.mocked(fs.readFile)
			mockReadFile.mockResolvedValue(fileContent)

			const diffContent = `<<<<<<< SEARCH
:start_line:1
-------
// Don&apos;t modify this comment
=======
// Don&apos;t modify this updated comment
>>>>>>> REPLACE`

			mockBlock = {
				params: {
					path: "test.js",
					diff: diffContent,
				},
				partial: false,
			}

			await applyDiffToolLegacy(
				mockCline,
				mockBlock,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify apostrophe entities are preserved
			const actualDiffContent = mockCline.diffStrategy.applyDiff.mock.calls[0][1]
			expect(actualDiffContent).toContain("Don&apos;t modify this comment")
			expect(actualDiffContent).toContain("Don&apos;t modify this updated comment")
		})
	})

	describe("Claude model behavior", () => {
		beforeEach(() => {
			// Set up Claude model
			mockCline.api.getModel.mockReturnValue({ id: "claude-3-sonnet" })
		})

		it("should not unescape HTML entities for Claude models (no change in behavior)", async () => {
			const diffContent = `<<<<<<< SEARCH
:start_line:1
-------
// Comment with &amp; entity
=======
// Comment with &amp; entity updated
>>>>>>> REPLACE`

			mockBlock = {
				params: {
					path: "test.js",
					diff: diffContent,
				},
				partial: false,
			}

			await applyDiffToolLegacy(
				mockCline,
				mockBlock,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify that diffStrategy.applyDiff was called with the original diff content
			expect(mockCline.diffStrategy.applyDiff).toHaveBeenCalledWith(
				"// Comment with &amp; entity\nconst value = 'test';",
				diffContent,
				NaN,
			)
		})
	})
})
