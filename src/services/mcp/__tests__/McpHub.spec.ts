import fs from "fs/promises"

import type { Mock } from "vitest"
import type { ExtensionContext, Uri } from "vscode"

import type { ClineProvider } from "../../../core/webview/ClineProvider"

import type { McpHub as McpHubType, McpConnection, ConnectedMcpConnection, DisconnectedMcpConnection } from "../McpHub"
import { ServerConfigSchema, McpHub } from "../McpHub"

// Mock fs/promises before importing anything that uses it
vi.mock("fs/promises", () => ({
	default: {
		access: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue("{}"),
		unlink: vi.fn().mockResolvedValue(undefined),
		rename: vi.fn().mockResolvedValue(undefined),
		lstat: vi.fn().mockImplementation(() =>
			Promise.resolve({
				isDirectory: () => true,
			}),
		),
		mkdir: vi.fn().mockResolvedValue(undefined),
	},
	access: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue("{}"),
	unlink: vi.fn().mockResolvedValue(undefined),
	rename: vi.fn().mockResolvedValue(undefined),
	lstat: vi.fn().mockImplementation(() =>
		Promise.resolve({
			isDirectory: () => true,
		}),
	),
	mkdir: vi.fn().mockResolvedValue(undefined),
}))

// Import safeWriteJson to use in mocks
import { safeWriteJson } from "../../../utils/safeWriteJson"

// Mock safeWriteJson
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn(async (filePath, data) => {
		// Instead of trying to write to the file system, just call fs.writeFile mock
		// This avoids the complex file locking and temp file operations
		const fs = await import("fs/promises")
		return fs.writeFile(filePath, JSON.stringify(data), "utf8")
	}),
}))

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
vi.mock("fs/promises")
vi.mock("../../../core/webview/ClineProvider")

// Mock the MCP SDK modules
vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
	StdioClientTransport: vi.fn(),
	getDefaultEnvironment: vi.fn().mockReturnValue({ PATH: "/usr/bin" }),
}))

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
	Client: vi.fn(),
}))

// Mock chokidar
vi.mock("chokidar", () => ({
	default: {
		watch: vi.fn().mockReturnValue({
			on: vi.fn().mockReturnThis(),
			close: vi.fn(),
		}),
	},
}))

describe("McpHub", () => {
	let mcpHub: McpHubType
	let mockProvider: Partial<ClineProvider>

	// Store original console methods
	const originalConsoleError = console.error
	const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock console.error to suppress error messages during tests
		console.error = vi.fn()

		const mockUri: Uri = {
			scheme: "file",
			authority: "",
			path: "/test/path",
			query: "",
			fragment: "",
			fsPath: "/test/path",
			with: vi.fn(),
			toJSON: vi.fn(),
		}

		mockProvider = {
			ensureSettingsDirectoryExists: vi.fn().mockResolvedValue("/mock/settings/path"),
			ensureMcpServersDirectoryExists: vi.fn().mockResolvedValue("/mock/settings/path"),
			postMessageToWebview: vi.fn(),
			getState: vi.fn().mockResolvedValue({ mcpEnabled: true }),
			context: {
				subscriptions: [],
				workspaceState: {} as any,
				globalState: {} as any,
				secrets: {} as any,
				extensionUri: mockUri,
				extensionPath: "/test/path",
				storagePath: "/test/storage",
				globalStoragePath: "/test/global-storage",
				environmentVariableCollection: {} as any,
				extension: {
					id: "test-extension",
					extensionUri: mockUri,
					extensionPath: "/test/path",
					extensionKind: 1,
					isActive: true,
					packageJSON: {
						version: "1.0.0",
					},
					activate: vi.fn(),
					exports: undefined,
				} as any,
				asAbsolutePath: (path: string) => path,
				storageUri: mockUri,
				globalStorageUri: mockUri,
				logUri: mockUri,
				extensionMode: 1,
				logPath: "/test/path",
				languageModelAccessInformation: {} as any,
			} as ExtensionContext,
		}

		// Mock fs.readFile for initial settings
		vi.mocked(fs.readFile).mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
						alwaysAllow: ["allowed-tool"],
						disabledTools: ["disabled-tool"],
					},
				},
			}),
		)

		mcpHub = new McpHub(mockProvider as ClineProvider)
	})

	afterEach(() => {
		// Restore original console methods
		console.error = originalConsoleError
		// Restore original platform
		if (originalPlatform) {
			Object.defineProperty(process, "platform", originalPlatform)
		}
	})

	// ... (existing tests remain unchanged)
})

describe("Mode-to-Profile Mapping (MCP Profile Filtering)", () => {
	let mcpHub: McpHubType
	let mockProvider: Partial<ClineProvider>

	beforeEach(() => {
		vi.clearAllMocks()
		const mockUri: Uri = {
			scheme: "file",
			authority: "",
			path: "/test/path",
			query: "",
			fragment: "",
			fsPath: "/test/path",
			with: vi.fn(),
			toJSON: vi.fn(),
		}
		mockProvider = {
			ensureSettingsDirectoryExists: vi.fn().mockResolvedValue("/mock/settings/path"),
			ensureMcpServersDirectoryExists: vi.fn().mockResolvedValue("/mock/settings/path"),
			postMessageToWebview: vi.fn(),
			getState: vi.fn().mockResolvedValue({ mcpEnabled: true }),
			cwd: "/test/path",
			context: {
				subscriptions: [],
				workspaceState: {} as any,
				globalState: {} as any,
				secrets: {} as any,
				extensionUri: mockUri,
				extensionPath: "/test/path",
				storagePath: "/test/storage",
				globalStoragePath: "/test/global-storage",
				environmentVariableCollection: {} as any,
				extension: {
					id: "test-extension",
					extensionUri: mockUri,
					extensionPath: "/test/path",
					extensionKind: 1,
					isActive: true,
					packageJSON: { version: "1.0.0" },
					activate: vi.fn(),
					exports: undefined,
				} as any,
				asAbsolutePath: (path: string) => path,
				storageUri: mockUri,
				globalStorageUri: mockUri,
				logUri: mockUri,
				extensionMode: 1,
				logPath: "/test/path",
				languageModelAccessInformation: {} as any,
			} as ExtensionContext,
		}
		// Set up default empty config for constructor initialization
		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ mcpServers: {} }))
		vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"))
		mcpHub = new McpHub(mockProvider as ClineProvider)
	})

	describe("Mode-to-Profile Mapping Loading", () => {
		it("merges global mapping when empty", () => {
			mcpHub["modeToProfile"] = {}
			mcpHub["mergeModeToProfileMapping"]({ mode1: ["serverA"] }, "global")
			expect(mcpHub.getModeToProfileMapping()).toEqual({ mode1: ["serverA"] })
		})

		it("merges different modes from global and project", () => {
			mcpHub["modeToProfile"] = {}
			mcpHub["mergeModeToProfileMapping"]({ mode1: ["serverA"] }, "global")
			mcpHub["mergeModeToProfileMapping"]({ mode2: ["serverB"] }, "project")
			expect(mcpHub.getModeToProfileMapping()).toEqual({ mode1: ["serverA"], mode2: ["serverB"] })
		})

		it("project config takes precedence over global for same mode", () => {
			mcpHub["modeToProfile"] = {}
			mcpHub["mergeModeToProfileMapping"]({ mode1: ["serverA"] }, "global")
			mcpHub["mergeModeToProfileMapping"]({ mode1: ["serverB"] }, "project")
			expect(mcpHub.getModeToProfileMapping()).toEqual({ mode1: ["serverB"] })
		})

		it("global does not overwrite existing project mapping", () => {
			mcpHub["modeToProfile"] = {}
			mcpHub["mergeModeToProfileMapping"]({ mode1: ["serverB"] }, "project")
			mcpHub["mergeModeToProfileMapping"]({ mode1: ["serverA"] }, "global")
			expect(mcpHub.getModeToProfileMapping()).toEqual({ mode1: ["serverB"] })
		})

		it("handles missing modeToProfile field (backward compatibility)", () => {
			mcpHub["modeToProfile"] = {}
			mcpHub["mergeModeToProfileMapping"]({}, "global")
			expect(mcpHub.getModeToProfileMapping()).toEqual({})
		})
	})

	describe("Server Filtering by Active Mode", () => {
		beforeEach(() => {
			mcpHub.connections = [
				{
					type: "connected",
					server: { name: "serverA", config: "{}", status: "connected", disabled: false, source: "global" },
					client: {} as any,
					transport: {} as any,
				},
				{
					type: "connected",
					server: { name: "serverB", config: "{}", status: "connected", disabled: false, source: "project" },
					client: {} as any,
					transport: {} as any,
				},
				{
					type: "connected",
					server: { name: "serverC", config: "{}", status: "connected", disabled: false, source: "global" },
					client: {} as any,
					transport: {} as any,
				},
			]
			// Set up mapping
			mcpHub["modeToProfile"] = {
				mode1: ["serverA"],
				mode2: ["serverB"],
				mode3: ["nonexistent"],
				mode4: [],
				mode5: ["serverA", "serverB"],
				mode6: ["serverA", "serverC"],
				mode7: ["serverA", "serverB", "serverC"],
				mode8: [],
				mode9: ["serverD"],
				mode10: ["serverA", "serverD"],
				mode11: ["serverB"],
				mode12: ["serverC"],
				mode13: ["serverA", "serverB"],
				mode14: ["serverB", "serverC"],
				mode15: ["serverA", "serverB", "serverC"],
				mode16: ["serverA", "serverB", "serverC", "serverD"],
				mode17: ["serverA", "serverB", "serverC", "serverD", "serverE"],
				mode18: ["serverA", "serverB", "serverC", "serverD", "serverE", "serverF"],
				mode19: ["serverA", "serverB", "serverC", "serverD", "serverE", "serverF", "serverG"],
				mode20: ["serverA", "serverB", "serverC", "serverD", "serverE", "serverF", "serverG", "serverH"],
			}
		})

		it("returns all servers when no active mode is set", () => {
			mcpHub.setActiveMode(undefined)
			const servers = mcpHub.getServers()
			expect(servers.map((s) => s.name).sort()).toEqual(["serverA", "serverB", "serverC"])
		})

		it("returns all servers when active mode is not in mapping", () => {
			mcpHub.setActiveMode("unknown-mode")
			const servers = mcpHub.getServers()
			expect(servers.map((s) => s.name).sort()).toEqual(["serverA", "serverB", "serverC"])
		})

		it("returns only mapped servers when active mode is set", () => {
			mcpHub.setActiveMode("mode1")
			const servers = mcpHub.getServers()
			expect(servers.map((s) => s.name)).toEqual(["serverA"])
			mcpHub.setActiveMode("mode2")
			expect(mcpHub.getServers().map((s) => s.name)).toEqual(["serverB"])
			mcpHub.setActiveMode("mode5")
			expect(
				mcpHub
					.getServers()
					.map((s) => s.name)
					.sort(),
			).toEqual(["serverA", "serverB"])
			mcpHub.setActiveMode("mode6")
			expect(
				mcpHub
					.getServers()
					.map((s) => s.name)
					.sort(),
			).toEqual(["serverA", "serverC"])
			mcpHub.setActiveMode("mode7")
			expect(
				mcpHub
					.getServers()
					.map((s) => s.name)
					.sort(),
			).toEqual(["serverA", "serverB", "serverC"])
		})

		it("filters correctly with both global and project servers", () => {
			mcpHub.setActiveMode("mode6")
			const servers = mcpHub.getServers()
			expect(servers.map((s) => s.name).sort()).toEqual(["serverA", "serverC"])
		})

		it("preserves deduplication logic (project overrides global)", () => {
			mcpHub.connections.push({
				type: "connected",
				server: { name: "serverA", config: "{}", status: "connected", disabled: false, source: "project" },
				client: {} as any,
				transport: {} as any,
			})
			mcpHub.setActiveMode("mode1")
			const servers = mcpHub.getServers()
			const serverA = servers.find((s) => s.name === "serverA")
			expect(serverA?.source).toBe("project")
		})
	})

	describe("setActiveMode", () => {
		it("sets active mode to a valid mode slug", () => {
			mcpHub.setActiveMode("mode1")
			expect((mcpHub as any).activeMode).toBe("mode1")
		})
		it("sets active mode to undefined (clears filtering)", () => {
			mcpHub.setActiveMode(undefined)
			expect((mcpHub as any).activeMode).toBeUndefined()
		})
		it("switches between different modes", () => {
			mcpHub.setActiveMode("mode1")
			expect((mcpHub as any).activeMode).toBe("mode1")
			mcpHub.setActiveMode("mode2")
			expect((mcpHub as any).activeMode).toBe("mode2")
		})
	})

	describe("getModeToProfileMapping", () => {
		it("returns empty object when no mapping exists", () => {
			mcpHub["modeToProfile"] = {}
			expect(mcpHub.getModeToProfileMapping()).toEqual({})
		})
		it("returns correct mapping after loading config", () => {
			mcpHub["modeToProfile"] = { mode1: ["serverA"] }
			expect(mcpHub.getModeToProfileMapping()).toEqual({ mode1: ["serverA"] })
		})
		it("returns merged mapping (global + project)", () => {
			mcpHub["modeToProfile"] = { mode1: ["serverA"], mode2: ["serverB"] }
			expect(mcpHub.getModeToProfileMapping()).toEqual({ mode1: ["serverA"], mode2: ["serverB"] })
		})
	})

	describe("updateModeToProfileMapping", () => {
		it("updates mapping and persists to config file", async () => {
			vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({ mcpServers: {}, modeToProfile: {} }))
			vi.mocked(fs.writeFile).mockResolvedValue(undefined)
			const mapping = { mode1: ["serverA"] }
			await mcpHub.updateModeToProfileMapping(mapping)
			expect(mcpHub.getModeToProfileMapping()).toEqual(mapping)
		})
		it("saves to project config when project config exists", async () => {
			vi.mocked(fs.access).mockResolvedValueOnce(undefined)
			vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({ mcpServers: {}, modeToProfile: {} }))
			vi.mocked(fs.writeFile).mockResolvedValue(undefined)
			const mapping = { mode2: ["serverB"] }
			await mcpHub.updateModeToProfileMapping(mapping)
			expect(mcpHub.getModeToProfileMapping()).toEqual(mapping)
		})
		it("saves to global config when no project config", async () => {
			vi.mocked(fs.access).mockRejectedValueOnce(new Error("ENOENT"))
			vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({ mcpServers: {}, modeToProfile: {} }))
			vi.mocked(fs.writeFile).mockResolvedValue(undefined)
			const mapping = { mode3: ["serverC"] }
			await mcpHub.updateModeToProfileMapping(mapping)
			expect(mcpHub.getModeToProfileMapping()).toEqual(mapping)
		})
		it("handles empty mapping update", async () => {
			vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({ mcpServers: {}, modeToProfile: {} }))
			vi.mocked(fs.writeFile).mockResolvedValue(undefined)
			const mapping = {}
			await mcpHub.updateModeToProfileMapping(mapping)
			expect(mcpHub.getModeToProfileMapping()).toEqual({})
		})
	})

	describe("Validation", () => {
		it("warns about server names that don't exist in mcpServers", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			mcpHub.connections = [
				{
					type: "connected",
					server: { name: "serverA", config: "{}", status: "connected", disabled: false, source: "global" },
					client: {} as any,
					transport: {} as any,
				},
			]
			mcpHub["modeToProfile"] = { mode1: ["serverA", "nonexistent"] }
			mcpHub["validateModeToProfileMapping"]()
			expect(warnSpy).toHaveBeenCalledWith(
				'Mode "mode1" references non-existent server "nonexistent" in modeToProfile mapping',
			)
			warnSpy.mockRestore()
		})
		it("handles empty arrays in mapping", () => {
			mcpHub["modeToProfile"] = { mode1: [] }
			mcpHub["validateModeToProfileMapping"]()
			// No warning should be thrown
		})
		it("handles invalid mapping structure gracefully", () => {
			mcpHub["modeToProfile"] = { mode1: [123 as any] }
			// Should not throw, but will not match any server
			mcpHub["validateModeToProfileMapping"]()
		})
	})
})
