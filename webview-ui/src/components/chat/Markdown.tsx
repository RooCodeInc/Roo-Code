import { memo, useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import { useCopyToClipboard } from "@src/utils/clipboard"
import { StandardTooltip } from "@src/components/ui"

import MarkdownBlock from "../common/MarkdownBlock"

export const Markdown = memo(({ markdown, partial }: { markdown?: string; partial?: boolean }) => {
	const [isHovering, setIsHovering] = useState(false)

	// Shorter feedback duration for copy button flash.
	const { copyWithFeedback } = useCopyToClipboard(200)

	if (!markdown || markdown.length === 0) {
		return null
	}

	return (
		<div
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => setIsHovering(false)}
			style={{ position: "relative" }}>
			<div
				style={{
					wordBreak: "break-word",
					overflowWrap: "anywhere",
					padding: "8px 12px",
					borderRadius: "12px",
					background: "rgba(255,255,255,0.04)",
					backdropFilter: "blur(8px)",
					WebkitBackdropFilter: "blur(8px)",
					border: "1px solid rgba(255,255,255,0.06)",
					boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
					transition: "all 0.2s ease-in-out",
				}}>
				<MarkdownBlock markdown={markdown} />
			</div>
			{markdown && !partial && isHovering && (
				<div
					style={{
						position: "absolute",
						bottom: "4px",
						right: "12px",
						opacity: 0,
						animation: "fadeIn 0.2s ease-in-out forwards",
						borderRadius: "8px",
						background: "rgba(30,30,30,0.7)",
						backdropFilter: "blur(4px)",
						WebkitBackdropFilter: "blur(4px)",
						padding: "2px",
					}}>
					<style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1.0; } }`}</style>
					<StandardTooltip content="Copy as markdown">
						<VSCodeButton
							className="copy-button"
							appearance="icon"
							style={{
								height: "28px",
								width: "28px",
								border: "none",
								background: "rgba(60,60,60,0.5)",
								borderRadius: "6px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								transition: "all 0.2s ease-in-out",
								backdropFilter: "blur(4px)",
								WebkitBackdropFilter: "blur(4px)",
							}}
							onClick={async () => {
								const success = await copyWithFeedback(markdown)
								if (success) {
									const button = document.activeElement as HTMLElement
									if (button) {
										button.style.background = "var(--vscode-charts-green)"
										button.style.transform = "scale(1.05)"
										setTimeout(() => {
											button.style.background = "rgba(60,60,60,0.5)"
											button.style.transform = "scale(1)"
										}, 200)
									}
								}
							}}>
							<span className="codicon codicon-copy" />
						</VSCodeButton>
					</StandardTooltip>
				</div>
			)}
		</div>
	)
})
