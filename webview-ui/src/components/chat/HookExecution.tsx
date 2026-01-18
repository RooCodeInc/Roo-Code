import { useCallback, useState, useMemo, memo } from "react"
import { useEvent } from "react-use"
import { t } from "i18next"
import { ChevronDown, FishingHook } from "lucide-react"

import {
	type ExtensionMessage,
	hookExecutionOutputStatusSchema,
	type HookExecutionOutputStatusPayload,
} from "@roo-code/types"

import { safeJsonParse } from "@roo/core"

import { cn } from "@src/lib/utils"
import { Button, StandardTooltip } from "@src/components/ui"
import CodeBlock from "@src/components/common/CodeBlock"

interface HookExecutionProps {
	message: {
		text?: string
	}
}

type HookExecutionInitialPayload = {
	executionId?: string
	hookId?: string
	event?: string
	toolName?: string
	command?: string
}

export const HookExecution = ({ message }: HookExecutionProps) => {
	const initialData = useMemo(
		() => safeJsonParse<HookExecutionInitialPayload>(message.text || "{}", {} as HookExecutionInitialPayload),
		[message.text],
	)
	const { executionId, hookId, event, toolName, command } = initialData || {}

	// Initialize status from initialData if available (e.g. if reloaded from history and it has a result)
	// For now, we assume initialData mainly contains static info and maybe a final result summary if persisted.
	// If the hook is currently running, we'll get updates.

	const [isExpanded, setIsExpanded] = useState(false)
	const [streamingOutput, setStreamingOutput] = useState("")
	const [status, setStatus] = useState<HookExecutionOutputStatusPayload | null>(null)

	// Combine streaming output with any potential initial output (if we decide to persist it later)
	// For now, per instructions, streaming output is ephemeral.
	const output = streamingOutput

	const onMessage = useCallback(
		(event: MessageEvent) => {
			const msg: ExtensionMessage = event.data

			if (msg.type === "hookExecutionOutputStatus") {
				// We use the schema to validate/parse the payload
				// The payload is in msg.text as a JSON string for this message type, per schema in vscode-extension-host.ts
				// Wait, looking at vscode-extension-host.ts:
				// export interface ExtensionMessage { ... hookExecutionOutputStatus ... text?: string ... }
				// And hookExecutionOutputStatusSchema describes the parsed object.
				// CommandExecution parses msg.text. Let's do the same.

				const result = hookExecutionOutputStatusSchema.safeParse(safeJsonParse(msg.text, {}))

				if (result.success) {
					const data = result.data

					if (data.executionId !== executionId) {
						return
					}

					switch (data.status) {
						case "started":
							setStatus(data)
							break
						case "output":
							setStreamingOutput(data.output || "")
							break
						case "blocked":
						case "failed":
							setStatus(data)
							setIsExpanded(true) // Auto-expand on failure/block
							break
						case "exited":
							setStatus(data)
							break
						default:
							setStatus(data)
							break
					}
				}
			}
		},
		[executionId],
	)

	useEvent("message", onMessage)

	// Determine status color and icon
	const getStatusIndicator = () => {
		if (!status) return null // Or a default "pending" state if needed

		if (status.status === "started") {
			return <span className="codicon codicon-loading codicon-modifier-spin" />
		}

		if (status.status === "exited") {
			const isSuccess = status.exitCode === 0
			return (
				<StandardTooltip content={t("chat.commandExecution.exitStatus", { exitStatus: status.exitCode })}>
					<div className={cn("rounded-full size-2", isSuccess ? "bg-green-600" : "bg-red-600")} />
				</StandardTooltip>
			)
		}

		if (status.status === "failed") {
			return (
				<StandardTooltip content={status.error || "Failed"}>
					<div className="rounded-full size-2 bg-red-600" />
				</StandardTooltip>
			)
		}

		if (status.status === "blocked") {
			return (
				<StandardTooltip content={status.blockMessage || "Blocked"}>
					<div className="rounded-full size-2 bg-amber-500" />
				</StandardTooltip>
			)
		}

		return null
	}

	return (
		<div data-testid="hook-execution">
			<div className="flex flex-row items-center justify-between gap-2 mb-1">
				<div className="flex flex-row items-center gap-2 overflow-hidden">
					<FishingHook className="size-4 shrink-0" aria-label="Hook icon" />
					<span className="font-bold truncate" title={hookId}>
						{hookId}
					</span>
					<span className="text-xs text-vscode-descriptionForeground truncate">
						({event}
						{toolName ? `:${toolName}` : ""})
					</span>
					{getStatusIndicator()}
				</div>
				<div className="flex flex-row items-center justify-between gap-2 px-1">
					<div className="flex flex-row items-center gap-1">
						{status?.modified && <VSCodeBadge className="text-xs h-5">Modified</VSCodeBadge>}
						<Button
							data-testid="hook-execution-toggle"
							variant="ghost"
							size="icon"
							onClick={() => setIsExpanded(!isExpanded)}>
							<ChevronDown
								className={cn("size-4 transition-transform duration-300", isExpanded && "rotate-180")}
							/>
						</Button>
					</div>
				</div>
			</div>

			<div className="bg-vscode-editor-background border border-vscode-border rounded-xs ml-6 mt-2">
				<div className="p-2">
					<CodeBlock source={command} language="shell" />
					<OutputContainer isExpanded={isExpanded} output={output} />
					{status?.blockMessage && isExpanded && (
						<div className="mt-2 text-amber-500 font-mono text-xs">{status.blockMessage}</div>
					)}
					{status?.error && isExpanded && (
						<div className="mt-2 text-red-500 font-mono text-xs">{status.error}</div>
					)}
				</div>
			</div>
		</div>
	)
}

HookExecution.displayName = "HookExecution"

const OutputContainerInternal = ({ isExpanded, output }: { isExpanded: boolean; output: string }) => (
	<div
		className={cn("overflow-hidden", {
			"max-h-0": !isExpanded,
			"max-h-[100%] mt-1 pt-1 border-t border-border/25": isExpanded,
		})}>
		{output.length > 0 && <CodeBlock source={output} language="log" initialWordWrap={true} />}
	</div>
)

const OutputContainer = memo(OutputContainerInternal)

// Helper component for the Badge to avoid importing from vscode toolkit directly if not wrapped
const VSCodeBadge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
	<span
		className={cn(
			"bg-vscode-badge-background text-vscode-badge-foreground px-1.5 py-0.5 rounded-xs font-mono uppercase",
			className,
		)}>
		{children}
	</span>
)
