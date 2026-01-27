"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, GitPullRequest, User } from "lucide-react"

import { cn } from "@/lib/utils"

type ActivityItem = {
	id: string
	kind: "comment" | "status" | "assignee" | "pr-link"
	author?: string
	avatarText?: string
	avatarClassName?: string
	isBot?: boolean
	body: ReactNode
	timeLabel: string
}

function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false)

	useEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)")
		const onChange = () => setReduced(media.matches)
		onChange()

		if (typeof media.addEventListener === "function") {
			media.addEventListener("change", onChange)
			return () => media.removeEventListener("change", onChange)
		}

		media.addListener?.(onChange)
		return () => media.removeListener?.(onChange)
	}, [])

	return reduced
}

type TypingDotsProps = {
	className?: string
}

function TypingDots({ className }: TypingDotsProps): JSX.Element {
	return (
		<span className={cn("inline-flex items-center gap-1", className)} aria-hidden="true">
			<span className="h-1.5 w-1.5 rounded-full bg-[#8B8D91] animate-pulse [animation-delay:0ms]" />
			<span className="h-1.5 w-1.5 rounded-full bg-[#8B8D91] animate-pulse [animation-delay:180ms]" />
			<span className="h-1.5 w-1.5 rounded-full bg-[#8B8D91] animate-pulse [animation-delay:360ms]" />
		</span>
	)
}

function LinearIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
			<path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C19.3336 94.3417 5.63867 80.5968 1.22541 61.5228Z" />
			<path d="M.00189135 46.8891c-.01764375.2833.00143108.5765.05765765.8662.42870855 2.2073.93958605 4.3773 1.52844055 6.5063.3362 1.2154 1.8704 1.5324 2.6694.5765l42.7602-51.17121c.8082-.96676.3586-2.4829-.8213-2.74103-2.1092-.46189-4.2555-.84478-6.4348-1.14529-.2881-.03979-.5805-.05843-.8712-.05583-1.1371.01015-2.2285.57047-2.9144 1.46387L.543385 45.1098c-.35605.4555-.55221 1.0108-.541494 1.5765v.2028Z" />
			<path d="M7.47413 78.5763C5.95136 74.4783 4.89508 70.1874 4.34574 65.7571c-.11115-.8958.68135-1.6505 1.57048-1.4761l69.38238 13.6164c.8691.1706 1.2051 1.2165.583 1.8154-7.0838 6.8254-15.6512 12.091-25.2015 15.2757-.5174.1725-1.0869.131-1.5692-.1141L7.47413 78.5763Z" />
			<path d="M10.0667 87.1726c1.6311 1.5358 3.3347 2.9962 5.1042 4.3749.7181.5592 1.7288.5197 2.3995-.0939l36.4528-33.3725c.6929-.6343.5923-1.7418-.2146-2.3164-3.9746-2.8318-8.1879-5.3425-12.6031-7.4955-.6973-.34-1.5254-.2662-2.1506.1918L10.1041 72.2827c-.6507.4768-.9474 1.2653-.7844 2.0279.6166 2.8848 1.3865 5.7086 2.3044 8.4624.2101.6303.6234 1.1744 1.1681 1.5379l-2.7255 2.8617Z" />
			<path d="M30.9098 21.0292c-3.1675 5.2947-5.7485 10.9641-7.6686 16.9177-.2455.7611.0375 1.5912.6928 2.0326l26.7913 18.0587c.7022.4737 1.6445.3348 2.186-.3225l32.2427-39.1412c.549-.6667.353-1.6701-.4187-2.1215a99.30965 99.30965 0 0 0-16.6623-8.02636c-.6649-.2588-1.4207-.14022-1.9703.309L30.9098 21.0292Z" />
			<path d="M52.8822 97.4268c4.7332-.7003 9.2986-1.9013 13.6391-3.5563.6692-.2552 1.1306-.8583 1.1994-1.5696L72.341 47.4856c.0692-.7162-.2759-1.4034-.8986-1.7878l-34.8323-21.5036c-.73-.4504-1.6842-.2715-2.1975.4123L2.93488 64.0894c-.5248.6986-.35685 1.6987.36563 2.176 11.7672 7.7756 25.6851 12.5163 40.60049 13.3819.5851.034 1.1478-.2018 1.5036-.6305L52.8822 97.4268Z" />
		</svg>
	)
}

type ActivityRowProps = {
	item: ActivityItem
	isNew: boolean
	reduceMotion: boolean
}

function ActivityRow({ item, isNew, reduceMotion }: ActivityRowProps): JSX.Element {
	let animation = ""
	if (!reduceMotion && isNew) {
		animation = "animate-in fade-in slide-in-from-bottom-2 duration-500"
	}

	if (item.kind === "assignee") {
		return (
			<div className={cn("flex items-center gap-2 text-[12px] text-[#8B8D91]", animation)}>
				<User className="h-3.5 w-3.5" />
				<span>{item.body}</span>
				<span className="text-[#5C5F66]">·</span>
				<span>{item.timeLabel}</span>
			</div>
		)
	}

	if (item.kind === "status") {
		return (
			<div className={cn("flex items-center gap-2 text-[12px] text-[#8B8D91]", animation)}>
				<div className="h-3.5 w-3.5 rounded-full border-2 border-yellow-500" />
				<span>{item.body}</span>
				<span className="text-[#5C5F66]">·</span>
				<span>{item.timeLabel}</span>
			</div>
		)
	}

	if (item.kind === "pr-link") {
		return (
			<div className={cn("flex items-center gap-2 text-[12px] text-[#8B8D91]", animation)}>
				<GitPullRequest className="h-3.5 w-3.5 text-emerald-500" />
				<span>{item.body}</span>
				<span className="text-[#5C5F66]">·</span>
				<span>{item.timeLabel}</span>
			</div>
		)
	}

	return (
		<div className={cn("flex gap-3", animation)}>
			<div
				className={cn(
					"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
					item.avatarClassName,
				)}>
				{item.avatarText}
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
					<span className="text-[13px] font-semibold text-[#F8F8F9]">{item.author}</span>
					{item.isBot && (
						<span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
							<CheckCircle2 className="h-3 w-3" />
							Agent
						</span>
					)}
					<span className="text-[11px] text-[#8B8D91]">{item.timeLabel}</span>
				</div>
				<div className="mt-1 text-[13px] leading-relaxed text-[#D1D2D3]">{item.body}</div>
			</div>
		</div>
	)
}

export type LinearIssueDemoProps = {
	className?: string
}

export function LinearIssueDemo({ className }: LinearIssueDemoProps): JSX.Element {
	const reduceMotion = usePrefersReducedMotion()
	const [stepIndex, setStepIndex] = useState(0)
	const scrollViewportRef = useRef<HTMLDivElement>(null)

	const [showAssignee, setShowAssignee] = useState(false)

	const activityItems: ActivityItem[] = useMemo(
		() => [
			{
				id: "a1",
				kind: "assignee",
				body: (
					<span>
						<span className="text-[#F8F8F9]">Jordan</span> assigned{" "}
						<span className="text-indigo-300">Roo Code</span>
					</span>
				),
				timeLabel: "2:41 PM",
			},
			{
				id: "a2",
				kind: "comment",
				author: "Roo Code",
				avatarText: "R",
				avatarClassName: "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30",
				isBot: true,
				body: <span>Analyzing issue requirements and codebase...</span>,
				timeLabel: "2:41 PM",
			},
			{
				id: "a3",
				kind: "comment",
				author: "Roo Code",
				avatarText: "R",
				avatarClassName: "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30",
				isBot: true,
				body: <span>Planning implementation: Settings component with light/dark toggle.</span>,
				timeLabel: "2:42 PM",
			},
			{
				id: "a4",
				kind: "comment",
				author: "Roo Code",
				avatarText: "R",
				avatarClassName: "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30",
				isBot: true,
				body: <span>Opening PR with theme toggle implementation...</span>,
				timeLabel: "2:44 PM",
			},
			{
				id: "a5",
				kind: "comment",
				author: "Jordan",
				avatarText: "J",
				avatarClassName: "bg-[#2B2D31] text-[#F8F8F9] ring-1 ring-white/10",
				isBot: false,
				body: (
					<span>
						<span className="text-indigo-300">@Roo Code</span> Please also add a &quot;system&quot; option
						that follows OS preference.
					</span>
				),
				timeLabel: "2:45 PM",
			},
			{
				id: "a6",
				kind: "comment",
				author: "Roo Code",
				avatarText: "R",
				avatarClassName: "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30",
				isBot: true,
				body: (
					<span>
						Got it! Adding system preference detection using{" "}
						<code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-[#F8F8F9]">
							prefers-color-scheme
						</code>
						.
					</span>
				),
				timeLabel: "2:45 PM",
			},
			{
				id: "a7",
				kind: "pr-link",
				body: (
					<span>
						<span className="text-emerald-400 hover:underline cursor-default">PR #847</span> linked:{" "}
						<span className="text-[#D1D2D3]">feat: add theme toggle with system preference</span>
					</span>
				),
				timeLabel: "2:47 PM",
			},
			{
				id: "a8",
				kind: "comment",
				author: "Roo Code",
				avatarText: "R",
				avatarClassName: "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30",
				isBot: true,
				body: (
					<div className="space-y-2">
						<div>
							PR ready for review:{" "}
							<span className="text-indigo-300 hover:underline cursor-default">#847</span>
						</div>
						<div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[12px]">
							<div className="flex items-center gap-2 text-emerald-400">
								<GitPullRequest className="h-3.5 w-3.5" />
								<span className="font-medium">feat: add theme toggle with system preference</span>
							</div>
							<div className="mt-1 text-[#8B8D91]">+142 -12 · 3 files changed · Ready for review</div>
						</div>
					</div>
				),
				timeLabel: "2:47 PM",
			},
		],
		[],
	)

	type DemoPhase =
		| { kind: "issue" }
		| { kind: "assignee" }
		| { kind: "show"; activityIndex: number }
		| { kind: "typing"; activityIndex: number }
		| { kind: "reset" }

	const phases: DemoPhase[] = useMemo(() => {
		const next: DemoPhase[] = []

		next.push({ kind: "issue" })
		next.push({ kind: "assignee" })

		for (let activityIndex = 0; activityIndex < activityItems.length; activityIndex += 1) {
			const item = activityItems[activityIndex]
			if (item?.kind === "comment") {
				next.push({ kind: "typing", activityIndex })
			}
			next.push({ kind: "show", activityIndex })
		}
		next.push({ kind: "reset" })
		return next
	}, [activityItems])

	const lastShowPhaseIndex = useMemo(() => {
		let lastIndex = -1
		for (let idx = 0; idx < phases.length; idx += 1) {
			if (phases[idx]?.kind === "show") lastIndex = idx
		}
		return lastIndex
	}, [phases])

	useEffect(() => {
		if (reduceMotion) {
			setStepIndex(lastShowPhaseIndex >= 0 ? lastShowPhaseIndex : 0)
			setShowAssignee(true)
			return
		}

		const active = phases[stepIndex] ?? phases.at(0)
		const isLastMessageShow = active?.kind === "show" && stepIndex === lastShowPhaseIndex
		const durationMs = (() => {
			const base = 2000
			if (active?.kind === "reset") return 500
			if (active?.kind === "issue") return 1500
			if (active?.kind === "assignee") return 1200
			if (active?.kind === "typing") return 800
			return isLastMessageShow ? base * 2.5 : base
		})()

		const timer = window.setTimeout(() => {
			const nextIndex = (stepIndex + 1) % phases.length
			const nextPhase = phases[nextIndex]

			if (nextPhase?.kind === "reset") {
				setShowAssignee(false)
			} else if (nextPhase?.kind === "assignee") {
				setShowAssignee(true)
			}

			setStepIndex(nextIndex)
		}, durationMs)

		return () => window.clearTimeout(timer)
	}, [lastShowPhaseIndex, phases, reduceMotion, stepIndex])

	const activePhase = phases[stepIndex] ?? phases.at(0) ?? { kind: "issue" }

	function getVisibleCount(phase: DemoPhase): number {
		if (phase.kind === "reset" || phase.kind === "issue" || phase.kind === "assignee") return 0
		if (phase.kind === "typing") return phase.activityIndex
		return phase.activityIndex + 1
	}

	const visibleCount = getVisibleCount(activePhase)
	const visibleActivities = activityItems.slice(0, visibleCount)
	const typingTarget = activePhase.kind === "typing" ? activityItems[activePhase.activityIndex] : undefined

	useEffect(() => {
		const viewport = scrollViewportRef.current
		if (!viewport) return

		if (activePhase.kind === "reset" || activePhase.kind === "issue" || visibleCount <= 1) {
			viewport.scrollTo({ top: 0, behavior: "auto" })
			return
		}

		viewport.scrollTo({
			top: viewport.scrollHeight,
			behavior: reduceMotion ? "auto" : "smooth",
		})
	}, [activePhase.kind, reduceMotion, visibleCount])

	const issueVisible = activePhase.kind !== "reset"

	return (
		<div
			className={cn("w-full max-w-[540px] h-[520px] sm:h-[560px]", className)}
			role="img"
			aria-label="Animated Linear issue showing Roo Code responding to assignment">
			<div
				aria-hidden="true"
				className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1A1D21] shadow-2xl shadow-black/30">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
					<div className="flex items-center gap-2">
						<div className="h-2.5 w-2.5 rounded-full bg-[#F24A4A]" />
						<div className="h-2.5 w-2.5 rounded-full bg-[#F2C94C]" />
						<div className="h-2.5 w-2.5 rounded-full bg-[#27AE60]" />
						<div className="ml-3 flex items-center gap-2">
							<LinearIcon className="h-4 w-4 text-[#8B8D91]" />
							<span className="text-sm font-semibold text-[#F8F8F9]">Issue</span>
						</div>
					</div>
					<div className="flex items-center gap-2 text-[11px] text-[#8B8D91]">
						<span className="h-2 w-2 rounded-full bg-[#27AE60]" />
						Live demo
					</div>
				</div>

				{/* Issue Content */}
				<div
					className={cn(
						"flex flex-col flex-1 overflow-hidden transition-opacity duration-300 will-change-opacity",
						issueVisible ? "opacity-100" : "opacity-0",
					)}>
					{/* Issue Header */}
					<div className="border-b border-white/10 px-4 py-4">
						<div className="flex items-start gap-3">
							<div className="mt-1 h-4 w-4 rounded border-2 border-indigo-500 bg-transparent" />
							<div className="flex-1 min-w-0">
								<h3 className="text-[15px] font-semibold text-[#F8F8F9] leading-tight">
									Add dark mode toggle to settings
								</h3>
								<div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
									<span className="inline-flex items-center rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-300">
										FE-312
									</span>
									<span className="inline-flex items-center rounded bg-yellow-500/20 px-2 py-0.5 text-yellow-300">
										In Progress
									</span>
									{showAssignee && (
										<span
											className={cn(
												"inline-flex items-center gap-1 rounded bg-[#2B2D31] px-2 py-0.5 text-[#D1D2D3]",
												!reduceMotion && "animate-in fade-in duration-300",
											)}>
											<span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-[8px] font-bold text-indigo-200">
												R
											</span>
											Roo Code
										</span>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Description */}
					<div className="border-b border-white/10 px-4 py-3">
						<div className="text-[12px] font-medium text-[#8B8D91] uppercase tracking-wider mb-2">
							Description
						</div>
						<div className="text-[13px] text-[#D1D2D3] leading-relaxed">
							<p className="mb-2">
								Users should be able to switch between light and dark themes from the settings page.
							</p>
							<div className="text-[12px] font-medium text-[#8B8D91] mb-1">Acceptance Criteria:</div>
							<ul className="list-disc pl-4 space-y-1 text-[13px]">
								<li>Add a toggle component in Settings → Appearance</li>
								<li>Persist preference to localStorage</li>
								<li>Apply theme change immediately without page refresh</li>
							</ul>
						</div>
					</div>

					{/* Activity Section */}
					<div className="flex-1 overflow-hidden flex flex-col">
						<div className="px-4 py-2 border-b border-white/10">
							<div className="text-[12px] font-medium text-[#8B8D91] uppercase tracking-wider">
								Activity
							</div>
						</div>
						<div
							ref={scrollViewportRef}
							className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]">
							<div className="space-y-4">
								{visibleActivities.map((item) => (
									<ActivityRow
										key={item.id}
										item={item}
										reduceMotion={reduceMotion}
										isNew={
											activePhase.kind === "show" &&
											activityItems[activePhase.activityIndex]?.id === item.id
										}
									/>
								))}

								{typingTarget && typingTarget.kind === "comment" && (
									<div
										className={cn(
											reduceMotion ? "" : "animate-in fade-in duration-300",
											"flex gap-3",
										)}>
										<div
											className={cn(
												"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
												typingTarget.avatarClassName,
											)}>
											{typingTarget.avatarText}
										</div>
										<div className="min-w-0">
											<div className="flex items-baseline gap-x-2">
												<span className="text-[13px] font-semibold text-[#F8F8F9]">
													{typingTarget.author}
												</span>
												{typingTarget.isBot && (
													<span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
														<CheckCircle2 className="h-3 w-3" />
														Agent
													</span>
												)}
												<span className="text-[11px] text-[#8B8D91]">typing…</span>
											</div>
											<div className="mt-2">
												<TypingDots />
											</div>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Footer with progress indicator */}
				<div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
					<div className="flex items-center gap-1.5">
						{activityItems.map((item, idx) => (
							<span
								key={item.id}
								className={cn(
									"h-1.5 w-4 rounded-full transition-colors duration-300",
									Math.max(0, visibleCount - 1) === idx ? "bg-indigo-300" : "bg-white/10",
								)}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
