import React, { useEffect, useRef } from "react"

interface Props {
	resourceUri: string // URL вашего md-todo-mcp сервера (напр. http://localhost:3000)
	agentsList: string // Контекст из .roomodes
	onResolve: (data: Record<string, unknown>) => void
}

export const McpIframeRenderer: React.FC<Props> = ({ resourceUri, agentsList, onResolve }) => {
	const iframeRef = useRef<HTMLIFrameElement>(null)

	useEffect(() => {
		// Слушаем ответ от Iframe
		const handleMessage = (e: MessageEvent) => {
			if (e.data?.type === "mcp-action" && e.data?.action === "accept") {
				onResolve(e.data.content) // Отправляем результат обратно в Extension Host
			}
		}
		window.addEventListener("message", handleMessage)

		// Отправляем список агентов внутрь Iframe
		if (iframeRef.current) {
			iframeRef.current.onload = () => {
				iframeRef.current?.contentWindow?.postMessage(
					{ type: "mcp-context", data: { agents: agentsList } },
					"*",
				)
			}
		}

		return () => window.removeEventListener("message", handleMessage)
	}, [agentsList, onResolve]) // Added missing dependencies

	return (
		<iframe
			ref={iframeRef}
			src={resourceUri}
			sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-clipboard-write allow-clipboard-read"
			className="w-full h-[600px] border-none rounded-lg shadow-md bg-white dark:bg-gray-800"
		/>
	)
}
