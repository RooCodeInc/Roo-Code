import { useCallback, useEffect, useMemo } from "react"
import { ShieldCheck, RefreshCw } from "lucide-react"

import { Button } from "@src/components/ui"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

function formatDate(iso?: string): string {
	if (!iso) {
		return "n/a"
	}
	const parsed = new Date(iso)
	if (Number.isNaN(parsed.getTime())) {
		return "n/a"
	}
	return parsed.toLocaleString()
}

function traceStatusClass(status?: string): string {
	if (status === "success") {
		return "text-emerald-400"
	}
	if (status === "blocked") {
		return "text-amber-400"
	}
	if (status === "failure") {
		return "text-rose-400"
	}
	return "text-vscode-descriptionForeground"
}

export const GovernanceStatusPanel = () => {
	const { governanceStatus } = useExtensionState()
	const activeIntentLabel = useMemo(() => {
		if (!governanceStatus?.activeIntentId) {
			return "No active intent"
		}
		const suffix = governanceStatus.activeIntentStatus ? ` (${governanceStatus.activeIntentStatus})` : ""
		return `${governanceStatus.activeIntentId}${suffix}`
	}, [governanceStatus?.activeIntentId, governanceStatus?.activeIntentStatus])

	const handleRefresh = useCallback(() => {
		vscode.postMessage({ type: "requestGovernanceStatus" })
	}, [])

	useEffect(() => {
		handleRefresh()
	}, [handleRefresh])

	return (
		<div className="px-3 pt-2 pb-1">
			<div className="rounded-xl border border-vscode-input-border bg-vscode-input-background px-3 py-2">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 text-xs font-semibold text-vscode-descriptionForeground uppercase tracking-wide">
						<ShieldCheck className="size-3.5" />
						Governance
					</div>
					<Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleRefresh}>
						<RefreshCw className="size-3 mr-1" />
						Refresh
					</Button>
				</div>
				<div className="mt-1 text-sm text-vscode-foreground">
					<div>
						<span className="text-vscode-descriptionForeground">Intent:</span> {activeIntentLabel}
					</div>
					{governanceStatus?.activeIntentTitle && (
						<div className="text-vscode-descriptionForeground truncate">
							{governanceStatus.activeIntentTitle}
						</div>
					)}
					<div className="mt-1">
						<span className="text-vscode-descriptionForeground">Last trace:</span>{" "}
						<span className={traceStatusClass(governanceStatus?.lastTraceStatus)}>
							{governanceStatus?.lastTraceStatus ?? "n/a"}
						</span>
						{governanceStatus?.lastToolName ? ` • ${governanceStatus.lastToolName}` : ""}
					</div>
					<div className="text-xs text-vscode-descriptionForeground">
						{formatDate(governanceStatus?.lastTraceAt)}
					</div>
				</div>
			</div>
		</div>
	)
}
