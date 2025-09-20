import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $selectAll } from "lexical"
import { useEffect } from "react"

export function LexicalSelectAllPlugin(): null {
	const [editor] = useLexicalComposerContext()

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Check for Cmd+A (Mac) or Ctrl+A (Windows/Linux)
			if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
				// Check if the editor is focused
				const editorElement = editor.getRootElement()
				if (editorElement && editorElement.contains(document.activeElement)) {
					event.preventDefault()
					event.stopPropagation()

					// Select all content in the editor
					editor.update(() => {
						$selectAll()
					})
				}
			}
		}

		// Add event listener with capture to intercept before other handlers
		document.addEventListener("keydown", handleKeyDown, { capture: true })

		return () => {
			document.removeEventListener("keydown", handleKeyDown, { capture: true })
		}
	}, [editor])

	return null
}
