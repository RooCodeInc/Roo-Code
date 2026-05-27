// cd src && npx vitest run api/providers/utils/__tests__/glm-model-detection.spec.ts

import { detectGlmModel, isGlmModel, logGlmDetection, type GlmModelConfig } from "../glm-model-detection"

describe("glm-model-detection", () => {
	describe("isGlmModel", () => {
		it("should detect standard GLM model IDs", () => {
			expect(isGlmModel("glm-4.5")).toBe(true)
			expect(isGlmModel("glm-4.6")).toBe(true)
			expect(isGlmModel("glm-4.7")).toBe(true)
			expect(isGlmModel("glm-4.7-flash")).toBe(true)
		})

		it("should detect GLM models with prefix paths", () => {
			expect(isGlmModel("mlx-community/GLM-4.5-4bit")).toBe(true)
			expect(isGlmModel("THUDM/glm-4-9b-chat")).toBe(true)
			expect(isGlmModel("some-user/GLM-4.5-Air")).toBe(true)
		})

		it("should detect GGUF file format GLM models", () => {
			expect(isGlmModel("GLM-4.5-UD-Q8_K_XL-00001-of-00008.gguf")).toBe(true)
			expect(isGlmModel("glm-4.7-flash-Q4_K_M.gguf")).toBe(true)
		})

		it("should detect ChatGLM models", () => {
			expect(isGlmModel("chatglm-6b")).toBe(true)
			expect(isGlmModel("chatglm3-6b")).toBe(true)
		})

		it("should be case-insensitive", () => {
			expect(isGlmModel("GLM-4.5")).toBe(true)
			expect(isGlmModel("Glm-4.6")).toBe(true)
			expect(isGlmModel("CHATGLM-6B")).toBe(true)
		})

		it("should NOT detect non-GLM models", () => {
			expect(isGlmModel("gpt-4")).toBe(false)
			expect(isGlmModel("claude-3-sonnet")).toBe(false)
			expect(isGlmModel("llama-3-70b")).toBe(false)
			expect(isGlmModel("mistral-7b")).toBe(false)
			expect(isGlmModel("qwen2-7b")).toBe(false)
		})
	})

	describe("detectGlmModel", () => {
		describe("non-GLM models", () => {
			it("should return isGlmModel: false for non-GLM models", () => {
				const result = detectGlmModel("gpt-4")
				expect(result.isGlmModel).toBe(false)
				expect(result.version).toBe("unknown")
				expect(result.variant).toBe("unknown")
				expect(result.mergeToolResultText).toBe(false)
				expect(result.disableParallelToolCalls).toBe(false)
			})
		})

		describe("version detection", () => {
			it("should detect GLM-4.5 version", () => {
				expect(detectGlmModel("glm-4.5").version).toBe("4.5")
				expect(detectGlmModel("GLM-4.5-Air").version).toBe("4.5")
				expect(detectGlmModel("glm-4-5-flash").version).toBe("4.5")
				expect(detectGlmModel("accounts/fireworks/models/glm-4p5").version).toBe("4.5")
			})

			it("should detect GLM-4.6 version", () => {
				expect(detectGlmModel("glm-4.6").version).toBe("4.6")
				expect(detectGlmModel("GLM-4.6V").version).toBe("4.6")
				expect(detectGlmModel("glm-4-6-flash").version).toBe("4.6")
			})

			it("should detect GLM-4.7 version", () => {
				expect(detectGlmModel("glm-4.7").version).toBe("4.7")
				expect(detectGlmModel("GLM-4.7-Flash").version).toBe("4.7")
				expect(detectGlmModel("glm-4-7-flashx").version).toBe("4.7")
			})
		})

		describe("variant detection", () => {
			describe("base variant", () => {
				it("should detect base variant", () => {
					expect(detectGlmModel("glm-4.5").variant).toBe("base")
					expect(detectGlmModel("glm-4.6").variant).toBe("base")
					expect(detectGlmModel("glm-4.7").variant).toBe("base")
				})
			})

			describe("air variants", () => {
				it("should detect air variant", () => {
					expect(detectGlmModel("glm-4.5-air").variant).toBe("air")
					expect(detectGlmModel("GLM-4.5-Air").variant).toBe("air")
				})

				it("should detect airx variant", () => {
					expect(detectGlmModel("glm-4.5-airx").variant).toBe("airx")
					expect(detectGlmModel("GLM-4.5-AirX").variant).toBe("airx")
				})
			})

			describe("flash variants", () => {
				it("should detect flash variant", () => {
					expect(detectGlmModel("glm-4.5-flash").variant).toBe("flash")
					expect(detectGlmModel("glm-4.7-flash").variant).toBe("flash")
				})

				it("should detect flashx variant", () => {
					expect(detectGlmModel("glm-4.7-flashx").variant).toBe("flashx")
					expect(detectGlmModel("GLM-4.7-FlashX").variant).toBe("flashx")
				})
			})

			describe("x variant", () => {
				it("should detect x variant", () => {
					expect(detectGlmModel("glm-4.5-x").variant).toBe("x")
					expect(detectGlmModel("GLM-4.5-X").variant).toBe("x")
				})
			})

			describe("vision variants", () => {
				it("should detect v (vision) variant for 4.5", () => {
					const result = detectGlmModel("glm-4.5v")
					expect(result.variant).toBe("v")
					expect(result.supportsVision).toBe(true)
				})

				it("should detect v (vision) variant for 4.6", () => {
					const result = detectGlmModel("glm-4.6v")
					expect(result.variant).toBe("v")
					expect(result.supportsVision).toBe(true)
				})

				it("should detect v-flash variant", () => {
					const result = detectGlmModel("glm-4.6v-flash")
					expect(result.variant).toBe("v-flash")
					expect(result.supportsVision).toBe(true)
				})

				it("should detect v-flashx variant", () => {
					const result = detectGlmModel("glm-4.6v-flashx")
					expect(result.variant).toBe("v-flashx")
					expect(result.supportsVision).toBe(true)
				})
			})
		})

		describe("thinking support detection", () => {
			it("should detect thinking support for GLM-4.7", () => {
				expect(detectGlmModel("glm-4.7").supportsThinking).toBe(true)
				expect(detectGlmModel("glm-4.7-flash").supportsThinking).toBe(true)
				expect(detectGlmModel("GLM-4.7-FlashX").supportsThinking).toBe(true)
			})

			it("should NOT detect thinking support for GLM-4.5 and GLM-4.6", () => {
				expect(detectGlmModel("glm-4.5").supportsThinking).toBe(false)
				expect(detectGlmModel("glm-4.6").supportsThinking).toBe(false)
				expect(detectGlmModel("glm-4.5-air").supportsThinking).toBe(false)
				expect(detectGlmModel("glm-4.6v").supportsThinking).toBe(false)
			})
		})

		describe("configuration flags", () => {
			it("should enable mergeToolResultText for all GLM models", () => {
				expect(detectGlmModel("glm-4.5").mergeToolResultText).toBe(true)
				expect(detectGlmModel("glm-4.6").mergeToolResultText).toBe(true)
				expect(detectGlmModel("glm-4.7").mergeToolResultText).toBe(true)
			})

			it("should disable parallel tool calls for all GLM models", () => {
				expect(detectGlmModel("glm-4.5").disableParallelToolCalls).toBe(true)
				expect(detectGlmModel("glm-4.6").disableParallelToolCalls).toBe(true)
				expect(detectGlmModel("glm-4.7").disableParallelToolCalls).toBe(true)
			})
		})

		describe("display name generation", () => {
			it("should generate correct display names for base variants", () => {
				expect(detectGlmModel("glm-4.5").displayName).toBe("GLM-4.5")
				expect(detectGlmModel("glm-4.6").displayName).toBe("GLM-4.6")
				expect(detectGlmModel("glm-4.7").displayName).toBe("GLM-4.7")
			})

			it("should generate correct display names for variants", () => {
				expect(detectGlmModel("glm-4.5-air").displayName).toBe("GLM-4.5 AIR")
				expect(detectGlmModel("glm-4.5-flash").displayName).toBe("GLM-4.5 FLASH")
				expect(detectGlmModel("glm-4.7-flashx").displayName).toBe("GLM-4.7 FLASHX")
				expect(detectGlmModel("glm-4.6v").displayName).toBe("GLM-4.6 V")
				expect(detectGlmModel("glm-4.6v-flash").displayName).toBe("GLM-4.6 V FLASH")
			})

			it("should handle unknown version", () => {
				// ChatGLM doesn't have a specific version number
				const result = detectGlmModel("chatglm-6b")
				expect(result.displayName).toBe("GLM-4.x")
			})
		})

		describe("real-world model ID formats", () => {
			it("should correctly detect MLX community models", () => {
				const result = detectGlmModel("mlx-community/GLM-4.5-4bit")
				expect(result.isGlmModel).toBe(true)
				expect(result.version).toBe("4.5")
				expect(result.variant).toBe("base")
			})

			it("should correctly detect GGUF models", () => {
				const result = detectGlmModel("GLM-4.5-UD-Q8_K_XL-00001-of-00008.gguf")
				expect(result.isGlmModel).toBe(true)
				expect(result.version).toBe("4.5")
			})

			it("should correctly detect Fireworks models", () => {
				const result = detectGlmModel("accounts/fireworks/models/glm-4p5")
				expect(result.isGlmModel).toBe(true)
				expect(result.version).toBe("4.5")
			})

			it("should correctly detect Fireworks air models", () => {
				const result = detectGlmModel("accounts/fireworks/models/glm-4p5-air")
				expect(result.isGlmModel).toBe(true)
				expect(result.version).toBe("4.5")
				expect(result.variant).toBe("air")
			})
		})
	})

	describe("logGlmDetection", () => {
		let consoleLogSpy: any

		beforeEach(() => {
			consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		})

		afterEach(() => {
			consoleLogSpy.mockRestore()
		})

		it("should log detection results for GLM models", () => {
			const config = detectGlmModel("glm-4.5")
			logGlmDetection("LM Studio", "glm-4.5", config)

			expect(consoleLogSpy).toHaveBeenCalledWith('[LM Studio] Using model ID: "glm-4.5"')
			expect(consoleLogSpy).toHaveBeenCalledWith('[GLM Detection] ✓ GLM model detected: "glm-4.5"')
			expect(consoleLogSpy).toHaveBeenCalledWith("[GLM Detection]   - Version: 4.5")
			expect(consoleLogSpy).toHaveBeenCalledWith("[GLM Detection]   - Variant: base")
		})

		it("should log when model is NOT a GLM model", () => {
			const config = detectGlmModel("gpt-4")
			logGlmDetection("OpenAI-compatible", "gpt-4", config)

			expect(consoleLogSpy).toHaveBeenCalledWith('[OpenAI-compatible] Using model ID: "gpt-4"')
			expect(consoleLogSpy).toHaveBeenCalledWith('[GLM Detection] ✗ Not a GLM model: "gpt-4"')
		})
	})
})
