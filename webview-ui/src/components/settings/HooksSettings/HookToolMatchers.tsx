import React from "react"

import { toolMatchers, toolMatcherDescriptions, type ToolMatcher, type ToolMatchersConfig } from "@roo-code/types"

import { Checkbox } from "@/components/ui"

interface HookToolMatchersProps {
	matchers: ToolMatchersConfig | undefined
	onChange: (matchers: ToolMatchersConfig) => void
	disabled?: boolean
}

/**
 * Tool matcher checkboxes for tool-related hooks.
 * Displays checkboxes for each tool category: Read, Edit, Browser, Command, MCP, Modes.
 */
export const HookToolMatchers: React.FC<HookToolMatchersProps> = ({ matchers, onChange, disabled = false }) => {
	const selectedTools = matchers?.tools ?? []

	const handleToggle = (tool: ToolMatcher) => {
		const newTools = selectedTools.includes(tool)
			? selectedTools.filter((t) => t !== tool)
			: [...selectedTools, tool]

		onChange({
			...matchers,
			tools: newTools,
		})
	}

	return (
		<div className="space-y-2">
			<label className="text-sm font-medium text-vscode-foreground">Matchers</label>
			<div className="grid grid-cols-2 gap-2">
				{toolMatchers.map((tool) => {
					const isChecked = selectedTools.includes(tool)
					const description = toolMatcherDescriptions[tool]
					const label = tool.charAt(0).toUpperCase() + tool.slice(1)

					return (
						<div key={tool} className="flex items-center gap-2">
							<Checkbox
								id={`tool-matcher-${tool}`}
								checked={isChecked}
								onCheckedChange={() => handleToggle(tool)}
								disabled={disabled}
							/>
							<label
								htmlFor={`tool-matcher-${tool}`}
								className="text-sm text-vscode-foreground cursor-pointer">
								{label} <span className="text-vscode-descriptionForeground">({description})</span>
							</label>
						</div>
					)
				})}
			</div>
		</div>
	)
}
