import { useState, useCallback } from "react"

export const useChatDragAndDrop = ({
	inputValue,
	setInputValue,
	cwd,
}: {
	inputValue: string
	setInputValue: (value: string) => void
	cwd: string
}) => {
	const [isDragging, setIsDragging] = useState(false)

	const handleFilesDropped = useCallback(
		(paths: string[]) => {
			// Add file paths to input value
			const fileReferences = paths
				.map((path) => (path.startsWith(cwd) ? path.substring(cwd.length + 1) : path))
				.join(" ")

			setInputValue(inputValue ? `${inputValue} ${fileReferences}` : fileReferences)
		},
		[inputValue, setInputValue, cwd],
	)

	// Drag handlers for React components
	const dragHandlers = {
		onDragEnter: (e: React.DragEvent) => {
			e.preventDefault()
			setIsDragging(true)
		},
		onDragOver: (e: React.DragEvent) => {
			e.preventDefault()
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = "copy"
			}
		},
		onDragLeave: (e: React.DragEvent) => {
			e.preventDefault()
			setIsDragging(false)
		},
		onDrop: (e: React.DragEvent) => {
			e.preventDefault()
			setIsDragging(false)

			const uriList = e.dataTransfer?.getData("text/uri-list")
			if (uriList) {
				const paths = uriList.split("\r\n").filter(Boolean)
				handleFilesDropped(paths)
			}
		},
	}

	return { isDragging, dragHandlers }
}
