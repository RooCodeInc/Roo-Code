/**
 * VSCode API Mock - Barrel Export File
 *
 * This file re-exports all components from the modular files for backwards compatibility.
 * All imports from this file will continue to work as before.
 */

// ============================================================================
// Classes from ./classes/
// ============================================================================
export { Position } from "./classes/Position.ts"
export { Range } from "./classes/Range.ts"
export { Selection } from "./classes/Selection.ts"
export { Uri } from "./classes/Uri.ts"
export { EventEmitter } from "./classes/EventEmitter.ts"
export { TextEdit, WorkspaceEdit } from "./classes/TextEdit.ts"
export {
	Location,
	Diagnostic,
	DiagnosticRelatedInformation,
	ThemeColor,
	ThemeIcon,
	CodeActionKind,
	CodeLens,
	LanguageModelTextPart,
	LanguageModelToolCallPart,
	LanguageModelToolResultPart,
	FileSystemError,
} from "./classes/Additional.ts"
export { CancellationTokenSource, type CancellationToken } from "./classes/CancellationToken.ts"
export { OutputChannel } from "./classes/OutputChannel.ts"
export { StatusBarItem } from "./classes/StatusBarItem.ts"
export { TextEditorDecorationType } from "./classes/TextEditorDecorationType.ts"

// ============================================================================
// Context
// ============================================================================
export { ExtensionContextImpl as ExtensionContext } from "./context/ExtensionContext.ts"

// ============================================================================
// API Classes from ./api/
// ============================================================================
export { FileSystemAPI } from "./api/FileSystemAPI.ts"
export {
	MockWorkspaceConfiguration,
	setRuntimeConfig,
	setRuntimeConfigValues,
	clearRuntimeConfig,
	getRuntimeConfig,
} from "./api/WorkspaceConfiguration.ts"
export { WorkspaceAPI } from "./api/WorkspaceAPI.ts"
export { TabGroupsAPI, type Tab, type TabInputText, type TabGroup } from "./api/TabGroupsAPI.ts"
export { WindowAPI } from "./api/WindowAPI.ts"
export { CommandsAPI } from "./api/CommandsAPI.ts"
export { createVSCodeAPIMock } from "./api/create-vscode-api-mock.ts"

// ============================================================================
// Enums from ./types.ts
// ============================================================================
export {
	ConfigurationTarget,
	ViewColumn,
	TextEditorRevealType,
	StatusBarAlignment,
	DiagnosticSeverity,
	DiagnosticTag,
	EndOfLine,
	UIKind,
	ExtensionMode,
	ExtensionKind,
	FileType,
	DecorationRangeBehavior,
	OverviewRulerLane,
} from "./types.ts"

// ============================================================================
// Types from ./types.ts
// ============================================================================
export type { Thenable, Memento, FileStat, TextEditorOptions, ConfigurationInspect } from "./types.ts"

// ============================================================================
// Interfaces from ./interfaces/
// ============================================================================

// Document interfaces
export type {
	TextDocument,
	TextLine,
	WorkspaceFoldersChangeEvent,
	WorkspaceFolder,
	TextDocumentChangeEvent,
	TextDocumentContentChangeEvent,
	ConfigurationChangeEvent,
	TextDocumentContentProvider,
	FileSystemWatcher,
	RelativePattern,
} from "./interfaces/document.ts"

// Editor interfaces
export type {
	TextEditor,
	TextEditorEdit,
	TextEditorSelectionChangeEvent,
	TextDocumentShowOptions,
	DecorationRenderOptions,
} from "./interfaces/editor.ts"

// Terminal interfaces
export type {
	Terminal,
	TerminalOptions,
	TerminalExitStatus,
	TerminalState,
	TerminalDimensionsChangeEvent,
	TerminalDimensions,
	TerminalDataWriteEvent,
} from "./interfaces/terminal.ts"

// Webview interfaces
export type {
	WebviewViewProvider,
	WebviewView,
	Webview,
	WebviewOptions,
	WebviewPortMapping,
	ViewBadge,
	WebviewViewResolveContext,
	WebviewViewProviderOptions,
	UriHandler,
} from "./interfaces/webview.ts"

// Extension host interface
export type { IExtensionHost, ExtensionHostEventMap, ExtensionHostEventName } from "./interfaces/extension-host.ts"

// Workspace interfaces
export type {
	WorkspaceConfiguration,
	QuickPickOptions,
	InputBoxOptions,
	OpenDialogOptions,
	Disposable,
	DiagnosticCollection,
	IdentityInfo,
} from "./interfaces/workspace.ts"

// ============================================================================
// Secret Storage interface (backwards compatibility)
// ============================================================================
export interface SecretStorage {
	get(key: string): Thenable<string | undefined>
	store(key: string, value: string): Thenable<void>
	delete(key: string): Thenable<void>
}

// Import Thenable for SecretStorage interface
import type { Thenable } from "./types.ts"
