// Mock VSCode API for Vitest tests
const mockEventEmitter = () => ({
	event: () => () => {},
	fire: () => {},
	dispose: () => {},
})

const mockDisposable = {
	dispose: () => {},
}

const mockUri = {
	file: (path) => ({ fsPath: path, path, scheme: "file" }),
	parse: (path) => ({ fsPath: path, path, scheme: "file" }),
}

const mockRange = class {
	constructor(start, end) {
		this.start = start
		this.end = end
	}
}

const mockPosition = class {
	constructor(line, character) {
		this.line = line
		this.character = character
	}
}

const mockSelection = class extends mockRange {
	constructor(start, end) {
		super(start, end)
		this.anchor = start
		this.active = end
	}
}

const mockRelativePattern = class {
	constructor(base, pattern) {
		this.base = base
		this.pattern = pattern
	}
}

export const workspace = {
	workspaceFolders: [],
	getWorkspaceFolder: () => null,
	onDidChangeWorkspaceFolders: () => mockDisposable,
	getConfiguration: () => ({
		get: () => null,
	}),
	createFileSystemWatcher: (pattern) => ({
		onDidCreate: (callback) => mockDisposable,
		onDidChange: (callback) => mockDisposable,
		onDidDelete: (callback) => mockDisposable,
		dispose: () => {},
		pattern: pattern,
	}),
	fs: {
		readFile: () => Promise.resolve(new Uint8Array()),
		writeFile: () => Promise.resolve(),
		stat: () => Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 0 }),
	},
	openTextDocument: () => {},
}

export const window = {
	activeTextEditor: null,
	onDidChangeActiveTextEditor: () => mockDisposable,
	showErrorMessage: () => Promise.resolve(),
	showWarningMessage: () => Promise.resolve(),
	showInformationMessage: () => Promise.resolve(),
	createOutputChannel: () => ({
		appendLine: () => {},
		append: () => {},
		clear: () => {},
		show: () => {},
		dispose: () => {},
	}),
	createTerminal: () => ({
		exitStatus: undefined,
		name: "CoStrict",
		processId: Promise.resolve(123),
		creationOptions: {},
		state: { isInteractedWith: true },
		dispose: () => {},
		hide: () => {},
		show: () => {},
		sendText: () => {},
	}),
	onDidCloseTerminal: () => mockDisposable,
	createTextEditorDecorationType: () => ({ dispose: () => {} }),
	showTextDocument: () => {},
	tabGroups: { all: [] },
}

export const commands = {
	registerCommand: () => mockDisposable,
	executeCommand: () => Promise.resolve(),
}

export const languages = {
	createDiagnosticCollection: () => ({
		set: () => {},
		delete: () => {},
		clear: () => {},
		dispose: () => {},
	}),
}

export const extensions = {
	getExtension: () => null,
}

export const env = {
	openExternal: () => Promise.resolve(),
	uriScheme: "vscode",
}

export const Uri = mockUri
export const Range = mockRange
export const Position = mockPosition
export const Selection = mockSelection
export const RelativePattern = mockRelativePattern
export const Disposable = mockDisposable
export const ThemeIcon = class {
	constructor(id) {
		this.id = id
	}
}

export const FileType = {
	File: 1,
	Directory: 2,
	SymbolicLink: 64,
}

export const DiagnosticSeverity = {
	Error: 0,
	Warning: 1,
	Information: 2,
	Hint: 3,
}

export const OverviewRulerLane = {
	Left: 1,
	Center: 2,
	Right: 4,
	Full: 7,
}

export const CodeAction = class {
	constructor(title, kind) {
		this.title = title
		this.kind = kind
		this.command = undefined
	}
}

export const CodeActionKind = {
	QuickFix: { value: "quickfix" },
	RefactorRewrite: { value: "refactor.rewrite" },
}

export const EventEmitter = mockEventEmitter

export const CommentMode = {
	Editing: 0,
	Preview: 1,
}

export const CommentThreadCollapsibleState = {
	Collapsed: 0,
	Expanded: 1,
}

export const comments = {
	createCommentController: (id, label) => ({
		id,
		label,
		createCommentThread: () => ({
			uri: null,
			range: null,
			comments: [],
			collapsibleState: 1,
			canReply: false,
			contextValue: "",
			label: "",
			dispose: () => {},
		}),
		dispose: () => {},
		commentingRangeProvider: null,
	}),
}

export const TextEditorRevealType = {
	Default: 0,
	InCenter: 1,
	InCenterIfOutsideViewport: 2,
	AtTop: 3,
}

export default {
	workspace,
	window,
	commands,
	languages,
	extensions,
	env,
	Uri,
	Range,
	Position,
	Selection,
	RelativePattern,
	Disposable,
	ThemeIcon,
	FileType,
	DiagnosticSeverity,
	OverviewRulerLane,
	EventEmitter,
	CodeAction,
	CodeActionKind,
	CommentMode,
	CommentThreadCollapsibleState,
	comments,
	TextEditorRevealType,
}
