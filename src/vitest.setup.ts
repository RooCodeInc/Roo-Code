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

vi.mock("vscode", async (importOriginal) => {
	const actual = await importOriginal<typeof import("vscode")>()
	return {
		...actual,
		window: {
			createOutputChannel: () => ({
				appendLine: vi.fn(),
				show: vi.fn(),
			}),
			showErrorMessage: vi.fn(),
			createTextEditorDecorationType: vi.fn(),
			createTerminal: vi.fn(),
		},
		workspace: {
			getConfiguration: () => ({
				get: vi.fn(),
			}),
			workspaceFolders: [],
			fs: {
				writeFile: vi.fn(),
			},
			openTextDocument: vi.fn(),
			getWorkspaceFolder: vi.fn(),
			createFileSystemWatcher: vi.fn(() => ({
				onDidChange: vi.fn(),
				onDidCreate: vi.fn(),
				onDidDelete: vi.fn(),
				dispose: vi.fn(),
			})),
		},
		env: {
			uriScheme: "vscode",
		},
		Uri: {
			file: (path: string) => ({ fsPath: path }),
		},
		ThemeIcon: class {},
		Range: class {},
		commands: {
			executeCommand: vi.fn(),
		},
		RelativePattern: class {},
		comments: {
			createCommentController: vi.fn(() => ({
				dispose: vi.fn(),
			})),
		},
		CommentThreadCollapsibleState: {
			Expanded: 1,
			Collapsed: 0,
		},
		CommentMode: {
			Editing: 0,
			Preview: 1,
		},
		CommentPermission: {
			None: 0,
			ReadOnly: 1,
			ReadWrite: 2,
		},
		TextEditorRevealType: {
			InCenter: 2,
		},
		Selection: class {},
	}
})
