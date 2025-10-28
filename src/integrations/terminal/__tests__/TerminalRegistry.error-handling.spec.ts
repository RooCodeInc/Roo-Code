// npx vitest run src/integrations/terminal/__tests__/TerminalRegistry.error-handling.spec.ts

import * as vscode from "vscode"
import { Terminal } from "../Terminal"
import { TerminalRegistry } from "../TerminalRegistry"
import { ShellIntegrationManager } from "../ShellIntegrationManager"

vi.mock("execa", () => ({
	execa: vi.fn(),
}))

// Mock ShellIntegrationManager
vi.mock("../ShellIntegrationManager", () => ({
	ShellIntegrationManager: {
		zshCleanupTmpDir: vi.fn(),
		clear: vi.fn(),
	},
}))

// Mock vscode with additional methods needed for terminal tests
vi.mock("vscode", async (importOriginal) => {
	const actual = await importOriginal<typeof import("vscode")>()
	return {
		...actual,
		workspace: {
			...actual.workspace,
			getConfiguration: vi.fn().mockReturnValue({
				get: vi.fn().mockReturnValue(null),
			}),
		},
		window: {
			...actual.window,
			createTerminal: vi.fn(),
			onDidCloseTerminal: vi.fn(),
			onDidStartTerminalShellExecution: vi.fn(),
			onDidEndTerminalShellExecution: vi.fn(),
		},
		extensions: {
			getExtension: vi.fn((extensionId) => {
				// 模拟返回扩展对象，匹配 Package.publisher 和 Package.name
				if (extensionId && extensionId.includes("zgsm")) {
					return {
						extensionUri: { fsPath: "/test/extension/path" },
					}
				}
				return undefined
			}),
			all: [],
			onDidChange: vi.fn(),
		},
		Uri: {
			...actual.Uri,
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
			appName: "mock-app",
			appHost: "mock-host",
			appRoot: "/mock/app/root",
			language: "en",
		},
		commands: {
			executeCommand: vi.fn().mockResolvedValue(undefined),
			registerCommand: vi.fn(),
		},
	}
})

describe("TerminalRegistry 错误处理测试", () => {
	let mockCreateTerminal: any
	let mockOnDidCloseTerminal: any
	let mockOnDidStartTerminalShellExecution: any
	let mockOnDidEndTerminalShellExecution: any
	let mockConsoleError: any
	let mockConsoleInfo: any
	let mockConsoleWarn: any

	beforeEach(() => {
		// 重置 TerminalRegistry 状态
		TerminalRegistry["terminals"] = []
		TerminalRegistry["nextTerminalId"] = 1
		TerminalRegistry["disposables"] = []
		TerminalRegistry["isInitialized"] = false

		// Mock console methods
		mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {})
		mockConsoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
		mockConsoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

		// Mock vscode.window.createTerminal
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

		// Mock vscode.window.onDidCloseTerminal
		mockOnDidCloseTerminal = vi
			.spyOn(vscode.window, "onDidCloseTerminal")
			.mockImplementation((callback: any) => ({ dispose: vi.fn() }) as any)

		// Mock vscode.window.onDidStartTerminalShellExecution
		mockOnDidStartTerminalShellExecution = vi.spyOn(vscode.window, "onDidStartTerminalShellExecution") as any

		// Mock vscode.window.onDidEndTerminalShellExecution
		mockOnDidEndTerminalShellExecution = vi.spyOn(vscode.window, "onDidEndTerminalShellExecution") as any
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("API兼容性检查测试", () => {
		it("应该处理 onDidStartTerminalShellExecution 不存在的情况", () => {
			// 模拟 API 不存在
			mockOnDidStartTerminalShellExecution.mockReturnValue(undefined)

			TerminalRegistry.initialize()

			// 验证没有抛出错误
			expect(mockConsoleError).not.toHaveBeenCalledWith(
				expect.stringContaining("Error setting up shell execution handlers"),
				expect.anything(),
			)
		})

		it("应该处理 onDidEndTerminalShellExecution 不存在的情况", () => {
			// 模拟 API 不存在
			mockOnDidEndTerminalShellExecution.mockReturnValue(undefined)

			TerminalRegistry.initialize()

			// 验证没有抛出错误
			expect(mockConsoleError).not.toHaveBeenCalledWith(
				expect.stringContaining("Error setting up shell execution handlers"),
				expect.anything(),
			)
		})

		it("应该处理设置事件监听器时的异常", () => {
			// 模拟设置事件监听器时抛出异常
			mockOnDidStartTerminalShellExecution.mockImplementation(() => {
				throw new Error("API not available")
			})

			TerminalRegistry.initialize()

			// 验证错误被正确捕获和记录
			expect(mockConsoleError).toHaveBeenCalledWith(
				"[TerminalRegistry] Error setting up shell execution handlers:",
				expect.any(Error),
			)
		})
	})

	describe("事件处理函数测试", () => {
		let startEventCallback: any
		let mockTerminal: any
		let mockExecution: any
		let mockStream: any

		beforeEach(() => {
			// 设置事件回调
			mockOnDidStartTerminalShellExecution.mockImplementation((callback: any) => {
				startEventCallback = callback
				return { dispose: vi.fn() }
			})

			mockOnDidEndTerminalShellExecution.mockReturnValue({ dispose: vi.fn() })

			// 创建模拟终端
			mockTerminal = {
				exitStatus: undefined,
				name: "Test Terminal",
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
			}

			// 创建模拟执行对象
			mockExecution = {
				commandLine: { value: "test command" },
				read: vi.fn(),
			}

			// 创建模拟流
			mockStream = {
				[Symbol.asyncIterator]: vi.fn(() => ({
					next: vi.fn().mockResolvedValue({ value: "test output", done: false }),
				})),
			}

			TerminalRegistry.initialize()
		})

		it("应该处理事件对象为 null 的情况", async () => {
			await startEventCallback(null)

			// 验证没有抛出错误，事件被忽略
			expect(mockConsoleError).not.toHaveBeenCalled()
		})

		it("应该处理事件对象为 undefined 的情况", async () => {
			await startEventCallback(undefined)

			// 验证没有抛出错误，事件被忽略
			expect(mockConsoleError).not.toHaveBeenCalled()
		})

		it("应该处理 execution 属性缺失的情况", async () => {
			await startEventCallback({ terminal: mockTerminal })

			// 验证事件被忽略，没有错误
			expect(mockConsoleError).not.toHaveBeenCalled()
		})

		it("应该处理 terminal 属性缺失的情况", async () => {
			await startEventCallback({ execution: mockExecution })

			// 验证事件被忽略，没有错误
			expect(mockConsoleError).not.toHaveBeenCalled()
		})

		it("应该处理终端已关闭的情况", async () => {
			// 创建一个已关闭的终端
			const closedTerminal = { ...mockTerminal, exitStatus: 0 }
			await startEventCallback({ execution: mockExecution, terminal: closedTerminal })

			// 验证事件被忽略，没有错误
			expect(mockConsoleError).not.toHaveBeenCalled()
		})

		it("应该处理事件处理过程中的异常", async () => {
			// 模拟事件处理过程中抛出异常
			mockExecution.read.mockImplementation(() => {
				throw new Error("Stream read error")
			})

			await startEventCallback({ execution: mockExecution, terminal: mockTerminal })

			// 验证错误被正确捕获和记录
			expect(mockConsoleError).toHaveBeenCalledWith("[TerminalRegistry] Stream read failed:", expect.any(Error))
		})
	})

	describe("流读取错误处理测试", () => {
		let startEventCallback: any
		let mockTerminal: any
		let mockExecution: any

		beforeEach(() => {
			mockOnDidStartTerminalShellExecution.mockImplementation((callback: any) => {
				startEventCallback = callback
				return { dispose: vi.fn() }
			})

			mockOnDidEndTerminalShellExecution.mockReturnValue({ dispose: vi.fn() })

			mockTerminal = {
				exitStatus: undefined,
				name: "Test Terminal",
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
			}

			mockExecution = {
				commandLine: { value: "test command" },
				read: vi.fn(),
			}

			TerminalRegistry.initialize()
		})

		it("应该处理 e.execution.read() 抛出异常的情况", async () => {
			// 模拟 read 方法抛出异常
			mockExecution.read.mockImplementation(() => {
				throw new Error("Read failed")
			})

			await startEventCallback({ execution: mockExecution, terminal: mockTerminal })

			// 验证错误被正确捕获和记录
			expect(mockConsoleError).toHaveBeenCalledWith("[TerminalRegistry] Stream read failed:", expect.any(Error))
		})

		it("应该处理返回的流为 null 的情况", async () => {
			// 模拟 read 返回 null
			mockExecution.read.mockReturnValue(null)

			await startEventCallback({ execution: mockExecution, terminal: mockTerminal })

			// 验证事件被忽略，没有错误
			expect(mockConsoleError).not.toHaveBeenCalled()
		})

		it("应该处理返回的流为 undefined 的情况", async () => {
			// 模拟 read 返回 undefined
			mockExecution.read.mockReturnValue(undefined)

			await startEventCallback({ execution: mockExecution, terminal: mockTerminal })

			// 验证事件被忽略，没有错误
			expect(mockConsoleError).not.toHaveBeenCalled()
		})
	})

	describe("终端状态验证测试", () => {
		let startEventCallback: any
		let mockTerminal: any
		let mockExecution: any
		let mockStream: any
		let terminalInstance: any

		beforeEach(() => {
			mockOnDidStartTerminalShellExecution.mockImplementation((callback: any) => {
				startEventCallback = callback
				return { dispose: vi.fn() }
			})

			mockOnDidEndTerminalShellExecution.mockReturnValue({ dispose: vi.fn() })

			mockTerminal = {
				exitStatus: undefined,
				name: "Test Terminal",
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
			}

			mockExecution = {
				commandLine: { value: "test command" },
				read: vi.fn(),
			}

			mockStream = {
				[Symbol.asyncIterator]: vi.fn(() => ({
					next: vi.fn().mockResolvedValue({ value: "test output", done: false }),
				})),
			}

			mockExecution.read.mockReturnValue(mockStream)

			TerminalRegistry.initialize()
			terminalInstance = TerminalRegistry.createTerminal("/test/path", "vscode")
		})

		it("应该处理终端查找失败的情况", async () => {
			// 使用不在注册表中的终端
			const unknownTerminal = { ...mockTerminal, name: "Unknown Terminal" }

			await startEventCallback({ execution: mockExecution, terminal: unknownTerminal })

			// 验证事件被忽略，没有错误
			expect(mockConsoleError).not.toHaveBeenCalled()
		})

		it("应该处理 setActiveStream 抛出异常的情况", async () => {
			// 模拟 setActiveStream 抛出异常
			const originalSetActiveStream = terminalInstance.setActiveStream
			terminalInstance.setActiveStream = vi.fn().mockImplementation(() => {
				throw new Error("Set stream failed")
			})

			await startEventCallback({ execution: mockExecution, terminal: (terminalInstance as Terminal).terminal })

			// 验证错误被正确捕获和记录
			expect(mockConsoleError).toHaveBeenCalledWith("[TerminalRegistry] Set stream failed:", expect.any(Error))

			// 恢复原始方法
			terminalInstance.setActiveStream = originalSetActiveStream
		})

		it("应该处理终端状态不一致的情况", async () => {
			// 模拟终端已关闭
			terminalInstance.isClosed = vi.fn().mockReturnValue(true)

			await startEventCallback({ execution: mockExecution, terminal: (terminalInstance as Terminal).terminal })

			// 验证事件被忽略，没有错误
			expect(mockConsoleError).not.toHaveBeenCalled()
		})
	})

	describe("getTerminalByVSCETerminal 方法测试", () => {
		let mockTerminal: any

		beforeEach(() => {
			mockTerminal = {
				exitStatus: undefined,
				name: "Test Terminal",
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
			}

			TerminalRegistry.initialize()
		})

		it("应该处理输入参数为 null 的情况", () => {
			// 使用私有方法进行测试
			const result = TerminalRegistry["getTerminalByVSCETerminal"](null as any)

			expect(result).toBeUndefined()
		})

		it("应该处理输入参数为 undefined 的情况", () => {
			// 使用私有方法进行测试
			const result = TerminalRegistry["getTerminalByVSCETerminal"](undefined as any)

			expect(result).toBeUndefined()
		})

		it("应该处理查找过程中出现异常的情况", () => {
			// 创建一个终端实例
			const terminalInstance = TerminalRegistry.createTerminal("/test/path", "vscode")

			// 模拟查找过程中抛出异常
			const originalFind = Array.prototype.find
			Array.prototype.find = vi.fn().mockImplementation(() => {
				throw new Error("Find failed")
			})

			const result = TerminalRegistry["getTerminalByVSCETerminal"]((terminalInstance as Terminal).terminal)

			// 验证错误被正确捕获和记录
			expect(mockConsoleError).toHaveBeenCalledWith(
				"[TerminalRegistry] Error in getTerminalByVSCETerminal:",
				expect.any(Error),
			)
			expect(result).toBeUndefined()

			// 恢复原始方法
			Array.prototype.find = originalFind
		})

		it("应该处理已关闭终端的清理逻辑", () => {
			// 创建一个终端实例
			const terminalInstance = TerminalRegistry.createTerminal("/test/path", "vscode")

			// 模拟终端已关闭
			terminalInstance.isClosed = vi.fn().mockReturnValue(true)

			const result = TerminalRegistry["getTerminalByVSCETerminal"]((terminalInstance as Terminal).terminal)

			// 验证返回 undefined
			expect(result).toBeUndefined()

			// 验证终端被从注册表中移除
			const terminals = TerminalRegistry["getAllTerminals"]()
			expect(terminals).not.toContain(terminalInstance)
		})
	})

	describe("初始化错误处理测试", () => {
		it("应该处理重复初始化的情况", () => {
			TerminalRegistry.initialize()

			// 尝试再次初始化应该抛出错误
			expect(() => TerminalRegistry.initialize()).toThrow(
				"TerminalRegistry.initialize() should only be called once",
			)
		})

		it("应该处理 onDidCloseTerminal 事件处理中的异常", () => {
			// 模拟 onDidCloseTerminal 抛出异常
			mockOnDidCloseTerminal.mockImplementation((callback: any) => {
				// 立即调用回调以测试异常处理
				try {
					callback(null)
				} catch (error) {
					// 异常应该被捕获
				}
				return { dispose: vi.fn() }
			})

			// 初始化不应该抛出异常
			expect(() => TerminalRegistry.initialize()).not.toThrow()
		})
	})

	describe("清理功能测试", () => {
		it("应该正确清理所有资源", () => {
			TerminalRegistry.initialize()

			// 创建一些终端
			TerminalRegistry.createTerminal("/test/path1", "vscode")
			TerminalRegistry.createTerminal("/test/path2", "vscode")

			// 清理
			TerminalRegistry.cleanup()

			// 验证清理方法被调用
			expect(ShellIntegrationManager.clear).toHaveBeenCalled()
		})
	})
})
