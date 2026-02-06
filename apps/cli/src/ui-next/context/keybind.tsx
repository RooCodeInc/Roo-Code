/**
 * Keybind provider for leader key system (Ctrl+X prefix).
 * Adapted from OpenCode's keybind context.
 */

import { createSignal, onCleanup } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { KeyEvent } from "@opentui/core"
import { createSimpleContext } from "./helper.js"

export interface Keybinding {
	key: string
	label: string
	action: () => void
	/** If true, requires Ctrl+X prefix */
	leader?: boolean
}

export const { use: useKeybind, provider: KeybindProvider } = createSimpleContext({
	name: "Keybind",
	init: () => {
		const [leaderActive, setLeaderActive] = createSignal(false)
		const bindings = new Map<string, Keybinding>()
		let leaderTimer: ReturnType<typeof setTimeout> | undefined

		function clearLeader() {
			setLeaderActive(false)
			if (leaderTimer) {
				clearTimeout(leaderTimer)
				leaderTimer = undefined
			}
		}

		function activateLeader() {
			setLeaderActive(true)
			// Auto-clear leader after 2 seconds
			leaderTimer = setTimeout(clearLeader, 2000)
		}

		useKeyboard((event: KeyEvent) => {
			// Ctrl+X activates leader mode
			if (event.name === "x" && event.ctrl) {
				if (!leaderActive()) {
					activateLeader()
					return
				}
			}

			if (leaderActive()) {
				clearLeader()
				// Look up leader + key binding
				const binding = bindings.get(`leader+${event.name}`)
				if (binding) {
					binding.action()
					return
				}
			}

			// Direct keybindings (no leader prefix)
			const binding = bindings.get(event.name)
			if (binding && !binding.leader) {
				binding.action()
			}
		})

		onCleanup(clearLeader)

		return {
			get isLeaderActive() {
				return leaderActive()
			},
			register(key: string, binding: Omit<Keybinding, "key">) {
				const fullKey = binding.leader ? `leader+${key}` : key
				bindings.set(fullKey, { ...binding, key })
				return () => {
					bindings.delete(fullKey)
				}
			},
			getBindings() {
				return Array.from(bindings.values())
			},
		}
	},
})
