// npx vitest core/prompts/__tests__/toolProtocolResolver.spec.ts

import { describe, it, expect, beforeEach } from "vitest"
import { setToolProtocol, getToolProtocol, resolveToolProtocol } from "../toolProtocolResolver"

describe("toolProtocolResolver", () => {
	beforeEach(() => {
		// Reset to default before each test
		setToolProtocol("xml")
	})

	it("should default to xml protocol", () => {
		expect(resolveToolProtocol()).toBe("xml")
		expect(getToolProtocol()).toBe("xml")
	})

	it("should allow setting protocol to native", () => {
		setToolProtocol("native")
		expect(resolveToolProtocol()).toBe("native")
		expect(getToolProtocol()).toBe("native")
	})

	it("should allow setting protocol back to xml", () => {
		setToolProtocol("native")
		expect(getToolProtocol()).toBe("native")

		setToolProtocol("xml")
		expect(getToolProtocol()).toBe("xml")
	})

	it("should maintain state across multiple calls", () => {
		setToolProtocol("native")

		expect(resolveToolProtocol()).toBe("native")
		expect(getToolProtocol()).toBe("native")
		expect(resolveToolProtocol()).toBe("native")
		expect(getToolProtocol()).toBe("native")
	})
})
