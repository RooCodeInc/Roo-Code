import { describe, it, expect, beforeEach, vi } from "vitest"
import { FcoTextDocumentContentProvider } from "../FcoTextDocumentContentProvider"

// Mock VS Code API
vi.mock("vscode", () => ({
	workspace: {
		onDidCloseTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
	},
	window: {
		tabGroups: {
			all: [],
		},
	},
	Uri: {
		parse: vi.fn((str: string) => ({
			scheme: str.split(":")[0],
			path: str.split(":")[1] || "",
			toString: () => str,
		})),
	},
}))

describe("FcoTextDocumentContentProvider", () => {
	let provider: FcoTextDocumentContentProvider

	beforeEach(() => {
		// Reset singleton instance
		;(FcoTextDocumentContentProvider as any).instance = undefined
		provider = FcoTextDocumentContentProvider.getInstance()
		provider.clearAll()
		vi.clearAllMocks()
	})

	describe("Core Functionality", () => {
		it("stores and retrieves diff content", () => {
			const beforeContent = "line 1\nline 2"
			const afterContent = "line 1\nline 2 modified"

			const { beforeUri, afterUri } = provider.storeDiffContent(beforeContent, afterContent, "test/file.ts")

			expect(beforeUri).toMatch(/^fco-diff:before-/)
			expect(afterUri).toMatch(/^fco-diff:after-/)
			expect(provider.getStoredContentCount()).toBe(2)
		})

		it("creates different URIs for different file paths", () => {
			const content1 = "same content"
			const content2 = "same content"

			const result1 = provider.storeDiffContent(content1, content2, "file1.ts")
			const result2 = provider.storeDiffContent(content1, content2, "file2.ts")

			// URIs should be different because file paths are different (hash includes file path)
			expect(result1.beforeUri).not.toBe(result2.beforeUri)
			expect(result1.afterUri).not.toBe(result2.afterUri)
			expect(provider.getStoredContentCount()).toBe(4) // Each file gets its own content
		})

		it("provides correct content for URI", () => {
			const beforeContent = "original"
			const afterContent = "modified"

			const { beforeUri } = provider.storeDiffContent(beforeContent, afterContent)
			const uri = { path: beforeUri.replace("fco-diff:", "") } as any

			expect(provider.provideTextDocumentContent(uri)).toBe(beforeContent)
		})

		it("tracks file path to URI mapping", () => {
			const { beforeUri, afterUri } = provider.storeDiffContent("before", "after", "test/file.ts")

			const mapping = provider.getUrisForFile("test/file.ts")
			expect(mapping).toEqual({ beforeUri, afterUri })
		})
	})

	describe("Cleanup & Memory Management", () => {
		it("cleanupFile removes content and mapping", () => {
			const { beforeUri, afterUri } = provider.storeDiffContent("before", "after", "test/file.ts")

			expect(provider.getStoredContentCount()).toBe(2)
			expect(provider.getUrisForFile("test/file.ts")).toBeDefined()

			provider.cleanupFile("test/file.ts")

			expect(provider.getStoredContentCount()).toBe(0)
			expect(provider.getUrisForFile("test/file.ts")).toBeUndefined()
		})

		it("cleanup removes specific URIs", () => {
			const { beforeUri, afterUri } = provider.storeDiffContent("a", "b")
			const { beforeUri: beforeUri2 } = provider.storeDiffContent("c", "d")

			expect(provider.getStoredContentCount()).toBe(4)

			provider.cleanup([beforeUri])

			expect(provider.getStoredContentCount()).toBe(3)
		})

		it("handles multiple files without memory accumulation", () => {
			const fileCount = 10

			// Create multiple diff sessions
			for (let i = 0; i < fileCount; i++) {
				provider.storeDiffContent(`before ${i}`, `after ${i}`, `file${i}.ts`)
			}

			expect(provider.getStoredContentCount()).toBe(fileCount * 2)

			// Clean up individual files
			for (let i = 0; i < fileCount; i++) {
				provider.cleanupFile(`file${i}.ts`)
			}

			// All content should be cleaned up
			expect(provider.getStoredContentCount()).toBe(0)
		})

		it("clearAll removes everything", () => {
			provider.storeDiffContent("a", "b", "file1.ts")
			provider.storeDiffContent("c", "d", "file2.ts")

			expect(provider.getStoredContentCount()).toBe(4)
			expect(provider.getUrisForFile("file1.ts")).toBeDefined()

			provider.clearAll()

			expect(provider.getStoredContentCount()).toBe(0)
			expect(provider.getUrisForFile("file1.ts")).toBeUndefined()
		})
	})

	describe("Integration", () => {
		it("registerCloseListener returns disposable and registers with VS Code", async () => {
			const vscode = await import("vscode")
			const disposable = provider.registerCloseListener()

			expect(disposable).toEqual({ dispose: expect.any(Function) })
			expect(vscode.workspace.onDidCloseTextDocument).toHaveBeenCalledWith(expect.any(Function))
		})

		it("singleton pattern works correctly", () => {
			const instance1 = FcoTextDocumentContentProvider.getInstance()
			const instance2 = FcoTextDocumentContentProvider.getInstance()

			expect(instance1).toBe(instance2)
		})
	})

	describe("Edge Cases", () => {
		it("handles cleanup of non-existent content gracefully", () => {
			expect(() => provider.cleanupFile("nonexistent.ts")).not.toThrow()
			expect(() => provider.cleanup(["fco-diff:nonexistent"])).not.toThrow()
		})

		it("handles storeDiffContent without file path", () => {
			const result = provider.storeDiffContent("before", "after")

			expect(result.beforeUri).toMatch(/^fco-diff:before-/)
			expect(result.afterUri).toMatch(/^fco-diff:after-/)
			expect(provider.getStoredContentCount()).toBe(2)
		})

		it("returns empty string for non-existent URI", () => {
			const uri = { path: "non-existent-key" } as any
			expect(provider.provideTextDocumentContent(uri)).toBe("")
		})

		it("returns undefined for unmapped file", () => {
			const mapping = provider.getUrisForFile("nonexistent.ts")
			expect(mapping).toBeUndefined()
		})
	})
})
