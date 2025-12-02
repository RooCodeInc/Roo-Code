import { describe, it, expect } from "vitest"
import { formatNumber } from "./stats"

describe("formatNumber", () => {
	it("should format numbers under 1000 without a suffix", () => {
		expect(formatNumber(123)).toBe("123")
		expect(formatNumber(999)).toBe("999")
	})

	it('should format numbers between 1,000 and 999,999 with a "k" suffix', () => {
		expect(formatNumber(1000)).toBe("1.0k")
		expect(formatNumber(2322)).toBe("2.3k")
		expect(formatNumber(23233)).toBe("23.2k")
		expect(formatNumber(337231)).toBe("337.2k")
		expect(formatNumber(999999)).toBe("999.9k")
	})

	it('should format numbers over 1,000,000 with an "m" suffix', () => {
		expect(formatNumber(1000000)).toBe("1.0m")
		expect(formatNumber(1234567)).toBe("1.2m")
		expect(formatNumber(54321098)).toBe("54.3m")
		expect(formatNumber(987654321)).toBe("987.6m")
	})
})
