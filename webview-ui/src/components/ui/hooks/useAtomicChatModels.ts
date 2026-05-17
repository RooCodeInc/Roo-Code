import { useQuery } from "@tanstack/react-query"

import { type ModelRecord, type ExtensionMessage } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"

const getAtomicChatModels = async () =>
	new Promise<ModelRecord>((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("Atomic Chat models request timed out"))
		}, 10_000)

		const handler = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "atomicChatModels") {
				clearTimeout(timeout)
				cleanup()

				if (message.atomicChatModels) {
					resolve(message.atomicChatModels)
				} else {
					reject(new Error("No Atomic Chat models in response"))
				}
			}
		}

		window.addEventListener("message", handler)
		vscode.postMessage({ type: "requestAtomicChatModels" })
	})

export const useAtomicChatModels = (modelId?: string) =>
	useQuery({ queryKey: ["atomicChatModels"], queryFn: () => (modelId ? getAtomicChatModels() : {}) })
