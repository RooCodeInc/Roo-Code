// npx vitest run tests/hooks/OrchestrationStorage.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import * as path from "path"
import { OrchestrationStorage } from "../../src/hooks/OrchestrationStorage"

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
			appendFile: vi.fn(),
		},
	},
}))

describe("OrchestrationStorage", () => {
	let storage: OrchestrationStorage
	const workspaceRoot = "/workspace"
	const orchestrationDir = path.join(workspaceRoot, ".orchestration")

	beforeEach(() => {
		storage = new OrchestrationStorage()
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("getOrchestrationDirectory", () => {
		it("should return the .orchestration directory path", async () => {
			const dir = await storage.getOrchestrationDirectory()
			expect(dir).toBe(orchestrationDir)
		})

		it("should create .orchestration directory if it does not exist", async () => {
			// Mock directory does not exist
			vi.mocked(vscode.workspace.fs.stat).mockRejectedValueOnce(new Error("File not found"))

			await storage.ensureOrchestrationDirectory()

			expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(vscode.Uri.file(orchestrationDir))
		})

		it("should not create directory if it already exists", async () => {
			// Mock directory exists
			vi.mocked(vscode.workspace.fs.stat).mockResolvedValueOnce({
				type: vscode.FileType.Directory,
				ctime: 0,
				mtime: 0,
				size: 0,
			})

			await storage.ensureOrchestrationDirectory()

			expect(vscode.workspace.fs.createDirectory).not.toHaveBeenCalled()
		})
	})

	describe("readFile", () => {
		it("should read file content from .orchestration directory", async () => {
			const filePath = "active_intents.yaml"
			const content = "test content"
			const fullPath = path.join(orchestrationDir, filePath)

			vi.mocked(vscode.workspace.fs.readFile).mockResolvedValueOnce(Buffer.from(content, "utf-8"))

			const result = await storage.readFile(filePath)

			expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(vscode.Uri.file(fullPath))
			expect(result).toBe(content)
		})

		it("should throw error if file does not exist", async () => {
			const filePath = "nonexistent.yaml"

			vi.mocked(vscode.workspace.fs.readFile).mockRejectedValueOnce(new Error("File not found"))

			await expect(storage.readFile(filePath)).rejects.toThrow("File not found")
		})
	})

	describe("writeFile", () => {
		it("should write file content to .orchestration directory", async () => {
			const filePath = "active_intents.yaml"
			const content = "test content"
			const fullPath = path.join(orchestrationDir, filePath)

			await storage.writeFile(filePath, content)

			expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
				vscode.Uri.file(fullPath),
				Buffer.from(content, "utf-8"),
			)
		})

		it("should ensure directory exists before writing", async () => {
			const filePath = "active_intents.yaml"
			const content = "test content"

			// Mock directory does not exist
			vi.mocked(vscode.workspace.fs.stat).mockRejectedValueOnce(new Error("File not found"))

			await storage.writeFile(filePath, content)

			expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled()
		})
	})

	describe("appendFile", () => {
		it("should append content to file in .orchestration directory", async () => {
			const filePath = "agent_trace.jsonl"
			const content = '{"test": "data"}\n'
			const fullPath = path.join(orchestrationDir, filePath)

			await storage.appendFile(filePath, content)

			expect(vscode.workspace.fs.appendFile).toHaveBeenCalledWith(
				vscode.Uri.file(fullPath),
				Buffer.from(content, "utf-8"),
			)
		})

		it("should ensure directory exists before appending", async () => {
			const filePath = "agent_trace.jsonl"
			const content = '{"test": "data"}\n'

			// Mock directory does not exist
			vi.mocked(vscode.workspace.fs.stat).mockRejectedValueOnce(new Error("File not found"))

			await storage.appendFile(filePath, content)

			expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled()
		})
	})

	describe("fileExists", () => {
		it("should return true if file exists", async () => {
			const filePath = "active_intents.yaml"

			vi.mocked(vscode.workspace.fs.stat).mockResolvedValueOnce({
				type: vscode.FileType.File,
				ctime: 0,
				mtime: 0,
				size: 0,
			})

			const exists = await storage.fileExists(filePath)

			expect(exists).toBe(true)
		})

		it("should return false if file does not exist", async () => {
			const filePath = "nonexistent.yaml"

			vi.mocked(vscode.workspace.fs.stat).mockRejectedValueOnce(new Error("File not found"))

			const exists = await storage.fileExists(filePath)

			expect(exists).toBe(false)
		})
	})
})
