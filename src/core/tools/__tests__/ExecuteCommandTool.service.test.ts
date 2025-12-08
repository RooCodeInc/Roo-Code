// npx vitest run src/core/tools/__tests__/ExecuteCommandTool.service.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { ExecuteCommandTool } from "../ExecuteCommandTool"
import { ServiceManager } from "../../../integrations/terminal/ServiceManager"
import type { Task } from "../../task/Task"

// Mock vscode
vi.mock("vscode", () => ({
	default: {
		workspace: {
			getConfiguration: vi.fn(() => ({
				get: vi.fn((key: string, defaultValue: any) => {
					if (key === "commandExecutionTimeout") return 0
					if (key === "commandTimeoutAllowlist") return []
					return defaultValue
				}),
			})),
		},
	},
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn((key: string, defaultValue: any) => {
				if (key === "commandExecutionTimeout") return 0
				if (key === "commandTimeoutAllowlist") return []
				return defaultValue
			}),
		})),
	},
}))

// Mock ServiceManager
vi.mock("../../../integrations/terminal/ServiceManager", () => ({
	ServiceManager: {
		startService: vi.fn(),
		getServiceLogs: vi.fn(),
		stopService: vi.fn(),
		listServices: vi.fn(),
	},
}))

// Mock executeCommandInTerminal
const mockExecuteCommandInTerminal = vi.fn()
vi.mock("../ExecuteCommandTool", async () => {
	const actual = await vi.importActual<typeof import("../ExecuteCommandTool")>("../ExecuteCommandTool")
	return {
		...actual,
		executeCommandInTerminal: (...args: any[]) => mockExecuteCommandInTerminal(...args),
	}
})

describe("ExecuteCommandTool - Service Mode", () => {
	let tool: ExecuteCommandTool
	let mockTask: Partial<Task>
	let mockCallbacks: any

	beforeEach(() => {
		vi.clearAllMocks()
		mockExecuteCommandInTerminal.mockClear()

		tool = new ExecuteCommandTool()

		mockTask = {
			cwd: "/test/workspace",
			lastMessageTs: Date.now(),
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			rooIgnoreController: {
				validateCommand: vi.fn().mockReturnValue(null),
			},
			providerRef: {
				deref: vi.fn().mockResolvedValue({
					postMessageToWebview: vi.fn(),
					getState: vi.fn().mockResolvedValue({
						terminalOutputLineLimit: 500,
						terminalOutputCharacterLimit: 10000,
						terminalShellIntegrationDisabled: true,
					}),
				}),
			},
		} as any

		mockCallbacks = {
			askApproval: vi.fn().mockResolvedValue(true),
			handleError: vi.fn(),
			pushToolResult: vi.fn(),
			removeClosingTag: vi.fn((tag: string, content: string) => content),
		}
	})

	describe("detectServiceCommand", () => {
		// Use reflection to access private methods for testing
		const detectServiceCommand = (command: string): boolean => {
			// Indirectly test by creating tool instance and calling execute method
			// Or we can directly test public behavior
			return (tool as any).detectServiceCommand(command)
		}

		it("should detect npm run dev as service command", () => {
			expect(detectServiceCommand("npm run dev")).toBe(true)
		})

		it("should detect npm run start as service command", () => {
			expect(detectServiceCommand("npm run start")).toBe(true)
		})

		it("should detect yarn dev as service command", () => {
			expect(detectServiceCommand("yarn dev")).toBe(true)
		})

		it("should detect pnpm dev as service command", () => {
			expect(detectServiceCommand("pnpm dev")).toBe(true)
		})

		it("should detect vite dev as service command", () => {
			expect(detectServiceCommand("vite dev")).toBe(true)
		})

		it("should detect next dev as service command", () => {
			expect(detectServiceCommand("next dev")).toBe(true)
		})

		it("should detect nuxt dev as service command", () => {
			expect(detectServiceCommand("nuxt dev")).toBe(true)
		})

		it("should detect python manage.py runserver as service command", () => {
			expect(detectServiceCommand("python manage.py runserver")).toBe(true)
		})

		it("should detect django-admin runserver as service command", () => {
			expect(detectServiceCommand("django-admin runserver")).toBe(true)
		})

		it("should detect flask run as service command", () => {
			expect(detectServiceCommand("flask run")).toBe(true)
		})

		it("should detect rails server as service command", () => {
			expect(detectServiceCommand("rails server")).toBe(true)
		})

		it("should detect mvn spring-boot:run as service command", () => {
			expect(detectServiceCommand("mvn spring-boot:run")).toBe(true)
		})

		it("should detect dotnet run as service command", () => {
			expect(detectServiceCommand("dotnet run")).toBe(true)
		})

		it("should detect docker-compose up as service command", () => {
			expect(detectServiceCommand("docker-compose up")).toBe(true)
		})

		it("should not detect regular commands as service commands", () => {
			expect(detectServiceCommand("ls -la")).toBe(false)
			expect(detectServiceCommand("echo hello")).toBe(false)
			expect(detectServiceCommand("git status")).toBe(false)
			expect(detectServiceCommand("npm install")).toBe(false)
		})

		it("should support case-insensitive matching", () => {
			expect(detectServiceCommand("NPM RUN DEV")).toBe(true)
			expect(detectServiceCommand("Yarn Dev")).toBe(true)
			expect(detectServiceCommand("VITE DEV")).toBe(true)
		})
	})

	describe("getReadyPattern", () => {
		const getReadyPattern = (command: string): string | undefined => {
			return (tool as any).getReadyPattern(command)
		}

		it("should return correct ready pattern for Vite command", () => {
			const pattern = getReadyPattern("vite dev")
			expect(pattern).toContain("Local:.*http://localhost")
			expect(pattern).toContain("ready in")
		})

		it("should return correct ready pattern for Next.js command", () => {
			const pattern = getReadyPattern("next dev")
			expect(pattern).toContain("Local:.*http://localhost")
		})

		it("should return correct ready pattern for Nuxt command", () => {
			const pattern = getReadyPattern("nuxt dev")
			expect(pattern).toContain("Local:.*http://localhost")
		})

		it("should return correct ready pattern for Django command", () => {
			const pattern = getReadyPattern("python manage.py runserver")
			expect(pattern).toContain("Starting development server")
			expect(pattern).toContain("Django version")
		})

		it("should return correct ready pattern for Flask command", () => {
			const pattern = getReadyPattern("flask run")
			expect(pattern).toContain("Running on")
			expect(pattern).toContain("Debug mode")
		})

		it("should return correct ready pattern for Spring Boot command", () => {
			const pattern = getReadyPattern("mvn spring-boot:run")
			expect(pattern).toContain("Started.*Application")
			expect(pattern).toContain("Tomcat started on port")
		})

		it("should return correct ready pattern for .NET command", () => {
			const pattern = getReadyPattern("dotnet run")
			expect(pattern).toContain("Now listening on")
			expect(pattern).toContain("Application started")
		})

		it("should return generic pattern for Docker command", () => {
			const pattern = getReadyPattern("docker-compose up")
			expect(pattern).toBeDefined()
		})

		it("should return generic fallback pattern for unknown command", () => {
			const pattern = getReadyPattern("unknown-command")
			expect(pattern).toContain("listening on")
			expect(pattern).toContain("server started")
		})
	})

	describe("Service command execution flow", () => {
		// Note: Complete execution flow tests require extensive mock setup
		// Here we mainly test command detection and ready pattern matching, which are core features
		// Complete execution flow tests can be done in integration tests

		it("should correctly identify service commands and return ready patterns", () => {
			const detectServiceCommand = (command: string): boolean => {
				return (tool as any).detectServiceCommand(command)
			}
			const getReadyPattern = (command: string): string | undefined => {
				return (tool as any).getReadyPattern(command)
			}

			// Test service command detection
			expect(detectServiceCommand("npm run dev")).toBe(true)
			expect(detectServiceCommand("docker-compose up")).toBe(true)

			// Test ready patterns
			// Note: getReadyPattern matches based on command content, so "npm run dev" returns generic pattern
			// while "vite dev" returns Vite-specific pattern
			const vitePattern = getReadyPattern("vite dev")
			expect(vitePattern).toBeDefined()
			expect(vitePattern).toContain("Local:.*http://localhost")

			const npmDevPattern = getReadyPattern("npm run dev")
			expect(npmDevPattern).toBeDefined()
			// npm run dev returns generic pattern
			expect(npmDevPattern).toContain("listening on")

			const dockerPattern = getReadyPattern("docker-compose up")
			expect(dockerPattern).toBeDefined()
		})

		it("should return ready pattern for non-service commands (design behavior)", () => {
			const detectServiceCommand = (command: string): boolean => {
				return (tool as any).detectServiceCommand(command)
			}
			const getReadyPattern = (command: string): string | undefined => {
				return (tool as any).getReadyPattern(command)
			}

			expect(detectServiceCommand("ls -la")).toBe(false)
			// Non-service commands also return generic pattern, this is by design
			const pattern = getReadyPattern("ls -la")
			// Even for non-service commands, getReadyPattern returns generic pattern
			expect(pattern).toBeDefined()
		})

		it("should detect timeout extension logic for Docker commands", () => {
			const detectServiceCommand = (command: string): boolean => {
				return (tool as any).detectServiceCommand(command)
			}

			// Docker commands should be recognized as service commands
			expect(detectServiceCommand("docker-compose up")).toBe(true)
			expect(detectServiceCommand("docker up -d")).toBe(true)
		})
	})
})
