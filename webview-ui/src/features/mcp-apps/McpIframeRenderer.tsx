import React, { useEffect, useRef } from "react"

interface Props {
	resourceUri: string // URL from md-todo-mcp server
	allowedContextData: any // Context data based on allowedContext configuration
	onAccept: (data: any) => void
	onCancel: () => void
}

export const McpIframeRenderer: React.FC<Props> = ({ resourceUri, allowedContextData, onAccept, onCancel }) => {
	const iframeRef = useRef<HTMLIFrameElement>(null)

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			// Communication with iframe using MCP UI standard
			if (event.data?.type === "mcp-action") {
				if (event.data.action === "accept") {
					onAccept(event.data.content)
				} else if (event.data.action === "cancel") {
					onCancel()
				}
			}
		}

		window.addEventListener("message", handleMessage)

		// Send allowed context data to iframe after loading
		const sendContextData = () => {
			if (iframeRef.current?.contentWindow) {
				iframeRef.current.contentWindow.postMessage(
					{
						type: "mcp-context",
						data: allowedContextData,
					},
					"*",
				)
			}
		}

		// Add load event listener to iframe
		const iframe = iframeRef.current
		if (iframe) {
			iframe.addEventListener("load", sendContextData)
		}

		return () => {
			window.removeEventListener("message", handleMessage)
			if (iframe) {
				iframe.removeEventListener("load", sendContextData)
			}
		}
	}, [resourceUri, allowedContextData, onAccept, onCancel])

	return (
		<div className="flex flex-col w-full h-[500px] bg-vscode-editor-background border border-vscode-border rounded-xs p-2">
			<div className="font-bold mb-2 pb-2 border-b border-vscode-border">Interactive MCP App</div>
			<iframe
				ref={iframeRef}
				src={resourceUri}
				sandbox="allow-scripts allow-same-origin allow-forms"
				className="w-full h-full border-none rounded-md"
				title="Interactive MCP App"
			/>
		</div>
	)
}
