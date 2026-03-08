import type OpenAI from "openai"

import { createAskFollowupQuestionTool } from "../ask_followup_question"
import { getNativeTools } from "../index"

type FunctionTool = OpenAI.Chat.ChatCompletionFunctionTool

describe("createAskFollowupQuestionTool", () => {
	it("should use default maxItems of 4 when no argument provided", () => {
		const tool = createAskFollowupQuestionTool() as FunctionTool
		const params = tool.function.parameters as any
		expect(params.properties.follow_up.maxItems).toBe(4)
		expect(params.properties.follow_up.minItems).toBe(1)
		expect(tool.function.description).toContain("2-4")
	})

	it("should use custom maxItems when provided", () => {
		const tool = createAskFollowupQuestionTool(7) as FunctionTool
		const params = tool.function.parameters as any
		expect(params.properties.follow_up.maxItems).toBe(7)
		expect(params.properties.follow_up.minItems).toBe(1)
		expect(tool.function.description).toContain("2-7")
		expect(tool.function.description).not.toContain("2-4")
	})

	it("should use maxItems of 10 when max value provided", () => {
		const tool = createAskFollowupQuestionTool(10) as FunctionTool
		const params = tool.function.parameters as any
		expect(params.properties.follow_up.maxItems).toBe(10)
		expect(tool.function.description).toContain("2-10")
	})

	it("should use maxItems of 1 when min value provided", () => {
		const tool = createAskFollowupQuestionTool(1) as FunctionTool
		const params = tool.function.parameters as any
		expect(params.properties.follow_up.maxItems).toBe(1)
	})

	it("should have the correct tool name", () => {
		const tool = createAskFollowupQuestionTool(5) as FunctionTool
		expect(tool.function.name).toBe("ask_followup_question")
		expect(tool.type).toBe("function")
	})

	it("should update the follow_up parameter description", () => {
		const tool = createAskFollowupQuestionTool(8) as FunctionTool
		const params = tool.function.parameters as any
		expect(params.properties.follow_up.description).toContain("2-8")
	})
})

describe("getNativeTools with maxFollowUpSuggestions", () => {
	it("should use default maxItems when maxFollowUpSuggestions is not provided", () => {
		const tools = getNativeTools()
		const askTool = tools.find(
			(t) => (t as FunctionTool).function?.name === "ask_followup_question",
		) as FunctionTool
		expect(askTool).toBeDefined()
		const params = askTool.function.parameters as any
		expect(params.properties.follow_up.maxItems).toBe(4)
	})

	it("should use custom maxItems when maxFollowUpSuggestions is provided", () => {
		const tools = getNativeTools({ maxFollowUpSuggestions: 7 })
		const askTool = tools.find(
			(t) => (t as FunctionTool).function?.name === "ask_followup_question",
		) as FunctionTool
		expect(askTool).toBeDefined()
		const params = askTool.function.parameters as any
		expect(params.properties.follow_up.maxItems).toBe(7)
	})
})
