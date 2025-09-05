import { chutesModels } from "../chutes.js"

describe("chutesModels", () => {
	test("should include Kimi K2-0905 model", () => {
		expect(chutesModels["moonshotai/Kimi-K2-Instruct-0905"]).toBeDefined()
		expect(chutesModels["moonshotai/Kimi-K2-Instruct-0905"].maxTokens).toBe(32768)
		expect(chutesModels["moonshotai/Kimi-K2-Instruct-0905"].contextWindow).toBe(262144)
		expect(chutesModels["moonshotai/Kimi-K2-Instruct-0905"].supportsImages).toBe(false)
		expect(chutesModels["moonshotai/Kimi-K2-Instruct-0905"].supportsPromptCache).toBe(false)
		expect(chutesModels["moonshotai/Kimi-K2-Instruct-0905"].inputPrice).toBe(0.1999)
		expect(chutesModels["moonshotai/Kimi-K2-Instruct-0905"].outputPrice).toBe(0.8001)
		expect(chutesModels["moonshotai/Kimi-K2-Instruct-0905"].description).toBe(
			"Moonshot AI Kimi K2 Instruct 0905 model with 256k context window.",
		)
	})

	test("should include Kimi K2-75k model", () => {
		expect(chutesModels["moonshotai/Kimi-K2-Instruct-75k"]).toBeDefined()
		expect(chutesModels["moonshotai/Kimi-K2-Instruct-75k"].contextWindow).toBe(75000)
	})
})
