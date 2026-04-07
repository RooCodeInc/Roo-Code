import { useCallback } from "react"

import type { McpServer, McpGroupOptions, McpServerFilter } from "@roo-code/types"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { McpServerFilterRow } from "./McpServerFilterRow"

export interface McpFilterConfigProps {
	mcpServers: McpServer[]
	mcpGroupOptions: McpGroupOptions | undefined
	onOptionsChange: (options: McpGroupOptions | undefined) => void
	isEditing: boolean
	isLoading?: boolean
}

function getDefaultPolicy(options: McpGroupOptions | undefined): "allow" | "deny" {
	if (options && options.mcpDefaultPolicy) {
		return options.mcpDefaultPolicy
	}
	return "allow"
}

function hasAnyFilters(options: McpGroupOptions | undefined): boolean {
	if (!options) {
		return false
	}
	if (options.mcpDefaultPolicy && options.mcpDefaultPolicy !== "allow") {
		return true
	}
	if (options.mcpServers && Object.keys(options.mcpServers).length > 0) {
		return true
	}
	return false
}

function getServerFilter(options: McpGroupOptions | undefined, serverName: string): McpServerFilter | undefined {
	if (!options || !options.mcpServers) {
		return undefined
	}
	return options.mcpServers[serverName]
}

function buildCleanOptions(
	policy: "allow" | "deny",
	servers: Record<string, McpServerFilter> | undefined,
): McpGroupOptions | undefined {
	const hasServers = servers && Object.keys(servers).length > 0
	if (policy === "allow" && !hasServers) {
		return undefined
	}
	const result: McpGroupOptions = {}
	if (policy !== "allow") {
		result.mcpDefaultPolicy = policy
	}
	if (hasServers) {
		result.mcpServers = servers
	}
	return result
}

export function McpFilterConfig({
	mcpServers,
	mcpGroupOptions,
	onOptionsChange,
	isEditing,
	isLoading,
}: McpFilterConfigProps) {
	const policy = getDefaultPolicy(mcpGroupOptions)
	const serverCount = mcpServers.length

	const handlePolicyChange = useCallback(
		function (newPolicy: string) {
			const typedPolicy = newPolicy as "allow" | "deny"
			const currentServers = mcpGroupOptions?.mcpServers
			const updated = buildCleanOptions(typedPolicy, currentServers)
			onOptionsChange(updated)
		},
		[mcpGroupOptions, onOptionsChange],
	)

	const handleServerFilterChange = useCallback(
		function (serverName: string, filter: McpServerFilter | undefined) {
			const currentServers = mcpGroupOptions?.mcpServers || {}
			let updatedServers: Record<string, McpServerFilter>

			if (filter) {
				updatedServers = { ...currentServers, [serverName]: filter }
			} else {
				updatedServers = { ...currentServers }
				delete updatedServers[serverName]
			}

			const currentPolicy = getDefaultPolicy(mcpGroupOptions)
			const updated = buildCleanOptions(currentPolicy, updatedServers)
			onOptionsChange(updated)
		},
		[mcpGroupOptions, onOptionsChange],
	)

	// Read-only mode
	if (!isEditing) {
		if (isLoading && serverCount === 0) {
			return (
				<div
					className="flex items-center gap-2 py-2 ml-5 text-xs text-vscode-descriptionForeground"
					data-testid="mcp-loading-spinner">
					<span className="codicon codicon-loading codicon-modifier-spin" />
					<span>Loading MCP servers...</span>
				</div>
			)
		}
		return (
			<div
				data-testid="mcp-filter-config-readonly"
				className="mt-2 ml-5 text-sm text-vscode-descriptionForeground">
				{!hasAnyFilters(mcpGroupOptions) ? (
					<span>All servers and tools allowed</span>
				) : (
					<div className="space-y-1">
						<div>{"Default policy: " + policy}</div>
						{mcpGroupOptions?.mcpServers && Object.keys(mcpGroupOptions.mcpServers).length > 0 && (
							<div>
								{Object.keys(mcpGroupOptions.mcpServers).length + " server(s) with custom filters"}
							</div>
						)}
					</div>
				)}
			</div>
		)
	}

	return (
		<div data-testid="mcp-filter-config" className="mt-3 ml-5 border border-vscode-panel-border rounded p-3">
			{/* Default Policy selector */}
			<div className="mb-3">
				<label className="block text-xs font-medium text-vscode-foreground mb-1">Default Policy</label>
				<Select value={policy} onValueChange={handlePolicyChange}>
					<SelectTrigger className="w-48">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="allow">Allow All by Default</SelectItem>
						<SelectItem value="deny">Deny All by Default</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Server list */}
			<div>
				<div className="flex items-center gap-2 mb-2">
					<span className="text-xs font-medium text-vscode-foreground">MCP Servers</span>
					<span className="text-xs text-vscode-descriptionForeground">
						{serverCount + (serverCount === 1 ? " server" : " servers")}
					</span>
				</div>

				{isLoading && serverCount === 0 && (
					<div
						className="flex items-center gap-2 py-2 text-xs text-vscode-descriptionForeground"
						data-testid="mcp-loading-spinner">
						<span className="codicon codicon-loading codicon-modifier-spin" />
						<span>Loading MCP servers...</span>
					</div>
				)}
				{!isLoading && serverCount === 0 && (
					<div className="text-xs text-vscode-descriptionForeground italic py-2">
						No MCP servers connected
					</div>
				)}
				{serverCount > 0 && (
					<div className="space-y-1">
						{mcpServers.map(function (server) {
							const tools = (server.tools || []).map(function (t) {
								return { name: t.name, description: t.description }
							})
							return (
								<McpServerFilterRow
									key={server.name}
									serverName={server.name}
									serverStatus={server.status}
									availableTools={tools}
									filter={getServerFilter(mcpGroupOptions, server.name)}
									onFilterChange={handleServerFilterChange}
									isEditing={isEditing}
								/>
							)
						})}
					</div>
				)}
			</div>
		</div>
	)
}
