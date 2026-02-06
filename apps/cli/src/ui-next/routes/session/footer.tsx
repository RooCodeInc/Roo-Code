/**
 * Session footer - shows status messages, loading state, input hints.
 */

import { Show, createMemo, createSignal, onCleanup } from "solid-js"
import { useTheme } from "../../context/theme.js"
import { useExtension } from "../../context/extension.js"
import { useToast } from "../../context/toast.js"
import { getSpinnerFrame } from "../../ui/spinner.js"

export function SessionFooter() {
	const { theme } = useTheme()
	const ext = useExtension()
	const toast = useToast()

	// Spinner tick for loading animation
	const [tick, setTick] = createSignal(0)
	const spinnerTimer = setInterval(() => setTick((t) => t + 1), 80)
	onCleanup(() => clearInterval(spinnerTimer))

	const isLoading = createMemo(() => ext.state.isLoading && !ext.state.pendingAsk)

	const statusText = createMemo(() => {
		if (toast.current) {
			return null // Toast takes over
		}
		if (isLoading()) {
			const frame = getSpinnerFrame(tick())
			return `${frame} Thinking... • Esc to cancel`
		}
		return "? for shortcuts"
	})

	return (
		<box height={1} flexShrink={0} paddingLeft={1}>
			<Show
				when={toast.current}
				fallback={
					<Show when={statusText()}>
						{(text) => <text fg={isLoading() ? theme.accent : theme.dimText}>{text()}</text>}
					</Show>
				}>
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
		</box>
	)
}
