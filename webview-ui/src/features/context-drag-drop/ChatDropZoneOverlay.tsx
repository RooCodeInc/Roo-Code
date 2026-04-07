import React from "react"

interface ChatDropZoneOverlayProps {
	isDragging: boolean
}

export const ChatDropZoneOverlay: React.FC<ChatDropZoneOverlayProps> = ({ isDragging }) => {
	if (!isDragging) return null

	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-vscode-editor-background/80 backdrop-blur-sm border-2 border-dashed border-vscode-focusBorder rounded-lg pointer-events-none">
			<div className="flex flex-col items-center gap-4 p-8 bg-vscode-editor-background rounded-lg shadow-xl border border-vscode-focusBorder">
				<div className="codicon codicon-add text-6xl text-vscode-focusBorder" />
				<h2 className="text-xl font-bold text-vscode-foreground">Drop files here to add to context</h2>
				<p className="text-vscode-descriptionForeground text-center">
					Files will be automatically added as @mentions in the chat.
				</p>
			</div>
		</div>
	)
}
