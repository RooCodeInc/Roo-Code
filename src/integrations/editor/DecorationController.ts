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
		// Guard against invalid inputs or disposed state
		if (startIndex < 0 || numLines <= 0 || this.isDisposed) {
			return
		}

		// Check if editor is still valid before using it
		if (!this.isEditorValid()) {
			return
		}

		const lastRange = this.ranges[this.ranges.length - 1]
		if (lastRange && lastRange.end.line === startIndex - 1) {
			this.ranges[this.ranges.length - 1] = lastRange.with(undefined, lastRange.end.translate(numLines))
		} else {
			const endLine = startIndex + numLines - 1
			this.ranges.push(new vscode.Range(startIndex, 0, endLine, Number.MAX_SAFE_INTEGER))
		}

		try {
			this.editor.setDecorations(this.getDecoration(), this.ranges)
		} catch (error) {
			// Editor was disposed between check and use
			console.debug("DecorationController: Failed to set decorations, editor may be disposed", error)
		}
	}

	clear() {
		if (this.isDisposed) {
			return
		}

		this.ranges = []

		if (!this.isEditorValid()) {
			return
		}

		try {
			this.editor.setDecorations(this.getDecoration(), this.ranges)
		} catch (error) {
			// Editor was disposed between check and use
			console.debug("DecorationController: Failed to clear decorations, editor may be disposed", error)
		}
	}

	updateOverlayAfterLine(line: number, totalLines: number) {
		if (this.isDisposed) {
			return
		}

		// Check if editor is still valid before using it
		if (!this.isEditorValid()) {
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
		try {
			this.editor.setDecorations(this.getDecoration(), this.ranges)
		} catch (error) {
			// Editor was disposed between check and use
			console.debug("DecorationController: Failed to update overlay, editor may be disposed", error)
		}
	}

	setActiveLine(line: number) {
		if (this.isDisposed) {
			return
		}

		// Check if editor is still valid before using it
		if (!this.isEditorValid()) {
			return
		}

		this.ranges = [new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER)]

		try {
			this.editor.setDecorations(this.getDecoration(), this.ranges)
		} catch (error) {
			// Editor was disposed between check and use
			console.debug("DecorationController: Failed to set active line, editor may be disposed", error)
		}
	}

	/**
	 * Checks if the editor is still valid and not disposed
	 */
	private isEditorValid(): boolean {
		try {
			// Try to access a property that would throw if disposed
			// The document property is a good indicator
			const _ = this.editor.document
			return true
		} catch {
			// Editor is disposed
			this.isDisposed = true
			return false
		}
	}

	/**
	 * Marks this controller as disposed
	 */
	dispose() {
		this.isDisposed = true
		this.clear()
	}
}
