import * as vscode from "vscode"
import { userInfo } from "os"
import { getShell } from "../shell"

// Mock the os module
vi.mock("os", () => ({
	userInfo: vi.fn(() => ({ shell: null })),
}))

// Mock the which module
vi.mock("which", () => ({
	default: vi.fn(),
}))

import which from "which"

describe("Shell Detection Tests", () => {
	let originalPlatform: string
	let originalEnv: NodeJS.ProcessEnv
	let originalGetConfig: any

	// Helper to mock VS Code configuration
	function mockVsCodeConfig(platformKey: string, defaultProfileName: string | null, profiles: Record<string, any>) {
		vscode.workspace.getConfiguration = () =>
			({
				get: (key: string) => {
					if (key === `defaultProfile.${platformKey}`) {
						return defaultProfileName
					}
					if (key === `profiles.${platformKey}`) {
						return profiles
					}
					return undefined
				},
			}) as any
	}

	beforeEach(() => {
		// Store original references
		originalPlatform = process.platform
		originalEnv = { ...process.env }
		originalGetConfig = vscode.workspace.getConfiguration

		// Clear environment variables for a clean test
		delete process.env.SHELL
		delete process.env.COMSPEC

		// Reset userInfo mock to default
		vi.mocked(userInfo).mockReturnValue({ shell: null } as any)

		// Mock which to always resolve paths successfully for tests
		vi.mocked(which).mockImplementation(async (cmd: string) => {
			// Return the command as-is to simulate successful resolution
			return cmd
		})
	})

	afterEach(() => {
		// Restore everything
		Object.defineProperty(process, "platform", { value: originalPlatform })
		process.env = originalEnv
		vscode.workspace.getConfiguration = originalGetConfig
		vi.clearAllMocks()
	})

	// --------------------------------------------------------------------------
	// Windows Shell Detection
	// --------------------------------------------------------------------------
	describe("Windows Shell Detection", () => {
		beforeEach(() => {
			Object.defineProperty(process, "platform", { value: "win32" })
		})

		it("uses explicit PowerShell 7 path from VS Code config (profile path)", async () => {
			mockVsCodeConfig("windows", "PowerShell", {
				PowerShell: { path: "C:\\Program Files\\PowerShell\\7\\pwsh.exe" },
			})
			expect(await getShell()).toBe("C:\\Program Files\\PowerShell\\7\\pwsh.exe")
		})

		it("uses PowerShell 7 path if source is 'PowerShell' but no explicit path", async () => {
			mockVsCodeConfig("windows", "PowerShell", {
				PowerShell: { source: "PowerShell" },
			})
			expect(await getShell()).toBe("C:\\Program Files\\PowerShell\\7\\pwsh.exe")
		})

		it("falls back to legacy PowerShell if profile includes 'powershell' but no path/source", async () => {
			mockVsCodeConfig("windows", "PowerShell", {
				PowerShell: {},
			})
			expect(await getShell()).toBe("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")
		})

		it("uses WSL bash when profile indicates WSL source", async () => {
			mockVsCodeConfig("windows", "WSL", {
				WSL: { source: "WSL" },
			})
			expect(await getShell()).toBe("/bin/bash")
		})

		it("uses WSL bash when profile name includes 'wsl'", async () => {
			mockVsCodeConfig("windows", "Ubuntu WSL", {
				"Ubuntu WSL": {},
			})
			expect(await getShell()).toBe("/bin/bash")
		})

		it("defaults to cmd.exe if no special profile is matched", async () => {
			mockVsCodeConfig("windows", "CommandPrompt", {
				CommandPrompt: {},
			})
			expect(await getShell()).toBe("C:\\Windows\\System32\\cmd.exe")
		})

		it("handles undefined profile gracefully", async () => {
			// Mock a case where defaultProfileName exists but the profile doesn't
			mockVsCodeConfig("windows", "NonexistentProfile", {})
			expect(await getShell()).toBe("C:\\Windows\\System32\\cmd.exe")
		})

		it("respects userInfo() if no VS Code config is available", async () => {
			vscode.workspace.getConfiguration = () => ({ get: () => undefined }) as any
			vi.mocked(userInfo).mockReturnValue({ shell: "C:\\Custom\\PowerShell.exe" } as any)

			expect(await getShell()).toBe("C:\\Custom\\PowerShell.exe")
		})

		it("respects an odd COMSPEC if no userInfo shell is available", async () => {
			vscode.workspace.getConfiguration = () => ({ get: () => undefined }) as any
			process.env.COMSPEC = "D:\\CustomCmd\\cmd.exe"

			expect(await getShell()).toBe("D:\\CustomCmd\\cmd.exe")
		})
	})

	// --------------------------------------------------------------------------
	// macOS Shell Detection
	// --------------------------------------------------------------------------
	describe("macOS Shell Detection", () => {
		beforeEach(() => {
			Object.defineProperty(process, "platform", { value: "darwin" })
		})

		it("uses VS Code profile path if available", async () => {
			mockVsCodeConfig("osx", "MyCustomShell", {
				MyCustomShell: { path: "/usr/local/bin/fish" },
			})
			expect(await getShell()).toBe("/usr/local/bin/fish")
		})

		it("falls back to userInfo().shell if no VS Code config is available", async () => {
			vscode.workspace.getConfiguration = () => ({ get: () => undefined }) as any
			vi.mocked(userInfo).mockReturnValue({ shell: "/opt/homebrew/bin/zsh" } as any)
			expect(await getShell()).toBe("/opt/homebrew/bin/zsh")
		})

		it("falls back to SHELL env var if no userInfo shell is found", async () => {
			vscode.workspace.getConfiguration = () => ({ get: () => undefined }) as any
			process.env.SHELL = "/usr/local/bin/zsh"
			expect(await getShell()).toBe("/usr/local/bin/zsh")
		})

		it("falls back to /bin/zsh if no config, userInfo, or env variable is set", async () => {
			vscode.workspace.getConfiguration = () => ({ get: () => undefined }) as any
			expect(await getShell()).toBe("/bin/zsh")
		})
	})

	// --------------------------------------------------------------------------
	// Linux Shell Detection
	// --------------------------------------------------------------------------
	describe("Linux Shell Detection", () => {
		beforeEach(() => {
			Object.defineProperty(process, "platform", { value: "linux" })
		})

		it("uses VS Code profile path if available", async () => {
			mockVsCodeConfig("linux", "CustomProfile", {
				CustomProfile: { path: "/usr/bin/fish" },
			})
			expect(await getShell()).toBe("/usr/bin/fish")
		})

		it("falls back to userInfo().shell if no VS Code config is available", async () => {
			vscode.workspace.getConfiguration = () => ({ get: () => undefined }) as any
			vi.mocked(userInfo).mockReturnValue({ shell: "/usr/bin/zsh" } as any)
			expect(await getShell()).toBe("/usr/bin/zsh")
		})

		it("falls back to SHELL env var if no userInfo shell is found", async () => {
			vscode.workspace.getConfiguration = () => ({ get: () => undefined }) as any
			process.env.SHELL = "/usr/bin/fish"
			expect(await getShell()).toBe("/usr/bin/fish")
		})

		it("falls back to /bin/bash if nothing is set", async () => {
			vscode.workspace.getConfiguration = () => ({ get: () => undefined }) as any
			expect(await getShell()).toBe("/bin/bash")
		})
	})

	// --------------------------------------------------------------------------
	// Unknown Platform & Error Handling
	// --------------------------------------------------------------------------
	describe("Unknown Platform / Error Handling", () => {
		it("falls back to /bin/sh for unknown platforms", async () => {
			Object.defineProperty(process, "platform", { value: "sunos" })
			vscode.workspace.getConfiguration = () => ({ get: () => undefined }) as any
			expect(await getShell()).toBe("/bin/sh")
		})

		it("handles VS Code config errors gracefully, falling back to userInfo shell if present", async () => {
			Object.defineProperty(process, "platform", { value: "linux" })
			vscode.workspace.getConfiguration = () => {
				throw new Error("Configuration error")
			}
			vi.mocked(userInfo).mockReturnValue({ shell: "/bin/bash" } as any)
			expect(await getShell()).toBe("/bin/bash")
		})

		it("handles userInfo errors gracefully, falling back to environment variable if present", async () => {
			Object.defineProperty(process, "platform", { value: "darwin" })
			vscode.workspace.getConfiguration = () => ({ get: () => undefined }) as any
			vi.mocked(userInfo).mockImplementation(() => {
				throw new Error("userInfo error")
			})
			process.env.SHELL = "/bin/zsh"
			expect(await getShell()).toBe("/bin/zsh")
		})

		it("falls back fully to default shell paths if everything fails", async () => {
			Object.defineProperty(process, "platform", { value: "linux" })
			vscode.workspace.getConfiguration = () => {
				throw new Error("Configuration error")
			}
			vi.mocked(userInfo).mockImplementation(() => {
				throw new Error("userInfo error")
			})
			delete process.env.SHELL
			expect(await getShell()).toBe("/bin/bash")
		})
	})
})
