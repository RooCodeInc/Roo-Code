import { mentionRegexGlobal } from "@roo/context-mentions"

import { vscode } from "../../utils/vscode"

interface MentionProps {
	text?: string
	withShadow?: boolean
}

export const Mention = ({ text, withShadow = false }: MentionProps) => {
	if (!text) {
		return <>{text}</>
	}
	// Highlight file path with line numbers format: filePath:startLine-endLine
	const parts = text.split(mentionRegexGlobal).map((part, index) => {
		if (index % 2 === 0) {
			// This is regular text.
			const textSegments = part.split(/\b([\w/\\.-]+:\d+-\d+)\b/)
			return textSegments.map((segment, segmentIndex) => {
				if (segmentIndex % 2 === 1) {
					// This is a file path match
					return (
						<mark
							key={`${index}-${segmentIndex}`}
							className={`mention-context-highlight-with-shadow cursor-pointer`}
							style={{
								pointerEvents: "auto",
								color: "var(--vscode-textPreformat-foreground) !important",
							}}>
							{segment}
						</mark>
					)
				}
				return segment
			})
		} else {
			// This is a mention.
			return (
				<span
					key={index}
					className={`${withShadow ? "mention-context-highlight-with-shadow" : "mention-context-highlight"} text-[0.9em] cursor-pointer`}
					onClick={() => vscode.postMessage({ type: "openMention", text: part })}>
					@{part}
				</span>
			)
		}
	})

	return <>{parts}</>
}
