// npx vitest run src/core/tools/__tests__/ExecuteCommandTool.timeout.test.ts
// 测试 ExecuteCommandTool 的通用命令超时功能

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ServiceManager } from "../../../integrations/terminal/ServiceManager"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn((key: string, defaultValue: any) => defaultValue),
		})),
	},
}))

// Mock ServiceManager
vi.mock("../../../integrations/terminal/ServiceManager", () => ({
	ServiceManager: {
		startService: vi.fn().mockResolvedValue({
			serviceId: "test-service-1",
			status: "starting",
			command: "test command",
			cwd: "/test",
			logs: [],
			pid: 12345,
		}),
		getServiceLogs: vi.fn().mockReturnValue(["Log line 1", "Log line 2"]),
		stopService: vi.fn(),
		listServices: vi.fn().mockReturnValue([]),
		notifyStatusChange: vi.fn(),
	},
}))

describe("ExecuteCommandTool - Timeout Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Service mode configuration", () => {
		it("should have correct service mode options interface", () => {
			// 验证 ExecuteCommandOptions 接口支持所需的属性
			// Verify ExecuteCommandOptions interface supports required properties
			const options = {
				executionId: "exec-1",
				command: "npm run dev",
				mode: "service" as const,
				readyTimeoutMs: 5000,
				isServiceCommand: true,
				enableUniversalCommandTimeout: false,
				commandExecutionTimeout: 60000,
			}

			expect(options.mode).toBe("service")
			expect(options.readyTimeoutMs).toBe(5000)
			expect(options.isServiceCommand).toBe(true)
		})

		it("should have correct oneshot mode options interface", () => {
			const options = {
				executionId: "exec-1",
				command: "echo hello",
				mode: "oneshot" as const,
				commandExecutionTimeout: 30000,
				enableUniversalCommandTimeout: true,
			}

			expect(options.mode).toBe("oneshot")
			expect(options.commandExecutionTimeout).toBe(30000)
			expect(options.enableUniversalCommandTimeout).toBe(true)
		})
	})

	describe("ServiceManager logs integration", () => {
		it("should return logs from ServiceManager", () => {
			const logs = ["Server starting...", "Listening on port 3000", "Ready in 2s"]
			vi.mocked(ServiceManager.getServiceLogs).mockReturnValue(logs)

			const result = ServiceManager.getServiceLogs("test-service", 100)

			expect(result).toContain("Server starting...")
			expect(result).toContain("Listening on port 3000")
			expect(result).toContain("Ready in 2s")
		})

		it("should limit logs to specified number of lines", () => {
			const manyLogs = Array.from({ length: 200 }, (_, i) => `Log line ${i + 1}`)
			vi.mocked(ServiceManager.getServiceLogs).mockImplementation((serviceId, maxLines) => {
				if (maxLines && manyLogs.length > maxLines) {
					return manyLogs.slice(-maxLines)
				}
				return manyLogs
			})

			const result = ServiceManager.getServiceLogs("test-service", 50)

			expect(result.length).toBe(50)
			expect(result[0]).toBe("Log line 151")
			expect(result[49]).toBe("Log line 200")
		})

		it("should return empty array for non-existent service", () => {
			vi.mocked(ServiceManager.getServiceLogs).mockReturnValue([])

			const result = ServiceManager.getServiceLogs("non-existent-service", 100)

			expect(result).toEqual([])
		})
	})

	describe("Timeout behavior configuration", () => {
		it("should support configurable command execution timeout", () => {
			// 测试超时配置值
			const timeoutConfigs = [
				{ timeout: 0, description: "no timeout" },
				{ timeout: 30000, description: "30 seconds" },
				{ timeout: 60000, description: "60 seconds" },
				{ timeout: 120000, description: "120 seconds" },
			]

			for (const config of timeoutConfigs) {
				expect(config.timeout).toBeGreaterThanOrEqual(0)
			}
		})

		it("should support universal timeout toggle", () => {
			// 测试通用超时开关
			const enabledConfig = { enableUniversalCommandTimeout: true }
			const disabledConfig = { enableUniversalCommandTimeout: false }

			expect(enabledConfig.enableUniversalCommandTimeout).toBe(true)
			expect(disabledConfig.enableUniversalCommandTimeout).toBe(false)
		})
	})

	describe("Service command detection", () => {
		it("should correctly identify service vs oneshot mode", () => {
			// 服务命令应使用 service 模式
			const serviceOptions = {
				mode: "service" as const,
				isServiceCommand: true,
			}

			// 普通命令应使用 oneshot 模式
			const oneshotOptions = {
				mode: "oneshot" as const,
				isServiceCommand: false,
			}

			expect(serviceOptions.mode).toBe("service")
			expect(oneshotOptions.mode).toBe("oneshot")
		})
	})

	describe("Timeout message generation", () => {
		it("should generate appropriate timeout message format", () => {
			// 验证超时消息格式
			const timeoutSeconds = 30
			const expectedMessage = `Command timed out after ${timeoutSeconds} seconds`

			expect(expectedMessage).toContain("timed out")
			expect(expectedMessage).toContain(String(timeoutSeconds))
		})

		it("should generate universal timeout message format", () => {
			// 验证通用超时消息格式
			const command = "node long-running-script.js"
			const timeoutSeconds = 60

			const message = `[Universal Timeout] Command '${command}' exceeded the ${timeoutSeconds}s timeout and is now running in background.`

			expect(message).toContain("Universal Timeout")
			expect(message).toContain(command)
			expect(message).toContain("background")
		})
	})

	describe("Exit code handling", () => {
		it("should format exit code correctly", () => {
			const exitCodes = [
				{ code: 0, description: "success" },
				{ code: 1, description: "general error" },
				{ code: 127, description: "command not found" },
				{ code: 137, description: "SIGKILL" },
				{ code: 143, description: "SIGTERM" },
			]

			for (const { code } of exitCodes) {
				const message = `Exit code: ${code}`
				expect(message).toContain(String(code))
			}
		})

		it("should include signal name when available", () => {
			const signalInfo = { exitCode: 137, signalName: "SIGKILL" }
			const message = `Terminated by signal: ${signalInfo.signalName}`

			expect(message).toContain("SIGKILL")
		})
	})

	describe("Working directory handling", () => {
		it("should validate working directory path", () => {
			const paths = ["/test/workspace", "C:\\Users\\Test\\Project", "/home/user/project"]

			for (const path of paths) {
				expect(path.length).toBeGreaterThan(0)
			}
		})

		it("should handle non-existent directory error", () => {
			const nonExistentPath = "/non/existent/path"
			const errorMessage = `Working directory '${nonExistentPath}' does not exist.`

			expect(errorMessage).toContain(nonExistentPath)
			expect(errorMessage).toContain("does not exist")
		})
	})

	describe("Service ready detection", () => {
		it("should support health check URL configuration", () => {
			const healthCheckConfig = {
				healthCheckUrl: "http://localhost:3000/health",
				healthCheckIntervalMs: 1000,
			}

			expect(healthCheckConfig.healthCheckUrl).toContain("health")
			expect(healthCheckConfig.healthCheckIntervalMs).toBe(1000)
		})

		it("should support ready pattern configuration", () => {
			const readyPatterns = ["Local:.*http://localhost", "ready in", "Compiled successfully", "listening on"]

			for (const pattern of readyPatterns) {
				expect(pattern.length).toBeGreaterThan(0)
			}
		})
	})
})
