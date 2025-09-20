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

export type SerializedMentionNode = Spread<
	{
		mentionName: string
		trigger: string
		data?: Record<string, any>
	},
	SerializedTextNode
>

function convertMentionElement(domNode: HTMLElement): DOMConversionOutput | null {
	const textContent = domNode.textContent
	const trigger = domNode.getAttribute("data-lexical-mention-trigger")
	const mentionName = domNode.getAttribute("data-lexical-mention-name")

	if (textContent !== null && trigger !== null && mentionName !== null) {
		const node = $createMentionNode(mentionName, trigger)
		return {
			node,
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
	__mention: string
	__trigger: string
	__data?: Record<string, any>

	static getType(): string {
		return "mention"
	}

	static clone(node: MentionNode): MentionNode {
		return new MentionNode(node.__mention, node.__trigger, node.__text, node.__data, node.__key)
	}

	static importJSON(serializedNode: SerializedMentionNode): MentionNode {
		const node = $createMentionNode(serializedNode.mentionName, serializedNode.trigger, serializedNode.text)
		node.setFormat(serializedNode.format)
		node.setDetail(serializedNode.detail)
		node.setMode(serializedNode.mode)
		node.setStyle(serializedNode.style)
		if (serializedNode.data) {
			node.__data = serializedNode.data
		}
		return node
	}

	constructor(mentionName: string, trigger: string, text?: string, data?: Record<string, any>, key?: NodeKey) {
		super(text ?? `${trigger}${mentionName}`, key)
		this.__mention = mentionName
		this.__trigger = trigger
		this.__data = data
	}

	exportJSON(): SerializedMentionNode {
		return {
			...super.exportJSON(),
			mentionName: this.__mention,
			trigger: this.__trigger,
			data: this.__data,
			type: "mention",
			version: 1,
		}
	}

	createDOM(config: EditorConfig): HTMLElement {
		const dom = super.createDOM(config)

		// Apply Tailwind classes
		dom.className = MENTION_CLASSES.join(" ")
		dom.setAttribute("data-lexical-mention-trigger", this.__trigger)
		dom.setAttribute("data-lexical-mention-name", this.__mention)
		dom.setAttribute("contenteditable", "false")
		dom.setAttribute("data-lexical-text", "true")

		// Set tooltip based on trigger type
		if (this.__trigger === "@") {
			dom.setAttribute("title", `Context: ${this.__mention}`)
		} else if (this.__trigger === "/") {
			dom.setAttribute("title", `Command: ${this.__mention}`)
		}

		return dom
	}

	exportDOM(): DOMExportOutput {
		const element = document.createElement("mark")
		element.setAttribute("data-lexical-mention-trigger", this.__trigger)
		element.setAttribute("data-lexical-mention-name", this.__mention)
		element.setAttribute("contenteditable", "false")
		element.textContent = this.__text

		// Apply Tailwind classes
		element.className = MENTION_CLASSES.join(" ")

		// Set tooltip based on trigger type
		if (this.__trigger === "@") {
			element.setAttribute("title", `Context: ${this.__mention}`)
		} else if (this.__trigger === "/") {
			element.setAttribute("title", `Command: ${this.__mention}`)
		}

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

	getMentionName(): string {
		return this.__mention
	}

	getTrigger(): string {
		return this.__trigger
	}

	getData(): Record<string, any> | undefined {
		return this.__data
	}

	setMentionName(mentionName: string): MentionNode {
		const writable = this.getWritable()
		writable.__mention = mentionName
		writable.__text = `${this.__trigger}${mentionName}`
		return writable
	}

	setData(data: Record<string, any>): MentionNode {
		const writable = this.getWritable()
		writable.__data = data
		return writable
	}
}

export function $createMentionNode(
	mentionName: string,
	trigger: string,
	text?: string,
	data?: Record<string, any>,
): MentionNode {
	const mentionNode = new MentionNode(mentionName, trigger, text, data)
	mentionNode.setMode("segmented").toggleDirectionless()
	return $applyNodeReplacement(mentionNode)
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
	return node instanceof MentionNode
}
