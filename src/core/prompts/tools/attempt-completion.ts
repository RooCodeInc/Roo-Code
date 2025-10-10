import { ToolArgs } from "./types"

export function getAttemptCompletionDescription(args?: ToolArgs): string {
	return `## attempt_completion
Description: After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.

CRITICAL COMPLETION CHECKLIST - You MUST verify ALL of these before using this tool:
a) ✓ Received explicit success confirmation from the user for ALL previous tool uses
b) ✓ The core task objective is 100% complete (not partially done or "mostly working")
c) ✓ All code changes have been applied and saved successfully
d) ✓ If tests were required, they have been run AND passed
e) ✓ No compilation errors, runtime errors, or broken functionality remains
f) ✓ You are not in the middle of a multi-step process

🚨 RED FLAGS - DO NOT use this tool if ANY of these apply:
- You just made code changes but haven't confirmed they work
- Tests are failing or haven't been run when they should be
- You're waiting for a command to finish executing
- The user's task explicitly has multiple parts and you've only done some of them
- You added "TODO" comments or placeholder code that needs to be filled in
- You encountered an error and suggested the user "try X" - you should try X yourself first

IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must confirm that you've received successful results from the user for any previous tool uses. If not, then DO NOT use this tool.

Parameters:
- result: (required) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.
Usage:
<attempt_completion>
<result>
Your final result description here
</result>
</attempt_completion>

Example: Requesting to attempt completion with a result
<attempt_completion>
<result>
I've updated the CSS
</result>
</attempt_completion>`
}
