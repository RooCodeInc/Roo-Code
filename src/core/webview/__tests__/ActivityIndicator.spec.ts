import { ActivityIndicator } from "../ActivityIndicator"
import * as vscode from "vscode"

// Mock vscode.window.withProgress
const mockWithProgress = vi.fn()
vi.mock("vscode", () => ({
	window: {
		withProgress: (...args: any[]) => mockWithProgress(...args),
	},
}))

describe("ActivityIndicator", () => {
	let indicator: ActivityIndicator

	beforeEach(() => {
		vi.clearAllMocks()
		indicator = new ActivityIndicator()
	})

	afterEach(() => {
		indicator.dispose()
	})

	describe("show", () => {
		it("should call withProgress when shown", () => {
			indicator.show()

			expect(mockWithProgress).toHaveBeenCalledTimes(1)
			expect(mockWithProgress).toHaveBeenCalledWith(
				expect.objectContaining({
					location: expect.objectContaining({
						viewId: expect.stringContaining("SidebarProvider"),
					}),
				}),
				expect.any(Function),
			)
		})

		it("should only call withProgress once when shown multiple times", () => {
			indicator.show()
			indicator.show()
			indicator.show()

			expect(mockWithProgress).toHaveBeenCalledTimes(1)
		})

		it("should set isActive to true", () => {
			expect(indicator.isActive()).toBe(false)
			indicator.show()
			expect(indicator.isActive()).toBe(true)
		})
	})

	describe("hide", () => {
		it("should resolve the progress promise when hidden", () => {
			let capturedResolve: (() => void) | null = null

			mockWithProgress.mockImplementation((_options: any, task: (progress: any) => Promise<void>) => {
				return task({}).then(() => {
					// Promise resolved
				})
			})

			// We need to capture the resolve function
			mockWithProgress.mockImplementation((_options: any, task: () => Promise<void>) => {
				const promise = task()
				// The promise is created inside the task function
				return promise
			})

			indicator.show()
			indicator.hide()

			expect(indicator.isActive()).toBe(false)
		})

		it("should be a no-op when not active", () => {
			// Calling hide when not active should not throw
			expect(() => indicator.hide()).not.toThrow()
			expect(indicator.isActive()).toBe(false)
		})

		it("should set isActive to false", () => {
			indicator.show()
			expect(indicator.isActive()).toBe(true)

			indicator.hide()
			expect(indicator.isActive()).toBe(false)
		})

		it("should allow showing again after hiding", () => {
			indicator.show()
			expect(mockWithProgress).toHaveBeenCalledTimes(1)

			indicator.hide()
			expect(indicator.isActive()).toBe(false)

			indicator.show()
			expect(mockWithProgress).toHaveBeenCalledTimes(2)
		})
	})

	describe("isActive", () => {
		it("should return false initially", () => {
			expect(indicator.isActive()).toBe(false)
		})

		it("should return true after show", () => {
			indicator.show()
			expect(indicator.isActive()).toBe(true)
		})

		it("should return false after hide", () => {
			indicator.show()
			indicator.hide()
			expect(indicator.isActive()).toBe(false)
		})
	})

	describe("dispose", () => {
		it("should hide the indicator when disposed", () => {
			indicator.show()
			expect(indicator.isActive()).toBe(true)

			indicator.dispose()
			expect(indicator.isActive()).toBe(false)
		})

		it("should be safe to call multiple times", () => {
			indicator.show()
			indicator.dispose()
			expect(() => indicator.dispose()).not.toThrow()
		})
	})
})
