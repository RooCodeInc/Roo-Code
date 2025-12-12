// npx vitest run src/integrations/terminal/__tests__/TerminalRegistry.spec.ts

import * as vscode from "vscode"
import { Terminal } from "../Terminal"
import { TerminalRegistry } from "../TerminalRegistry"

const PAGER = process.platform === "win32" ? "" : "cat"

vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue(null),
		}),
	},
	window: {
		createTerminal: vi.fn(),
		onDidStartTerminalShellExecution: vi.fn(),
		onDidEndTerminalShellExecution: vi.fn(),
		onDidCloseTerminal: vi.fn(),
	},
	extensions: {
		getExtension: vi.fn().mockReturnValue({
			extensionUri: { fsPath: "/test/extension/path" },
		}),
		all: [],
	},
	Uri: {
		joinPath: vi.fn((uri, ...paths) => ({ fsPath: `${uri.fsPath}/${paths.join("/")}` })),
		file: (path: string) => ({ fsPath: path }),
	},
	ThemeIcon: class ThemeIcon {
		constructor(id: string) {
			this.id = id
		}
		id: string
	},
	env: {
		clipboard: {
			readText: vi.fn().mockResolvedValue(""),
			writeText: vi.fn().mockResolvedValue(undefined),
		},
	},
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
	},
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
					name: "CoStrict",
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

			const expectedEnv: Record<string, string> = {
				PAGER,
				VTE_VERSION: "0",
				PROMPT_EOL_MARK: "",
			}

			// Only expect PYTHONIOENCODING on Windows
			if (process.platform === "win32") {
				expectedEnv.PYTHONIOENCODING = "utf-8"
			}

			expect(mockCreateTerminal).toHaveBeenCalledWith({
				cwd: "/test/path",
				name: "CoStrict",
				iconPath: expect.any(Object),
				env: expectedEnv,
			})
		})

		it("adds PROMPT_COMMAND when Terminal.getCommandDelay() > 0", () => {
			// Set command delay to 50ms for this test
			const originalDelay = Terminal.getCommandDelay()
			Terminal.setCommandDelay(50)

			try {
				TerminalRegistry.createTerminal("/test/path", "vscode")

				const expectedEnv: Record<string, string> = {
					PAGER,
					PROMPT_COMMAND: "sleep 0.05",
					VTE_VERSION: "0",
					PROMPT_EOL_MARK: "",
				}

				// Only expect PYTHONIOENCODING on Windows
				if (process.platform === "win32") {
					expectedEnv.PYTHONIOENCODING = "utf-8"
				}

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "CoStrict",
					iconPath: expect.any(Object),
					env: expectedEnv,
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

				const expectedEnv: Record<string, string> = {
					PAGER,
					VTE_VERSION: "0",
					PROMPT_EOL_MARK: "",
					ITERM_SHELL_INTEGRATION_INSTALLED: "Yes",
				}

				// Only expect PYTHONIOENCODING on Windows
				if (process.platform === "win32") {
					expectedEnv.PYTHONIOENCODING = "utf-8"
				}

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "CoStrict",
					iconPath: expect.any(Object),
					env: expectedEnv,
				})
			} finally {
				Terminal.setTerminalZshOhMy(false)
			}
		})

		it("adds Powerlevel10k integration env var when enabled", () => {
			Terminal.setTerminalZshP10k(true)
			try {
				TerminalRegistry.createTerminal("/test/path", "vscode")

				const expectedEnv: Record<string, string> = {
					PAGER,
					VTE_VERSION: "0",
					PROMPT_EOL_MARK: "",
					POWERLEVEL9K_TERM_SHELL_INTEGRATION: "true",
				}

				// Only expect PYTHONIOENCODING on Windows
				if (process.platform === "win32") {
					expectedEnv.PYTHONIOENCODING = "utf-8"
				}

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "CoStrict",
					iconPath: expect.any(Object),
					env: expectedEnv,
				})
			} finally {
				Terminal.setTerminalZshP10k(false)
			}
		})
	})

	describe("maxNotBusyTerminals functionality", () => {
		beforeEach(() => {
			// Reset terminal registry state
			TerminalRegistry["terminals"] = []
			TerminalRegistry["nextTerminalId"] = 1
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should not destroy terminals when non-busy count is within limit", () => {
			// Create 3 terminals (equal to max limit)
			const terminals = []
			for (let i = 0; i < 3; i++) {
				const terminal = TerminalRegistry.createTerminal(`/test/path${i}`, "vscode")
				terminal.busy = false
				terminals.push(terminal)
			}

			// Simulate terminal execution completion
			terminals.forEach((terminal) => {
				terminal.shellExecutionComplete({ exitCode: 0 })
			})

			// Verify all terminals still exist
			expect(TerminalRegistry.getTerminals(false).length).toBe(3)
		})

		it("should destroy oldest terminal when non-busy count exceeds limit", () => {
			// Create 4 terminals (exceeds max limit)
			const terminals = []
			for (let i = 0; i < 4; i++) {
				const terminal = TerminalRegistry.createTerminal(`/test/path${i}`, "vscode")
				terminal.busy = false
				terminals.push(terminal)
				// Add small delay to ensure different creation times
				vi.advanceTimersByTime(10)
			}

			// Simulate terminal execution completion
			terminals.forEach((terminal) => {
				terminal.shellExecutionComplete({ exitCode: 0 })
			})

			// Manually trigger cleanup (because new terminals are also counted in total)
			TerminalRegistry["checkAndCleanupNotBusyTerminals"]()

			// Verify only 3 terminals exist
			expect(TerminalRegistry.getTerminals(false).length).toBe(3)

			// Verify the oldest terminal was destroyed (terminal with ID 1 should be destroyed)
			const remainingTerminals = TerminalRegistry.getTerminals(false)
			const terminalIds = remainingTerminals.map((t) => t.id)
			expect(terminalIds).not.toContain(1) // The oldest terminal should be destroyed
			expect(terminalIds).toContain(2) // Other terminals should be preserved
			expect(terminalIds).toContain(3)
			expect(terminalIds).toContain(4)
		})

		it("should not destroy terminals with unretrieved output", () => {
			// Create 4 terminals (exceeds max limit)
			const terminals = []
			for (let i = 0; i < 4; i++) {
				const terminal = TerminalRegistry.createTerminal(`/test/path${i}`, "vscode")
				terminal.busy = false
				terminals.push(terminal)
				vi.advanceTimersByTime(10)
			}

			// Set unretrieved output for the first terminal
			terminals[0].hasUnretrievedOutput = vi.fn().mockReturnValue(true)

			// Simulate terminal execution completion
			terminals.forEach((terminal) => {
				terminal.shellExecutionComplete({ exitCode: 0 })
			})

			// Manually trigger cleanup
			TerminalRegistry["checkAndCleanupNotBusyTerminals"]()

			// Verify all 4 terminals still exist (because of unretrieved output)
			expect(TerminalRegistry.getTerminals(false).length).toBe(4)
		})

		it("should handle mixed busy and non-busy terminals correctly", () => {
			// Create 6 terminals
			const terminals = []
			for (let i = 0; i < 6; i++) {
				const terminal = TerminalRegistry.createTerminal(`/test/path${i}`, "vscode")
				terminals.push(terminal)
				vi.advanceTimersByTime(10)
			}

			// Set first 3 as busy, last 3 as non-busy
			terminals.slice(0, 3).forEach((terminal) => {
				terminal.busy = true
			})
			terminals.slice(3).forEach((terminal) => {
				terminal.busy = false
			})

			// Simulate non-busy terminal execution completion
			terminals.slice(3).forEach((terminal) => {
				terminal.shellExecutionComplete({ exitCode: 0 })
			})

			// Manually trigger cleanup
			TerminalRegistry["checkAndCleanupNotBusyTerminals"]()

			// Verify only 3 non-busy terminals exist (within limit)
			expect(TerminalRegistry.getTerminals(false).length).toBe(3)

			// Verify all busy terminals still exist
			expect(TerminalRegistry.getTerminals(true).length).toBe(3)
		})
	})
})
