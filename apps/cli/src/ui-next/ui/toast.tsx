/**
 * Toast display component.
 */

import { Show } from "solid-js"
import { useToast } from "../context/toast.js"
import { useTheme } from "../context/theme.js"

export function ToastDisplay() {
	const toast = useToast()
	const { theme } = useTheme()

	return (
		<Show when={toast.current}>
			{(t) => {
				const color = () => {
					switch (t().variant) {
						case "success":
							return theme.success
						case "error":
							return theme.error
						case "warning":
							return theme.warning
						default:
							return theme.info
					}
				}

				return <text fg={color()}>{t().message}</text>
			}}
		</Show>
	)
}
