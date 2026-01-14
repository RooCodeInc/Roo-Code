import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { formatTimestamp } from "../formatTimestamp"

describe("formatTimestamp", () => {
	beforeEach(() => {
		// Mock current date to 2026-01-09 14:30:00
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-09T14:30:00.000Z"))
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe("24-hour format (default)", () => {
		it("formats today's time in 24-hour format", () => {
			// Same day at 10:15
			const timestamp = new Date("2026-01-09T10:15:00.000Z").getTime()
			expect(formatTimestamp(timestamp)).toBe("10:15")
		})

		it("pads single-digit hours and minutes", () => {
			const timestamp = new Date("2026-01-09T09:05:00.000Z").getTime()
			expect(formatTimestamp(timestamp)).toBe("09:05")
		})

		it("includes date for messages from previous days", () => {
			// Previous day
			const timestamp = new Date("2026-01-08T14:34:00.000Z").getTime()
			expect(formatTimestamp(timestamp)).toBe("Jan 8, 14:34")
		})

		it("includes date for messages from previous months", () => {
			// Previous month
			const timestamp = new Date("2025-12-25T09:00:00.000Z").getTime()
			expect(formatTimestamp(timestamp)).toBe("Dec 25, 09:00")
		})

		it("includes date for messages from previous years", () => {
			// Previous year
			const timestamp = new Date("2025-06-15T18:45:00.000Z").getTime()
			expect(formatTimestamp(timestamp)).toBe("Jun 15, 18:45")
		})

		it("handles midnight correctly", () => {
			const timestamp = new Date("2026-01-09T00:00:00.000Z").getTime()
			expect(formatTimestamp(timestamp)).toBe("00:00")
		})

		it("handles end of day correctly", () => {
			const timestamp = new Date("2026-01-09T23:59:00.000Z").getTime()
			expect(formatTimestamp(timestamp)).toBe("23:59")
		})

		it("correctly abbreviates all months", () => {
			const months = [
				{ date: "2025-01-15", expected: "Jan" },
				{ date: "2025-02-15", expected: "Feb" },
				{ date: "2025-03-15", expected: "Mar" },
				{ date: "2025-04-15", expected: "Apr" },
				{ date: "2025-05-15", expected: "May" },
				{ date: "2025-06-15", expected: "Jun" },
				{ date: "2025-07-15", expected: "Jul" },
				{ date: "2025-08-15", expected: "Aug" },
				{ date: "2025-09-15", expected: "Sep" },
				{ date: "2025-10-15", expected: "Oct" },
				{ date: "2025-11-15", expected: "Nov" },
				{ date: "2025-12-15", expected: "Dec" },
			]

			months.forEach(({ date, expected }) => {
				const timestamp = new Date(`${date}T12:00:00.000Z`).getTime()
				expect(formatTimestamp(timestamp)).toContain(expected)
			})
		})
	})

	describe("12-hour format", () => {
		it("formats morning time with AM", () => {
			const timestamp = new Date("2026-01-09T10:15:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "12hour")).toBe("10:15 AM")
		})

		it("formats afternoon time with PM", () => {
			const timestamp = new Date("2026-01-09T14:30:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "12hour")).toBe("2:30 PM")
		})

		it("formats midnight as 12:00 AM", () => {
			const timestamp = new Date("2026-01-09T00:00:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "12hour")).toBe("12:00 AM")
		})

		it("formats noon as 12:00 PM", () => {
			const timestamp = new Date("2026-01-09T12:00:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "12hour")).toBe("12:00 PM")
		})

		it("formats end of day correctly", () => {
			const timestamp = new Date("2026-01-09T23:59:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "12hour")).toBe("11:59 PM")
		})

		it("includes date for messages from previous days with 12-hour format", () => {
			const timestamp = new Date("2026-01-08T14:34:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "12hour")).toBe("Jan 8, 2:34 PM")
		})

		it("includes date for messages from previous months with 12-hour format", () => {
			const timestamp = new Date("2025-12-25T09:00:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "12hour")).toBe("Dec 25, 9:00 AM")
		})

		it("handles single-digit hours without padding", () => {
			const timestamp = new Date("2026-01-09T09:05:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "12hour")).toBe("9:05 AM")
		})

		it("formats 1 AM correctly", () => {
			const timestamp = new Date("2026-01-09T01:00:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "12hour")).toBe("1:00 AM")
		})

		it("formats 1 PM correctly", () => {
			const timestamp = new Date("2026-01-09T13:00:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "12hour")).toBe("1:00 PM")
		})
	})

	describe("explicit 24-hour format parameter", () => {
		it("formats time same as default when explicitly set to 24hour", () => {
			const timestamp = new Date("2026-01-09T14:30:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "24hour")).toBe("14:30")
		})

		it("formats midnight correctly with explicit 24-hour format", () => {
			const timestamp = new Date("2026-01-09T00:00:00.000Z").getTime()
			expect(formatTimestamp(timestamp, "24hour")).toBe("00:00")
		})
	})
})
