import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"

// Mock i18n system
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string, options?: Record<string, any>) => {
		if (key === "errors.claudeCode.notFound") {
			const claudePath = options?.claudePath || "claude"
			const installationUrl = options?.installationUrl || "https://docs.anthropic.com/en/docs/claude-code/setup"
			const originalError = options?.originalError || "spawn claude ENOENT"
			return `Claude Code executable '${claudePath}' not found.\n\nPlease install Claude Code CLI:\n1. Visit ${installationUrl} to download Claude Code\n2. Follow the installation instructions for your operating system\n3. Ensure the 'claude' command is available in your PATH\n4. Alternatively, configure a custom path in Roo settings under 'Claude Code Path'\n\nOriginal error: ${originalError}`
		}
		return key
	}),
}))

// Mock os module
const mockPlatform = vi.fn()
vi.mock("os", () => ({
	platform: mockPlatform,
}))

// Mock vscode workspace
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/test/workspace",
				},
			},
		],
	},
}))

// Mock execa
const mockExeca = vi.fn()
const mockStdin = {
	write: vi.fn((data, encoding, callback) => {
		if (callback) callback(null)
	}),
	end: vi.fn(),
}

const createMockProcess = () => {
	let resolveProcess: (value: { exitCode: number }) => void
	const processPromise = new Promise<{ exitCode: number }>((resolve) => {
		resolveProcess = resolve
	})

	const mockProcess = {
		stdin: mockStdin,
		stdout: {
			on: vi.fn(),
		},
		stderr: {
			on: vi.fn(),
		},
		on: vi.fn((event, callback) => {
			if (event === "close") {
				setTimeout(() => {
					callback(0)
					resolveProcess({ exitCode: 0 })
				}, 10)
			}
		}),
		killed: false,
		kill: vi.fn(),
		then: processPromise.then.bind(processPromise),
		catch: processPromise.catch.bind(processPromise),
		finally: processPromise.finally.bind(processPromise),
	}
	return mockProcess
}

vi.mock("execa", () => ({
	execa: mockExeca,
}))

// Mock readline
let mockReadlineInterface: any = null

vi.mock("readline", () => ({
	default: {
		createInterface: vi.fn(() => {
			mockReadlineInterface = {
				async *[Symbol.asyncIterator]() {
					yield '{"type":"text","text":"PowerShell test response"}'
					return
				},
				close: vi.fn(),
			}
			return mockReadlineInterface
		}),
	},
}))

describe("runClaudeCode - PowerShell Script Support", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockExeca.mockReturnValue(createMockProcess())
		vi.spyOn(global, "setImmediate").mockImplementation((callback: any) => {
			callback()
			return {} as any
		})
		vi.resetModules()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	test("should execute .ps1 files through PowerShell on Windows", async () => {
		mockPlatform.mockReturnValue("win32")

		const { runClaudeCode } = await import("../run")
		const options = {
			systemPrompt: "You are a helpful assistant",
			messages: [{ role: "user" as const, content: "Hello" }],
			path: "C:\\Users\\test\\AppData\\Local\\fnm_multishells\\52480_1754403777187\\claude.ps1",
		}

		const generator = runClaudeCode(options)
		const results = []
		for await (const chunk of generator) {
			results.push(chunk)
		}

		// Verify PowerShell was called with correct arguments
		const [executablePath, args] = mockExeca.mock.calls[0]
		expect(executablePath).toBe("powershell.exe")
		expect(args).toContain("-NoProfile")
		expect(args).toContain("-ExecutionPolicy")
		expect(args).toContain("Bypass")
		expect(args).toContain("-File")
		expect(args).toContain("C:\\Users\\test\\AppData\\Local\\fnm_multishells\\52480_1754403777187\\claude.ps1")
		expect(args).toContain("-p")

		// Verify the response was received (as parsed object, not string)
		expect(results).toContainEqual({ type: "text", text: "PowerShell test response" })
	})

	test("should execute .PS1 files (uppercase) through PowerShell on Windows", async () => {
		mockPlatform.mockReturnValue("win32")

		const { runClaudeCode } = await import("../run")
		const options = {
			systemPrompt: "You are a helpful assistant",
			messages: [{ role: "user" as const, content: "Hello" }],
			path: "C:\\Program Files\\Claude\\claude.PS1",
		}

		const generator = runClaudeCode(options)
		await generator.next()
		await generator.return(undefined)

		const [executablePath, args] = mockExeca.mock.calls[0]
		expect(executablePath).toBe("powershell.exe")
		expect(args).toContain("-File")
		expect(args).toContain("C:\\Program Files\\Claude\\claude.PS1")
	})

	test("should not use PowerShell for .ps1 files on non-Windows platforms", async () => {
		mockPlatform.mockReturnValue("darwin")

		const { runClaudeCode } = await import("../run")
		const options = {
			systemPrompt: "You are a helpful assistant",
			messages: [{ role: "user" as const, content: "Hello" }],
			path: "/usr/local/bin/claude.ps1",
		}

		const generator = runClaudeCode(options)
		await generator.next()
		await generator.return(undefined)

		// On non-Windows, should execute the file directly
		const [executablePath] = mockExeca.mock.calls[0]
		expect(executablePath).toBe("/usr/local/bin/claude.ps1")
		expect(executablePath).not.toBe("powershell.exe")
	})

	test("should not use PowerShell for non-.ps1 files on Windows", async () => {
		mockPlatform.mockReturnValue("win32")

		const { runClaudeCode } = await import("../run")
		const options = {
			systemPrompt: "You are a helpful assistant",
			messages: [{ role: "user" as const, content: "Hello" }],
			path: "C:\\Program Files\\Claude\\claude.exe",
		}

		const generator = runClaudeCode(options)
		await generator.next()
		await generator.return(undefined)

		// Should execute the .exe directly
		const [executablePath] = mockExeca.mock.calls[0]
		expect(executablePath).toBe("C:\\Program Files\\Claude\\claude.exe")
		expect(executablePath).not.toBe("powershell.exe")
	})

	test("should handle PowerShell not found error gracefully", async () => {
		mockPlatform.mockReturnValue("win32")

		// Mock PowerShell not found error
		const powershellError = new Error("spawn powershell.exe ENOENT")
		;(powershellError as any).code = "ENOENT"
		mockExeca.mockImplementationOnce(() => {
			throw powershellError
		})

		const { runClaudeCode } = await import("../run")
		const options = {
			systemPrompt: "You are a helpful assistant",
			messages: [{ role: "user" as const, content: "Hello" }],
			path: "C:\\Users\\test\\claude.ps1",
		}

		const generator = runClaudeCode(options)

		// Should throw a helpful error about PowerShell not being available
		await expect(generator.next()).rejects.toThrow("PowerShell is not available or not in PATH")
	})

	test("should handle .ps1 script not found error with helpful message", async () => {
		mockPlatform.mockReturnValue("win32")

		// Mock script not found error (after PowerShell is found)
		const mockProcessWithError = createMockProcess()
		const scriptError = new Error("The system cannot find the file specified")

		mockProcessWithError.on = vi.fn((event, callback) => {
			if (event === "error") {
				// This would happen if PowerShell runs but can't find the script
				const enhancedError = new Error("spawn ENOENT")
				;(enhancedError as any).code = "ENOENT"
				callback(enhancedError)
			}
		})

		// Mock readline to close immediately when there's an error
		const mockReadlineForError = {
			[Symbol.asyncIterator]() {
				return {
					async next() {
						return { done: true, value: undefined }
					},
				}
			},
			close: vi.fn(),
		}

		const readline = await import("readline")
		vi.mocked(readline.default.createInterface).mockReturnValueOnce(mockReadlineForError as any)
		mockExeca.mockReturnValueOnce(mockProcessWithError)

		const { runClaudeCode } = await import("../run")
		const options = {
			systemPrompt: "You are a helpful assistant",
			messages: [{ role: "user" as const, content: "Hello" }],
			path: "C:\\Users\\test\\nonexistent.ps1",
		}

		const generator = runClaudeCode(options)

		// Should throw the standard Claude Code not found error
		await expect(generator.next()).rejects.toThrow(/Claude Code executable.*not found/)
	})

	test("should pass model parameter correctly with PowerShell scripts", async () => {
		mockPlatform.mockReturnValue("win32")

		const { runClaudeCode } = await import("../run")
		const options = {
			systemPrompt: "You are a helpful assistant",
			messages: [{ role: "user" as const, content: "Hello" }],
			path: "C:\\claude.ps1",
			modelId: "claude-3-5-sonnet-20241022",
		}

		const generator = runClaudeCode(options)
		await generator.next()
		await generator.return(undefined)

		const [, args] = mockExeca.mock.calls[0]
		expect(args).toContain("--model")
		expect(args).toContain("claude-3-5-sonnet-20241022")
	})

	test("should pass maxOutputTokens correctly with PowerShell scripts", async () => {
		mockPlatform.mockReturnValue("win32")

		const { runClaudeCode } = await import("../run")
		const options = {
			systemPrompt: "You are a helpful assistant",
			messages: [{ role: "user" as const, content: "Hello" }],
			path: "C:\\claude.ps1",
			maxOutputTokens: 8192,
		}

		const generator = runClaudeCode(options)
		await generator.next()
		await generator.return(undefined)

		const [, , execOptions] = mockExeca.mock.calls[0]
		expect(execOptions.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe("8192")
	})

	test("should handle stdin correctly with PowerShell scripts on Windows", async () => {
		mockPlatform.mockReturnValue("win32")

		const { runClaudeCode } = await import("../run")
		const messages = [{ role: "user" as const, content: "Test message" }]
		const systemPrompt = "Test prompt"
		const options = {
			systemPrompt,
			messages,
			path: "C:\\claude.ps1",
		}

		const generator = runClaudeCode(options)
		await generator.next()
		await generator.return(undefined)

		// On Windows with PowerShell, should pass both system prompt and messages via stdin
		const expectedStdinData = JSON.stringify({ systemPrompt, messages })
		expect(mockStdin.write).toHaveBeenCalledWith(expectedStdinData, "utf8", expect.any(Function))

		// Should NOT have --system-prompt in args (passed via stdin instead)
		const [, args] = mockExeca.mock.calls[0]
		expect(args).not.toContain("--system-prompt")
	})
})
