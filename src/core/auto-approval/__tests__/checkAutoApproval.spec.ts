import fs from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it } from "vitest"

import { checkAutoApproval } from "../index"

describe("checkAutoApproval with risk policy", () => {
	const createdDirs: string[] = []

	afterEach(async () => {
		await Promise.all(
			createdDirs.splice(0).map(async (dir) => {
				await fs.rm(dir, { recursive: true, force: true })
			}),
		)
	})

	const createCwd = async () => {
		const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "roo-auto-approval-"))
		createdDirs.push(cwd)
		return cwd
	}

	it("allows auto-approval for command approval risk class R2 (manual-first) when configured", async () => {
		const cwd = await createCwd()

		const result = await checkAutoApproval({
			cwd,
			ask: "command",
			text: "pnpm test",
			state: {
				autoApprovalEnabled: true,
				alwaysAllowExecute: true,
				allowedCommands: ["*"],
				deniedCommands: [],
			} as any,
		})

		expect(result.decision).toBe("approve")
	})

	it("keeps low-risk write tool auto-approval for R1 when configured", async () => {
		const cwd = await createCwd()

		const result = await checkAutoApproval({
			cwd,
			ask: "tool",
			text: JSON.stringify({ tool: "editedExistingFile", path: "src/app.ts" }),
			state: {
				autoApprovalEnabled: true,
				alwaysAllowWrite: true,
				alwaysAllowWriteOutsideWorkspace: true,
				alwaysAllowWriteProtected: true,
			} as any,
		})

		expect(result.decision).toBe("approve")
	})

	it("escalates protected tool actions to manual ask", async () => {
		const cwd = await createCwd()

		const result = await checkAutoApproval({
			cwd,
			ask: "tool",
			text: JSON.stringify({ tool: "editedExistingFile", path: ".roo/settings.json", isProtected: true }),
			isProtected: true,
			state: {
				autoApprovalEnabled: true,
				alwaysAllowWrite: true,
				alwaysAllowWriteOutsideWorkspace: true,
				alwaysAllowWriteProtected: true,
			} as any,
		})

		expect(result.decision).toBe("ask")
	})

	it("forces manual ask for browser actions risk class R3", async () => {
		const cwd = await createCwd()

		const result = await checkAutoApproval({
			cwd,
			ask: "browser_action_launch",
			text: "https://example.com",
			state: {
				autoApprovalEnabled: true,
				alwaysAllowBrowser: true,
			} as any,
		})

		expect(result.decision).toBe("ask")
	})

	it("auto-approves followup suggestions with timeout when enabled", async () => {
		const cwd = await createCwd()
		const result = await checkAutoApproval({
			cwd,
			ask: "followup",
			text: JSON.stringify({
				question: "How should we proceed?",
				suggest: [{ answer: "Continue with the current provider" }],
			}),
			state: {
				autoApprovalEnabled: true,
				alwaysAllowFollowupQuestions: true,
				followupAutoApproveTimeoutMs: 1200,
			} as any,
		})

		expect(result.decision).toBe("timeout")
	})

	it("forces manual followup when explicitly requested by caller", async () => {
		const cwd = await createCwd()
		const result = await checkAutoApproval({
			cwd,
			ask: "followup",
			text: JSON.stringify({
				question: "How should we proceed?",
				suggest: [{ answer: "Continue with the current provider" }],
			}),
			followupAutoResponseText: "Terminate now with no additional assistant output.",
			state: {
				autoApprovalEnabled: true,
				alwaysAllowFollowupQuestions: true,
				followupAutoApproveTimeoutMs: 1200,
			} as any,
		})

		expect(result.decision).toBe("timeout")
		if (result.decision === "timeout") {
			expect(result.fn().text).toBe("Terminate now with no additional assistant output.")
		}
	})

	it("allows auto-approval for MCP tool when alwaysAllow is enabled (manual-first policy)", async () => {
		const cwd = await createCwd()

		const result = await checkAutoApproval({
			cwd,
			ask: "use_mcp_server",
			text: JSON.stringify({
				type: "use_mcp_tool",
				serverName: "Test Server",
				toolName: "read-file",
			}),
			state: {
				autoApprovalEnabled: true,
				alwaysAllowMcp: true,
				mcpServers: [
					{
						name: "test server",
						tools: [{ name: "read_file", alwaysAllow: true }],
					},
				],
			} as any,
		})

		expect(result.decision).toBe("approve")
	})
})
