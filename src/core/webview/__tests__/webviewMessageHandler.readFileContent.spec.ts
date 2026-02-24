// npx vitest core/webview/__tests__/webviewMessageHandler.readFileContent.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../../api/providers/fetchers/modelCache")

vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		showTextDocument: vi.fn(),
	},
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
		openTextDocument: vi.fn().mockResolvedValue({}),
	},
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
}))

vi.mock("fs/promises", () => {
	const readFile = vi.fn().mockResolvedValue("file content here")
	return {
		default: {
			rm: vi.fn(),
			mkdir: vi.fn(),
			readFile,
			writeFile: vi.fn(),
		},
		rm: vi.fn(),
		mkdir: vi.fn(),
		readFile,
		writeFile: vi.fn(),
	}
})

vi.mock("../../../utils/fs")
vi.mock("../../../utils/path")
vi.mock("../../../utils/globalContext")

vi.mock("../../../utils/pathUtils", () => ({
	isPathOutsideWorkspace: vi.fn((filePath: string) => {
		const nodePath = require("path")
		const normalized = nodePath.resolve(filePath)
		const workspaceRoot = nodePath.resolve("/mock/workspace")
		// Path is inside workspace if it equals or is under workspace root
		if (normalized === workspaceRoot) return false
		if (normalized.startsWith(workspaceRoot + nodePath.sep)) return false
		return true
	}),
}))

vi.mock("../../mentions/resolveImageMentions", () => ({
	resolveImageMentions: vi.fn(async ({ text, images }: { text: string; images?: string[] }) => ({
		text,
		images: [...(images ?? [])],
	})),
}))

import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"
import * as fs from "fs/promises"

const MOCK_CWD = "/mock/workspace/project"

const mockProvider = {
	getState: vi.fn(),
	postMessageToWebview: vi.fn(),
	customModesManager: {
		getCustomModes: vi.fn(),
		deleteCustomMode: vi.fn(),
	},
	context: {
		extensionPath: "/mock/extension/path",
		globalStorageUri: { fsPath: "/mock/global/storage" },
	},
	contextProxy: {
		context: {
			extensionPath: "/mock/extension/path",
			globalStorageUri: { fsPath: "/mock/global/storage" },
		},
		setValue: vi.fn(),
		getValue: vi.fn(),
	},
	log: vi.fn(),
	postStateToWebview: vi.fn(),
	getCurrentTask: vi.fn().mockReturnValue({ cwd: MOCK_CWD }),
	getTaskWithId: vi.fn(),
	createTaskWithHistoryItem: vi.fn(),
	cwd: MOCK_CWD,
} as unknown as ClineProvider

describe("webviewMessageHandler - readFileContent path traversal prevention", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(fs.readFile).mockResolvedValue("file content here")
		vi.mocked(mockProvider.getCurrentTask).mockReturnValue({ cwd: MOCK_CWD } as any)
	})

	it("allows reading a file within the workspace using a relative path", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "readFileContent",
			text: "src/index.ts",
		})

		expect(fs.readFile).toHaveBeenCalled()
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "fileContent",
				fileContent: expect.objectContaining({
					path: "src/index.ts",
					content: "file content here",
				}),
			}),
		)
	})

	it("blocks path traversal with ../", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "readFileContent",
			text: "../../../etc/passwd",
		})

		expect(fs.readFile).not.toHaveBeenCalled()
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "fileContent",
				fileContent: expect.objectContaining({
					path: "../../../etc/passwd",
					content: null,
					error: "Path is outside workspace",
				}),
			}),
		)
	})

	it("blocks absolute paths outside the workspace", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "readFileContent",
			text: "/etc/shadow",
		})

		expect(fs.readFile).not.toHaveBeenCalled()
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "fileContent",
				fileContent: expect.objectContaining({
					path: "/etc/shadow",
					content: null,
					error: "Path is outside workspace",
				}),
			}),
		)
	})

	it("blocks traversal disguised in the middle of a path", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "readFileContent",
			text: "src/../../../../etc/passwd",
		})

		expect(fs.readFile).not.toHaveBeenCalled()
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "fileContent",
				fileContent: expect.objectContaining({
					content: null,
					error: "Path is outside workspace",
				}),
			}),
		)
	})

	it("returns error when no path is provided", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "readFileContent",
			text: "",
		})

		expect(fs.readFile).not.toHaveBeenCalled()
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "fileContent",
				fileContent: expect.objectContaining({
					content: null,
					error: "No path provided",
				}),
			}),
		)
	})

	it("allows reading a file using an absolute path within the workspace", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "readFileContent",
			text: `${MOCK_CWD}/src/index.ts`,
		})

		expect(fs.readFile).toHaveBeenCalled()
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "fileContent",
				fileContent: expect.objectContaining({
					content: "file content here",
				}),
			}),
		)
	})
})
