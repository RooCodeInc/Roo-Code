import { describe, expect, it } from "vitest"

import { countSearchMatches, getChatSearchText } from "../chatSearchText"

describe("chatSearchText", () => {
	it("excludes readFile tool request text from search", () => {
		const text = getChatSearchText({
			type: "ask",
			ask: "tool",
			text: JSON.stringify({
				tool: "readFile",
				path: "assignment3.md",
				reason: "inspect tiny image notes",
				content: "tiny nearest bag",
			}),
		})

		expect(text).toBe("")
		expect(countSearchMatches(text, "tiny")).toBe(0)
	})

	it("excludes batched readFile tool content from search", () => {
		const text = getChatSearchText({
			type: "ask",
			ask: "tool",
			text: JSON.stringify({
				tool: "readFile",
				batchFiles: [
					{
						path: "assignment3.md",
						content: "tiny nearest bag",
					},
				],
			}),
		})

		expect(text).toBe("")
		expect(countSearchMatches(text, "nearest")).toBe(0)
	})

	it("excludes reasoning messages from search", () => {
		const text = getChatSearchText({
			type: "say",
			say: "reasoning",
			text: "Reasoning mentions tiny, nearest, and bag but should not be searchable.",
		})

		expect(text).toBe("")
		expect(countSearchMatches(text, "tiny")).toBe(0)
		expect(countSearchMatches(text, "nearest")).toBe(0)
		expect(countSearchMatches(text, "bag")).toBe(0)
	})

	it("searches inline markdown link labels but excludes link targets", () => {
		const text = getChatSearchText({
			type: "say",
			say: "text",
			text: [
				"All code is in [`student_code_SID.py`](Assignment3_code/mycode/student_code_SID.py).",
				"| # | Function | Points | Notes |",
				"| 1 | [`get_tiny_images()`](Assignment3_code/mycode/student_code_SID.py:16) | 20 | normalize tiny image features |",
			].join("\n"),
		})

		expect(countSearchMatches(text, "student_code")).toBe(1)
		expect(countSearchMatches(text, "get_tiny_images")).toBe(1)
		expect(countSearchMatches(text, "Assignment3_code")).toBe(0)
		expect(countSearchMatches(text, "student_code_SID.py:16")).toBe(0)
		expect(countSearchMatches(text, "tiny image")).toBe(1)
	})

	it("searches reference-style markdown link labels but excludes definitions", () => {
		const text = getChatSearchText({
			type: "say",
			say: "text",
			text: "Open [`helper.py`][helper] before nearest neighbor.\n\n[helper]: Assignment3_code/helper.py",
		})

		expect(countSearchMatches(text, "helper.py")).toBe(1)
		expect(countSearchMatches(text, "Assignment3_code")).toBe(0)
		expect(countSearchMatches(text, "nearest")).toBe(1)
	})
})
