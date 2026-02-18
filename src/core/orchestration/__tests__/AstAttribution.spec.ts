import { describe, expect, it, vi, beforeEach } from "vitest"

const parseFileMock = vi.fn()

vi.mock("../../../services/code-index/processors/parser", () => ({
	CodeParser: vi.fn().mockImplementation(() => ({
		parseFile: parseFileMock,
	})),
}))

import { collectAstAttributionForRange } from "../AstAttribution"

describe("collectAstAttributionForRange", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns AST node metadata when parse results overlap modified range", async () => {
		parseFileMock.mockResolvedValue([
			{
				identifier: "runHook",
				type: "function_declaration",
				start_line: 10,
				end_line: 24,
				segmentHash: "seg-1",
			},
			{
				identifier: "otherSymbol",
				type: "class_declaration",
				start_line: 40,
				end_line: 80,
				segmentHash: "seg-2",
			},
		])

		const result = await collectAstAttributionForRange("C:/repo/src/file.ts", "content", {
			start_line: 8,
			end_line: 30,
		})

		expect(result.status).toBe("ok")
		expect(result.nodes).toEqual([
			{
				identifier: "runHook",
				type: "function_declaration",
				start_line: 10,
				end_line: 24,
				segment_hash: "seg-1",
			},
		])
	})

	it("returns fallback when parser errors", async () => {
		parseFileMock.mockRejectedValue(new Error("tree-sitter failed"))

		const result = await collectAstAttributionForRange("C:/repo/src/file.ts", "content", {
			start_line: 1,
			end_line: 5,
		})

		expect(result).toEqual({
			status: "fallback",
			nodes: [],
		})
	})
})
