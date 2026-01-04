/**
 * Interface exports for VSCode API
 *
 * This barrel file re-exports all interfaces from the interfaces directory
 */

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
	CancellationToken,
	FileSystemWatcher,
	RelativePattern,
} from "./document.js"

// Editor interfaces
export type {
	TextEditor,
	TextEditorEdit,
	TextEditorSelectionChangeEvent,
	TextDocumentShowOptions,
	DecorationRenderOptions,
	TextEditorDecorationType,
} from "./editor.js"

// Terminal interfaces
export type {
	Terminal,
	TerminalOptions,
	TerminalExitStatus,
	TerminalState,
	TerminalDimensionsChangeEvent,
	TerminalDimensions,
	TerminalDataWriteEvent,
} from "./terminal.js"

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
} from "./webview.js"

// Workspace interfaces
export type {
	WorkspaceConfiguration,
	QuickPickOptions,
	InputBoxOptions,
	OpenDialogOptions,
	Disposable,
	DiagnosticCollection,
	IdentityInfo,
} from "./workspace.js"
