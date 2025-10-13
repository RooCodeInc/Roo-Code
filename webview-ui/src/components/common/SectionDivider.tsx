import React from "react"

interface SectionDividerProps {
	title?: string
	icon?: string
	className?: string
}

const SectionDivider: React.FC<SectionDividerProps> = ({ title, icon, className = "" }) => {
	if (!title) {
		return <div className={`h-px bg-vscode-input-border my-1 ${className}`} />
	}

	return (
		<div className={`flex items-center gap-2 my-1 ${className}`}>
			{icon && <span className={`codicon ${icon} text-lg`} />}
			<h3 className="text-base font-semibold text-vscode-foreground whitespace-nowrap">{title}</h3>
			<div className="flex-1 h-px bg-vscode-input-border" />
		</div>
	)
}

export default SectionDivider
