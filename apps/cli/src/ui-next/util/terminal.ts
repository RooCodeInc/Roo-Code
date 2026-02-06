/**
 * Terminal utility functions.
 */

/**
 * Detect terminal background color (dark or light).
 * Uses OSC 11 query to ask the terminal for its background color.
 */
export async function getTerminalBackgroundColor(): Promise<"dark" | "light"> {
	if (!process.stdin.isTTY) return "dark"

	return new Promise((resolve) => {
		let timeout: NodeJS.Timeout

		const cleanup = () => {
			process.stdin.setRawMode(false)
			process.stdin.removeListener("data", handler)
			clearTimeout(timeout)
		}

		const handler = (data: Buffer) => {
			const str = data.toString()
			const match = str.match(/\x1b]11;([^\x07\x1b]+)/)
			if (match) {
				cleanup()
				const color = match[1]!
				let r = 0,
					g = 0,
					b = 0

				if (color.startsWith("rgb:")) {
					const parts = color.substring(4).split("/")
					r = parseInt(parts[0]!, 16) >> 8
					g = parseInt(parts[1]!, 16) >> 8
					b = parseInt(parts[2]!, 16) >> 8
				} else if (color.startsWith("#")) {
					r = parseInt(color.substring(1, 3), 16)
					g = parseInt(color.substring(3, 5), 16)
					b = parseInt(color.substring(5, 7), 16)
				}

				const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
				resolve(luminance > 0.5 ? "light" : "dark")
			}
		}

		process.stdin.setRawMode(true)
		process.stdin.on("data", handler)
		process.stdout.write("\x1b]11;?\x07")

		timeout = setTimeout(() => {
			cleanup()
			resolve("dark")
		}, 1000)
	})
}
