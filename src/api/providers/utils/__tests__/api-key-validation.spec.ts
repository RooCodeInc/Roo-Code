import { describe, it, expect } from "vitest"
import { validateApiKeyForByteString, validateApiKeyForAscii } from "../api-key-validation"

describe("API Key Validation", () => {
	describe("validateApiKeyForByteString", () => {
		it("should accept valid ASCII characters", () => {
			expect(() => validateApiKeyForByteString("abc123XYZ", "TestProvider")).not.toThrow()
			expect(() => validateApiKeyForByteString("test-api-key_123", "TestProvider")).not.toThrow()
			expect(() => validateApiKeyForByteString("!@#$%^&*()", "TestProvider")).not.toThrow()
		})

		it("should accept extended ASCII characters (128-255)", () => {
			// Extended ASCII characters like ñ (241), ü (252)
			expect(() => validateApiKeyForByteString("test\xF1\xFC", "TestProvider")).not.toThrow()
			expect(() => validateApiKeyForByteString("key\xFF", "TestProvider")).not.toThrow()
		})

		it("should reject characters above 255", () => {
			// Chinese character 中 (20013)
			expect(() => validateApiKeyForByteString("test中key", "TestProvider")).toThrow(
				"Invalid TestProvider API key: contains non-ASCII character at position 5",
			)

			// Emoji 😀 (128512)
			expect(() => validateApiKeyForByteString("key😀", "TestProvider")).toThrow(
				"Invalid TestProvider API key: contains non-ASCII character at position 4",
			)

			// Korean character 한 (54620)
			expect(() => validateApiKeyForByteString("한글key", "TestProvider")).toThrow(
				"Invalid TestProvider API key: contains non-ASCII character at position 1",
			)
		})

		it("should handle undefined and empty keys", () => {
			expect(() => validateApiKeyForByteString(undefined, "TestProvider")).not.toThrow()
			expect(() => validateApiKeyForByteString("", "TestProvider")).not.toThrow()
		})

		it("should provide clear error messages", () => {
			expect(() => validateApiKeyForByteString("abc中def", "DeepSeek")).toThrow(
				"Invalid DeepSeek API key: contains non-ASCII character at position 4. " +
					"API keys must contain only ASCII characters (character codes 0-255). " +
					"Please check your API key configuration.",
			)
		})
	})

	describe("validateApiKeyForAscii", () => {
		it("should accept standard ASCII characters (0-127)", () => {
			expect(() => validateApiKeyForAscii("abc123XYZ", "TestProvider")).not.toThrow()
			expect(() => validateApiKeyForAscii("test-api-key_123", "TestProvider")).not.toThrow()
			expect(() => validateApiKeyForAscii("!@#$%^&*()", "TestProvider")).not.toThrow()
		})

		it("should reject extended ASCII characters (128-255)", () => {
			// Extended ASCII character ñ (241)
			expect(() => validateApiKeyForAscii("test\xF1key", "TestProvider")).toThrow(
				"Invalid TestProvider API key: contains non-ASCII character at position 5",
			)

			// Extended ASCII character ü (252)
			expect(() => validateApiKeyForAscii("key\xFC", "TestProvider")).toThrow(
				"Invalid TestProvider API key: contains non-ASCII character at position 4",
			)
		})

		it("should reject Unicode characters", () => {
			// Chinese character 中 (20013)
			expect(() => validateApiKeyForAscii("test中key", "TestProvider")).toThrow(
				"Invalid TestProvider API key: contains non-ASCII character at position 5",
			)

			// Emoji 😀 (128512)
			expect(() => validateApiKeyForAscii("key😀", "TestProvider")).toThrow(
				"Invalid TestProvider API key: contains non-ASCII character at position 4",
			)
		})

		it("should handle undefined and empty keys", () => {
			expect(() => validateApiKeyForAscii(undefined, "TestProvider")).not.toThrow()
			expect(() => validateApiKeyForAscii("", "TestProvider")).not.toThrow()
		})

		it("should provide clear error messages", () => {
			expect(() => validateApiKeyForAscii("abc\xF1def", "OpenAI")).toThrow(
				"Invalid OpenAI API key: contains non-ASCII character at position 4. " +
					"API keys must contain only standard ASCII characters (character codes 0-127). " +
					"Please check your API key configuration.",
			)
		})
	})
})
