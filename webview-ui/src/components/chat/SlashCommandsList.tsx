import React from "react"
import { Globe, Folder, Settings } from "lucide-react"

import type { Command } from "@roo/ExtensionMessage"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Button, StandardTooltip } from "@/components/ui"
import { vscode } from "@/utils/vscode"

import { SlashCommandItemSimple } from "./SlashCommandItemSimple"

interface SlashCommandsListProps {
	commands: Command[]
	onRefresh: () => void
}

export const SlashCommandsList: React.FC<SlashCommandsListProps> = ({ commands }) => {
	const { t } = useAppTranslation()
	const { cwd } = useExtensionState()

	// Check if we're in a workspace/project
	const hasWorkspace = Boolean(cwd)

	const handleOpenSettings = () => {
		// Send message to open settings with the slashCommands tab
		vscode.postMessage({
			type: "switchTab",
			tab: "settings",
			values: { section: "slashCommands" },
		})
	}

	const handleCommandClick = (command: Command) => {
		// Insert the command into the textarea
		vscode.postMessage({
			type: "insertTextIntoTextarea",
			text: `/${command.name}`,
		})
	}

	// Group commands by source
	const builtInCommands = commands.filter((cmd) => cmd.source === "built-in")
	const globalCommands = commands.filter((cmd) => cmd.source === "global")
	const projectCommands = commands.filter((cmd) => cmd.source === "project")

	return (
		<>
			{/* Header with settings button */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-vscode-dropdown-border">
				<span className="text-xs font-medium text-vscode-descriptionForeground">
					{t("chat:slashCommands.title")}
				</span>
				<StandardTooltip content={t("chat:slashCommands.manageCommands")}>
					<Button
						variant="ghost"
						size="icon"
						onClick={handleOpenSettings}
						className="h-6 w-6 p-0 opacity-60 hover:opacity-100">
						<Settings className="w-3.5 h-3.5" />
					</Button>
				</StandardTooltip>
			</div>

			{/* Commands list */}
			<div className="max-h-[300px] overflow-y-auto">
				<div className="py-1">
					{/* Global Commands Section */}
					<div className="px-3 py-1.5 text-xs font-medium text-vscode-descriptionForeground flex items-center gap-1.5">
						<Globe className="w-3 h-3" />
						{t("chat:slashCommands.globalCommands")}
					</div>
					{globalCommands.map((command) => (
						<SlashCommandItemSimple
							key={`global-${command.name}`}
							command={command}
							onClick={handleCommandClick}
						/>
					))}

					{/* Workspace Commands Section - Only show if in a workspace */}
					{hasWorkspace && (
						<>
							<div className="px-3 py-1.5 text-xs font-medium text-vscode-descriptionForeground mt-4 flex items-center gap-1.5">
								<Folder className="w-3 h-3" />
								{t("chat:slashCommands.workspaceCommands")}
							</div>
							{projectCommands.map((command) => (
								<SlashCommandItemSimple
									key={`project-${command.name}`}
									command={command}
									onClick={handleCommandClick}
								/>
							))}
						</>
					)}

					{/* Built-in Commands Section */}
					{builtInCommands.length > 0 && (
						<>
							<div className="px-3 py-1.5 text-xs font-medium text-vscode-descriptionForeground flex items-center gap-1.5 mt-4">
								<Settings className="w-3 h-3" />
								{t("chat:slashCommands.builtInCommands")}
							</div>
							{builtInCommands.map((command) => (
								<SlashCommandItemSimple
									key={`built-in-${command.name}`}
									command={command}
									onClick={handleCommandClick}
								/>
							))}
						</>
					)}
				</div>
			</div>
		</>
	)
}
