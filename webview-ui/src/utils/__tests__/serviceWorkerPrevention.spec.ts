import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import {
	isVSCodeWebview,
	disableServiceWorkerRegistration,
	initServiceWorkerPrevention,
} from "../serviceWorkerPrevention"

describe("serviceWorkerPrevention", () => {
	let originalAcquireVsCodeApi: any

	beforeEach(() => {
		// Store original values
		originalAcquireVsCodeApi = (global as any).acquireVsCodeApi

		// Mock navigator.serviceWorker for each test
		const mockServiceWorker = {
			register: vi.fn(),
			getRegistration: vi.fn(),
			getRegistrations: vi.fn(),
			ready: Promise.resolve(),
			controller: null,
			oncontrollerchange: null,
			onmessage: null,
			onmessageerror: null,
		}

		// Use vi.stubGlobal for navigator
		vi.stubGlobal("navigator", {
			serviceWorker: mockServiceWorker,
		})
	})

	afterEach(() => {
		// Restore original values
		vi.unstubAllGlobals()

		if (originalAcquireVsCodeApi !== undefined) {
			;(global as any).acquireVsCodeApi = originalAcquireVsCodeApi
		} else {
			delete (global as any).acquireVsCodeApi
		}
	})

	describe("isVSCodeWebview", () => {
		it("should return true when acquireVsCodeApi is defined", () => {
			// Mock VS Code webview environment
			;(global as any).acquireVsCodeApi = vi.fn()

			expect(isVSCodeWebview()).toBe(true)
		})

		it("should return false when acquireVsCodeApi is undefined", () => {
			// Ensure it's undefined
			delete (global as any).acquireVsCodeApi

			expect(isVSCodeWebview()).toBe(false)
		})
	})

	describe("disableServiceWorkerRegistration", () => {
		it("should override navigator.serviceWorker.register in VS Code webview", async () => {
			// Mock VS Code webview environment
			;(global as any).acquireVsCodeApi = vi.fn()

			disableServiceWorkerRegistration()

			// Try to register a service worker
			await expect(navigator.serviceWorker.register("/sw.js")).rejects.toThrow(
				"ServiceWorker registration is not allowed in VS Code webview",
			)
		})

		it("should not override navigator.serviceWorker when not in VS Code webview", () => {
			// Ensure we're not in VS Code webview
			delete (global as any).acquireVsCodeApi

			const originalRegister = navigator.serviceWorker.register

			disableServiceWorkerRegistration()

			// Should still be the original function
			expect(navigator.serviceWorker.register).toBe(originalRegister)
		})

		it("should provide mock getRegistration that returns undefined", async () => {
			// Mock VS Code webview environment
			;(global as any).acquireVsCodeApi = vi.fn()

			disableServiceWorkerRegistration()

			const registration = await navigator.serviceWorker.getRegistration()
			expect(registration).toBeUndefined()
		})

		it("should provide mock getRegistrations that returns empty array", async () => {
			// Mock VS Code webview environment
			;(global as any).acquireVsCodeApi = vi.fn()

			disableServiceWorkerRegistration()

			const registrations = await navigator.serviceWorker.getRegistrations()
			expect(registrations).toEqual([])
		})

		it("should handle missing navigator.serviceWorker gracefully", () => {
			// Mock VS Code webview environment
			;(global as any).acquireVsCodeApi = vi.fn()

			// Remove serviceWorker from navigator
			vi.stubGlobal("navigator", {})

			// Should not throw
			expect(() => disableServiceWorkerRegistration()).not.toThrow()
		})
	})

	describe("initServiceWorkerPrevention", () => {
		it("should initialize without throwing errors", () => {
			// Mock VS Code webview environment
			;(global as any).acquireVsCodeApi = vi.fn()

			expect(() => initServiceWorkerPrevention()).not.toThrow()
		})

		it("should not throw even if prevention fails", () => {
			// Mock VS Code webview environment
			;(global as any).acquireVsCodeApi = vi.fn()

			// Mock console.error
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Create a scenario where defineProperty might fail
			// by stubbing a read-only navigator
			const readOnlyNavigator = {
				get serviceWorker() {
					throw new Error("Cannot access serviceWorker")
				},
			}
			vi.stubGlobal("navigator", readOnlyNavigator)

			// Should not throw even if there's an error
			expect(() => initServiceWorkerPrevention()).not.toThrow()

			consoleErrorSpy.mockRestore()
		})

		it("should successfully prevent ServiceWorker registration when called", async () => {
			// Mock VS Code webview environment
			;(global as any).acquireVsCodeApi = vi.fn()

			// Mock console.warn to check for warning message
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			initServiceWorkerPrevention()

			// Try to register a service worker
			await expect(navigator.serviceWorker.register("/sw.js")).rejects.toThrow()

			// Should have logged a warning
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"ServiceWorker registration blocked in VS Code webview environment",
			)

			consoleWarnSpy.mockRestore()
		})
	})
})
