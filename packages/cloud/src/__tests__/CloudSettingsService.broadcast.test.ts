import type { ExtensionContext } from "vscode"
import type { OrganizationSettings, AuthService } from "@roo-code/types"

import { CloudSettingsService } from "../CloudSettingsService.js"
import { BridgeOrchestrator } from "../bridge/index.js"

vi.mock("../bridge/index.js", () => ({
	BridgeOrchestrator: {
		getInstance: vi.fn(),
	},
}))

vi.mock("../config", () => ({
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))

global.fetch = vi.fn()

describe("CloudSettingsService - Settings Broadcast", () => {
	let mockContext: ExtensionContext
	let mockAuthService: {
		getState: ReturnType<typeof vi.fn>
		getSessionToken: ReturnType<typeof vi.fn>
		hasActiveSession: ReturnType<typeof vi.fn>
		on: ReturnType<typeof vi.fn>
	}
	let cloudSettingsService: CloudSettingsService
	let mockLog: ReturnType<typeof vi.fn>
	let mockBridgeInstance: {
		publishSettingsUpdate: ReturnType<typeof vi.fn>
	}

	const mockSettings: OrganizationSettings = {
		version: 1,
		defaultSettings: {},
		allowList: {
			allowAll: true,
			providers: {},
		},
	}

	const mockUserSettings = {
		features: {},
		settings: { extensionBridgeEnabled: true },
		version: 1,
	}

	beforeEach(() => {
		vi.clearAllMocks()

		mockContext = {
			globalState: {
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			},
		} as unknown as ExtensionContext

		mockAuthService = {
			getState: vi.fn().mockReturnValue("active-session"),
			getSessionToken: vi.fn().mockReturnValue("valid-token"),
			hasActiveSession: vi.fn().mockReturnValue(true),
			on: vi.fn(),
		}

		mockLog = vi.fn()

		mockBridgeInstance = {
			publishSettingsUpdate: vi.fn().mockResolvedValue(undefined),
		}

		vi.mocked(BridgeOrchestrator.getInstance).mockReturnValue(
			mockBridgeInstance as unknown as ReturnType<typeof BridgeOrchestrator.getInstance>,
		)

		cloudSettingsService = new CloudSettingsService(mockContext, mockAuthService as unknown as AuthService, mockLog)
	})

	afterEach(() => {
		cloudSettingsService.dispose()
	})

	describe("broadcastSettingsUpdate", () => {
		it("should broadcast settings update when user settings are updated", async () => {
			// Initialize with existing settings
			mockContext.globalState.get = vi.fn((key: string) => {
				if (key === "organization-settings") return mockSettings
				if (key === "user-settings") return mockUserSettings
				return undefined
			})

			await cloudSettingsService.initialize()

			// Mock successful update response
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					...mockUserSettings,
					version: 2,
				}),
			} as unknown as Response)

			// Update user settings
			await cloudSettingsService.updateUserSettings({ taskSyncEnabled: true })

			// Verify broadcast was called with correct versions
			expect(mockBridgeInstance.publishSettingsUpdate).toHaveBeenCalledWith({
				organization: 1,
				user: 2,
			})
		})

		it("should not broadcast if BridgeOrchestrator is not available", async () => {
			vi.mocked(BridgeOrchestrator.getInstance).mockReturnValue(null)

			await cloudSettingsService.initialize()

			// Mock successful update response
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					...mockUserSettings,
					version: 2,
				}),
			} as unknown as Response)

			// Update user settings
			await cloudSettingsService.updateUserSettings({ taskSyncEnabled: true })

			// Verify broadcast was not called
			expect(mockBridgeInstance.publishSettingsUpdate).not.toHaveBeenCalled()
		})

		it("should handle broadcast errors gracefully", async () => {
			mockBridgeInstance.publishSettingsUpdate.mockRejectedValue(new Error("Broadcast failed"))

			await cloudSettingsService.initialize()

			// Mock successful update response
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					...mockUserSettings,
					version: 2,
				}),
			} as unknown as Response)

			// Update user settings
			await cloudSettingsService.updateUserSettings({ taskSyncEnabled: true })

			// Verify error was logged
			expect(mockLog).toHaveBeenCalledWith(
				"[cloud-settings] Error broadcasting settings update event:",
				expect.any(Error),
			)
		})
	})

	describe("handleRemoteSettingsUpdate", () => {
		it("should refetch settings when remote version is newer", async () => {
			// Initialize with existing settings
			mockContext.globalState.get = vi.fn((key: string) => {
				if (key === "organization-settings") return mockSettings
				if (key === "user-settings") return mockUserSettings
				return undefined
			})

			await cloudSettingsService.initialize()

			// Mock fetch for refetch
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					organization: { ...mockSettings, version: 2 },
					user: { ...mockUserSettings, version: 2 },
				}),
			} as unknown as Response)

			// Simulate remote settings update with newer versions
			cloudSettingsService.handleRemoteSettingsUpdate({
				organization: 2,
				user: 2,
			})

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Verify fetch was called
			expect(fetch).toHaveBeenCalledWith("https://app.roocode.com/api/extension-settings", {
				headers: {
					Authorization: "Bearer valid-token",
				},
			})
		})

		it("should not refetch settings when remote version is same or older", async () => {
			// Initialize with existing settings
			mockContext.globalState.get = vi.fn((key: string) => {
				if (key === "organization-settings") return mockSettings
				if (key === "user-settings") return mockUserSettings
				return undefined
			})

			await cloudSettingsService.initialize()

			vi.mocked(fetch).mockClear()

			// Simulate remote settings update with same versions
			cloudSettingsService.handleRemoteSettingsUpdate({
				organization: 1,
				user: 1,
			})

			// Wait for any async operations
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Verify fetch was not called
			expect(fetch).not.toHaveBeenCalled()
		})

		it("should refetch when only organization version is newer", async () => {
			// Initialize with existing settings
			mockContext.globalState.get = vi.fn((key: string) => {
				if (key === "organization-settings") return mockSettings
				if (key === "user-settings") return mockUserSettings
				return undefined
			})

			await cloudSettingsService.initialize()

			// Mock fetch for refetch
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					organization: { ...mockSettings, version: 2 },
					user: mockUserSettings,
				}),
			} as unknown as Response)

			// Simulate remote settings update with newer org version only
			cloudSettingsService.handleRemoteSettingsUpdate({
				organization: 2,
				user: 1,
			})

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Verify fetch was called
			expect(fetch).toHaveBeenCalled()
		})

		it("should refetch when only user version is newer", async () => {
			// Initialize with existing settings
			mockContext.globalState.get = vi.fn((key: string) => {
				if (key === "organization-settings") return mockSettings
				if (key === "user-settings") return mockUserSettings
				return undefined
			})

			await cloudSettingsService.initialize()

			// Mock fetch for refetch
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					organization: mockSettings,
					user: { ...mockUserSettings, version: 2 },
				}),
			} as unknown as Response)

			// Simulate remote settings update with newer user version only
			cloudSettingsService.handleRemoteSettingsUpdate({
				organization: 1,
				user: 2,
			})

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Verify fetch was called
			expect(fetch).toHaveBeenCalled()
		})

		it("should handle refetch errors gracefully", async () => {
			await cloudSettingsService.initialize()

			// Mock fetch to fail
			vi.mocked(fetch).mockRejectedValue(new Error("Network error"))

			// Simulate remote settings update
			cloudSettingsService.handleRemoteSettingsUpdate({
				organization: 2,
				user: 2,
			})

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Verify error was logged (the actual error is logged by fetchSettings)
			expect(mockLog).toHaveBeenCalledWith(
				"[cloud-settings] Error fetching extension settings:",
				expect.any(Error),
			)
		})
	})

	describe("setupBridgeListener", () => {
		it("should be callable without errors", () => {
			// This method is a placeholder for now
			// The actual listener setup happens in BridgeOrchestrator
			expect(() => cloudSettingsService.setupBridgeListener()).not.toThrow()
		})
	})
})
