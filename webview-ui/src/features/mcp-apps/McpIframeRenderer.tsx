import React, { useEffect, useRef, useState } from "react"

interface Props {
	resourceUri: string
	agentsList: string
	inputData?: string
	onResolve: (data: Record<string, unknown>) => void
	onCancel?: () => void
}

export const McpIframeRenderer: React.FC<Props> = ({ resourceUri, agentsList, inputData, onResolve, onCancel }) => {
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const [isLoaded, setIsLoaded] = useState(false)

	useEffect(() => {
		const handleMessage = (e: MessageEvent) => {
			if (e.data?.type === "mcp-context-request") {
				// The iframe is ready and requesting its context
				setIsLoaded(true)
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "mcp-context",
						data: {
							agents: agentsList,
							input: inputData,
						},
					},
					"*",
				)
			} else if (e.data?.type === "mcp-action") {
				if (e.data?.action === "accept") {
					onResolve(e.data.content)
				} else if (e.data?.action === "cancel") {
					if (onCancel) {
						onCancel()
					}
				}
			}
		}
		window.addEventListener("message", handleMessage)

		if (iframeRef.current) {
			// Fallback: still send on load in case the app doesn't send a request
			iframeRef.current.onload = () => {
				setIsLoaded(true)
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "mcp-context",
						data: {
							agents: agentsList,
							input: inputData,
						},
					},
					"*",
				)
			}
		}

		return () => window.removeEventListener("message", handleMessage)
	}, [agentsList, inputData, onResolve, onCancel])

	return (
		<div style={{ position: "relative", width: "100%", minHeight: "400px" }}>
			{!isLoaded && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "var(--vscode-descriptionForeground)",
						fontSize: "13px",
					}}>
					Loading interactive app...
				</div>
			)}
			<iframe
				ref={iframeRef}
				src={resourceUri}
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
				style={{
					width: "100%",
					height: "500px",
					border: "none",
					borderRadius: "8px",
					backgroundColor: "var(--vscode-editor-background)",
				}}
			/>
		</div>
	)
}
