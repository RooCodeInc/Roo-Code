import React, { Fragment } from "react"

import { normalizeSearchQuery } from "./chatSearchText"

const createSearchMatchElement = (text: string) => ({
	type: "element",
	tagName: "span",
	properties: {
		className: ["chat-search-match"],
		"data-chat-search-match": "true",
	},
	children: [{ type: "text", value: text }],
})

const splitTextByQuery = (text: string, query: string) => {
	const normalizedQuery = normalizeSearchQuery(query)

	if (!normalizedQuery) {
		return [{ text, match: false }]
	}

	const normalizedText = text.toLocaleLowerCase()
	const parts: Array<{ text: string; match: boolean }> = []
	let cursor = 0

	while (cursor < text.length) {
		const index = normalizedText.indexOf(normalizedQuery, cursor)

		if (index === -1) {
			parts.push({ text: text.slice(cursor), match: false })
			break
		}

		if (index > cursor) {
			parts.push({ text: text.slice(cursor, index), match: false })
		}

		parts.push({ text: text.slice(index, index + normalizedQuery.length), match: true })
		cursor = index + normalizedQuery.length
	}

	return parts.filter((part) => part.text.length > 0)
}

export const HighlightedText = ({ text, query }: { text: string; query?: string }) => {
	if (!query) {
		return <>{text}</>
	}

	const parts = splitTextByQuery(text, query)

	return (
		<>
			{parts.map((part, index) =>
				part.match ? (
					<span key={index} className="chat-search-match" data-chat-search-match="true">
						{part.text}
					</span>
				) : (
					<Fragment key={index}>{part.text}</Fragment>
				),
			)}
		</>
	)
}

export const applySearchHighlightsToHast = (
	root: any,
	query: string | undefined,
	options: { skipPre?: boolean } = {},
) => {
	const normalizedQuery = normalizeSearchQuery(query ?? "")

	if (!normalizedQuery) {
		return root
	}

	const shouldSkipElement = (node: any) => {
		if (node?.type !== "element") {
			return false
		}

		const tagName = String(node.tagName ?? "").toLowerCase()

		return (
			tagName === "script" ||
			tagName === "style" ||
			tagName === "svg" ||
			(options.skipPre && (tagName === "pre" || tagName === "code"))
		)
	}

	const visitNode = (node: any, parent?: any) => {
		if (!node || shouldSkipElement(node)) {
			return
		}

		if (node.type === "text" && typeof node.value === "string" && parent?.children) {
			const parts = splitTextByQuery(node.value, normalizedQuery)

			if (parts.some((part) => part.match)) {
				const replacement = parts.map((part) =>
					part.match ? createSearchMatchElement(part.text) : { type: "text", value: part.text },
				)
				const index = parent.children.indexOf(node)

				if (index !== -1) {
					parent.children.splice(index, 1, ...replacement)
				}
			}

			return
		}

		if (Array.isArray(node.children)) {
			for (const child of [...node.children]) {
				visitNode(child, node)
			}
		}
	}

	visitNode(root)

	return root
}
