/**
 * Modified from Kilo-Org/kilocode
 * Copyright Kilo Org, Inc.
 * Licensed under Apache-2.0
 */
import { randomUUID } from "node:crypto"

export class AutocompleteDebouncer {
	private debounceTimeout: NodeJS.Timeout | undefined = undefined
	private currentRequestId: string | undefined = undefined

	async delayAndShouldDebounce(debounceDelay: number, abortSignal?: AbortSignal): Promise<boolean> {
		// 如果已经被取消，立即返回
		if (abortSignal?.aborted) {
			return true
		}

		// Generate a unique ID for this request
		const requestId = randomUUID()
		this.currentRequestId = requestId

		// Clear any existing timeout
		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout)
		}

		// Create a new promise that resolves after the debounce delay
		return new Promise<boolean>((resolve) => {
			// 取消回调：立即 resolve，不等待 timeout
			const onAbort = () => {
				if (this.debounceTimeout) {
					console.log("[Debouncer] clear timeout")
					clearTimeout(this.debounceTimeout)
					this.debounceTimeout = undefined
				}
				console.log("[Debouncer] resolve true")
				resolve(true) // 返回 true 表示应该跳过
			}

			// 监听取消事件
			abortSignal?.addEventListener("abort", onAbort, { once: true })

			this.debounceTimeout = setTimeout(() => {
				// 移除事件监听器，避免内存泄漏
				abortSignal?.removeEventListener("abort", onAbort)

				// When the timeout completes, check if this is still the most recent request
				const shouldDebounce = this.currentRequestId !== requestId

				// If this is the most recent request, it shouldn't be debounced
				if (!shouldDebounce) {
					this.currentRequestId = undefined
				}

				resolve(shouldDebounce)
			}, debounceDelay)
		})
	}
}
