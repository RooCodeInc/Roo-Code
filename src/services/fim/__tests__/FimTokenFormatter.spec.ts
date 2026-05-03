import { detectFimTokens, formatFimPrompt, getFimTokensByFamily } from "../FimTokenFormatter"

describe("FimTokenFormatter", () => {
	describe("detectFimTokens", () => {
		it("should detect DeepSeek model tokens", () => {
			const tokens = detectFimTokens("deepseek-coder-v2")
			expect(tokens.prefix).toBe("<|fim▁begin|>")
			expect(tokens.suffix).toBe("<|fim▁hole|>")
			expect(tokens.middle).toBe("<|fim▁end|>")
		})

		it("should detect CodeLlama model tokens", () => {
			const tokens = detectFimTokens("codellama-13b")
			expect(tokens.prefix).toBe("<PRE> ")
			expect(tokens.suffix).toBe(" <SUF>")
			expect(tokens.middle).toBe(" <MID>")
		})

		it("should detect StarCoder model tokens", () => {
			const tokens = detectFimTokens("starcoder2-15b")
			expect(tokens.prefix).toBe("<fim_prefix>")
			expect(tokens.suffix).toBe("<fim_suffix>")
			expect(tokens.middle).toBe("<fim_middle>")
		})

		it("should detect Mistral/Codestral model tokens", () => {
			const tokens = detectFimTokens("codestral-latest")
			expect(tokens.prefix).toBe("[PREFIX]")
			expect(tokens.suffix).toBe("[SUFFIX]")
			expect(tokens.middle).toBe("[MIDDLE]")
		})

		it("should detect Qwen model tokens", () => {
			const tokens = detectFimTokens("qwen2.5-coder-7b")
			expect(tokens.prefix).toBe("<|fim_prefix|>")
			expect(tokens.suffix).toBe("<|fim_suffix|>")
			expect(tokens.middle).toBe("<|fim_middle|>")
		})

		it("should return generic tokens for unknown models", () => {
			const tokens = detectFimTokens("some-unknown-model")
			expect(tokens.prefix).toBe("<|fim_prefix|>")
			expect(tokens.suffix).toBe("<|fim_suffix|>")
			expect(tokens.middle).toBe("<|fim_middle|>")
		})

		it("should be case-insensitive", () => {
			const tokens = detectFimTokens("DeepSeek-Coder-V2")
			expect(tokens.prefix).toBe("<|fim▁begin|>")
		})
	})

	describe("formatFimPrompt", () => {
		it("should format a FIM prompt with correct tokens for DeepSeek", () => {
			const result = formatFimPrompt("deepseek-coder", "function hello() {", "}")
			expect(result).toBe("<|fim▁begin|>function hello() {<|fim▁hole|>}<|fim▁end|>")
		})

		it("should format a FIM prompt with generic tokens for unknown models", () => {
			const result = formatFimPrompt("unknown-model", "const x = ", ";")
			expect(result).toBe("<|fim_prefix|>const x = <|fim_suffix|>;<|fim_middle|>")
		})
	})

	describe("getFimTokensByFamily", () => {
		it("should return tokens for known families", () => {
			const tokens = getFimTokensByFamily("deepseek")
			expect(tokens.prefix).toBe("<|fim▁begin|>")
		})

		it("should return generic tokens for unknown families", () => {
			const tokens = getFimTokensByFamily("nonexistent")
			expect(tokens.prefix).toBe("<|fim_prefix|>")
		})
	})
})
