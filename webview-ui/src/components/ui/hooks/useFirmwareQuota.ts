import { useEffect, useState } from "react"

import type { ExtensionMessage } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"

export interface FirmwareQuotaInfo {
	used: number // 0 to 1 scale (1 = limit reached)
	reset: string // ISO timestamp when quota resets
}

export const useFirmwareQuota = () => {
	const [quota, setQuota] = useState<FirmwareQuotaInfo | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		setIsLoading(true)
		const requestId = `firmware-quota-${Date.now()}`

		const handleMessage = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "firmwareQuota" && message.requestId === requestId) {
				window.removeEventListener("message", handleMessage)
				clearTimeout(timeout)

				if (message.values?.used !== undefined) {
					setQuota({
						used: message.values.used,
						reset: message.values.reset,
					})
					setError(null)
				} else if (message.values?.error) {
					setError(message.values.error)
					setQuota(null)
				}

				setIsLoading(false)
			}
		}

		const timeout = setTimeout(() => {
			window.removeEventListener("message", handleMessage)
			setIsLoading(false)
			setError("Request timed out")
		}, 10000)

		window.addEventListener("message", handleMessage)

		vscode.postMessage({ type: "requestFirmwareQuota", requestId })

		return () => {
			window.removeEventListener("message", handleMessage)
			clearTimeout(timeout)
		}
	}, [])

	return { data: quota, isLoading, error }
}
