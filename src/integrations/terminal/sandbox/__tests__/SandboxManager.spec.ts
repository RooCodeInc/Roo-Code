import { SandboxManager } from "../SandboxManager"
import { NoOpSandbox } from "../NoOpSandbox"
import { SrtSandbox } from "../SrtSandbox"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
}))

// Mock the package module
vi.mock("../../../../shared/package", () => ({
	Package: {
		name: "roo-cline",
	},
}))

import * as vscode from "vscode"

describe("SandboxManager", () => {
	beforeEach(() => {
		SandboxManager.resetInstance()
	})

	function mockConfig(overrides: Record<string, any> = {}) {
		const defaults: Record<string, any> = {
			commandSandboxEnabled: false,
			commandSandboxNetworkPolicy: "deny",
			commandSandboxWritePolicy: "allow",
			commandSandboxAllowedPaths: [],
			commandSandboxDeniedPaths: [],
		}

		const merged = { ...defaults, ...overrides }

		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn((key: string, defaultValue?: any) => {
				return key in merged ? merged[key] : defaultValue
			}),
		} as any)
	}

	describe("getInstance", () => {
		it("should return a singleton instance", () => {
			const a = SandboxManager.getInstance()
			const b = SandboxManager.getInstance()
			expect(a).toBe(b)
		})

		it("should return a new instance after reset", () => {
			const a = SandboxManager.getInstance()
			SandboxManager.resetInstance()
			const b = SandboxManager.getInstance()
			expect(a).not.toBe(b)
		})
	})

	describe("getConfig", () => {
		it("should read configuration from vscode workspace", () => {
			mockConfig({ commandSandboxEnabled: true, commandSandboxNetworkPolicy: "allow" })

			const manager = SandboxManager.getInstance()
			const config = manager.getConfig()

			expect(config.enabled).toBe(true)
			expect(config.networkPolicy).toBe("allow")
			expect(config.writePolicy).toBe("allow")
			expect(config.allowedPaths).toEqual([])
			expect(config.deniedPaths).toEqual([])
		})
	})

	describe("getSandbox", () => {
		it("should return NoOpSandbox when disabled", () => {
			mockConfig({ commandSandboxEnabled: false })

			const manager = SandboxManager.getInstance()
			const sandbox = manager.getSandbox()

			expect(sandbox).toBeInstanceOf(NoOpSandbox)
		})

		it("should return SrtSandbox when enabled", () => {
			mockConfig({ commandSandboxEnabled: true })

			const manager = SandboxManager.getInstance()
			const sandbox = manager.getSandbox()

			expect(sandbox).toBeInstanceOf(SrtSandbox)
		})

		it("should cache the sandbox instance when config unchanged", () => {
			mockConfig({ commandSandboxEnabled: true })

			const manager = SandboxManager.getInstance()
			const first = manager.getSandbox()
			const second = manager.getSandbox()

			expect(first).toBe(second)
		})

		it("should create new sandbox when config changes", () => {
			mockConfig({ commandSandboxEnabled: true })
			const manager = SandboxManager.getInstance()
			const first = manager.getSandbox()

			mockConfig({ commandSandboxEnabled: true, commandSandboxNetworkPolicy: "allow" })
			const second = manager.getSandbox()

			expect(first).not.toBe(second)
		})
	})

	describe("wrapCommand", () => {
		it("should pass through when sandbox is disabled", () => {
			mockConfig({ commandSandboxEnabled: false })

			const manager = SandboxManager.getInstance()
			const result = manager.wrapCommand("echo hello", "/tmp")

			expect(result).toBe("echo hello")
		})

		it("should wrap command when sandbox is enabled", () => {
			mockConfig({ commandSandboxEnabled: true })

			const manager = SandboxManager.getInstance()
			const result = manager.wrapCommand("echo hello", "/tmp")

			expect(result).toContain("srt exec")
			expect(result).toContain("echo hello")
		})
	})
})
