import fs from "fs"
import path from "path"
import yaml from "js-yaml"

export function selectActiveIntent(intent_id: string): string {
	const filePath = path.join(__dirname, "../../orchestration/active_intents.yaml")
	const raw = fs.readFileSync(filePath, "utf8")
	const data: any = yaml.load(raw)

	const intent = data.intents.find((i: any) => i.id === intent_id)

	if (!intent) {
		throw new Error(`Invalid intent ID: ${intent_id}`)
	}

	return `
<intent_context>
  <intent_id>${intent.id}</intent_id>
  <description>${intent.description}</description>
  <scope>${intent.scope.join(", ")}</scope>
  <constraints>${intent.constraints.join(", ")}</constraints>
</intent_context>
`
}
