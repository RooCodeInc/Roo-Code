import { createInterface } from "node:readline"

import { type OnboardingResult, OnboardingProviderChoice, ASCII_ROO } from "@/types/index.js"
import { login } from "@/commands/index.js"
import { saveSettings } from "@/lib/storage/index.js"

// ANSI helpers
const CYAN = "\x1b[36m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"
const HIDE_CURSOR = "\x1b[?25l"
const SHOW_CURSOR = "\x1b[?25h"

interface MenuOption<T> {
	label: string
	value: T
}

/**
 * Render a terminal select menu with arrow-key navigation.
 * Returns the selected value when the user presses Enter.
 */
function terminalSelect<T>(prompt: string, options: MenuOption<T>[]): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const { stdin, stdout } = process

		if (!stdin.isTTY) {
			// Non-interactive fallback: use readline to read a number
			const rl = createInterface({ input: stdin, output: stdout })
			stdout.write(`${prompt}\n`)
			options.forEach((opt, i) => stdout.write(`  ${i + 1}) ${opt.label}\n`))
			rl.question("Enter choice (number): ", (answer) => {
				rl.close()
				const idx = parseInt(answer, 10) - 1
				const selected = options[idx]
				if (idx >= 0 && idx < options.length && selected) {
					resolve(selected.value)
				} else {
					reject(new Error(`Invalid choice: ${answer}`))
				}
			})
			return
		}

		let selectedIndex = 0

		function render() {
			// Move cursor up to overwrite previous render (except on first render)
			const lines = options.length
			if (rendered) {
				stdout.write(`\x1b[${lines}A`)
			}
			for (const [i, opt] of options.entries()) {
				const prefix = i === selectedIndex ? `${CYAN}❯${RESET} ` : "  "
				const label = i === selectedIndex ? `${BOLD}${opt.label}${RESET}` : `${DIM}${opt.label}${RESET}`
				stdout.write(`\x1b[2K${prefix}${label}\n`)
			}
		}

		let rendered = false

		function onData(data: Buffer) {
			const key = data.toString()

			// Up arrow: \x1b[A or k
			if (key === "\x1b[A" || key === "k") {
				selectedIndex = (selectedIndex - 1 + options.length) % options.length
				render()
				return
			}

			// Down arrow: \x1b[B or j
			if (key === "\x1b[B" || key === "j") {
				selectedIndex = (selectedIndex + 1) % options.length
				render()
				return
			}

			// Enter
			if (key === "\r" || key === "\n") {
				cleanup()
				const selected = options[selectedIndex]
				if (selected) {
					resolve(selected.value)
				}
				return
			}

			// Ctrl+C
			if (key === "\x03") {
				cleanup()
				reject(new Error("User cancelled"))
				return
			}
		}

		function cleanup() {
			stdin.removeListener("data", onData)
			stdin.setRawMode(false)
			stdin.pause()
			stdout.write(SHOW_CURSOR)
		}

		// Setup raw mode for keypress detection
		stdout.write(HIDE_CURSOR)
		stdout.write(`${prompt}\n`)
		stdin.setRawMode(true)
		stdin.resume()
		stdin.on("data", onData)

		render()
		rendered = true
	})
}

export async function runOnboarding(): Promise<OnboardingResult> {
	// Display ASCII art header
	process.stdout.write(`\n${BOLD}${CYAN}${ASCII_ROO}${RESET}\n\n`)

	const choice = await terminalSelect<OnboardingProviderChoice>(
		`${DIM}Welcome! How would you like to connect to an LLM provider?${RESET}\n`,
		[
			{ label: "Connect to Roo Code Cloud", value: OnboardingProviderChoice.Roo },
			{ label: "Bring your own API key", value: OnboardingProviderChoice.Byok },
		],
	)

	await saveSettings({ onboardingProviderChoice: choice })

	console.log("")

	if (choice === OnboardingProviderChoice.Roo) {
		const result = await login()
		await saveSettings({ onboardingProviderChoice: choice })

		return {
			choice: OnboardingProviderChoice.Roo,
			token: result.success ? result.token : undefined,
			skipped: false,
		}
	}

	console.log("Using your own API key.")
	console.log("Set your API key via --api-key or environment variable.")
	console.log("")

	return { choice: OnboardingProviderChoice.Byok, skipped: false }
}
