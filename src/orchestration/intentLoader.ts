import fs from "fs"
import path from "path"
import yaml from "js-yaml"

export function loadIntentContext(intentId: string): string {
	const filePath = path.join(__dirname, "../data/active_intents.yaml")
	const file = fs.readFileSync(filePath, "utf8")
	const data: any = yaml.load(file)

	const intent = data.intents.find((i: any) => i.id === intentId)
	if (!intent) {
		throw new Error("Invalid intent ID")
	}

	return `
<intent_context>
  <intent_id>${intent.id}</intent_id>
  <scope>${intent.scope}</scope>
  <constraints>${intent.constraints.join(", ")}</constraints>
</intent_context>
`
}
