import { useState } from "react"
import { MAX_IMAGES_PER_MESSAGE } from "@src/components/chat/ChatView"
export interface UseClipboardProps {
	timeout?: number
}
export interface CopyPayload {
	text: string
	images?: string[]
}
export function useClipboard({ timeout = 2000 }: UseClipboardProps = {}) {
	const [isCopied, setIsCopied] = useState(false)
	const copy = async (payload: CopyPayload | string) => {
		const { text, images = [] } = typeof payload === "string" ? { text: payload, images: [] } : payload
		const handleSuccess = () => {
			setIsCopied(true)
			setTimeout(() => setIsCopied(false), timeout)
		}
		if (typeof window === "undefined") {
			return
		}
		try {
			if (navigator.clipboard?.write && images.length > 0) {
				const limitedImages = images.slice(0, MAX_IMAGES_PER_MESSAGE)
				const escapedText = text
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;")
					.replace(/"/g, "&quot;")
				const imgTags = limitedImages.map((base64) => `<img src="${base64}" />`).join("")
				const html = `<div><p>${escapedText}</p>${imgTags}</div>`
				const htmlBlob = new Blob([html], { type: "text/html" })
				const textBlob = new Blob([text], { type: "text/plain" })
				const clipboardItem = new ClipboardItem({
					"text/html": htmlBlob,
					"text/plain": textBlob,
				})
				await navigator.clipboard.write([clipboardItem])
				handleSuccess()
				return
			}
		} catch (err) {
			console.warn("Rich text copy failed, falling back to plain text", err)
		}
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text)
				handleSuccess()
				return
			}
		} catch (err) {
			console.warn("navigator.clipboard.writeText failed, falling back to execCommand", err)
		}
		try {
			const textarea = document.createElement("textarea")
			textarea.value = text
			textarea.style.position = "fixed"
			textarea.style.opacity = "0"
			document.body.appendChild(textarea)
			textarea.select()
			document.execCommand("copy")
			document.body.removeChild(textarea)
			handleSuccess()
		} catch (err) {
			console.error("All copy methods failed", err)
		}
	}
	return { isCopied, copy }
}
