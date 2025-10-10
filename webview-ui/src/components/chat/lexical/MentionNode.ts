import type {
	DOMConversionMap,
	DOMConversionOutput,
	DOMExportOutput,
	EditorConfig,
	LexicalNode,
	NodeKey,
	SerializedTextNode,
	Spread,
} from "lexical"

import { $applyNodeReplacement, TextNode } from "lexical"
import { extractLabelFromValue } from "@/utils/path-mentions"

export type SerializedMentionNode = Spread<
	{
		value: string // Internal value (e.g., actual path)
		label: string // Display label (e.g., filename only)
		trigger: string
		data?: Record<string, any>
	},
	SerializedTextNode
>

function convertMentionElement(domNode: HTMLElement): DOMConversionOutput | null {
	const textContent = domNode.textContent
	const trigger = domNode.getAttribute("data-lexical-mention-trigger")
	const value = domNode.getAttribute("data-lexical-mention-value")
	const label = domNode.getAttribute("data-lexical-mention-label")

	if (textContent !== null && trigger !== null && value !== null) {
		return {
			node: $createMentionNode(trigger, value, label, textContent),
		}
	}

	return null
}

const MENTION_CLASSES = [
	"inline-block",
	"align-top",
	"px-1",
	"rounded-md",
	"text-sm",
	"cursor-pointer",
	"relative",
	"max-w-xs",
	"overflow-hidden",
	"text-ellipsis",
	"bg-vscode-badge-background/20",
]

export class MentionNode extends TextNode {
	__value: string // Internal value (e.g., full path)
	__label: string // Display label (e.g., filename only)
	__trigger: string
	__data?: Record<string, any>

	static getType(): string {
		return "mention"
	}

	static clone(node: MentionNode): MentionNode {
		return new MentionNode(node.__trigger, node.__value, node.__label, node.__text, node.__data, node.__key)
	}

	static importJSON(serializedNode: SerializedMentionNode): MentionNode {
		const node = $createMentionNode(
			serializedNode.trigger,
			serializedNode.value,
			serializedNode.label,
			serializedNode.text,
			serializedNode.data,
		)
		node.setFormat(serializedNode.format)
		node.setDetail(serializedNode.detail)
		node.setMode(serializedNode.mode)
		node.setStyle(serializedNode.style)
		return node
	}

	constructor(
		trigger: string,
		value: string,
		label: string,
		text?: string,
		data?: Record<string, any>,
		key?: NodeKey,
	) {
		super(text ?? "", key)

		this.__trigger = trigger
		this.__value = value
		this.__label = label
		this.__data = data

		// Set the formatted text if not explicitly provided
		if (!text) {
			this.__text = this.getFormattedDisplayText()
		}
	}

	exportJSON(): SerializedMentionNode {
		return {
			...super.exportJSON(),
			value: this.__value,
			label: this.__label,
			trigger: this.__trigger,
			data: this.__data,
			type: "mention",
			version: 1,
		}
	}

	createDOM(config: EditorConfig): HTMLElement {
		const dom = super.createDOM(config)
		const label = this.getFormattedDisplayText()

		dom.className = MENTION_CLASSES.join(" ")
		dom.textContent = label
		dom.setAttribute("data-lexical-mention-trigger", this.__trigger)
		dom.setAttribute("data-lexical-mention-value", this.__value)
		dom.setAttribute("data-lexical-mention-label", label)
		dom.setAttribute("contenteditable", "false")
		dom.setAttribute("data-lexical-text", "true")
		dom.setAttribute("title", this.__value)

		return dom
	}

	exportDOM(): DOMExportOutput {
		const element = document.createElement("mark")
		const label = this.getFormattedDisplayText()

		element.setAttribute("data-lexical-mention-trigger", this.__trigger)
		element.setAttribute("data-lexical-mention-value", this.__value)
		element.setAttribute("data-lexical-mention-label", label)
		element.setAttribute("contenteditable", "false")
		element.setAttribute("title", this.__value)
		element.textContent = label
		element.className = MENTION_CLASSES.join(" ")

		return { element }
	}

	static importDOM(): DOMConversionMap | null {
		return {
			mark: (domNode: HTMLElement) => {
				if (!domNode.hasAttribute("data-lexical-mention-trigger")) {
					return null
				}
				return {
					conversion: convertMentionElement,
					priority: 1,
				}
			},
		}
	}

	isTextEntity(): true {
		return true
	}

	canInsertTextBefore(): boolean {
		return false
	}

	canInsertTextAfter(): boolean {
		return false
	}

	getValue(): string {
		return this.__value
	}

	getLabel(): string {
		return this.__label
	}

	getTrigger(): string {
		return this.__trigger
	}

	getData(): Record<string, any> | undefined {
		return this.__data
	}

	/**
	 * Get the type prefix based on the mention type
	 */
	getTypePrefix(): string {
		const type = this.__data?.type
		if (this.__trigger === "/") {
			return "/"
		}

		if (!type) {
			return "@"
		}

		const typePrefixMap: Record<string, string> = {
			file: "@file:",
			openedFile: "@file:",
			folder: "@dir:",
			git: "@git:",
			problems: "@",
			terminal: "@",
			url: "@url:",
			mode: "/",
			command: "/",
		}

		return typePrefixMap[type] || "@"
	}

	/**
	 * Get the formatted display text based on type
	 */
	getFormattedDisplayText(): string {
		const prefix = this.getTypePrefix()

		if (this.__trigger === "/") {
			return `/${this.__label}`
		}

		// For @ mentions without special type, keep standard format
		if (prefix === "@") {
			return `@${this.__label}`
		}

		// For directory mention, add trailing slash to better indicate it's a directory
		if (prefix === "@dir:") {
			return `${prefix}${this.__label}/`
		}

		// For typed mentions, use the type prefix
		return `${prefix}${this.__label}`
	}

	setValue(value: string): MentionNode {
		const writable = this.getWritable()
		writable.__value = value
		return writable
	}

	setLabel(label: string): MentionNode {
		const writable = this.getWritable()
		writable.__label = label
		writable.__text = writable.getFormattedDisplayText()
		return writable
	}

	setData(data: Record<string, any>): MentionNode {
		const writable = this.getWritable()
		writable.__data = data
		writable.__text = writable.getFormattedDisplayText()
		return writable
	}
}

export function $createMentionNode(
	trigger: string,
	value: string,
	label?: string | null,
	text?: string,
	data?: Record<string, any>,
): MentionNode {
	// Auto-generate label if not provided
	const finalLabel = label || extractLabelFromValue(value, data?.type)

	const mentionNode = new MentionNode(trigger, value, finalLabel, text, data)
	mentionNode.setMode("segmented").toggleDirectionless()
	return $applyNodeReplacement(mentionNode)
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
	return node instanceof MentionNode
}
