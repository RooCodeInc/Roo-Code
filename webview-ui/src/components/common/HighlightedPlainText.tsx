import { ClineMessage } from "@roo-code/types"

interface HighlightedPlainTextProps {
	message: ClineMessage
	query?: string
	flag?: string
}

const HighlightedPlainText = ({ message, query = "", flag = "" }: HighlightedPlainTextProps) => {
	if (!query?.trim() || !message?.text) return message.text

	const originText = message.text || ""
	const lowerQuery = query.toLowerCase()

	// First split by newline characters
	const lines = originText.split("\n")
	const result: string[] = []
	let i = 0

	while (i < lines.length) {
		const line = lines[i]

		// Check if it's the start of a code block (exact match with ``` prefix, may include language identifier)
		if (line.trim().startsWith("```")) {
			// Find the end of the code block
			let codeBlockEnd = -1
			for (let j = i + 1; j < lines.length; j++) {
				if (lines[j].trim() === "```") {
					codeBlockEnd = j
					break
				}
			}

			if (codeBlockEnd !== -1) {
				// Extract the complete code block
				const codeBlockLines = lines.slice(i, codeBlockEnd + 1)
				const codeBlockContent = codeBlockLines.join("\n")

				// Check if the code block contains the query string
				if (codeBlockContent.toLowerCase().includes(lowerQuery)) {
					result.push(
						`<mark>⬇️${flag ? `${flag}: ` : ""}${query.length > 20 ? `${query.substring(0, 19)}...` : query}⬇️</mark>`,
					)
				}
				result.push(codeBlockContent)

				i = codeBlockEnd + 1
				continue
			}
		}

		// Process regular text lines
		if (line.toLowerCase().includes(lowerQuery)) {
			result.push(
				`${line} <mark>⬅️${flag ? `${flag}: ` : ""}${query.length > 20 ? `${query.substring(0, 19)}...` : query}⬅️</mark>`,
			)
		} else {
			result.push(line)
		}

		i++
	}

	return result.join("\n")
}

export default HighlightedPlainText
