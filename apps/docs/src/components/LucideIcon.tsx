import React from "react"
import * as LucideIcons from "lucide-react"
import type { LucideProps } from "lucide-react"

interface LucideIconProps {
	name: keyof typeof LucideIcons
	size?: number
	color?: string
	strokeWidth?: number
	className?: string
	style?: React.CSSProperties
}

export default function LucideIcon({
	name,
	size = 20,
	color,
	strokeWidth,
	className,
	style,
}: LucideIconProps): React.JSX.Element | null {
	const Icon = LucideIcons[name] as React.ComponentType<LucideProps>

	if (!Icon) {
		console.warn(`Icon "${name}" not found in lucide-react`)
		return null
	}

	return <Icon size={size} color={color} strokeWidth={strokeWidth} className={className} style={style} />
}
