import { HookManager } from "./HookManager"
import type { HookCallback, HookEventType, HookLifecycleStage, HookOptions } from "./types"

export function createHook() {
	const manager = HookManager.getInstance()

	return {
		onLifecycle: (stage: HookLifecycleStage, callback: HookCallback, options?: HookOptions) => {
			return manager.registerLifecycleHook(stage, callback, options)
		},

		onEvent: (event: HookEventType, callback: HookCallback, options?: HookOptions) => {
			return manager.registerEventHook(event, callback, options)
		},

		off: (id: string) => {
			return manager.unregister(id)
		},
	}
}
