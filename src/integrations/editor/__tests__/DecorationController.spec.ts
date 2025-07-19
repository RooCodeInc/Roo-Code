import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { DecorationController } from "../DecorationController"

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
	},
	Range: vi.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
		start: { line: startLine, character: startChar },
		end: { line: endLine, character: endChar },
		with: vi.fn().mockReturnThis(),
	})),
	Position: vi.fn().mockImplementation((line, char) => ({
		line,
		character: char,
		translate: vi.fn().mockImplementation((lines) => ({
			line: line + lines,
			character: char,
		})),
	})),
}))

describe("DecorationController", () => {
	let mockEditor: any
	let mockDecorationType: any
	let controller: DecorationController

	beforeEach(() => {
		vi.clearAllMocks()

		// Create mock decoration type
		mockDecorationType = {
			dispose: vi.fn(),
		}
		vi.mocked(vscode.window.createTextEditorDecorationType).mockReturnValue(mockDecorationType)

		// Create mock editor
		mockEditor = {
			document: {
				lineCount: 100,
				getText: vi.fn().mockReturnValue("mock content"),
			},
			setDecorations: vi.fn(),
		}

		// Create controller
		controller = new DecorationController("fadedOverlay", mockEditor)
	})

	describe("addLines", () => {
		it("should add decorations when editor is valid", () => {
			controller.addLines(0, 10)

			expect(mockEditor.setDecorations).toHaveBeenCalledWith(
				expect.any(Object),
				expect.arrayContaining([expect.any(Object)]),
			)
		})

		it("should not throw when editor is disposed", () => {
			// Simulate disposed editor
			mockEditor.document = undefined
			Object.defineProperty(mockEditor, "document", {
				get: () => {
					throw new Error("Editor is disposed")
				},
			})

			// Should not throw
			expect(() => controller.addLines(0, 10)).not.toThrow()
			expect(mockEditor.setDecorations).not.toHaveBeenCalled()
		})

		it("should not add decorations after dispose is called", () => {
			controller.dispose()
			controller.addLines(0, 10)

			expect(mockEditor.setDecorations).not.toHaveBeenCalled()
		})

		it("should handle setDecorations throwing an error", () => {
			mockEditor.setDecorations.mockImplementation(() => {
				throw new Error("Editor disposed during operation")
			})

			// Should not throw
			expect(() => controller.addLines(0, 10)).not.toThrow()
		})
	})

	describe("clear", () => {
		it("should clear decorations when editor is valid", () => {
			controller.clear()

			expect(mockEditor.setDecorations).toHaveBeenCalledWith(expect.any(Object), [])
		})

		it("should not throw when editor is disposed", () => {
			// Simulate disposed editor
			mockEditor.document = undefined
			Object.defineProperty(mockEditor, "document", {
				get: () => {
					throw new Error("Editor is disposed")
				},
			})

			// Should not throw
			expect(() => controller.clear()).not.toThrow()
		})

		it("should not clear decorations after dispose is called", () => {
			controller.dispose()
			controller.clear()

			expect(mockEditor.setDecorations).not.toHaveBeenCalled()
		})
	})

	describe("updateOverlayAfterLine", () => {
		it("should update overlay when editor is valid", () => {
			controller.updateOverlayAfterLine(50, 100)

			expect(mockEditor.setDecorations).toHaveBeenCalledWith(
				expect.any(Object),
				expect.arrayContaining([expect.any(Object)]),
			)
		})

		it("should not throw when editor is disposed", () => {
			// Simulate disposed editor
			mockEditor.document = undefined
			Object.defineProperty(mockEditor, "document", {
				get: () => {
					throw new Error("Editor is disposed")
				},
			})

			// Should not throw
			expect(() => controller.updateOverlayAfterLine(50, 100)).not.toThrow()
		})

		it("should not update overlay after dispose is called", () => {
			controller.dispose()
			controller.updateOverlayAfterLine(50, 100)

			expect(mockEditor.setDecorations).not.toHaveBeenCalled()
		})
	})

	describe("setActiveLine", () => {
		it("should set active line when editor is valid", () => {
			controller.setActiveLine(25)

			expect(mockEditor.setDecorations).toHaveBeenCalledWith(
				expect.any(Object),
				expect.arrayContaining([expect.any(Object)]),
			)
		})

		it("should not throw when editor is disposed", () => {
			// Simulate disposed editor
			mockEditor.document = undefined
			Object.defineProperty(mockEditor, "document", {
				get: () => {
					throw new Error("Editor is disposed")
				},
			})

			// Should not throw
			expect(() => controller.setActiveLine(25)).not.toThrow()
		})

		it("should not set active line after dispose is called", () => {
			controller.dispose()
			controller.setActiveLine(25)

			expect(mockEditor.setDecorations).not.toHaveBeenCalled()
		})
	})

	describe("dispose", () => {
		it("should mark controller as disposed and clear decorations", () => {
			controller.dispose()

			// Try to use controller after dispose - should not throw
			expect(() => controller.addLines(0, 10)).not.toThrow()
			expect(() => controller.clear()).not.toThrow()
			expect(() => controller.updateOverlayAfterLine(50, 100)).not.toThrow()
			expect(() => controller.setActiveLine(25)).not.toThrow()

			// No operations should have been performed
			expect(mockEditor.setDecorations).not.toHaveBeenCalled()
		})

		it("should handle clear during dispose even if editor is disposed", () => {
			// Simulate disposed editor
			mockEditor.document = undefined
			Object.defineProperty(mockEditor, "document", {
				get: () => {
					throw new Error("Editor is disposed")
				},
			})

			// Should not throw
			expect(() => controller.dispose()).not.toThrow()
		})
	})

	describe("isEditorValid", () => {
		it("should detect valid editor", () => {
			// Access private method through any type
			const isValid = (controller as any).isEditorValid()
			expect(isValid).toBe(true)
		})

		it("should detect disposed editor", () => {
			// Simulate disposed editor
			mockEditor.document = undefined
			Object.defineProperty(mockEditor, "document", {
				get: () => {
					throw new Error("Editor is disposed")
				},
			})

			// Access private method through any type
			const isValid = (controller as any).isEditorValid()
			expect(isValid).toBe(false)
		})
	})
})
