import { describe, test, expect } from "vitest"
import { modelSupportsBrowserCapability } from "../browserCapability"

describe("modelSupportsBrowserCapability", () => {
	test("enables when supportsImages=true and supportsComputerUse=false/absent", () => {
		expect(modelSupportsBrowserCapability({ supportsImages: true } as any)).toBe(true)
		expect(modelSupportsBrowserCapability({ supportsImages: true, supportsComputerUse: false } as any)).toBe(true)
	})

	test("enables when supportsComputerUse=true even if supportsImages=false", () => {
		expect(modelSupportsBrowserCapability({ supportsImages: false, supportsComputerUse: true } as any)).toBe(true)
	})

	test("disabled when both flags are false or missing", () => {
		expect(modelSupportsBrowserCapability({ supportsImages: false } as any)).toBe(false)
		expect(modelSupportsBrowserCapability({} as any)).toBe(false)
	})
})
