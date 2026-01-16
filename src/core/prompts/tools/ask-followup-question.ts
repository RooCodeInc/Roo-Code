export function getAskFollowupQuestionDescription(): string {
	return `## ask_followup_question
Description: Ask the user a question to gather additional information needed to complete the task. Use when you need clarification or more details to proceed effectively. You may ask multiple questions at once.

Parameters:
- question: (required) A clear, specific question addressing the information needed.
- questions: (optional) A container for asking multiple questions. Use <question> tags inside.
- follow_up: (optional) A list of suggested answers, each in its own <suggest> tag.

Usage:
<ask_followup_question>
<question>Your question here</question>
<follow_up>
<suggest>First suggestion</suggest>
<suggest mode="code">Action with mode switch</suggest>
</follow_up>
</ask_followup_question>

Usage with multiple questions:
<ask_followup_question>
<questions>
<question>Question 1?</question>
<question>Question 2?</question>
</questions>
</ask_followup_question>

Example:
<ask_followup_question>
<question>What is the path to the frontend-config.json file?</question>
<follow_up>
<suggest>./src/frontend-config.json</suggest>
<suggest>./config/frontend-config.json</suggest>
<suggest>./frontend-config.json</suggest>
</follow_up>
</ask_followup_question>`
}
