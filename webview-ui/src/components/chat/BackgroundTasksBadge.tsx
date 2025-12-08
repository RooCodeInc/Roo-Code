import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Server, X, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"

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
	logs?: string[]
}

interface BackgroundTasksBadgeProps {
	className?: string
}

export const BackgroundTasksBadge: React.FC<BackgroundTasksBadgeProps> = ({ className }) => {
	const { t } = useAppTranslation()
	const [services, setServices] = useState<BackgroundService[]>([])
	const [isOpen, setIsOpen] = useState(false)
	// 跟踪哪些服务的日志是展开的
	const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
	// 存储每个服务的日志
	const [serviceLogs, setServiceLogs] = useState<Record<string, string[]>>({})
	// 跟踪正在加载日志的服务
	const [loadingLogs, setLoadingLogs] = useState<Set<string>>(new Set())

	useEffect(() => {
		// Request initial service list
		vscode.postMessage({ type: "requestBackgroundServices" })

		// Set up message listener
		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			if (event.data.type === "backgroundServicesUpdate") {
				setServices(event.data.services || [])
			}
			if (event.data.type === "serviceLogsUpdate") {
				const { serviceId, logs } = event.data as { type: string; serviceId: string; logs: string[] }
				setServiceLogs((prev) => ({ ...prev, [serviceId]: logs }))
				setLoadingLogs((prev) => {
					const next = new Set(prev)
					next.delete(serviceId)
					return next
				})
			}
		}

		window.addEventListener("message", handleMessage)

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	// 请求服务日志
	const requestServiceLogs = useCallback((serviceId: string) => {
		setLoadingLogs((prev) => new Set(prev).add(serviceId))
		vscode.postMessage({ type: "requestServiceLogs", serviceId })
	}, [])

	// 切换日志展开状态
	const toggleLogs = useCallback(
		(serviceId: string, event?: React.MouseEvent) => {
			if (event) {
				event.stopPropagation()
				event.preventDefault()
			}
			setExpandedLogs((prev) => {
				const next = new Set(prev)
				if (next.has(serviceId)) {
					next.delete(serviceId)
				} else {
					next.add(serviceId)
					// 如果没有日志，请求获取
					if (!serviceLogs[serviceId]) {
						requestServiceLogs(serviceId)
					}
				}
				return next
			})
		},
		[serviceLogs, requestServiceLogs],
	)

	// 刷新日志
	const refreshLogs = useCallback(
		(serviceId: string, event?: React.MouseEvent) => {
			if (event) {
				event.stopPropagation()
				event.preventDefault()
			}
			requestServiceLogs(serviceId)
		},
		[requestServiceLogs],
	)

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
			<PopoverContent className="w-96 p-2 max-h-[70vh] overflow-y-auto" align="end">
				<div className="space-y-2">
					<div className="text-xs font-semibold text-vscode-foreground mb-2">
						{t("common:backgroundTasks.title")}
					</div>
					{runningServices.map((service) => {
						const isExpanded = expandedLogs.has(service.serviceId)
						const logs = serviceLogs[service.serviceId] || []
						const isLoading = loadingLogs.has(service.serviceId)

						return (
							<div
								key={service.serviceId}
								className="rounded bg-vscode-editor-background border border-vscode-border overflow-hidden">
								{/* 服务信息头部 */}
								<div className="flex items-center justify-between gap-2 p-2">
									<div className="flex items-center gap-2 flex-1 min-w-0">
										<span
											className={cn(
												"w-2 h-2 rounded-full flex-shrink-0",
												getStatusColor(service.status),
											)}
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
									<div className="flex items-center gap-1 flex-shrink-0">
										{/* 展开/折叠日志按钮 */}
										<StandardTooltip
											content={
												isExpanded
													? t("common:backgroundTasks.hideLogs")
													: t("common:backgroundTasks.showLogs")
											}>
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6"
												onClick={(e) => toggleLogs(service.serviceId, e)}>
												{isExpanded ? (
													<ChevronUp className="w-3.5 h-3.5" />
												) : (
													<ChevronDown className="w-3.5 h-3.5" />
												)}
											</Button>
										</StandardTooltip>
										{/* 停止服务按钮 */}
										<StandardTooltip content={t("common:backgroundTasks.stopService")}>
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6"
												onClick={(e) => handleStopService(service.serviceId, e)}>
												<X className="w-3.5 h-3.5" />
											</Button>
										</StandardTooltip>
									</div>
								</div>

								{/* 日志区域 */}
								{isExpanded && (
									<div className="border-t border-vscode-border">
										<div className="flex items-center justify-between px-2 py-1 bg-vscode-sideBar-background">
											<span className="text-xs text-vscode-descriptionForeground">
												{t("common:backgroundTasks.terminalOutput")}
											</span>
											<StandardTooltip content={t("common:backgroundTasks.refreshLogs")}>
												<Button
													variant="ghost"
													size="icon"
													className="h-5 w-5"
													disabled={isLoading}
													onClick={(e) => refreshLogs(service.serviceId, e)}>
													<RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
												</Button>
											</StandardTooltip>
										</div>
										<div className="p-2 max-h-48 overflow-y-auto bg-vscode-terminal-background">
											{isLoading && logs.length === 0 ? (
												<div className="text-xs text-vscode-descriptionForeground text-center py-2">
													{t("common:backgroundTasks.loadingLogs")}
												</div>
											) : logs.length > 0 ? (
												<pre className="text-xs font-mono text-vscode-terminal-foreground whitespace-pre-wrap break-all">
													{logs.slice(-50).join("\n")}
												</pre>
											) : (
												<div className="text-xs text-vscode-descriptionForeground text-center py-2">
													{t("common:backgroundTasks.noLogs")}
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						)
					})}
				</div>
			</PopoverContent>
		</Popover>
	)
}
