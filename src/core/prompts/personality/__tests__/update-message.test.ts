import { Personality, PersonalityMessages, PersonalityUpdateMessage } from "@roo-code/types"
import {
	buildPersonalityUpdateMessage,
	buildPersonalityTransitionMessage,
	formatPersonalityName,
	PERSONALITY_SPEC_TAG,
} from "../update-message"

describe("update-message", () => {
	// Sample personality messages for testing
	const mockPersonalityMessages: PersonalityMessages = {
		[Personality.Friendly]: "You are warm, approachable, and use encouraging language.",
		[Personality.Pragmatic]: "You focus on practical solutions and efficiency.",
	}

	describe("buildPersonalityUpdateMessage", () => {
		it("should build a message with system role by default", () => {
			const result = buildPersonalityUpdateMessage(Personality.Friendly, mockPersonalityMessages)

			expect(result.role).toBe("system")
			expect(result.content).toContain(`<${PERSONALITY_SPEC_TAG}>`)
			expect(result.content).toContain(`</${PERSONALITY_SPEC_TAG}>`)
		})

		it("should build a message with developer role when specified", () => {
			const result = buildPersonalityUpdateMessage(Personality.Friendly, mockPersonalityMessages, {
				role: "developer",
			})

			expect(result.role).toBe("developer")
		})

		it("should include the personality instructions in the message", () => {
			const result = buildPersonalityUpdateMessage(Personality.Friendly, mockPersonalityMessages)

			expect(result.content).toContain(mockPersonalityMessages[Personality.Friendly])
		})

		it("should include the communication style change notice", () => {
			const result = buildPersonalityUpdateMessage(Personality.Pragmatic, mockPersonalityMessages)

			expect(result.content).toContain("The user has requested a new communication style")
		})

		it("should work with Friendly personality", () => {
			const result = buildPersonalityUpdateMessage(Personality.Friendly, mockPersonalityMessages)

			expect(result.role).toBe("system")
			expect(result.content).toContain(`<${PERSONALITY_SPEC_TAG}>`)
			expect(result.content).toContain(mockPersonalityMessages[Personality.Friendly])
		})

		it("should work with Pragmatic personality", () => {
			const result = buildPersonalityUpdateMessage(Personality.Pragmatic, mockPersonalityMessages)

			expect(result.role).toBe("system")
			expect(result.content).toContain(`<${PERSONALITY_SPEC_TAG}>`)
			expect(result.content).toContain(mockPersonalityMessages[Personality.Pragmatic])
		})

		it("should handle empty personality instructions", () => {
			const emptyMessages: PersonalityMessages = {
				[Personality.Friendly]: "",
				[Personality.Pragmatic]: "Pragmatic instructions",
			}

			const result = buildPersonalityUpdateMessage(Personality.Friendly, emptyMessages)

			expect(result.role).toBe("system")
			expect(result.content).toContain(`<${PERSONALITY_SPEC_TAG}>`)
		})

		it("should produce valid PersonalityUpdateMessage interface", () => {
			const result: PersonalityUpdateMessage = buildPersonalityUpdateMessage(
				Personality.Pragmatic,
				mockPersonalityMessages,
			)

			expect(result).toHaveProperty("role")
			expect(result).toHaveProperty("content")
			expect(typeof result.role).toBe("string")
			expect(typeof result.content).toBe("string")
		})
	})

	describe("buildPersonalityTransitionMessage", () => {
		it("should build a message with system role by default", () => {
			const result = buildPersonalityTransitionMessage(
				Personality.Friendly,
				Personality.Pragmatic,
				mockPersonalityMessages,
			)

			expect(result.role).toBe("system")
			expect(result.content).toContain(`<${PERSONALITY_SPEC_TAG}>`)
			expect(result.content).toContain(`</${PERSONALITY_SPEC_TAG}>`)
		})

		it("should build a message with developer role when specified", () => {
			const result = buildPersonalityTransitionMessage(
				Personality.Friendly,
				Personality.Pragmatic,
				mockPersonalityMessages,
				{ role: "developer" },
			)

			expect(result.role).toBe("developer")
		})

		it("should include both previous and new personality names", () => {
			const result = buildPersonalityTransitionMessage(
				Personality.Friendly,
				Personality.Pragmatic,
				mockPersonalityMessages,
			)

			expect(result.content).toContain("Friendly")
			expect(result.content).toContain("Pragmatic")
		})

		it("should include the new personality instructions", () => {
			const result = buildPersonalityTransitionMessage(
				Personality.Friendly,
				Personality.Pragmatic,
				mockPersonalityMessages,
			)

			expect(result.content).toContain(mockPersonalityMessages[Personality.Pragmatic])
		})

		it("should include the transition notice", () => {
			const result = buildPersonalityTransitionMessage(
				Personality.Pragmatic,
				Personality.Friendly,
				mockPersonalityMessages,
			)

			expect(result.content).toContain("communication style from")
		})

		it("should work with Friendly to Pragmatic transition", () => {
			const result = buildPersonalityTransitionMessage(
				Personality.Friendly,
				Personality.Pragmatic,
				mockPersonalityMessages,
			)

			expect(result.role).toBe("system")
			expect(result.content).toContain(`<${PERSONALITY_SPEC_TAG}>`)
			expect(result.content).toContain(mockPersonalityMessages[Personality.Pragmatic])
		})

		it("should work with Pragmatic to Friendly transition", () => {
			const result = buildPersonalityTransitionMessage(
				Personality.Pragmatic,
				Personality.Friendly,
				mockPersonalityMessages,
			)

			expect(result.role).toBe("system")
			expect(result.content).toContain(`<${PERSONALITY_SPEC_TAG}>`)
			expect(result.content).toContain(mockPersonalityMessages[Personality.Friendly])
		})

		it("should produce valid PersonalityUpdateMessage interface", () => {
			const result: PersonalityUpdateMessage = buildPersonalityTransitionMessage(
				Personality.Friendly,
				Personality.Pragmatic,
				mockPersonalityMessages,
			)

			expect(result).toHaveProperty("role")
			expect(result).toHaveProperty("content")
			expect(typeof result.role).toBe("string")
			expect(typeof result.content).toBe("string")
		})
	})

	describe("formatPersonalityName", () => {
		it("should capitalize Friendly personality", () => {
			const result = formatPersonalityName(Personality.Friendly)
			expect(result).toBe("Friendly")
		})

		it("should capitalize Pragmatic personality", () => {
			const result = formatPersonalityName(Personality.Pragmatic)
			expect(result).toBe("Pragmatic")
		})
	})

	describe("PERSONALITY_SPEC_TAG", () => {
		it("should be a valid string", () => {
			expect(typeof PERSONALITY_SPEC_TAG).toBe("string")
			expect(PERSONALITY_SPEC_TAG).toBe("personality_spec")
		})
	})
})
