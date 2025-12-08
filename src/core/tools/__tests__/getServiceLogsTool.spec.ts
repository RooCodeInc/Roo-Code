/**
 * Tests for GetServiceLogsTool
 * 验证 get_service_logs 工具的参数解析和执行逻辑
 */

import { GetServiceLogsTool } from "../GetServiceLogsTool"
import { ServiceManager } from "../../../integrations/terminal/ServiceManager"

// Mock ServiceManager
vi.mock("../../../integrations/terminal/ServiceManager", () => ({
	ServiceManager: {
		getRunningServices: vi.fn(),
		getService: vi.fn(),
		getServiceLogs: vi.fn(),
	},
}))

// Mock i18n
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string, params?: Record<string, unknown>) => {
		// Return appropriate mock strings for different keys
		if (key === "tools:get_service_logs.no_services") {
			return "No background services are currently running."
		}
		if (key === "tools:get_service_logs.available_services") {
			return "Available background services:"
		}
		if (key === "tools:get_service_logs.usage_hint") {
			return "To get logs, call this tool with service_id parameter."
		}
		if (key === "tools:get_service_logs.service_not_found") {
			return `Service '${params?.serviceId}' not found.`
		}
		if (key === "tools:get_service_logs.service_info") {
			return `Service: ${params?.serviceId} (${params?.command}) - Status: ${params?.status}`
		}
		if (key === "tools:get_service_logs.no_logs") {
			return "No logs available for this service."
		}
		return key
	}),
}))

describe("GetServiceLogsTool", () => {
	let tool: GetServiceLogsTool
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockRemoveClosingTag: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()
		tool = new GetServiceLogsTool()
		mockPushToolResult = vi.fn()
		mockHandleError = vi.fn()
		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockRemoveClosingTag = vi.fn((tag, text) => text || "")
	})

	describe("parseLegacy", () => {
		it("should parse service_id parameter correctly", () => {
			const params = tool.parseLegacy({ service_id: "service-1" })
			expect(params.service_id).toBe("service-1")
		})

		it("should parse max_lines parameter correctly", () => {
			const params = tool.parseLegacy({ max_lines: "50" })
			expect(params.max_lines).toBe(50)
		})

		it("should handle empty service_id as null", () => {
			const params = tool.parseLegacy({ service_id: "" })
			expect(params.service_id).toBe(null)
		})

		it("should handle undefined service_id as null", () => {
			const params = tool.parseLegacy({})
			expect(params.service_id).toBe(null)
		})

		it("should handle both parameters together", () => {
			const params = tool.parseLegacy({ service_id: "service-2", max_lines: "100" })
			expect(params.service_id).toBe("service-2")
			expect(params.max_lines).toBe(100)
		})

		it("should pass through whitespace-only service_id (trimmed in execute)", () => {
			// parseLegacy doesn't trim - execute() handles trimming
			const params = tool.parseLegacy({ service_id: "   " })
			expect(params.service_id).toBe("   ")
		})
	})

	describe("execute", () => {
		const createCallbacks = () => ({
			askApproval: mockAskApproval,
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
			removeClosingTag: mockRemoveClosingTag,
			toolProtocol: "xml" as const,
		})

		describe("when service_id is not provided", () => {
			it("should list all running services when no service_id provided", async () => {
				const mockServices = [
					{
						serviceId: "service-1",
						command: "npm run dev",
						status: "running",
						pid: 1234,
						startedAt: Date.now(),
					},
					{
						serviceId: "service-2",
						command: "docker-compose up",
						status: "ready",
						pid: 5678,
						startedAt: Date.now(),
					},
				]
				vi.mocked(ServiceManager.getRunningServices).mockReturnValue(mockServices as any)

				await tool.execute({ service_id: null, max_lines: null }, {} as any, createCallbacks())

				expect(mockPushToolResult).toHaveBeenCalledTimes(1)
				const result = mockPushToolResult.mock.calls[0][0] as string
				expect(result).toContain("Available background services:")
				expect(result).toContain("service-1")
				expect(result).toContain("service-2")
				expect(result).toContain("npm run dev")
				expect(result).toContain("docker-compose up")
			})

			it("should return no services message when none running", async () => {
				vi.mocked(ServiceManager.getRunningServices).mockReturnValue([])

				await tool.execute({ service_id: null, max_lines: null }, {} as any, createCallbacks())

				expect(mockPushToolResult).toHaveBeenCalledWith("No background services are currently running.")
			})
		})

		describe("when service_id is provided", () => {
			it("should get logs for specific service", async () => {
				const mockService = {
					serviceId: "service-1",
					command: "npm run dev",
					status: "running",
					pid: 1234,
					startedAt: Date.now(),
					process: undefined,
				}
				const mockLogs = ["Server starting...", "Listening on port 3000", "Ready"]

				vi.mocked(ServiceManager.getService).mockReturnValue(mockService as any)
				vi.mocked(ServiceManager.getServiceLogs).mockReturnValue(mockLogs)

				await tool.execute({ service_id: "service-1", max_lines: 100 }, {} as any, createCallbacks())

				expect(ServiceManager.getService).toHaveBeenCalledWith("service-1")
				expect(ServiceManager.getServiceLogs).toHaveBeenCalledWith("service-1", 100)
				expect(mockPushToolResult).toHaveBeenCalledTimes(1)

				const result = mockPushToolResult.mock.calls[0][0] as string
				expect(result).toContain("service-1")
				expect(result).toContain("Server starting...")
				expect(result).toContain("Listening on port 3000")
				expect(result).toContain("Ready")
			})

			it("should return service not found when service does not exist", async () => {
				vi.mocked(ServiceManager.getService).mockReturnValue(undefined)
				vi.mocked(ServiceManager.getRunningServices).mockReturnValue([])

				await tool.execute({ service_id: "nonexistent-service", max_lines: null }, {} as any, createCallbacks())

				expect(ServiceManager.getService).toHaveBeenCalledWith("nonexistent-service")
				expect(mockPushToolResult).toHaveBeenCalledTimes(1)

				const result = mockPushToolResult.mock.calls[0][0] as string
				expect(result).toContain("Service 'nonexistent-service' not found")
			})

			it("should handle trimmed service_id with whitespace", async () => {
				const mockService = {
					serviceId: "service-1",
					command: "npm run dev",
					status: "running",
					pid: 1234,
					startedAt: Date.now(),
					process: undefined,
				}
				vi.mocked(ServiceManager.getService).mockReturnValue(mockService as any)
				vi.mocked(ServiceManager.getServiceLogs).mockReturnValue(["log line"])

				// The execute function trims the service_id internally
				await tool.execute({ service_id: "  service-1  ", max_lines: null }, {} as any, createCallbacks())

				expect(ServiceManager.getService).toHaveBeenCalledWith("service-1")
			})

			it("should use default max_lines of 100 when not specified", async () => {
				const mockService = {
					serviceId: "service-1",
					command: "npm run dev",
					status: "running",
					pid: 1234,
					startedAt: Date.now(),
					process: undefined,
				}
				vi.mocked(ServiceManager.getService).mockReturnValue(mockService as any)
				vi.mocked(ServiceManager.getServiceLogs).mockReturnValue([])

				await tool.execute({ service_id: "service-1", max_lines: null }, {} as any, createCallbacks())

				expect(ServiceManager.getServiceLogs).toHaveBeenCalledWith("service-1", 100)
			})

			it("should use provided max_lines value", async () => {
				const mockService = {
					serviceId: "service-1",
					command: "npm run dev",
					status: "running",
					pid: 1234,
					startedAt: Date.now(),
					process: undefined,
				}
				vi.mocked(ServiceManager.getService).mockReturnValue(mockService as any)
				vi.mocked(ServiceManager.getServiceLogs).mockReturnValue([])

				await tool.execute({ service_id: "service-1", max_lines: 50 }, {} as any, createCallbacks())

				expect(ServiceManager.getServiceLogs).toHaveBeenCalledWith("service-1", 50)
			})
		})
	})
})
