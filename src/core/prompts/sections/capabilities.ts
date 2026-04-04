import { McpHub } from "../../../services/mcp/McpHub"
import { getModeBySlug, defaultModeSlug } from "../../../shared/modes"
import { isServerVisibleToAgent } from "../../../services/mcp/McpMigration"
import type { ModeConfig } from "@jabberwock/types"

export function getCapabilitiesSection(
	cwd: string,
	mcpHub?: McpHub,
	mode?: string,
	customModes?: ModeConfig[],
): string {
	let mcpServersList = ""
	if (mcpHub) {
		const modeSlug = mode ?? defaultModeSlug
		const modeConfig = getModeBySlug(modeSlug, customModes)
		const mcpList = modeConfig?.mcpList ?? []
		const visibleServers = mcpHub.getServers().filter((server) => {
			let serverConfig: any = {}
			try {
				serverConfig = JSON.parse(server.config)
			} catch (e) {}
			return isServerVisibleToAgent(server.name, serverConfig, mcpList)
		})

		if (visibleServers.length > 0) {
			mcpServersList = "\n\nAvailable MCP servers:\n" + visibleServers.map((s) => `- ${s.name}`).join("\n")
		}
	}

	return `====

CAPABILITIES

- You have access to tools that let you execute CLI commands on the user's computer, list files, view source code definitions, regex search, read and write files, and ask follow-up questions. These tools help you effectively accomplish a wide range of tasks, such as writing code, making edits or improvements to existing files, understanding the current state of a project, performing system operations, and much more.
- When the user initially gives you a task, a recursive list of all filepaths in the current workspace directory ('${cwd}') will be included in environment_details. This provides an overview of the project's file structure, offering key insights into the project from directory/file names (how developers conceptualize and organize their code) and file extensions (the language used). This can also guide decision-making on which files to explore further. If you need to further explore directories such as outside the current workspace directory, you can use the list_files tool. If you pass 'true' for the recursive parameter, it will list files recursively. Otherwise, it will list files at the top level, which is better suited for generic directories where you don't necessarily need the nested structure, like the Desktop.
- You can use the execute_command tool to run commands on the user's computer whenever you feel it can help accomplish the user's task. When you need to execute a CLI command, you must provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, since they are more flexible and easier to run. Interactive and long-running commands are allowed, since the commands are run in the user's VSCode terminal. The user may keep commands running in the background and you will be kept updated on their status along the way. Each command you execute is run in a new terminal instance.${
		mcpHub
			? `
- You have access to MCP servers that may provide additional tools and resources. Each server may provide different capabilities that you can use to accomplish tasks more effectively.${mcpServersList}
`
			: ""
	}`
}
