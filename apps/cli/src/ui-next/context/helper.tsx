/**
 * Context helper utility for creating SolidJS context providers.
 * Adapted from OpenCode's createSimpleContext pattern.
 */

import { createContext, Show, useContext, type ParentProps } from "solid-js"

export function createSimpleContext<T, Props extends Record<string, unknown>>(input: {
	name: string
	init: ((input: Props) => T) | (() => T)
}) {
	const ctx = createContext<T>()

	return {
		provider: (props: ParentProps<Props>) => {
			const init = input.init(props)
			return (
				<Show
					when={!(init as Record<string, unknown>).ready || (init as Record<string, unknown>).ready === true}>
					<ctx.Provider value={init}>{props.children}</ctx.Provider>
				</Show>
			)
		},
		use() {
			const value = useContext(ctx)
			if (!value) throw new Error(`${input.name} context must be used within a context provider`)
			return value
		},
	}
}
