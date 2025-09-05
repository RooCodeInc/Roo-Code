import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
}))

// Mock os module
vi.mock("os", () => ({
	userInfo: vi.fn(),
}))

describe("shell utilities", () => {
	let originalPlatform: PropertyDescriptor | undefined
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		// Save original values
		originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")
		originalEnv = process.env

		// Reset mocks
		vi.clearAllMocks()

		// Reset module cache to ensure fresh imports
		vi.resetModules()
	})

	afterEach(() => {
		// Restore original values
		if (originalPlatform) {
			Object.defineProperty(process, "platform", originalPlatform)
		}
		process.env = originalEnv
	})

	describe("getShell", () => {
		it("should handle string path from VSCode terminal profile on Windows", async () => {
			// Set platform to Windows
			Object.defineProperty(process, "platform", {
				value: "win32",
				configurable: true,
			})

			// Mock VSCode configuration
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "defaultProfile.windows") return "PowerShell"
					if (key === "profiles.windows") {
						return {
							PowerShell: {
								path: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
							},
						}
					}
					return undefined
				}),
			}

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			// Import after mocks are set up
			const { getShell } = await import("../shell")

			const result = getShell()
			expect(result).toBe("C:\\Program Files\\PowerShell\\7\\pwsh.exe")
		})

		it("should handle array path from VSCode terminal profile on Windows", async () => {
			// Set platform to Windows
			Object.defineProperty(process, "platform", {
				value: "win32",
				configurable: true,
			})

			// Mock VSCode configuration with array path
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "defaultProfile.windows") return "PowerShell"
					if (key === "profiles.windows") {
						return {
							PowerShell: {
								// VSCode API may return path as an array
								path: ["C:\\Program Files\\PowerShell\\7\\pwsh.exe", "pwsh.exe"],
							},
						}
					}
					return undefined
				}),
			}

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			// Import after mocks are set up
			const { getShell } = await import("../shell")

			const result = getShell()
			// Should use the first element of the array
			expect(result).toBe("C:\\Program Files\\PowerShell\\7\\pwsh.exe")
		})

		it("should handle empty array path and fall back to defaults", async () => {
			// Set platform to Windows
			Object.defineProperty(process, "platform", {
				value: "win32",
				configurable: true,
			})

			// Mock VSCode configuration with empty array path
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "defaultProfile.windows") return "Custom"
					if (key === "profiles.windows") {
						return {
							Custom: {
								path: [], // Empty array
							},
						}
					}
					return undefined
				}),
			}

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			// Mock environment variable
			process.env = { ...originalEnv, COMSPEC: "C:\\Windows\\System32\\cmd.exe" }

			// Import after mocks are set up
			const { getShell } = await import("../shell")

			const result = getShell()
			// Should fall back to cmd.exe
			expect(result).toBe("C:\\Windows\\System32\\cmd.exe")
		})

		it("should handle string path on macOS", async () => {
			// Set platform to macOS
			Object.defineProperty(process, "platform", {
				value: "darwin",
				configurable: true,
			})

			// Mock VSCode configuration
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "defaultProfile.osx") return "zsh"
					if (key === "profiles.osx") {
						return {
							zsh: {
								path: "/bin/zsh",
							},
						}
					}
					return undefined
				}),
			}

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			// Import after mocks are set up
			const { getShell } = await import("../shell")

			const result = getShell()
			expect(result).toBe("/bin/zsh")
		})

		it("should handle array path on macOS", async () => {
			// Set platform to macOS
			Object.defineProperty(process, "platform", {
				value: "darwin",
				configurable: true,
			})

			// Mock VSCode configuration with array path
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "defaultProfile.osx") return "zsh"
					if (key === "profiles.osx") {
						return {
							zsh: {
								path: ["/opt/homebrew/bin/zsh", "/bin/zsh"],
							},
						}
					}
					return undefined
				}),
			}

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			// Import after mocks are set up
			const { getShell } = await import("../shell")

			const result = getShell()
			// Should use the first element of the array
			expect(result).toBe("/opt/homebrew/bin/zsh")
		})

		it("should handle string path on Linux", async () => {
			// Set platform to Linux
			Object.defineProperty(process, "platform", {
				value: "linux",
				configurable: true,
			})

			// Mock VSCode configuration
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "defaultProfile.linux") return "bash"
					if (key === "profiles.linux") {
						return {
							bash: {
								path: "/bin/bash",
							},
						}
					}
					return undefined
				}),
			}

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			// Import after mocks are set up
			const { getShell } = await import("../shell")

			const result = getShell()
			expect(result).toBe("/bin/bash")
		})

		it("should handle array path on Linux", async () => {
			// Set platform to Linux
			Object.defineProperty(process, "platform", {
				value: "linux",
				configurable: true,
			})

			// Mock VSCode configuration with array path
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "defaultProfile.linux") return "bash"
					if (key === "profiles.linux") {
						return {
							bash: {
								path: ["/usr/local/bin/bash", "/bin/bash"],
							},
						}
					}
					return undefined
				}),
			}

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			// Import after mocks are set up
			const { getShell } = await import("../shell")

			const result = getShell()
			// Should use the first element of the array
			expect(result).toBe("/usr/local/bin/bash")
		})
	})

	describe("isShellAllowed", () => {
		it("should validate string shell paths", async () => {
			// Import the module to get access to internal functions
			const shellModule = await import("../shell")

			// Access the isShellAllowed function through module internals
			// Since it's not exported, we need to test it indirectly through getShell
			// or make it exported for testing

			// For now, we'll test the behavior through getShell
			Object.defineProperty(process, "platform", {
				value: "win32",
				configurable: true,
			})

			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "defaultProfile.windows") return "PowerShell"
					if (key === "profiles.windows") {
						return {
							PowerShell: {
								path: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
							},
						}
					}
					return undefined
				}),
			}

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			const result = shellModule.getShell()
			// Should return the allowed shell
			expect(result).toBe("C:\\Program Files\\PowerShell\\7\\pwsh.exe")
		})

		it("should validate array shell paths", async () => {
			const shellModule = await import("../shell")

			Object.defineProperty(process, "platform", {
				value: "win32",
				configurable: true,
			})

			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "defaultProfile.windows") return "PowerShell"
					if (key === "profiles.windows") {
						return {
							PowerShell: {
								path: ["C:\\Program Files\\PowerShell\\7\\pwsh.exe", "pwsh"],
							},
						}
					}
					return undefined
				}),
			}

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			const result = shellModule.getShell()
			// Should return the first allowed shell from the array
			expect(result).toBe("C:\\Program Files\\PowerShell\\7\\pwsh.exe")
		})

		it("should reject non-allowed shell paths", async () => {
			const shellModule = await import("../shell")

			Object.defineProperty(process, "platform", {
				value: "win32",
				configurable: true,
			})

			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "defaultProfile.windows") return "Malicious"
					if (key === "profiles.windows") {
						return {
							Malicious: {
								path: "C:\\malicious\\shell.exe",
							},
						}
					}
					return undefined
				}),
			}

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any)

			// Mock environment to provide a fallback
			process.env = { ...originalEnv, COMSPEC: "C:\\Windows\\System32\\cmd.exe" }

			const result = shellModule.getShell()
			// Should fall back to safe default (cmd.exe)
			expect(result).toBe("C:\\Windows\\System32\\cmd.exe")
		})
	})
})
