import { useState, useCallback } from "react"

import type { McpServerFilter } from "@roo-code/types"

import { Checkbox } from "@/components/ui/checkbox"
import { ToggleSwitch } from "@/components/ui/toggle-switch"

type FilterMode = "allowAll" | "allowlist" | "blocklist"

export interface McpServerFilterRowProps {
	serverName: string
	serverStatus: string
	availableTools: Array<{ name: string; description?: string }>
	filter: McpServerFilter | undefined
	onFilterChange: (serverName: string, filter: McpServerFilter | undefined) => void
	isEditing: boolean
}

function getFilterMode(filter: McpServerFilter | undefined): FilterMode {
	if (!filter) {
		return "allowAll"
	}
	if (filter.allowedTools) {
		return "allowlist"
	}
	if (filter.disabledTools) {
		return "blocklist"
	}
	return "allowAll"
}

function isToolEnabled(toolName: string, filter: McpServerFilter | undefined): boolean {
	if (!filter) {
		return true
	}
	if (filter.allowedTools) {
		return filter.allowedTools.includes(toolName)
	}
	if (filter.disabledTools) {
		return !filter.disabledTools.includes(toolName)
	}
	return true
}

function getEnabledToolCount(tools: Array<{ name: string }>, filter: McpServerFilter | undefined): number {
	return tools.filter(function (t) {
		return isToolEnabled(t.name, filter)
	}).length
}

function getStatusDotClass(status: string, isDisabled: boolean): string {
	if (isDisabled) {
		return "bg-vscode-descriptionForeground"
	}
	if (status === "connected") {
		return "bg-vscode-charts-green"
	}
	if (status === "connecting") {
		return "bg-vscode-charts-yellow"
	}
	return "bg-vscode-descriptionForeground"
}

const FILTER_MODE_LABELS: Record<FilterMode, string> = {
	allowAll: "Allow All",
	allowlist: "Allowlist",
	blocklist: "Blocklist",
}

export function McpServerFilterRow({
	serverName,
	serverStatus,
	availableTools,
	filter,
	onFilterChange,
	isEditing,
}: McpServerFilterRowProps) {
	const [isExpanded, setIsExpanded] = useState(false)

	const isDisabled = filter?.disabled === true
	const filterMode = getFilterMode(filter)
	const enabledCount = getEnabledToolCount(availableTools, filter)
	const totalCount = availableTools.length

	const handleToggleServer = useCallback(
		function () {
			if (isDisabled) {
				// Re-enable: remove disabled flag, keep other filter settings
				var updated: McpServerFilter | undefined = filter ? { ...filter, disabled: undefined } : undefined
				// Clean up empty object
				if (updated && !updated.allowedTools && !updated.disabledTools && !updated.disabled) {
					updated = undefined
				}
				onFilterChange(serverName, updated)
			} else {
				// Disable the server
				var newFilter: McpServerFilter = filter ? { ...filter, disabled: true } : { disabled: true }
				onFilterChange(serverName, newFilter)
			}
		},
		[isDisabled, filter, serverName, onFilterChange],
	)

	var handleToggleExpand = useCallback(
		function () {
			if (!isDisabled) {
				setIsExpanded(function (prev) {
					return !prev
				})
			}
		},
		[isDisabled],
	)

	var handleFilterModeChange = useCallback(
		function (newMode: FilterMode) {
			if (newMode === "allowAll") {
				var cleaned: McpServerFilter | undefined = filter ? { disabled: filter.disabled } : undefined
				if (cleaned && !cleaned.disabled) {
					cleaned = undefined
				}
				onFilterChange(serverName, cleaned)
			} else if (newMode === "allowlist") {
				// Start allowlist with all tools included
				var allNames = availableTools.map(function (t) {
					return t.name
				})
				onFilterChange(serverName, {
					...filter,
					allowedTools: allNames,
					disabledTools: undefined,
				})
			} else {
				// Start blocklist with none disabled
				onFilterChange(serverName, {
					...filter,
					disabledTools: [],
					allowedTools: undefined,
				})
			}
		},
		[filter, serverName, availableTools, onFilterChange],
	)

	var handleToggleTool = useCallback(
		function (toolName: string) {
			var currentlyEnabled = isToolEnabled(toolName, filter)

			if (filterMode === "allowlist") {
				var currentAllowed = filter?.allowedTools || []
				var newAllowed = currentlyEnabled
					? currentAllowed.filter(function (n) {
							return n !== toolName
						})
					: currentAllowed.concat([toolName])
				onFilterChange(serverName, {
					...filter,
					allowedTools: newAllowed,
				})
			} else if (filterMode === "blocklist") {
				var currentDisabled = filter?.disabledTools || []
				var newDisabled = currentlyEnabled
					? currentDisabled.concat([toolName])
					: currentDisabled.filter(function (n) {
							return n !== toolName
						})
				onFilterChange(serverName, {
					...filter,
					disabledTools: newDisabled,
				})
			}
		},
		[filter, filterMode, serverName, onFilterChange],
	)

	// Read-only mode
	if (!isEditing) {
		return (
			<div
				data-testid={"mcp-server-filter-row-" + serverName}
				className="flex items-center gap-2 py-1.5 px-2 rounded">
				<div className={"w-2 h-2 rounded-full flex-shrink-0 " + getStatusDotClass(serverStatus, isDisabled)} />
				<span className="font-medium text-vscode-foreground text-sm">{serverName}</span>
				<span className="text-xs text-vscode-descriptionForeground ml-auto">
					{isDisabled ? "disabled" : enabledCount + " of " + totalCount + " tools allowed"}
				</span>
			</div>
		)
	}

	// Editable mode
	return (
		<div
			data-testid={"mcp-server-filter-row-" + serverName}
			className="rounded border border-vscode-panel-border overflow-hidden">
			{/* Server header row */}
			<div
				className={
					"flex items-center gap-2 px-3 py-2 bg-vscode-textCodeBlock-background" +
					(isDisabled ? " opacity-60" : "") +
					(!isDisabled ? " cursor-pointer" : "")
				}
				onClick={handleToggleExpand}
				data-testid={"mcp-server-header-" + serverName}>
				{/* Chevron */}
				{!isDisabled && (
					<span
						className={
							"codicon codicon-chevron-" + (isExpanded ? "down" : "right") + " text-xs flex-shrink-0"
						}
					/>
				)}

				{/* Status dot */}
				<div className={"w-2 h-2 rounded-full flex-shrink-0 " + getStatusDotClass(serverStatus, isDisabled)} />

				{/* Server name */}
				<span className="font-bold text-vscode-foreground text-sm truncate">{serverName}</span>

				{/* Tool count */}
				<span className="text-xs text-vscode-descriptionForeground ml-1">{totalCount + " tools"}</span>

				{/* Spacer */}
				<div className="flex-1" />

				{/* Toggle switch */}
				<div
					onClick={function (e) {
						e.stopPropagation()
					}}
					className="flex-shrink-0">
					<ToggleSwitch
						checked={!isDisabled}
						onChange={handleToggleServer}
						size="medium"
						aria-label={"Toggle " + serverName + " server"}
						data-testid={"mcp-server-toggle-" + serverName}
					/>
				</div>
			</div>

			{/* Expandable tool list */}
			{!isDisabled && isExpanded && (
				<div className="px-3 py-2 border-t border-vscode-panel-border">
					{/* Filter mode selector */}
					<div className="flex items-center gap-1 mb-2" data-testid={"mcp-filter-mode-" + serverName}>
						<span className="text-xs text-vscode-descriptionForeground mr-2">Mode:</span>
						{(["allowAll", "allowlist", "blocklist"] as FilterMode[]).map(function (mode) {
							return (
								<button
									key={mode}
									type="button"
									className={
										"text-xs px-2 py-0.5 rounded border " +
										(filterMode === mode
											? "bg-vscode-button-background text-vscode-button-foreground border-vscode-button-background"
											: "bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground border-vscode-panel-border")
									}
									onClick={function (e) {
										e.stopPropagation()
										handleFilterModeChange(mode)
									}}
									data-testid={"mcp-filter-mode-btn-" + mode}>
									{FILTER_MODE_LABELS[mode]}
								</button>
							)
						})}
					</div>

					{/* Tool rows */}
					{filterMode !== "allowAll" && availableTools.length > 0 && (
						<div className="flex flex-col gap-1">
							{availableTools.map(function (tool) {
								var enabled = isToolEnabled(tool.name, filter)
								return (
									<div
										key={tool.name}
										className="flex items-center gap-2 py-1"
										data-testid={"mcp-tool-filter-" + tool.name}>
										<Checkbox
											checked={enabled}
											onCheckedChange={function () {
												handleToggleTool(tool.name)
											}}
											aria-label={(enabled ? "Disable" : "Enable") + " tool " + tool.name}
										/>
										<span
											className={
												"text-sm " +
												(enabled
													? "text-vscode-foreground"
													: "text-vscode-descriptionForeground opacity-60")
											}>
											{tool.name}
										</span>
										{tool.description && (
											<span className="text-xs text-vscode-descriptionForeground truncate ml-1">
												{tool.description}
											</span>
										)}
									</div>
								)
							})}
						</div>
					)}

					{/* Allow all message */}
					{filterMode === "allowAll" && (
						<div className="text-xs text-vscode-descriptionForeground py-1">
							All tools are enabled for this mode.
						</div>
					)}

					{/* No tools message */}
					{availableTools.length === 0 && (
						<div className="text-xs text-vscode-descriptionForeground py-1">No tools available.</div>
					)}
				</div>
			)}
		</div>
	)
}

export default McpServerFilterRow
