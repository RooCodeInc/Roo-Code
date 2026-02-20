import fs from "fs"
import path from "path"
import yaml from "js-yaml"

export function loadIntents() {
	const filePath = path.join(__dirname, "active_intents.yaml")
	const raw = fs.readFileSync(filePath, "utf8")
	const data = yaml.load(raw) as any

	return data.intents
}
