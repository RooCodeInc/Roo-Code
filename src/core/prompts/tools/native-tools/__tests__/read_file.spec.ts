// npx vitest run core/prompts/tools/native-tools/__tests__/read_file.spec.ts

import { describe, it, expect } from "vitest"
import type OpenAI from "openai"
import { createReadFileTool } from "../read_file"

describe("createReadFileTool", () => {
	// Helper to extract function definition from tool
	const getFunctionDef = (tool: OpenAI.Chat.ChatCompletionTool) => {
		if (tool.type !== "function") {
			throw new Error("Expected function tool type")
		}
		return tool.function
	}

	describe("supportsImages parameter", () => {
		it("should include image format documentation when supportsImages is true", () => {
			const tool = createReadFileTool(true, true)
			const fn = getFunctionDef(tool)

			expect(fn.description).toContain(
				"Automatically processes and returns image files (PNG, JPG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF) for visual analysis",
			)
		})

		it("should not include image format documentation when supportsImages is false", () => {
			const tool = createReadFileTool(true, false)
			const fn = getFunctionDef(tool)

			expect(fn.description).not.toContain(
				"Automatically processes and returns image files (PNG, JPG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF) for visual analysis",
			)
			expect(fn.description).toContain("may not handle other binary files properly")
		})

		it("should default supportsImages to false", () => {
			const tool = createReadFileTool(true)
			const fn = getFunctionDef(tool)

			expect(fn.description).not.toContain(
				"Automatically processes and returns image files (PNG, JPG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF) for visual analysis",
			)
		})
	})

	describe("partialReadsEnabled parameter", () => {
		it("should include line_ranges in description when partialReadsEnabled is true", () => {
			const tool = createReadFileTool(true, false)
			const fn = getFunctionDef(tool)

			expect(fn.description).toContain("line_ranges")
		})

		it("should not include line_ranges in description when partialReadsEnabled is false", () => {
			const tool = createReadFileTool(false, false)
			const fn = getFunctionDef(tool)

			// The description mentions line_ranges only as examples when enabled
			expect(fn.description).not.toContain("line_ranges")
		})

		it("should include line_ranges in schema when partialReadsEnabled is true", () => {
			const tool = createReadFileTool(true, false)
			const fn = getFunctionDef(tool)
			const properties = (fn.parameters as any).properties.files.items.properties

			expect(properties).toHaveProperty("line_ranges")
		})

		it("should not include line_ranges in schema when partialReadsEnabled is false", () => {
			const tool = createReadFileTool(false, false)
			const fn = getFunctionDef(tool)
			const properties = (fn.parameters as any).properties.files.items.properties

			expect(properties).not.toHaveProperty("line_ranges")
		})
	})

	describe("combined parameters", () => {
		it("should correctly combine partialReadsEnabled and supportsImages", () => {
			const tool = createReadFileTool(true, true)
			const fn = getFunctionDef(tool)

			// Should have both line_ranges and image support
			expect(fn.description).toContain("line_ranges")
			expect(fn.description).toContain(
				"Automatically processes and returns image files (PNG, JPG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF) for visual analysis",
			)
		})

		it("should work with partialReadsEnabled=false and supportsImages=true", () => {
			const tool = createReadFileTool(false, true)
			const fn = getFunctionDef(tool)

			// Should have image support but no line_ranges
			expect(fn.description).not.toContain("line_ranges")
			expect(fn.description).toContain(
				"Automatically processes and returns image files (PNG, JPG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF) for visual analysis",
			)
		})
	})

	describe("tool structure", () => {
		it("should have correct tool name", () => {
			const tool = createReadFileTool()
			const fn = getFunctionDef(tool)

			expect(fn.name).toBe("read_file")
		})

		it("should have strict mode enabled", () => {
			const tool = createReadFileTool()
			const fn = getFunctionDef(tool)

			expect(fn.strict).toBe(true)
		})

		it("should have files as required parameter", () => {
			const tool = createReadFileTool()
			const fn = getFunctionDef(tool)

			expect((fn.parameters as any).required).toContain("files")
		})

		it("should always include PDF and DOCX support in description", () => {
			const toolWithImages = createReadFileTool(true, true)
			const toolWithoutImages = createReadFileTool(true, false)
			const fnWithImages = getFunctionDef(toolWithImages)
			const fnWithoutImages = getFunctionDef(toolWithoutImages)

			expect(fnWithImages.description).toContain("Supports text extraction from PDF and DOCX files")
			expect(fnWithoutImages.description).toContain("Supports text extraction from PDF and DOCX files")
		})
	})
})
