import { useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"

import { useExtensionState } from "@src/context/ExtensionStateContext"

function toLocalTime(iso: string): string {
	const parsed = new Date(iso)
	if (Number.isNaN(parsed.getTime())) {
		return iso
	}
	return parsed.toLocaleString()
}

function statusClass(status: string): string {
	if (status === "success") {
		return "text-emerald-400"
	}
	if (status === "blocked") {
		return "text-amber-400"
	}
	return "text-rose-400"
}

export const GovernanceTraceExplorer = () => {
	const { governanceTraceEntries = [] } = useExtensionState()
	const [intentFilter, setIntentFilter] = useState("all")
	const [toolFilter, setToolFilter] = useState("all")
	const [statusFilter, setStatusFilter] = useState("all")
	const [collisionsOnly, setCollisionsOnly] = useState(false)

	const intents = useMemo(
		() => [
			"all",
			...new Set(
				governanceTraceEntries
					.map((entry) => entry.intentId)
					.filter((value): value is string => Boolean(value)),
			),
		],
		[governanceTraceEntries],
	)
	const tools = useMemo(
		() => ["all", ...new Set(governanceTraceEntries.map((entry) => entry.toolName))],
		[governanceTraceEntries],
	)

	const filtered = useMemo(
		() =>
			governanceTraceEntries.filter((entry) => {
				if (intentFilter !== "all" && entry.intentId !== intentFilter) {
					return false
				}
				if (toolFilter !== "all" && entry.toolName !== toolFilter) {
					return false
				}
				if (statusFilter !== "all" && entry.status !== statusFilter) {
					return false
				}
				if (collisionsOnly && !entry.collisionEvent) {
					return false
				}
				return true
			}),
		[governanceTraceEntries, intentFilter, toolFilter, statusFilter, collisionsOnly],
	)

	return (
		<div className="px-3 pb-2">
			<div className="rounded-xl border border-vscode-input-border bg-vscode-input-background px-3 py-2">
				<div className="text-xs font-semibold text-vscode-descriptionForeground uppercase tracking-wide">
					Trace Explorer
				</div>
				<div className="mt-2 grid grid-cols-2 gap-2 text-xs">
					<select
						value={intentFilter}
						onChange={(e) => setIntentFilter(e.target.value)}
						className="rounded border border-vscode-input-border bg-vscode-input-background px-2 py-1">
						{intents.map((intent) => (
							<option key={intent} value={intent}>
								{intent === "all" ? "All intents" : intent}
							</option>
						))}
					</select>
					<select
						value={toolFilter}
						onChange={(e) => setToolFilter(e.target.value)}
						className="rounded border border-vscode-input-border bg-vscode-input-background px-2 py-1">
						{tools.map((tool) => (
							<option key={tool} value={tool}>
								{tool === "all" ? "All tools" : tool}
							</option>
						))}
					</select>
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="rounded border border-vscode-input-border bg-vscode-input-background px-2 py-1">
						<option value="all">All statuses</option>
						<option value="success">success</option>
						<option value="blocked">blocked</option>
						<option value="failure">failure</option>
					</select>
					<label className="flex items-center gap-2 px-1">
						<input
							type="checkbox"
							checked={collisionsOnly}
							onChange={(e) => setCollisionsOnly(e.target.checked)}
						/>
						Collisions only
					</label>
				</div>
				<div className="mt-2 max-h-44 overflow-auto rounded border border-vscode-input-border/60 p-2 text-xs">
					{filtered.length === 0 ? (
						<div className="text-vscode-descriptionForeground">No trace entries match current filters.</div>
					) : (
						<div className="space-y-2">
							{filtered.slice(0, 80).map((entry) => (
								<div key={entry.traceId} className="rounded border border-vscode-input-border/60 p-2">
									<div className="flex items-center justify-between gap-2">
										<span className={`font-semibold ${statusClass(entry.status)}`}>
											{entry.status}
										</span>
										<span className="text-vscode-descriptionForeground">
											{toLocalTime(entry.timestamp)}
										</span>
									</div>
									<div className="mt-1">
										<span className="font-medium">{entry.toolName}</span>
										{entry.intentId ? ` • ${entry.intentId}` : ""}
										{entry.collisionEvent && (
											<span className="ml-2 inline-flex items-center gap-1 text-amber-400">
												<AlertTriangle className="size-3" />
												Collision
											</span>
										)}
									</div>
									{entry.errorMessage && (
										<div className="mt-1 text-vscode-descriptionForeground truncate">
											{entry.errorMessage}
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
