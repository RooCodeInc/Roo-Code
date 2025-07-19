import * as vscode from "vscode"

const fadedOverlayDecorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: "rgba(255, 255, 0, 0.1)",
	opacity: "0.4",
	isWholeLine: true,
})

const activeLineDecorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: "rgba(255, 255, 0, 0.3)",
	opacity: "1",
	isWholeLine: true,
	border: "1px solid rgba(255, 255, 0, 0.5)",
})

type DecorationType = "fadedOverlay" | "activeLine"

export class DecorationController {
	private decorationType: DecorationType
	private editor: vscode.TextEditor
	private ranges: vscode.Range[] = []
	private isDisposed: boolean = false

	constructor(decorationType: DecorationType, editor: vscode.TextEditor) {
		this.decorationType = decorationType
		this.editor = editor
	}

	getDecoration() {
		switch (this.decorationType) {
			case "fadedOverlay":
				return fadedOverlayDecorationType
			case "activeLine":
				return activeLineDecorationType
		}
	}

	addLines(startIndex: number, numLines: number) {
		// Guard against invalid inputs or disposed editor
		if (startIndex < 0 || numLines <= 0 || this.isDisposed || !this.isEditorValid()) {
			return
		}

		const lastRange = this.ranges[this.ranges.length - 1]
		if (lastRange && lastRange.end.line === startIndex - 1) {
			this.ranges[this.ranges.length - 1] = lastRange.with(undefined, lastRange.end.translate(numLines))
		} else {
			const endLine = startIndex + numLines - 1
			this.ranges.push(new vscode.Range(startIndex, 0, endLine, Number.MAX_SAFE_INTEGER))
		}

		this.editor.setDecorations(this.getDecoration(), this.ranges)
	}

	clear() {
		if (this.isDisposed || !this.isEditorValid()) {
			return
		}
		this.ranges = []
		this.editor.setDecorations(this.getDecoration(), this.ranges)
	}

	updateOverlayAfterLine(line: number, totalLines: number) {
		if (this.isDisposed || !this.isEditorValid()) {
			return
		}

		// Remove any existing ranges that start at or after the current line
		this.ranges = this.ranges.filter((range) => range.end.line < line)

		// Add a new range for all lines after the current line
		if (line < totalLines - 1) {
			this.ranges.push(
				new vscode.Range(
					new vscode.Position(line + 1, 0),
					new vscode.Position(totalLines - 1, Number.MAX_SAFE_INTEGER),
				),
			)
		}

		// Apply the updated decorations
		this.editor.setDecorations(this.getDecoration(), this.ranges)
	}

	setActiveLine(line: number) {
		if (this.isDisposed || !this.isEditorValid()) {
			return
		}
		this.ranges = [new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER)]
		this.editor.setDecorations(this.getDecoration(), this.ranges)
	}

	dispose() {
		this.isDisposed = true
		// Clear decorations before disposing
		if (this.isEditorValid()) {
			this.editor.setDecorations(this.getDecoration(), [])
		}
	}

	private isEditorValid(): boolean {
		// Check if the editor is still valid by verifying it exists in visible editors
		// and its document hasn't been closed
		try {
			// In test environments, visibleTextEditors might be empty, so also check if document exists
			const isInVisibleEditors = vscode.window.visibleTextEditors.includes(this.editor)
			const hasValidDocument = this.editor.document && !this.editor.document.isClosed

			// If we're in a test environment (no visible editors), rely on document validity
			// Otherwise, check both conditions
			if (vscode.window.visibleTextEditors.length === 0) {
				return hasValidDocument
			}

			return isInVisibleEditors && hasValidDocument
		} catch {
			// If accessing editor properties throws, it's disposed
			return false
		}
	}
}
