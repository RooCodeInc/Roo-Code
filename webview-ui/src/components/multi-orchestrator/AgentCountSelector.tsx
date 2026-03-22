import React from "react"

interface AgentCountSelectorProps {
	value: number
	onChange: (count: number) => void
	max?: number
}

export const AgentCountSelector: React.FC<AgentCountSelectorProps> = ({ value, onChange, max = 6 }) => {
	return (
		<div className="flex items-center gap-1.5 text-xs">
			<span className="opacity-70">Agents:</span>
			<select
				value={value}
				onChange={(e) => onChange(parseInt(e.target.value))}
				className="bg-transparent border border-vscode-input-border rounded px-1 py-0.5 text-xs">
				{Array.from({ length: max }, (_, i) => i + 1).map((n) => (
					<option key={n} value={n}>
						{n}
					</option>
				))}
			</select>
		</div>
	)
}
