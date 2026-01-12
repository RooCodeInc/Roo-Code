import React, { useState, useCallback, useEffect, useRef } from "react"
import { GripVertical } from "lucide-react"
import { cn } from "@src/lib/utils"

interface ResizablePanelsProps {
	leftPanel: React.ReactNode
	rightPanel: React.ReactNode
	minLeftWidth?: number // as percentage (default 20)
	minRightWidth?: number // as percentage (default 35)
	storageKey?: string // localStorage key for persisting widths
	className?: string
}

const DEFAULT_LEFT_WIDTH = 25 // Default 25% for sidebar
const DEFAULT_MIN_LEFT = 20 // Minimum 20% for sidebar
const DEFAULT_MIN_RIGHT = 35 // Minimum 35% for conversation

export const ResizablePanels: React.FC<ResizablePanelsProps> = ({
	leftPanel,
	rightPanel,
	minLeftWidth = DEFAULT_MIN_LEFT,
	minRightWidth = DEFAULT_MIN_RIGHT,
	storageKey = "resizable-panels-width",
	className,
}) => {
	const containerRef = useRef<HTMLDivElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [leftWidth, setLeftWidth] = useState<number>(() => {
		// Load from localStorage if available
		if (storageKey) {
			const stored = localStorage.getItem(storageKey)
			if (stored) {
				const parsed = parseFloat(stored)
				if (!isNaN(parsed) && parsed >= minLeftWidth && parsed <= 100 - minRightWidth) {
					return parsed
				}
			}
		}
		return DEFAULT_LEFT_WIDTH
	})

	// Persist to localStorage whenever leftWidth changes
	useEffect(() => {
		if (storageKey) {
			localStorage.setItem(storageKey, leftWidth.toString())
		}
	}, [leftWidth, storageKey])

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault()
		setIsDragging(true)
	}, [])

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging || !containerRef.current) return

			const container = containerRef.current
			const rect = container.getBoundingClientRect()
			const offsetX = e.clientX - rect.left
			const newLeftWidth = (offsetX / rect.width) * 100

			// Clamp to min/max values
			const clampedWidth = Math.max(minLeftWidth, Math.min(100 - minRightWidth, newLeftWidth))
			setLeftWidth(clampedWidth)
		},
		[isDragging, minLeftWidth, minRightWidth],
	)

	const handleMouseUp = useCallback(() => {
		setIsDragging(false)
	}, [])

	useEffect(() => {
		if (isDragging) {
			window.addEventListener("mousemove", handleMouseMove)
			window.addEventListener("mouseup", handleMouseUp)
			// Prevent text selection while dragging
			document.body.style.userSelect = "none"
			document.body.style.cursor = "ew-resize"

			return () => {
				window.removeEventListener("mousemove", handleMouseMove)
				window.removeEventListener("mouseup", handleMouseUp)
				document.body.style.userSelect = ""
				document.body.style.cursor = ""
			}
		}
	}, [isDragging, handleMouseMove, handleMouseUp])

	const rightWidth = 100 - leftWidth

	return (
		<div ref={containerRef} className={cn("flex w-full h-full relative", className)}>
			{/* Left Panel */}
			<div style={{ width: `${leftWidth}%` }} className="overflow-hidden">
				{leftPanel}
			</div>

			{/* Divider with Drag Handle */}
			<div
				className="relative flex items-center justify-center"
				style={{
					width: "8px",
					cursor: "ew-resize",
					flexShrink: 0,
				}}
				onMouseDown={handleMouseDown}>
				{/* Visual divider line */}
				<div
					className={cn(
						"absolute inset-y-0 left-1/2 -translate-x-1/2 w-px",
						"bg-vscode-panel-border transition-colors",
						isDragging && "bg-vscode-focusBorder",
					)}
				/>
				{/* Drag handle icon */}
				<div
					className={cn(
						"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
						"bg-vscode-editor-background rounded px-0.5 py-1",
						"transition-opacity",
					)}>
					<GripVertical className="cursor-ew-resize size-3 opacity-50 hover:opacity-100" />
				</div>
			</div>

			{/* Right Panel */}
			<div style={{ width: `${rightWidth}%` }} className="overflow-hidden">
				{rightPanel}
			</div>
		</div>
	)
}
