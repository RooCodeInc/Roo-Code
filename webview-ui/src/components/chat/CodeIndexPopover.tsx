import React, { useState, useEffect, useMemo } from "react"
import { Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { Settings } from "lucide-react"

import { type IndexingStatus } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { buildDocLink } from "@src/utils/docLinks"
import { cn } from "@src/lib/utils"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Popover,
	PopoverContent,
	Button,
} from "@src/components/ui"
import { useRooPortal } from "@src/components/ui/hooks/useRooPortal"
import { useEscapeKey } from "@src/hooks/useEscapeKey"

interface CodeIndexPopoverProps {
	children: React.ReactNode
	indexingStatus: IndexingStatus
}

/**
 * CodeIndexPopover - Simplified popover for indexing status and controls.
 *
 * Configuration has been moved to Settings > Indexing tab.
 * This popover now only shows:
 * - Status indicator and message
 * - Progress bar (when indexing)
 * - Start/Stop/Clear buttons
 * - Link to Settings for configuration
 */
export const CodeIndexPopover: React.FC<CodeIndexPopoverProps> = ({
	children,
	indexingStatus: externalIndexingStatus,
}) => {
	const { t } = useAppTranslation()
	const { cwd, codebaseIndexConfig } = useExtensionState()
	const [open, setOpen] = useState(false)
	const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>(externalIndexingStatus)

	// Update indexing status from parent
	useEffect(() => {
		setIndexingStatus(externalIndexingStatus)
	}, [externalIndexingStatus])

	// Request initial indexing status
	useEffect(() => {
		if (open) {
			vscode.postMessage({ type: "requestIndexingStatus" })
		}
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "workspaceUpdated") {
				// When workspace changes, request updated indexing status
				if (open) {
					vscode.postMessage({ type: "requestIndexingStatus" })
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [open])

	// Listen for indexing status updates
	useEffect(() => {
		const handleMessage = (event: MessageEvent<any>) => {
			if (event.data.type === "indexingStatusUpdate") {
				if (!event.data.values.workspacePath || event.data.values.workspacePath === cwd) {
					setIndexingStatus({
						systemStatus: event.data.values.systemStatus,
						message: event.data.values.message || "",
						processedItems: event.data.values.processedItems,
						totalItems: event.data.values.totalItems,
						currentItemUnit: event.data.values.currentItemUnit || "items",
					})
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [cwd])

	// Handle popover close
	const handlePopoverClose = () => {
		setOpen(false)
	}

	// Use the shared ESC key handler hook
	useEscapeKey(open, handlePopoverClose)

	const progressPercentage = useMemo(
		() =>
			indexingStatus.totalItems > 0
				? Math.round((indexingStatus.processedItems / indexingStatus.totalItems) * 100)
				: 0,
		[indexingStatus.processedItems, indexingStatus.totalItems],
	)

	const transformStyleString = `translateX(-${100 - progressPercentage}%)`

	// Navigate to Settings > Indexing tab
	const handleOpenSettings = () => {
		vscode.postMessage({ type: "openSettings", section: "indexing" })
		setOpen(false)
	}

	const portalContainer = useRooPortal("roo-portal")

	// Check if indexing is enabled from config
	const isIndexingEnabled = codebaseIndexConfig?.codebaseIndexEnabled ?? false

	return (
		<Popover
			open={open}
			onOpenChange={(newOpen) => {
				if (!newOpen) {
					handlePopoverClose()
				} else {
					setOpen(newOpen)
				}
			}}>
			{children}
			<PopoverContent
				className="w-[calc(100vw-32px)] max-w-[400px] max-h-[60vh] overflow-y-auto p-0"
				align="end"
				alignOffset={0}
				side="bottom"
				sideOffset={5}
				collisionPadding={16}
				avoidCollisions={true}
				container={portalContainer}>
				<div className="p-3 border-b border-vscode-dropdown-border cursor-default">
					<div className="flex flex-row items-center gap-1 p-0 mt-0 mb-1 w-full">
						<h4 className="m-0 pb-2 flex-1">{t("settings:codeIndex.title")}</h4>
					</div>
					<p className="my-0 pr-4 text-sm w-full">
						<Trans i18nKey="settings:codeIndex.description">
							<VSCodeLink
								href={buildDocLink("features/experimental/codebase-indexing", "settings")}
								style={{ display: "inline" }}
							/>
						</Trans>
					</p>
				</div>

				<div className="p-4">
					{/* Status Section */}
					<div className="space-y-2">
						<h4 className="text-sm font-medium">{t("settings:codeIndex.statusTitle")}</h4>
						<div className="text-sm text-vscode-descriptionForeground">
							<span
								className={cn("inline-block w-3 h-3 rounded-full mr-2", {
									"bg-gray-400": indexingStatus.systemStatus === "Standby",
									"bg-yellow-500 animate-pulse": indexingStatus.systemStatus === "Indexing",
									"bg-green-500": indexingStatus.systemStatus === "Indexed",
									"bg-red-500": indexingStatus.systemStatus === "Error",
								})}
							/>
							{t(`settings:codeIndex.indexingStatuses.${indexingStatus.systemStatus.toLowerCase()}`)}
							{indexingStatus.message ? ` - ${indexingStatus.message}` : ""}
						</div>

						{indexingStatus.systemStatus === "Indexing" && (
							<div className="mt-2">
								<ProgressPrimitive.Root
									className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
									value={progressPercentage}>
									<ProgressPrimitive.Indicator
										className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-in-out"
										style={{
											transform: transformStyleString,
										}}
									/>
								</ProgressPrimitive.Root>
								<div className="text-xs text-vscode-descriptionForeground mt-1">
									{progressPercentage}% ({indexingStatus.processedItems} / {indexingStatus.totalItems}{" "}
									{indexingStatus.currentItemUnit})
								</div>
							</div>
						)}
					</div>

					{/* Configure in Settings Link */}
					<div className="mt-4 pt-4 border-t border-vscode-dropdown-border">
						<button
							onClick={handleOpenSettings}
							className="flex items-center gap-2 text-sm text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground cursor-pointer bg-transparent border-none p-0">
							<Settings className="w-4 h-4" />
							{t("settings:codeIndex.configureInSettings")}
						</button>
					</div>

					{/* Action Buttons */}
					<div className="flex items-center justify-start gap-2 pt-4">
						{isIndexingEnabled &&
							(indexingStatus.systemStatus === "Error" || indexingStatus.systemStatus === "Standby") && (
								<Button onClick={() => vscode.postMessage({ type: "startIndexing" })}>
									{t("settings:codeIndex.startIndexingButton")}
								</Button>
							)}

						{isIndexingEnabled && indexingStatus.systemStatus === "Indexing" && (
							<Button variant="secondary" onClick={() => vscode.postMessage({ type: "stopIndexing" })}>
								{t("settings:codeIndex.stopIndexingButton")}
							</Button>
						)}

						{isIndexingEnabled &&
							(indexingStatus.systemStatus === "Indexed" || indexingStatus.systemStatus === "Error") && (
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button variant="secondary">
											{t("settings:codeIndex.clearIndexDataButton")}
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												{t("settings:codeIndex.clearDataDialog.title")}
											</AlertDialogTitle>
											<AlertDialogDescription>
												{t("settings:codeIndex.clearDataDialog.description")}
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>
												{t("settings:codeIndex.clearDataDialog.cancelButton")}
											</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => vscode.postMessage({ type: "clearIndexData" })}>
												{t("settings:codeIndex.clearDataDialog.confirmButton")}
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							)}

						{!isIndexingEnabled && (
							<div className="text-sm text-vscode-descriptionForeground">
								{t("settings:codeIndex.enableInSettings")}
							</div>
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
