import { ToolExecutionContext } from "../types"

export const intentValidator: PreHook = async (ctx) => {
	if (!ctx.intentId) {
		throw new Error("Execution blocked: You must select a valid active intent before proceeding.")
	}
	return ctx
}
