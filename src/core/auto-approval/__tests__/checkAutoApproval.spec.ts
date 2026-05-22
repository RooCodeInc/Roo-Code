import { checkAutoApproval } from "../index"
import type { ExtensionState } from "@roo-code/types"

function makeState(overrides: Record<string, unknown> = {}) {
	return {
		autoApprovalEnabled: false,
		alwaysAllowReadOnly: false,
		alwaysAllowWrite: false,
		alwaysAllowExecute: false,
		alwaysAllowMcp: false,
		alwaysAllowModeSwitch: false,
		alwaysAllowSubtasks: false,
		alwaysAllowFollowupQuestions: false,
		alwaysAllowReadOnlyOutsideWorkspace: false,
		alwaysAllowWriteOutsideWorkspace: false,
		alwaysAllowWriteProtected: false,
		followupAutoApproveTimeoutMs: 0,
		mcpServers: {},
		deniedCommands: [] as string[],
		allowedCommands: [] as string[],
		...overrides,
	} as Pick<ExtensionState, any>
}

describe("checkAutoApproval — denied commands enforcement", () => {
	const deniedCommands = ["rm", "sudo"]

	it("should deny a command matching the deny list even when autoApprovalEnabled is false", async () => {
		const result = await checkAutoApproval({
			state: makeState({ deniedCommands }),
			ask: "command",
			text: "rm -rf /tmp/test",
		})

		expect(result.decision).toBe("deny")
	})

	it("should deny a command matching the deny list even when alwaysAllowExecute is false", async () => {
		const result = await checkAutoApproval({
			state: makeState({ autoApprovalEnabled: true, deniedCommands }),
			ask: "command",
			text: "sudo apt install something",
		})

		expect(result.decision).toBe("deny")
	})

	it("should deny a chained command where denied command appears after &&", async () => {
		const result = await checkAutoApproval({
			state: makeState({ deniedCommands }),
			ask: "command",
			text: "cat file.txt && rm file.txt",
		})

		expect(result.decision).toBe("deny")
	})

	it("should deny the exact heredoc bypass scenario from the issue", async () => {
		const command = [
			"cat > verify-hook-install.nu << 'HEREDOC'",
			"use scripts/development/modules/nu/install_hooks.nu [install-git-hooks]",
			"let project_root = ($env | get -o FILE_PWD | default (pwd))",
			"install-git-hooks $project_root",
			"HEREDOC",
			"nu verify-hook-install.nu && rm verify-hook-install.nu",
		].join("\n")

		const result = await checkAutoApproval({
			state: makeState({
				autoApprovalEnabled: true,
				alwaysAllowExecute: true,
				deniedCommands: ["rm"],
				allowedCommands: ["cat", "nu"],
			}),
			ask: "command",
			text: command,
		})

		expect(result.decision).toBe("deny")
	})

	it("should return 'ask' for a non-denied command when autoApprovalEnabled is false", async () => {
		const result = await checkAutoApproval({
			state: makeState({ deniedCommands }),
			ask: "command",
			text: "git status",
		})

		expect(result.decision).toBe("ask")
	})

	it("should not deny when deny list is empty", async () => {
		const result = await checkAutoApproval({
			state: makeState(),
			ask: "command",
			text: "rm -rf /tmp/test",
		})

		expect(result.decision).toBe("ask")
	})

	it("should respect longest prefix match: allowed 'rm -i' overrides denied 'rm'", async () => {
		const result = await checkAutoApproval({
			state: makeState({
				autoApprovalEnabled: true,
				alwaysAllowExecute: true,
				deniedCommands: ["rm"],
				allowedCommands: ["rm -i"],
			}),
			ask: "command",
			text: "rm -i file.txt",
		})

		expect(result.decision).toBe("approve")
	})

	it("should return 'ask' when state is undefined", async () => {
		const result = await checkAutoApproval({
			state: undefined,
			ask: "command",
			text: "rm file",
		})

		expect(result.decision).toBe("ask")
	})
})
