import { SelectActiveIntentTool } from "./SelectActiveIntentTool"
import { WriteToFileTool } from "./WriteToFileTool"
import { ExecuteCommandTool } from "./ExecuteCommandTool"

export const TOOL_REGISTRY = {
	write_file: new WriteToFileTool(),
	execute_command: new ExecuteCommandTool(),
	select_active_intent: new SelectActiveIntentTool(), // added
}
