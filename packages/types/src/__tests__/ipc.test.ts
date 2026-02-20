import { TaskCommandName, taskCommandSchema } from "../ipc.js"

describe("IPC Types", () => {
	describe("TaskCommandName", () => {
		it("should include ResumeTask command", () => {
			expect(TaskCommandName.ResumeTask).toBe("ResumeTask")
		})

		it("should include DeleteQueuedMessage command", () => {
			expect(TaskCommandName.DeleteQueuedMessage).toBe("DeleteQueuedMessage")
		})

		it("should have all expected task commands", () => {
			const expectedCommands = [
				"StartNewTask",
				"CancelTask",
				"CloseTask",
				"ResumeTask",
				"SendMessage",
				"DeleteQueuedMessage",
			]
			const actualCommands = Object.values(TaskCommandName)

			expectedCommands.forEach((command) => {
				expect(actualCommands).toContain(command)
			})
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

				if (result.success && result.data.commandName === TaskCommandName.ResumeTask) {
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

			if (result.success && result.data.commandName === TaskCommandName.ResumeTask) {
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

		it("should validate DeleteQueuedMessage command with messageId", () => {
			const command = {
				commandName: TaskCommandName.DeleteQueuedMessage,
				data: "msg-abc-123",
			}

			const result = taskCommandSchema.safeParse(command)
			expect(result.success).toBe(true)

			if (result.success && result.data.commandName === TaskCommandName.DeleteQueuedMessage) {
				expect(result.data.commandName).toBe("DeleteQueuedMessage")
				expect(result.data.data).toBe("msg-abc-123")
			}
		})

		it("should reject DeleteQueuedMessage command with invalid data", () => {
			const invalidCommand = {
				commandName: TaskCommandName.DeleteQueuedMessage,
				data: 123, // Should be string
			}

			const result = taskCommandSchema.safeParse(invalidCommand)
			expect(result.success).toBe(false)
		})

		it("should reject DeleteQueuedMessage command without data", () => {
			const invalidCommand = {
				commandName: TaskCommandName.DeleteQueuedMessage,
				// Missing data field
			}

			const result = taskCommandSchema.safeParse(invalidCommand)
			expect(result.success).toBe(false)
		})
	})
})
