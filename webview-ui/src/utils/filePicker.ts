export interface PickFileAsTextOptions {
	accept?: string
}

// Choose a file and read the text content
export function pickFileAsText({ accept }: PickFileAsTextOptions = {}): Promise<string | undefined> {
	return new Promise((resolve) => {
		const input = document.createElement("input")
		input.type = "file"

		if (accept) {
			input.accept = accept
		}

		const cleanup = () => {
			input.onchange = null
		}

		input.onchange = () => {
			const file = input.files?.[0]

			if (!file) {
				cleanup()
				resolve(undefined)
				return
			}

			const reader = new FileReader()

			reader.onload = () => {
				cleanup()
				const text = typeof reader.result === "string" ? reader.result : ""
				resolve(text)
			}

			reader.onerror = () => {
				cleanup()
				resolve(undefined)
			}

			reader.readAsText(file)
		}

		input.click()
	})
}
