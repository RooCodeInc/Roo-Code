import nock from "nock"
import { vi } from "vitest"

import "./utils/path" // Import to enable String.prototype.toPosix().

// Disable network requests by default for all tests.
nock.disableNetConnect()

export function allowNetConnect(host?: string | RegExp) {
	if (host) {
		nock.enableNetConnect(host)
	} else {
		nock.enableNetConnect()
	}
}

// Global mocks that many tests expect.
global.structuredClone = global.structuredClone || ((obj: any) => JSON.parse(JSON.stringify(obj)))

// Global VSCode mock for all tests
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [],
		getWorkspaceFolder: () => null,
		onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
		getConfiguration: () => ({
			get: () => null,
		}),
		createFileSystemWatcher: (pattern: any) => ({
			onDidCreate: () => ({ dispose: () => {} }),
			onDidChange: () => ({ dispose: () => {} }),
			onDidDelete: () => ({ dispose: () => {} }),
			dispose: () => {},
			pattern: pattern,
		}),
		fs: {
			readFile: () => Promise.resolve(new Uint8Array()),
			writeFile: () => Promise.resolve(),
			stat: () => Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 0 }),
		},
		openTextDocument: () => {},
	},
	window: {
		activeTextEditor: null,
		onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
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
		onDidCloseTerminal: () => ({ dispose: () => {} }),
		createTextEditorDecorationType: () => ({ dispose: () => {} }),
		showTextDocument: () => {},
		tabGroups: { all: [] },
	},
	commands: {
		registerCommand: () => ({ dispose: () => {} }),
		executeCommand: () => Promise.resolve(),
	},
	languages: {
		createDiagnosticCollection: () => ({
			set: () => {},
			delete: () => {},
			clear: () => {},
			dispose: () => {},
		}),
	},
	extensions: {
		getExtension: (extensionId: string) => ({
			extensionPath: "/mock/extension/path",
			extensionUri: { fsPath: "/mock/extension/path", path: "/mock/extension/path", scheme: "file" },
			packageJSON: {
				name: "zgsm",
				publisher: "zgsm-ai",
				version: "2.0.27",
			},
		}),
		all: [],
	},
	env: {
		openExternal: () => Promise.resolve(),
		uriScheme: "vscode",
	},
	Uri: {
		file: (path: any) => ({ fsPath: path, path, scheme: "file" }),
		parse: (path: any) => ({ fsPath: path, path, scheme: "file" }),
	},
	Range: class {
		start: any
		end: any
		constructor(start: any, end: any) {
			this.start = start
			this.end = end
		}
	},
	Position: class {
		line: any
		character: any
		constructor(line: any, character: any) {
			this.line = line
			this.character = character
		}
	},
	Selection: class {
		start: any
		end: any
		anchor: any
		active: any
		constructor(start: any, end: any) {
			this.start = start
			this.end = end
			this.anchor = start
			this.active = end
		}
	},
	RelativePattern: class {
		base: any
		pattern: any
		constructor(base: any, pattern: any) {
			this.base = base
			this.pattern = pattern
		}
	},
	Disposable: {
		dispose: () => {},
	},
	ThemeIcon: class {
		id: any
		constructor(id: any) {
			this.id = id
		}
	},
	FileType: {
		File: 1,
		Directory: 2,
		SymbolicLink: 64,
	},
	DiagnosticSeverity: {
		Error: 0,
		Warning: 1,
		Information: 2,
		Hint: 3,
	},
	OverviewRulerLane: {
		Left: 1,
		Center: 2,
		Right: 4,
		Full: 7,
	},
	CodeAction: class {
		title: any
		kind: any
		command: any
		constructor(title: any, kind: any) {
			this.title = title
			this.kind = kind
			this.command = undefined
		}
	},
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
		RefactorRewrite: { value: "refactor.rewrite" },
	},
	EventEmitter: () => ({
		event: () => () => {},
		fire: () => {},
		dispose: () => {},
	}),
	CommentMode: {
		Editing: 0,
		Preview: 1,
	},
	CommentThreadCollapsibleState: {
		Collapsed: 0,
		Expanded: 1,
	},
	comments: {
		createCommentController: (id: any, label: any) => ({
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
	},
	TextEditorRevealType: {
		Default: 0,
		InCenter: 1,
		InCenterIfOutsideViewport: 2,
		AtTop: 3,
	},
}))
