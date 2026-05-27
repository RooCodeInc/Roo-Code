// npx vitest run src/integrations/terminal/__tests__/TerminalRegistry.spec.ts

import * as vscode from "vscode"
import { Terminal } from "../Terminal"
import { TerminalRegistry } from "../TerminalRegistry"

const PAGER = process.platform === "win32" ? "" : "cat"

// Windows-specific UTF-8 environment variables added to prevent character corruption
// when the system uses non-UTF-8 encodings like GBK (code page 936)
// See: https://github.com/RooCodeInc/Roo-Code/issues/10709
const WIN32_UTF8_ENV =
	process.platform === "win32"
		? {
				PYTHONIOENCODING: "utf-8",
				PYTHONUTF8: "1",
				RUBYOPT: "-EUTF-8",
			}
		: {}

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
					...WIN32_UTF8_ENV,
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
						...WIN32_UTF8_ENV,
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
						...WIN32_UTF8_ENV,
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
						...WIN32_UTF8_ENV,
					},
				})
			} finally {
				Terminal.setTerminalZshP10k(false)
			}
		})
	})
})
