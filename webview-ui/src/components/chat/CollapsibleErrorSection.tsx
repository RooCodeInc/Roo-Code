import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import CodeBlock from "../common/CodeBlock"
import { useCopyToClipboard } from "@src/utils/clipboard"

interface CollapsibleErrorSectionProps {
	title: string
	content: string | null | undefined
	language?: string
	isExpanded: boolean
	onToggleExpand: () => void
}

export const CollapsibleErrorSection: React.FC<CollapsibleErrorSectionProps> = ({
	title,
	content,
	language = "xml",
	isExpanded,
	onToggleExpand,
}) => {
	const [showCopySuccess, setShowCopySuccess] = React.useState(false)
	const { copyWithFeedback } = useCopyToClipboard()

	const handleCopy = async (e: React.MouseEvent) => {
		e.stopPropagation()
		const success = await copyWithFeedback(content || "")
		if (success) {
			setShowCopySuccess(true)
			setTimeout(() => setShowCopySuccess(false), 1000)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault()
			onToggleExpand()
		}
	}

	return (
		<div className="mt-0 overflow-hidden mb-2">
			<div
				className={`${
					isExpanded ? "border-b border-vscode-editorGroup-border" : ""
				} font-normal text-base text-vscode-editor-foreground flex items-center justify-between cursor-pointer focus:outline focus:outline-2 focus:outline-vscode-focusBorder`}
				role="button"
				tabIndex={0}
				aria-expanded={isExpanded}
				aria-label={title}
				onClick={onToggleExpand}
				onKeyDown={handleKeyDown}>
				<div className="flex items-center gap-2.5 flex-grow">
					<span className="codicon codicon-warning text-vscode-editorWarning-foreground opacity-80 text-base -mb-0.5"></span>
					<span className="font-bold">{title}</span>
				</div>
				<div className="flex items-center">
					<VSCodeButton
						appearance="icon"
						className="p-[3px] h-6 mr-1 text-vscode-editor-foreground flex items-center justify-center bg-transparent"
						onClick={handleCopy}>
						<span className={`codicon codicon-${showCopySuccess ? "check" : "copy"}`}></span>
					</VSCodeButton>
					<span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}></span>
				</div>
			</div>
			{isExpanded && (
				<div className="p-2 bg-vscode-editor-background">
					<CodeBlock source={content || ""} language={language} />
				</div>
			)}
		</div>
	)
}
