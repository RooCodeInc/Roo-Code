// npx vitest core/prompts/__tests__/toolProtocolResolver.spec.ts

import { describe, it, expect } from "vitest"
import { resolveToolProtocol } from "../toolProtocolResolver"

describe("toolProtocolResolver", () => {
	it("should default to xml protocol", () => {
		expect(resolveToolProtocol()).toBe("xml")
	})
})
