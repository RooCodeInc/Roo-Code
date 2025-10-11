import { formatMessageTime } from "../formatTime"

describe("formatMessageTime", () => {
	it("should format timestamp to HH:MM format", () => {
		// 2024-01-01 08:37:00
		const timestamp = new Date("2024-01-01T08:37:00").getTime()
		expect(formatMessageTime(timestamp)).toBe("08:37")
	})

	it("should pad single digit hours with zero", () => {
		// 2024-01-01 03:15:00
		const timestamp = new Date("2024-01-01T03:15:00").getTime()
		expect(formatMessageTime(timestamp)).toBe("03:15")
	})

	it("should pad single digit minutes with zero", () => {
		// 2024-01-01 12:05:00
		const timestamp = new Date("2024-01-01T12:05:00").getTime()
		expect(formatMessageTime(timestamp)).toBe("12:05")
	})

	it("should handle midnight correctly", () => {
		// 2024-01-01 00:00:00
		const timestamp = new Date("2024-01-01T00:00:00").getTime()
		expect(formatMessageTime(timestamp)).toBe("00:00")
	})

	it("should handle noon correctly", () => {
		// 2024-01-01 12:00:00
		const timestamp = new Date("2024-01-01T12:00:00").getTime()
		expect(formatMessageTime(timestamp)).toBe("12:00")
	})

	it("should handle end of day correctly", () => {
		// 2024-01-01 23:59:00
		const timestamp = new Date("2024-01-01T23:59:00").getTime()
		expect(formatMessageTime(timestamp)).toBe("23:59")
	})
})
