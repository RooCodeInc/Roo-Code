// npx vitest run src/integrations/terminal/__tests__/TerminalRegistry.workingDirectory.spec.ts

import * as vscode from "vscode"
import { Terminal } from "../Terminal"
import { TerminalRegistry } from "../TerminalRegistry"

vi.mock("execa", () => ({
	execa: vi.fn(),
}))

describe("TerminalRegistry - Working Directory Tracking", () => {
	let mockCreateTerminal: any

	beforeEach(() => {
		// Clear any existing terminals
		TerminalRegistry["terminals"] = []

		mockCreateTerminal = vi.spyOn(vscode.window, "createTerminal").mockImplementation((...args: any[]) => {
			const mockShellIntegration = {
				executeCommand: vi.fn(),
				cwd: vscode.Uri.file("/test/path"), // Initial working directory
			}

			return {
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
				shellIntegration: mockShellIntegration,
			} as any
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("getOrCreateTerminal with changed working directory", () => {
		it("should reuse terminal when working directory matches current directory", async () => {
			// Create a terminal with initial working directory
			const terminal1 = await TerminalRegistry.getOrCreateTerminal("/test/path", false, "task1", "vscode")

			// Simulate the terminal's working directory changing (like after cd command)
			if (terminal1 instanceof Terminal) {
				// Mock the shell integration to return the new working directory
				Object.defineProperty(terminal1.terminal.shellIntegration!, "cwd", {
					value: vscode.Uri.file("/test/path/subdir"),
					writable: true,
					configurable: true,
				})
			}

			// Mark terminal as not busy
			terminal1.busy = false

			// Request a terminal for the new working directory
			const terminal2 = await TerminalRegistry.getOrCreateTerminal("/test/path/subdir", false, "task1", "vscode")

			// Should reuse the same terminal since its current working directory matches
			expect(terminal2).toBe(terminal1)
			expect(mockCreateTerminal).toHaveBeenCalledTimes(1) // Only one terminal created
		})

		it("should create new terminal when no existing terminal matches current working directory", async () => {
			// Create a terminal with initial working directory
			const terminal1 = await TerminalRegistry.getOrCreateTerminal("/test/path", false, "task1", "vscode")

			// Simulate the terminal's working directory changing (like after cd command)
			if (terminal1 instanceof Terminal) {
				// Mock the shell integration to return the new working directory
				Object.defineProperty(terminal1.terminal.shellIntegration!, "cwd", {
					value: vscode.Uri.file("/test/path/subdir"),
					writable: true,
					configurable: true,
				})
			}

			// Mark terminal as not busy
			terminal1.busy = false

			// Request a terminal for a different working directory
			const terminal2 = await TerminalRegistry.getOrCreateTerminal("/test/path/other", false, "task1", "vscode")

			// Should create a new terminal since no existing terminal matches the requested directory
			expect(terminal2).not.toBe(terminal1)
			expect(mockCreateTerminal).toHaveBeenCalledTimes(2) // Two terminals created
		})

		it("should handle terminals without shell integration gracefully", async () => {
			// Create a terminal without shell integration
			mockCreateTerminal.mockImplementationOnce(
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
						shellIntegration: undefined, // No shell integration
					}) as any,
			)

			const terminal1 = await TerminalRegistry.getOrCreateTerminal("/test/path", false, "task1", "vscode")
			terminal1.busy = false

			// Request a terminal for the same working directory
			const terminal2 = await TerminalRegistry.getOrCreateTerminal("/test/path", false, "task1", "vscode")

			// Should reuse the same terminal since it falls back to initial CWD
			expect(terminal2).toBe(terminal1)
			expect(mockCreateTerminal).toHaveBeenCalledTimes(1)
		})

		it("should prioritize task-specific terminals with matching current working directory", async () => {
			// Create a terminal for task1
			const terminal1 = await TerminalRegistry.getOrCreateTerminal("/test/path", false, "task1", "vscode")

			// Create a terminal for task2
			const terminal2 = await TerminalRegistry.getOrCreateTerminal("/test/path", false, "task2", "vscode")

			// Simulate terminal1's working directory changing
			if (terminal1 instanceof Terminal) {
				// Mock the shell integration to return the new working directory
				Object.defineProperty(terminal1.terminal.shellIntegration!, "cwd", {
					value: vscode.Uri.file("/test/path/subdir"),
					writable: true,
					configurable: true,
				})
			}

			// Mark both terminals as not busy
			terminal1.busy = false
			terminal2.busy = false

			// Request a terminal for task1 with the new working directory
			const terminal3 = await TerminalRegistry.getOrCreateTerminal("/test/path/subdir", false, "task1", "vscode")

			// Should reuse terminal1 since it's assigned to task1 and has matching current working directory
			expect(terminal3).toBe(terminal1)
			expect(mockCreateTerminal).toHaveBeenCalledTimes(2) // Only two terminals created
		})

		it("should create separate terminals for different tasks", async () => {
			// Create a terminal for task1
			const terminal1 = await TerminalRegistry.getOrCreateTerminal("/test/path", false, "task1", "vscode")

			// Create a terminal for task2 - should create a new terminal
			const terminal2 = await TerminalRegistry.getOrCreateTerminal("/test/path", false, "task2", "vscode")

			// Should be different terminals
			expect(terminal2).not.toBe(terminal1)
			expect(mockCreateTerminal).toHaveBeenCalledTimes(2)
		})
	})
})
