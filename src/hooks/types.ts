import type * as vscode from "vscode"

export type HookContext = {
	extensionContext: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
}

export enum HookPriority {
	Low = "low",
	Normal = "normal",
	High = "high",
	Critical = "critical",
}

export interface HookOptions {
	priority?: HookPriority
	name?: string
}

export type HookCallback<T = unknown> = (context: HookContext, data?: T) => void | Promise<void>

export type HookUnregister = () => void

export enum HookLifecycleStage {
	BeforeActivate = "before-activate",
	AfterActivate = "after-activate",
	BeforeDeactivate = "before-deactivate",
	AfterDeactivate = "after-deactivate",
}

export enum HookEventType {
	TaskCreated = "task-created",
	TaskStarted = "task-started",
	TaskCompleted = "task-completed",
	TaskAborted = "task-aborted",
	ProviderInitialized = "provider-initialized",
	SettingsChanged = "settings-changed",
	WorkspaceOpened = "workspace-opened",
	WorkspaceClosed = "workspace-closed",
}

export interface HookRegistration {
	id: string
	stage?: HookLifecycleStage
	event?: HookEventType
	callback: HookCallback
	options: HookOptions
}

export interface ToolCall {
	name: string
	parameters: Record<string, unknown>
	context?: unknown
}

export interface HookResult {
	blocked: boolean
	reason?: string
	enrichedContext?: unknown
	recoveryHint?: string
}

export interface IHook {
	name: string
	execute(toolCall: ToolCall, context?: ToolHookContext, result?: unknown): Promise<HookResult>
}

export interface ToolHookContext {
	activeIntentId?: string
	sessionId: string
	workspacePath: string
	modelName: string
	agentRole: "Architect" | "Builder" | "Tester"
}

export interface IntentSpec {
	id: string
	name: string
	status: "IN_PROGRESS" | "COMPLETED" | "BLOCKED"
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}
