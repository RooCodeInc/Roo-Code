import { Personality, type PersonalityMessages, type InstructionsTemplate } from "@roo-code/types"

import {
	PERSONALITY_PLACEHOLDER,
	hasPersonalityPlaceholder,
	renderPersonalityTemplate,
	getAgentInstructions,
	createTemplateFromInstructions,
	type AgentInfo,
} from "../template-renderer"
import * as loadPersonalitiesModule from "../load-personalities"

describe("template-renderer", () => {
	describe("PERSONALITY_PLACEHOLDER", () => {
		it("should have the correct placeholder value", () => {
			expect(PERSONALITY_PLACEHOLDER).toBe("{{ personality_message }}")
		})
	})

	describe("hasPersonalityPlaceholder", () => {
		it("should return true when template contains the placeholder", () => {
			const template = "Hello {{ personality_message }} world"
			expect(hasPersonalityPlaceholder(template)).toBe(true)
		})

		it("should return false when template does not contain the placeholder", () => {
			const template = "Hello world"
			expect(hasPersonalityPlaceholder(template)).toBe(false)
		})

		it("should return true when placeholder is at the start", () => {
			const template = "{{ personality_message }} instructions"
			expect(hasPersonalityPlaceholder(template)).toBe(true)
		})

		it("should return true when placeholder is at the end", () => {
			const template = "Instructions {{ personality_message }}"
			expect(hasPersonalityPlaceholder(template)).toBe(true)
		})

		it("should return false for empty string", () => {
			expect(hasPersonalityPlaceholder("")).toBe(false)
		})

		it("should return false for partial placeholder", () => {
			expect(hasPersonalityPlaceholder("{{ personality")).toBe(false)
			expect(hasPersonalityPlaceholder("personality_message }}")).toBe(false)
		})
	})

	describe("renderPersonalityTemplate", () => {
		const personalityMessages: PersonalityMessages = {
			[Personality.Friendly]: "Be warm and supportive!",
			[Personality.Pragmatic]: "Be direct and efficient.",
		}

		it("should replace placeholder with friendly personality content", () => {
			const template = "You are an assistant.\n\n{{ personality_message }}\n\nBe helpful."
			const result = renderPersonalityTemplate(template, Personality.Friendly, personalityMessages)
			expect(result).toBe("You are an assistant.\n\nBe warm and supportive!\n\nBe helpful.")
		})

		it("should replace placeholder with pragmatic personality content", () => {
			const template = "You are an assistant.\n\n{{ personality_message }}\n\nBe helpful."
			const result = renderPersonalityTemplate(template, Personality.Pragmatic, personalityMessages)
			expect(result).toBe("You are an assistant.\n\nBe direct and efficient.\n\nBe helpful.")
		})

		it("should handle template with placeholder at start", () => {
			const template = "{{ personality_message }} and then proceed."
			const result = renderPersonalityTemplate(template, Personality.Friendly, personalityMessages)
			expect(result).toBe("Be warm and supportive! and then proceed.")
		})

		it("should handle template with placeholder at end", () => {
			const template = "Instructions: {{ personality_message }}"
			const result = renderPersonalityTemplate(template, Personality.Pragmatic, personalityMessages)
			expect(result).toBe("Instructions: Be direct and efficient.")
		})

		it("should replace only the first occurrence of placeholder", () => {
			const template = "{{ personality_message }} first, {{ personality_message }} second"
			const result = renderPersonalityTemplate(template, Personality.Friendly, personalityMessages)
			expect(result).toBe("Be warm and supportive! first, {{ personality_message }} second")
		})
	})

	describe("getAgentInstructions", () => {
		const mockPersonalityMessages: PersonalityMessages = {
			[Personality.Friendly]: "Friendly content from inline",
			[Personality.Pragmatic]: "Pragmatic content from inline",
		}

		const mockLogger = {
			warn: vi.fn(),
		}

		beforeEach(() => {
			vi.clearAllMocks()
		})

		describe("without personality", () => {
			it("should return base instructions when personality is undefined", () => {
				const agentInfo: AgentInfo = {
					base_instructions: "Default instructions",
					instructions_template: {
						template: "{{ personality_message }} template",
						personality_messages: mockPersonalityMessages,
					},
				}
				const result = getAgentInstructions(agentInfo, undefined)
				expect(result).toBe("Default instructions")
			})
		})

		describe("without template", () => {
			it("should return base instructions when template is undefined", () => {
				const agentInfo: AgentInfo = {
					base_instructions: "Default instructions",
				}
				const result = getAgentInstructions(agentInfo, Personality.Friendly)
				expect(result).toBe("Default instructions")
			})
		})

		describe("with valid template and personality", () => {
			it("should render template with friendly personality", () => {
				const agentInfo: AgentInfo = {
					base_instructions: "Default instructions",
					instructions_template: {
						template: "Prefix {{ personality_message }} Suffix",
						personality_messages: mockPersonalityMessages,
					},
				}
				const result = getAgentInstructions(agentInfo, Personality.Friendly)
				expect(result).toBe("Prefix Friendly content from inline Suffix")
			})

			it("should render template with pragmatic personality", () => {
				const agentInfo: AgentInfo = {
					base_instructions: "Default instructions",
					instructions_template: {
						template: "Prefix {{ personality_message }} Suffix",
						personality_messages: mockPersonalityMessages,
					},
				}
				const result = getAgentInstructions(agentInfo, Personality.Pragmatic)
				expect(result).toBe("Prefix Pragmatic content from inline Suffix")
			})
		})

		describe("template without placeholder", () => {
			it("should warn and return base instructions when template has no placeholder", () => {
				const agentInfo: AgentInfo = {
					base_instructions: "Default instructions",
					instructions_template: {
						template: "No placeholder here",
						personality_messages: mockPersonalityMessages,
					},
				}
				const result = getAgentInstructions(agentInfo, Personality.Friendly, { logger: mockLogger })
				expect(result).toBe("Default instructions")
				expect(mockLogger.warn).toHaveBeenCalledWith(
					expect.stringContaining("Template does not contain placeholder"),
				)
			})
		})

		describe("loading from files", () => {
			it("should load personality content from files when not provided inline", () => {
				const loadedMessages: PersonalityMessages = {
					[Personality.Friendly]: "Content from file",
					[Personality.Pragmatic]: "Pragmatic from file",
				}
				vi.spyOn(loadPersonalitiesModule, "loadPersonalityContent").mockReturnValue(loadedMessages)

				const agentInfo: AgentInfo = {
					base_instructions: "Default instructions",
					instructions_template: {
						template: "Prefix {{ personality_message }} Suffix",
						// No personality_messages provided
					},
				}
				const result = getAgentInstructions(agentInfo, Personality.Friendly)
				expect(result).toBe("Prefix Content from file Suffix")
			})

			it("should warn and return base instructions when file loading fails", () => {
				vi.spyOn(loadPersonalitiesModule, "loadPersonalityContent").mockReturnValue(undefined)

				const agentInfo: AgentInfo = {
					base_instructions: "Default instructions",
					instructions_template: {
						template: "Prefix {{ personality_message }} Suffix",
					},
				}
				const result = getAgentInstructions(agentInfo, Personality.Friendly, { logger: mockLogger })
				expect(result).toBe("Default instructions")
				expect(mockLogger.warn).toHaveBeenCalledWith(
					expect.stringContaining("Failed to load personality content"),
				)
			})
		})

		describe("missing personality content", () => {
			it("should warn and return base instructions when personality content is missing", () => {
				// Mock loadPersonalityContent to return messages missing the requested personality
				const loadedMessages: PersonalityMessages = {
					[Personality.Friendly]: "Content from file",
					[Personality.Pragmatic]: "", // Empty content for pragmatic
				}
				vi.spyOn(loadPersonalitiesModule, "loadPersonalityContent").mockReturnValue(loadedMessages)

				const agentInfo: AgentInfo = {
					base_instructions: "Default instructions",
					instructions_template: {
						template: "Prefix {{ personality_message }} Suffix",
						// No personality_messages provided, will load from files
					},
				}
				const result = getAgentInstructions(agentInfo, Personality.Pragmatic, { logger: mockLogger })
				expect(result).toBe("Default instructions")
				expect(mockLogger.warn).toHaveBeenCalledWith(
					expect.stringContaining("No content found for personality"),
				)
			})

			it("should fall back to loading from files when inline messages are incomplete", () => {
				// When inline messages don't have all personalities, they fail validation
				// and the system falls back to loading from files
				const loadedMessages: PersonalityMessages = {
					[Personality.Friendly]: "Content from file",
					[Personality.Pragmatic]: "Pragmatic from file",
				}
				vi.spyOn(loadPersonalitiesModule, "loadPersonalityContent").mockReturnValue(loadedMessages)

				const incompleteMessages = {
					[Personality.Friendly]: "Only friendly",
				} as unknown as PersonalityMessages

				const agentInfo: AgentInfo = {
					base_instructions: "Default instructions",
					instructions_template: {
						template: "Prefix {{ personality_message }} Suffix",
						personality_messages: incompleteMessages,
					},
				}
				const result = getAgentInstructions(agentInfo, Personality.Pragmatic)
				// Should fall back to file-loaded content since inline messages are incomplete
				expect(result).toBe("Prefix Pragmatic from file Suffix")
			})
		})
	})

	describe("createTemplateFromInstructions", () => {
		it("should create template with placeholder before instructions by default", () => {
			const result = createTemplateFromInstructions("Be helpful.")
			expect(result.template).toBe("{{ personality_message }}\n\nBe helpful.")
			expect(result.personality_messages).toBeUndefined()
		})

		it("should create template with placeholder before instructions when position is 'before'", () => {
			const result = createTemplateFromInstructions("Be helpful.", "before")
			expect(result.template).toBe("{{ personality_message }}\n\nBe helpful.")
		})

		it("should create template with placeholder after instructions when position is 'after'", () => {
			const result = createTemplateFromInstructions("Be helpful.", "after")
			expect(result.template).toBe("Be helpful.\n\n{{ personality_message }}")
		})

		it("should handle empty instructions", () => {
			const result = createTemplateFromInstructions("")
			expect(result.template).toBe("{{ personality_message }}\n\n")
		})

		it("should handle multiline instructions", () => {
			const instructions = "Line 1\nLine 2\nLine 3"
			const result = createTemplateFromInstructions(instructions, "before")
			expect(result.template).toBe("{{ personality_message }}\n\nLine 1\nLine 2\nLine 3")
		})
	})
})
