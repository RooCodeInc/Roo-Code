import { useState, useCallback, DragEvent } from "react"
import { convertToMentionPath } from "../../utils/path-mentions"

interface UseChatDragAndDropProps {
	inputValue: string
	setInputValue: (value: string) => void
	cwd?: string
}

export const useChatDragAndDrop = ({ inputValue, setInputValue, cwd }: UseChatDragAndDropProps) => {
	const [isDragging, setIsDragging] = useState(false)

	const handleDragEnter = useCallback((e: DragEvent) => {
		if (e.dataTransfer?.types.includes("text/uri-list")) {
			e.preventDefault()
			setIsDragging(true)
		}
	}, [])

	const handleDragOver = useCallback((e: DragEvent) => {
		if (e.dataTransfer?.types.includes("text/uri-list")) {
			e.preventDefault()
		}
	}, [])

	const handleDragLeave = useCallback((e: DragEvent) => {
		e.preventDefault()
		setIsDragging(false)
	}, [])

	const handleDrop = useCallback(
		(e: DragEvent) => {
			setIsDragging(false)
			if (!e.dataTransfer) return

			const uriList = e.dataTransfer.getData("text/uri-list")
			if (!uriList) return

			e.preventDefault()

			// Parse URIs
			const uris = uriList.split("\r\n").filter(Boolean)
			if (uris.length === 0) return

			// Convert file:// URIs to local paths
			const paths = uris.map((uri) => {
				try {
					const url = new URL(uri)
					if (url.protocol === "file:") {
						return decodeURIComponent(url.pathname)
					}
				} catch {
					// fallback if not a valid URL
				}
				return uri
			})

			// Convert to @ mentions format
			let newText = inputValue
			paths.forEach((p) => {
				// Create the mention string
				let mention = convertToMentionPath(p, cwd || "")
				if (!mention.startsWith("@")) {
					mention = `@${mention}`
				}
				// Add to input if not already present
				if (!newText.includes(mention)) {
					newText = newText ? `${newText} ${mention} ` : `${mention} `
				}
			})

			if (newText !== inputValue) {
				setInputValue(newText)
			}
		},
		[inputValue, setInputValue, cwd],
	)

	return {
		isDragging,
		dragHandlers: {
			onDragEnter: handleDragEnter,
			onDragOver: handleDragOver,
			onDragLeave: handleDragLeave,
			onDrop: handleDrop,
		},
	}
}
