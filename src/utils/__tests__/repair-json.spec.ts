/**
 * Tests for the JSON repair utility.
 * @see Issue #10481 - Use of BAML for parsing llm output to correct malformed responses
 */

import { repairJson, repairToolCallJson } from "../repair-json"

describe("repair-json", () => {
	describe("repairJson", () => {
		describe("valid JSON", () => {
			it("should return original JSON without modification for valid input", () => {
				const validJson = '{"key": "value", "number": 42}'
				const result = repairJson(validJson)

				expect(result.repaired).toBe(false)
				expect(result.json).toBe(validJson)
				expect(result.parsed).toEqual({ key: "value", number: 42 })
				expect(result.error).toBeUndefined()
			})

			it("should handle valid arrays", () => {
				const validArray = '[1, 2, 3, "test"]'
				const result = repairJson(validArray)

				expect(result.repaired).toBe(false)
				expect(result.parsed).toEqual([1, 2, 3, "test"])
			})

			it("should handle empty objects and arrays", () => {
				expect(repairJson("{}").parsed).toEqual({})
				expect(repairJson("[]").parsed).toEqual([])
			})

			it("should handle nested structures", () => {
				const nested = '{"outer": {"inner": [1, 2, {"deep": true}]}}'
				const result = repairJson(nested)

				expect(result.repaired).toBe(false)
				expect(result.parsed).toEqual({
					outer: { inner: [1, 2, { deep: true }] },
				})
			})
		})

		describe("trailing commas", () => {
			it("should remove trailing comma in object", () => {
				const input = '{"key": "value",}'
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ key: "value" })
			})

			it("should remove trailing comma in array", () => {
				const input = "[1, 2, 3,]"
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual([1, 2, 3])
			})

			it("should remove multiple trailing commas", () => {
				const input = '{"a": [1, 2,], "b": 3,}'
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ a: [1, 2], b: 3 })
			})
		})

		describe("single quotes", () => {
			it("should convert single quotes to double quotes", () => {
				const input = "{'key': 'value'}"
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ key: "value" })
			})

			it("should handle mixed quotes", () => {
				const input = "{\"key\": 'value'}"
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ key: "value" })
			})

			it("should escape double quotes inside single-quoted strings", () => {
				const input = "{'key': 'value with \"quotes\"'}"
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ key: 'value with "quotes"' })
			})
		})

		describe("unquoted keys", () => {
			it("should quote unquoted keys", () => {
				const input = '{key: "value"}'
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ key: "value" })
			})

			it("should handle multiple unquoted keys", () => {
				const input = "{first: 1, second: 2, third: 3}"
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ first: 1, second: 2, third: 3 })
			})

			it("should handle keys with underscores and dollar signs", () => {
				const input = "{_private: 1, $special: 2}"
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ _private: 1, $special: 2 })
			})
		})

		describe("missing closing brackets", () => {
			it("should add missing closing brace", () => {
				const input = '{"key": "value"'
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ key: "value" })
			})

			it("should add missing closing bracket", () => {
				const input = "[1, 2, 3"
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual([1, 2, 3])
			})

			it("should add multiple missing closures", () => {
				const input = '{"outer": {"inner": [1, 2'
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ outer: { inner: [1, 2] } })
			})
		})

		describe("prefixed text", () => {
			it("should strip non-JSON prefix", () => {
				const input = 'Here is the JSON: {"key": "value"}'
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ key: "value" })
			})

			it("should handle whitespace prefix", () => {
				const input = '   {"key": "value"}'
				const result = repairJson(input)

				expect(result.repaired).toBe(false) // Just whitespace doesn't count as repair
				expect(result.parsed).toEqual({ key: "value" })
			})
		})

		describe("string issues", () => {
			it("should handle unescaped newlines in strings", () => {
				const input = '{"key": "line1\nline2"}'
				const result = repairJson(input)

				// The newline should be escaped
				expect(result.parsed?.key).toBe("line1\nline2")
			})
		})

		describe("combined repairs", () => {
			it("should handle multiple issues at once", () => {
				const input = "{key: 'value', items: [1, 2,],}"
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({ key: "value", items: [1, 2] })
			})

			it("should handle complex malformed input", () => {
				// More realistic malformed JSON with multiple issues but recoverable
				const input = "{name: 'test', data: {count: 10, values: [1, 2, 3,]},}"
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({
					name: "test",
					data: { count: 10, values: [1, 2, 3] },
				})
			})
		})

		describe("error handling", () => {
			it("should return error for completely invalid input", () => {
				const input = "this is not json at all"
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.error).toBeDefined()
				expect(result.parsed).toBeUndefined()
			})

			it("should return error for severely malformed JSON", () => {
				const input = "{{{{{{{"
				const result = repairJson(input)

				expect(result.repaired).toBe(true)
				expect(result.error).toBeDefined()
			})
		})
	})

	describe("repairToolCallJson", () => {
		it("should handle empty input", () => {
			const result = repairToolCallJson("")
			expect(result.repaired).toBe(true)
			expect(result.parsed).toEqual({})
		})

		it("should handle whitespace-only input", () => {
			const result = repairToolCallJson("   ")
			expect(result.repaired).toBe(true)
			expect(result.parsed).toEqual({})
		})

		it("should extract JSON from markdown code block", () => {
			const input = '```json\n{"result": "Task completed"}\n```'
			const result = repairToolCallJson(input)

			expect(result.repaired).toBe(true)
			expect(result.parsed).toEqual({ result: "Task completed" })
		})

		it("should extract JSON from code block without language", () => {
			const input = '```\n{"result": "success"}\n```'
			const result = repairToolCallJson(input)

			expect(result.repaired).toBe(true)
			expect(result.parsed).toEqual({ result: "success" })
		})

		it("should extract JSON object from mixed text", () => {
			const input = 'The result is {"status": "ok", "count": 5} and that is all.'
			const result = repairToolCallJson(input)

			expect(result.repaired).toBe(true)
			expect(result.parsed).toEqual({ status: "ok", count: 5 })
		})

		it("should extract JSON array from mixed text", () => {
			const input = "Here are the items: [1, 2, 3] for processing."
			const result = repairToolCallJson(input)

			expect(result.repaired).toBe(true)
			expect(result.parsed).toEqual([1, 2, 3])
		})

		describe("typical LLM malformation patterns", () => {
			it("should repair attempt_completion with trailing comma", () => {
				const input = '{"result": "I have completed the task successfully.",}'
				const result = repairToolCallJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({
					result: "I have completed the task successfully.",
				})
			})

			it("should repair tool call with unquoted keys", () => {
				const input = '{command: "npm install", cwd: "/project"}'
				const result = repairToolCallJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({
					command: "npm install",
					cwd: "/project",
				})
			})

			it("should repair ask_followup_question with mixed issues", () => {
				const input = `{question: 'What file should I edit?', follow_up: [{text: 'src/index.ts', mode: null},]}`
				const result = repairToolCallJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({
					question: "What file should I edit?",
					follow_up: [{ text: "src/index.ts", mode: null }],
				})
			})

			it("should repair read_file with missing closing bracket", () => {
				const input = '{"files": [{"path": "src/app.ts"}]'
				const result = repairToolCallJson(input)

				expect(result.repaired).toBe(true)
				expect(result.parsed).toEqual({
					files: [{ path: "src/app.ts" }],
				})
			})
		})
	})
})
