import React, { useState, useEffect } from "react"
import { Plus, Globe, Folder, Settings, SquareSlash, Sparkles } from "lucide-react"
import { Trans } from "react-i18next"

import type { Command } from "@roo/ExtensionMessage"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
} from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { buildDocLink } from "@/utils/docLinks"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SlashCommandItem } from "../chat/SlashCommandItem"
import { SkillsTab } from "./SkillsTab"

type TabType = "commands" | "skills"

interface TabButtonProps {
	active: boolean
	onClick: () => void
	children: React.ReactNode
	icon: React.ReactNode
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children, icon }) => {
	return (
		<button
			onClick={onClick}
			className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors relative ${
				active ? "text-vscode-foreground" : "text-vscode-descriptionForeground hover:text-vscode-foreground"
			}`}>
			{icon}
			{children}
			{active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-vscode-focusBorder" />}
		</button>
	)
}

// Extracted slash commands content component
const SlashCommandsContent: React.FC = () => {
	const { t } = useAppTranslation()
	const { commands, cwd } = useExtensionState()
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [commandToDelete, setCommandToDelete] = useState<Command | null>(null)
	const [globalNewName, setGlobalNewName] = useState("")
	const [workspaceNewName, setWorkspaceNewName] = useState("")

	// Check if we're in a workspace/project
	const hasWorkspace = Boolean(cwd)

	// Request commands when component mounts
	useEffect(() => {
		handleRefresh()
	}, [])

	const handleRefresh = () => {
		vscode.postMessage({ type: "requestCommands" })
	}

	const handleDeleteClick = (command: Command) => {
		setCommandToDelete(command)
		setDeleteDialogOpen(true)
	}

	const handleDeleteConfirm = () => {
		if (commandToDelete) {
			vscode.postMessage({
				type: "deleteCommand",
				text: commandToDelete.name,
				values: { source: commandToDelete.source },
			})
			setDeleteDialogOpen(false)
			setCommandToDelete(null)
			// Refresh the commands list after deletion
			setTimeout(handleRefresh, 100)
		}
	}

	const handleDeleteCancel = () => {
		setDeleteDialogOpen(false)
		setCommandToDelete(null)
	}

	const handleCreateCommand = (source: "global" | "project", name: string) => {
		if (!name.trim()) return

		// Append .md if not already present
		const fileName = name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`

		vscode.postMessage({
			type: "createCommand",
			text: fileName,
			values: { source },
		})

		// Clear the input and refresh
		if (source === "global") {
			setGlobalNewName("")
		} else {
			setWorkspaceNewName("")
		}
		setTimeout(handleRefresh, 500)
	}

	const handleCommandClick = (command: Command) => {
		// For now, we'll just show the command name - editing functionality can be added later
		// This could be enhanced to open the command file in the editor
		console.log(`Command clicked: ${command.name} (${command.source})`)
	}

	// Group commands by source
	const builtInCommands = commands?.filter((cmd) => cmd.source === "built-in") || []
	const globalCommands = commands?.filter((cmd) => cmd.source === "global") || []
	const projectCommands = commands?.filter((cmd) => cmd.source === "project") || []

	return (
		<div>
			{/* Description section */}
			<div className="mb-4">
				<p className="text-sm text-vscode-descriptionForeground">
					<Trans
						i18nKey="settings:slashCommands.description"
						components={{
							DocsLink: (
								<a
									href={buildDocLink("features/slash-commands", "slash_commands_settings")}
									target="_blank"
									rel="noopener noreferrer"
									className="text-vscode-textLink-foreground hover:underline">
									Docs
								</a>
							),
						}}
					/>
				</p>
			</div>

			{/* Global Commands Section */}
			<div className="mb-6">
				<div className="flex items-center gap-1.5 mb-2">
					<Globe className="w-3 h-3" />
					<h4 className="text-sm font-medium m-0">{t("chat:slashCommands.globalCommands")}</h4>
				</div>
				<div className="border border-vscode-panel-border rounded-md">
					{globalCommands.map((command) => (
						<SlashCommandItem
							key={`global-${command.name}`}
							command={command}
							onDelete={handleDeleteClick}
							onClick={handleCommandClick}
						/>
					))}
					{/* New global command input */}
					<div className="px-4 py-2 flex items-center gap-2 hover:bg-vscode-list-hoverBackground border-t border-vscode-panel-border">
						<input
							type="text"
							value={globalNewName}
							onChange={(e) => setGlobalNewName(e.target.value)}
							placeholder={t("chat:slashCommands.newGlobalCommandPlaceholder")}
							className="flex-1 bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border border-vscode-input-border rounded px-2 py-1 text-sm focus:outline-none focus:border-vscode-focusBorder"
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									handleCreateCommand("global", globalNewName)
								}
							}}
						/>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => handleCreateCommand("global", globalNewName)}
							disabled={!globalNewName.trim()}
							className="size-6 flex items-center justify-center opacity-60 hover:opacity-100">
							<Plus className="w-4 h-4" />
						</Button>
					</div>
				</div>
			</div>

			{/* Workspace Commands Section - Only show if in a workspace */}
			{hasWorkspace && (
				<div className="mb-6">
					<div className="flex items-center gap-1.5 mb-2">
						<Folder className="w-3 h-3" />
						<h4 className="text-sm font-medium m-0">{t("chat:slashCommands.workspaceCommands")}</h4>
					</div>
					<div className="border border-vscode-panel-border rounded-md">
						{projectCommands.map((command) => (
							<SlashCommandItem
								key={`project-${command.name}`}
								command={command}
								onDelete={handleDeleteClick}
								onClick={handleCommandClick}
							/>
						))}
						{/* New workspace command input */}
						<div className="px-4 py-2 flex items-center gap-2 hover:bg-vscode-list-hoverBackground border-t border-vscode-panel-border">
							<input
								type="text"
								value={workspaceNewName}
								onChange={(e) => setWorkspaceNewName(e.target.value)}
								placeholder={t("chat:slashCommands.newWorkspaceCommandPlaceholder")}
								className="flex-1 bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border border-vscode-input-border rounded px-2 py-1 text-sm focus:outline-none focus:border-vscode-focusBorder"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleCreateCommand("project", workspaceNewName)
									}
								}}
							/>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => handleCreateCommand("project", workspaceNewName)}
								disabled={!workspaceNewName.trim()}
								className="size-6 flex items-center justify-center opacity-60 hover:opacity-100">
								<Plus className="w-4 h-4" />
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Built-in Commands Section */}
			{builtInCommands.length > 0 && (
				<div className="mb-6">
					<div className="flex items-center gap-1.5 mb-2">
						<Settings className="w-3 h-3" />
						<h4 className="text-sm font-medium m-0">{t("chat:slashCommands.builtInCommands")}</h4>
					</div>
					<div className="border border-vscode-panel-border rounded-md">
						{builtInCommands.map((command) => (
							<SlashCommandItem
								key={`built-in-${command.name}`}
								command={command}
								onDelete={handleDeleteClick}
								onClick={handleCommandClick}
							/>
						))}
					</div>
				</div>
			)}

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("chat:slashCommands.deleteDialog.title")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("chat:slashCommands.deleteDialog.description", { name: commandToDelete?.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleDeleteCancel}>
							{t("chat:slashCommands.deleteDialog.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteConfirm}>
							{t("chat:slashCommands.deleteDialog.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

export const CommandsAndSkillsSettings: React.FC = () => {
	const { t } = useAppTranslation()
	const [activeTab, setActiveTab] = useState<TabType>("commands")

	return (
		<div>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<SquareSlash className="w-4" />
					<div>{t("settings:sections.commandsAndSkills")}</div>
				</div>
			</SectionHeader>

			<Section>
				{/* Tab Bar */}
				<div className="flex gap-1 mb-4 border-b border-vscode-panel-border">
					<TabButton
						active={activeTab === "commands"}
						onClick={() => setActiveTab("commands")}
						icon={<SquareSlash className="w-3.5 h-3.5" />}>
						{t("settings:commandsAndSkills.tabCommands")}
					</TabButton>
					<TabButton
						active={activeTab === "skills"}
						onClick={() => setActiveTab("skills")}
						icon={<Sparkles className="w-3.5 h-3.5" />}>
						{t("settings:commandsAndSkills.tabSkills")}
					</TabButton>
				</div>

				{/* Tab Content */}
				{activeTab === "commands" ? <SlashCommandsContent /> : <SkillsTab />}
			</Section>
		</div>
	)
}
