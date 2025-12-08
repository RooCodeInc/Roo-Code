// 测试 vitest 命令是否被错误识别为服务命令

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { ExecuteCommandTool } from "../ExecuteCommandTool"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn((key: string, defaultValue: any) => {
				if (key === "commandExecutionTimeout") return 0
				if (key === "commandTimeoutAllowlist") return []
				if (key === "serviceCommandPatterns") return []
				if (key === "enableUniversalCommandTimeout") return false
				return defaultValue
			}),
		})),
	},
}))

describe("ExecuteCommandTool - Vitest Command Detection", () => {
	let tool: ExecuteCommandTool

	beforeEach(() => {
		vi.clearAllMocks()
		tool = new ExecuteCommandTool()
	})

	describe("detectServiceCommand for vitest commands", () => {
		const detectServiceCommand = (command: string): boolean => {
			return (tool as any).detectServiceCommand(command)
		}

		it("should NOT detect npx vitest run as service command", () => {
			expect(detectServiceCommand("npx vitest run src/test/basic.test.ts --no-coverage")).toBe(false)
		})

		it("should NOT detect npm run test:coverage as service command", () => {
			expect(detectServiceCommand("npm run test:coverage")).toBe(false)
		})

		it("should NOT detect cd web && npx vitest run as service command", () => {
			expect(detectServiceCommand("cd web && npx vitest run src/test/basic.test.ts --no-coverage")).toBe(false)
		})

		it("should NOT detect vitest run as service command", () => {
			expect(detectServiceCommand("vitest run")).toBe(false)
		})

		it("should detect npm run dev as service command (positive test)", () => {
			expect(detectServiceCommand("npm run dev")).toBe(true)
		})

		it("should detect npm run start as service command (positive test)", () => {
			expect(detectServiceCommand("npm run start")).toBe(true)
		})

		it("should detect npm run serve as service command (positive test)", () => {
			expect(detectServiceCommand("npm run serve")).toBe(true)
		})
	})

	describe("matchesCustomPatterns for vitest commands", () => {
		const matchesCustomPatterns = (command: string, patterns: string[]): boolean => {
			return (tool as any).matchesCustomPatterns(command, patterns)
		}

		it("should return false with empty patterns", () => {
			expect(matchesCustomPatterns("npx vitest run", [])).toBe(false)
		})

		it("should return false with null patterns", () => {
			expect(matchesCustomPatterns("npx vitest run", null as any)).toBe(false)
		})

		it("should match custom vitest pattern if added", () => {
			const patterns = ["vitest.*run", "npx.*vitest"]
			expect(matchesCustomPatterns("npx vitest run", patterns)).toBe(true)
		})
	})
})
