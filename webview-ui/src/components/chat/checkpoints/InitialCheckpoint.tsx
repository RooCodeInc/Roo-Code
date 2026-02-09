import { useMemo, useRef, useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

import { CheckpointMenu } from "./CheckpointMenu"
import { GitCommitVertical, Loader2, AlertTriangle } from "lucide-react"
import { StandardTooltip } from "@/components/ui"

type InitialCheckpointProps = {
	state: "pending" | "ready" | "failed"
	hash?: string | null
}

export const InitialCheckpoint = ({ state, hash }: InitialCheckpointProps) => {
	const { t } = useTranslation()
	const [isPopoverOpen, setIsPopoverOpen] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [isHovering, setIsHovering] = useState(false)
	const closeTimer = useRef<number | null>(null)

	useEffect(() => {
		return () => {
			if (closeTimer.current) {
				window.clearTimeout(closeTimer.current)
				closeTimer.current = null
			}
		}
	}, [])

	const handlePopoverOpenChange = useCallback((open: boolean) => {
		setIsPopoverOpen(open)
		if (open) {
			setIsClosing(false)
			if (closeTimer.current) {
				window.clearTimeout(closeTimer.current)
				closeTimer.current = null
			}
		} else {
			setIsClosing(true)
			closeTimer.current = window.setTimeout(() => {
				setIsClosing(false)
				closeTimer.current = null
			}, 200) // keep menu visible briefly to avoid popover jump
		}
	}, [])

	const handleMouseEnter = useCallback(() => {
		setIsHovering(true)
	}, [])

	const handleMouseLeave = useCallback(() => {
		setIsHovering(false)
	}, [])

	// Menu is visible when hovering, popover is open, or briefly after popover closes
	// But only when the state is 'ready'
	const menuVisible = state === "ready" && (isHovering || isPopoverOpen || isClosing)

	// Create checkpoint metadata for the menu
	const checkpointMetadata = useMemo(() => {
		if (!hash) {
			return undefined
		}
		return {
			from: hash,
			to: hash,
			isInitial: true,
		}
	}, [hash])

	const isPending = state === "pending"
	const isReady = state === "ready"
	const isFailed = state === "failed"

	return (
		<div
			className={cn(
				"flex items-center justify-between gap-2 pt-2 pb-3",
				isPending && "opacity-50",
				isFailed && "opacity-75",
			)}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			data-testid="initial-checkpoint">
			<div
				className={cn(
					"flex items-center gap-2 whitespace-nowrap",
					isReady && "text-blue-400",
					isPending && "text-muted",
					isFailed && "text-destructive",
				)}>
				{isPending && <Loader2 className="w-4 animate-spin" data-testid="initial-checkpoint-spinner" />}
				{isReady && <GitCommitVertical className="w-4" />}
				{isFailed && <AlertTriangle className="w-4" />}
				<span className="font-semibold">
					{isPending && t("chat:checkpoint.initializing")}
					{isReady && t("chat:checkpoint.initial")}
					{isFailed && (
						<StandardTooltip content={t("chat:checkpoint.failedDescription")}>
							<span>{t("chat:checkpoint.failed")}</span>
						</StandardTooltip>
					)}
				</span>
			</div>
			<span
				className={cn("block w-full h-[2px] mt-[2px] text-xs")}
				style={{
					backgroundImage: isPending
						? "linear-gradient(90deg, rgba(128, 128, 128, .4), rgba(128, 128, 128, .4) 80%, rgba(128, 128, 128, 0) 99%)"
						: isFailed
							? "linear-gradient(90deg, rgba(239, 68, 68, .4), rgba(239, 68, 68, .4) 80%, rgba(239, 68, 68, 0) 99%)"
							: "linear-gradient(90deg, rgba(0, 188, 255, .65), rgba(0, 188, 255, .65) 80%, rgba(0, 188, 255, 0) 99%)",
				}}></span>

			{/* Only show menu when ready and hash is available */}
			{isReady && hash && checkpointMetadata && (
				<div
					data-testid="initial-checkpoint-menu-container"
					className={cn("h-4 -mt-2", menuVisible ? "block" : "hidden")}>
					<CheckpointMenu
						ts={0} // Initial checkpoint doesn't have a ts
						commitHash={hash}
						checkpoint={checkpointMetadata}
						isInitial={true}
						onOpenChange={handlePopoverOpenChange}
					/>
				</div>
			)}
		</div>
	)
}
