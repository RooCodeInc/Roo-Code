import { checkAutoApproval } from "../index"

describe("checkAutoApproval — denied commands enforcement", () => {
	const baseState = {
		autoApprovalEnabled: false,
		alwaysAllowReadOnly: false,
		alwaysAllowReadOnlyOutsideWorkspace: false,
		alwaysAllowWrite: false,
		alwaysAllowWriteOutsideWorkspace: false,
		alwaysAllowWriteProtected: false,
		alwaysAllowExecute: false,
		alwaysAllowMcp: false,
		alwaysAllowModeSwitch: false,
		alwaysAllowSubtasks: false,
		alwaysAllowFollowupQuestions: false,
		allowedCommands: [] as string[],
		deniedCommands: ["rm"],
		followupAutoApproveTimeoutMs: 0,
		mcpServers: [] as any[],
	}

	it("should deny a denied command even when autoApprovalEnabled is false", async () => {
		const result = await checkAutoApproval({
			state: { ...baseState, autoApprovalEnabled: false },
			ask: "command",
			text: "rm -rf /tmp/test",
		})
		expect(result.decision).toBe("deny")
	})

	it("should deny a denied command even when alwaysAllowExecute is false", async () => {
		const result = await checkAutoApproval({
			state: { ...baseState, autoApprovalEnabled: true, alwaysAllowExecute: false },
			ask: "command",
			text: "rm -rf /tmp/test",
		})
		expect(result.decision).toBe("deny")
	})

	it("should deny a denied command when alwaysAllowExecute is true", async () => {
		const result = await checkAutoApproval({
			state: { ...baseState, autoApprovalEnabled: true, alwaysAllowExecute: true },
			ask: "command",
			text: "rm -rf /tmp/test",
		})
		expect(result.decision).toBe("deny")
	})

	it("should deny a denied command inside a chained command (&&)", async () => {
		const result = await checkAutoApproval({
			state: { ...baseState, autoApprovalEnabled: false },
			ask: "command",
			text: "echo hello && rm verify-hook-install.nu",
		})
		expect(result.decision).toBe("deny")
	})

	it("should deny a denied command inside a chained command with heredoc-style wrapping", async () => {
		const command = `cat > verify.nu << 'HEREDOC'
some content
HEREDOC
nu verify.nu && rm verify.nu`
		const result = await checkAutoApproval({
			state: { ...baseState, autoApprovalEnabled: false },
			ask: "command",
			text: command,
		})
		expect(result.decision).toBe("deny")
	})

	it("should not deny commands that are not in the deny list", async () => {
		const result = await checkAutoApproval({
			state: { ...baseState, autoApprovalEnabled: false },
			ask: "command",
			text: "git status",
		})
		// Should return "ask" since auto-approval is disabled and command is not denied
		expect(result.decision).toBe("ask")
	})

	it("should not deny when deniedCommands list is empty", async () => {
		const result = await checkAutoApproval({
			state: { ...baseState, deniedCommands: [], autoApprovalEnabled: false },
			ask: "command",
			text: "rm -rf /tmp/test",
		})
		// Should return "ask" since there's no deny list and auto-approval is disabled
		expect(result.decision).toBe("ask")
	})

	it("should not deny when state is undefined", async () => {
		const result = await checkAutoApproval({
			state: undefined,
			ask: "command",
			text: "rm -rf /tmp/test",
		})
		// Should return "ask" since state is undefined
		expect(result.decision).toBe("ask")
	})

	it("should allow a more specific allowed command to override a denied prefix", async () => {
		const result = await checkAutoApproval({
			state: {
				...baseState,
				autoApprovalEnabled: true,
				alwaysAllowExecute: true,
				allowedCommands: ["rm -i"],
				deniedCommands: ["rm"],
			},
			ask: "command",
			text: "rm -i file.txt",
		})
		// "rm -i" (length 4) is more specific than "rm" (length 2), so allowed wins
		expect(result.decision).toBe("approve")
	})

	it("should deny when denied prefix is more specific than allowed prefix", async () => {
		const result = await checkAutoApproval({
			state: {
				...baseState,
				autoApprovalEnabled: true,
				alwaysAllowExecute: true,
				allowedCommands: ["git"],
				deniedCommands: ["git push"],
			},
			ask: "command",
			text: "git push origin main",
		})
		// "git push" (length 8) is more specific than "git" (length 3), so deny wins
		expect(result.decision).toBe("deny")
	})
})
