import { Anthropic } from "@anthropic-ai/sdk"

export function isMergeEnvironmentDetailsMergeNeeded(modelId?: string): boolean {
	return false
}

export function mergeEnvironmentDetailsIntoUserContent(
	content: Anthropic.Messages.ContentBlockParam[],
	environmentDetails: string,
): Anthropic.Messages.ContentBlockParam[] {
	return [...content, { type: "text", text: environmentDetails }]
}
