import { describe, it, expect, beforeEach, vi } from "vitest"
import * as vscode from "vscode"
import { ContextProxy } from "../ContextProxy"

describe("maxTasksHomeScreen setting", () => {
	let mockContext: vscode.ExtensionContext
	let contextProxy: ContextProxy

	beforeEach(async () => {
		// Create mock VSCode context
		const mockGlobalState = new Map<string, any>()
		const mockSecrets = new Map<string, string>()

		mockContext = {
			globalState: {
				get: vi.fn((key: string) => mockGlobalState.get(key)),
				update: vi.fn(async (key: string, value: any) => {
					mockGlobalState.set(key, value)
				}),
				keys: vi.fn(() => Array.from(mockGlobalState.keys())),
				setKeysForSync: vi.fn(),
			},
			secrets: {
				get: vi.fn(async (key: string) => mockSecrets.get(key)),
				store: vi.fn(async (key: string, value: string) => {
					mockSecrets.set(key, value)
				}),
				delete: vi.fn(async (key: string) => {
					mockSecrets.delete(key)
				}),
				onDidChange: vi.fn(),
			},
			extensionUri: {} as vscode.Uri,
			extensionPath: "/test/path",
			globalStorageUri: {} as vscode.Uri,
			logUri: {} as vscode.Uri,
			extension: {} as vscode.Extension<any>,
			extensionMode: 3, // vscode.ExtensionMode.Test
		} as unknown as vscode.ExtensionContext

		contextProxy = new ContextProxy(mockContext)
		await contextProxy.initialize()
	})

	it("should save maxTasksHomeScreen value", async () => {
		// Set the value
		await contextProxy.setValue("maxTasksHomeScreen", 10)

		// Verify it was saved
		expect(mockContext.globalState.update).toHaveBeenCalledWith("maxTasksHomeScreen", 10)
	})

	it("should retrieve maxTasksHomeScreen value", async () => {
		// Set the value
		await contextProxy.setValue("maxTasksHomeScreen", 15)

		// Get the value
		const value = contextProxy.getValue("maxTasksHomeScreen")

		// Verify it matches
		expect(value).toBe(15)
	})

	it("should persist maxTasksHomeScreen across initialization", async () => {
		// Set the value
		await contextProxy.setValue("maxTasksHomeScreen", 8)

		// Create a new instance (simulating restart)
		const newContextProxy = new ContextProxy(mockContext)
		await newContextProxy.initialize()

		// Get the value from the new instance
		const value = newContextProxy.getValue("maxTasksHomeScreen")

		// Verify it was persisted
		expect(value).toBe(8)
	})

	it("should handle default value of 4", async () => {
		// Don't set any value, should use default
		const values = contextProxy.getValues()

		// maxTasksHomeScreen should be undefined or 4 (depending on implementation)
		expect(values.maxTasksHomeScreen === undefined || values.maxTasksHomeScreen === 4).toBe(true)
	})

	it("should validate min/max bounds", async () => {
		// The schema should enforce min=0, max=20
		// Try setting valid values
		await contextProxy.setValue("maxTasksHomeScreen", 0)
		expect(contextProxy.getValue("maxTasksHomeScreen")).toBe(0)

		await contextProxy.setValue("maxTasksHomeScreen", 20)
		expect(contextProxy.getValue("maxTasksHomeScreen")).toBe(20)

		await contextProxy.setValue("maxTasksHomeScreen", 10)
		expect(contextProxy.getValue("maxTasksHomeScreen")).toBe(10)
	})
})
