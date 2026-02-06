/**
 * Toast provider for ephemeral notifications.
 */

import { createSignal, onCleanup } from "solid-js"
import { createSimpleContext } from "./helper.js"

export interface Toast {
	id: number
	message: string
	variant: "info" | "success" | "warning" | "error"
	duration: number
}

export const { use: useToast, provider: ToastProvider } = createSimpleContext({
	name: "Toast",
	init: () => {
		const [current, setCurrent] = createSignal<Toast | null>(null)
		let nextId = 0
		let timer: ReturnType<typeof setTimeout> | undefined

		function show(message: string, variant: Toast["variant"] = "info", duration = 3000) {
			if (timer) clearTimeout(timer)
			const id = nextId++
			setCurrent({ id, message, variant, duration })
			timer = setTimeout(() => {
				setCurrent((prev) => (prev?.id === id ? null : prev))
			}, duration)
		}

		onCleanup(() => {
			if (timer) clearTimeout(timer)
		})

		return {
			get current() {
				return current()
			},
			show,
			info: (msg: string) => show(msg, "info"),
			success: (msg: string) => show(msg, "success"),
			warning: (msg: string) => show(msg, "warning"),
			error: (msg: string) => show(msg, "error"),
			clear: () => setCurrent(null),
		}
	},
})
