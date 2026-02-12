"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import {
	Code,
	GitBranch,
	Building2,
	Search,
	Bot,
	ArrowRight,
	ChevronDown,
	CheckCircle2,
	AlertTriangle,
	Users,
	FlaskConical,
	Beaker,
	Globe,
	TrendingUp,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts"

import type { EngineerRole, RoleRecommendation } from "@/lib/mock-recommendations"
import { TASKS_PER_DAY, MODEL_TIMELINE } from "@/lib/mock-recommendations"

// ── Icon Mapping ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
	Code,
	GitBranch,
	Building2,
	Search,
	Bot,
}

// ── Color Themes per Role ───────────────────────────────────────────────────

type RoleTheme = {
	accent: string
	accentLight: string
	accentDark: string
	iconBg: string
	iconText: string
	badgeBg: string
	badgeText: string
	borderHover: string
	shadowHover: string
	buttonBg: string
	buttonHover: string
	glowColor: string
	dotColor: string
	strengthColor: string
}

const ROLE_THEMES: Record<string, RoleTheme> = {
	junior: {
		accent: "emerald",
		accentLight: "text-emerald-600",
		accentDark: "dark:text-emerald-400",
		iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
		iconText: "text-emerald-700 dark:text-emerald-300",
		badgeBg: "bg-emerald-100 dark:bg-emerald-900/30",
		badgeText: "text-emerald-700 dark:text-emerald-300",
		borderHover: "hover:border-emerald-500/40 dark:hover:border-emerald-400/30",
		shadowHover: "hover:shadow-emerald-500/10 dark:hover:shadow-emerald-400/10",
		buttonBg: "bg-emerald-600 dark:bg-emerald-600",
		buttonHover: "hover:bg-emerald-700 dark:hover:bg-emerald-500",
		glowColor: "bg-emerald-500/8 dark:bg-emerald-600/15",
		dotColor: "bg-emerald-500",
		strengthColor: "text-emerald-600 dark:text-emerald-400",
	},
	senior: {
		accent: "blue",
		accentLight: "text-blue-600",
		accentDark: "dark:text-blue-400",
		iconBg: "bg-blue-100 dark:bg-blue-900/30",
		iconText: "text-blue-700 dark:text-blue-300",
		badgeBg: "bg-blue-100 dark:bg-blue-900/30",
		badgeText: "text-blue-700 dark:text-blue-300",
		borderHover: "hover:border-blue-500/40 dark:hover:border-blue-400/30",
		shadowHover: "hover:shadow-blue-500/10 dark:hover:shadow-blue-400/10",
		buttonBg: "bg-blue-600 dark:bg-blue-600",
		buttonHover: "hover:bg-blue-700 dark:hover:bg-blue-500",
		glowColor: "bg-blue-500/8 dark:bg-blue-600/15",
		dotColor: "bg-blue-500",
		strengthColor: "text-blue-600 dark:text-blue-400",
	},
	staff: {
		accent: "amber",
		accentLight: "text-amber-600",
		accentDark: "dark:text-amber-400",
		iconBg: "bg-amber-100 dark:bg-amber-900/30",
		iconText: "text-amber-700 dark:text-amber-300",
		badgeBg: "bg-amber-100 dark:bg-amber-900/30",
		badgeText: "text-amber-700 dark:text-amber-300",
		borderHover: "hover:border-amber-500/40 dark:hover:border-amber-400/30",
		shadowHover: "hover:shadow-amber-500/10 dark:hover:shadow-amber-400/10",
		buttonBg: "bg-amber-600 dark:bg-amber-600",
		buttonHover: "hover:bg-amber-700 dark:hover:bg-amber-500",
		glowColor: "bg-amber-500/8 dark:bg-amber-600/15",
		dotColor: "bg-amber-500",
		strengthColor: "text-amber-600 dark:text-amber-400",
	},
	reviewer: {
		accent: "violet",
		accentLight: "text-violet-600",
		accentDark: "dark:text-violet-400",
		iconBg: "bg-violet-100 dark:bg-violet-900/30",
		iconText: "text-violet-700 dark:text-violet-300",
		badgeBg: "bg-violet-100 dark:bg-violet-900/30",
		badgeText: "text-violet-700 dark:text-violet-300",
		borderHover: "hover:border-violet-500/40 dark:hover:border-violet-400/30",
		shadowHover: "hover:shadow-violet-500/10 dark:hover:shadow-violet-400/10",
		buttonBg: "bg-violet-600 dark:bg-violet-600",
		buttonHover: "hover:bg-violet-700 dark:hover:bg-violet-500",
		glowColor: "bg-violet-500/8 dark:bg-violet-600/15",
		dotColor: "bg-violet-500",
		strengthColor: "text-violet-600 dark:text-violet-400",
	},
	autonomous: {
		accent: "cyan",
		accentLight: "text-cyan-600",
		accentDark: "dark:text-cyan-400",
		iconBg: "bg-cyan-100 dark:bg-cyan-900/30",
		iconText: "text-cyan-700 dark:text-cyan-300",
		badgeBg: "bg-cyan-100 dark:bg-cyan-900/30",
		badgeText: "text-cyan-700 dark:text-cyan-300",
		borderHover: "hover:border-cyan-500/40 dark:hover:border-cyan-400/30",
		shadowHover: "hover:shadow-cyan-500/10 dark:hover:shadow-cyan-400/10",
		buttonBg: "bg-cyan-600 dark:bg-cyan-600",
		buttonHover: "hover:bg-cyan-700 dark:hover:bg-cyan-500",
		glowColor: "bg-cyan-500/8 dark:bg-cyan-600/15",
		dotColor: "bg-cyan-500",
		strengthColor: "text-cyan-600 dark:text-cyan-400",
	},
}

const DEFAULT_THEME = ROLE_THEMES.senior!

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

function StatPill({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
	return (
		<div className="flex items-center gap-2 text-sm text-muted-foreground">
			<Icon className="size-4 text-foreground/60" />
			<span className="font-mono font-semibold text-foreground">{value}</span>
			<span>{label}</span>
		</div>
	)
}

// ── Main Content Component ──────────────────────────────────────────────────

type WorkersContentProps = {
	roles: EngineerRole[]
	recommendations: RoleRecommendation[]
	totalEvalRuns: number
	totalExercises: number
	totalModels: number
	lastUpdated: string | undefined
}

export function WorkersContent({
	roles,
	recommendations,
	totalEvalRuns,
	totalExercises,
	totalModels,
	lastUpdated,
}: WorkersContentProps) {
	const recByRole = new Map(recommendations.map((r) => [r.roleId, r]))

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
				dateLabel: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
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

				{/* Gradient fade from hero atmosphere to cards */}
				<div className="absolute inset-x-0 bottom-0 z-[1] h-48 bg-gradient-to-b from-transparent via-background/60 to-background" />

				<div className="container relative z-10 mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div
						className="mx-auto max-w-3xl text-center"
						initial="hidden"
						animate="visible"
						variants={containerVariants}>
						{/* Badge */}
						<motion.div variants={fadeUpVariants}>
							<Link
								href="/evals/methodology"
								className="group mb-6 inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:border-border hover:text-foreground">
								<Beaker className="size-4" />
								How we interview AI models
								<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
							</Link>
						</motion.div>

						{/* Heading */}
						<motion.h1
							className="mt-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl"
							variants={fadeUpVariants}>
							Hire an{" "}
							<span className="bg-gradient-to-r from-emerald-500 via-blue-500 to-amber-500 bg-clip-text text-transparent">
								AI Engineer
							</span>
						</motion.h1>

						{/* Subheading */}
						<motion.p
							className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl"
							variants={fadeUpVariants}>
							Every model runs the same coding tasks, same tools, same time limit. Pick the right
							candidate for your team and budget.
						</motion.p>

						{/* Stats bar */}
						<motion.div
							className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-border/50 bg-card/30 px-6 py-4 backdrop-blur-sm"
							variants={fadeUpVariants}>
							<StatPill icon={Users} value={totalModels.toString()} label="models tested" />
							<div className="hidden h-4 w-px bg-border sm:block" />
							<StatPill icon={FlaskConical} value={totalExercises.toLocaleString()} label="exercises" />
							<div className="hidden h-4 w-px bg-border sm:block" />
							<StatPill icon={Globe} value="5" label="languages" />
							<div className="hidden h-4 w-px bg-border sm:block" />
							<StatPill icon={TrendingUp} value={totalEvalRuns.toLocaleString()} label="eval runs" />
						</motion.div>
					</motion.div>
				</div>
			</section>

			{/* ── Role Cards Grid ────────────────────────────────────────── */}
			<section className="relative -mt-12 overflow-hidden pb-24">
				{/* Subtle section background */}
				<motion.div
					className="absolute inset-0"
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={backgroundVariants}>
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
						<div className="absolute left-1/2 top-1/2 h-[800px] w-full -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-foreground/[0.02] dark:bg-foreground/[0.03] blur-[100px]" />
					</div>
				</motion.div>

				<div className="container relative z-10 mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					{/* Section connector */}
					<motion.div
						className="mb-10 flex flex-col items-center gap-2"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						variants={fadeUpVariants}>
						<p className="text-sm font-medium uppercase tracking-widest text-muted-foreground/70">
							Choose your agentic team member
						</p>
						<ChevronDown className="size-4 text-muted-foreground/40" />
					</motion.div>

					<motion.div
						className="grid grid-cols-1 gap-6 md:grid-cols-3 md:grid-rows-[repeat(7,auto)] md:gap-x-6 md:gap-y-0 lg:gap-x-8"
						variants={containerVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}>
						{roles.map((role) => {
							const rec = recByRole.get(role.id)
							const IconComponent = ICON_MAP[role.icon] ?? Code
							const candidateCount = rec?.allCandidates.length ?? 0
							const exerciseCount = rec?.totalExercises ?? 0
							const theme = ROLE_THEMES[role.id] ?? DEFAULT_THEME
							const topModel = rec?.best[0]

							return (
								<motion.div
									key={role.id}
									variants={cardVariants}
									className="md:row-span-7 md:grid md:grid-rows-subgrid">
									<div
										className={`group relative flex h-full flex-col rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 md:row-span-7 md:grid md:grid-rows-subgrid ${theme.borderHover} ${theme.shadowHover} hover:shadow-xl`}>
										{/* Subtle glow on hover */}
										<div
											className={`absolute inset-0 rounded-2xl ${theme.glowColor} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
										/>

										<div className="relative z-10 flex h-full flex-col p-6 lg:p-7 md:row-span-7 md:grid md:grid-rows-subgrid">
											{/* Header: Icon + role badge */}
											<div className="flex items-start justify-between">
												<div
													className={`flex size-12 items-center justify-center rounded-xl ${theme.iconBg} ${theme.iconText}`}>
													<IconComponent className="size-6" />
												</div>
												{topModel && (
													<span
														className={`rounded-full ${theme.badgeBg} ${theme.badgeText} px-3 py-1 text-xs font-medium`}>
														Top: {topModel.displayName}
													</span>
												)}
											</div>

											{/* Role name + salary */}
											<h2 className="mt-5 text-2xl font-bold tracking-tight">{role.name}</h2>
											<p
												className={`mt-1 font-mono text-lg font-semibold ${theme.accentLight} ${theme.accentDark}`}>
												{role.salaryRange}
											</p>

											{/* Description */}
											<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
												{role.description}
											</p>

											{/* Best for */}
											<div className="mt-5">
												<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
													Best for
												</h3>
												<div className="mt-2 flex flex-wrap gap-1.5">
													{role.bestFor.map((item) => (
														<span
															key={item}
															className="rounded-md border border-border/50 bg-muted/50 px-2 py-0.5 text-xs text-foreground/70">
															{item}
														</span>
													))}
												</div>
											</div>

											{/* Strengths & Weaknesses side by side */}
											<div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
												{/* Strengths */}
												<div>
													<h3
														className={`text-xs font-semibold uppercase tracking-wider ${theme.strengthColor}`}>
														Strengths
													</h3>
													<ul className="mt-2 space-y-1.5">
														{role.strengths.map((item) => (
															<li
																key={item}
																className="flex items-start gap-1.5 text-xs text-foreground/75">
																<CheckCircle2
																	className={`mt-0.5 size-3 shrink-0 ${theme.strengthColor}`}
																/>
																{item}
															</li>
														))}
													</ul>
												</div>

												{/* Weaknesses */}
												<div>
													<h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
														Trade-offs
													</h3>
													<ul className="mt-2 space-y-1.5">
														{role.weaknesses.map((item) => (
															<li
																key={item}
																className="flex items-start gap-1.5 text-xs text-foreground/60">
																<AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-600/70 dark:text-amber-400/70" />
																{item}
															</li>
														))}
													</ul>
												</div>
											</div>

											{/* Bottom stats + CTA */}
											<div className="mt-auto pt-6">
												<div className="mb-4 flex items-center gap-4 border-t border-border/30 pt-4 text-xs text-muted-foreground">
													<span className="inline-flex items-center gap-1.5">
														<Users className="size-3.5" />
														{candidateCount} candidates
													</span>
													<span className="inline-flex items-center gap-1.5">
														<FlaskConical className="size-3.5" />
														{exerciseCount.toLocaleString()} exercises
													</span>
												</div>

												<Link
													href={`/evals/workers/${role.id}`}
													className={`inline-flex w-full items-center justify-center gap-2 rounded-xl ${theme.buttonBg} ${theme.buttonHover} px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`}>
													View Candidates
													<ArrowRight className="size-4" />
												</Link>
											</div>
										</div>
									</div>
								</motion.div>
							)
						})}
					</motion.div>
				</div>
			</section>

			{/* ── AI Coding Capability Over Time ─────────────────────────── */}
			<section className="relative overflow-hidden pb-24 pt-8">
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
							<h2 className="text-3xl font-bold tracking-tight md:text-4xl">
								AI Coding Capability{" "}
								<span className="bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent">
									Over Time
								</span>
							</h2>
							<p className="mt-3 text-base leading-relaxed text-muted-foreground md:text-lg">
								Pass rates on our eval suite, by model release date. The best ones now score 100%.
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
							<span className="font-mono font-semibold text-foreground">
								{totalEvalRuns.toLocaleString()}+
							</span>{" "}
							eval runs
							<span className="text-border">•</span>
							<span className="font-mono font-semibold text-foreground">5</span> languages
							<span className="text-border">•</span>
							Last updated:{" "}
							<span className="font-medium text-foreground/80">
								{lastUpdated
									? new Date(lastUpdated).toLocaleDateString("en-US", {
											year: "numeric",
											month: "long",
											day: "numeric",
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
