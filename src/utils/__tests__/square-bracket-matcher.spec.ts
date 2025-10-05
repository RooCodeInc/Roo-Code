import { SquareBracketMatcher } from "../square-bracket-matcher"

describe("SquareBracketMatcher", () => {
	it("matches square bracket tags at position 0", () => {
		const matcher = new SquareBracketMatcher("THINK")
		const chunks = [...matcher.update("[THINK]data[/THINK]"), ...matcher.final()]
		expect(chunks).toEqual([
			{
				data: "data",
				matched: true,
			},
		])
	})

	it("handles uppercase tag names", () => {
		const matcher = new SquareBracketMatcher("THINK")
		const chunks = [...matcher.update("[THINK]reasoning content[/THINK]"), ...matcher.final()]
		expect(chunks).toEqual([
			{
				data: "reasoning content",
				matched: true,
			},
		])
	})

	it("handles lowercase tag names", () => {
		const matcher = new SquareBracketMatcher("think")
		const chunks = [...matcher.update("[think]reasoning content[/think]"), ...matcher.final()]
		expect(chunks).toEqual([
			{
				data: "reasoning content",
				matched: true,
			},
		])
	})

	it("handles mixed content", () => {
		const matcher = new SquareBracketMatcher("THINK")
		const chunks = [...matcher.update("Before [THINK]reasoning[/THINK] After"), ...matcher.final()]
		expect(chunks).toEqual([
			{
				data: "Before ",
				matched: false,
			},
			{
				data: "reasoning",
				matched: true,
			},
			{
				data: " After",
				matched: false,
			},
		])
	})

	it("handles streaming push", () => {
		const matcher = new SquareBracketMatcher("THINK")
		const chunks = [
			...matcher.update("["),
			...matcher.update("THINK"),
			...matcher.update("]"),
			...matcher.update("reasoning"),
			...matcher.update(" content"),
			...matcher.update("[/"),
			...matcher.update("THINK"),
			...matcher.update("]"),
			...matcher.final(),
		]
		expect(chunks).toEqual([
			{
				data: "reasoning content",
				matched: true,
			},
		])
	})

	it("handles nested tags", () => {
		const matcher = new SquareBracketMatcher("THINK")
		const chunks = [...matcher.update("[THINK]X[THINK]Y[/THINK]Z[/THINK]"), ...matcher.final()]
		expect(chunks).toEqual([
			{
				data: "X[THINK]Y[/THINK]Z",
				matched: true,
			},
		])
	})

	it("handles invalid tag format", () => {
		const matcher = new SquareBracketMatcher("THINK")
		const chunks = [...matcher.update("[INVALID]data[/INVALID]"), ...matcher.final()]
		expect(chunks).toEqual([
			{
				data: "[INVALID]data[/INVALID]",
				matched: false,
			},
		])
	})

	it("handles unclosed tags", () => {
		const matcher = new SquareBracketMatcher("THINK")
		const chunks = [...matcher.update("[THINK]data"), ...matcher.final()]
		expect(chunks).toEqual([
			{
				data: "data",
				matched: true,
			},
		])
	})

	it("handles wrong matching position", () => {
		const matcher = new SquareBracketMatcher("THINK")
		const chunks = [...matcher.update("prefix[THINK]data[/THINK]"), ...matcher.final()]
		expect(chunks).toEqual([
			{
				data: "prefix",
				matched: false,
			},
			{
				data: "data",
				matched: true,
			},
		])
	})

	it("handles multiple sequential tags", () => {
		const matcher = new SquareBracketMatcher("THINK")
		const chunks = [...matcher.update("[THINK]first[/THINK] middle [THINK]second[/THINK]"), ...matcher.final()]
		expect(chunks).toEqual([
			{
				data: "first",
				matched: true,
			},
			{
				data: " middle ",
				matched: false,
			},
			{
				data: "second",
				matched: true,
			},
		])
	})

	it("transforms output when transform function is provided", () => {
		const matcher = new SquareBracketMatcher("THINK", (chunk) => ({
			type: chunk.matched ? "reasoning" : "text",
			text: chunk.data,
		}))
		const chunks = [...matcher.update("Before [THINK]reasoning[/THINK] After"), ...matcher.final()]
		expect(chunks).toEqual([
			{
				type: "text",
				text: "Before ",
			},
			{
				type: "reasoning",
				text: "reasoning",
			},
			{
				type: "text",
				text: " After",
			},
		])
	})

	it("handles Magistral-style reasoning blocks", () => {
		const matcher = new SquareBracketMatcher("THINK")
		const input = `Let me analyze this problem.

[THINK]
I need to understand what the user is asking for.
They want to fix an issue with Magistral model's reasoning tags.
The tags use square brackets instead of angle brackets.
[/THINK]

Based on my analysis, here's the solution...`

		const chunks = [...matcher.update(input), ...matcher.final()]
		expect(chunks).toEqual([
			{
				data: "Let me analyze this problem.\n\n",
				matched: false,
			},
			{
				data: "\nI need to understand what the user is asking for.\nThey want to fix an issue with Magistral model's reasoning tags.\nThe tags use square brackets instead of angle brackets.\n",
				matched: true,
			},
			{
				data: "\n\nBased on my analysis, here's the solution...",
				matched: false,
			},
		])
	})
})
