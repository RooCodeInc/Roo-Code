import Anthropic from "@anthropic-ai/sdk"

// Models that support or need interleaved thinking
const modelsNeedingMergeEnvironmentDetailsKeywords = ["minimax-m2"]

export function isMergeEnvironmentDetailsMergeNeeded(modelId?: string): boolean {
	if (!modelId) {
		return false
	}
	const model = modelId.toLocaleLowerCase()
	if (!model) {
		return false
	}
	return modelsNeedingMergeEnvironmentDetailsKeywords.some((keyword) => model.includes(keyword))
}

export function mergeEnvironmentDetailsIntoUserContent(
	userContent: Anthropic.ContentBlockParam[],
	environmentDetails: string,
) {
	const result = [...userContent]
	const lastIndex = result.length - 1
	const lastItem = result[lastIndex]
	const environmentDetailsBlock = { type: "text" as const, text: environmentDetails }
	if (lastItem && lastItem.type === "tool_result") {
		if (Array.isArray(lastItem.content)) {
			result[lastIndex] = {
				...lastItem,
				content: [...lastItem.content, environmentDetailsBlock],
			}
		} else if (lastItem.content) {
			result[lastIndex] = {
				...lastItem,
				content: [{ type: "text", text: lastItem.content }, environmentDetailsBlock],
			}
		} else {
			result[lastIndex] = { ...lastItem, content: environmentDetails }
		}
	} else {
		result.push(environmentDetailsBlock)
	}
	return result
}
