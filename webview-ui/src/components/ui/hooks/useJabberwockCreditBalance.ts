import { useEffect, useState } from "react"

import type { ExtensionMessage } from "@jabberwock/types"

import { vscode } from "@src/utils/vscode"

/**
 * Hook to fetch Jabberwock Cloud credit balance
 * Returns the balance in dollars or null if unavailable
 */
export const useJabberwockCreditBalance = () => {
	const [balance, setBalance] = useState<number | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		setIsLoading(true)
		const requestId = `jabberwock-balance-${Date.now()}`

		const handleMessage = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "rooCreditBalance" && message.requestId === requestId) {
				window.removeEventListener("message", handleMessage)
				clearTimeout(timeout)

				if (message.values?.balance !== undefined) {
					setBalance(message.values.balance)
					setError(null)
				} else if (message.values?.error) {
					setError(message.values.error)
					setBalance(null)
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

		vscode.postMessage({ type: "requestRooCreditBalance", requestId })

		return () => {
			window.removeEventListener("message", handleMessage)
			clearTimeout(timeout)
		}
	}, [])

	return { data: balance, isLoading, error }
}
