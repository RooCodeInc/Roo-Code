import { parseStdinStreamCommand } from "../stdin-stream.js"

describe("parseStdinStreamCommand", () => {
	describe("valid commands", () => {
		it("parses a start command", () => {
			const result = parseStdinStreamCommand(
				JSON.stringify({ command: "start", requestId: "req-1", prompt: "hello" }),
				1,
			)
			expect(result).toEqual({ command: "start", requestId: "req-1", prompt: "hello" })
		})

		it("parses a message command", () => {
			const result = parseStdinStreamCommand(
				JSON.stringify({ command: "message", requestId: "req-2", prompt: "follow up" }),
				1,
			)
			expect(result).toEqual({ command: "message", requestId: "req-2", prompt: "follow up" })
		})

		it.each(["cancel", "ping", "shutdown"] as const)("parses a %s command (no prompt required)", (command) => {
			const result = parseStdinStreamCommand(JSON.stringify({ command, requestId: "req-3" }), 1)
			expect(result).toEqual({ command, requestId: "req-3" })
		})

		it("trims whitespace from requestId", () => {
			const result = parseStdinStreamCommand(JSON.stringify({ command: "ping", requestId: "  req-4  " }), 1)
			expect(result.requestId).toBe("req-4")
		})

		it("ignores extra fields", () => {
			const result = parseStdinStreamCommand(
				JSON.stringify({ command: "ping", requestId: "req-5", extra: "ignored", nested: { a: 1 } }),
				1,
			)
			expect(result).toEqual({ command: "ping", requestId: "req-5" })
		})
	})

	describe("invalid input", () => {
		it("throws on invalid JSON", () => {
			expect(() => parseStdinStreamCommand("not json", 3)).toThrow("stdin command line 3: invalid JSON")
		})

		it("throws on non-object JSON (string)", () => {
			expect(() => parseStdinStreamCommand('"hello"', 1)).toThrow("expected JSON object")
		})

		it("throws on non-object JSON (array)", () => {
			// Arrays pass isRecord (typeof [] === "object") but lack a command field
			expect(() => parseStdinStreamCommand("[]", 1)).toThrow('missing string "command"')
		})

		it("throws on non-object JSON (number)", () => {
			expect(() => parseStdinStreamCommand("42", 1)).toThrow("expected JSON object")
		})

		it("throws on null", () => {
			expect(() => parseStdinStreamCommand("null", 1)).toThrow("expected JSON object")
		})

		it("throws when command field is missing", () => {
			expect(() => parseStdinStreamCommand(JSON.stringify({ requestId: "req" }), 5)).toThrow(
				'stdin command line 5: missing string "command"',
			)
		})

		it("throws when command is not a string", () => {
			expect(() => parseStdinStreamCommand(JSON.stringify({ command: 123, requestId: "req" }), 1)).toThrow(
				'missing string "command"',
			)
		})

		it("throws on unsupported command name", () => {
			expect(() => parseStdinStreamCommand(JSON.stringify({ command: "unknown", requestId: "req" }), 2)).toThrow(
				'stdin command line 2: unsupported command "unknown"',
			)
		})

		it("throws when requestId is missing", () => {
			expect(() => parseStdinStreamCommand(JSON.stringify({ command: "ping" }), 1)).toThrow(
				'missing non-empty string "requestId"',
			)
		})

		it("throws when requestId is empty", () => {
			expect(() => parseStdinStreamCommand(JSON.stringify({ command: "ping", requestId: "   " }), 1)).toThrow(
				'missing non-empty string "requestId"',
			)
		})

		it("throws when start command has no prompt", () => {
			expect(() => parseStdinStreamCommand(JSON.stringify({ command: "start", requestId: "req" }), 1)).toThrow(
				'"start" requires non-empty string "prompt"',
			)
		})

		it("throws when message command has empty prompt", () => {
			expect(() =>
				parseStdinStreamCommand(JSON.stringify({ command: "message", requestId: "req", prompt: "  " }), 1),
			).toThrow('"message" requires non-empty string "prompt"')
		})
	})
})
