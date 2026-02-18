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
