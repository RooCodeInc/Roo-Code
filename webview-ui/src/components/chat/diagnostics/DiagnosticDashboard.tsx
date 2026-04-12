import React, { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Activity, ChevronDown, ChevronUp, Cpu, Database, Terminal, Zap, Share, Trash2 } from "lucide-react"
import { DiagnosticSnapshot } from "@jabberwock/types"
import { vscode } from "../../../utils/vscode"
import { useExtensionState } from "../../../context/ExtensionStateContext"
import "./DiagnosticDashboard.css"

interface DiagnosticDashboardProps {
	diagnostics?: DiagnosticSnapshot
	isStreaming?: boolean
}
const DiagnosticDashboard = ({ diagnostics, isStreaming }: DiagnosticDashboardProps) => {
	const { t } = useTranslation()
	const { devtoolEnabled } = useExtensionState()
	const [isCollapsed, setIsCollapsed] = useState(false)
	const [activeTab, setActiveTab] = useState<"logs" | "speed" | "resources">("logs")

	const logs = diagnostics?.logs || []
	const metrics = diagnostics?.metrics || []
	const resources = diagnostics?.resources || []
	const currentAction = diagnostics?.currentAction

	const lastResource = resources[resources.length - 1]

	const memoryPercent = useMemo(() => {
		if (!lastResource) return 0
		return (lastResource.memoryUsage.heapUsed / lastResource.memoryUsage.heapTotal) * 100
	}, [lastResource])

	if (!devtoolEnabled) {
		return null
	}

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 B"
		const k = 1024
		const sizes = ["B", "KB", "MB", "GB"]
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
	}

	const handleExport = () => {
		const timestamp = new Date().toISOString()
		let markdown = `## Jabberwock Diagnostic Export (${timestamp})\n\n`

		if (currentAction) {
			markdown += `**Current Action:** ${currentAction}\n\n`
		}

		markdown += `### Performance Metrics\n`
		markdown += `| Action | Duration | Status |\n`
		markdown += `| :--- | :--- | :--- |\n`
		metrics.forEach((m) => {
			markdown += `| ${m.name} | ${m.durationMs}ms | ${m.status} |\n`
		})
		markdown += `\n`

		if (lastResource) {
			markdown += `### Resources\n`
			markdown += `- **CPU:** ${lastResource.cpuUsage.toFixed(1)}%\n`
			markdown += `- **Memory (Heap):** ${formatBytes(lastResource.memoryUsage.heapUsed)} / ${formatBytes(lastResource.memoryUsage.heapTotal)}\n`
			markdown += `- **Memory (RSS):** ${formatBytes(lastResource.memoryUsage.rss)}\n\n`
		}

		markdown += `### Recent Logs\n\`\`\`text\n`
		logs.slice(-50).forEach((log) => {
			const time = new Date(log.timestamp).toLocaleTimeString([], {
				hour12: false,
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			})
			markdown += `[${time}] ${log.message}\n`
		})
		markdown += `\`\`\``

		vscode.postMessage({
			type: "insertTextIntoTextarea",
			text: markdown,
		})
	}

	const handleClear = () => {
		vscode.postMessage({
			type: "clearDiagnostics",
		})
	}

	return (
		<div className={`diagnostic-dashboard ${isCollapsed ? "collapsed" : ""}`}>
			<div className="diagnostic-dashboard-header">
				<div className="diagnostic-dashboard-title" onClick={() => setIsCollapsed(!isCollapsed)}>
					<Activity size={16} color={isStreaming ? "#4facfe" : "rgba(255,255,255,0.4)"} />
					<span>Diagnostics</span>
					{currentAction && !isCollapsed && <span className="action-badge">{currentAction}</span>}
				</div>
				<div className="diagnostic-header-actions">
					{!isCollapsed && (
						<>
							<button className="icon-button" onClick={handleClear} title="Clear diagnostics">
								<Trash2 size={14} />
							</button>
							<button className="icon-button" onClick={handleExport} title="Export to chat">
								<Share size={14} />
							</button>
						</>
					)}
					<div onClick={() => setIsCollapsed(!isCollapsed)} style={{ display: "flex", cursor: "pointer" }}>
						{isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
					</div>
				</div>
			</div>

			{!isCollapsed && (
				<div className="diagnostic-tab-container">
					<div className="diagnostic-tabs">
						<button
							className={`diagnostic-tab-btn ${activeTab === "logs" ? "active" : ""}`}
							onClick={() => setActiveTab("logs")}>
							<Terminal size={14} /> {t("diagnostics:tabs.logs")}
						</button>
						<button
							className={`diagnostic-tab-btn ${activeTab === "speed" ? "active" : ""}`}
							onClick={() => setActiveTab("speed")}>
							<Zap size={14} /> {t("diagnostics:tabs.speed")}
						</button>
						<button
							className={`diagnostic-tab-btn ${activeTab === "resources" ? "active" : ""}`}
							onClick={() => setActiveTab("resources")}>
							<Database size={14} /> {t("diagnostics:tabs.resources")}
						</button>
					</div>

					<div className="diagnostic-tab-content">
						{activeTab === "logs" && (
							<div className="logs-view">
								{logs.map((log, i) => (
									<div key={i} className={`diagnostic-log-item log-${log.level}`}>
										<span className="diagnostic-log-time">
											{new Date(log.timestamp).toLocaleTimeString([], {
												hour12: false,
												hour: "2-digit",
												minute: "2-digit",
												second: "2-digit",
											})}
										</span>
										<span className="diagnostic-log-message">{log.message}</span>
									</div>
								))}
								{logs.length === 0 && <div className="empty-state">No logs yet...</div>}
							</div>
						)}

						{activeTab === "speed" && (
							<table className="speed-table">
								<thead>
									<tr>
										<th>{t("diagnostics:speed.action")}</th>
										<th>{t("diagnostics:speed.duration")}</th>
										<th>{t("diagnostics:speed.status")}</th>
									</tr>
								</thead>
								<tbody>
									{metrics.map((metric) => (
										<tr key={metric.id}>
											<td>{metric.name}</td>
											<td>
												<span className="duration-tag">{metric.durationMs}ms</span>
											</td>
											<td>
												<span className={`status-dot status-${metric.status}`} />
												{metric.status}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}

						{activeTab === "resources" && (
							<div className="resources-view">
								<div className="resource-usage-item">
									<div className="resource-label">
										<span>
											<Cpu size={12} /> {t("diagnostics:resources.cpu")}
										</span>
										<span>{lastResource ? lastResource.cpuUsage.toFixed(1) : 0}%</span>
									</div>
									<div className="resource-bar-bg">
										<div
											className={`resource-bar-fill ${lastResource && lastResource.cpuUsage > 70 ? "warning" : ""}`}
											style={{ width: `${lastResource ? lastResource.cpuUsage : 0}%` }}
										/>
									</div>
								</div>

								<div className="resource-usage-item">
									<div className="resource-label">
										<span>
											<Database size={12} /> {t("diagnostics:resources.memory")}
										</span>
										<span>
											{lastResource ? formatBytes(lastResource.memoryUsage.heapUsed) : "0 B"}
										</span>
									</div>
									<div className="resource-bar-bg">
										<div
											className={`resource-bar-fill ${memoryPercent > 80 ? "warning" : ""}`}
											style={{ width: `${memoryPercent}%` }}
										/>
									</div>
									<div className="resource-sub-label">
										{lastResource && (
											<span>
												Total: {formatBytes(lastResource.memoryUsage.heapTotal)} | RSS:{" "}
												{formatBytes(lastResource.memoryUsage.rss)}
											</span>
										)}
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

export default DiagnosticDashboard
