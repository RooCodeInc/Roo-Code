import { vi } from "vitest"

export const window = {
	showInformationMessage: vi.fn(),
	showErrorMessage: vi.fn(),
	showWarningMessage: vi.fn(),
	showQuickPick: vi.fn(),
	showInputBox: vi.fn(),
	createOutputChannel: vi.fn(() => ({
		appendLine: vi.fn(),
		append: vi.fn(),
		clear: vi.fn(),
		show: vi.fn(),
		hide: vi.fn(),
		dispose: vi.fn(),
	})),
	createWebviewPanel: vi.fn(() => ({
		webview: {
			asWebviewUri: vi.fn((uri) => uri),
			postMessage: vi.fn(),
			onDidReceiveMessage: vi.fn(),
		},
		onDidChangeViewState: vi.fn(),
		onDidDispose: vi.fn(),
		reveal: vi.fn(),
		dispose: vi.fn(),
	})),
}

export const env = {
	openExternal: vi.fn(),
	getConfiguration: vi.fn(() => ({
		get: vi.fn(),
		update: vi.fn(),
		has: vi.fn(),
		inspect: vi.fn(),
	})),
	uriScheme: "vscode",
	appName: "Code",
	appRoot: "",
	appHost: "desktop",
	language: "en",
	sessionId: "",
	shell: "",
	remoteName: undefined,
	isTelemetryEnabled: false,
	openInEditor: vi.fn(),
	asExternalUri: vi.fn(),
	getUriScheme: vi.fn(),
}

export const Uri = {
	parse: vi.fn((uri: string) => ({
		scheme: "file",
		authority: "",
		path: uri,
		query: "",
		fragment: "",
		fsPath: uri,
		with: vi.fn(),
		toString: () => uri,
	})),
	file: vi.fn((path: string) => ({
		scheme: "file",
		authority: "",
		path: path,
		query: "",
		fragment: "",
		fsPath: path,
		with: vi.fn(),
		toString: () => path,
	})),
	joinPath: vi.fn((base: any, ...pathSegments: string[]) => ({
		...base,
		path: `${base.path}/${pathSegments.join("/")}`,
		fsPath: `${base.fsPath}/${pathSegments.join("/")}`,
		with: vi.fn(),
		toString: () => `${base.path}/${pathSegments.join("/")}`,
	})),
}

export const commands = {
	executeCommand: vi.fn().mockResolvedValue(undefined),
	registerCommand: vi.fn(),
	registerTextEditorCommand: vi.fn(),
}

export const workspace = {
	getConfiguration: vi.fn(() => ({
		get: vi.fn(),
		update: vi.fn(),
		has: vi.fn(),
		inspect: vi.fn(),
	})),
	getWorkspaceFolder: vi.fn(),
	workspaceFolders: [],
	asRelativePath: vi.fn((path: string) => path),
	findFiles: vi.fn(),
	textDocuments: [],
	onDidOpenTextDocument: vi.fn(),
	onDidCloseTextDocument: vi.fn(),
	onDidChangeTextDocument: vi.fn(),
	onDidChangeConfiguration: vi.fn(),
	onDidSaveTextDocument: vi.fn(),
}

export const extensions = {
	getExtension: vi.fn(),
	all: [],
}

export const languages = {
	createDiagnosticCollection: vi.fn(() => ({
		set: vi.fn(),
		delete: vi.fn(),
		clear: vi.fn(),
		dispose: vi.fn(),
	})),
}

export const DiagnosticSeverity = {
	Error: 0,
	Warning: 1,
	Information: 2,
	Hint: 3,
}

export const Position = vi.fn((line: number, character: number) => ({
	line,
	character,
	isBefore: vi.fn(),
	isBeforeOrEqual: vi.fn(),
	isAfter: vi.fn(),
	isAfterOrEqual: vi.fn(),
	isEqual: vi.fn(),
	translate: vi.fn(),
	with: vi.fn(),
}))

export const Range = vi.fn((startLine: number, startCharacter: number, endLine: number, endCharacter: number) => ({
	start: { line: startLine, character: startCharacter },
	end: { line: endLine, character: endCharacter },
	contains: vi.fn(),
	isEqual: vi.fn(),
	intersection: vi.fn(),
	union: vi.fn(),
	with: vi.fn(),
}))

export const Diagnostic = vi.fn((location: any, message: string, severity: number) => ({
	location,
	message,
	severity,
	source: "",
	code: "",
	relatedInformation: [],
	tags: [],
}))

export const CodeActionKind = {
	QuickFix: "quickfix",
	Refactor: "refactor",
	Source: "source",
	SourceOrganizeImports: "source.organizeImports",
}

export const CodeAction = vi.fn((title: string, kind?: string) => ({
	title,
	kind,
	edit: vi.fn(),
	command: vi.fn(),
	diagnostics: [],
	isPreferred: false,
	disabled: undefined,
}))

export const StatusBarAlignment = {
	Left: 1,
	Right: 2,
}

export const ThemeColor = vi.fn((id: string) => ({ id }))

export const TreeItemCollapsibleState = {
	None: 0,
	Collapsed: 1,
	Expanded: 2,
}

export const TreeItem = vi.fn((label: string, collapsibleState?: number) => ({
	label,
	collapsibleState,
	iconPath: undefined,
	contextValue: undefined,
	command: undefined,
	tooltip: undefined,
	resourceUri: undefined,
}))

export const ViewColumn = {
	Active: -1,
	Beside: -2,
	One: 1,
	Two: 2,
	Three: 3,
	Four: 4,
	Five: 5,
	Six: 6,
	Seven: 7,
	Eight: 8,
	Nine: 9,
}

export interface ExtensionContext {
	secrets: {
		get: (key: string) => Promise<string | undefined>
		store: (key: string, value: string) => Promise<void>
		delete: (key: string) => Promise<void>
		onDidChange: (listener: (e: { key: string }) => void) => {
			dispose: () => void
		}
	}
	globalState: {
		get: <T>(key: string) => T | undefined
		update: (key: string, value: any) => Promise<void>
	}
	subscriptions: any[]
	extension?: {
		packageJSON?: {
			version?: string
			publisher?: string
			name?: string
		}
	}
}

// Mock implementation for tests
export const mockExtensionContext: ExtensionContext = {
	secrets: {
		get: vi.fn().mockResolvedValue(undefined),
		store: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
		onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
	},
	globalState: {
		get: vi.fn().mockReturnValue(undefined),
		update: vi.fn().mockResolvedValue(undefined),
	},
	subscriptions: [],
	extension: {
		packageJSON: {
			version: "1.0.0",
			publisher: "RooVeterinaryInc",
			name: "roo-cline",
		},
	},
}

export default {
	window,
	env,
	Uri,
	commands,
	workspace,
	extensions,
	languages,
	DiagnosticSeverity,
	Position,
	Range,
	Diagnostic,
	CodeActionKind,
	CodeAction,
	StatusBarAlignment,
	ThemeColor,
	TreeItemCollapsibleState,
	TreeItem,
	ViewColumn,
	mockExtensionContext,
}
