import { useQuery } from "@tanstack/react-query"

import { RouterModels } from "@roo/api"
import { ExtensionMessage } from "@roo/ExtensionMessage"

import { vscode } from "@src/utils/vscode"

let warnedAutoFetchDisabled = false

type UseRouterModelsOptions = {
	provider?: string // single provider filter (e.g. "roo")
	enabled?: boolean // gate fetching entirely
}

const getRouterModels = async (provider?: string) =>
	new Promise<RouterModels>((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("Router models request timed out"))
		}, 10000)

		const handler = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "routerModels") {
				const msgProvider = message?.values?.provider as string | undefined

				// Verify response matches request
				if (provider !== msgProvider) {
					// Not our response; ignore and wait for the matching one
					return
				}

				clearTimeout(timeout)
				cleanup()

				if (message.routerModels) {
					resolve(message.routerModels)
				} else {
					reject(new Error("No router models in response"))
				}
			}
		}

		window.addEventListener("message", handler)
		if (provider) {
			vscode.postMessage({ type: "requestRouterModels", values: { provider } })
		} else {
			vscode.postMessage({ type: "requestRouterModels" })
		}
	})

export const useRouterModels = (opts: UseRouterModelsOptions = {}) => {
	const provider = opts.provider || undefined
	const enabled = Boolean(opts.enabled)

	// Trace once when auto-fetch is disabled (Phase 5.1)
	if (!enabled && !warnedAutoFetchDisabled) {
		console.log("[model-cache/ui] auto-fetch disabled; relying on explicit refresh")
		warnedAutoFetchDisabled = true
	}

	return useQuery({
		queryKey: ["routerModels", provider || "all"],
		queryFn: () => getRouterModels(provider),
		enabled,
	})
}
