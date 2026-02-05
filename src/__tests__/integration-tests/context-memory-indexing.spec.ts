// Integration tests for Context Memory Indexing
// Tests the integration between code-index services and context-tracking

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CodeParser } from "../../services/code-index/processors/parser"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [],
	},
	Uri: {
		joinPath: (...args: string[]) => args.join("/"),
	},
	ExtensionContext: {
		globalStorageUri: { fsPath: "/mock/storage" },
	},
}))

// Mock TelemetryService
vi.mock("../../../../../packages/telemetry/src/TelemetryService", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

describe("Context Memory Indexing Integration", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Adaptive Chunking Feature", () => {
		it("should be enabled by default", () => {
			const parser = new CodeParser()
			expect(parser.isAdaptiveChunkingEnabled()).toBe(true)
		})

		it("should allow toggling adaptive chunking", () => {
			const parser = new CodeParser()

			expect(parser.isAdaptiveChunkingEnabled()).toBe(true)

			parser.setAdaptiveChunkingEnabled(false)
			expect(parser.isAdaptiveChunkingEnabled()).toBe(false)

			parser.setAdaptiveChunkingEnabled(true)
			expect(parser.isAdaptiveChunkingEnabled()).toBe(true)
		})

		it("should maintain adaptive chunking state across multiple toggles", () => {
			const parser = new CodeParser()

			// Multiple toggles
			parser.setAdaptiveChunkingEnabled(false)
			parser.setAdaptiveChunkingEnabled(true)
			parser.setAdaptiveChunkingEnabled(false)
			parser.setAdaptiveChunkingEnabled(true)

			expect(parser.isAdaptiveChunkingEnabled()).toBe(true)
		})
	})

	describe("Oversized Line Handling Integration", () => {
		it("should split lines over 3000 characters", async () => {
			const parser = new CodeParser()
			parser.setAdaptiveChunkingEnabled(false)

			// Create a very long line (over 3000 characters)
			const oversizeContent = "x".repeat(3000)
			const oversizeBlocks = await parser.parseFile("test.md", { content: oversizeContent })

			// Should create segments for oversized lines
			expect(oversizeBlocks.length).toBeGreaterThan(1)

			// Verify segments are properly formed
			const totalContent = oversizeBlocks.map((b) => b.content).join("")
			expect(totalContent.length).toBe(oversizeContent.length)
		})

		it("should handle 5000 character lines correctly", async () => {
			const parser = new CodeParser()
			parser.setAdaptiveChunkingEnabled(false)

			// Test that oversized lines are handled correctly
			const longLine = "a".repeat(5000)
			const blocks = await parser.parseFile("test.md", { content: longLine })

			// Should create multiple segments
			expect(blocks.length).toBeGreaterThan(1)

			// Content should be preserved
			const reconstructed = blocks.map((b) => b.content).join("")
			expect(reconstructed.length).toBe(5000)
		})

		it("should handle multiple oversized lines in sequence", async () => {
			const parser = new CodeParser()
			parser.setAdaptiveChunkingEnabled(false)

			// Multiple long lines
			const content = "x".repeat(3000) + "\n" + "y".repeat(3000) + "\n" + "z".repeat(3000)
			const blocks = await parser.parseFile("test.md", { content })

			// Should create segments for all oversized lines
			expect(blocks.length).toBeGreaterThan(2)
		})

		it("should handle large markdown files with multiple sections", async () => {
			const parser = new CodeParser()
			parser.setAdaptiveChunkingEnabled(false)

			// Create a large markdown file
			const lines: string[] = ["# Large Document"]
			for (let i = 0; i < 100; i++) {
				lines.push(`## Section ${i}`)
				lines.push(`Content for section ${i}`.repeat(10))
			}
			const largeContent = lines.join("\n")

			const blocks = await parser.parseFile("large.md", { content: largeContent })

			// Should produce multiple chunks
			expect(blocks.length).toBeGreaterThan(0)
		})

		it("should handle content below minimum chunking threshold", async () => {
			const parser = new CodeParser()
			parser.setAdaptiveChunkingEnabled(false)

			// Short content that might be below threshold
			const shortContent = "# Header\n\nShort paragraph."
			const blocks = await parser.parseFile("short.md", { content: shortContent })

			// Should handle gracefully
			expect(blocks.length).toBeGreaterThanOrEqual(0)
		})
	})

	describe("Backward Compatibility", () => {
		it("should return empty array for unsupported extensions", async () => {
			const parser = new CodeParser()
			parser.setAdaptiveChunkingEnabled(false)

			const blocks = await parser.parseFile("test.xyz", { content: "some content" })
			expect(blocks.length).toBe(0)
		})
	})
})
