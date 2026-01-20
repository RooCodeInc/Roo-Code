export function getAskFollowupQuestionDescription(): string {
	return `## ask_followup_question
Description: Ask the user a question to gather additional information needed to complete the task. Use when you need clarification or more details to proceed effectively.

Parameters:
- question: (required) A clear, specific question addressing the information needed
- follow_up: (required) A list of 2-4 suggested answers. Suggestions must be complete, actionable answers without placeholders. Optionally include mode to switch modes (code/architect/etc.)

Usage:
{"question":"Your question here","follow_up":[{"text":"First suggestion"},{"text":"Action with mode switch","mode":"code"}]}

Example:
{"question":"What is the path to the frontend-config.json file?","follow_up":[{"text":"./src/frontend-config.json"},{"text":"./config/frontend-config.json"},{"text":"./frontend-config.json"}]}`
}
