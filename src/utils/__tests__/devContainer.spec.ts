import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import * as fs from "fs/promises"

// Mock vscode module
vi.mock("vscode", () => ({
	env: {
		remoteName: undefined,
	},
	workspace: {
		workspaceFolders: undefined,
		getConfiguration: vi.fn(),
	},
	window: {
		showWarningMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	ConfigurationTarget: {
		Global: 1,
	},
}))

// Mock fs/promises
vi.mock("fs/promises", () => ({
	default: {
		mkdir: vi.fn(),
		access: vi.fn(),
		constants: {
			R_OK: 4,
			W_OK: 2,
			X_OK: 1,
		},
	},
	mkdir: vi.fn(),
	access: vi.fn(),
	constants: {
		R_OK: 4,
		W_OK: 2,
		X_OK: 1,
	},
}))

// Mock fs module
vi.mock("fs", () => ({
	accessSync: vi.fn(),
	constants: {
		F_OK: 0,
	},
}))

// Import after mocks are set up
import {
	isRunningInDevContainer,
	getDevContainerPersistentPath,
	isEphemeralStoragePath,
	notifyDevContainerStorageSetup,
} from "../devContainer"

describe("devContainer", () => {
	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()
		// Reset environment variables
		delete process.env.REMOTE_CONTAINERS
		delete process.env.CODESPACES
		delete process.env.DEVCONTAINER
		// Reset vscode.env.remoteName
		;(vscode.env as any).remoteName = undefined
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("isRunningInDevContainer", () => {
		it("should return true when REMOTE_CONTAINERS env var is set", () => {
			process.env.REMOTE_CONTAINERS = "true"
			expect(isRunningInDevContainer()).toBe(true)
		})

		it("should return true when CODESPACES env var is set", () => {
			process.env.CODESPACES = "true"
			expect(isRunningInDevContainer()).toBe(true)
		})

		it("should return true when DEVCONTAINER env var is set", () => {
			process.env.DEVCONTAINER = "true"
			expect(isRunningInDevContainer()).toBe(true)
		})

		it("should return true when /.dockerenv file exists", async () => {
			const fsModule = vi.mocked(await import("fs"))
			fsModule.accessSync.mockImplementation(() => {
				// Success - file exists
				return undefined
			})
			expect(isRunningInDevContainer()).toBe(true)
		})

		it("should return false when /.dockerenv file does not exist", async () => {
			const fsModule = vi.mocked(await import("fs"))
			fsModule.accessSync.mockImplementation(() => {
				throw new Error("File not found")
			})
			;(vscode.env as any).remoteName = undefined
			expect(isRunningInDevContainer()).toBe(false)
		})

		it("should return true when VSCode remoteName contains 'container'", async () => {
			const fsModule = vi.mocked(await import("fs"))
			;(vscode.env as any).remoteName = "dev-container"
			fsModule.accessSync.mockImplementation(() => {
				throw new Error("File not found")
			})
			expect(isRunningInDevContainer()).toBe(true)
		})

		it("should return false when not in a container", async () => {
			const fsModule = vi.mocked(await import("fs"))
			fsModule.accessSync.mockImplementation(() => {
				throw new Error("File not found")
			})
			;(vscode.env as any).remoteName = "ssh-remote"
			expect(isRunningInDevContainer()).toBe(false)
		})
	})

	describe("getDevContainerPersistentPath", () => {
		it("should return null when not in a Dev Container", async () => {
			// Ensure we're not in a Dev Container
			const fsModule = vi.mocked(await import("fs"))
			fsModule.accessSync.mockImplementation(() => {
				throw new Error("File not found")
			})
			const result = await getDevContainerPersistentPath()
			expect(result).toBe(null)
		})

		it("should return workspace-relative path when available and writable", async () => {
			process.env.DEVCONTAINER = "true"
			;(vscode.workspace as any).workspaceFolders = [
				{
					uri: {
						fsPath: "/workspace/myproject",
					},
				},
			]

			const mockMkdir = vi.mocked(fs.mkdir)
			const mockAccess = vi.mocked(fs.access)

			mockMkdir.mockResolvedValue(undefined)
			mockAccess.mockResolvedValue(undefined)

			const result = await getDevContainerPersistentPath()
			expect(result).toBe("/workspace/myproject/.roo-data")
			expect(mockMkdir).toHaveBeenCalledWith("/workspace/myproject/.roo-data", { recursive: true })
		})

		it("should try alternative paths when primary path fails", async () => {
			process.env.DEVCONTAINER = "true"
			;(vscode.workspace as any).workspaceFolders = [
				{
					uri: {
						fsPath: "/workspace/myproject",
					},
				},
			]

			const mockMkdir = vi.mocked(fs.mkdir)
			const mockAccess = vi.mocked(fs.access)

			// First path fails
			mockMkdir.mockRejectedValueOnce(new Error("Permission denied"))
			// Second path succeeds
			mockMkdir.mockResolvedValueOnce(undefined)
			mockAccess.mockResolvedValueOnce(undefined)

			const result = await getDevContainerPersistentPath()
			expect(result).toBe("/workspaces/.roo-data")
		})

		it("should return null when all paths fail", async () => {
			process.env.DEVCONTAINER = "true"
			;(vscode.workspace as any).workspaceFolders = [
				{
					uri: {
						fsPath: "/workspace/myproject",
					},
				},
			]

			const mockMkdir = vi.mocked(fs.mkdir)
			mockMkdir.mockRejectedValue(new Error("Permission denied"))

			const result = await getDevContainerPersistentPath()
			expect(result).toBe(null)
		})
	})

	describe("isEphemeralStoragePath", () => {
		it("should return false when not in a Dev Container", async () => {
			const fsModule = vi.mocked(await import("fs"))
			fsModule.accessSync.mockImplementation(() => {
				throw new Error("File not found")
			})
			expect(isEphemeralStoragePath("/some/path")).toBe(false)
		})

		it("should return true for /tmp paths in Dev Container", () => {
			process.env.DEVCONTAINER = "true"
			expect(isEphemeralStoragePath("/tmp/storage")).toBe(true)
		})

		it("should return true for VSCode server paths in Dev Container", () => {
			process.env.DEVCONTAINER = "true"
			expect(isEphemeralStoragePath("/.vscode-server/data")).toBe(true)
			expect(isEphemeralStoragePath("/.vscode-remote/extensions")).toBe(true)
			expect(isEphemeralStoragePath("/home/user/.vscode/storage")).toBe(true)
		})

		it("should return true for paths containing temp directories", () => {
			process.env.DEVCONTAINER = "true"
			expect(isEphemeralStoragePath("/var/tmp/storage")).toBe(true)
			expect(isEphemeralStoragePath("/home/user/tmp/data")).toBe(true)
			expect(isEphemeralStoragePath("/dev/shm/cache")).toBe(true)
		})

		it("should return false for persistent paths in Dev Container", () => {
			process.env.DEVCONTAINER = "true"
			expect(isEphemeralStoragePath("/workspace/.roo-data")).toBe(false)
			expect(isEphemeralStoragePath("/home/user/.roo-data")).toBe(false)
			expect(isEphemeralStoragePath("/data/storage")).toBe(false)
		})
	})

	describe("notifyDevContainerStorageSetup", () => {
		it("should not show notification when not in Dev Container", async () => {
			const fsModule = vi.mocked(await import("fs"))
			fsModule.accessSync.mockImplementation(() => {
				throw new Error("File not found")
			})

			const mockContext = {
				globalStorageUri: { fsPath: "/normal/storage" },
				globalState: {
					update: vi.fn(),
					get: vi.fn(),
				},
			}

			await notifyDevContainerStorageSetup(mockContext as any)
			expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
		})

		it("should not show notification when storage path is not ephemeral", async () => {
			process.env.DEVCONTAINER = "true"

			const mockContext = {
				globalStorageUri: { fsPath: "/workspace/.roo-data" },
				globalState: {
					update: vi.fn(),
					get: vi.fn(),
				},
			}

			await notifyDevContainerStorageSetup(mockContext as any)
			expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
		})

		it("should show notification when in Dev Container with ephemeral storage", async () => {
			process.env.DEVCONTAINER = "true"
			;(vscode.workspace as any).workspaceFolders = [
				{
					uri: {
						fsPath: "/workspace/myproject",
					},
				},
			]

			const mockMkdir = vi.mocked(fs.mkdir)
			const mockAccess = vi.mocked(fs.access)
			mockMkdir.mockResolvedValue(undefined)
			mockAccess.mockResolvedValue(undefined)

			const mockShowWarningMessage = vi.mocked(vscode.window.showWarningMessage)
			mockShowWarningMessage.mockResolvedValue("Configure Now" as any)

			const mockConfig = {
				update: vi.fn().mockResolvedValue(undefined),
			}
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			const mockContext = {
				globalStorageUri: { fsPath: "/.vscode-server/data/storage" },
				globalState: {
					update: vi.fn(),
					get: vi.fn().mockReturnValue(false),
				},
			}

			await notifyDevContainerStorageSetup(mockContext as any)

			expect(mockShowWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining("Dev Container"),
				"Configure Now",
				"Remind Me Later",
				"Don't Show Again",
			)

			expect(mockConfig.update).toHaveBeenCalledWith(
				"customStoragePath",
				"/workspace/myproject/.roo-data",
				vscode.ConfigurationTarget.Global,
			)

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("Storage path set to"),
			)
		})

		it("should update global state when user chooses 'Don't Show Again'", async () => {
			process.env.DEVCONTAINER = "true"
			;(vscode.workspace as any).workspaceFolders = [
				{
					uri: {
						fsPath: "/workspace/myproject",
					},
				},
			]

			const mockMkdir = vi.mocked(fs.mkdir)
			const mockAccess = vi.mocked(fs.access)
			mockMkdir.mockResolvedValue(undefined)
			mockAccess.mockResolvedValue(undefined)

			const mockShowWarningMessage = vi.mocked(vscode.window.showWarningMessage)
			mockShowWarningMessage.mockResolvedValue("Don't Show Again" as any)

			const mockContext = {
				globalStorageUri: { fsPath: "/.vscode-server/data/storage" },
				globalState: {
					update: vi.fn(),
					get: vi.fn().mockReturnValue(false),
				},
			}

			await notifyDevContainerStorageSetup(mockContext as any)

			expect(mockContext.globalState.update).toHaveBeenCalledWith(
				"devContainerStorageNotificationDismissed",
				true,
			)
		})

		it("should not configure when user chooses 'Remind Me Later'", async () => {
			process.env.DEVCONTAINER = "true"
			;(vscode.workspace as any).workspaceFolders = [
				{
					uri: {
						fsPath: "/workspace/myproject",
					},
				},
			]

			const mockMkdir = vi.mocked(fs.mkdir)
			const mockAccess = vi.mocked(fs.access)
			mockMkdir.mockResolvedValue(undefined)
			mockAccess.mockResolvedValue(undefined)

			const mockShowWarningMessage = vi.mocked(vscode.window.showWarningMessage)
			mockShowWarningMessage.mockResolvedValue("Remind Me Later" as any)

			const mockConfig = {
				update: vi.fn(),
			}
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			const mockContext = {
				globalStorageUri: { fsPath: "/.vscode-server/data/storage" },
				globalState: {
					update: vi.fn(),
					get: vi.fn().mockReturnValue(false),
				},
			}

			await notifyDevContainerStorageSetup(mockContext as any)

			expect(mockConfig.update).not.toHaveBeenCalled()
			expect(mockContext.globalState.update).not.toHaveBeenCalled()
		})
	})
})
