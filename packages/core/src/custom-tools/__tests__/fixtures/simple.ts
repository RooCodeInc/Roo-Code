import { parametersSchema, defineCustomTool } from "@jabberwock/types"

export default defineCustomTool({
	name: "simple",
	description: "Simple tool",
	parameters: parametersSchema.object({ value: parametersSchema.string().describe("The input value") }),
	async execute(args: { value: string }) {
		return "Result: " + args.value
	},
})
