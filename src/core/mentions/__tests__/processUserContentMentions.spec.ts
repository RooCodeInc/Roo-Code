// npx vitest core/mentions/__tests__/processUserContentMentions.spec.ts

import { processUserContentMentions } from "../processUserContentMentions"
import { parseMentions } from "../index"
import { UrlContentFetcher } from "../../../services/browser/UrlContentFetcher"
import { FileContextTracker } from "../../context-tracking/FileContextTracker"

// Mock the parseMentions function
vi.mock("../index", () => ({
	parseMentions: vi.fn(),
}))

describe("processUserContentMentions", () => {
	let mockUrlContentFetcher: UrlContentFetcher
	let mockFileContextTracker: FileContextTracker
	let mockRooIgnoreController: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockUrlContentFetcher = {} as UrlContentFetcher
		mockFileContextTracker = {} as FileContextTracker
		mockRooIgnoreController = {}

		// Default mock implementation
		vi.mocked(parseMentions).mockImplementation(async (text) => `parsed: ${text}`)
	})

	describe("maxReadFileLine parameter", () => {
		it("should pass maxReadFileLine to parseMentions when provided", async () => {
			const userContent = [
				{
					type: "text" as const,
					text: "<feedback>Read file with limit</feedback>",
				},
			]

			await processUserContentMentions({
				userContent,
				cwd: "/test",
				urlContentFetcher: mockUrlContentFetcher,
				fileContextTracker: mockFileContextTracker,
				rooIgnoreController: mockRooIgnoreController,
				maxReadFileLine: 100,
			})

			expect(parseMentions).toHaveBeenCalledWith(
				"<feedback>Read file with limit</feedback>",
				"/test",
				mockUrlContentFetcher,
				mockFileContextTracker,
				mockRooIgnoreController,
				false,
				true, // includeDiagnosticMessages
				50, // maxDiagnosticMessages
				100,
			)
		})

		it("should pass undefined maxReadFileLine when not provided", async () => {
			const userContent = [
				{
					type: "text" as const,
					text: "<feedback>Read file without limit</feedback>",
				},
			]

			await processUserContentMentions({
				userContent,
				cwd: "/test",
				urlContentFetcher: mockUrlContentFetcher,
				fileContextTracker: mockFileContextTracker,
				rooIgnoreController: mockRooIgnoreController,
			})

			expect(parseMentions).toHaveBeenCalledWith(
				"<feedback>Read file without limit</feedback>",
				"/test",
				mockUrlContentFetcher,
				mockFileContextTracker,
				mockRooIgnoreController,
				false,
				true, // includeDiagnosticMessages
				50, // maxDiagnosticMessages
				undefined,
			)
		})

		it("should handle UNLIMITED_LINES constant correctly", async () => {
			const userContent = [
				{
					type: "text" as const,
					text: "<feedback>Read unlimited lines</feedback>",
				},
			]

			await processUserContentMentions({
				userContent,
				cwd: "/test",
				urlContentFetcher: mockUrlContentFetcher,
				fileContextTracker: mockFileContextTracker,
				rooIgnoreController: mockRooIgnoreController,
				maxReadFileLine: -1,
			})

			expect(parseMentions).toHaveBeenCalledWith(
				"<feedback>Read unlimited lines</feedback>",
				"/test",
				mockUrlContentFetcher,
				mockFileContextTracker,
				mockRooIgnoreController,
				false,
				true, // includeDiagnosticMessages
				50, // maxDiagnosticMessages
				-1,
			)
		})
	})

	describe("content processing", () => {
		it("should process text blocks with <feedback> tags", async () => {
			const userContent = [
				{
					type: "text" as const,
					text: "<feedback>Do something</feedback>",
				},
			]

			const result = await processUserContentMentions({
				userContent,
				cwd: "/test",
				urlContentFetcher: mockUrlContentFetcher,
				fileContextTracker: mockFileContextTracker,
			})

			expect(parseMentions).toHaveBeenCalled()
			expect(result[0]).toEqual({
				type: "text",
				text: "parsed: <feedback>Do something</feedback>",
			})
		})

		it("should process text blocks with <feedback> tags", async () => {
			const userContent = [
				{
					type: "text" as const,
					text: "<feedback>Fix this issue</feedback>",
				},
			]

			const result = await processUserContentMentions({
				userContent,
				cwd: "/test",
				urlContentFetcher: mockUrlContentFetcher,
				fileContextTracker: mockFileContextTracker,
			})

			expect(parseMentions).toHaveBeenCalled()
			expect(result[0]).toEqual({
				type: "text",
				text: "parsed: <feedback>Fix this issue</feedback>",
			})
		})

		it("should not process text blocks without task or feedback tags", async () => {
			const userContent = [
				{
					type: "text" as const,
					text: "Regular text without special tags",
				},
			]

			const result = await processUserContentMentions({
				userContent,
				cwd: "/test",
				urlContentFetcher: mockUrlContentFetcher,
				fileContextTracker: mockFileContextTracker,
			})

			expect(parseMentions).not.toHaveBeenCalled()
			expect(result[0]).toEqual(userContent[0])
		})

		it("should process tool_result blocks with string content", async () => {
			const userContent = [
				{
					type: "tool_result" as const,
					tool_use_id: "123",
					content: "<feedback>Tool feedback</feedback>",
				},
			]

			const result = await processUserContentMentions({
				userContent,
				cwd: "/test",
				urlContentFetcher: mockUrlContentFetcher,
				fileContextTracker: mockFileContextTracker,
			})

			expect(parseMentions).toHaveBeenCalled()
			expect(result[0]).toEqual({
				type: "tool_result",
				tool_use_id: "123",
				content: "parsed: <feedback>Tool feedback</feedback>",
			})
		})

		it("should process tool_result blocks with array content", async () => {
			const userContent = [
				{
					type: "tool_result" as const,
					tool_use_id: "123",
					content: [
						{
							type: "text" as const,
							text: "<feedback>Array task</feedback>",
						},
						{
							type: "text" as const,
							text: "Regular text",
						},
					],
				},
			]

			const result = await processUserContentMentions({
				userContent,
				cwd: "/test",
				urlContentFetcher: mockUrlContentFetcher,
				fileContextTracker: mockFileContextTracker,
			})

			expect(parseMentions).toHaveBeenCalledTimes(1)
			expect(result[0]).toEqual({
				type: "tool_result",
				tool_use_id: "123",
				content: [
					{
						type: "text",
						text: "parsed: <feedback>Array task</feedback>",
					},
					{
						type: "text",
						text: "Regular text",
					},
				],
			})
		})

		it("should handle mixed content types", async () => {
			const userContent = [
				{
					type: "text" as const,
					text: "<feedback>First task</feedback>",
				},
				{
					type: "image" as const,
					source: {
						type: "base64" as const,
						media_type: "image/png" as const,
						data: "base64data",
					},
				},
				{
					type: "tool_result" as const,
					tool_use_id: "456",
					content: "<feedback>Feedback</feedback>",
				},
			]

			const result = await processUserContentMentions({
				userContent,
				cwd: "/test",
				urlContentFetcher: mockUrlContentFetcher,
				fileContextTracker: mockFileContextTracker,
				maxReadFileLine: 50,
			})

			expect(parseMentions).toHaveBeenCalledTimes(2)
			expect(result).toHaveLength(3)
			expect(result[0]).toEqual({
				type: "text",
				text: "parsed: <feedback>First task</feedback>",
			})
			expect(result[1]).toEqual(userContent[1]) // Image block unchanged
			expect(result[2]).toEqual({
				type: "tool_result",
				tool_use_id: "456",
				content: "parsed: <feedback>Feedback</feedback>",
			})
		})
	})

	describe("showRooIgnoredFiles parameter", () => {
		it("should default showRooIgnoredFiles to false", async () => {
			const userContent = [
				{
					type: "text" as const,
					text: "<feedback>Test default</feedback>",
				},
			]

			await processUserContentMentions({
				userContent,
				cwd: "/test",
				urlContentFetcher: mockUrlContentFetcher,
				fileContextTracker: mockFileContextTracker,
			})

			expect(parseMentions).toHaveBeenCalledWith(
				"<feedback>Test default</feedback>",
				"/test",
				mockUrlContentFetcher,
				mockFileContextTracker,
				undefined,
				false, // showRooIgnoredFiles should default to false
				true, // includeDiagnosticMessages
				50, // maxDiagnosticMessages
				undefined,
			)
		})

		it("should respect showRooIgnoredFiles when explicitly set to false", async () => {
			const userContent = [
				{
					type: "text" as const,
					text: "<feedback>Test explicit false</feedback>",
				},
			]

			await processUserContentMentions({
				userContent,
				cwd: "/test",
				urlContentFetcher: mockUrlContentFetcher,
				fileContextTracker: mockFileContextTracker,
				showRooIgnoredFiles: false,
			})

			expect(parseMentions).toHaveBeenCalledWith(
				"<feedback>Test explicit false</feedback>",
				"/test",
				mockUrlContentFetcher,
				mockFileContextTracker,
				undefined,
				false,
				true, // includeDiagnosticMessages
				50, // maxDiagnosticMessages
				undefined,
			)
		})
	})
})
