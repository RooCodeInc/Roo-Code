import { preprocessMessages } from "../preprocessor"

// Minimal ApiMessage mock shape matching Anthropic.MessageParam
interface MockMessage {
	role: "user" | "assistant"
	content: unknown
}

const makeUserMsg = (text: string): MockMessage => ({
	role: "user" as const,
	content: [{ type: "text", text }],
})

const makeAssistantMsg = (content: Record<string, unknown>[]): MockMessage => ({
	role: "assistant" as const,
	content,
})

describe("preprocessMessages", () => {
	it("should keep user message text fully", () => {
		const result = preprocessMessages([makeUserMsg("I prefer TypeScript")])
		expect(result.cleaned).toContain("I prefer TypeScript")
	})

	it("should keep assistant text blocks", () => {
		const msg = makeAssistantMsg([
			{ type: "text", text: "I'll update the auth component." },
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("I'll update the auth component.")
	})

	it("should replace read_file tool_use with filename only", () => {
		const msg = makeAssistantMsg([
			{ type: "text", text: "Let me check that file." },
			{ type: "tool_use", id: "1", name: "read_file", input: { path: "src/auth/Auth.tsx" } },
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("→ read: src/auth/Auth.tsx")
		expect(result.cleaned).not.toContain("tool_use")
	})

	it("should replace execute_command with command only", () => {
		const msg = makeAssistantMsg([
			{ type: "tool_use", id: "2", name: "execute_command", input: { command: "npm test" } },
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("→ ran command: npm test")
	})

	it("should strip tool_result blocks entirely", () => {
		const msg = makeAssistantMsg([
			{ type: "tool_result", tool_use_id: "1", content: "200 lines of code..." },
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).not.toContain("200 lines of code")
	})

	it("should strip base64 image data from user messages", () => {
		const msg: MockMessage = {
			role: "user" as const,
			content: [
				{ type: "image", source: { type: "base64", data: "abc123longdata..." } },
				{ type: "text", text: "What does this show?" },
			],
		}
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("[image attached]")
		expect(result.cleaned).toContain("What does this show?")
		expect(result.cleaned).not.toContain("abc123longdata")
	})

	it("should strip code blocks longer than 3 lines from assistant messages", () => {
		const msg = makeAssistantMsg([
			{
				type: "text",
				text: "Here's the code:\n```typescript\nline1\nline2\nline3\nline4\n```\nDone.",
			},
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("Here's the code:")
		expect(result.cleaned).toContain("Done.")
		expect(result.cleaned).not.toContain("line4")
	})

	it("should keep short code blocks (≤3 lines)", () => {
		const msg = makeAssistantMsg([
			{ type: "text", text: "Try: ```const x = 1``` like that." },
		])
		const result = preprocessMessages([msg])
		expect(result.cleaned).toContain("const x = 1")
	})

	it("should return token estimates", () => {
		const result = preprocessMessages([
			makeUserMsg("hello"),
			makeAssistantMsg([{ type: "text", text: "hi there" }]),
		])
		expect(result.originalTokenEstimate).toBeGreaterThan(0)
		expect(result.cleanedTokenEstimate).toBeGreaterThan(0)
		expect(result.cleanedTokenEstimate).toBeLessThanOrEqual(result.originalTokenEstimate)
	})

	it("should handle empty message array", () => {
		const result = preprocessMessages([])
		expect(result.cleaned).toBe("")
		expect(result.cleanedTokenEstimate).toBe(0)
	})
})
