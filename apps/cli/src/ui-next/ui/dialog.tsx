/**
 * Dialog system for modal overlays.
 */

import { createSignal, Show, type ParentProps } from "solid-js"
import { useTheme } from "../context/theme.js"
import { createSimpleContext } from "../context/helper.js"

export interface DialogState {
	isOpen: boolean
	title?: string
}

export const { use: useDialog, provider: DialogProvider } = createSimpleContext({
	name: "Dialog",
	init: () => {
		const [state, setState] = createSignal<DialogState>({ isOpen: false })

		return {
			get isOpen() {
				return state().isOpen
			},
			get title() {
				return state().title
			},
			open(title?: string) {
				setState({ isOpen: true, title })
			},
			close() {
				setState({ isOpen: false })
			},
			clear() {
				setState({ isOpen: false })
			},
		}
	},
})

/** A simple dialog overlay component */
export function DialogOverlay(props: ParentProps<{ title?: string; visible: boolean }>) {
	const { theme } = useTheme()

	return (
		<Show when={props.visible}>
			<box flexDirection="column" borderStyle="rounded" borderColor={theme.borderActive} padding={1}>
				<Show when={props.title}>
					<text bold fg={theme.primary}>
						{props.title}
					</text>
				</Show>
				{props.children}
			</box>
		</Show>
	)
}
