import React, { useState } from "react"
import { FaCopy, FaCheck } from "react-icons/fa6"
import { useDoc } from "@docusaurus/plugin-content-docs/client"
import styles from "./styles.module.css"

export default function CopyPageContent(): JSX.Element {
	const [copied, setCopied] = useState(false)
	const { metadata, frontMatter } = useDoc()

	const convertHtmlToMarkdown = (element: Element): string => {
		let result = ""

		for (const node of Array.from(element.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				result += node.textContent || ""
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const elem = node as Element
				const tagName = elem.tagName.toLowerCase()

				switch (tagName) {
					case "h1":
						result += `# ${elem.textContent}\n\n`
						break
					case "h2":
						result += `## ${elem.textContent}\n\n`
						break
					case "h3":
						result += `### ${elem.textContent}\n\n`
						break
					case "h4":
						result += `#### ${elem.textContent}\n\n`
						break
					case "h5":
						result += `##### ${elem.textContent}\n\n`
						break
					case "h6":
						result += `###### ${elem.textContent}\n\n`
						break
					case "p":
						result += `${elem.textContent}\n\n`
						break
					case "code":
						if (elem.parentElement?.tagName.toLowerCase() === "pre") {
							result += `\`\`\`\n${elem.textContent}\n\`\`\`\n\n`
						} else {
							result += `\`${elem.textContent}\``
						}
						break
					case "pre":
						// Skip processing children since we handle code blocks above
						break
					case "strong":
					case "b":
						result += `**${elem.textContent}**`
						break
					case "em":
					case "i":
						result += `*${elem.textContent}*`
						break
					case "ul":
					case "ol":
						result += convertListToMarkdown(elem, tagName === "ol")
						break
					case "li":
						// Lists are handled by their parent ul/ol
						break
					case "a": {
						const href = elem.getAttribute("href")
						if (href) {
							result += `[${elem.textContent}](${href})`
						} else {
							result += elem.textContent
						}
						break
					}
					case "blockquote": {
						const lines = (elem.textContent || "").split("\n")
						result += lines.map((line) => `> ${line}`).join("\n") + "\n\n"
						break
					}
					default:
						result += convertHtmlToMarkdown(elem)
						break
				}
			}
		}

		return result
	}

	const convertListToMarkdown = (listElement: Element, isOrdered: boolean): string => {
		let result = ""
		const items = listElement.querySelectorAll(":scope > li")

		items.forEach((item, index) => {
			const marker = isOrdered ? `${index + 1}. ` : "- "
			result += `${marker}${item.textContent}\n`
		})

		return result + "\n"
	}

	const copyToClipboard = async () => {
		try {
			// Get the page content from the DOM
			const markdownElement = document.querySelector(".markdown")
			if (!markdownElement) {
				throw new Error("Could not find page content")
			}

			// Convert HTML back to markdown-like format
			let content = ""

			// Add front matter if it exists
			if (Object.keys(frontMatter).length > 0) {
				content += "---\n"
				Object.entries(frontMatter).forEach(([key, value]) => {
					content += `${key}: ${value}\n`
				})
				content += "---\n\n"
			}

			// Add title if not already in content
			if (metadata.title && !markdownElement.querySelector("h1")) {
				content += `# ${metadata.title}\n\n`
			}

			// Convert the HTML content to markdown
			content += convertHtmlToMarkdown(markdownElement)

			await navigator.clipboard.writeText(content.trim())
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (err) {
			console.error("Failed to copy page content: ", err)
		}
	}

	return (
		<button
			className={styles.copyButton}
			onClick={copyToClipboard}
			title={copied ? "Copied!" : "Copy page content"}
			aria-label={copied ? "Page content copied to clipboard" : "Copy page content to clipboard"}>
			{copied ? (
				<>
					<FaCheck className={styles.icon} />
					<span>Copied!</span>
				</>
			) : (
				<>
					<FaCopy className={styles.icon} />
					<span>Copy Page</span>
				</>
			)}
		</button>
	)
}
