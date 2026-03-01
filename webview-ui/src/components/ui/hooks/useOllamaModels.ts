import { useQuery } from "@tanstack/react-query"

import { type ModelRecord, type ExtensionMessage } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"

const getOllamaModels = async () =>
	new Promise<ModelRecord>((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("Ollama models request timed out"))
		}, 15000) // Allow extra time for backend timeout (10s) + overhead

		const handler = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "ollamaModels") {
				clearTimeout(timeout)
				cleanup()

				// The backend now always sends a response, even on error.
				// If there's an error field, reject with the server's error message
				// so callers get actionable diagnostics.
				if (message.error) {
					reject(new Error(message.error))
				} else if (message.ollamaModels) {
					resolve(message.ollamaModels)
				} else {
					reject(new Error("No Ollama models in response"))
				}
			}
		}

		window.addEventListener("message", handler)
		vscode.postMessage({ type: "requestOllamaModels" })
	})

export const useOllamaModels = (modelId?: string) =>
	useQuery({ queryKey: ["ollamaModels"], queryFn: () => (modelId ? getOllamaModels() : {}) })
