import {
	rooCliControlEventSchema,
	rooCliFinalOutputSchema,
	rooCliInputCommandSchema,
	rooCliStreamEventSchema,
} from "../cli.js"

describe("CLI types", () => {
	describe("rooCliInputCommandSchema", () => {
		it("validates a start command", () => {
			const result = rooCliInputCommandSchema.safeParse({
				command: "start",
				requestId: "req-1",
				prompt: "hello",
				configuration: {},
			})

			expect(result.success).toBe(true)
		})

		it("rejects a message command without prompt", () => {
			const result = rooCliInputCommandSchema.safeParse({
				command: "message",
				requestId: "req-2",
			})

			expect(result.success).toBe(false)
		})
	})

	describe("rooCliControlEventSchema", () => {
		it("validates a control done event", () => {
			const result = rooCliControlEventSchema.safeParse({
				type: "control",
				subtype: "done",
				requestId: "req-3",
				command: "start",
				success: true,
				code: "task_completed",
			})

			expect(result.success).toBe(true)
		})

		it("rejects control event without requestId", () => {
			const result = rooCliControlEventSchema.safeParse({
				type: "control",
				subtype: "ack",
			})

			expect(result.success).toBe(false)
		})
	})

	describe("rooCliStreamEventSchema", () => {
		it("accepts passthrough fields for forward compatibility", () => {
			const result = rooCliStreamEventSchema.safeParse({
				type: "assistant",
				id: 42,
				content: "partial",
				customField: "future",
			})

			expect(result.success).toBe(true)
		})
	})

	describe("rooCliFinalOutputSchema", () => {
		it("validates final json output shape", () => {
			const result = rooCliFinalOutputSchema.safeParse({
				type: "result",
				success: true,
				content: "done",
				events: [],
			})

			expect(result.success).toBe(true)
		})
	})
})
