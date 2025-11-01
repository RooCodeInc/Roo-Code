import { describe, it, expect, vi, beforeEach } from "vitest"
import axios from "axios"

vi.mock("axios")

import { getXaiModels } from "../xai"
import { xaiModels } from "@roo-code/types"

describe("getXaiModels", () => {
	const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> }

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns mapped models with pricing and modalities (augmenting static info when available)", async () => {
		mockedAxios.get = vi.fn().mockResolvedValue({
			data: {
				models: [
					{
						id: "grok-3",
						input_modalities: ["text"],
						output_modalities: ["text"],
						prompt_text_token_price: 2000, // 2000 fractional cents = $0.20 per 1M tokens
						cached_prompt_text_token_price: 500, // 500 fractional cents = $0.05 per 1M tokens
						completion_text_token_price: 10000, // 10000 fractional cents = $1.00 per 1M tokens
						aliases: ["grok-3-latest"],
					},
				],
			},
		})

		const result = await getXaiModels("key", "https://api.x.ai/v1")
		expect(result["grok-3"]).toBeDefined()
		expect(result["grok-3"]?.supportsImages).toBe(false)
		expect(result["grok-3"]?.inputPrice).toBeCloseTo(0.2) // $0.20 per 1M tokens
		expect(result["grok-3"]?.outputPrice).toBeCloseTo(1.0) // $1.00 per 1M tokens
		expect(result["grok-3"]?.cacheReadsPrice).toBeCloseTo(0.05) // $0.05 per 1M tokens
		// aliases are not added to avoid UI duplication
		expect(result["grok-3-latest"]).toBeUndefined()
	})

	it("returns empty object on schema mismatches (graceful degradation)", async () => {
		mockedAxios.get = vi.fn().mockResolvedValue({
			data: { data: [{ bogus: true }] },
		})
		const result = await getXaiModels("key")
		expect(result).toEqual({})
	})

	it("includes Authorization header when apiKey provided", async () => {
		mockedAxios.get = vi.fn().mockResolvedValue({ data: { data: [] } })
		await getXaiModels("secret")
		expect((axios.get as any).mock.calls[0][1].headers.Authorization).toBe("Bearer secret")
	})
})
