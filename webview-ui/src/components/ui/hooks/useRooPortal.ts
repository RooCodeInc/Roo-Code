import { useState, useEffect } from "react"

export const useRooPortal = (id: string) => {
	const [container, setContainer] = useState<HTMLElement | null>(null)

	useEffect(() => {
		// Try to find the element immediately
		const element = document.getElementById(id)
		if (element) {
			setContainer(element)
			return
		}

		// If not found, set up a MutationObserver to watch for it
		const observer = new MutationObserver(() => {
			const element = document.getElementById(id)
			if (element) {
				setContainer(element)
				observer.disconnect()
			}
		})

		// Start observing the document body for changes
		observer.observe(document.body, {
			childList: true,
			subtree: true,
		})

		// Cleanup
		return () => {
			observer.disconnect()
		}
	}, [id])

	return container
}
