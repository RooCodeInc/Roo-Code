import React, { useState, useEffect, useMemo } from "react"
import { Server, X } from "lucide-react"

import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import type { ExtensionMessage } from "@roo/ExtensionMessage"

import { StandardTooltip, Button, Popover, PopoverContent, PopoverTrigger } from "@src/components/ui"

interface BackgroundService {
	serviceId: string
	command: string
	status: string
	pid?: number
	startedAt: number
	readyAt?: number
}

interface BackgroundTasksBadgeProps {
	className?: string
}

export const BackgroundTasksBadge: React.FC<BackgroundTasksBadgeProps> = ({ className }) => {
	const { t } = useAppTranslation()
	const [services, setServices] = useState<BackgroundService[]>([])
	const [isOpen, setIsOpen] = useState(false)

	useEffect(() => {
		// Request initial service list
		vscode.postMessage({ type: "requestBackgroundServices" })

		// Set up message listener
		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			if (event.data.type === "backgroundServicesUpdate") {
				setServices(event.data.services || [])
			}
		}

		window.addEventListener("message", handleMessage)

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	// Only show running services (starting, ready, running, stopping, failed)
	// Ensure service is fully stopped before removing from list
	// Services with failed status are also shown so user knows service shutdown failed
	const runningServices = useMemo(
		() =>
			services.filter(
				(s) =>
					s.status === "starting" ||
					s.status === "ready" ||
					s.status === "running" ||
					s.status === "stopping" ||
					s.status === "failed",
			),
		[services],
	)

	// If no running services, don't render component
	if (runningServices.length === 0) {
		return null
	}

	const handleStopService = (serviceId: string, event?: React.MouseEvent) => {
		// Prevent event bubbling to avoid Popover closing
		if (event) {
			event.stopPropagation()
			event.preventDefault()
		}
		vscode.postMessage({ type: "stopService", serviceId })
	}

	// Truncate command name for display
	const truncateCommand = (command: string, maxLength: number = 30) => {
		if (command.length <= maxLength) {
			return command
		}
		return command.substring(0, maxLength - 3) + "..."
	}

	// Get status color
	const getStatusColor = (status: string) => {
		switch (status) {
			case "starting":
				return "bg-yellow-500"
			case "ready":
				return "bg-green-500"
			case "running":
				return "bg-blue-500"
			case "stopping":
				return "bg-orange-500"
			case "failed":
				return "bg-red-500"
			default:
				return "bg-vscode-descriptionForeground/60"
		}
	}

	// Get status text (using translation)
	const getStatusText = (status: string) => {
		switch (status) {
			case "starting":
				return t("common:backgroundTasks.status.starting")
			case "ready":
				return t("common:backgroundTasks.status.ready")
			case "running":
				return t("common:backgroundTasks.status.running")
			case "stopping":
				return t("common:backgroundTasks.status.stopping")
			case "failed":
				return t("common:backgroundTasks.status.failed")
			default:
				return status
		}
	}

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<StandardTooltip content={t("common:backgroundTasks.tooltip", { count: runningServices.length })}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						aria-label={t("common:backgroundTasks.ariaLabel")}
						className={cn(
							"relative h-5 px-2 gap-1.5",
							"text-vscode-foreground opacity-85",
							"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]",
							"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
							className,
						)}>
						<Server className="w-3.5 h-3.5" />
						<span className="text-xs font-mono">{runningServices.length}</span>
						{runningServices.some((s) => s.status === "starting") && (
							<span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
						)}
					</Button>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent className="w-80 p-2" align="end">
				<div className="space-y-2">
					<div className="text-xs font-semibold text-vscode-foreground mb-2">
						{t("common:backgroundTasks.title")}
					</div>
					{runningServices.map((service) => (
						<div
							key={service.serviceId}
							className="flex items-center justify-between gap-2 p-2 rounded bg-vscode-editor-background border border-vscode-border">
							<div className="flex items-center gap-2 flex-1 min-w-0">
								<span
									className={cn("w-2 h-2 rounded-full flex-shrink-0", getStatusColor(service.status))}
								/>
								<div className="flex flex-col min-w-0 flex-1">
									<div className="text-xs font-mono text-vscode-foreground truncate">
										{truncateCommand(service.command, 35)}
									</div>
									<div className="text-xs text-vscode-descriptionForeground">
										{getStatusText(service.status)}
										{service.pid && ` (PID: ${service.pid})`}
									</div>
								</div>
							</div>
							<StandardTooltip content={t("common:backgroundTasks.stopService")}>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 flex-shrink-0"
									onClick={(e) => handleStopService(service.serviceId, e)}>
									<X className="w-3.5 h-3.5" />
								</Button>
							</StandardTooltip>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	)
}
