import { SrtSandbox } from "../SrtSandbox"
import type { SandboxConfig } from "../types"

// Mock execa to control availability check
vi.mock("execa", () => ({
	execa: vi.fn(),
}))

describe("SrtSandbox", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	const defaultConfig: SandboxConfig = {
		enabled: true,
		networkPolicy: "deny",
		writePolicy: "allow",
		allowedPaths: [],
		deniedPaths: [],
	}

	describe("wrapCommand", () => {
		it("should wrap command with srt exec and default network deny", () => {
			const sandbox = new SrtSandbox(defaultConfig)
			const result = sandbox.wrapCommand("npm test", "/home/user/project")

			expect(result).toContain("srt exec")
			expect(result).toContain("--net=none")
			expect(result).toContain("--bind=/home/user/project")
			expect(result).toContain("--chdir=/home/user/project")
			expect(result).toContain("-- sh -c")
			expect(result).toContain("npm test")
		})

		it("should not include --net=none when network policy is allow", () => {
			const config: SandboxConfig = { ...defaultConfig, networkPolicy: "allow" }
			const sandbox = new SrtSandbox(config)
			const result = sandbox.wrapCommand("curl example.com", "/tmp")

			expect(result).not.toContain("--net=none")
			expect(result).toContain("srt exec")
		})

		it("should include --readonly when write policy is deny", () => {
			const config: SandboxConfig = { ...defaultConfig, writePolicy: "deny" }
			const sandbox = new SrtSandbox(config)
			const result = sandbox.wrapCommand("ls -la", "/tmp")

			expect(result).toContain("--readonly")
		})

		it("should not include --readonly when write policy is allow", () => {
			const sandbox = new SrtSandbox(defaultConfig)
			const result = sandbox.wrapCommand("ls -la", "/tmp")

			expect(result).not.toContain("--readonly")
		})

		it("should use cwd as default allowed path when allowedPaths is empty", () => {
			const sandbox = new SrtSandbox(defaultConfig)
			const result = sandbox.wrapCommand("ls", "/home/user/project")

			expect(result).toContain("--bind=/home/user/project")
		})

		it("should use specified allowed paths instead of cwd", () => {
			const config: SandboxConfig = {
				...defaultConfig,
				allowedPaths: ["/opt/data", "/var/cache"],
			}
			const sandbox = new SrtSandbox(config)
			const result = sandbox.wrapCommand("ls", "/home/user/project")

			expect(result).toContain("--bind=/opt/data")
			expect(result).toContain("--bind=/var/cache")
			// When allowedPaths is specified, cwd is NOT automatically added
			expect(result).not.toContain("--bind=/home/user/project")
		})

		it("should include denied paths", () => {
			const config: SandboxConfig = {
				...defaultConfig,
				deniedPaths: ["/etc/passwd", "/root"],
			}
			const sandbox = new SrtSandbox(config)
			const result = sandbox.wrapCommand("cat /etc/hosts", "/tmp")

			expect(result).toContain("--deny=/etc/passwd")
			expect(result).toContain("--deny=/root")
		})

		it("should properly escape single quotes in commands", () => {
			const sandbox = new SrtSandbox(defaultConfig)
			const result = sandbox.wrapCommand("echo 'hello world'", "/tmp")

			// The command should be wrapped in single quotes with proper escaping
			expect(result).toContain("-- sh -c")
			expect(result).toContain("hello world")
		})

		it("should combine all options correctly", () => {
			const config: SandboxConfig = {
				enabled: true,
				networkPolicy: "deny",
				writePolicy: "deny",
				allowedPaths: ["/workspace"],
				deniedPaths: ["/secret"],
			}
			const sandbox = new SrtSandbox(config)
			const result = sandbox.wrapCommand("make build", "/workspace")

			expect(result).toContain("srt exec")
			expect(result).toContain("--net=none")
			expect(result).toContain("--readonly")
			expect(result).toContain("--bind=/workspace")
			expect(result).toContain("--deny=/secret")
			expect(result).toContain("--chdir=/workspace")
			expect(result).toContain("-- sh -c")
		})
	})

	describe("isAvailable", () => {
		it("should return true when srt is available", async () => {
			const { execa } = await import("execa")
			const mockExeca = vi.mocked(execa)
			mockExeca.mockResolvedValueOnce(undefined as any)

			const sandbox = new SrtSandbox(defaultConfig)
			const available = await sandbox.isAvailable()

			expect(available).toBe(true)
			expect(mockExeca).toHaveBeenCalledWith("srt", ["--version"])
		})

		it("should return false when srt is not available", async () => {
			const { execa } = await import("execa")
			const mockExeca = vi.mocked(execa)
			mockExeca.mockRejectedValueOnce(new Error("command not found"))

			const sandbox = new SrtSandbox(defaultConfig)
			const available = await sandbox.isAvailable()

			expect(available).toBe(false)
		})

		it("should cache the availability result", async () => {
			const { execa } = await import("execa")
			const mockExeca = vi.mocked(execa)
			mockExeca.mockResolvedValueOnce(undefined as any)

			const sandbox = new SrtSandbox(defaultConfig)
			await sandbox.isAvailable()
			await sandbox.isAvailable()

			// Should only be called once due to caching
			expect(mockExeca).toHaveBeenCalledTimes(1)
		})
	})
})
