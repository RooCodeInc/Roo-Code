import type OpenAI from "openai"
import { createReadFileTool, type CreateReadFileToolOptions } from "../read_file"

// Helper type to access function tools
type FunctionTool = OpenAI.Chat.ChatCompletionTool & { type: "function" }

// Helper to get function definition from tool
const getFunctionDef = (tool: OpenAI.Chat.ChatCompletionTool) => (tool as FunctionTool).function

describe("createReadFileTool", () => {
	describe("maxConcurrentFileReads documentation", () => {
		it("should include default maxConcurrentFileReads limit (5) in description", () => {
			const tool = createReadFileTool()
			const description = getFunctionDef(tool).description

			expect(description).toContain("maximum of 5 files")
			expect(description).toContain("If you need to read more files, use multiple sequential read_file requests")
		})

		it("should include custom maxConcurrentFileReads limit in description", () => {
			const tool = createReadFileTool({ maxConcurrentFileReads: 3 })
			const description = getFunctionDef(tool).description

			expect(description).toContain("maximum of 3 files")
			expect(description).toContain("within 3-file limit")
		})

		it("should indicate single file reads only when maxConcurrentFileReads is 1", () => {
			const tool = createReadFileTool({ maxConcurrentFileReads: 1 })
			const description = getFunctionDef(tool).description

			expect(description).toContain("Multiple file reads are currently disabled")
			expect(description).toContain("only read one file at a time")
			expect(description).not.toContain("Example multiple files")
		})

		it("should use singular 'Read a file' in base description when maxConcurrentFileReads is 1", () => {
			const tool = createReadFileTool({ maxConcurrentFileReads: 1 })
			const description = getFunctionDef(tool).description

			expect(description).toMatch(/^Read a file/)
			expect(description).not.toContain("Read one or more files")
		})

		it("should use plural 'Read one or more files' in base description when maxConcurrentFileReads is > 1", () => {
			const tool = createReadFileTool({ maxConcurrentFileReads: 5 })
			const description = getFunctionDef(tool).description

			expect(description).toMatch(/^Read one or more files/)
		})

		it("should not show multiple files example when maxConcurrentFileReads is 1", () => {
			const tool = createReadFileTool({ maxConcurrentFileReads: 1, partialReadsEnabled: true })
			const description = getFunctionDef(tool).description

			expect(description).not.toContain("Example multiple files")
		})

		it("should show multiple files example when maxConcurrentFileReads is > 1", () => {
			const tool = createReadFileTool({ maxConcurrentFileReads: 5, partialReadsEnabled: true })
			const description = getFunctionDef(tool).description

			expect(description).toContain("Example multiple files")
		})
	})

	describe("partialReadsEnabled option", () => {
		it("should include offset and mode in description when partialReadsEnabled is true", () => {
			const tool = createReadFileTool({ partialReadsEnabled: true })
			const description = getFunctionDef(tool).description

			expect(description).toContain("offset")
			expect(description).toContain("mode")
			expect(description).toContain("slice")
			expect(description).toContain("indentation")
		})

		it("should not include offset and mode in description when partialReadsEnabled is false", () => {
			const tool = createReadFileTool({ partialReadsEnabled: false })
			const description = getFunctionDef(tool).description

			expect(description).not.toContain("offset")
			expect(description).not.toContain("'slice'")
			expect(description).not.toContain("'indentation'")
		})

		it("should include offset, mode, and indentation parameters in schema when partialReadsEnabled is true", () => {
			const tool = createReadFileTool({ partialReadsEnabled: true })
			const schema = getFunctionDef(tool).parameters as any

			expect(schema.properties.files.items.properties).toHaveProperty("offset")
			expect(schema.properties.files.items.properties).toHaveProperty("mode")
			expect(schema.properties.files.items.properties).toHaveProperty("indentation")
		})

		it("should not include offset, mode, and indentation parameters in schema when partialReadsEnabled is false", () => {
			const tool = createReadFileTool({ partialReadsEnabled: false })
			const schema = getFunctionDef(tool).parameters as any

			expect(schema.properties.files.items.properties).not.toHaveProperty("offset")
			expect(schema.properties.files.items.properties).not.toHaveProperty("mode")
			expect(schema.properties.files.items.properties).not.toHaveProperty("indentation")
		})
	})

	describe("supportsImages option", () => {
		it("should include image format documentation when supportsImages is true", () => {
			const tool = createReadFileTool({ supportsImages: true })
			const description = getFunctionDef(tool).description

			expect(description).toContain(
				"Automatically processes and returns image files (PNG, JPG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF) for visual analysis",
			)
		})

		it("should not include image format documentation when supportsImages is false", () => {
			const tool = createReadFileTool({ supportsImages: false })
			const description = getFunctionDef(tool).description

			expect(description).not.toContain(
				"Automatically processes and returns image files (PNG, JPG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF) for visual analysis",
			)
			expect(description).toContain("may not handle other binary files properly")
		})

		it("should default supportsImages to false", () => {
			const tool = createReadFileTool({})
			const description = getFunctionDef(tool).description

			expect(description).not.toContain(
				"Automatically processes and returns image files (PNG, JPG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF) for visual analysis",
			)
		})

		it("should always include PDF and DOCX support in description", () => {
			const toolWithImages = createReadFileTool({ supportsImages: true })
			const toolWithoutImages = createReadFileTool({ supportsImages: false })

			expect(getFunctionDef(toolWithImages).description).toContain(
				"Supports text extraction from PDF and DOCX files",
			)
			expect(getFunctionDef(toolWithoutImages).description).toContain(
				"Supports text extraction from PDF and DOCX files",
			)
		})
	})

	describe("combined options", () => {
		it("should correctly combine low maxConcurrentFileReads with partialReadsEnabled", () => {
			const tool = createReadFileTool({
				maxConcurrentFileReads: 2,
				partialReadsEnabled: true,
			})
			const description = getFunctionDef(tool).description

			expect(description).toContain("maximum of 2 files")
			expect(description).toContain("offset")
			expect(description).toContain("within 2-file limit")
		})

		it("should correctly handle maxConcurrentFileReads of 1 with partialReadsEnabled false", () => {
			const tool = createReadFileTool({
				maxConcurrentFileReads: 1,
				partialReadsEnabled: false,
			})
			const description = getFunctionDef(tool).description

			expect(description).toContain("only read one file at a time")
			expect(description).not.toContain("offset")
			expect(description).not.toContain("Example multiple files")
		})

		it("should correctly combine partialReadsEnabled and supportsImages", () => {
			const tool = createReadFileTool({
				partialReadsEnabled: true,
				supportsImages: true,
			})
			const description = getFunctionDef(tool).description

			// Should have both offset/mode and image support
			expect(description).toContain("offset")
			expect(description).toContain("mode")
			expect(description).toContain(
				"Automatically processes and returns image files (PNG, JPG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF) for visual analysis",
			)
		})

		it("should work with partialReadsEnabled=false and supportsImages=true", () => {
			const tool = createReadFileTool({
				partialReadsEnabled: false,
				supportsImages: true,
			})
			const description = getFunctionDef(tool).description

			// Should have image support but no offset/mode
			expect(description).not.toContain("offset")
			expect(description).toContain(
				"Automatically processes and returns image files (PNG, JPG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF) for visual analysis",
			)
		})

		it("should correctly combine all three options", () => {
			const tool = createReadFileTool({
				maxConcurrentFileReads: 3,
				partialReadsEnabled: true,
				supportsImages: true,
			})
			const description = getFunctionDef(tool).description

			expect(description).toContain("maximum of 3 files")
			expect(description).toContain("offset")
			expect(description).toContain(
				"Automatically processes and returns image files (PNG, JPG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF) for visual analysis",
			)
		})
	})

	describe("tool structure", () => {
		it("should have correct tool name", () => {
			const tool = createReadFileTool()

			expect(getFunctionDef(tool).name).toBe("read_file")
		})

		it("should be a function type tool", () => {
			const tool = createReadFileTool()

			expect(tool.type).toBe("function")
		})

		it("should have strict mode disabled when partialReadsEnabled is true (default)", () => {
			// When partialReadsEnabled is true, strict is false to allow optional parameters
			const tool = createReadFileTool()

			expect(getFunctionDef(tool).strict).toBe(false)
		})

		it("should have strict mode enabled when partialReadsEnabled is false", () => {
			const tool = createReadFileTool({ partialReadsEnabled: false })

			expect(getFunctionDef(tool).strict).toBe(true)
		})

		it("should require files parameter", () => {
			const tool = createReadFileTool()
			const schema = getFunctionDef(tool).parameters as any

			expect(schema.required).toContain("files")
		})

		it("should require path in file objects", () => {
			const tool = createReadFileTool({ partialReadsEnabled: false })
			const schema = getFunctionDef(tool).parameters as any

			expect(schema.properties.files.items.required).toContain("path")
		})
	})

	describe("maxReadFileLine option", () => {
		it("should include line limit in description when maxReadFileLine is set", () => {
			const tool = createReadFileTool({ maxReadFileLine: 2000 })
			const description = getFunctionDef(tool).description

			expect(description).toContain("up to 2000 lines")
		})

		it("should include line limit in offset description when partialReadsEnabled is true", () => {
			const tool = createReadFileTool({ partialReadsEnabled: true, maxReadFileLine: 1000 })
			const schema = getFunctionDef(tool).parameters as any

			expect(schema.properties.files.items.properties.offset.description).toContain("1000 lines")
		})

		it("should not include line limit info when maxReadFileLine is not set", () => {
			const tool = createReadFileTool({ partialReadsEnabled: true })
			const description = getFunctionDef(tool).description

			expect(description).not.toContain("returns up to")
		})
	})
})
