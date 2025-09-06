import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { RepositoryContextManager, RepositoryContextConfig } from "../RepositoryContextManager"
import { RooIgnoreController } from "../../ignore/RooIgnoreController"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	RelativePattern: vi.fn((base, pattern) => ({ base, pattern })),
}))

// Mock glob module
vi.mock("glob", () => ({
	glob: vi.fn().mockResolvedValue(["file1.ts", "file2.js", "dir/file3.py"]),
}))

// Mock fs/promises
vi.mock("fs/promises", () => ({
	stat: vi.fn().mockResolvedValue({
		isDirectory: () => false,
		mtimeMs: Date.now(),
		size: 1000,
	}),
	readFile: vi.fn().mockResolvedValue("file content"),
}))

describe("RepositoryContextManager", () => {
	let manager: RepositoryContextManager
	let mockRooIgnoreController: RooIgnoreController
	const testCwd = "/test/project"

	beforeEach(() => {
		// Create mock RooIgnoreController
		mockRooIgnoreController = {
			filterPaths: vi.fn((paths) => paths),
			validateAccess: vi.fn(() => true),
			dispose: vi.fn(),
		} as any

		// Reset all mocks
		vi.clearAllMocks()
	})

	afterEach(() => {
		if (manager) {
			manager.dispose()
		}
	})

	describe("initialization", () => {
		it("should not initialize when disabled", async () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: false,
			}

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			await manager.initialize()

			expect(manager.getContext()).toBeNull()
		})

		it("should initialize and build context when enabled", async () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: true,
				maxFiles: 100,
				includeFileContent: false,
			}

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			await manager.initialize()

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 100))

			const context = manager.getContext()
			expect(context).not.toBeNull()
			expect(context?.files.size).toBeGreaterThan(0)
			expect(context?.lastUpdated).toBeDefined()
			expect(context?.projectStructure).toBeDefined()
		})

		it("should set up file watcher when enabled", async () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: true,
				updateInterval: 0, // Disable periodic updates for testing
			}

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			await manager.initialize()

			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled()
		})
	})

	describe("context building", () => {
		it("should respect maxFiles limit", async () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: true,
				maxFiles: 2,
				includeFileContent: false,
			}

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			await manager.initialize()

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 100))

			const context = manager.getContext()
			expect(context?.files.size).toBeLessThanOrEqual(2)
		})

		it("should include file content when configured", async () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: true,
				maxFiles: 10,
				includeFileContent: true,
				maxFileSize: 10000,
			}

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			await manager.initialize()

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 100))

			const context = manager.getContext()
			const firstFile = context?.files.values().next().value
			expect(firstFile?.content).toBeDefined()
			expect(firstFile?.hash).toBeDefined()
		})

		it("should apply rooignore filtering", async () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: true,
				maxFiles: 100,
			}

			// Mock rooIgnoreController to filter out some files
			mockRooIgnoreController.filterPaths = vi.fn((paths) => paths.slice(0, 2))

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			await manager.initialize()

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 100))

			expect(mockRooIgnoreController.filterPaths).toHaveBeenCalled()
			const context = manager.getContext()
			expect(context?.files.size).toBe(2)
		})
	})

	describe("formatForEnvironment", () => {
		it("should format context for environment details", async () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: true,
				maxFiles: 10,
				includeFileContent: true,
			}

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			await manager.initialize()

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 100))

			const formatted = manager.formatForEnvironment()
			expect(formatted).toContain("# Repository Context")
			expect(formatted).toContain("Last Updated:")
			expect(formatted).toContain("Total Files:")
			expect(formatted).toContain("## Project Structure")
		})

		it("should return empty string when context is null", () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: false,
			}

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			const formatted = manager.formatForEnvironment()
			expect(formatted).toBe("")
		})

		it("should include file contents when configured", async () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: true,
				maxFiles: 10,
				includeFileContent: true,
			}

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			await manager.initialize()

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 100))

			const formatted = manager.formatForEnvironment()
			expect(formatted).toContain("## File Contents")
		})
	})

	describe("disposal", () => {
		it("should clean up resources on dispose", async () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: true,
				updateInterval: 1000,
			}

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			await manager.initialize()

			const fileWatcherDispose = vi.fn()
			const mockWatcher = {
				onDidCreate: vi.fn(),
				onDidChange: vi.fn(),
				onDidDelete: vi.fn(),
				dispose: fileWatcherDispose,
			}
			;(vscode.workspace.createFileSystemWatcher as any).mockReturnValue(mockWatcher)

			manager.dispose()

			expect(manager.getContext()).toBeNull()
		})
	})

	describe("code pattern extraction", () => {
		it("should extract import patterns from code", async () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: true,
				includeFileContent: true,
				smartSelection: true,
			}

			// Mock file content with imports
			const glob = await import("glob")
			const fs = await import("fs/promises")
			vi.mocked(glob.glob).mockResolvedValueOnce(["file1.ts"])
			vi.mocked(fs.readFile).mockResolvedValueOnce(`
import React from 'react'
import { useState } from 'react'
const Component = () => {}
`)

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			await manager.initialize()

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 200))

			const context = manager.getContext()
			expect(context?.codePatterns).toBeDefined()
			expect(context?.codePatterns instanceof Map).toBe(true)

			// Debug: log what patterns were extracted
			console.log("Extracted patterns:", Array.from(context?.codePatterns.keys() || []))

			// The regex captures 'react' from the import statement
			// Check if any pattern contains 'react'
			const hasReactImport = Array.from(context?.codePatterns.keys() || []).some((key) => key.includes("react"))
			expect(hasReactImport).toBe(true)
		})

		it("should identify relevant files based on patterns", async () => {
			const config: Partial<RepositoryContextConfig> = {
				enabled: true,
				includeFileContent: true,
				smartSelection: true,
			}

			manager = new RepositoryContextManager(testCwd, config, mockRooIgnoreController)
			await manager.initialize()

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 100))

			const context = manager.getContext()
			expect(context?.relevantFiles).toBeDefined()
			expect(Array.isArray(context?.relevantFiles)).toBe(true)
		})
	})
})
