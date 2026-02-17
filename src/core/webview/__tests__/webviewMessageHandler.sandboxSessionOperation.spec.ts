import { beforeEach, describe, expect, it, vi } from "vitest"

// Mocks must come before importing the module under test.
vi.mock("child_process", async (importOriginal) => {
	const actual = await importOriginal<typeof import("child_process")>()
	return {
		...actual,
		execFile: vi.fn((...args: any[]) => {
			const cb = args[args.length - 1]
			if (typeof cb === "function") {
				cb(null, "", "")
			}
		}),
	}
})

vi.mock("vscode", () => ({
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
	changeLanguage: vi.fn(),
}))

import type { ClineProvider } from "../ClineProvider"
import { webviewMessageHandler } from "../webviewMessageHandler"
import * as vscode from "vscode"
import { execFile } from "child_process"

describe("webviewMessageHandler - sandboxSessionOperation", () => {
	let provider: Pick<ClineProvider, "postMessageToWebview">

	beforeEach(() => {
		vi.clearAllMocks()
		provider = {
			postMessageToWebview: vi.fn(),
		} as any
	})

	it("refuses to stop non-sandbox Docker containers", async () => {
		await webviewMessageHandler(
			provider as any,
			{
				type: "sandboxSessionOperation",
				sandboxSessionOperation: "stop",
				containerName: "not-a-sandbox-container",
				executionId: "exec-1",
			} as any,
		)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Refusing to stop non-sandbox Docker container.")
		expect(execFile).not.toHaveBeenCalled()
		expect(provider.postMessageToWebview).not.toHaveBeenCalled()
	})

	it("stops a sandbox Docker session and posts a stopped status (success)", async () => {
		await webviewMessageHandler(
			provider as any,
			{
				type: "sandboxSessionOperation",
				sandboxSessionOperation: "stop",
				containerName: "roo-sbx-sess-abc123",
				executionId: "exec-2",
			} as any,
		)

		expect(execFile).toHaveBeenCalled()
		const [file, args, options] = (execFile as any).mock.calls[0]
		expect(file).toBe("docker")
		expect(args).toEqual(["rm", "-f", "roo-sbx-sess-abc123"])
		expect(options).toMatchObject({ timeout: 30_000 })

		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			"Stopped Docker sandbox session: roo-sbx-sess-abc123",
		)
		expect(provider.postMessageToWebview).toHaveBeenCalledWith({
			type: "commandExecutionStatus",
			text: JSON.stringify({
				executionId: "exec-2",
				status: "sandbox_session_stopped",
				containerName: "roo-sbx-sess-abc123",
				success: true,
			}),
		})
	})

	it("posts a stopped status (error) when stopping a sandbox session fails", async () => {
		vi.mocked(execFile as any).mockImplementationOnce((...args: any[]) => {
			const cb = args[args.length - 1]
			cb(new Error("docker failed"))
		})

		await webviewMessageHandler(
			provider as any,
			{
				type: "sandboxSessionOperation",
				sandboxSessionOperation: "stop",
				containerName: "roo-sbx-sess-def456",
				executionId: "exec-3",
			} as any,
		)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("Failed to stop Docker sandbox session:"),
		)

		const posted = (provider.postMessageToWebview as any).mock.calls[0][0]
		expect(posted.type).toBe("commandExecutionStatus")
		const payload = JSON.parse(posted.text)
		expect(payload).toMatchObject({
			executionId: "exec-3",
			status: "sandbox_session_stopped",
			containerName: "roo-sbx-sess-def456",
			success: false,
		})
		expect(typeof payload.error).toBe("string")
	})
})
