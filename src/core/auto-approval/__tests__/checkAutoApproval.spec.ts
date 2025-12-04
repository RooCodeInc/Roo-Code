import { describe, it, expect } from "vitest"
import { checkAutoApproval } from "../index"

describe("checkAutoApproval", () => {
	describe("command auto-approval", () => {
		it("should ask user when autoApprovalEnabled is false, even if alwaysAllowExecute is true", async () => {
			const state = {
				autoApprovalEnabled: false,
				alwaysAllowExecute: true,
				allowedCommands: ["*"],
				deniedCommands: [],
			}

			const result = await checkAutoApproval({
				state,
				ask: "command",
				text: "echo hello",
			})

			expect(result.decision).toBe("ask")
		})

		it("should ask user when alwaysAllowExecute is false, even if autoApprovalEnabled is true", async () => {
			const state = {
				autoApprovalEnabled: true,
				alwaysAllowExecute: false,
				allowedCommands: ["*"],
				deniedCommands: [],
			}

			const result = await checkAutoApproval({
				state,
				ask: "command",
				text: "echo hello",
			})

			expect(result.decision).toBe("ask")
		})

		it("should auto-approve when both autoApprovalEnabled and alwaysAllowExecute are true and command is allowed", async () => {
			const state = {
				autoApprovalEnabled: true,
				alwaysAllowExecute: true,
				allowedCommands: ["echo"],
				deniedCommands: [],
			}

			const result = await checkAutoApproval({
				state,
				ask: "command",
				text: "echo hello",
			})

			expect(result.decision).toBe("approve")
		})

		it("should auto-deny when both autoApprovalEnabled and alwaysAllowExecute are true but command is denied", async () => {
			const state = {
				autoApprovalEnabled: true,
				alwaysAllowExecute: true,
				allowedCommands: ["*"],
				deniedCommands: ["rm"],
			}

			const result = await checkAutoApproval({
				state,
				ask: "command",
				text: "rm -rf /",
			})

			expect(result.decision).toBe("deny")
		})

		it("should ask user when both autoApprovalEnabled and alwaysAllowExecute are true but command is not in allowlist", async () => {
			const state = {
				autoApprovalEnabled: true,
				alwaysAllowExecute: true,
				allowedCommands: ["echo", "ls"],
				deniedCommands: [],
			}

			const result = await checkAutoApproval({
				state,
				ask: "command",
				text: "cat /etc/passwd",
			})

			expect(result.decision).toBe("ask")
		})

		it("should ask user when no text is provided", async () => {
			const state = {
				autoApprovalEnabled: true,
				alwaysAllowExecute: true,
				allowedCommands: ["*"],
				deniedCommands: [],
			}

			const result = await checkAutoApproval({
				state,
				ask: "command",
				text: undefined,
			})

			expect(result.decision).toBe("ask")
		})

		it("should ask user when both flags are undefined", async () => {
			const state = {
				allowedCommands: ["*"],
				deniedCommands: [],
			}

			const result = await checkAutoApproval({
				state,
				ask: "command",
				text: "echo hello",
			})

			expect(result.decision).toBe("ask")
		})

		it("should ask user when state is undefined", async () => {
			const result = await checkAutoApproval({
				state: undefined,
				ask: "command",
				text: "echo hello",
			})

			expect(result.decision).toBe("ask")
		})
	})

	describe("other ask types", () => {
		it("should handle non-command asks normally when autoApprovalEnabled is true", async () => {
			const state = {
				autoApprovalEnabled: true,
				alwaysAllowReadOnly: true,
			}

			const result = await checkAutoApproval({
				state,
				ask: "tool",
				text: JSON.stringify({ tool: "readFile", path: "test.txt" }),
			})

			expect(result.decision).toBe("approve")
		})

		it("should ask for non-command asks when autoApprovalEnabled is false", async () => {
			const state = {
				autoApprovalEnabled: false,
				alwaysAllowReadOnly: true,
			}

			const result = await checkAutoApproval({
				state,
				ask: "tool",
				text: JSON.stringify({ tool: "readFile", path: "test.txt" }),
			})

			expect(result.decision).toBe("ask")
		})
	})
})
