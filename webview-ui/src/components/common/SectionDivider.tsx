import React from "react"
import clsx from "clsx" // 假设我们使用 clsx 库来简化类名拼接

interface SectionDividerProps {
	title?: string
	icon?: string
	align?: "left" | "right" | "center" // 新增 align 属性
	className?: string
	hideLine?: boolean // 新增 hideLine 属性
}

const SectionDivider: React.FC<SectionDividerProps> = ({
	title,
	icon,
	align = "left",
	className = "",
	hideLine = false,
}) => {
	if (!title) {
		return <div className={`h-px bg-vscode-input-border my-0 ${className}`} />
	}

	if (align === "right") {
		return (
			<div className={`flex items-center gap-1 my-0 ${className}`}>
				{!hideLine && <div className="flex-1 h-px bg-vscode-input-border" />}
				{icon && <span className={`codicon ${icon} text-lg`} />}
				<h3 className={clsx("text-base font-semibold text-vscode-foreground whitespace-nowrap")}>{title}</h3>
			</div>
		)
	}

	if (align === "center") {
		return (
			<div className={`flex items-center gap-1 my-0 ${className}`}>
				{!hideLine && <div className="flex-1 h-px bg-vscode-input-border" />}
				{icon && <span className={`codicon ${icon} text-lg`} />}
				<h3 className={clsx("text-base font-semibold text-vscode-foreground whitespace-nowrap")}>{title}</h3>
				{!hideLine && <div className="flex-1 h-px bg-vscode-input-border" />}
			</div>
		)
	}
	return (
		<div className={`flex items-center gap-1 my-0 ${className}`}>
			{icon && <span className={`codicon ${icon} text-lg`} />}
			<h3 className={clsx("text-base font-semibold text-vscode-foreground whitespace-nowrap")}>{title}</h3>
			{!hideLine && <div className="flex-1 h-px bg-vscode-input-border" />}
		</div>
	)
}

export default SectionDivider
