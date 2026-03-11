"use client"

import { useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { ArrowRight, FlaskConical, Beaker } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts"

import type { EngineerRole, RoleRecommendation } from "@/lib/mock-recommendations"
import { TASKS_PER_DAY, MODEL_TIMELINE } from "@/lib/mock-recommendations"
import { EVAL_OUTCOMES, isEvalOutcomeId, type EvalOutcomeId } from "@/lib/eval-outcomes"
import { pickObjectiveDefaultModelV1 } from "@/lib/objective-default-models-v1"

// ── Outcome Layer: Optimization Modes ──────────────────────────────────────

type EvalOptimizationMode = "best" | "fastest" | "cost"

const OPTIMIZATION_MODES: Array<{
	id: EvalOptimizationMode
	label: string
	description: string
}> = [
	{ id: "best", label: "Quality", description: "Maximize pass rate and overall quality across our eval suite." },
	{ id: "fastest", label: "Speed", description: "Lower latency per task when speed matters." },
	{ id: "cost", label: "Cost", description: "Lower cost per task for high-volume work." },
]

function isEvalOptimizationMode(value: string): value is EvalOptimizationMode {
	return value === "best" || value === "fastest" || value === "cost"
}

function getModeCandidate(rec: RoleRecommendation | undefined, mode: EvalOptimizationMode) {
	if (!rec) return null
	if (mode === "fastest") return rec.speedHire ?? rec.best[0] ?? null
	if (mode === "cost") return rec.budgetHire ?? rec.best[0] ?? null
	return rec.best[0] ?? null
}

function getModeLabel(mode: EvalOptimizationMode) {
	if (mode === "fastest") return "Speed"
	if (mode === "cost") return "Cost"
	return "Quality"
}

function formatModelIdForUi(modelId: string) {
	if (modelId.startsWith("claude-opus-")) {
		const rest = modelId.replace(/^claude-opus-/, "")
		const parts = rest.split("-").filter(Boolean)
		if (parts.length >= 2) return `Opus ${parts[0]}.${parts[1]}`
		if (parts.length === 1) return `Opus ${parts[0]}`
	}
	if (modelId === "kimi-k2-0905") return "Kimi K2"
	return modelId
}

// ── Framer Motion Variants ──────────────────────────────────────────────────

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.15,
			delayChildren: 0.2,
		},
	},
}

const cardVariants = {
	hidden: { opacity: 0, y: 30 },
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.6,
			ease: [0.21, 0.45, 0.27, 0.9] as const,
		},
	},
}

const fadeUpVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.6,
			ease: [0.21, 0.45, 0.27, 0.9] as const,
		},
	},
}

const backgroundVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			duration: 1.2,
			ease: "easeOut" as const,
		},
	},
}

// ── Provider Colors ─────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
	anthropic: "#fb923c", // orange-400
	openai: "#4ade80", // green-400
	google: "#60a5fa", // blue-400
	xai: "#c084fc", // purple-400
	deepseek: "#22d3ee", // cyan-400
	moonshot: "#f472b6", // pink-400
}

const PROVIDER_DISPLAY: Record<string, string> = {
	anthropic: "Anthropic",
	openai: "OpenAI",
	google: "Google",
	xai: "xAI",
	deepseek: "DeepSeek",
	moonshot: "Moonshot",
}

// ── Timeline Tooltip ────────────────────────────────────────────────────────

function TimelineTooltip({
	active,
	payload,
}: {
	active?: boolean
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	payload?: any[]
}) {
	if (!active || !payload || !payload.length) return null

	const data = payload[0]?.payload as
		| {
				modelName?: string
				provider?: string
				score?: number
				costPerRun?: number
				dateLabel?: string
		  }
		| undefined

	if (!data) return null

	return (
		<div className="rounded-xl border border-border/50 bg-card/95 p-4 shadow-2xl backdrop-blur-md">
			<p className="mb-2.5 text-sm font-bold tracking-tight">{data.modelName}</p>
			<div className="space-y-1.5">
				<div className="flex items-center gap-2.5 text-xs">
					<span
						className="size-2.5 rounded-full ring-1 ring-white/10"
						style={{ backgroundColor: PROVIDER_COLORS[data.provider ?? ""] ?? "#94a3b8" }}
					/>
					<span className="text-muted-foreground">Provider:</span>
					<span className="font-semibold">{PROVIDER_DISPLAY[data.provider ?? ""] ?? data.provider}</span>
				</div>
				<div className="flex items-center gap-2.5 text-xs">
					<span className="size-2.5 rounded-full bg-blue-400 ring-1 ring-white/10" />
					<span className="text-muted-foreground">Release:</span>
					<span className="font-semibold">{data.dateLabel}</span>
				</div>
				<div className="flex items-center gap-2.5 text-xs">
					<span className="size-2.5 rounded-full bg-emerald-400 ring-1 ring-white/10" />
					<span className="text-muted-foreground">Eval Score:</span>
					<span className="font-semibold tabular-nums">{data.score}%</span>
				</div>
				<div className="flex items-center gap-2.5 text-xs">
					<span className="size-2.5 rounded-full bg-amber-400 ring-1 ring-white/10" />
					<span className="text-muted-foreground">Cost per Run:</span>
					<span className="font-semibold tabular-nums">${data.costPerRun?.toFixed(2)}</span>
				</div>
			</div>
		</div>
	)
}

// ── Sub-Components ──────────────────────────────────────────────────────────

// ── Main Content Component ──────────────────────────────────────────────────

type WorkersContentProps = {
	roles: EngineerRole[]
	recommendations: RoleRecommendation[]
	totalEvalRuns: number
	totalExercises: number
	totalModels: number
	lastUpdated: string | undefined
	workersRootPath?: string
	/**
	 * Base path for role detail routes, without the role id.
	 * Examples: `/evals/workers`, `/evals/recommendations/roles`.
	 */
	roleBasePath?: string
}

// Outcomes-first is canonical. Baseline/V1 is removed from the UI.
const ENABLE_OUTCOME_LAYER = true

export function WorkersContent({
	roles,
	recommendations,
	totalEvalRuns,
	totalExercises: _totalExercises,
	totalModels: _totalModels,
	lastUpdated,
	workersRootPath = "/evals/recommendations",
	roleBasePath = workersRootPath,
}: WorkersContentProps) {
	const enableOutcomeLayer = ENABLE_OUTCOME_LAYER
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()

	const selectedOutcomeId = useMemo(() => {
		const outcome = searchParams.get("outcome")
		if (!outcome) return null
		return isEvalOutcomeId(outcome) ? outcome : null
	}, [searchParams])
	const effectiveOutcomeId = useMemo(() => {
		if (selectedOutcomeId) return selectedOutcomeId
		return EVAL_OUTCOMES[0]?.id ?? null
	}, [selectedOutcomeId])

	const selectedMode = useMemo((): EvalOptimizationMode => {
		const mode = searchParams.get("mode")
		if (!mode) return "best"
		return isEvalOptimizationMode(mode) ? mode : "best"
	}, [searchParams])

	const setOutcome = useCallback(
		(nextOutcomeId: EvalOutcomeId | null) => {
			const params = new URLSearchParams(searchParams.toString())
			if (nextOutcomeId) params.set("outcome", nextOutcomeId)
			else params.delete("outcome")

			const query = params.toString()
			router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
		},
		[pathname, router, searchParams],
	)

	const setMode = useCallback(
		(nextMode: EvalOptimizationMode) => {
			const params = new URLSearchParams(searchParams.toString())
			params.set("mode", nextMode)

			const query = params.toString()
			router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
		},
		[pathname, router, searchParams],
	)

	const scrollToOutcomes = useCallback(() => {
		if (typeof document === "undefined") return
		const el = document.getElementById("outcomes")
		if (!el) return
		el.scrollIntoView({ behavior: "smooth", block: "start" })
	}, [])

	const recByRole = new Map(recommendations.map((r) => [r.roleId, r]))
	const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles])

	const selectedOutcome = useMemo(() => {
		if (!effectiveOutcomeId) return null
		return EVAL_OUTCOMES.find((o) => o.id === effectiveOutcomeId) ?? null
	}, [effectiveOutcomeId])

	const setupQuery = useMemo(() => {
		if (!effectiveOutcomeId) return ""
		const params = new URLSearchParams()
		params.set("outcome", effectiveOutcomeId)
		params.set("mode", selectedMode)
		const query = params.toString()
		return query ? `?${query}` : ""
	}, [effectiveOutcomeId, selectedMode])

	const isProfileView = useMemo(() => {
		return searchParams.get("view") === "profile"
	}, [searchParams])

	const profileDescription =
		selectedOutcome?.builderProfile?.description ??
		"A default setup built from our eval signals. It’s a baseline, not a guarantee."
	const profileHowItWorks = selectedOutcome?.builderProfile?.howItWorks ?? selectedOutcome?.whyItWorks ?? []
	const objectiveDefaultModel = useMemo(() => {
		if (!effectiveOutcomeId) return null
		return pickObjectiveDefaultModelV1(effectiveOutcomeId, selectedMode)
	}, [effectiveOutcomeId, selectedMode])
	const objectiveDefaultModelLabel = useMemo(() => {
		if (!objectiveDefaultModel?.modelId) return "—"
		return formatModelIdForUi(objectiveDefaultModel.modelId)
	}, [objectiveDefaultModel])
	const selectedModeLabel = getModeLabel(selectedMode)
	const examplePrompt = selectedOutcome?.builderProfile?.examplePrompt ?? ""
	const cloudSetupHref = useMemo(() => {
		if (!effectiveOutcomeId) return "/cloud-agents/setup"
		const params = new URLSearchParams()
		params.set("outcome", effectiveOutcomeId)
		params.set("mode", selectedMode)
		if (examplePrompt) params.set("prompt", examplePrompt)
		return `/cloud-agents/setup?${params.toString()}`
	}, [examplePrompt, selectedMode, effectiveOutcomeId])

	const profileCapabilities = useMemo(() => {
		if (!selectedOutcome) return []
		const fromProfile = selectedOutcome.builderProfile?.capabilities
		if (fromProfile && fromProfile.length > 0) return fromProfile
		return selectedOutcome.recommendedRoleIds.map((roleId) => {
			const role = roleById.get(roleId)
			return {
				id: roleId,
				name: role?.name ?? roleId,
				description: role?.salaryRange ?? "",
				roleId,
			}
		})
	}, [selectedOutcome, roleById])

	const agentCapabilities = useMemo(() => profileCapabilities.filter((c) => Boolean(c.roleId)), [profileCapabilities])

	const skillCapabilities = useMemo(() => profileCapabilities.filter((c) => !c.roleId), [profileCapabilities])

	// ── Timeline scatter data ──────────────────────────────────────────────
	const timelineData = useMemo(() => {
		const maxCost = Math.max(...MODEL_TIMELINE.map((m) => m.costPerRun))
		return MODEL_TIMELINE.map((m) => {
			const date = new Date(m.releaseDate)
			return {
				modelName: m.modelName,
				provider: m.provider,
				score: m.score,
				costPerRun: m.costPerRun,
				// numeric X for scatter: days since epoch
				dateNum: date.getTime(),
				dateLabel: date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
				// Dot size: inversely proportional to cost (cheaper = bigger dot)
				dotSize: Math.round(60 + (1 - m.costPerRun / maxCost) * 340),
			}
		}).sort((a, b) => a.dateNum - b.dateNum)
	}, [])

	// Trend line endpoints for the timeline
	const trendLine = useMemo(() => {
		if (timelineData.length < 2) return null
		const first = timelineData[0]!
		const last = timelineData[timelineData.length - 1]!
		return { x1: first.dateNum, y1: first.score, x2: last.dateNum, y2: last.score }
	}, [timelineData])

	return (
		<>
			{/* ── Hero Section ───────────────────────────────────────────── */}
			<section className="relative flex flex-col items-center overflow-hidden pt-32 pb-32">
				{/* Atmospheric blur background */}
				<motion.div
					className="absolute inset-0"
					initial="hidden"
					animate="visible"
					variants={backgroundVariants}>
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
						<div className="absolute left-[30%] top-[40%] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/8 dark:bg-emerald-600/15 blur-[120px]" />
						<div className="absolute left-[50%] top-[50%] h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/8 dark:bg-blue-600/15 blur-[140px]" />
						<div className="absolute left-[70%] top-[40%] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/6 dark:bg-amber-600/10 blur-[120px]" />
					</div>
				</motion.div>

				{/* Blueprint grid overlay */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-multiply dark:opacity-[0.10] dark:mix-blend-screen"
					style={{
						backgroundImage:
							"linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
						backgroundSize: "72px 72px",
						maskImage: "radial-gradient(circle at 50% 35%, black 10%, transparent 65%)",
						WebkitMaskImage: "radial-gradient(circle at 50% 35%, black 10%, transparent 65%)",
					}}
				/>

				{/* Gradient fade from hero atmosphere to cards */}
				<div className="absolute inset-x-0 bottom-0 z-[1] h-48 bg-gradient-to-b from-transparent via-background/60 to-background" />

				<div className="container relative z-10 mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div
						className="mx-auto max-w-6xl"
						initial="hidden"
						animate="visible"
						variants={containerVariants}>
						{enableOutcomeLayer ? (
							<div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:items-end">
								<div className="lg:col-span-12">
									<div className="text-center lg:text-left">
										{/* Badge */}
										<motion.div variants={fadeUpVariants}>
											<div className="mb-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
												<Link
													href="/evals/methodology"
													className="group inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:border-border hover:text-foreground">
													<Beaker className="size-4" />
													How we run evals
													<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
												</Link>
											</div>
										</motion.div>

										<motion.p
											className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70"
											variants={fadeUpVariants}>
											Outcomes over artifacts
										</motion.p>

										{/* Heading */}
										<motion.h1
											className="mt-6 font-semibold leading-[0.95] tracking-tight [font-family:var(--font-display)] text-[clamp(2.35rem,7.6vw,4.6rem)] md:text-6xl lg:text-7xl"
											variants={fadeUpVariants}>
											<span className="block whitespace-nowrap">You&rsquo;re the Builder</span>
											<span className="block whitespace-nowrap">
												Ship{" "}
												<span className="bg-gradient-to-r from-emerald-500 via-blue-500 to-amber-500 bg-clip-text text-transparent">
													Real Code
												</span>
											</span>
										</motion.h1>

										{/* Subheading */}
										<motion.p
											className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl lg:max-w-[58ch]"
											variants={fadeUpVariants}>
											Pick an objective. We&rsquo;ll suggest an agent lineup and default model
											based on eval results. Treat it as a baseline for your repo.
										</motion.p>

										<motion.div
											className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start"
											variants={fadeUpVariants}>
											<button
												type="button"
												onClick={scrollToOutcomes}
												className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground/20 bg-foreground/5 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/10">
												Get started with your objective
											</button>
										</motion.div>
									</div>
								</div>
							</div>
						) : null}
					</motion.div>
				</div>
			</section>

			{/* ── Outcomes Overlay ───────────────────────────────────────── */}
			{enableOutcomeLayer ? (
				<section
					id="outcomes"
					className="relative overflow-hidden border-t border-border/40 pb-28 pt-20 scroll-mt-24">
					<div className="container relative z-10 mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
						<motion.div
							className="mx-auto max-w-6xl"
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true }}
							variants={containerVariants}>
							{isProfileView ? (
								<motion.div
									className="mx-auto max-w-4xl rounded-2xl border border-border/50 bg-background/10 p-6 backdrop-blur-sm"
									variants={fadeUpVariants}>
									{selectedOutcome ? (
										<>
											<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
												<div className="min-w-0">
													<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
														Profile
													</p>
													<p className="mt-3 text-3xl font-semibold tracking-tight text-foreground [font-family:var(--font-display)]">
														{selectedOutcome.name}
													</p>
													<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
														{profileDescription}
													</p>
												</div>

												<div className="flex flex-col gap-3 sm:min-w-[320px]">
													{examplePrompt ? (
														<div className="rounded-2xl border border-border/50 bg-background/10 p-4">
															<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
																Example prompt
															</p>
															<pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border/50 bg-background/10 p-3 text-xs leading-relaxed text-foreground/85">
																{examplePrompt}
															</pre>
														</div>
													) : null}
													<Link
														href={cloudSetupHref}
														className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-foreground/20 bg-foreground/10 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/15">
														Start in Roo Code Cloud
														<ArrowRight className="size-4" />
													</Link>
													<Link
														href={`${workersRootPath}${setupQuery}#outcomes`}
														className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/10 px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-border hover:bg-background/15 hover:text-foreground">
														Back to objectives
														<ArrowRight className="size-4" />
													</Link>
												</div>
											</div>

											<div className="mt-6 overflow-hidden rounded-2xl border border-border/50 bg-background/10">
												<div className="grid grid-cols-2 divide-x divide-border/40 sm:grid-cols-4">
													<div className="p-3">
														<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
															Optimized for
														</p>
														<p className="mt-1 text-sm font-semibold text-foreground">
															{selectedModeLabel}
														</p>
													</div>
													<div className="p-3">
														<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
															Default model
														</p>
														<p className="mt-1 truncate font-mono text-sm font-semibold text-foreground">
															{objectiveDefaultModelLabel}
														</p>
													</div>
													<div className="p-3">
														<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
															Agents
														</p>
														<p className="mt-1 text-sm font-semibold text-foreground tabular-nums">
															{agentCapabilities.length}
														</p>
													</div>
													<div className="p-3">
														<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
															Skills
														</p>
														<p className="mt-1 text-sm font-semibold text-foreground tabular-nums">
															{skillCapabilities.length}
														</p>
													</div>
												</div>
											</div>

											<div className="mt-6">
												<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
													Optimize for
												</p>
												<div className="mt-2 inline-flex rounded-full border border-border/50 bg-card/30 p-1 backdrop-blur-sm">
													{OPTIMIZATION_MODES.map((mode) => {
														const isSelected = mode.id === selectedMode
														return (
															<button
																key={mode.id}
																type="button"
																aria-pressed={isSelected}
																title={mode.description}
																onClick={() => setMode(mode.id)}
																className={[
																	"rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
																	isSelected
																		? "bg-foreground/10 text-foreground"
																		: "text-muted-foreground hover:text-foreground",
																].join(" ")}>
																{mode.label}
															</button>
														)
													})}
												</div>
											</div>

											<div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
												<div className="rounded-2xl border border-border/50 bg-background/10 p-5">
													<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
														Agent lineup
													</p>
													<div className="mt-3 space-y-2">
														{agentCapabilities.map((capability) => {
															const roleId = capability.roleId!
															const rec = recByRole.get(roleId)
															const candidate = getModeCandidate(rec, selectedMode)

															const providerColor = candidate
																? (PROVIDER_COLORS[candidate.provider] ?? "#94a3b8")
																: "#94a3b8"

															return (
																<Link
																	key={capability.id}
																	href={`${roleBasePath}/${roleId}${setupQuery}`}
																	className="group flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-background/10 px-4 py-3 transition-colors hover:bg-background/20">
																	<div className="min-w-0">
																		<p className="text-sm font-semibold text-foreground">
																			{capability.name}
																		</p>
																		<p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
																			<span
																				className="size-2 rounded-full ring-1 ring-white/10"
																				style={{
																					backgroundColor: providerColor,
																				}}
																			/>
																			{candidate ? (
																				<span className="min-w-0 truncate">
																					{candidate.displayName}
																				</span>
																			) : (
																				<span className="font-medium text-foreground/80">
																					View models
																				</span>
																			)}
																		</p>
																	</div>
																	<ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" />
																</Link>
															)
														})}
													</div>
												</div>

												<div className="rounded-2xl border border-border/50 bg-background/10 p-5">
													<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
														Skills included
													</p>
													<div className="mt-3 space-y-2">
														{skillCapabilities.length > 0 ? (
															skillCapabilities.map((capability) => (
																<div
																	key={capability.id}
																	className="rounded-xl border border-border/50 bg-background/10 px-4 py-3">
																	<p className="text-sm font-semibold text-foreground">
																		{capability.name}
																	</p>
																	<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
																		{capability.description}
																	</p>
																</div>
															))
														) : (
															<p className="text-sm text-muted-foreground">
																No skills listed for this profile yet.
															</p>
														)}
													</div>
												</div>
											</div>

											{profileHowItWorks.length > 0 || selectedOutcome.whyItWorks.length > 0 ? (
												<div className="mt-8 rounded-2xl border border-border/50 bg-background/10 p-5">
													<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
														Rationale
													</p>
													<div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
														<div>
															<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
																{selectedOutcome.builderProfile
																	? "How it works"
																	: "Why it works"}
															</p>
															<ul className="mt-2 space-y-1 text-sm text-muted-foreground">
																{profileHowItWorks.map((line) => (
																	<li key={line} className="flex items-start gap-2">
																		<span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
																		<span className="min-w-0">{line}</span>
																	</li>
																))}
															</ul>
														</div>
														<div>
															<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
																Why it works
															</p>
															<ul className="mt-2 space-y-1 text-sm text-muted-foreground">
																{selectedOutcome.whyItWorks.map((line) => (
																	<li key={line} className="flex items-start gap-2">
																		<span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
																		<span className="min-w-0">{line}</span>
																	</li>
																))}
															</ul>
														</div>
													</div>
												</div>
											) : null}
										</>
									) : (
										<div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
											<div>
												<p className="text-sm font-semibold text-foreground">
													No objective selected
												</p>
												<p className="mt-1 text-sm text-muted-foreground">
													Pick an objective first, then open the profile view.
												</p>
											</div>
											<Link
												href={`${workersRootPath}#outcomes`}
												className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/10 px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-border hover:bg-background/15 hover:text-foreground">
												Back to objectives
												<ArrowRight className="size-4" />
											</Link>
										</div>
									)}
								</motion.div>
							) : null}

							<div
								className={
									isProfileView ? "hidden" : "grid grid-cols-1 gap-14 lg:grid-cols-12 lg:items-start"
								}>
								{/* Left rail: objective + mode */}
								<div className="lg:col-span-5">
									<motion.div className="text-center lg:text-left" variants={fadeUpVariants}>
										<h2 className="text-2xl font-semibold tracking-tight md:text-3xl [font-family:var(--font-display)]">
											Select your objective
										</h2>
									</motion.div>

									<motion.div
										className="mt-6 flex flex-wrap items-center justify-center gap-2 lg:justify-start"
										variants={fadeUpVariants}>
										<span className="mr-1 text-xs font-medium text-muted-foreground">
											Optimize for
										</span>
										<div className="inline-flex rounded-full border border-border/50 bg-card/30 p-1 backdrop-blur-sm">
											{OPTIMIZATION_MODES.map((mode) => {
												const isSelected = mode.id === selectedMode
												return (
													<button
														key={mode.id}
														type="button"
														aria-pressed={isSelected}
														title={mode.description}
														onClick={() => setMode(mode.id)}
														className={[
															"rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
															isSelected
																? "bg-foreground/10 text-foreground"
																: "text-muted-foreground hover:text-foreground",
														].join(" ")}>
														{mode.label}
													</button>
												)
											})}
										</div>
									</motion.div>

									<motion.div className="mt-8 space-y-2" variants={containerVariants}>
										{EVAL_OUTCOMES.map((outcome) => {
											const Icon = outcome.icon
											const isSelected = outcome.id === effectiveOutcomeId

											return (
												<motion.button
													key={outcome.id}
													type="button"
													variants={cardVariants}
													aria-pressed={isSelected}
													onClick={() => setOutcome(isSelected ? null : outcome.id)}
													className={[
														"group w-full rounded-2xl border bg-card/35 p-4 text-left backdrop-blur-sm transition-all duration-200 hover:bg-card/55",
														isSelected
															? "border-foreground/20 ring-1 ring-foreground/15"
															: "border-border/50 hover:border-border",
													].join(" ")}>
													<div className="flex items-start gap-3">
														<div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/30">
															<Icon className="size-5 text-foreground/70" />
														</div>
														<div className="min-w-0 flex-1">
															<div className="flex flex-wrap items-center gap-2">
																<p className="text-sm font-semibold text-foreground">
																	{outcome.name}
																</p>
															</div>
															<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
																{outcome.description}
															</p>
														</div>
													</div>
												</motion.button>
											)
										})}
									</motion.div>
								</div>

								{/* Right rail: profile snapshot */}
								<div className="lg:col-span-7">
									<motion.div
										className="relative overflow-hidden rounded-2xl border border-border/50 bg-background/[0.08] backdrop-blur-xl shadow-[0_24px_110px_-75px_rgba(0,0,0,0.85)] lg:sticky lg:top-24"
										variants={fadeUpVariants}>
										<div
											aria-hidden
											className="pointer-events-none absolute inset-0 opacity-[0.7]"
											style={{
												backgroundImage:
													"linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px), radial-gradient(circle at 18% 12%, rgba(59,130,246,0.16), transparent 55%), radial-gradient(circle at 82% 32%, rgba(16,185,129,0.14), transparent 55%), radial-gradient(circle at 55% 95%, rgba(245,158,11,0.10), transparent 60%)",
												backgroundSize: "96px 96px, 96px 96px, auto, auto, auto",
											}}
										/>
										<div
											aria-hidden
											className="pointer-events-none absolute -right-44 -top-44 size-[520px] rounded-full bg-foreground/[0.035] blur-3xl"
										/>

										<div className="relative">
											<div className="border-b border-border/40 px-6 pb-5 pt-6">
												<div className="flex items-start gap-4">
													<div className="min-w-0 flex-1">
														<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
															Profile snapshot
														</p>
														<p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
															{selectedOutcome
																? selectedOutcome.name
																: "Pick an objective"}
														</p>
														<p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
															{selectedOutcome
																? profileDescription
																: "Select an objective to see the suggested lineup and default model."}
														</p>
													</div>

													<div className="shrink-0">
														<span className="inline-flex items-center rounded-full border border-border/50 bg-background/20 px-3 py-1 text-xs font-semibold text-foreground/80">
															Optimized for: {selectedModeLabel}
														</span>
													</div>
												</div>

												<div className="mt-5 overflow-hidden rounded-2xl border border-border/50 bg-background/10">
													<div className="grid grid-cols-2 divide-x divide-border/40 sm:grid-cols-3">
														<div className="p-3">
															<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
																Signal
															</p>
															<p
																className="mt-1 text-sm font-semibold text-foreground tabular-nums"
																suppressHydrationWarning>
																{totalEvalRuns.toLocaleString()} runs
															</p>
														</div>
														<div className="p-3">
															<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
																Agents
															</p>
															<p className="mt-1 text-sm font-semibold text-foreground tabular-nums">
																{agentCapabilities.length}
															</p>
														</div>
														<div className="p-3">
															<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
																Default model
															</p>
															<p className="mt-1 truncate font-mono text-sm font-semibold text-foreground">
																{objectiveDefaultModelLabel}
															</p>
														</div>
													</div>
												</div>
											</div>

											<div className="px-6 py-6">
												<div className="flex flex-wrap items-end justify-between gap-4">
													<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
														Agent lineup
													</p>
													<p className="text-xs text-muted-foreground">
														Open candidates &amp; settings
													</p>
												</div>

												<div className="mt-3 overflow-hidden rounded-2xl border border-border/50 bg-background/10">
													{selectedOutcome ? (
														<div className="grid grid-cols-1 divide-y divide-border/40 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
															{agentCapabilities.map((capability) => {
																const roleId = capability.roleId!
																const rec = recByRole.get(roleId)
																const candidate = getModeCandidate(rec, selectedMode)

																const providerColor = candidate
																	? (PROVIDER_COLORS[candidate.provider] ?? "#94a3b8")
																	: "#94a3b8"

																return (
																	<Link
																		key={capability.id}
																		href={`${roleBasePath}/${roleId}${setupQuery}`}
																		className="group relative px-4 py-3 pl-5 transition-colors hover:bg-background/25">
																		<span
																			aria-hidden
																			className="absolute left-0 top-0 h-full w-0.5"
																			style={{ backgroundColor: providerColor }}
																		/>
																		<div className="flex items-start justify-between gap-3">
																			<div className="min-w-0">
																				<p className="text-sm font-semibold text-foreground">
																					{capability.name}
																				</p>
																				<p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
																					<span
																						className="size-2 rounded-full ring-1 ring-white/10"
																						style={{
																							backgroundColor:
																								providerColor,
																						}}
																					/>
																					{candidate ? (
																						<span className="min-w-0 truncate">
																							{candidate.displayName}
																						</span>
																					) : (
																						<span className="font-medium text-foreground/80">
																							View models
																						</span>
																					)}
																				</p>
																			</div>
																			<ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" />
																		</div>
																	</Link>
																)
															})}
														</div>
													) : (
														<div className="p-4">
															<p className="text-sm font-semibold text-foreground">
																No objective selected
															</p>
															<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
																Pick an objective to see the recommended agent lineup.
															</p>
														</div>
													)}
												</div>

												{selectedOutcome ? (
													<>
														{examplePrompt ? (
															<div className="mt-6 rounded-2xl border border-border/50 bg-background/10 p-4">
																<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
																	Example prompt
																</p>
																<pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border/50 bg-background/10 p-3 text-xs leading-relaxed text-foreground/85">
																	{examplePrompt}
																</pre>
															</div>
														) : null}
														<div className="mt-6 flex flex-col gap-2 sm:flex-row">
															<Link
																href={cloudSetupHref}
																className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-foreground/20 bg-foreground/10 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/15">
																Start in Roo Code Cloud
																<ArrowRight className="size-4" />
															</Link>
															<Link
																href={`/evals/recommendations/${selectedOutcome.slug}?mode=${selectedMode}`}
																className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/10 px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-border hover:bg-background/15 hover:text-foreground">
																Learn more about this profile
																<ArrowRight className="size-4" />
															</Link>
														</div>
													</>
												) : null}
											</div>
										</div>
									</motion.div>
								</div>
							</div>
						</motion.div>
					</div>
				</section>
			) : null}

			{/* ── AI Coding Capability Over Time ─────────────────────────── */}
			<section className="relative overflow-hidden border-t border-border/40 pb-28 pt-24">
				{/* Subtle atmospheric background */}
				<motion.div
					className="absolute inset-0"
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={backgroundVariants}>
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
						<div className="absolute left-1/2 top-1/2 h-[600px] w-full -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-emerald-500/5 dark:bg-emerald-600/8 blur-[120px]" />
					</div>
				</motion.div>

				<div className="container relative z-10 mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						variants={containerVariants}>
						{/* Section header */}
						<motion.div className="mb-8 text-center" variants={fadeUpVariants}>
							<h2 className="text-3xl font-semibold tracking-tight md:text-4xl [font-family:var(--font-display)]">
								AI Coding Capability{" "}
								<span className="bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent">
									Over Time
								</span>
							</h2>
							<p className="mt-3 text-base leading-relaxed text-muted-foreground md:text-lg">
								Pass rates on our eval suite by model release date. Several current models hit 100% on
								this suite.
							</p>
						</motion.div>

						{/* Chart container */}
						<motion.div
							className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm"
							variants={fadeUpVariants}>
							{/* Provider legend */}
							<div className="mb-4 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
								{Object.entries(PROVIDER_COLORS)
									.filter(([provider]) => MODEL_TIMELINE.some((m) => m.provider === provider))
									.map(([provider, color]) => (
										<div key={provider} className="flex items-center gap-1.5">
											<span
												className="size-2.5 rounded-full ring-1 ring-white/10"
												style={{ backgroundColor: color }}
											/>
											<span>{PROVIDER_DISPLAY[provider] ?? provider}</span>
										</div>
									))}
								<div className="flex items-center gap-1.5 text-muted-foreground/60">
									<span className="text-[10px]">●</span>
									<span>Bigger dot = lower cost</span>
								</div>
							</div>

							<div className="rounded-xl bg-background/30 p-2">
								<ResponsiveContainer width="100%" height={420}>
									<ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
										<XAxis
											type="number"
											dataKey="dateNum"
											name="Release Date"
											domain={["dataMin", "dataMax"]}
											tickFormatter={(v: number) => {
												const d = new Date(v)
												return d.toLocaleDateString("en-US", {
													month: "short",
													year: "2-digit",
													timeZone: "UTC",
												})
											}}
											stroke="hsl(var(--muted-foreground))"
											strokeOpacity={0.3}
											tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
											axisLine={false}
											label={{
												value: "Release Date",
												position: "insideBottom",
												offset: -10,
												style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
											}}
										/>
										<YAxis
											type="number"
											dataKey="score"
											name="Eval Score"
											domain={[85, 102]}
											tickFormatter={(v: number) => `${v}%`}
											stroke="hsl(var(--muted-foreground))"
											strokeOpacity={0.3}
											tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
											axisLine={false}
											label={{
												value: "Eval Score (%)",
												angle: -90,
												position: "insideLeft",
												offset: 10,
												style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
											}}
										/>
										<ZAxis type="number" dataKey="dotSize" range={[60, 400]} />
										{/* Trend line: dashed line from first to last */}
										{trendLine && (
											<ReferenceLine
												segment={[
													{ x: trendLine.x1, y: trendLine.y1 },
													{ x: trendLine.x2, y: trendLine.y2 },
												]}
												stroke="hsl(var(--muted-foreground))"
												strokeOpacity={0.25}
												strokeDasharray="6 4"
												strokeWidth={1.5}
											/>
										)}
										{/* 100% reference line */}
										<ReferenceLine
											y={100}
											stroke="hsl(var(--muted-foreground))"
											strokeOpacity={0.15}
											strokeDasharray="3 3"
											label={{
												value: "Perfect Score",
												position: "right",
												style: {
													fontSize: 10,
													fill: "hsl(var(--muted-foreground))",
													fillOpacity: 0.5,
												},
											}}
										/>
										<Tooltip
											content={<TimelineTooltip />}
											cursor={{
												strokeDasharray: "3 3",
												stroke: "hsl(var(--muted-foreground))",
												strokeOpacity: 0.3,
											}}
										/>
										<Scatter data={timelineData} name="Models">
											{timelineData.map((entry, index) => (
												<Cell
													key={`timeline-cell-${index}`}
													fill={PROVIDER_COLORS[entry.provider] ?? "#94a3b8"}
													fillOpacity={0.85}
													stroke={PROVIDER_COLORS[entry.provider] ?? "#94a3b8"}
													strokeWidth={1}
													strokeOpacity={0.4}
												/>
											))}
										</Scatter>
									</ScatterChart>
								</ResponsiveContainer>
							</div>
						</motion.div>
					</motion.div>
				</div>
			</section>

			{/* ── Footer / Methodology Section ───────────────────────────── */}
			<section className="relative border-t border-border/50 pb-24 pt-16">
				<div className="container mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div
						className="mx-auto max-w-2xl text-center"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						variants={containerVariants}>
						{/* Stats summary */}
						<motion.div
							className="mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
							variants={fadeUpVariants}>
							<span className="font-mono font-semibold text-foreground" suppressHydrationWarning>
								{totalEvalRuns.toLocaleString()}+
							</span>{" "}
							eval runs
							<span className="text-border">•</span>
							<span className="font-mono font-semibold text-foreground">5</span> languages
							<span className="text-border">•</span>
							Last updated:{" "}
							<span className="font-medium text-foreground/80" suppressHydrationWarning>
								{lastUpdated
									? new Date(lastUpdated).toLocaleDateString("en-US", {
											year: "numeric",
											month: "long",
											day: "numeric",
											timeZone: "UTC",
										})
									: "N/A"}
							</span>
						</motion.div>

						{/* Assumption note */}
						<motion.p className="mb-6 text-xs text-muted-foreground/60" variants={fadeUpVariants}>
							Daily costs assume ~{TASKS_PER_DAY} tasks per agent per day (~6 productive hours including
							overhead).
						</motion.p>

						{/* Links */}
						<motion.div
							className="flex flex-wrap items-center justify-center gap-4"
							variants={fadeUpVariants}>
							<Link
								href="/evals/methodology"
								className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-border hover:text-foreground">
								<Beaker className="size-3.5" />
								Our methodology
							</Link>
							<Link
								href="/evals"
								className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-border hover:text-foreground">
								<FlaskConical className="size-3.5" />
								Raw eval data
								<ArrowRight className="size-3.5" />
							</Link>
						</motion.div>
					</motion.div>
				</div>
			</section>
		</>
	)
}
