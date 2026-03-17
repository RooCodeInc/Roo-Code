import { parseStdinStreamCommand, shouldSendMessageAsAskResponse } from "../stdin-stream.js"

describe("parseStdinStreamCommand", () => {
	describe("valid commands", () => {
		it("parses a start command", () => {
			const result = parseStdinStreamCommand(
				JSON.stringify({ command: "start", requestId: "req-1", prompt: "hello" }),
				1,
			)
			expect(result).toEqual({ command: "start", requestId: "req-1", prompt: "hello" })
		})

		it("parses a start command with taskId", () => {
			const result = parseStdinStreamCommand(
				JSON.stringify({
					command: "start",
					requestId: "req-task-id",
					prompt: "hello",
					taskId: "018f7fc8-7c96-7f7c-98aa-2ec4ff7f6d87",
				}),
				1,
			)
			expect(result).toEqual({
				command: "start",
				requestId: "req-task-id",
				prompt: "hello",
				taskId: "018f7fc8-7c96-7f7c-98aa-2ec4ff7f6d87",
			})
		})

		it("parses a message command", () => {
			const result = parseStdinStreamCommand(
				JSON.stringify({ command: "message", requestId: "req-2", prompt: "follow up" }),
				1,
			)
			expect(result).toEqual({ command: "message", requestId: "req-2", prompt: "follow up" })
		})

		it("parses start and message images", () => {
			const start = parseStdinStreamCommand(
				JSON.stringify({
					command: "start",
					requestId: "req-img-start",
					prompt: "hello",
					images: ["data:image/jpeg;base64,abc123"],
				}),
				1,
			)
			expect(start).toEqual({
				command: "start",
				requestId: "req-img-start",
				prompt: "hello",
				images: ["data:image/jpeg;base64,abc123"],
			})

			const message = parseStdinStreamCommand(
				JSON.stringify({
					command: "message",
					requestId: "req-img-msg",
					prompt: "follow up",
					images: ["data:image/png;base64,xyz456"],
				}),
				1,
			)
			expect(message).toEqual({
				command: "message",
				requestId: "req-img-msg",
				prompt: "follow up",
				images: ["data:image/png;base64,xyz456"],
			})
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

		it("throws when start taskId is empty, not a string, or not a UUID", () => {
			expect(() =>
				parseStdinStreamCommand(
					JSON.stringify({
						command: "start",
						requestId: "req-start-task-id-empty",
						prompt: "hello",
						taskId: "   ",
					}),
					1,
				),
			).toThrow('"start" taskId must be a non-empty string')

			expect(() =>
				parseStdinStreamCommand(
					JSON.stringify({
						command: "start",
						requestId: "req-start-task-id-num",
						prompt: "hello",
						taskId: 123,
					}),
					1,
				),
			).toThrow('"start" taskId must be a non-empty string')

			expect(() =>
				parseStdinStreamCommand(
					JSON.stringify({
						command: "start",
						requestId: "req-start-task-id-invalid-format",
						prompt: "hello",
						taskId: "task-123",
					}),
					1,
				),
			).toThrow('"start" taskId must be a valid UUID')
		})

		it("throws when message command has empty prompt", () => {
			expect(() =>
				parseStdinStreamCommand(JSON.stringify({ command: "message", requestId: "req", prompt: "  " }), 1),
			).toThrow('"message" requires non-empty string "prompt"')
		})

		it("throws when start or message images are not string arrays", () => {
			expect(() =>
				parseStdinStreamCommand(
					JSON.stringify({
						command: "start",
						requestId: "req-start-img",
						prompt: "hello",
						images: "not-an-array",
					}),
					1,
				),
			).toThrow('"start" images must be an array of strings')

			expect(() =>
				parseStdinStreamCommand(
					JSON.stringify({
						command: "message",
						requestId: "req-msg-img",
						prompt: "follow up",
						images: ["ok", 123],
					}),
					1,
				),
			).toThrow('"message" images must be an array of strings')
		})
	})
})

describe("shouldSendMessageAsAskResponse", () => {
	it("routes completion_result asks as ask responses", () => {
		expect(shouldSendMessageAsAskResponse(true, "completion_result")).toBe(true)
	})

	it.each([
		"followup",
		"tool",
		"command",
		"use_mcp_server",
		"resume_task",
		"resume_completed_task",
		"mistake_limit_reached",
	])("routes %s asks as ask responses", (ask) => {
		expect(shouldSendMessageAsAskResponse(true, ask)).toBe(true)
	})

	it("does not route when not waiting for input", () => {
		expect(shouldSendMessageAsAskResponse(false, "completion_result")).toBe(false)
	})

	it("does not route unknown asks", () => {
		expect(shouldSendMessageAsAskResponse(true, "unknown")).toBe(false)
		expect(shouldSendMessageAsAskResponse(true, undefined)).toBe(false)
	})
})
