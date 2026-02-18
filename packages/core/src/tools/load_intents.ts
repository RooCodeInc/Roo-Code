import fs from "fs"
import path from "path"
import type { Intent } from "./select_active_intent.js"

export function load_intents(): Record<string, Intent> {
	const filePath = path.resolve(__dirname, "../data/intents.json")

	if (!fs.existsSync(filePath)) {
		throw new Error(`Intents file not found at ${filePath}`)
	}

	const raw = fs.readFileSync(filePath, "utf-8")
	return JSON.parse(raw) as Record<string, Intent>
}
