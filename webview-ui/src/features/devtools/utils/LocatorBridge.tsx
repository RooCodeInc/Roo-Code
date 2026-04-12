import { useEffect } from "react"
import { vscode } from "../../../utils/vscode"

/**
 * LocatorBridge allows Alt+Click navigation from the Webview UI to the source code.
 *
 * It captures clicks in the capture phase, checks for the Alt key, and looks for
 * [data-locatorjs-id] attributes injected by @locator/babel-jsx during development.
 * If found, it sends a LOCATOR_OPEN_FILE message to the extension host.
 */
export function LocatorBridge() {
	useEffect(() => {
		console.log("[LocatorBridge] Component mounted and listening for Alt+Click")
		const handleAltClick = (e: MouseEvent) => {
			// Only trigger if Alt key is pressed during click
			if (!e.altKey) {
				return
			}

			console.log("[LocatorBridge] Alt+Click detected", e.target)

			// Log all attributes of the clicked element for debugging
			if (e.target instanceof HTMLElement) {
				const attrs = Array.from(e.target.attributes).map((a) => `${a.name}=${a.value}`)
				console.log("[LocatorBridge] Clicked element attributes:", attrs)
			}

			// Find the closest element with LocatorJS metadata
			const target = e.target as HTMLElement
			const locatorNode = target.closest("[data-locatorjs-id], [data-locatorjs]")

			if (locatorNode) {
				console.log("[LocatorBridge] Found locator node", locatorNode)
				// Block standard selection/action to prioritize navigation
				e.preventDefault()
				e.stopPropagation()

				const locatorId =
					locatorNode.getAttribute("data-locatorjs") || locatorNode.getAttribute("data-locatorjs-id")
				if (locatorId) {
					console.log("[LocatorBridge] Raw locatorId:", locatorId)

					// LocatorJS uses : or :: as separator depending on mode
					// In 'path' mode (preferred), it usually looks like path:line:col
					// In 'id' mode, it looks like path::index
					const isPathMode = locatorNode.hasAttribute("data-locatorjs")

					let filePath = ""
					let line = 1
					let column = 1

					if (isPathMode) {
						// Format: path:line:col
						// Since path can contain colons (less likely on Mac, but possible in some envs),
						// we split and try to identify line/col from the end.
						const parts = locatorId.split(":")
						if (parts.length >= 3) {
							column = parseInt(parts.pop() || "1", 10)
							line = parseInt(parts.pop() || "1", 10)
							filePath = parts.join(":")
						} else if (parts.length === 2) {
							line = parseInt(parts.pop() || "1", 10)
							filePath = parts[0]
						}
					} else {
						// Format: path::id (Legacy/ID mode)
						const parts = locatorId.split("::")
						filePath = parts[0]
						line = parseInt(parts[1], 10)
						column = parts[2] ? parseInt(parts[2], 10) : 1
					}

					console.log(
						`[LocatorBridge] Parsed (${isPathMode ? "path" : "id"} mode): ${filePath} at ${line}:${column}`,
					)

					vscode.postMessage({
						type: "LOCATOR_OPEN_FILE",
						locatorPayload: {
							filePath,
							line: isNaN(line) ? 1 : line,
							column: isNaN(column) ? 1 : column,
						},
					})
				}
			}
		}

		// Use capture phase (true) to ensure we intercept the event before other React handlers
		document.addEventListener("click", handleAltClick, true)

		return () => {
			document.removeEventListener("click", handleAltClick, true)
		}
	}, [])

	return null
}
