import { labelForBackgroundStatus } from "@src/utils/backgroundStatus"

describe("labelForBackgroundStatus()", () => {
	it("maps queued", () => {
		expect(labelForBackgroundStatus("queued")).toBe("API Request: background mode (queued)…")
	})

	it("maps in_progress", () => {
		expect(labelForBackgroundStatus("in_progress")).toBe("API Request: background mode (in progress)…")
	})

	it("maps reconnecting", () => {
		expect(labelForBackgroundStatus("reconnecting")).toBe("API Request: background mode (reconnecting…)")
	})

	it("maps polling", () => {
		expect(labelForBackgroundStatus("polling")).toBe("API Request: background mode (polling…)")
	})

	it("maps completed", () => {
		expect(labelForBackgroundStatus("completed")).toBe("API Request: background mode (completed)")
	})

	it("maps failed", () => {
		expect(labelForBackgroundStatus("failed")).toBe("API Request: background mode (failed)")
	})

	it("maps canceled", () => {
		expect(labelForBackgroundStatus("canceled")).toBe("API Request: background mode (canceled)")
	})

	it("maps undefined to generic label", () => {
		expect(labelForBackgroundStatus(undefined)).toBe("API Request: background mode")
	})
})
