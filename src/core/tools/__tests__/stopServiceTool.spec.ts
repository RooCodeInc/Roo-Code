// npx vitest run src/core/tools/__tests__/stopServiceTool.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { StopServiceTool } from "../StopServiceTool"
import { ServiceManager } from "../../../integrations/terminal/ServiceManager"

// Mock ServiceManager
vi.mock("../../../integrations/terminal/ServiceManager", () => ({
	ServiceManager: {
		getService: vi.fn(),
		getRunningServices: vi.fn(),
		stopService: vi.fn(),
	},
}))

// Mock i18n
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string, params?: Record<string, any>) => {
		const translations: Record<string, string> = {
			"tools:stop_service.no_services": "No background services are currently running.",
			"tools:stop_service.service_id_required": "A service_id is required to stop a service.",
			"tools:stop_service.available_services": "Available background services:",
			"tools:stop_service.usage_hint": "Use stop_service with a specific service_id to stop that service.",
			"tools:stop_service.service_not_found": `Service '${params?.serviceId || ""}' not found.`,
			"tools:stop_service.success": `Service '${params?.serviceId || ""}' has been stopped successfully.`,
			"tools:stop_service.partial_success": `Service '${params?.serviceId || ""}' may not have fully terminated.`,
			"tools:stop_service.stopping": `Service '${params?.serviceId || ""}' is being stopped.`,
			"tools:stop_service.error": `Failed to stop service '${params?.serviceId || ""}': ${params?.error || ""}`,
		}
		return translations[key] || key
	}),
}))

describe("StopServiceTool", () => {
	let tool: StopServiceTool
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockTask: any

	beforeEach(() => {
		vi.clearAllMocks()
		tool = new StopServiceTool()
		mockPushToolResult = vi.fn()
		mockHandleError = vi.fn()
		mockTask = {} as any
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("parseLegacy", () => {
		it("should parse service_id parameter", () => {
			const result = tool.parseLegacy({ service_id: "service-1" })
			expect(result.service_id).toBe("service-1")
		})

		it("should return empty string for missing service_id", () => {
			const result = tool.parseLegacy({})
			expect(result.service_id).toBe("")
		})
	})

	describe("execute", () => {
		const callbacks = {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn((tag, text) => text || ""),
			toolProtocol: "xml" as const,
		}

		beforeEach(() => {
			vi.clearAllMocks()
			callbacks.pushToolResult = vi.fn()
			callbacks.handleError = vi.fn()
		})

		it("should list services when no service_id is provided and services exist", async () => {
			const mockServices = [
				{ serviceId: "service-1", command: "npm run dev", status: "running", pid: 1234 },
				{ serviceId: "service-2", command: "python server.py", status: "ready", pid: 5678 },
			]
			vi.mocked(ServiceManager.getRunningServices).mockReturnValue(mockServices as any)

			await tool.execute({ service_id: "" }, mockTask, callbacks)

			expect(callbacks.pushToolResult).toHaveBeenCalledTimes(1)
			const result = callbacks.pushToolResult.mock.calls[0][0]
			expect(result).toContain("service_id is required")
			expect(result).toContain("service-1")
			expect(result).toContain("service-2")
		})

		it("should return no_services message when no services and no service_id", async () => {
			vi.mocked(ServiceManager.getRunningServices).mockReturnValue([])

			await tool.execute({ service_id: "" }, mockTask, callbacks)

			expect(callbacks.pushToolResult).toHaveBeenCalledWith("No background services are currently running.")
		})

		it("should return service_not_found when service does not exist", async () => {
			vi.mocked(ServiceManager.getService).mockReturnValue(undefined)
			vi.mocked(ServiceManager.getRunningServices).mockReturnValue([])

			await tool.execute({ service_id: "non-existent" }, mockTask, callbacks)

			expect(callbacks.pushToolResult).toHaveBeenCalledTimes(1)
			const result = callbacks.pushToolResult.mock.calls[0][0]
			expect(result).toContain("non-existent")
			expect(result).toContain("not found")
		})

		it("should successfully stop a service", async () => {
			const mockService = {
				serviceId: "service-1",
				command: "npm run dev",
				status: "running",
				pid: 1234,
			}
			vi.mocked(ServiceManager.getService)
				.mockReturnValueOnce(mockService as any) // First call to get service info
				.mockReturnValueOnce(undefined) // Second call after stop (service removed)
			vi.mocked(ServiceManager.stopService).mockResolvedValue(undefined)

			await tool.execute({ service_id: "service-1" }, mockTask, callbacks)

			expect(ServiceManager.stopService).toHaveBeenCalledWith("service-1")
			expect(callbacks.pushToolResult).toHaveBeenCalledTimes(1)
			const result = callbacks.pushToolResult.mock.calls[0][0]
			expect(result).toContain("stopped successfully")
		})

		it("should handle stop service failure", async () => {
			const mockService = {
				serviceId: "service-1",
				command: "npm run dev",
				status: "running",
				pid: 1234,
			}
			vi.mocked(ServiceManager.getService).mockReturnValue(mockService as any)
			vi.mocked(ServiceManager.stopService).mockRejectedValue(new Error("Failed to terminate process"))

			await tool.execute({ service_id: "service-1" }, mockTask, callbacks)

			expect(callbacks.pushToolResult).toHaveBeenCalledTimes(1)
			const result = callbacks.pushToolResult.mock.calls[0][0]
			expect(result).toContain("Failed to stop service")
			expect(result).toContain("Failed to terminate process")
		})

		it("should show partial_success when service status is failed after stop", async () => {
			const mockService = {
				serviceId: "service-1",
				command: "npm run dev",
				status: "running",
				pid: 1234,
			}
			const failedService = {
				...mockService,
				status: "failed",
			}
			vi.mocked(ServiceManager.getService)
				.mockReturnValueOnce(mockService as any) // First call to get service info
				.mockReturnValueOnce(failedService as any) // Second call after stop (service failed)
			vi.mocked(ServiceManager.stopService).mockResolvedValue(undefined)

			await tool.execute({ service_id: "service-1" }, mockTask, callbacks)

			expect(callbacks.pushToolResult).toHaveBeenCalledTimes(1)
			const result = callbacks.pushToolResult.mock.calls[0][0]
			expect(result).toContain("may not have fully terminated")
		})

		it("should show stopping message when service is still stopping", async () => {
			const mockService = {
				serviceId: "service-1",
				command: "npm run dev",
				status: "running",
				pid: 1234,
			}
			const stoppingService = {
				...mockService,
				status: "stopping",
			}
			vi.mocked(ServiceManager.getService)
				.mockReturnValueOnce(mockService as any) // First call to get service info
				.mockReturnValueOnce(stoppingService as any) // Second call after stop (service still stopping)
			vi.mocked(ServiceManager.stopService).mockResolvedValue(undefined)

			await tool.execute({ service_id: "service-1" }, mockTask, callbacks)

			expect(callbacks.pushToolResult).toHaveBeenCalledTimes(1)
			const result = callbacks.pushToolResult.mock.calls[0][0]
			expect(result).toContain("is being stopped")
		})
	})
})
