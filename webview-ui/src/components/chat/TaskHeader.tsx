import { memo, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useCloudUpsell } from "@src/hooks/useCloudUpsell"
import { CloudUpsellDialog } from "@src/components/cloud/CloudUpsellDialog"
import DismissibleUpsell from "@src/components/common/DismissibleUpsell"
import { FoldVertical, ChevronUp, ChevronDown } from "lucide-react"
import prettyBytes from "pretty-bytes"

import type { ClineMessage } from "@roo-code/types"

import { getModelMaxOutputTokens } from "@roo/api"
import { findLastIndex } from "@roo/array"

import { formatLargeNumber } from "@src/utils/format"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/components/ui"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"

import Thumbnails from "../common/Thumbnails"

import { TaskActions } from "./TaskActions"
import { ContextWindowProgress } from "./ContextWindowProgress"
import { Mention } from "./Mention"
import { TodoListDisplay } from "./TodoListDisplay"

export interface TaskHeaderProps {
	task: ClineMessage
	tokensIn: number
	tokensOut: number
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	contextTokens: number
	buttonsDisabled: boolean
	handleCondenseContext: (taskId: string) => void
	todos?: any[]
}

const TaskHeader = ({
	task,
	tokensIn,
	tokensOut,
	cacheWrites,
	cacheReads,
	totalCost,
	contextTokens,
	buttonsDisabled,
	handleCondenseContext,
	todos,
}: TaskHeaderProps) => {
	const { t } = useTranslation()
	const { apiConfiguration, currentTaskItem, clineMessages } = useExtensionState()
	const { id: modelId, info: model } = useSelectedModel(apiConfiguration)
	const [isTaskExpanded, setIsTaskExpanded] = useState(false)
	const [showLongRunningTaskMessage, setShowLongRunningTaskMessage] = useState(false)
	const { isOpen, openUpsell, closeUpsell, handleConnect } = useCloudUpsell({
		autoOpenOnAuth: false,
	})

	// Check if the task is complete by looking at the last relevant message (skipping resume messages)
	const isTaskComplete =
		clineMessages && clineMessages.length > 0
			? (() => {
					const lastRelevantIndex = findLastIndex(
						clineMessages,
						(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
					)
					return lastRelevantIndex !== -1
						? clineMessages[lastRelevantIndex]?.ask === "completion_result"
						: false
				})()
			: false

	useEffect(() => {
		const timer = setTimeout(() => {
			if (currentTaskItem && !isTaskComplete) {
				setShowLongRunningTaskMessage(true)
			}
		}, 120_000) // Show upsell after 2 minutes

		return () => clearTimeout(timer)
	}, [currentTaskItem, isTaskComplete])

	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)
	const contextWindow = model?.contextWindow || 1

	const condenseButton = (
		<StandardTooltip content={t("chat:task.condenseContext")}>
			<button
				disabled={buttonsDisabled}
				onClick={() => currentTaskItem && handleCondenseContext(currentTaskItem.id)}
				className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer disabled:cursor-not-allowed opacity-85 hover:opacity-100 bg-transparent border-none rounded-2xl">
				<FoldVertical size={16} />
			</button>
		</StandardTooltip>
	)

	const hasTodos = todos && Array.isArray(todos) && todos.length > 0

	return (
		<div className="pt-1 pb-0 px-2">
			{showLongRunningTaskMessage && !isTaskComplete && (
				<DismissibleUpsell
					upsellId="longRunningTask"
					onClick={() => openUpsell()}
					dismissOnClick={false}
					variant="banner">
					{t("cloud:upsell.longRunningTask")}
				</DismissibleUpsell>
			)}
			<div
				// if expand flex-col
				className={cn(
					isTaskExpanded ? "flex-col" : "flex-row",
					"px-3 py-1 flex  gap-1.5 relative z-1 cursor-pointer",
					"bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)]",
					"text-[rgba(255,255,255,0.75)] hover:text-[rgba(255,255,255,1)]",
					"border border-[rgba(255,255,255,0.08)]",
					"shadow-[0_2px_8px_rgba(0,0,0,0.15)]",
					hasTodos ? "rounded-t-md border-b-0" : "rounded-2xl",
				)}
				onClick={(e) => {
					// Don't expand if clicking on buttons or interactive elements
					if (
						e.target instanceof Element &&
						(e.target.closest("button") ||
							e.target.closest('[role="button"]') ||
							e.target.closest(".share-button") ||
							e.target.closest("[data-radix-popper-content-wrapper]") ||
							e.target.closest("img") ||
							e.target.tagName === "IMG")
					) {
						return
					}

					// Don't expand/collapse if user is selecting text
					const selection = window.getSelection()
					if (selection && selection.toString().length > 0) {
						return
					}

					setIsTaskExpanded(!isTaskExpanded)
				}}>
				<div className="flex  items-center gap-0  mx-auto w-full">
					<div className="flex max-w-[64%] items-center select-none grow min-w-0">
						<div className="whitespace-nowrap overflow-hidden text-ellipsis grow min-w-0 ">
							{isTaskExpanded && (
								<span className="font-semibold text-gray-300">{t("chat:task.title")}</span>
							)}
							{!isTaskExpanded && (
								<div>
									<span className="font-medium mr-1 text-gray-200">{t("chat:task.title")}</span>
									<span className="text-gray-200 text-sm bg-[rgba(255,255,255,0.08)] rounded-full px-2 py-1">
										<Mention text={task.text} />
									</span>
								</div>
							)}
						</div>
						<div
							className="flex items-center shrink-0 bg-[rgba(255,255,255,0.08)] rounded-full px-2 py-0 mr-2"
							onClick={(e) => e.stopPropagation()}>
							<StandardTooltip content={isTaskExpanded ? t("chat:task.collapse") : t("chat:task.expand")}>
								<button
									onClick={() => setIsTaskExpanded(!isTaskExpanded)}
									className="shrink-0 min-h-[22px] min-w-[22px] p-[2px] cursor-pointer opacity-85 hover:opacity-100 bg-transparent border-none rounded-2xl">
									{isTaskExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
								</button>
							</StandardTooltip>
						</div>
					</div>
					{!isTaskExpanded && contextWindow > 0 && (
						<div className="flex items-center gap-2 text-xs ml-auto" onClick={(e) => e.stopPropagation()}>
							<StandardTooltip
								content={
									<div className="space-y-1">
										<div>
											{t("chat:tokenProgress.tokensUsed", {
												used: formatLargeNumber(contextTokens || 0),
												total: formatLargeNumber(contextWindow),
											})}
										</div>
										{(() => {
											const maxTokens = model
												? getModelMaxOutputTokens({
														modelId,
														model,
														settings: apiConfiguration,
													})
												: 0
											const reservedForOutput = maxTokens || 0
											const availableSpace =
												contextWindow - (contextTokens || 0) - reservedForOutput

											return (
												<>
													{reservedForOutput > 0 && (
														<div>
															{t("chat:tokenProgress.reservedForResponse", {
																amount: formatLargeNumber(reservedForOutput),
															})}
														</div>
													)}
													{availableSpace > 0 && (
														<div>
															{t("chat:tokenProgress.availableSpace", {
																amount: formatLargeNumber(availableSpace),
															})}
														</div>
													)}
												</>
											)
										})()}
									</div>
								}
								side="top"
								sideOffset={8}>
								<span className="mr-1 px-2 py-[2px] rounded-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)]">
									{formatLargeNumber(contextTokens || 0)} / {formatLargeNumber(contextWindow)}
								</span>
							</StandardTooltip>
							{!!totalCost && (
								<span className="px-2 py-[2px] rounded-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)]">
									${totalCost.toFixed(2)}
								</span>
							)}
						</div>
					)}
				</div>
				{/* Expanded state: Show task text and images */}
				{isTaskExpanded && (
					<>
						<div
							ref={textContainerRef}
							className="text-vscode-font-size overflow-y-auto break-words break-anywhere relative">
							<div
								ref={textRef}
								className="overflow-auto max-h-80 whitespace-pre-wrap break-words break-anywhere cursor-text"
								style={{
									display: "-webkit-box",
									WebkitLineClamp: "unset",
									WebkitBoxOrient: "vertical",
								}}>
								<Mention text={task.text} />
							</div>
						</div>
						{task.images && task.images.length > 0 && <Thumbnails images={task.images} />}

						<div className="border-t border-b border-[rgba(255,255,255,0.08)] py-3 mt-2 mb-1">
							<table className="w-full">
								<tbody>
									{contextWindow > 0 && (
										<tr>
											<th
												className="font-semibold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px] text-gray-300"
												data-testid="context-window-label">
												{t("chat:task.contextWindow")}
											</th>
											<td className="align-top">
												<div className={`max-w-80 -mt-0.5 flex flex-nowrap gap-1`}>
													<ContextWindowProgress
														contextWindow={contextWindow}
														contextTokens={contextTokens || 0}
														maxTokens={
															model
																? getModelMaxOutputTokens({
																		modelId,
																		model,
																		settings: apiConfiguration,
																	})
																: undefined
														}
													/>
													{condenseButton}
												</div>
											</td>
										</tr>
									)}

									<tr>
										<th className="font-semibold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px] text-gray-300">
											{t("chat:task.tokens")}
										</th>
										<td className="align-top">
											<div className="flex items-center gap-1 flex-wrap">
												{typeof tokensIn === "number" && tokensIn > 0 && (
													<span>↑ {formatLargeNumber(tokensIn)}</span>
												)}
												{typeof tokensOut === "number" && tokensOut > 0 && (
													<span>↓ {formatLargeNumber(tokensOut)}</span>
												)}
											</div>
										</td>
									</tr>

									{((typeof cacheReads === "number" && cacheReads > 0) ||
										(typeof cacheWrites === "number" && cacheWrites > 0)) && (
										<tr>
											<th className="font-semibold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px] text-gray-300">
												{t("chat:task.cache")}
											</th>
											<td className="align-top">
												<div className="flex items-center gap-1 flex-wrap">
													{typeof cacheWrites === "number" && cacheWrites > 0 && (
														<span>↑ {formatLargeNumber(cacheWrites)}</span>
													)}
													{typeof cacheReads === "number" && cacheReads > 0 && (
														<span>↓ {formatLargeNumber(cacheReads)}</span>
													)}
												</div>
											</td>
										</tr>
									)}

									{!!totalCost && (
										<tr>
											<th className="font-semibold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px] text-gray-300">
												{t("chat:task.apiCost")}
											</th>
											<td className="align-top">
												<span>${totalCost?.toFixed(2)}</span>
											</td>
										</tr>
									)}

									{/* Size display */}
									{!!currentTaskItem?.size && currentTaskItem.size > 0 && (
										<tr>
											<th className="font-semibold text-left align-top w-1 whitespace-nowrap pl-1 pr-2  h-[20px] text-gray-300">
												{t("chat:task.size")}
											</th>
											<td className="align-top">{prettyBytes(currentTaskItem.size)}</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>

						{/* Footer with task management buttons */}
						<div onClick={(e) => e.stopPropagation()}>
							<TaskActions item={currentTaskItem} buttonsDisabled={buttonsDisabled} />
						</div>
					</>
				)}
			</div>
			<TodoListDisplay todos={todos ?? (task as any)?.tool?.todos ?? []} />
			<CloudUpsellDialog open={isOpen} onOpenChange={closeUpsell} onConnect={handleConnect} />
		</div>
	)
}

export default memo(TaskHeader)
