import { sanitizeReasoningDetailId } from "../sanitize-reasoning-id"

describe("sanitizeReasoningDetailId", () => {
	it("should return null for null input", () => {
		expect(sanitizeReasoningDetailId(null)).toBeNull()
	})

	it("should return undefined for undefined input", () => {
		expect(sanitizeReasoningDetailId(undefined)).toBeUndefined()
	})

	it("should return empty string for empty string input", () => {
		expect(sanitizeReasoningDetailId("")).toBe("")
	})

	it("should not modify IDs with only valid characters", () => {
		expect(sanitizeReasoningDetailId("abc123")).toBe("abc123")
		expect(sanitizeReasoningDetailId("test_id")).toBe("test_id")
		expect(sanitizeReasoningDetailId("test-id")).toBe("test-id")
		expect(sanitizeReasoningDetailId("ABC_123-test")).toBe("ABC_123-test")
	})

	it("should replace colons with underscores", () => {
		expect(sanitizeReasoningDetailId("rs_033ca40017d1ad93016931b1d2bf7481a2969fd5c1835cb1d3:4")).toBe(
			"rs_033ca40017d1ad93016931b1d2bf7481a2969fd5c1835cb1d3_4",
		)
	})

	it("should replace multiple invalid characters", () => {
		expect(sanitizeReasoningDetailId("test:1:2:3")).toBe("test_1_2_3")
	})

	it("should replace other special characters with underscores", () => {
		expect(sanitizeReasoningDetailId("test@id")).toBe("test_id")
		expect(sanitizeReasoningDetailId("test.id")).toBe("test_id")
		expect(sanitizeReasoningDetailId("test#id")).toBe("test_id")
		expect(sanitizeReasoningDetailId("test$id")).toBe("test_id")
		expect(sanitizeReasoningDetailId("test%id")).toBe("test_id")
		expect(sanitizeReasoningDetailId("test^id")).toBe("test_id")
		expect(sanitizeReasoningDetailId("test&id")).toBe("test_id")
		expect(sanitizeReasoningDetailId("test*id")).toBe("test_id")
		expect(sanitizeReasoningDetailId("test+id")).toBe("test_id")
		expect(sanitizeReasoningDetailId("test=id")).toBe("test_id")
		expect(sanitizeReasoningDetailId("test id")).toBe("test_id")
	})

	it("should handle mixed valid and invalid characters", () => {
		expect(sanitizeReasoningDetailId("rs_abc:1@2#3")).toBe("rs_abc_1_2_3")
	})

	it("should handle IDs starting with valid characters followed by invalid ones", () => {
		expect(sanitizeReasoningDetailId("valid_start:invalid")).toBe("valid_start_invalid")
	})

	it("should handle consecutive invalid characters", () => {
		expect(sanitizeReasoningDetailId("test::id")).toBe("test__id")
		expect(sanitizeReasoningDetailId("test:::id")).toBe("test___id")
	})
})
