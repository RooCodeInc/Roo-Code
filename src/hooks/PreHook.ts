import { IntentService } from "./IntentService"

export class PreHook {
	constructor(private intentService: IntentService) {}

	async run(toolName: string, args: any) {
		if (toolName === "select_active_intent") {
			const intent = this.intentService.selectIntent(args.intent_id)

			return {
				intent_context: {
					constraints: intent.constraints,
					owned_scope: intent.owned_scope,
				},
			}
		}

		if (toolName === "write_to_file") {
			const activeIntent = this.intentService.getActiveIntent()

			if (!activeIntent) {
				throw new Error("You must select an active intent before writing files.")
			}
			// Return something even if nothing needs to be returned
			return {}
		}

		// Default return for any other toolName
		return {}
	}
}
