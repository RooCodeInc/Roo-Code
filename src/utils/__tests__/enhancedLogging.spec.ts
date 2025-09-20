import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { logEnhancedError, logEnhanced, disposeEnhancedLogging } from "../enhancedLogging"

// Mock the Package module
vi.mock("../shared/package", () => ({
	Package: {
		outputChannel: "Roo-Code",
	},
}))

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		createOutputChannel: vi.fn(),
	},
	OutputChannel: vi.fn(),
}))

describe("enhancedLogging", () => {
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: any
	let mockGlobalState: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Create mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
			replace: vi.fn(),
			name: "Roo-Code",
		}

		// Mock window.createOutputChannel to return our mock
		vi.mocked(vscode.window.createOutputChannel).mockReturnValue(mockOutputChannel as any)

		// Create mock global state
		mockGlobalState = {
			get: vi.fn(),
			update: vi.fn(),
			keys: vi.fn().mockReturnValue([]),
			setKeysForSync: vi.fn(),
		}

		// Create mock context
		mockContext = {
			globalState: mockGlobalState as any,
			subscriptions: [],
			workspaceState: {} as any,
			extensionUri: {} as any,
			extensionPath: "",
			asAbsolutePath: vi.fn(),
			storagePath: "",
			globalStoragePath: "",
			logPath: "",
			extensionMode: 3,
			extension: {} as any,
			globalStorageUri: {} as any,
			logUri: {} as any,
			storageUri: {} as any,
			secrets: {} as any,
			environmentVariableCollection: {} as any,
			languageModelAccessInformation: {} as any,
		}
	})

	afterEach(() => {
		// Dispose the output channel to reset module state
		disposeEnhancedLogging()
		vi.restoreAllMocks()
	})

	describe("logEnhancedError", () => {
		it("should not log when enhanced logging is disabled", () => {
			// Arrange
			vi.mocked(mockGlobalState.get).mockImplementation((key: string, defaultValue?: any) => {
				if (key === "enhancedLoggingEnabled") return false
				return defaultValue
			})
			const error = new Error("Test error")

			// Act
			logEnhancedError(mockContext, error)

			// Assert
			expect(vscode.window.createOutputChannel).not.toHaveBeenCalled()
			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled()
		})

		it("should log error details when enhanced logging is enabled", () => {
			// Arrange
			vi.mocked(mockGlobalState.get).mockImplementation((key: string, defaultValue?: any) => {
				if (key === "enhancedLoggingEnabled") return true
				return defaultValue
			})
			const error = new Error("Test error")
			error.stack = "Error: Test error\n    at test.js:1:1"

			// Act
			logEnhancedError(mockContext, error, {
				operation: "Test Operation",
				provider: "test-provider",
			})

			// Assert
			expect(vscode.window.createOutputChannel).toHaveBeenCalledWith("Roo-Code")
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("[ENHANCED LOGGING] Error occurred at"),
			)
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith("Operation: Test Operation")
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith("Provider: test-provider")
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith("Error Type: Error")
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith("Message: Test error")
			expect(mockOutputChannel.show).toHaveBeenCalledWith(true)
		})

		it("should sanitize sensitive information", () => {
			// Arrange
			vi.mocked(mockGlobalState.get).mockImplementation((key: string, defaultValue?: any) => {
				if (key === "enhancedLoggingEnabled") return true
				return defaultValue
			})
			const error = new Error("API key failed")

			// Act
			logEnhancedError(mockContext, error, {
				request: {
					headers: {
						authorization: "Bearer sk-abcdef123456",
						apikey: "key-123456789",
					},
				},
			})

			// Assert
			// Check that sensitive data is redacted in the output
			const calls = mockOutputChannel.appendLine.mock.calls

			// The function should have been called multiple times
			expect(calls.length).toBeGreaterThan(0)

			const allOutput = calls.map((call: any) => call[0]).join("\n")
			expect(allOutput).toContain("[REDACTED")
			expect(allOutput).not.toContain("sk-abcdef123456")
			expect(allOutput).not.toContain("key-123456789")
		})

		it("should handle non-Error objects", () => {
			// Arrange
			vi.mocked(mockGlobalState.get).mockImplementation((key: string, defaultValue?: any) => {
				if (key === "enhancedLoggingEnabled") return true
				return defaultValue
			})
			const error = { code: "NETWORK_ERROR", details: "Connection failed" }

			// Act
			logEnhancedError(mockContext, error)

			// Assert
			const calls = mockOutputChannel.appendLine.mock.calls
			const allOutput = calls.map((call: any) => call[0]).join("\n")
			expect(allOutput).toContain("NETWORK_ERROR")
			expect(allOutput).toContain("Connection failed")
		})

		it("should handle string errors", () => {
			// Arrange
			vi.mocked(mockGlobalState.get).mockImplementation((key: string, defaultValue?: any) => {
				if (key === "enhancedLoggingEnabled") return true
				return defaultValue
			})
			const error = "Simple error string"

			// Act
			logEnhancedError(mockContext, error)

			// Assert
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Error Message: Simple error string"),
			)
		})

		it("should include timestamp in logs", () => {
			// Arrange
			vi.mocked(mockGlobalState.get).mockImplementation((key: string, defaultValue?: any) => {
				if (key === "enhancedLoggingEnabled") return true
				return defaultValue
			})
			const error = new Error("Test error")
			const dateSpy = vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T12:00:00.000Z")

			// Act
			logEnhancedError(mockContext, error)

			// Assert
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("2024-01-01T12:00:00.000Z"),
			)

			dateSpy.mockRestore()
		})
	})

	describe("logEnhanced", () => {
		it("should not log when enhanced logging is disabled", () => {
			// Arrange
			vi.mocked(mockGlobalState.get).mockImplementation((key: string, defaultValue?: any) => {
				if (key === "enhancedLoggingEnabled") return false
				return defaultValue
			})

			// Act
			logEnhanced(mockContext, "Test message")

			// Assert
			expect(vscode.window.createOutputChannel).not.toHaveBeenCalled()
			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled()
		})

		it("should log message with INFO level by default", () => {
			// Arrange
			vi.mocked(mockGlobalState.get).mockImplementation((key: string, defaultValue?: any) => {
				if (key === "enhancedLoggingEnabled") return true
				return defaultValue
			})
			const dateSpy = vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T12:00:00.000Z")

			// Act
			logEnhanced(mockContext, "Test message")

			// Assert
			expect(vscode.window.createOutputChannel).toHaveBeenCalledWith("Roo-Code")
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith("[2024-01-01T12:00:00.000Z] [INFO] Test message")

			dateSpy.mockRestore()
		})

		it("should log message with specified level", () => {
			// Arrange
			vi.mocked(mockGlobalState.get).mockImplementation((key: string, defaultValue?: any) => {
				if (key === "enhancedLoggingEnabled") return true
				return defaultValue
			})
			const dateSpy = vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T12:00:00.000Z")

			// Act
			logEnhanced(mockContext, "Error occurred", "ERROR")

			// Assert
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[2024-01-01T12:00:00.000Z] [ERROR] Error occurred",
			)

			dateSpy.mockRestore()
		})

		it("should support different log levels", () => {
			// Arrange
			vi.mocked(mockGlobalState.get).mockImplementation((key: string, defaultValue?: any) => {
				if (key === "enhancedLoggingEnabled") return true
				return defaultValue
			})
			const dateSpy = vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T12:00:00.000Z")

			// Act
			logEnhanced(mockContext, "Debug info", "DEBUG")
			logEnhanced(mockContext, "Warning message", "WARNING")

			// Assert
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith("[2024-01-01T12:00:00.000Z] [DEBUG] Debug info")
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[2024-01-01T12:00:00.000Z] [WARNING] Warning message",
			)

			dateSpy.mockRestore()
		})
	})

	describe("Output channel management", () => {
		it("should reuse the same output channel for multiple logs", () => {
			// Arrange
			vi.mocked(mockGlobalState.get).mockImplementation((key: string, defaultValue?: any) => {
				if (key === "enhancedLoggingEnabled") return true
				return defaultValue
			})

			// Act
			logEnhanced(mockContext, "First message")
			logEnhanced(mockContext, "Second message")
			logEnhancedError(mockContext, new Error("Test error"))

			// Assert
			expect(vscode.window.createOutputChannel).toHaveBeenCalledTimes(1)
			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
			// logEnhanced doesn't call show(), only logEnhancedError does
			expect(mockOutputChannel.show).toHaveBeenCalledTimes(1)
		})
	})
})
