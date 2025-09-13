import { cn } from "@/lib/utils"

import { CODE_BLOCK_BG_COLOR } from "./CodeBlock"

export const ToolUseBlock = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"overflow-hidden border border-vscode-border rounded-xl p-1.5 cursor-pointer transition-colors",
			"hover:border-[rgba(255,255,255,0.2)]",
			className,
		)}
		style={{
			backgroundColor: CODE_BLOCK_BG_COLOR,
		}}
		{...props}
	/>
)

export const ToolUseBlockHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn("flex items-center select-none text-vscode-descriptionForeground gap-1.5", className)}
		{...props}
	/>
)
