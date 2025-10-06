// npx vitest run src/integrations/terminal/__tests__/TerminalRegistry.spec.ts

import * as vscode from "vscode"
import { Terminal } from "../Terminal"
import { TerminalRegistry } from "../TerminalRegistry"
import { arePathsEqual } from "../../../utils/path"

const PAGER = process.platform === "win32" ? "" : "cat"

vi.mock("../../../utils/path", () => ({
	arePathsEqual: vi.fn((a, b) => a === b),
}))

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

	describe("getOrCreateTerminal", () => {
		let createTerminalSpy: any

		beforeEach(() => {
			// Reset terminals before each test
			;(TerminalRegistry as any).terminals = []
			createTerminalSpy = vi.spyOn(TerminalRegistry, "createTerminal")
		})

		afterEach(() => {
			createTerminalSpy.mockRestore()
		})

		it("should create a new terminal if none exist", async () => {
			await TerminalRegistry.getOrCreateTerminal("/test/path", "task1")
			expect(createTerminalSpy).toHaveBeenCalledWith("/test/path", "vscode")
		})

		it("should reuse a terminal with the same task ID and cwd", async () => {
			const existingTerminal = new Terminal(1, undefined, "/test/path")
			existingTerminal.taskId = "task1"
			;(TerminalRegistry as any).terminals.push(existingTerminal)

			const terminal = await TerminalRegistry.getOrCreateTerminal("/test/path", "task1")
			expect(terminal).toBe(existingTerminal)
			expect(createTerminalSpy).not.toHaveBeenCalled()
		})

		it("should reuse an idle terminal with the same cwd", async () => {
			const existingTerminal = new Terminal(1, undefined, "/test/path")
			;(TerminalRegistry as any).terminals.push(existingTerminal)

			const terminal = await TerminalRegistry.getOrCreateTerminal("/test/path", "task2")
			expect(terminal).toBe(existingTerminal)
			expect(createTerminalSpy).not.toHaveBeenCalled()
		})

		it("should reuse an idle terminal with a different cwd if no better option is available", async () => {
			const existingTerminal = new Terminal(1, undefined, "/other/path")
			;(TerminalRegistry as any).terminals.push(existingTerminal)

			const terminal = await TerminalRegistry.getOrCreateTerminal("/test/path", "task1")
			expect(terminal).toBe(existingTerminal)
			expect(createTerminalSpy).not.toHaveBeenCalled()
			expect(terminal.requestedCwd).toBe("/test/path")
		})

		it("should prioritize reusing a terminal with the same task ID when cwd has drifted", async () => {
			const terminal1 = new Terminal(1, undefined, "/other/path1")
			terminal1.taskId = "task1"
			const terminal2 = new Terminal(2, undefined, "/other/path2")
			terminal2.taskId = "task2"
			;(TerminalRegistry as any).terminals.push(terminal1, terminal2)

			const terminal = await TerminalRegistry.getOrCreateTerminal("/test/path", "task1")
			expect(terminal).toBe(terminal1)
			expect(createTerminalSpy).not.toHaveBeenCalled()
		})

		it("should create a new terminal if all existing terminals are busy", async () => {
			const existingTerminal = new Terminal(1, undefined, "/test/path")
			existingTerminal.busy = true
			;(TerminalRegistry as any).terminals.push(existingTerminal)

			await TerminalRegistry.getOrCreateTerminal("/test/path", "task1")
			expect(createTerminalSpy).toHaveBeenCalledWith("/test/path", "vscode")
		})

		it("should set the requestedCwd on the returned terminal", async () => {
			const terminal = await TerminalRegistry.getOrCreateTerminal("/test/path", "task1")
			expect(terminal.requestedCwd).toBe("/test/path")
		})
	})
})
