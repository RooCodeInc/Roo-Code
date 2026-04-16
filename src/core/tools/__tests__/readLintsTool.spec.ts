import * as path from "path"
import * as vscode from "vscode"

import { readLintsTool } from "../ReadLintsTool"

const NO_EDITS_MESSAGE =
	"No files have been edited in this task yet. Edit a file, then use read_lints to see errors and warnings."
const NO_PROBLEMS_MESSAGE = "No errors or warnings detected."

vi.mock("vscode", () => ({
	Uri: {
		file: (p: string) => ({
			fsPath: p,
			toString: () => p,
		}),
	},
	Diagnostic: class {
		constructor(
			public range: { start: { line: number }; end: { line: number } },
			public message: string,
			public severity: number,
		) {}
	},
	Range: class {
		start: { line: number; character: number }
		end: { line: number; character: number }
		constructor(startLine: number, startChar: number, endLine: number, endChar: number) {
			this.start = { line: startLine, character: startChar }
			this.end = { line: endLine, character: endChar }
		}
	},
	DiagnosticSeverity: {
		Error: 0,
		Warning: 1,
		Information: 2,
		Hint: 3,
	},
	FileType: {
		Unknown: 0,
		File: 1,
		Directory: 2,
		SymbolicLink: 64,
	},
	languages: {
		getDiagnostics: vi.fn(),
	},
	workspace: {
		fs: {
			stat: vi.fn(),
		},
		openTextDocument: vi.fn(),
	},
}))

vi.mock("../../../integrations/diagnostics", () => ({
	diagnosticsToProblemsString: vi.fn(
		async (diagnostics: [vscode.Uri, vscode.Diagnostic[]][], _severities: unknown, _cwd: string) => {
			if (diagnostics.length === 0) return ""
			return diagnostics
				.map(([uri, diags]) => `${path.basename(uri.fsPath)}\n${diags.map((d) => `  ${d.message}`).join("\n")}`)
				.join("\n\n")
		},
	),
}))

describe("ReadLintsTool", () => {
	const cwd = path.resolve("/project")
	let mockTask: any
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()
		mockPushToolResult = vi.fn()
		mockHandleError = vi.fn()
		mockTask = {
			cwd,
			editedFilePaths: new Set<string>(),
			providerRef: {
				deref: vi.fn().mockReturnValue({
					getState: vi.fn().mockResolvedValue({
						includeDiagnosticMessages: true,
						maxDiagnosticMessages: 50,
					}),
				}),
			},
		}
		vi.mocked(vscode.languages.getDiagnostics).mockReturnValue([])
		vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({
			type: vscode.FileType.File,
			ctime: 0,
			mtime: 0,
			size: 0,
		})
	})

	it("returns NO_EDITS_MESSAGE when no paths and no edited files", async () => {
		mockTask.editedFilePaths = new Set<string>()
		await readLintsTool.execute({}, mockTask, {
			askApproval: vi.fn().mockResolvedValue(true),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})
		expect(mockPushToolResult).toHaveBeenCalledWith(NO_EDITS_MESSAGE)
		expect(vscode.languages.getDiagnostics).not.toHaveBeenCalled()
	})

	it("filters diagnostics to edited files when no paths provided", async () => {
		const editedRel = "src/foo.ts"
		mockTask.editedFilePaths = new Set([editedRel])
		const fileUri = vscode.Uri.file(path.join(cwd, editedRel))
		const diag = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 5), "Test error", vscode.DiagnosticSeverity.Error)
		vi.mocked(vscode.languages.getDiagnostics).mockReturnValue([[fileUri, [diag]]])

		await readLintsTool.execute({}, mockTask, {
			askApproval: vi.fn().mockResolvedValue(true),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		expect(vscode.languages.getDiagnostics).toHaveBeenCalledWith()
		expect(mockPushToolResult).toHaveBeenCalled()
		const result = mockPushToolResult.mock.calls[0][0]
		expect(result).toContain("foo.ts")
		expect(result).toContain("Test error")
	})

	it("returns NO_PROBLEMS_MESSAGE when includeDiagnosticMessages is false", async () => {
		mockTask.editedFilePaths = new Set(["src/foo.ts"])
		mockTask.providerRef.deref = vi.fn().mockReturnValue({
			getState: vi.fn().mockResolvedValue({
				includeDiagnosticMessages: false,
				maxDiagnosticMessages: 50,
			}),
		})

		await readLintsTool.execute({}, mockTask, {
			askApproval: vi.fn().mockResolvedValue(true),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		expect(mockPushToolResult).toHaveBeenCalledWith(NO_PROBLEMS_MESSAGE)
	})

	it("returns diagnostics for requested file path", async () => {
		const fileUri = vscode.Uri.file(path.join(cwd, "src/bar.ts"))
		const diag = new vscode.Diagnostic(
			new vscode.Range(1, 0, 1, 10),
			"Bar warning",
			vscode.DiagnosticSeverity.Warning,
		)
		vi.mocked(vscode.languages.getDiagnostics).mockImplementation((uri?: vscode.Uri): any => {
			if (uri && uri.fsPath === fileUri.fsPath) return [diag]
			return []
		})

		await readLintsTool.execute({ paths: ["src/bar.ts"] }, mockTask, {
			askApproval: vi.fn().mockResolvedValue(true),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		expect(mockPushToolResult).toHaveBeenCalled()
		const result = mockPushToolResult.mock.calls[0][0]
		expect(result).toContain("Bar warning")
	})

	it("returns NO_PROBLEMS_MESSAGE when diagnostics are empty", async () => {
		mockTask.editedFilePaths = new Set(["src/empty.ts"])
		vi.mocked(vscode.languages.getDiagnostics).mockReturnValue([])

		await readLintsTool.execute({}, mockTask, {
			askApproval: vi.fn().mockResolvedValue(true),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		expect(mockPushToolResult).toHaveBeenCalledWith(NO_PROBLEMS_MESSAGE)
	})

	it("only includes Error and Warning severities in output", async () => {
		const { diagnosticsToProblemsString } = await import("../../../integrations/diagnostics")
		vi.mocked(diagnosticsToProblemsString).mockResolvedValue("file.ts\n  Error message\n  Warning message")

		mockTask.editedFilePaths = new Set(["src/file.ts"])
		const fileUri = vscode.Uri.file(path.join(cwd, "src/file.ts"))
		const diagnostics = [
			new vscode.Diagnostic(new vscode.Range(0, 0, 0, 5), "Error message", vscode.DiagnosticSeverity.Error),
			new vscode.Diagnostic(new vscode.Range(1, 0, 1, 5), "Warning message", vscode.DiagnosticSeverity.Warning),
			new vscode.Diagnostic(new vscode.Range(2, 0, 2, 5), "Info message", vscode.DiagnosticSeverity.Information),
		]
		vi.mocked(vscode.languages.getDiagnostics).mockReturnValue([[fileUri, diagnostics]])

		await readLintsTool.execute({}, mockTask, {
			askApproval: vi.fn().mockResolvedValue(true),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		expect(diagnosticsToProblemsString).toHaveBeenCalledWith(
			expect.any(Array),
			[vscode.DiagnosticSeverity.Error, vscode.DiagnosticSeverity.Warning],
			cwd,
			true,
			50,
		)
	})
})
