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
})
