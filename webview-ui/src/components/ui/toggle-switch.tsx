import React from "react"
import { cn } from "@/lib/utils"

export interface ToggleSwitchProps {
	checked: boolean
	onChange: () => void
	disabled?: boolean
	size?: "small" | "medium" | "large"
	"aria-label"?: string
	"data-testid"?: string
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
	checked,
	onChange,
	disabled = false,
	size = "medium",
	"aria-label": ariaLabel,
	"data-testid": dataTestId,
}) => {
	// Improved dimensions with better visual hierarchy
	const dimensions =
		size === "small"
			? { width: 32, height: 18, dotSize: 14, padding: 2 }
			: size === "medium"
				? { width: 40, height: 22, dotSize: 18, padding: 2 }
				: { width: 48, height: 26, dotSize: 22, padding: 2 }

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault()
			if (!disabled) {
				onChange()
			}
		}
	}

	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={ariaLabel}
			disabled={disabled}
			data-testid={dataTestId}
			onClick={onChange}
			onKeyDown={handleKeyDown}
			className={cn(
				"relative inline-flex items-center rounded-full transition-all duration-200 ease-in-out",
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-vscode-focusBorder focus-visible:ring-offset-1 focus-visible:ring-offset-vscode-editor-background",
				"border border-transparent",
				disabled && "cursor-not-allowed opacity-40",
				!disabled && "cursor-pointer hover:opacity-90",
			)}
			style={{
				width: `${dimensions.width}px`,
				height: `${dimensions.height}px`,
				backgroundColor: checked
					? "var(--vscode-button-background)"
					: "rgba(var(--vscode-titleBar-inactiveForeground-rgb, 128, 128, 128), 0.3)",
				padding: `${dimensions.padding}px`,
			}}>
			<span
				className={cn(
					"inline-block rounded-full transition-transform duration-200 ease-in-out shadow-sm",
					checked && "translate-x-full",
				)}
				style={{
					width: `${dimensions.dotSize}px`,
					height: `${dimensions.dotSize}px`,
					backgroundColor: checked
						? "var(--vscode-button-foreground, #ffffff)"
						: "var(--vscode-foreground, #cccccc)",
					transform: checked ? `translateX(${dimensions.width - dimensions.dotSize - dimensions.padding * 2}px)` : "translateX(0)",
				}}
			/>
		</button>
	)
}
