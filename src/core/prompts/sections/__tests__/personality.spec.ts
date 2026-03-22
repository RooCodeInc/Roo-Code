import { PersonalityTrait, PersonalityConfig } from "@roo-code/types"

import {
	BUILT_IN_PERSONALITY_TRAITS,
	resolveActiveTraits,
	getAllTraitsForConfig,
	buildPersonalityPrompt,
} from "../../../../shared/personality-traits"

describe("buildPersonalityPrompt", () => {
	it("should return empty string when no config is provided", () => {
		expect(buildPersonalityPrompt(undefined)).toBe("")
	})

	it("should return empty string when no traits are active", () => {
		const config: PersonalityConfig = {
			activeTraitIds: [],
			customTraits: [],
		}
		expect(buildPersonalityPrompt(config)).toBe("")
	})

	it("should return formatted section for a single active built-in trait", () => {
		const config: PersonalityConfig = {
			activeTraitIds: ["roo"],
			customTraits: [],
		}

		const result = buildPersonalityPrompt(config)

		expect(result).toContain("Personality & Communication Style:")
		expect(result).toContain("non-negotiable")
		expect(result).toContain("You are Roo")
		expect(result).toContain("IMPORTANT: Maintaining this personality is critical")
	})

	it("should concatenate multiple active traits", () => {
		const config: PersonalityConfig = {
			activeTraitIds: ["dry-wit", "straight-shooter"],
			customTraits: [],
		}

		const result = buildPersonalityPrompt(config)

		expect(result).toContain("bone-dry, deadpan")
		expect(result).toContain("extremely direct and concise")
	})

	it("should include custom traits", () => {
		const customTrait: PersonalityTrait = {
			id: "pirate",
			emoji: "🏴‍☠️",
			label: "Pirate",
			prompt: "You are a pirate. Use pirate language like 'Ahoy matey!' and 'Arrr!'",
			isBuiltIn: false,
		}

		const config: PersonalityConfig = {
			activeTraitIds: ["pirate"],
			customTraits: [customTrait],
		}

		const result = buildPersonalityPrompt(config)

		expect(result).toContain("You are a pirate")
		expect(result).toContain("Ahoy matey!")
	})

	it("should ignore unknown trait IDs gracefully", () => {
		const config: PersonalityConfig = {
			activeTraitIds: ["nonexistent-trait"],
			customTraits: [],
		}

		const result = buildPersonalityPrompt(config)
		expect(result).toBe("")
	})

	it("should include the behavioral anchor at the end", () => {
		const config: PersonalityConfig = {
			activeTraitIds: ["roo"],
			customTraits: [],
		}

		const result = buildPersonalityPrompt(config)

		// The behavioral anchor should be at the end
		expect(result).toContain("IMPORTANT: Maintaining this personality is critical")
		expect(result).toContain("generic, neutral AI assistant tone")
		// Verify it ends with the anchor
		expect(result.trim().endsWith("not a default chatbot.")).toBe(true)
	})
})

describe("Built-in traits", () => {
	it("should have 12 built-in traits", () => {
		expect(BUILT_IN_PERSONALITY_TRAITS).toHaveLength(12)
	})

	it("should have unique IDs", () => {
		const ids = BUILT_IN_PERSONALITY_TRAITS.map((t) => t.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it("should all be marked as isBuiltIn", () => {
		BUILT_IN_PERSONALITY_TRAITS.forEach((trait) => {
			expect(trait.isBuiltIn).toBe(true)
		})
	})

	it("should all use direct natural-language format (no section markers)", () => {
		BUILT_IN_PERSONALITY_TRAITS.forEach((trait) => {
			// No [SECTION_KEY] markers should be present
			expect(trait.prompt).not.toMatch(/\[COMMUNICATION_STYLE\]/)
			expect(trait.prompt).not.toMatch(/\[TASK_COMPLETION\]/)
			expect(trait.prompt).not.toMatch(/\[ERROR_HANDLING\]/)
			expect(trait.prompt).not.toMatch(/\[SUGGESTIONS\]/)
		})
	})

	it("should all start with identity-first framing (You are/You have/You speak/You prioritize/You question)", () => {
		BUILT_IN_PERSONALITY_TRAITS.forEach((trait) => {
			const startsWithIdentity = /^You (are|have|speak|prioritize|question|see)\b/.test(trait.prompt.trim())
			expect(startsWithIdentity).toBe(true)
		})
	})

	it("should all contain negative constraints (Never)", () => {
		BUILT_IN_PERSONALITY_TRAITS.forEach((trait) => {
			expect(trait.prompt).toContain("Never")
		})
	})

	it("should include the Roo default trait", () => {
		const roo = BUILT_IN_PERSONALITY_TRAITS.find((t) => t.id === "roo")
		expect(roo).toBeDefined()
		expect(roo!.emoji).toBe("🦘")
		expect(roo!.label).toBe("Roo")
	})
})

describe("resolveActiveTraits", () => {
	it("should resolve built-in trait IDs to full traits", () => {
		const result = resolveActiveTraits(["roo", "dry-wit"])
		expect(result).toHaveLength(2)
		expect(result[0].id).toBe("roo")
		expect(result[1].id).toBe("dry-wit")
	})

	it("should preserve order", () => {
		const result = resolveActiveTraits(["dry-wit", "roo"])
		expect(result[0].id).toBe("dry-wit")
		expect(result[1].id).toBe("roo")
	})

	it("should filter out unknown IDs", () => {
		const result = resolveActiveTraits(["roo", "nonexistent", "dry-wit"])
		expect(result).toHaveLength(2)
	})

	it("should resolve custom traits", () => {
		const custom: PersonalityTrait = {
			id: "my-custom",
			emoji: "🧪",
			label: "Custom",
			prompt: "You are custom.",
			isBuiltIn: false,
		}
		const result = resolveActiveTraits(["my-custom"], [custom])
		expect(result).toHaveLength(1)
		expect(result[0].label).toBe("Custom")
	})
})

describe("getAllTraitsForConfig", () => {
	it("should return built-in traits when no custom traits", () => {
		const result = getAllTraitsForConfig([])
		expect(result.length).toBe(BUILT_IN_PERSONALITY_TRAITS.length)
	})

	it("should append custom traits", () => {
		const custom: PersonalityTrait = {
			id: "new-trait",
			emoji: "🆕",
			label: "New",
			prompt: "You are new.",
			isBuiltIn: false,
		}
		const result = getAllTraitsForConfig([custom])
		expect(result.length).toBe(BUILT_IN_PERSONALITY_TRAITS.length + 1)
	})

	it("should allow custom traits to override built-in ones by ID", () => {
		const override: PersonalityTrait = {
			id: "roo",
			emoji: "🦘",
			label: "Custom Roo",
			prompt: "You are a custom Roo.",
			isBuiltIn: false,
		}
		const result = getAllTraitsForConfig([override])
		const roo = result.find((t) => t.id === "roo")
		expect(roo!.label).toBe("Custom Roo")
	})
})
