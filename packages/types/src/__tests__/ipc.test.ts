import { TaskCommandName, taskCommandSchema } from "../ipc.js"

describe("IPC Types", () => {
	describe("TaskCommandName", () => {
		it("should include ResumeTask command", () => {
			expect(TaskCommandName.ResumeTask).toBe("ResumeTask")
		})

		it("should have all expected task commands", () => {
			const expectedCommands = [
				"StartNewTask",
				"CancelTask",
				"CloseTask",
				"ResumeTask",
				"SendMessage",
				"ApproveAsk",
				"DenyAsk",
			]
			const actualCommands = Object.values(TaskCommandName)

			expectedCommands.forEach((command) => {
				expect(actualCommands).toContain(command)
			})
		})

		it("should include ApproveAsk command", () => {
			expect(TaskCommandName.ApproveAsk).toBe("ApproveAsk")
		})

		it("should include DenyAsk command", () => {
			expect(TaskCommandName.DenyAsk).toBe("DenyAsk")
		})

		describe("Error Handling", () => {
			it("should handle ResumeTask command gracefully when task not found", () => {
				// This test verifies the schema validation - the actual error handling
				// for invalid task IDs is tested at the API level, not the schema level
				const resumeTaskCommand = {
					commandName: TaskCommandName.ResumeTask,
					data: "non-existent-task-id",
				}

				const result = taskCommandSchema.safeParse(resumeTaskCommand)
				expect(result.success).toBe(true)

				if (result.success) {
					expect(result.data.commandName).toBe("ResumeTask")
					expect(result.data.data).toBe("non-existent-task-id")
				}
			})
		})
	})

	describe("taskCommandSchema", () => {
		it("should validate ResumeTask command with taskId", () => {
			const resumeTaskCommand = {
				commandName: TaskCommandName.ResumeTask,
				data: "task-123",
			}

			const result = taskCommandSchema.safeParse(resumeTaskCommand)
			expect(result.success).toBe(true)

			if (result.success) {
				expect(result.data.commandName).toBe("ResumeTask")
				expect(result.data.data).toBe("task-123")
			}
		})

		it("should reject ResumeTask command with invalid data", () => {
			const invalidCommand = {
				commandName: TaskCommandName.ResumeTask,
				data: 123, // Should be string
			}

			const result = taskCommandSchema.safeParse(invalidCommand)
			expect(result.success).toBe(false)
		})

		it("should reject ResumeTask command without data", () => {
			const invalidCommand = {
				commandName: TaskCommandName.ResumeTask,
				// Missing data field
			}

			const result = taskCommandSchema.safeParse(invalidCommand)
			expect(result.success).toBe(false)
		})

		it("should validate ApproveAsk command with optional text and images", () => {
			const approveCommand = {
				commandName: TaskCommandName.ApproveAsk,
				data: { text: "Approved with comment", images: [] },
			}

			const result = taskCommandSchema.safeParse(approveCommand)
			expect(result.success).toBe(true)

			if (result.success) {
				expect(result.data.commandName).toBe("ApproveAsk")
				expect(result.data.data.text).toBe("Approved with comment")
			}
		})

		it("should validate ApproveAsk command with empty data", () => {
			const approveCommand = {
				commandName: TaskCommandName.ApproveAsk,
				data: {},
			}

			const result = taskCommandSchema.safeParse(approveCommand)
			expect(result.success).toBe(true)
		})

		it("should validate DenyAsk command with optional text and images", () => {
			const denyCommand = {
				commandName: TaskCommandName.DenyAsk,
				data: { text: "Denied with reason", images: [] },
			}

			const result = taskCommandSchema.safeParse(denyCommand)
			expect(result.success).toBe(true)

			if (result.success) {
				expect(result.data.commandName).toBe("DenyAsk")
				expect(result.data.data.text).toBe("Denied with reason")
			}
		})

		it("should validate DenyAsk command with empty data", () => {
			const denyCommand = {
				commandName: TaskCommandName.DenyAsk,
				data: {},
			}

			const result = taskCommandSchema.safeParse(denyCommand)
			expect(result.success).toBe(true)
		})
	})
})
