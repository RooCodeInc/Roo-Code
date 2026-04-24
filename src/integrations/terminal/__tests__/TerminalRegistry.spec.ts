// npx vitest run src/integrations/terminal/__tests__/TerminalRegistry.spec.ts

import * as vscode from "vscode"
import { Terminal } from "../Terminal"
import { TerminalRegistry } from "../TerminalRegistry"

const PAGER = process.platform === "win32" ? "" : "cat"

vi.mock("execa", () => ({
	execa: vi.fn(),
}))

describe("TerminalRegistry", () => {
	let mockCreateTerminal: any

	beforeEach(() => {
		mockCreateTerminal = vi.spyOn(vscode.window, "createTerminal").mockImplementation(
			(...args: any[]) =>
				({
					exitStatus: undefined,
					name: "Roo Code",
					processId: Promise.resolve(123),
					creationOptions: {},
					state: {
						isInteractedWith: true,
						shell: { id: "test-shell", executable: "/bin/bash", args: [] },
					},
					dispose: vi.fn(),
					hide: vi.fn(),
					show: vi.fn(),
					sendText: vi.fn(),
					shellIntegration: {
						executeCommand: vi.fn(),
					},
				}) as any,
		)
	})

	describe("createTerminal", () => {
		it("creates terminal with PAGER set appropriately for platform", () => {
			TerminalRegistry.createTerminal("/test/path", "vscode")

			expect(mockCreateTerminal).toHaveBeenCalledWith({
				cwd: "/test/path",
				name: "Roo Code",
				iconPath: expect.any(Object),
				env: {
					PAGER,
					ROO_ACTIVE: "true",
					VTE_VERSION: "0",
					PROMPT_EOL_MARK: "",
				},
			})
		})

		it("adds PROMPT_COMMAND when Terminal.getCommandDelay() > 0", () => {
			// Set command delay to 50ms for this test
			const originalDelay = Terminal.getCommandDelay()
			Terminal.setCommandDelay(50)

			try {
				TerminalRegistry.createTerminal("/test/path", "vscode")

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "Roo Code",
					iconPath: expect.any(Object),
					env: {
						PAGER,
						ROO_ACTIVE: "true",
						PROMPT_COMMAND: "sleep 0.05",
						VTE_VERSION: "0",
						PROMPT_EOL_MARK: "",
					},
				})
			} finally {
				// Restore original delay
				Terminal.setCommandDelay(originalDelay)
			}
		})

		it("adds Oh My Zsh integration env var when enabled", () => {
			Terminal.setTerminalZshOhMy(true)
			try {
				TerminalRegistry.createTerminal("/test/path", "vscode")

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "Roo Code",
					iconPath: expect.any(Object),
					env: {
						PAGER,
						ROO_ACTIVE: "true",
						VTE_VERSION: "0",
						PROMPT_EOL_MARK: "",
						ITERM_SHELL_INTEGRATION_INSTALLED: "Yes",
					},
				})
			} finally {
				Terminal.setTerminalZshOhMy(false)
			}
		})

		it("adds Powerlevel10k integration env var when enabled", () => {
			Terminal.setTerminalZshP10k(true)
			try {
				TerminalRegistry.createTerminal("/test/path", "vscode")

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "Roo Code",
					iconPath: expect.any(Object),
					env: {
						PAGER,
						ROO_ACTIVE: "true",
						VTE_VERSION: "0",
						PROMPT_EOL_MARK: "",
						POWERLEVEL9K_TERM_SHELL_INTEGRATION: "true",
					},
				})
			} finally {
				Terminal.setTerminalZshP10k(false)
			}
		})
	})

	describe("maxTerminalPoolSize", () => {
		it("has a default pool size of 5", () => {
			expect(TerminalRegistry.getMaxTerminalPoolSize()).toBe(5)
		})

		it("allows setting pool size within bounds", () => {
			const original = TerminalRegistry.getMaxTerminalPoolSize()
			try {
				TerminalRegistry.setMaxTerminalPoolSize(10)
				expect(TerminalRegistry.getMaxTerminalPoolSize()).toBe(10)

				TerminalRegistry.setMaxTerminalPoolSize(1)
				expect(TerminalRegistry.getMaxTerminalPoolSize()).toBe(1)

				TerminalRegistry.setMaxTerminalPoolSize(20)
				expect(TerminalRegistry.getMaxTerminalPoolSize()).toBe(20)
			} finally {
				TerminalRegistry.setMaxTerminalPoolSize(original)
			}
		})

		it("clamps pool size to minimum of 1", () => {
			const original = TerminalRegistry.getMaxTerminalPoolSize()
			try {
				TerminalRegistry.setMaxTerminalPoolSize(0)
				expect(TerminalRegistry.getMaxTerminalPoolSize()).toBe(1)

				TerminalRegistry.setMaxTerminalPoolSize(-5)
				expect(TerminalRegistry.getMaxTerminalPoolSize()).toBe(1)
			} finally {
				TerminalRegistry.setMaxTerminalPoolSize(original)
			}
		})

		it("clamps pool size to maximum of 20", () => {
			const original = TerminalRegistry.getMaxTerminalPoolSize()
			try {
				TerminalRegistry.setMaxTerminalPoolSize(25)
				expect(TerminalRegistry.getMaxTerminalPoolSize()).toBe(20)

				TerminalRegistry.setMaxTerminalPoolSize(100)
				expect(TerminalRegistry.getMaxTerminalPoolSize()).toBe(20)
			} finally {
				TerminalRegistry.setMaxTerminalPoolSize(original)
			}
		})

		it("disposes oldest idle terminal when pool is at capacity", () => {
			const original = TerminalRegistry.getMaxTerminalPoolSize()
			try {
				TerminalRegistry.setMaxTerminalPoolSize(2)

				// Create 2 terminals to reach the limit
				const t1 = TerminalRegistry.createTerminal("/test/path1", "vscode")
				const t2 = TerminalRegistry.createTerminal("/test/path2", "vscode")

				// The first terminal should have been disposed to make room for the second
				// since pool size is 2, creating the 2nd should be fine
				// but creating a 3rd should dispose the first idle one
				const t3 = TerminalRegistry.createTerminal("/test/path3", "vscode")

				// t1's underlying vscode terminal should have been disposed
				expect((t1 as Terminal).terminal.dispose).toHaveBeenCalled()
			} finally {
				TerminalRegistry.setMaxTerminalPoolSize(original)
			}
		})
	})

	describe("releaseTerminalsForTask", () => {
		it("disposes idle terminals when releasing a task", () => {
			const t1 = TerminalRegistry.createTerminal("/test/path", "vscode")
			t1.taskId = "task-1"

			TerminalRegistry.releaseTerminalsForTask("task-1")

			// The terminal should have been disposed since it was idle
			expect((t1 as Terminal).terminal.dispose).toHaveBeenCalled()
		})

		it("does not dispose busy terminals when releasing a task", () => {
			const t1 = TerminalRegistry.createTerminal("/test/path", "vscode")
			t1.taskId = "task-2"
			t1.busy = true

			TerminalRegistry.releaseTerminalsForTask("task-2")

			// The terminal should NOT have been disposed since it was busy
			expect((t1 as Terminal).terminal.dispose).not.toHaveBeenCalled()
			// But its taskId should have been cleared
			expect(t1.taskId).toBeUndefined()
		})

		it("does not dispose terminals belonging to other tasks", () => {
			const t1 = TerminalRegistry.createTerminal("/test/path", "vscode")
			t1.taskId = "task-3"

			const t2 = TerminalRegistry.createTerminal("/test/path", "vscode")
			t2.taskId = "task-4"

			TerminalRegistry.releaseTerminalsForTask("task-3")

			// t1 should be disposed (idle, belongs to task-3)
			expect((t1 as Terminal).terminal.dispose).toHaveBeenCalled()
			// t2 should NOT be disposed (belongs to task-4)
			expect((t2 as Terminal).terminal.dispose).not.toHaveBeenCalled()
		})
	})
})
