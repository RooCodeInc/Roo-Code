import { APIError } from "openai"

import { checkContextWindowExceededError } from "../context-error-handling"

describe("checkContextWindowExceededError", () => {
	describe("OpenAI errors", () => {
		it("should detect OpenAI context window error with APIError instance", () => {
			const error = Object.create(APIError.prototype)
			Object.assign(error, {
				status: 400,
				code: "400",
				message: "This model's maximum context length is 4096 tokens",
				error: {
					message: "This model's maximum context length is 4096 tokens",
					type: "invalid_request_error",
					param: null,
					code: "context_length_exceeded",
				},
			})

			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect OpenAI LengthFinishReasonError", () => {
			const error = {
				name: "LengthFinishReasonError",
				message: "The response was cut off due to length",
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should not detect non-context OpenAI errors", () => {
			const error = Object.create(APIError.prototype)
			Object.assign(error, {
				status: 400,
				code: "400",
				message: "Invalid API key",
				error: {
					message: "Invalid API key",
					type: "invalid_request_error",
					param: null,
					code: "invalid_api_key",
				},
			})

			expect(checkContextWindowExceededError(error)).toBe(false)
		})
	})

	describe("OpenRouter errors", () => {
		it("should detect OpenRouter context window error with status 400", () => {
			const error = {
				status: 400,
				message: "Request exceeds maximum context length of 8192 tokens",
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect OpenRouter error with nested error structure", () => {
			const error = {
				error: {
					status: 400,
					message: "Input tokens exceed model limit",
				},
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect OpenRouter error with response status", () => {
			const error = {
				response: {
					status: 400,
				},
				message: "Too many tokens in the request",
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect various context error patterns", () => {
			const patterns = [
				"context length exceeded",
				"maximum context window",
				"input tokens exceed limit",
				"too many tokens",
			]

			patterns.forEach((pattern) => {
				const error = {
					status: 400,
					message: pattern,
				}
				expect(checkContextWindowExceededError(error)).toBe(true)
			})
		})

		it("should not detect non-context 400 errors", () => {
			const error = {
				status: 400,
				message: "Invalid request format",
			}

			expect(checkContextWindowExceededError(error)).toBe(false)
		})

		it("should detect errors with different status codes via generic check", () => {
			// Note: The generic check now catches context overflow messages regardless of status code
			// This is intentional to handle third-party proxies that may return different status codes
			const error = {
				status: 500,
				message: "context length exceeded",
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})
	})

	describe("Anthropic errors", () => {
		it("should detect Anthropic context window error", () => {
			const error = {
				error: {
					error: {
						type: "invalid_request_error",
						message: "prompt is too long: 150000 tokens > 100000 maximum",
					},
				},
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect Anthropic error with context_length_exceeded code", () => {
			const error = {
				error: {
					error: {
						type: "invalid_request_error",
						code: "context_length_exceeded",
						message: "The request exceeds the maximum context window",
					},
				},
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect various Anthropic context error patterns", () => {
			const patterns = [
				"prompt is too long",
				"maximum 200000 tokens",
				"context is too long",
				"exceeds the context window",
				"token limit exceeded",
			]

			patterns.forEach((pattern) => {
				const error = {
					error: {
						error: {
							type: "invalid_request_error",
							message: pattern,
						},
					},
				}
				expect(checkContextWindowExceededError(error)).toBe(true)
			})
		})

		it("should not detect non-context Anthropic errors", () => {
			const error = {
				error: {
					error: {
						type: "invalid_request_error",
						message: "Invalid model specified",
					},
				},
			}

			expect(checkContextWindowExceededError(error)).toBe(false)
		})

		it("should detect errors with different error types via generic check", () => {
			// Note: The generic check now catches context overflow messages regardless of error type
			// This is intentional to handle third-party proxies that may return different error structures
			const error = {
				error: {
					error: {
						type: "authentication_error",
						message: "prompt is too long",
					},
				},
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})
	})

	describe("Cerebras errors", () => {
		it("should detect Cerebras context window error", () => {
			const error = {
				status: 400,
				message: "Please reduce the length of the messages or completion",
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect Cerebras error with nested structure", () => {
			const error = {
				error: {
					status: 400,
					message: "Please reduce the length of the messages or completion",
				},
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should not detect non-context Cerebras errors", () => {
			const error = {
				status: 400,
				message: "Invalid request parameters",
			}

			expect(checkContextWindowExceededError(error)).toBe(false)
		})
	})

	describe("Edge cases", () => {
		it("should handle null input", () => {
			expect(checkContextWindowExceededError(null)).toBe(false)
		})

		it("should handle undefined input", () => {
			expect(checkContextWindowExceededError(undefined)).toBe(false)
		})

		it("should handle empty object", () => {
			expect(checkContextWindowExceededError({})).toBe(false)
		})

		it("should handle string input", () => {
			expect(checkContextWindowExceededError("error")).toBe(false)
		})

		it("should handle number input", () => {
			expect(checkContextWindowExceededError(123)).toBe(false)
		})

		it("should handle array input", () => {
			expect(checkContextWindowExceededError([])).toBe(false)
		})

		it("should handle errors with circular references", () => {
			const error: any = { status: 400, message: "context length exceeded" }
			error.self = error // Create circular reference

			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should handle errors with deeply nested undefined values", () => {
			const error = {
				error: {
					error: {
						type: undefined,
						message: undefined,
					},
				},
			}

			expect(checkContextWindowExceededError(error)).toBe(false)
		})

		it("should handle errors that throw during property access via generic check", () => {
			// Note: The generic check now catches context overflow messages even when some properties throw
			// This is intentional to handle edge cases where error objects have problematic getters
			const error = {
				get status() {
					throw new Error("Property access error")
				},
				message: "context length exceeded",
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should handle mixed provider error structures", () => {
			// Error that could match multiple providers
			const error = {
				status: 400,
				code: "400",
				message: "context length exceeded",
				error: {
					error: {
						type: "invalid_request_error",
						message: "prompt is too long",
					},
				},
			}

			expect(checkContextWindowExceededError(error)).toBe(true)
		})
	})

	describe("Multiple provider detection", () => {
		it("should detect error if any provider check returns true", () => {
			// This error should be detected by OpenRouter check
			const error1 = {
				status: 400,
				message: "context window exceeded",
			}
			expect(checkContextWindowExceededError(error1)).toBe(true)

			// This error should be detected by Anthropic check
			const error2 = {
				error: {
					error: {
						type: "invalid_request_error",
						message: "prompt is too long",
					},
				},
			}
			expect(checkContextWindowExceededError(error2)).toBe(true)

			// This error should be detected by Cerebras check
			const error3 = {
				status: 400,
				message: "Please reduce the length of the messages or completion",
			}
			expect(checkContextWindowExceededError(error3)).toBe(true)
		})
	})

	describe("LiteLLM errors", () => {
		it("should detect LiteLLM context window error with standard message", () => {
			const error = {
				message: "context length exceeded for this model",
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect LiteLLM error with nested error structure", () => {
			const error = {
				error: {
					message: "maximum context length is 4096 tokens",
				},
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect LiteLLM error with deeply nested structure", () => {
			const error = {
				error: {
					error: {
						message: "input is too long for this model",
					},
				},
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect LiteLLM error with detail field", () => {
			const error = {
				detail: "request is too large, please reduce input size",
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect LiteLLM error with context_length_exceeded type", () => {
			const error = {
				error: {
					type: "context_length_exceeded",
					message: "The request exceeds the maximum context",
				},
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect LiteLLM error with context_length_exceeded code", () => {
			const error = {
				error: {
					code: "context_length_exceeded",
					message: "Error processing request",
				},
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect various LiteLLM context error patterns", () => {
			const patterns = [
				"context length exceeded",
				"maximum token limit reached",
				"too many tokens in input",
				"input is too long",
				"exceeds max context size",
				"request is too large",
				"prompt is too long",
			]

			patterns.forEach((pattern) => {
				const error = {
					message: pattern,
				}
				expect(checkContextWindowExceededError(error)).toBe(true)
			})
		})

		it("should detect Chinese context error messages", () => {
			const patterns = ["输入超长了", "超出上下文限制", "请求太长了", "上下文超出限制"]

			patterns.forEach((pattern) => {
				const error = {
					message: pattern,
				}
				expect(checkContextWindowExceededError(error)).toBe(true)
			})
		})

		it("should not detect non-context LiteLLM errors", () => {
			const error = {
				message: "Invalid API key provided",
			}
			expect(checkContextWindowExceededError(error)).toBe(false)
		})
	})

	describe("Generic context window errors", () => {
		it("should detect string error with context overflow message", () => {
			const error = "context length exceeded for this request"
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect error with body field containing context message", () => {
			const error = {
				body: "The input exceeds the maximum token limit",
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect error with text field containing context message", () => {
			const error = {
				text: "Please reduce the length of your input",
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect error with data field containing context message", () => {
			const error = {
				data: "token count exceeded the maximum allowed",
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect error with stringified error field", () => {
			const error = {
				error: "context window overflow detected",
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect error with cause chain", () => {
			const error = {
				message: "Request failed",
				cause: {
					message: "context length exceeded",
				},
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect various generic context error patterns", () => {
			const patterns = [
				"context length exceeded",
				"context window overflow",
				"maximum token count reached",
				"too many tokens",
				"input is too long",
				"exceeds the max length",
				"request is too large",
				"prompt is too long",
				"token limit exceeded",
				"reduce the length of your input",
			]

			patterns.forEach((pattern) => {
				const error = {
					message: pattern,
				}
				expect(checkContextWindowExceededError(error)).toBe(true)
			})
		})

		it("should detect Chinese context error messages in generic check", () => {
			const patterns = ["输入超长", "超出长度限制", "上下文太长", "令牌超出限制"]

			patterns.forEach((pattern) => {
				const error = {
					message: pattern,
				}
				expect(checkContextWindowExceededError(error)).toBe(true)
			})
		})

		it("should detect Japanese context error messages", () => {
			const patterns = ["コンテキストが長すぎます", "入力が超過しました", "リクエストが制限を超えました"]

			patterns.forEach((pattern) => {
				const error = {
					message: pattern,
				}
				expect(checkContextWindowExceededError(error)).toBe(true)
			})
		})

		it("should detect Korean context error messages", () => {
			// These patterns match the regex: /(?:컨텍스트|입력|요청).*(?:너무\s*길|초과|제한)/
			const patterns = ["컨텍스트 너무 길다", "입력 초과", "요청 제한"]

			patterns.forEach((pattern) => {
				const error = {
					message: pattern,
				}
				expect(checkContextWindowExceededError(error)).toBe(true)
			})
		})

		it("should not detect non-context generic errors", () => {
			const error = {
				message: "Network connection failed",
			}
			expect(checkContextWindowExceededError(error)).toBe(false)
		})

		it("should not detect string errors without context keywords", () => {
			const error = "Invalid authentication credentials"
			expect(checkContextWindowExceededError(error)).toBe(false)
		})
	})

	describe("Edge cases for new functions", () => {
		it("should handle string input with context overflow message", () => {
			expect(checkContextWindowExceededError("context length exceeded")).toBe(true)
		})

		it("should handle string input without context overflow message", () => {
			expect(checkContextWindowExceededError("some other error")).toBe(false)
		})

		it("should handle deeply nested cause chain", () => {
			const error = {
				message: "Outer error",
				cause: {
					message: "Middle error",
					cause: {
						message: "context length exceeded",
					},
				},
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should handle error with multiple message sources", () => {
			const error = {
				message: "Generic error",
				error: {
					message: "context window exceeded",
				},
				detail: "Some detail",
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})
	})
})
