// npx vitest run src/services/git-ai/__tests__/index.spec.ts

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import * as childProcess from "child_process"
import { EventEmitter } from "events"
import { Writable } from "stream"

import {
	checkpointBeforeEdit,
	checkpointAfterEdit,
	isGitAiAvailable,
	resetGitAiCache,
} from "../index"

// Mock child_process
vi.mock("child_process", () => ({
	exec: vi.fn(),
	spawn: vi.fn(),
}))

// Mock util.promisify to return a function that calls exec
vi.mock("util", () => ({
	promisify: (fn: any) => {
		return (...args: any[]) =>
			new Promise((resolve, reject) => {
				fn(...args, (error: any, stdout: any, stderr: any) => {
					if (error) {
						reject(error)
					} else {
						resolve({ stdout, stderr })
					}
				})
			})
	},
}))

function createMockProcess() {
	const proc = new EventEmitter() as any
	const stdinData: Buffer[] = []
	proc.stdin = new Writable({
		write(chunk: Buffer, _encoding: string, callback: () => void) {
			stdinData.push(chunk)
			callback()
		},
	})
	proc.stdout = null
	proc.stderr = null
	return { proc, stdinData }
}

function mockExecSuccess(stdout: string) {
	;(childProcess.exec as any).mockImplementation(
		(_cmd: string, _opts: any, callback?: Function) => {
			const cb = callback || _opts
			if (typeof cb === "function") {
				cb(null, stdout, "")
			}
		},
	)
}

function mockExecFailure(message = "not found") {
	;(childProcess.exec as any).mockImplementation(
		(_cmd: string, _opts: any, callback?: Function) => {
			const cb = callback || _opts
			if (typeof cb === "function") {
				cb(new Error(message), "", "")
			}
		},
	)
}

function createMockTask(overrides: Record<string, any> = {}) {
	return {
		taskId: "test-task-123",
		cwd: "/test/workspace",
		apiConversationHistory: [
			{ role: "user", content: "Fix the bug", ts: 1700000000000 },
			{ role: "assistant", content: "Done.", ts: 1700000001000 },
		],
		api: {
			getModel: () => ({ id: "claude-sonnet-4-20250514" }),
		},
		...overrides,
	} as any
}

describe("git-ai service", () => {
	beforeEach(() => {
		resetGitAiCache()
		vi.clearAllMocks()
	})

	describe("isGitAiAvailable", () => {
		it("returns true when git-ai is found", async () => {
			mockExecSuccess("/usr/local/bin/git-ai\n")

			const result = await isGitAiAvailable()

			expect(result).toBe(true)
		})

		it("returns false when git-ai is not found", async () => {
			mockExecFailure("not found")

			const result = await isGitAiAvailable()

			expect(result).toBe(false)
		})

		it("caches the result across calls", async () => {
			mockExecSuccess("/usr/local/bin/git-ai\n")

			await isGitAiAvailable()
			await isGitAiAvailable()

			// exec should only be called once for the `which` check
			expect(childProcess.exec).toHaveBeenCalledTimes(1)
		})
	})

	describe("checkpointBeforeEdit", () => {
		it("no-ops when git-ai is not installed", async () => {
			mockExecFailure("not found")

			await checkpointBeforeEdit("/test/workspace", ["src/file.ts"])

			expect(childProcess.spawn).not.toHaveBeenCalled()
		})

		it("no-ops when cwd is not a git repo", async () => {
			// First call: which git-ai succeeds
			// Second call: git rev-parse fails
			let callCount = 0
			;(childProcess.exec as any).mockImplementation(
				(_cmd: string, _opts: any, callback?: Function) => {
					const cb = callback || _opts
					callCount++
					if (callCount === 1) {
						// which git-ai
						cb(null, "/usr/local/bin/git-ai\n", "")
					} else {
						// git rev-parse --show-toplevel
						cb(new Error("not a git repo"), "", "")
					}
				},
			)

			await checkpointBeforeEdit("/not/a/repo", ["src/file.ts"])

			expect(childProcess.spawn).not.toHaveBeenCalled()
		})

		it("sends correct pre-edit payload via stdin", async () => {
			// which git-ai succeeds, git rev-parse succeeds
			let callCount = 0
			;(childProcess.exec as any).mockImplementation(
				(_cmd: string, _opts: any, callback?: Function) => {
					const cb = callback || _opts
					callCount++
					if (callCount <= 1) {
						cb(null, "/usr/local/bin/git-ai\n", "")
					} else {
						cb(null, "/test/repo\n", "")
					}
				},
			)

			const { proc, stdinData } = createMockProcess()
			;(childProcess.spawn as any).mockReturnValue(proc)

			const promise = checkpointBeforeEdit("/test/workspace", ["src/file.ts"])

			// Simulate successful exit
			setTimeout(() => proc.emit("close", 0), 10)

			await promise

			expect(childProcess.spawn).toHaveBeenCalledWith(
				"git-ai",
				["checkpoint", "agent-v1", "--hook-input", "stdin"],
				expect.objectContaining({ cwd: "/test/repo" }),
			)

			const payload = JSON.parse(Buffer.concat(stdinData).toString())
			expect(payload).toEqual({
				type: "human",
				repo_working_dir: "/test/repo",
				will_edit_filepaths: ["src/file.ts"],
			})
		})
	})

	describe("checkpointAfterEdit", () => {
		it("no-ops when git-ai is not installed", async () => {
			mockExecFailure("not found")

			const task = createMockTask()
			await checkpointAfterEdit("/test/workspace", task, ["src/file.ts"])

			expect(childProcess.spawn).not.toHaveBeenCalled()
		})

		it("sends correct post-edit payload via stdin", async () => {
			let callCount = 0
			;(childProcess.exec as any).mockImplementation(
				(_cmd: string, _opts: any, callback?: Function) => {
					const cb = callback || _opts
					callCount++
					if (callCount <= 1) {
						cb(null, "/usr/local/bin/git-ai\n", "")
					} else {
						cb(null, "/test/repo\n", "")
					}
				},
			)

			const { proc, stdinData } = createMockProcess()
			;(childProcess.spawn as any).mockReturnValue(proc)

			const task = createMockTask()
			const promise = checkpointAfterEdit("/test/workspace", task, ["src/file.ts"])

			setTimeout(() => proc.emit("close", 0), 10)

			await promise

			const payload = JSON.parse(Buffer.concat(stdinData).toString())
			expect(payload.type).toBe("ai_agent")
			expect(payload.repo_working_dir).toBe("/test/repo")
			expect(payload.agent_name).toBe("roo-code")
			expect(payload.model).toBe("claude-sonnet-4-20250514")
			expect(payload.conversation_id).toBe("test-task-123")
			expect(payload.edited_filepaths).toEqual(["src/file.ts"])
			expect(payload.transcript.messages).toHaveLength(2)
			expect(payload.transcript.messages[0].type).toBe("user")
			expect(payload.transcript.messages[1].type).toBe("assistant")
		})
	})

	describe("error handling", () => {
		it("checkpointBeforeEdit never throws", async () => {
			let callCount = 0
			;(childProcess.exec as any).mockImplementation(
				(_cmd: string, _opts: any, callback?: Function) => {
					const cb = callback || _opts
					callCount++
					if (callCount <= 1) {
						cb(null, "/usr/local/bin/git-ai\n", "")
					} else {
						cb(null, "/test/repo\n", "")
					}
				},
			)

			const { proc } = createMockProcess()
			;(childProcess.spawn as any).mockReturnValue(proc)

			const promise = checkpointBeforeEdit("/test/workspace", ["file.ts"])

			// Simulate failure exit
			setTimeout(() => proc.emit("close", 1), 10)

			// Should not throw
			await expect(promise).resolves.toBeUndefined()
		})

		it("checkpointAfterEdit never throws", async () => {
			let callCount = 0
			;(childProcess.exec as any).mockImplementation(
				(_cmd: string, _opts: any, callback?: Function) => {
					const cb = callback || _opts
					callCount++
					if (callCount <= 1) {
						cb(null, "/usr/local/bin/git-ai\n", "")
					} else {
						cb(null, "/test/repo\n", "")
					}
				},
			)

			;(childProcess.spawn as any).mockImplementation(() => {
				throw new Error("spawn failed")
			})

			const task = createMockTask()

			// Should not throw
			await expect(
				checkpointAfterEdit("/test/workspace", task, ["file.ts"]),
			).resolves.toBeUndefined()
		})
	})
})
