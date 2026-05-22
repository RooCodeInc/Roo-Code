import { describe, expect, it } from "vitest"
import { extractAlertType, ALERT_TYPES } from "../remarkGithubAlerts"

describe("remarkGithubAlerts", () => {
	describe("extractAlertType", () => {
		it("returns null for empty node", () => {
			expect(extractAlertType({ type: "blockquote", children: [] })).toBeNull()
		})

		it("returns null for node without children", () => {
			expect(extractAlertType({ type: "blockquote" })).toBeNull()
		})

		it("returns null for node without paragraph children", () => {
			expect(
				extractAlertType({
					type: "blockquote",
					children: [{ type: "code", value: "[!NOTE]" }],
				}),
			).toBeNull()
		})

		it("returns null for paragraph without children", () => {
			expect(
				extractAlertType({
					type: "blockquote",
					children: [{ type: "paragraph" }],
				}),
			).toBeNull()
		})

		it("returns null for paragraph with empty children array", () => {
			expect(
				extractAlertType({
					type: "blockquote",
					children: [{ type: "paragraph", children: [] }],
				}),
			).toBeNull()
		})

		it("returns null for paragraph where first child is not text", () => {
			expect(
				extractAlertType({
					type: "blockquote",
					children: [{ type: "paragraph", children: [{ type: "emphasis" }] }],
				}),
			).toBeNull()
		})

		it("returns null for text that does not match alert pattern", () => {
			expect(
				extractAlertType({
					type: "blockquote",
					children: [{ type: "paragraph", children: [{ type: "text", value: "Just a normal quote" }] }],
				}),
			).toBeNull()
		})

		it("returns null for unsupported alert types", () => {
			expect(
				extractAlertType({
					type: "blockquote",
					children: [{ type: "paragraph", children: [{ type: "text", value: "[!DANGER] watch out" }] }],
				}),
			).toBeNull()
		})

		it("returns null for marker not at start of text", () => {
			expect(
				extractAlertType({
					type: "blockquote",
					children: [
						{ type: "paragraph", children: [{ type: "text", value: "Some text [!NOTE] more text" }] },
					],
				}),
			).toBeNull()
		})

		for (const alertType of ALERT_TYPES) {
			it(`detects [!${alertType}] alert type`, () => {
				const node = {
					type: "blockquote",
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: `[!${alertType}] Some content` }],
						},
					],
				}
				expect(extractAlertType(node)).toBe(alertType)
			})
		}

		it("is case-insensitive for alert markers", () => {
			const node = {
				type: "blockquote",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "[!note] Some content" }],
					},
				],
			}
			expect(extractAlertType(node)).toBe("NOTE")
		})

		it("removes the marker text and leaves remaining content", () => {
			const node = {
				type: "blockquote",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "[!NOTE] Some content here" }],
					},
				],
			}
			extractAlertType(node)
			expect(node.children[0].children![0].value).toBe("Some content here")
		})

		it("handles marker as only text node with more paragraph children", () => {
			const node = {
				type: "blockquote",
				children: [
					{
						type: "paragraph",
						children: [
							{ type: "text", value: "[!WARNING]" },
							{ type: "text", value: "More text" },
						],
					},
				],
			}
			extractAlertType(node)
			// First text node (the marker) should be removed
			expect(node.children[0].children!.length).toBe(1)
			expect(node.children[0].children![0].value).toBe("More text")
		})

		it("removes break node after marker", () => {
			const node = {
				type: "blockquote",
				children: [
					{
						type: "paragraph",
						children: [
							{ type: "text", value: "[!TIP]" },
							{ type: "break" },
							{ type: "text", value: "Content after break" },
						],
					},
				],
			}
			extractAlertType(node)
			expect(node.children[0].children!.length).toBe(1)
			expect(node.children[0].children![0].value).toBe("Content after break")
		})

		it("handles marker as only content in the only paragraph with more blockquote children", () => {
			const node = {
				type: "blockquote",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "[!IMPORTANT]" }],
					},
					{
						type: "paragraph",
						children: [{ type: "text", value: "Second paragraph" }],
					},
				],
			}
			extractAlertType(node)
			// The first paragraph with just the marker should be removed
			expect(node.children.length).toBe(1)
			expect(node.children[0].children![0].value).toBe("Second paragraph")
		})

		it("handles marker as only content in single paragraph", () => {
			const node = {
				type: "blockquote",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "[!CAUTION]" }],
					},
				],
			}
			const result = extractAlertType(node)
			expect(result).toBe("CAUTION")
			// Text should be emptied
			expect(node.children[0].children![0].value).toBe("")
		})

		it("handles marker with trailing whitespace only", () => {
			const node = {
				type: "blockquote",
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "[!NOTE] " }],
					},
				],
			}
			// The trailing space is part of the pattern match, so the remaining text is empty
			// which means the marker was the entire content
			const result = extractAlertType(node)
			expect(result).toBe("NOTE")
		})
	})
})
