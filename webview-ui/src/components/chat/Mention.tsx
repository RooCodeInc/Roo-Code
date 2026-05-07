import { mentionRegexGlobal } from "@roo/context-mentions"

import { vscode } from "../../utils/vscode"
import { HighlightedText } from "../../utils/searchHighlight"

interface MentionProps {
	text?: string
	withShadow?: boolean
	searchQuery?: string
}

export const Mention = ({ text, withShadow = false, searchQuery }: MentionProps) => {
	if (!text) {
		return <>{text}</>
	}

	const parts = text.split(mentionRegexGlobal).map((part, index) => {
		if (index % 2 === 0) {
			// This is regular text.
			return <HighlightedText key={index} text={part} query={searchQuery} />
		} else {
			// This is a mention.
			return (
				<span
					key={index}
					className={`${withShadow ? "mention-context-highlight-with-shadow" : "mention-context-highlight"} text-[0.9em] cursor-pointer`}
					onClick={() => vscode.postMessage({ type: "openMention", text: part })}>
					<HighlightedText text={`@${part}`} query={searchQuery} />
				</span>
			)
		}
	})

	return <>{parts}</>
}
