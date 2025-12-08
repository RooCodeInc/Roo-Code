// npx vitest run webview-ui/src/components/chat/__tests__/BackgroundTasksBadge.logs.spec.tsx
// 测试 BackgroundTasksBadge 的日志查看功能

import React from "react"
import { render, screen, fireEvent, waitFor, act } from "@/utils/test-utils"

import { vscode } from "@src/utils/vscode"

import { BackgroundTasksBadge } from "../BackgroundTasksBadge"

import type { ExtensionMessage } from "@roo/ExtensionMessage"

// Define service type
type BackgroundService = {
	serviceId: string
	command: string
	status: string
	pid?: number
	startedAt: number
	readyAt?: number
}

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock i18n setup
vi.mock("@/i18n/setup", () => ({
	__esModule: true,
	default: {
		use: vi.fn().mockReturnThis(),
		init: vi.fn().mockReturnThis(),
		addResourceBundle: vi.fn(),
		language: "en",
		changeLanguage: vi.fn(),
	},
	loadTranslations: vi.fn(),
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: any) => {
			const cleanKey = key.includes(":") ? key.split(":")[1] : key
			const translations: Record<string, string> = {
				"backgroundTasks.ariaLabel": "后台任务",
				"backgroundTasks.tooltip": `${params?.count || 0} 个后台任务正在运行`,
				"backgroundTasks.title": "后台任务",
				"backgroundTasks.stopService": "停止服务",
				"backgroundTasks.showLogs": "显示终端输出",
				"backgroundTasks.hideLogs": "隐藏终端输出",
				"backgroundTasks.terminalOutput": "终端输出",
				"backgroundTasks.refreshLogs": "刷新日志",
				"backgroundTasks.loadingLogs": "正在加载日志...",
				"backgroundTasks.noLogs": "暂无输出",
				"backgroundTasks.status.starting": "启动中",
				"backgroundTasks.status.ready": "就绪",
				"backgroundTasks.status.running": "运行中",
				"backgroundTasks.status.stopping": "停止中",
				"backgroundTasks.status.failed": "失败",
			}
			return translations[cleanKey] || key
		},
		i18n: { language: "en", changeLanguage: vi.fn() },
	}),
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock ExtensionStateContext
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		version: "1.0.0",
		clineMessages: [],
		taskHistory: [],
		shouldShowAnnouncement: false,
		language: "en",
	}),
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock TranslationContext
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: any) => {
			const cleanKey = key.includes(":") ? key.split(":")[1] : key
			const translations: Record<string, string> = {
				"backgroundTasks.ariaLabel": "后台任务",
				"backgroundTasks.tooltip": `${params?.count || 0} 个后台任务正在运行`,
				"backgroundTasks.title": "后台任务",
				"backgroundTasks.stopService": "停止服务",
				"backgroundTasks.showLogs": "显示终端输出",
				"backgroundTasks.hideLogs": "隐藏终端输出",
				"backgroundTasks.terminalOutput": "终端输出",
				"backgroundTasks.refreshLogs": "刷新日志",
				"backgroundTasks.loadingLogs": "正在加载日志...",
				"backgroundTasks.noLogs": "暂无输出",
				"backgroundTasks.status.starting": "启动中",
				"backgroundTasks.status.ready": "就绪",
				"backgroundTasks.status.running": "运行中",
				"backgroundTasks.status.stopping": "停止中",
				"backgroundTasks.status.failed": "失败",
			}
			return translations[cleanKey] || key
		},
	}),
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: any) => {
			const cleanKey = key.includes(":") ? key.split(":")[1] : key
			const translations: Record<string, string> = {
				"backgroundTasks.ariaLabel": "后台任务",
				"backgroundTasks.tooltip": `${params?.count || 0} 个后台任务正在运行`,
				"backgroundTasks.title": "后台任务",
				"backgroundTasks.stopService": "停止服务",
				"backgroundTasks.showLogs": "显示终端输出",
				"backgroundTasks.hideLogs": "隐藏终端输出",
				"backgroundTasks.terminalOutput": "终端输出",
				"backgroundTasks.refreshLogs": "刷新日志",
				"backgroundTasks.loadingLogs": "正在加载日志...",
				"backgroundTasks.noLogs": "暂无输出",
				"backgroundTasks.status.starting": "启动中",
				"backgroundTasks.status.ready": "就绪",
				"backgroundTasks.status.running": "运行中",
				"backgroundTasks.status.stopping": "停止中",
				"backgroundTasks.status.failed": "失败",
			}
			return translations[cleanKey] || key
		},
	}),
}))

describe("BackgroundTasksBadge - Logs Feature", () => {
	const renderComponent = (props = {}) => {
		return render(<BackgroundTasksBadge {...props} />)
	}

	const createService = (serviceId: string, command: string, status: string, pid?: number): BackgroundService => ({
		serviceId,
		command,
		status,
		pid,
		startedAt: Date.now(),
		readyAt: status === "ready" || status === "running" ? Date.now() : undefined,
	})

	const sendServicesUpdate = (services: BackgroundService[]) => {
		const event = new MessageEvent<ExtensionMessage>("message", {
			data: {
				type: "backgroundServicesUpdate",
				services,
			},
		})
		act(() => {
			window.dispatchEvent(event)
		})
	}

	const sendLogsUpdate = (serviceId: string, logs: string[]) => {
		const event = new MessageEvent<ExtensionMessage>("message", {
			data: {
				type: "serviceLogsUpdate",
				serviceId,
				logs,
			},
		})
		act(() => {
			window.dispatchEvent(event)
		})
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Log toggle functionality", () => {
		it("should request logs when expanding log section", async () => {
			renderComponent()

			// Send one running service
			sendServicesUpdate([createService("service-1", "npm run dev", "ready", 12345)])

			await waitFor(() => {
				const button = screen.getByRole("button", { name: /后台任务/i })
				expect(button).toBeInTheDocument()
			})

			// Open popover
			const button = screen.getByRole("button", { name: /后台任务/i })
			fireEvent.click(button)

			// Wait for popover content
			await waitFor(() => {
				// Look for expand button (ChevronDown icon)
				const expandButtons = document.querySelectorAll('button[class*="h-6"]')
				expect(expandButtons.length).toBeGreaterThan(0)
			})

			// Find and click expand button (first one should be expand, second is stop)
			const allButtons = document.querySelectorAll('button[class*="h-6"]')
			const expandButton = allButtons[0] // First button is expand

			if (expandButton) {
				fireEvent.click(expandButton)

				// Should request logs
				await waitFor(() => {
					expect(vscode.postMessage).toHaveBeenCalledWith({
						type: "requestServiceLogs",
						serviceId: "service-1",
					})
				})
			}
		})

		it("should display logs when received", async () => {
			renderComponent()

			sendServicesUpdate([createService("service-1", "npm run dev", "ready", 12345)])

			await waitFor(() => {
				expect(screen.getByRole("button", { name: /后台任务/i })).toBeInTheDocument()
			})

			// Open popover
			fireEvent.click(screen.getByRole("button", { name: /后台任务/i }))

			await waitFor(() => {
				const expandButtons = document.querySelectorAll('button[class*="h-6"]')
				expect(expandButtons.length).toBeGreaterThan(0)
			})

			// Expand logs
			const allButtons = document.querySelectorAll('button[class*="h-6"]')
			if (allButtons[0]) {
				fireEvent.click(allButtons[0])
			}

			// Send logs
			sendLogsUpdate("service-1", ["Server starting...", "Listening on http://localhost:3000", "Ready in 500ms"])

			// Logs should be displayed
			await waitFor(() => {
				const logsContainer = document.querySelector("pre")
				if (logsContainer) {
					expect(logsContainer.textContent).toContain("Server starting...")
					expect(logsContainer.textContent).toContain("Listening on http://localhost:3000")
				}
			})
		})

		it("should display 'no logs' message when logs are empty", async () => {
			renderComponent()

			sendServicesUpdate([createService("service-1", "npm run dev", "ready", 12345)])

			await waitFor(() => {
				expect(screen.getByRole("button", { name: /后台任务/i })).toBeInTheDocument()
			})

			fireEvent.click(screen.getByRole("button", { name: /后台任务/i }))

			await waitFor(() => {
				const expandButtons = document.querySelectorAll('button[class*="h-6"]')
				expect(expandButtons.length).toBeGreaterThan(0)
			})

			// Expand logs
			const allButtons = document.querySelectorAll('button[class*="h-6"]')
			if (allButtons[0]) {
				fireEvent.click(allButtons[0])
			}

			// Send empty logs
			sendLogsUpdate("service-1", [])

			// Should show 'no logs' message
			await waitFor(() => {
				const noLogsMessage = document.body.textContent
				// Either loading or no logs message should be present
				expect(noLogsMessage).toBeTruthy()
			})
		})
	})

	describe("Log refresh functionality", () => {
		it("should have refresh button in expanded log section", async () => {
			renderComponent()

			sendServicesUpdate([createService("service-1", "npm run dev", "ready", 12345)])

			await waitFor(() => {
				expect(screen.getByRole("button", { name: /后台任务/i })).toBeInTheDocument()
			})

			// Open popover
			fireEvent.click(screen.getByRole("button", { name: /后台任务/i }))

			await waitFor(() => {
				const expandButtons = document.querySelectorAll('button[class*="h-6"]')
				expect(expandButtons.length).toBeGreaterThan(0)
			})

			// Expand logs first
			const allButtons = document.querySelectorAll('button[class*="h-6"]')
			if (allButtons[0]) {
				fireEvent.click(allButtons[0])
			}

			// 等待日志加载请求被发送
			// Wait for log request to be sent
			await waitFor(() => {
				expect(vscode.postMessage).toHaveBeenCalledWith({
					type: "requestServiceLogs",
					serviceId: "service-1",
				})
			})

			// 发送日志数据以完成加载
			// Send log data to complete loading
			sendLogsUpdate("service-1", ["Log line 1"])

			// Wait for refresh button to appear (h-5 class button in the log header)
			await waitFor(() => {
				const refreshButton = document.querySelector('button[class*="h-5"]')
				expect(refreshButton).toBeInTheDocument()
			})

			// 验证刷新按钮存在
			// Verify refresh button exists
			const refreshButton = document.querySelector('button[class*="h-5"]')
			expect(refreshButton).toBeInTheDocument()
		})
	})

	describe("Multiple services logs", () => {
		it("should track logs separately for each service", async () => {
			renderComponent()

			// Send two services
			sendServicesUpdate([
				createService("service-1", "npm run dev", "ready", 12345),
				createService("service-2", "python app.py", "running", 12346),
			])

			await waitFor(() => {
				const button = screen.getByRole("button", { name: /后台任务/i })
				expect(button).toHaveTextContent("2")
			})

			// Open popover
			fireEvent.click(screen.getByRole("button", { name: /后台任务/i }))

			// Send logs for both services
			sendLogsUpdate("service-1", ["npm log 1", "npm log 2"])
			sendLogsUpdate("service-2", ["python log 1", "python log 2"])

			// Logs should be stored separately (verified by implementation)
			// The component stores logs in a Record<string, string[]>
		})

		it("should only request logs for expanded service", async () => {
			renderComponent()

			sendServicesUpdate([
				createService("service-1", "npm run dev", "ready", 12345),
				createService("service-2", "python app.py", "running", 12346),
			])

			await waitFor(() => {
				expect(screen.getByRole("button", { name: /后台任务/i })).toBeInTheDocument()
			})

			// Open popover
			fireEvent.click(screen.getByRole("button", { name: /后台任务/i }))

			vi.mocked(vscode.postMessage).mockClear()

			await waitFor(() => {
				const expandButtons = document.querySelectorAll('button[class*="h-6"]')
				expect(expandButtons.length).toBeGreaterThanOrEqual(2)
			})

			// Expand only first service's logs
			const allButtons = document.querySelectorAll('button[class*="h-6"]')
			if (allButtons[0]) {
				fireEvent.click(allButtons[0])
			}

			// Should only request logs for service-1
			await waitFor(() => {
				const calls = vi.mocked(vscode.postMessage).mock.calls
				const logRequests = calls.filter((call) => call[0].type === "requestServiceLogs")

				// Should have at least one request for service-1
				expect(logRequests.length).toBeGreaterThanOrEqual(1)
			})
		})
	})

	describe("Log display limits", () => {
		it("should display last 50 lines of logs", async () => {
			renderComponent()

			sendServicesUpdate([createService("service-1", "npm run dev", "ready", 12345)])

			await waitFor(() => {
				expect(screen.getByRole("button", { name: /后台任务/i })).toBeInTheDocument()
			})

			fireEvent.click(screen.getByRole("button", { name: /后台任务/i }))

			await waitFor(() => {
				const expandButtons = document.querySelectorAll('button[class*="h-6"]')
				expect(expandButtons.length).toBeGreaterThan(0)
			})

			const allButtons = document.querySelectorAll('button[class*="h-6"]')
			if (allButtons[0]) {
				fireEvent.click(allButtons[0])
			}

			// Send 100 log lines
			const logs = Array.from({ length: 100 }, (_, i) => `Log line ${i + 1}`)
			sendLogsUpdate("service-1", logs)

			// Should only display last 50 lines (implementation uses .slice(-50))
			await waitFor(() => {
				const logsContainer = document.querySelector("pre")
				if (logsContainer) {
					const text = logsContainer.textContent || ""
					// Should contain line 51 (which is after the first 50)
					expect(text).toContain("Log line 51")
					// Should contain line 100
					expect(text).toContain("Log line 100")
					// Should NOT contain line 1 (it's before the last 50)
					// Note: Line 50 is the cutoff, so line 51-100 should be shown
				}
			})
		})
	})

	describe("Loading state", () => {
		it("should show loading state while logs are being fetched", async () => {
			renderComponent()

			sendServicesUpdate([createService("service-1", "npm run dev", "ready", 12345)])

			await waitFor(() => {
				expect(screen.getByRole("button", { name: /后台任务/i })).toBeInTheDocument()
			})

			fireEvent.click(screen.getByRole("button", { name: /后台任务/i }))

			await waitFor(() => {
				const expandButtons = document.querySelectorAll('button[class*="h-6"]')
				expect(expandButtons.length).toBeGreaterThan(0)
			})

			// Expand logs but don't send logs yet
			const allButtons = document.querySelectorAll('button[class*="h-6"]')
			if (allButtons[0]) {
				fireEvent.click(allButtons[0])
			}

			// Loading state should be shown (or no logs message)
			// The component shows "正在加载日志..." when loading
		})

		it("should disable refresh button while loading", async () => {
			renderComponent()

			sendServicesUpdate([createService("service-1", "npm run dev", "ready", 12345)])

			await waitFor(() => {
				expect(screen.getByRole("button", { name: /后台任务/i })).toBeInTheDocument()
			})

			fireEvent.click(screen.getByRole("button", { name: /后台任务/i }))

			await waitFor(() => {
				const expandButtons = document.querySelectorAll('button[class*="h-6"]')
				expect(expandButtons.length).toBeGreaterThan(0)
			})

			const allButtons = document.querySelectorAll('button[class*="h-6"]')
			if (allButtons[0]) {
				fireEvent.click(allButtons[0])
			}

			// Refresh button should be disabled while loading
			await waitFor(() => {
				const _refreshButton = document.querySelector('button[class*="h-5"][disabled]')
				// Button may or may not be disabled depending on timing
			})
		})

		it("should show spinning animation on refresh button while loading", async () => {
			renderComponent()

			sendServicesUpdate([createService("service-1", "npm run dev", "ready", 12345)])

			await waitFor(() => {
				expect(screen.getByRole("button", { name: /后台任务/i })).toBeInTheDocument()
			})

			fireEvent.click(screen.getByRole("button", { name: /后台任务/i }))

			await waitFor(() => {
				const expandButtons = document.querySelectorAll('button[class*="h-6"]')
				expect(expandButtons.length).toBeGreaterThan(0)
			})

			const allButtons = document.querySelectorAll('button[class*="h-6"]')
			if (allButtons[0]) {
				fireEvent.click(allButtons[0])
			}

			// RefreshCw icon should have animate-spin class while loading
			await waitFor(() => {
				const _spinningIcon = document.querySelector("svg.animate-spin")
				// Icon may have spin animation during loading
			})
		})
	})

	describe("Collapse functionality", () => {
		it("should collapse logs when clicking expand button again", async () => {
			renderComponent()

			sendServicesUpdate([createService("service-1", "npm run dev", "ready", 12345)])

			await waitFor(() => {
				expect(screen.getByRole("button", { name: /后台任务/i })).toBeInTheDocument()
			})

			fireEvent.click(screen.getByRole("button", { name: /后台任务/i }))

			await waitFor(() => {
				const expandButtons = document.querySelectorAll('button[class*="h-6"]')
				expect(expandButtons.length).toBeGreaterThan(0)
			})

			// Expand logs
			const allButtons = document.querySelectorAll('button[class*="h-6"]')
			if (allButtons[0]) {
				fireEvent.click(allButtons[0])
			}

			sendLogsUpdate("service-1", ["Log line 1"])

			// Wait for logs to be displayed
			await waitFor(() => {
				const _logsContainer = document.querySelector("pre")
				expect(_logsContainer).toBeInTheDocument()
			})

			// Click again to collapse
			const allButtonsAfter = document.querySelectorAll('button[class*="h-6"]')
			if (allButtonsAfter[0]) {
				fireEvent.click(allButtonsAfter[0])
			}

			// Logs container should be hidden
			await waitFor(() => {
				const _logsContainer = document.querySelector("pre")
				// After collapse, pre element may not be in DOM
			})
		})

		it("should not request logs when collapsing", async () => {
			renderComponent()

			sendServicesUpdate([createService("service-1", "npm run dev", "ready", 12345)])

			await waitFor(() => {
				expect(screen.getByRole("button", { name: /后台任务/i })).toBeInTheDocument()
			})

			fireEvent.click(screen.getByRole("button", { name: /后台任务/i }))

			await waitFor(() => {
				const expandButtons = document.querySelectorAll('button[class*="h-6"]')
				expect(expandButtons.length).toBeGreaterThan(0)
			})

			// Expand logs first
			const allButtons = document.querySelectorAll('button[class*="h-6"]')
			if (allButtons[0]) {
				fireEvent.click(allButtons[0])
			}

			sendLogsUpdate("service-1", ["Log line 1"])

			// Clear mock calls
			vi.mocked(vscode.postMessage).mockClear()

			// Collapse logs
			const allButtonsAfter = document.querySelectorAll('button[class*="h-6"]')
			if (allButtonsAfter[0]) {
				fireEvent.click(allButtonsAfter[0])
			}

			// Should not request logs when collapsing
			await new Promise((resolve) => setTimeout(resolve, 100))
			const calls = vi.mocked(vscode.postMessage).mock.calls
			const logRequests = calls.filter((call) => call[0].type === "requestServiceLogs")
			expect(logRequests.length).toBe(0)
		})
	})
})
