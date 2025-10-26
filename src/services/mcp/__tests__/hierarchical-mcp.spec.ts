import { describe, it, expect, beforeEach, vi } from "vitest"
import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import type { ClineProvider } from "../../../core/webview/ClineProvider"
import { McpHub } from "../McpHub"

// Mock fs/promises ESM module to allow stubbing methods
vi.mock("fs/promises", () => ({
	default: {
		access: vi.fn(),
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
	access: vi.fn(),
	readFile: vi.fn(),
	writeFile: vi.fn(),
}))

// Mock safeWriteJson to avoid real FS writes
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn(async (filePath: string, data: any) => {
		const fs = await import("fs/promises")
		return fs.writeFile(filePath, JSON.stringify(data), "utf8")
	}),
}))

// Minimal VSCode mock
vi.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidChange: vi.fn(),
			onDidCreate: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		}),
		onDidSaveTextDocument: vi.fn(),
		onDidChangeWorkspaceFolders: vi.fn(),
		workspaceFolders: [],
	},
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
	},
	Disposable: {
		from: vi.fn(),
	},
}))

describe("Hierarchical project MCP configuration resolution", () => {
	const fileMap: Record<string, string> = {}
	const workspaceRoot = "/home/user/mono-repo/packages/frontend"

	const repoLevel = path.join("/home/user/mono-repo", ".roo", "mcp.json")
	const packagesLevel = path.join("/home/user/mono-repo/packages", ".roo", "mcp.json")
	const appLevel = path.join(workspaceRoot, ".roo", "mcp.json")

	beforeEach(() => {
		vi.clearAllMocks()
		process.env.NODE_ENV = "test"

		// Prepare hierarchical files
		fileMap[repoLevel] = JSON.stringify({
			mcpServers: {
				alpha: { type: "stdio", command: "node", args: ["repo.js"], disabled: true },
			},
		})
		fileMap[packagesLevel] = JSON.stringify({
			mcpServers: {
				beta: { type: "stdio", command: "node", args: ["pkg.js"], disabled: true },
			},
		})
		fileMap[appLevel] = JSON.stringify({
			mcpServers: {
				// Override alpha at most specific level
				alpha: { type: "stdio", command: "node", args: ["app.js"], disabled: true },
			},
		})

		// Configure fs.promises mocks
		;(fs as any).access.mockImplementation(async (p: any) => {
			const key = String(p)
			if (fileMap[key]) return
			const err: any = new Error("ENOENT")
			err.code = "ENOENT"
			throw err
		})
		;(fs as any).readFile.mockImplementation(async (p: any, _enc?: any) => {
			const key = String(p)
			if (fileMap[key]) return fileMap[key]
			// default empty config to avoid syntax errors
			return "{}"
		})
		;(fs as any).writeFile.mockResolvedValue(undefined as unknown as void)
	})

	it("merges multiple project-level .roo/mcp.json files with most specific overriding", async () => {
		const mockProvider: Partial<ClineProvider> = {
			ensureSettingsDirectoryExists: vi.fn().mockResolvedValue("/mock/settings/path"),
			ensureMcpServersDirectoryExists: vi.fn().mockResolvedValue("/mock/settings/path"),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			getState: vi.fn().mockResolvedValue({ mcpEnabled: true }),
			// Critical: provide cwd for hierarchical traversal start
			cwd: workspaceRoot as any,
			context: {
				subscriptions: [],
				workspaceState: {} as any,
				globalState: {} as any,
				secrets: {} as any,
				extensionUri: { fsPath: "/mock/uri" } as any,
				extensionPath: "/mock/extension/path",
				storagePath: "/mock/storage",
				globalStoragePath: "/mock/global-storage",
				environmentVariableCollection: {} as any,
				extension: {
					id: "test-extension",
					extensionUri: { fsPath: "/mock/uri" } as any,
					extensionPath: "/mock/extension/path",
					extensionKind: 1,
					isActive: true,
					packageJSON: { version: "1.0.0" },
					activate: vi.fn(),
					exports: undefined,
				} as any,
				asAbsolutePath: (p: string) => p,
				storageUri: { fsPath: "/mock/uri" } as any,
				globalStorageUri: { fsPath: "/mock/uri" } as any,
				logUri: { fsPath: "/mock/uri" } as any,
				extensionMode: 1,
				logPath: "/mock/log",
				languageModelAccessInformation: {} as any,
			} as any,
		}

		const hub = new McpHub(mockProvider as ClineProvider)

		// Allow initial async initialization to complete to avoid duplicate connections
		await new Promise((r) => setTimeout(r, 100))

		// Do not manually trigger refresh to avoid racing with constructor initialization.
		// The constructor already initializes project servers hierarchically.

		// Validate that both alpha and beta are present as project servers
		const projectConnections = hub.connections.filter((c) => c.server.source === "project")
		const names = projectConnections.map((c) => c.server.name).sort()
		expect(names).toEqual(["alpha", "beta"])

		// Validate that alpha was overridden by most specific file (app level)
		const alphaConn = projectConnections.find((c) => c.server.name === "alpha")!
		const alphaCfg = JSON.parse(alphaConn.server.config)
		expect(alphaCfg.args).toEqual(["app.js"])
		expect(alphaConn.server.status).toBe("disconnected") // disabled:true yields placeholder

		// Validate that beta came from packages level unchanged
		const betaConn = projectConnections.find((c) => c.server.name === "beta")!
		const betaCfg = JSON.parse(betaConn.server.config)
		expect(betaCfg.args).toEqual(["pkg.js"])
		expect(betaConn.server.status).toBe("disconnected")
	})
})
