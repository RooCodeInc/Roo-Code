import { randomUUID } from "crypto"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"

import { Task } from "../../task/Task"

import { executeCommandInTerminal } from "../ExecuteCommandTool"

describe("executeCommandInTerminal integration", () => {
	it("returns promptly for explicit trailing background commands", async () => {
		if (process.platform === "win32") {
			return
		}

		const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "roo-execute-command-bg-"))
		const taskId = `test-task-${randomUUID()}`

		try {
			const provider = {
				postMessageToWebview: vitest.fn(),
				getState: vitest.fn().mockResolvedValue({}),
				context: undefined,
			}

			const task = {
				cwd,
				taskId,
				providerRef: {
					deref: vitest.fn().mockResolvedValue(provider),
				},
				say: vitest.fn().mockResolvedValue(undefined),
				ask: vitest.fn(),
				terminalProcess: undefined,
				supersedePendingAsk: vitest.fn(),
			} as unknown as Task

			const startedAt = Date.now()
			const [rejected, result] = await executeCommandInTerminal(task, {
				executionId: "integration-bg-1",
				command: "sleep 2 &",
				terminalShellIntegrationDisabled: true,
			})
			const elapsedMs = Date.now() - startedAt

			expect(rejected).toBe(false)
			expect(elapsedMs).toBeLessThan(1_200)
			expect(result).toContain("Command is still running in terminal")
		} finally {
			await fs.rm(cwd, { recursive: true, force: true })
		}
	})

	it("does not treat mid-command backgrounding as explicit background execution", async () => {
		if (process.platform === "win32") {
			return
		}

		const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "roo-execute-command-mid-bg-"))
		const taskId = `test-task-${randomUUID()}`

		try {
			const provider = {
				postMessageToWebview: vitest.fn(),
				getState: vitest.fn().mockResolvedValue({}),
				context: undefined,
			}

			const task = {
				cwd,
				taskId,
				providerRef: {
					deref: vitest.fn().mockResolvedValue(provider),
				},
				say: vitest.fn().mockResolvedValue(undefined),
				ask: vitest.fn(),
				terminalProcess: undefined,
				supersedePendingAsk: vitest.fn(),
			} as unknown as Task

			const startedAt = Date.now()
			const [rejected, result] = await executeCommandInTerminal(task, {
				executionId: "integration-bg-2",
				command: "sleep 1 & sleep 1; echo done",
				terminalShellIntegrationDisabled: true,
			})
			const elapsedMs = Date.now() - startedAt

			expect(rejected).toBe(false)
			expect(elapsedMs).toBeGreaterThan(700)
			expect(result).toContain("Exit code: 0")
			expect(result).toContain("done")
			expect(result).not.toContain("Command is still running in terminal")
		} finally {
			await fs.rm(cwd, { recursive: true, force: true })
		}
	})
})
