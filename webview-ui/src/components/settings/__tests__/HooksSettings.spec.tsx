// cd webview-ui && npx vitest run src/components/settings/__tests__/HooksSettings.spec.tsx

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { HooksSettings } from "../HooksSettings"
import type { HookInfo, HookExecutionRecord, HooksState } from "@roo-code/types"

// Mock vscode utilities
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the translation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: any) => {
			// Simple mock that returns translation keys
			if (params) {
				return key.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] || "")
			}
			return key
		},
	}),
}))

// Mock the ExtensionStateContext
const mockHooksState: HooksState = {
	enabledHooks: [],
	executionHistory: [],
	hasProjectHooks: false,
	snapshotTimestamp: undefined,
}

let currentHooksState = mockHooksState

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		hooks: currentHooksState,
	}),
}))

// Mock UI components
vi.mock("@src/components/ui", () => ({
	Button: ({ children, onClick, ...props }: any) => (
		<button onClick={onClick} data-testid={props["data-testid"]} {...props}>
			{children}
		</button>
	),
	ToggleSwitch: ({ checked, onChange, ...props }: any) => (
		<div role="switch" aria-checked={checked} onClick={onChange} data-testid={props["data-testid"]} />
	),
	StandardTooltip: ({ children, content }: any) => <div title={content}>{children}</div>,
}))

// Mock Section components
vi.mock("../SectionHeader", () => ({
	SectionHeader: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock("../Section", () => ({
	Section: ({ children }: any) => <div data-testid="section">{children}</div>,
}))

describe("HooksSettings", () => {
	beforeEach(async () => {
		vi.clearAllMocks()
		// Reset to default state
		currentHooksState = {
			enabledHooks: [],
			executionHistory: [],
			hasProjectHooks: false,
			snapshotTimestamp: undefined,
		}
		// Get fresh reference to mocked vscode
		const { vscode } = await import("@src/utils/vscode")
		vi.mocked(vscode.postMessage).mockClear()
	})

	it("renders with no hooks configured", () => {
		render(<HooksSettings />)

		expect(screen.getByText("settings:sections.hooks")).toBeInTheDocument()
		expect(screen.getByText("settings:hooks.description")).toBeInTheDocument()
		expect(screen.getByText("settings:hooks.noHooksConfigured")).toBeInTheDocument()
		expect(screen.getByText("settings:hooks.noHooksHint")).toBeInTheDocument()
	})

	it("renders description paragraph at the top", () => {
		render(<HooksSettings />)

		expect(screen.getByText("settings:hooks.description")).toBeInTheDocument()
	})

	it("renders hooks list when hooks are configured", () => {
		const mockHook: HookInfo = {
			id: "hook-1",
			event: "before_execute_command",
			matcher: "git*",
			commandPreview: "echo 'Before git command'",
			enabled: true,
			source: "project",
			timeout: 30,
			description: "Test hook",
		}

		currentHooksState = {
			enabledHooks: [mockHook],
			executionHistory: [],
			hasProjectHooks: true,
			snapshotTimestamp: new Date().toISOString(),
		}

		render(<HooksSettings />)

		// Hook ID should be visible in collapsed state
		expect(screen.getByText(mockHook.id)).toBeInTheDocument()
		expect(screen.getByText(mockHook.source)).toBeInTheDocument()
	})

	it("expands and collapses hook accordion on click", () => {
		const mockHook: HookInfo = {
			id: "hook-1",
			event: "before_execute_command",
			matcher: "git*",
			commandPreview: "echo 'Before git command'",
			enabled: true,
			source: "project",
			timeout: 30,
			description: "Test hook",
		}

		currentHooksState = {
			enabledHooks: [mockHook],
			executionHistory: [],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		// Hook details should not be visible initially
		expect(screen.queryByText(mockHook.event)).not.toBeInTheDocument()
		expect(screen.queryByText(mockHook.matcher!)).not.toBeInTheDocument()

		// Click to expand
		const hookHeader = screen.getByText(mockHook.id).closest("div")
		fireEvent.click(hookHeader!)

		// Hook details should now be visible
		expect(screen.getByText(mockHook.event)).toBeInTheDocument()
		expect(screen.getByText(mockHook.matcher!)).toBeInTheDocument()
		expect(screen.getByText(mockHook.commandPreview)).toBeInTheDocument()

		// Click to collapse
		fireEvent.click(hookHeader!)

		// Hook details should be hidden again
		expect(screen.queryByText(mockHook.event)).not.toBeInTheDocument()
	})

	it("shows per-hook logs in expanded view", () => {
		const mockHook: HookInfo = {
			id: "hook-1",
			event: "before_execute_command",
			commandPreview: "echo test",
			enabled: true,
			source: "global",
			timeout: 30,
		}

		const mockRecord: HookExecutionRecord = {
			timestamp: new Date().toISOString(),
			hookId: "hook-1",
			event: "before_execute_command",
			toolName: "write_to_file",
			exitCode: 0,
			duration: 150,
			timedOut: false,
			blocked: false,
		}

		currentHooksState = {
			enabledHooks: [mockHook],
			executionHistory: [mockRecord],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		// Expand hook
		const hookHeader = screen.getByText(mockHook.id).closest("div")
		fireEvent.click(hookHeader!)

		// Logs section should be visible
		expect(screen.getByText("settings:hooks.logs")).toBeInTheDocument()
		expect(screen.getByText(mockRecord.toolName!)).toBeInTheDocument()
		expect(screen.getByText("settings:hooks.status.completed")).toBeInTheDocument()
	})

	it("filters logs per hook correctly", () => {
		const mockHook1: HookInfo = {
			id: "hook-1",
			event: "before_execute_command",
			commandPreview: "echo test",
			enabled: true,
			source: "global",
			timeout: 30,
		}

		const mockHook2: HookInfo = {
			id: "hook-2",
			event: "after_execute_command",
			commandPreview: "echo after",
			enabled: true,
			source: "global",
			timeout: 30,
		}

		const record1: HookExecutionRecord = {
			timestamp: new Date().toISOString(),
			hookId: "hook-1",
			event: "before_execute_command",
			toolName: "write_to_file",
			exitCode: 0,
			duration: 100,
			timedOut: false,
			blocked: false,
		}

		const record2: HookExecutionRecord = {
			timestamp: new Date().toISOString(),
			hookId: "hook-2",
			event: "after_execute_command",
			toolName: "read_file",
			exitCode: 0,
			duration: 50,
			timedOut: false,
			blocked: false,
		}

		currentHooksState = {
			enabledHooks: [mockHook1, mockHook2],
			executionHistory: [record1, record2],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		// Expand first hook
		const hook1Headers = screen.getAllByText("hook-1")
		const hook1Header = hook1Headers[0].closest("div")
		fireEvent.click(hook1Header!)

		// Should show only hook-1's log
		expect(screen.getByText("write_to_file")).toBeInTheDocument()
		expect(screen.queryByText("read_file")).not.toBeInTheDocument()
	})

	it("shows 'no logs' message when hook has no execution history", () => {
		const mockHook: HookInfo = {
			id: "hook-1",
			event: "before_execute_command",
			commandPreview: "echo test",
			enabled: true,
			source: "global",
			timeout: 30,
		}

		currentHooksState = {
			enabledHooks: [mockHook],
			executionHistory: [],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		// Expand hook
		const hookHeader = screen.getByText(mockHook.id).closest("div")
		fireEvent.click(hookHeader!)

		// Should show no logs message
		expect(screen.getByText("settings:hooks.noLogsForHook")).toBeInTheDocument()
	})

	it("shows project hooks warning when hasProjectHooks is true", () => {
		currentHooksState = {
			...mockHooksState,
			hasProjectHooks: true,
		}

		render(<HooksSettings />)

		expect(screen.getByText("settings:hooks.projectHooksWarningTitle")).toBeInTheDocument()
		expect(screen.getByText("settings:hooks.projectHooksWarningMessage")).toBeInTheDocument()
	})

	it("sends hooksReloadConfig message when Reload button is clicked (bottom action)", async () => {
		const { vscode } = await import("@src/utils/vscode")
		render(<HooksSettings />)

		// Reload button is now in bottom action area (mirroring MCP settings)
		const reloadButton = screen.getByText("settings:hooks.reload")
		fireEvent.click(reloadButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "hooksReloadConfig" })
	})

	it("sends hooksOpenConfigFolder message with 'global' when Global Folder button is clicked (bottom action)", async () => {
		const { vscode } = await import("@src/utils/vscode")

		render(<HooksSettings />)

		// Button is now in bottom action area (like MCP settings)
		const globalFolderButton = screen.getByText("settings:hooks.openGlobalFolder")
		fireEvent.click(globalFolderButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "hooksOpenConfigFolder",
			hooksSource: "global",
		})
	})

	it("sends hooksOpenConfigFolder message with 'project' when Project Folder button is clicked (bottom action)", async () => {
		const { vscode } = await import("@src/utils/vscode")

		render(<HooksSettings />)

		// Button is now in bottom action area (like MCP settings)
		const projectFolderButton = screen.getByText("settings:hooks.openProjectFolder")
		fireEvent.click(projectFolderButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "hooksOpenConfigFolder",
			hooksSource: "project",
		})
	})

	it("renders both Global and Project folder buttons in bottom action area regardless of hasProjectHooks state", () => {
		currentHooksState = {
			...mockHooksState,
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		// Both buttons should be present
		expect(screen.getByText("settings:hooks.openGlobalFolder")).toBeInTheDocument()
		expect(screen.getByText("settings:hooks.openProjectFolder")).toBeInTheDocument()
	})

	it("sends hooksSetEnabled message when hook toggle is changed", async () => {
		const { vscode } = await import("@src/utils/vscode")
		const mockHook: HookInfo = {
			id: "hook-1",
			event: "before_execute_command",
			commandPreview: "echo test",
			enabled: true,
			source: "global",
			timeout: 30,
		}

		currentHooksState = {
			enabledHooks: [mockHook],
			executionHistory: [],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		fireEvent.click(screen.getByTestId("hook-enabled-toggle-hook-1"))

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "hooksSetEnabled",
			hookId: "hook-1",
			hookEnabled: false,
		})
	})

	it("toggles hook enabled state in collapsed view without expanding accordion", async () => {
		const { vscode } = await import("@src/utils/vscode")
		const mockHook: HookInfo = {
			id: "hook-1",
			event: "before_execute_command",
			commandPreview: "echo test",
			enabled: true,
			source: "global",
			timeout: 30,
		}

		currentHooksState = {
			enabledHooks: [mockHook],
			executionHistory: [],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		// Hook should be collapsed initially
		expect(screen.queryByText(mockHook.event)).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("hook-enabled-toggle-hook-1"))

		// Hook should still be collapsed after toggling
		expect(screen.queryByText(mockHook.event)).not.toBeInTheDocument()

		// Toggle message should have been sent
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "hooksSetEnabled",
			hookId: "hook-1",
			hookEnabled: false,
		})
	})

	it("renders green status dot in collapsed row", () => {
		const mockHook: HookInfo = {
			id: "hook-1",
			event: "before_execute_command",
			commandPreview: "echo test",
			enabled: true,
			source: "global",
			timeout: 30,
		}

		currentHooksState = {
			enabledHooks: [mockHook],
			executionHistory: [],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		const dot = screen.getByTestId("hook-status-dot-hook-1")
		expect(dot).toBeInTheDocument()
		expect(dot).toHaveStyle({ background: "var(--vscode-testing-iconPassed)" })
	})

	it("sends hooksDeleteHook message when trash button is clicked", async () => {
		const { vscode } = await import("@src/utils/vscode")
		const mockHook: HookInfo = {
			id: "hook-1",
			event: "before_execute_command",
			commandPreview: "echo test",
			enabled: true,
			source: "project",
			timeout: 30,
		}

		currentHooksState = {
			enabledHooks: [mockHook],
			executionHistory: [],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		fireEvent.click(screen.getByTestId("hook-delete-hook-1"))

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "hooksDeleteHook",
			hookId: "hook-1",
			hooksSource: "project",
		})
	})

	it("sends hooksSetAllEnabled message when top-level Enable Hooks toggle is changed", async () => {
		const { vscode } = await import("@src/utils/vscode")

		currentHooksState = {
			enabledHooks: [
				{
					id: "hook-1",
					event: "event1",
					commandPreview: "cmd1",
					enabled: true,
					source: "global",
					timeout: 30,
				},
				{
					id: "hook-2",
					event: "event2",
					commandPreview: "cmd2",
					enabled: true,
					source: "project",
					timeout: 30,
				},
			],
			executionHistory: [],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		const checkboxes = screen.getAllByRole("checkbox")
		fireEvent.click(checkboxes[0])

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "hooksSetAllEnabled",
			hooksEnabled: false,
		})
	})

	it("renders execution history when available", () => {
		const mockRecord: HookExecutionRecord = {
			timestamp: new Date().toISOString(),
			hookId: "hook-1",
			event: "before_execute_command",
			exitCode: 0,
			duration: 150,
			timedOut: false,
			blocked: false,
		}

		currentHooksState = {
			enabledHooks: [],
			executionHistory: [mockRecord],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		// Activity log should be present
		expect(screen.getByText(/settings:hooks.activityLog/)).toBeInTheDocument()
	})

	it("updates execution history on realtime hookExecutionStatus message", async () => {
		render(<HooksSettings />)

		// Simulate receiving a hookExecutionStatus message
		const event = new MessageEvent("message", {
			data: {
				type: "hookExecutionStatus",
				hookExecutionStatus: {
					status: "completed",
					event: "before_execute_command",
					hookId: "hook-1",
					duration: 200,
				},
			},
		})

		window.dispatchEvent(event)

		// Wait for state update
		await waitFor(() => {
			// The activity log should now show the new execution
			const activityLog = screen.getByText(/settings:hooks.activityLog/)
			expect(activityLog).toBeInTheDocument()
		})
	})

	it("expands and collapses activity log on click", () => {
		const mockRecord: HookExecutionRecord = {
			timestamp: new Date().toISOString(),
			hookId: "hook-1",
			event: "before_execute_command",
			exitCode: 0,
			duration: 150,
			timedOut: false,
			blocked: false,
		}

		currentHooksState = {
			enabledHooks: [],
			executionHistory: [mockRecord],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		const activityLogButton = screen.getByText(/settings:hooks.activityLog/)

		// Should start collapsed
		expect(screen.queryByText(mockRecord.event)).not.toBeInTheDocument()

		// Click to expand
		fireEvent.click(activityLogButton)

		// Should now show the record
		expect(screen.getByText(mockRecord.event)).toBeInTheDocument()
	})

	it("displays different hook sources with appropriate styling", () => {
		const hooks: HookInfo[] = [
			{
				id: "hook-1",
				event: "event1",
				commandPreview: "cmd1",
				enabled: true,
				source: "project",
				timeout: 30,
			},
			{
				id: "hook-2",
				event: "event2",
				commandPreview: "cmd2",
				enabled: true,
				source: "mode",
				timeout: 30,
			},
			{
				id: "hook-3",
				event: "event3",
				commandPreview: "cmd3",
				enabled: true,
				source: "global",
				timeout: 30,
			},
		]

		currentHooksState = {
			enabledHooks: hooks,
			executionHistory: [],
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		// All three source types should be present
		expect(screen.getByText("project")).toBeInTheDocument()
		expect(screen.getByText("mode")).toBeInTheDocument()
		expect(screen.getByText("global")).toBeInTheDocument()
	})

	it("displays activity log status pills correctly", () => {
		const records: HookExecutionRecord[] = [
			{
				timestamp: new Date().toISOString(),
				hookId: "hook-1",
				event: "event1",
				exitCode: 0,
				duration: 100,
				timedOut: false,
				blocked: false,
			},
			{
				timestamp: new Date().toISOString(),
				hookId: "hook-2",
				event: "event2",
				exitCode: 1,
				duration: 200,
				timedOut: false,
				blocked: false,
				error: "Command failed",
			},
			{
				timestamp: new Date().toISOString(),
				hookId: "hook-3",
				event: "event3",
				exitCode: null,
				duration: 300,
				timedOut: false,
				blocked: true,
				blockMessage: "Operation blocked",
			},
		]

		currentHooksState = {
			enabledHooks: [],
			executionHistory: records,
			hasProjectHooks: false,
		}

		render(<HooksSettings />)

		// Expand activity log
		const activityLogButton = screen.getByText(/settings:hooks.activityLog/)
		fireEvent.click(activityLogButton)

		// Check for status labels
		expect(screen.getByText("settings:hooks.status.completed")).toBeInTheDocument()
		expect(screen.getByText("settings:hooks.status.failed")).toBeInTheDocument()
		expect(screen.getByText("settings:hooks.status.blocked")).toBeInTheDocument()
	})
})
