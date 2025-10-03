import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { TerminalProfileService } from "../TerminalProfileService"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
	ThemeIcon: vi.fn().mockImplementation((id: string) => ({ id })),
	ThemeColor: vi.fn().mockImplementation((id: string) => ({ id })),
}))

describe("TerminalProfileService", () => {
	const mockGetConfiguration = vi.mocked(vscode.workspace.getConfiguration)

	beforeEach(() => {
		vi.clearAllMocks()
		// Set default platform to linux for consistent testing
		Object.defineProperty(process, "platform", {
			value: "linux",
			writable: true,
		})
	})

	describe("getPlatform", () => {
		it("should return correct platform identifiers", () => {
			// Test linux
			Object.defineProperty(process, "platform", { value: "linux" })
			expect((TerminalProfileService as any).getPlatform()).toBe("linux")

			// Test macOS
			Object.defineProperty(process, "platform", { value: "darwin" })
			expect((TerminalProfileService as any).getPlatform()).toBe("osx")

			// Test Windows
			Object.defineProperty(process, "platform", { value: "win32" })
			expect((TerminalProfileService as any).getPlatform()).toBe("windows")

			// Test unknown platform defaults to linux
			Object.defineProperty(process, "platform", { value: "unknown" })
			expect((TerminalProfileService as any).getPlatform()).toBe("linux")
		})
	})

	describe("getAvailableProfiles", () => {
		it("should return empty array when no profiles configured", () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue(undefined),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const profiles = TerminalProfileService.getAvailableProfiles()
			expect(profiles).toEqual([])
		})

		it("should return configured profiles", () => {
			const mockProfiles = {
				bash: { path: "/bin/bash" },
				zsh: { path: "/bin/zsh" },
			}
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "profiles.linux") return mockProfiles
					if (key === "defaultProfile.linux") return "bash"
					return undefined
				}),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const profiles = TerminalProfileService.getAvailableProfiles()
			expect(profiles).toEqual([
				{
					name: "bash",
					displayName: "bash",
					shellPath: "/bin/bash",
					isDefault: true,
				},
				{
					name: "zsh",
					displayName: "zsh",
					shellPath: "/bin/zsh",
					isDefault: false,
				},
			])
		})
	})

	describe("getProfileConfiguration", () => {
		it("should return full profile configuration", () => {
			const mockProfiles = {
				nushell: {
					path: "/home/user/.nix-profile/bin/nu",
					args: ["--config", "config.nu"],
					env: { NU_CONFIG: "/home/user/.config/nushell" },
					icon: "terminal",
					color: "terminal.ansiBlue",
				},
			}
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "profiles.linux") return mockProfiles
					return undefined
				}),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const config = TerminalProfileService.getProfileConfiguration("nushell")
			expect(config).toEqual({
				shellPath: "/home/user/.nix-profile/bin/nu",
				shellArgs: ["--config", "config.nu"],
				env: { NU_CONFIG: "/home/user/.config/nushell" },
				iconPath: expect.any(Object), // vscode.ThemeIcon
				color: expect.any(Object), // vscode.ThemeColor
			})
		})

		it("should return undefined for non-existent profile", () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue({}),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const config = TerminalProfileService.getProfileConfiguration("nonexistent")
			expect(config).toBeUndefined()
		})
	})

	describe("getTerminalOptionsForRoo", () => {
		it("should return preferred profile configuration when available", () => {
			const mockProfiles = {
				nushell: { path: "/bin/nu", args: ["--login"] },
			}
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "profiles.linux") return mockProfiles
					return undefined
				}),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const options = TerminalProfileService.getTerminalOptionsForRoo("nushell")
			expect(options).toEqual({
				shellPath: "/bin/nu",
				shellArgs: ["--login"],
			})
		})

		it("should fallback to default profile when preferred profile not available", () => {
			const mockProfiles = {
				bash: { path: "/bin/bash", args: ["--login"] },
			}
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "profiles.linux") return mockProfiles
					if (key === "defaultProfile.linux") return "bash"
					return undefined
				}),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const options = TerminalProfileService.getTerminalOptionsForRoo("nonexistent")
			expect(options).toEqual({
				shellPath: "/bin/bash",
				shellArgs: ["--login"],
			})
		})

		it("should return undefined when no profiles available", () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue(undefined),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const options = TerminalProfileService.getTerminalOptionsForRoo()
			expect(options).toBeUndefined()
		})

		it("should fallback to default profile when no preferred profile provided", () => {
			const mockProfiles = {
				bash: { path: "/bin/bash", args: ["--login"] },
			}
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "profiles.linux") return mockProfiles
					if (key === "defaultProfile.linux") return "bash"
					return undefined
				}),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const options = TerminalProfileService.getTerminalOptionsForRoo()
			expect(options).toEqual({
				shellPath: "/bin/bash",
				shellArgs: ["--login"],
			})
		})
	})

	describe("getShellPathForRoo", () => {
		it("should return preferred profile shell path when available", () => {
			const mockProfiles = {
				bash: { path: "/bin/bash" },
				zsh: { path: "/bin/zsh" },
			}
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "profiles.linux") return mockProfiles
					return undefined
				}),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const shellPath = TerminalProfileService.getShellPathForRoo("zsh")
			expect(shellPath).toBe("/bin/zsh")
		})

		it("should fallback to default profile when preferred profile not available", () => {
			const mockProfiles = {
				bash: { path: "/bin/bash" },
			}
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "profiles.linux") return mockProfiles
					if (key === "defaultProfile.linux") return "bash"
					return undefined
				}),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const shellPath = TerminalProfileService.getShellPathForRoo("nonexistent")
			expect(shellPath).toBe("/bin/bash")
		})

		it("should return undefined when no profiles available", () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue(undefined),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const shellPath = TerminalProfileService.getShellPathForRoo()
			expect(shellPath).toBeUndefined()
		})

		it("should fallback to default profile when no preferred profile provided", () => {
			const mockProfiles = {
				bash: { path: "/bin/bash" },
			}
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "profiles.linux") return mockProfiles
					if (key === "defaultProfile.linux") return "bash"
					return undefined
				}),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const shellPath = TerminalProfileService.getShellPathForRoo()
			expect(shellPath).toBe("/bin/bash")
		})
	})

	describe("getAllSelectableProfiles", () => {
		it("should include default option and available profiles", () => {
			const mockProfiles = {
				bash: { path: "/bin/bash" },
				zsh: { path: "/bin/zsh" },
			}
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "profiles.linux") return mockProfiles
					return undefined
				}),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			const profiles = TerminalProfileService.getAllSelectableProfiles()

			expect(profiles).toHaveLength(3) // Default + bash + zsh
			expect(profiles[0]).toEqual({
				name: "",
				displayName: "Default (VSCode Default)",
				isDefault: false,
			})
		})
	})

	describe("platform-specific behavior", () => {
		it("should use correct platform-specific configuration keys", () => {
			// Test Windows
			Object.defineProperty(process, "platform", { value: "win32" })
			const mockConfig = {
				get: vi.fn(),
			}
			mockGetConfiguration.mockReturnValue(mockConfig as any)

			TerminalProfileService.getAvailableProfiles()
			expect(mockConfig.get).toHaveBeenCalledWith("profiles.windows")
			expect(mockConfig.get).toHaveBeenCalledWith("defaultProfile.windows")

			// Test macOS
			Object.defineProperty(process, "platform", { value: "darwin" })
			TerminalProfileService.getAvailableProfiles()
			expect(mockConfig.get).toHaveBeenCalledWith("profiles.osx")
			expect(mockConfig.get).toHaveBeenCalledWith("defaultProfile.osx")
		})
	})
})
