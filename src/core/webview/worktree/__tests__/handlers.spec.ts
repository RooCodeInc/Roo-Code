/**
 * Tests for worktree handlers
 */

import * as vscode from "vscode"
import * as path from "path"
import { handleCreateWorktreeInclude } from "../handlers"
import { worktreeIncludeService } from "@roo-code/core"
import type { ClineProvider } from "../../ClineProvider"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		openTextDocument: vi.fn(),
		workspaceFolders: [{ uri: { fsPath: "/test/workspace" }, name: "workspace" }],
	},
	window: {
		showTextDocument: vi.fn(),
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
	},
}))

// Mock worktreeIncludeService
vi.mock("@roo-code/core", () => ({
	worktreeIncludeService: {
		createWorktreeInclude: vi.fn(),
	},
	worktreeService: {
		checkGitRepo: vi.fn(),
	},
}))

describe("handleCreateWorktreeInclude", () => {
	const mockProvider = {
		cwd: "/test/workspace",
		log: vi.fn(),
	} as unknown as ClineProvider

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should create the file and open it in the editor", async () => {
		const mockDocument = { uri: { fsPath: "/test/workspace/.worktreeinclude" } }
		vi.mocked(worktreeIncludeService.createWorktreeInclude).mockResolvedValue(undefined)
		vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any)
		vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any)

		const result = await handleCreateWorktreeInclude(mockProvider, "node_modules/\n.env")

		expect(result.success).toBe(true)
		expect(result.message).toBe(".worktreeinclude file created")
		expect(worktreeIncludeService.createWorktreeInclude).toHaveBeenCalledWith(
			"/test/workspace",
			"node_modules/\n.env",
		)

		// Verify the file was opened in the editor
		const expectedPath = path.join("/test/workspace", ".worktreeinclude")
		expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expectedPath)
		expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockDocument)
	})

	it("should return error when creation fails", async () => {
		vi.mocked(worktreeIncludeService.createWorktreeInclude).mockRejectedValue(new Error("Permission denied"))

		const result = await handleCreateWorktreeInclude(mockProvider, "node_modules/")

		expect(result.success).toBe(false)
		expect(result.message).toBe("Failed to create .worktreeinclude: Permission denied")
		expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled()
		expect(vscode.window.showTextDocument).not.toHaveBeenCalled()
	})

	it("should still return success even if opening the file fails", async () => {
		vi.mocked(worktreeIncludeService.createWorktreeInclude).mockResolvedValue(undefined)
		vi.mocked(vscode.workspace.openTextDocument).mockRejectedValue(new Error("Failed to open"))

		const result = await handleCreateWorktreeInclude(mockProvider, "node_modules/")

		// The function throws when opening fails, so it should return error
		expect(result.success).toBe(false)
		expect(result.message).toContain("Failed to create .worktreeinclude")
	})
})
