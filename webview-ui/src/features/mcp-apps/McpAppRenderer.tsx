import React, { useCallback } from "react"
import { ClineAskUseMcpServer, McpServer } from "@jabberwock/types"
import { vscode } from "../../utils/vscode"
import { TodoWidget } from "./widgets/TodoWidget"

interface McpAppRendererProps {
	useMcpServer: ClineAskUseMcpServer
	server: McpServer
	messageTs: number
}

export const McpAppRenderer: React.FC<McpAppRendererProps> = ({ useMcpServer, server }) => {
	// Parse server config to find uiType
	let uiType = "unknown"
	let allowedContext: string[] = []
	try {
		const config = JSON.parse(server.config)
		uiType = config.uiType || "unknown"
		allowedContext = config.allowedContext || []
	} catch {
		// ignore
	}

	const handleAccept = useCallback((content: Record<string, unknown>) => {
		vscode.postMessage({
			type: "askResponse",
			askResponse: "messageResponse",
			text: JSON.stringify(content),
		})
	}, [])

	const renderWidget = () => {
		switch (uiType) {
			case "todo-widget":
				return (
					<TodoWidget useMcpServer={useMcpServer} allowedContext={allowedContext} onAccept={handleAccept} />
				)
			default:
				return <div className="p-4 text-vscode-errorForeground">Unknown interactive app type: {uiType}</div>
		}
	}

	return (
		<div className="mcp-app-renderer w-full bg-vscode-editor-background border border-vscode-border rounded-xs p-2 mt-2">
			<div className="font-bold mb-2 pb-2 border-b border-vscode-border">Interactive App: {server.name}</div>
			{renderWidget()}
		</div>
	)
}
