"use client"

import { motion } from "framer-motion"
import {
	Code,
	GitBranch,
	Building2,
	Search,
	Bot,
	ArrowRight,
	ArrowLeft,
	Trophy,
	DollarSign,
	Zap,
	ExternalLink,
	CheckCircle2,
	AlertTriangle,
	FlaskConical,
	BarChart3,
	Beaker,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"

import type { ModelCandidate, LanguageScores, EngineerRole } from "@/lib/mock-recommendations"

import { CopySettingsButton } from "./copy-settings-button"

// ── Icon Mapping ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
	Code,
	GitBranch,
	Building2,
	Search,
	Bot,
}

// ── Role Color Themes ───────────────────────────────────────────────────────

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
	gradientFrom: string
	gradientVia: string
	ringColor: string
	scoreText: string
	scoreBg: string
	blurBg1: string
	blurBg2: string
	methodologyBorder: string
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
		gradientFrom: "from-emerald-500",
		gradientVia: "via-emerald-400",
		ringColor: "ring-emerald-500/30",
		scoreText: "text-emerald-400",
		scoreBg: "bg-emerald-500/10 border-emerald-500/20",
		blurBg1: "bg-emerald-500/10 dark:bg-emerald-600/20",
		blurBg2: "bg-emerald-400/5 dark:bg-emerald-500/10",
		methodologyBorder: "border-emerald-500/30 hover:border-emerald-500/50",
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
		gradientFrom: "from-blue-500",
		gradientVia: "via-blue-400",
		ringColor: "ring-blue-500/30",
		scoreText: "text-blue-400",
		scoreBg: "bg-blue-500/10 border-blue-500/20",
		blurBg1: "bg-blue-500/10 dark:bg-blue-600/20",
		blurBg2: "bg-blue-400/5 dark:bg-blue-500/10",
		methodologyBorder: "border-blue-500/30 hover:border-blue-500/50",
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
		gradientFrom: "from-amber-500",
		gradientVia: "via-amber-400",
		ringColor: "ring-amber-500/30",
		scoreText: "text-amber-400",
		scoreBg: "bg-amber-500/10 border-amber-500/20",
		blurBg1: "bg-amber-500/10 dark:bg-amber-600/20",
		blurBg2: "bg-amber-400/5 dark:bg-amber-500/10",
		methodologyBorder: "border-amber-500/30 hover:border-amber-500/50",
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
		gradientFrom: "from-violet-500",
		gradientVia: "via-violet-400",
		ringColor: "ring-violet-500/30",
		scoreText: "text-violet-400",
		scoreBg: "bg-violet-500/10 border-violet-500/20",
		blurBg1: "bg-violet-500/10 dark:bg-violet-600/20",
		blurBg2: "bg-violet-400/5 dark:bg-violet-500/10",
		methodologyBorder: "border-violet-500/30 hover:border-violet-500/50",
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
		gradientFrom: "from-cyan-500",
		gradientVia: "via-cyan-400",
		ringColor: "ring-cyan-500/30",
		scoreText: "text-cyan-400",
		scoreBg: "bg-cyan-500/10 border-cyan-500/20",
		blurBg1: "bg-cyan-500/10 dark:bg-cyan-600/20",
		blurBg2: "bg-cyan-400/5 dark:bg-cyan-500/10",
		methodologyBorder: "border-cyan-500/30 hover:border-cyan-500/50",
	},
}

const DEFAULT_THEME = ROLE_THEMES.senior!

// ── Framer Motion Variants ──────────────────────────────────────────────────

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.12,
			delayChildren: 0.1,
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

const tableRowVariants = {
	hidden: { opacity: 0, x: -10 },
	visible: {
		opacity: 1,
		x: 0,
		transition: {
			duration: 0.4,
			ease: [0.21, 0.45, 0.27, 0.9] as const,
		},
	},
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function scoreBadgeColor(score: number): string {
	if (score >= 85) return "bg-green-500/10 text-green-400 border border-green-500/20"
	if (score >= 70) return "bg-blue-500/10 text-blue-400 border border-blue-500/20"
	if (score >= 50) return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
	return "bg-red-500/10 text-red-400 border border-red-500/20"
}

function tierBadge(tier: ModelCandidate["tier"]): { label: string; className: string } {
	switch (tier) {
		case "best":
			return {
				label: "Best",
				className: "bg-green-500/10 text-green-400 border border-green-500/20",
			}
		case "recommended":
			return {
				label: "Recommended",
				className: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
			}
		case "situational":
			return {
				label: "Situational",
				className: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
			}
		case "not-recommended":
			return {
				label: "Not Recommended",
				className: "bg-red-500/10 text-red-400 border border-red-500/20",
			}
	}
}

const RANK_BADGES = ["🥇", "🥈", "🥉"]

const LANGUAGE_CONFIG: { key: keyof LanguageScores; label: string; color: string; bgColor: string }[] = [
	{ key: "python", label: "Python", color: "bg-green-500", bgColor: "bg-green-500/20" },
	{ key: "javascript", label: "JS", color: "bg-yellow-500", bgColor: "bg-yellow-500/20" },
	{ key: "java", label: "Java", color: "bg-orange-500", bgColor: "bg-orange-500/20" },
	{ key: "go", label: "Go", color: "bg-cyan-500", bgColor: "bg-cyan-500/20" },
	{ key: "rust", label: "Rust", color: "bg-red-500", bgColor: "bg-red-500/20" },
]

function settingsLabel(candidate: ModelCandidate): string {
	const parts = [`temp=${candidate.settings.temperature}`]
	if (candidate.settings.reasoningEffort) {
		parts.push(`reasoning=${candidate.settings.reasoningEffort}`)
	}
	return parts.join(", ")
}

// ── Language Score Bars ─────────────────────────────────────────────────────

function LanguageBars({ scores }: { scores: LanguageScores }) {
	return (
		<div className="space-y-2">
			{LANGUAGE_CONFIG.map(({ key, label, color, bgColor }) => {
				const value = scores[key]
				return (
					<div key={key} className="flex items-center gap-3">
						<span className="w-14 text-xs font-medium text-muted-foreground">{label}</span>
						<div className="flex-1">
							<div className={`h-2 w-full rounded-full ${bgColor}`}>
								<motion.div
									className={`h-full rounded-full ${color}`}
									initial={{ width: 0 }}
									whileInView={{ width: `${value}%` }}
									viewport={{ once: true }}
									transition={{ duration: 0.8, ease: [0.21, 0.45, 0.27, 0.9], delay: 0.2 }}
								/>
							</div>
						</div>
						<span className="w-8 text-right font-mono text-xs font-bold text-foreground/80">{value}</span>
					</div>
				)
			})}
		</div>
	)
}

// ── Composite Score Ring ────────────────────────────────────────────────────

function ScoreRing({ score, theme }: { score: number; theme: RoleTheme }) {
	const circumference = 2 * Math.PI * 40
	const strokeDashoffset = circumference - (score / 100) * circumference

	return (
		<div className="relative flex items-center justify-center">
			<svg className="size-24 -rotate-90" viewBox="0 0 100 100">
				<circle
					cx="50"
					cy="50"
					r="40"
					fill="none"
					stroke="currentColor"
					strokeWidth="6"
					className="text-muted/30"
				/>
				<motion.circle
					cx="50"
					cy="50"
					r="40"
					fill="none"
					strokeWidth="6"
					strokeLinecap="round"
					className={theme.scoreText}
					stroke="currentColor"
					initial={{ strokeDashoffset: circumference }}
					whileInView={{ strokeDashoffset }}
					viewport={{ once: true }}
					transition={{ duration: 1.2, ease: [0.21, 0.45, 0.27, 0.9], delay: 0.3 }}
					style={{ strokeDasharray: circumference }}
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				<span className="text-2xl font-bold tabular-nums">{score}</span>
			</div>
		</div>
	)
}

// ── Candidate Card ──────────────────────────────────────────────────────────

function CandidateCard({
	candidate,
	rank,
	theme,
	cloudUrl,
	highlight,
}: {
	candidate: ModelCandidate
	rank?: number
	theme: RoleTheme
	cloudUrl: string
	highlight?: "cost" | "speed"
}) {
	const tier = tierBadge(candidate.tier)
	const copySettings = {
		provider: candidate.provider,
		model: candidate.modelId,
		temperature: candidate.settings.temperature,
		...(candidate.settings.reasoningEffort ? { reasoningEffort: candidate.settings.reasoningEffort } : {}),
	}

	return (
		<motion.div
			variants={cardVariants}
			className={`group relative flex h-full flex-col rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 ${theme.borderHover} ${theme.shadowHover} hover:shadow-xl overflow-hidden`}>
			{/* Subtle glow on hover */}
			<div
				className={`absolute inset-0 rounded-2xl ${theme.glowColor} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
			/>

			<div className="relative z-10 flex flex-1 flex-col p-6">
				{/* Rank badge */}
				{rank !== undefined && rank < 3 && (
					<div className="absolute -right-1 -top-1 flex size-10 items-center justify-center rounded-bl-xl rounded-tr-2xl bg-card/80 text-xl backdrop-blur-sm border-b border-l border-border/50">
						{RANK_BADGES[rank]}
					</div>
				)}

				{/* Provider label */}
				<p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
					{candidate.provider}
				</p>

				{/* Model name */}
				<h3 className="mt-1 text-xl font-bold tracking-tight">{candidate.displayName}</h3>

				{/* Tier pill */}
				<div className="mt-2">
					<span
						className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tier.className}`}>
						{tier.label}
					</span>
				</div>

				{/* Score ring */}
				<div className="my-5 flex justify-center">
					<ScoreRing score={candidate.compositeScore} theme={theme} />
				</div>

				{/* Key metrics grid */}
				<div className="mb-5 grid grid-cols-3 gap-2">
					<div
						className={`rounded-xl p-2.5 text-center transition-all ${
							highlight === "cost" ? "bg-green-500/10 ring-1 ring-green-500/30" : "bg-muted/30"
						}`}>
						<p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Success</p>
						<p className="mt-0.5 text-base font-bold tabular-nums">{candidate.successRate}%</p>
					</div>
					<div
						className={`rounded-xl p-2.5 text-center transition-all ${
							highlight === "cost" ? "bg-green-500/10 ring-1 ring-green-500/30" : "bg-muted/30"
						}`}>
						<p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
							Daily Cost
						</p>
						<p className="mt-0.5 text-base font-bold tabular-nums">
							~${Math.round(candidate.estimatedDailyCost)}/day
						</p>
						<p className="text-[9px] text-muted-foreground/70 tabular-nums">
							(${candidate.avgCostPerTask.toFixed(3)}/task)
						</p>
					</div>
					<div
						className={`rounded-xl p-2.5 text-center transition-all ${
							highlight === "speed" ? "bg-blue-500/10 ring-1 ring-blue-500/30" : "bg-muted/30"
						}`}>
						<p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Avg Time</p>
						<p className="mt-0.5 text-base font-bold tabular-nums">
							{candidate.avgTimePerTask.toFixed(1)}s
						</p>
					</div>
				</div>

				{/* Per-language breakdown */}
				<div className="mb-5">
					<h4 className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
						Language Scores
					</h4>
					<LanguageBars scores={candidate.languageScores} />
				</div>

				{/* Recommended settings */}
				<div className="mb-4 rounded-lg bg-muted/20 px-3 py-2 text-center">
					<span className="font-mono text-[11px] text-muted-foreground">{settingsLabel(candidate)}</span>
				</div>

				{/* Caveats */}
				{candidate.caveats && candidate.caveats.length > 0 && (
					<div className="mb-4 space-y-1.5">
						{candidate.caveats.map((caveat) => (
							<p key={caveat} className="flex items-start gap-2 text-xs text-amber-500/80">
								<AlertTriangle className="mt-0.5 size-3 shrink-0" />
								{caveat}
							</p>
						))}
					</div>
				)}

				{/* CTAs */}
				<div className="mt-auto flex flex-col gap-2.5">
					<a
						href={cloudUrl}
						target="_blank"
						rel="noopener noreferrer"
						className={`inline-flex w-full items-center justify-center gap-2 rounded-xl ${theme.buttonBg} ${theme.buttonHover} px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg`}>
						☁️ Hire This Engineer
						<ExternalLink className="size-3.5" />
					</a>
					<CopySettingsButton settings={copySettings} />
				</div>
			</div>
		</motion.div>
	)
}

// ── Compact Card (Budget / Speed) ───────────────────────────────────────────

function CompactCard({
	candidate,
	label,
	icon: IconComp,
	highlight,
	theme,
	cloudUrl,
}: {
	candidate: ModelCandidate
	label: string
	icon: LucideIcon
	highlight: "cost" | "speed"
	theme: RoleTheme
	cloudUrl: string
}) {
	const tier = tierBadge(candidate.tier)
	const copySettings = {
		provider: candidate.provider,
		model: candidate.modelId,
		temperature: candidate.settings.temperature,
		...(candidate.settings.reasoningEffort ? { reasoningEffort: candidate.settings.reasoningEffort } : {}),
	}

	return (
		<motion.div
			variants={cardVariants}
			className={`group relative flex flex-col rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 ${theme.borderHover} ${theme.shadowHover} hover:shadow-xl overflow-hidden`}>
			{/* Subtle glow on hover */}
			<div
				className={`absolute inset-0 rounded-2xl ${theme.glowColor} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
			/>

			<div className="relative z-10 flex flex-col p-6">
				{/* Label header */}
				<div className="mb-4 flex items-center gap-2.5">
					<div
						className={`flex size-8 items-center justify-center rounded-lg ${highlight === "cost" ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"}`}>
						<IconComp className="size-4" />
					</div>
					<h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{label}</h3>
				</div>

				<div className="flex items-start gap-5">
					{/* Left: model info + score */}
					<div className="flex-1">
						<p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
							{candidate.provider}
						</p>
						<p className="mt-0.5 text-lg font-bold tracking-tight">{candidate.displayName}</p>

						{/* Score + tier */}
						<div className="mt-2 flex items-center gap-3">
							<span className="text-3xl font-bold tabular-nums">{candidate.compositeScore}</span>
							<span
								className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tier.className}`}>
								{tier.label}
							</span>
						</div>
					</div>

					{/* Right: highlighted metric */}
					<div
						className={`flex flex-col items-center rounded-xl p-4 ${
							highlight === "cost"
								? "bg-green-500/10 ring-1 ring-green-500/30"
								: "bg-blue-500/10 ring-1 ring-blue-500/30"
						}`}>
						<p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
							{highlight === "cost" ? "Daily Cost" : "Avg Time"}
						</p>
						<p className="mt-1 text-2xl font-bold tabular-nums">
							{highlight === "cost"
								? `~$${Math.round(candidate.estimatedDailyCost)}/day`
								: `${candidate.avgTimePerTask.toFixed(1)}s`}
						</p>
						{highlight === "cost" && (
							<p className="text-[9px] text-muted-foreground/70 tabular-nums">
								(${candidate.avgCostPerTask.toFixed(3)}/task)
							</p>
						)}
					</div>
				</div>

				{/* Metrics row */}
				<div className="mt-4 grid grid-cols-3 gap-2">
					<div className="rounded-lg bg-muted/20 p-2 text-center">
						<p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Success</p>
						<p className="mt-0.5 text-sm font-bold tabular-nums">{candidate.successRate}%</p>
					</div>
					<div className="rounded-lg bg-muted/20 p-2 text-center">
						<p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
							Daily Cost
						</p>
						<p className="mt-0.5 text-sm font-bold tabular-nums">
							~${Math.round(candidate.estimatedDailyCost)}
						</p>
						<p className="text-[9px] text-muted-foreground/70 tabular-nums">
							(${candidate.avgCostPerTask.toFixed(3)}/task)
						</p>
					</div>
					<div className="rounded-lg bg-muted/20 p-2 text-center">
						<p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Time</p>
						<p className="mt-0.5 text-sm font-bold tabular-nums">{candidate.avgTimePerTask.toFixed(1)}s</p>
					</div>
				</div>

				{/* Language bars */}
				<div className="mt-4">
					<LanguageBars scores={candidate.languageScores} />
				</div>

				{/* Settings */}
				<div className="mt-3 rounded-lg bg-muted/20 px-3 py-1.5 text-center">
					<span className="font-mono text-[11px] text-muted-foreground">{settingsLabel(candidate)}</span>
				</div>

				{/* CTAs */}
				<div className="mt-4 flex flex-col gap-2.5">
					<a
						href={cloudUrl}
						target="_blank"
						rel="noopener noreferrer"
						className={`inline-flex w-full items-center justify-center gap-2 rounded-xl ${theme.buttonBg} ${theme.buttonHover} px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg`}>
						☁️ Hire This Engineer
						<ExternalLink className="size-3.5" />
					</a>
					<CopySettingsButton settings={copySettings} />
				</div>
			</div>
		</motion.div>
	)
}

// ── Props ───────────────────────────────────────────────────────────────────

export type CandidatesContentProps = {
	roleId: string
	role: EngineerRole
	best: ModelCandidate[]
	budgetHire: ModelCandidate | null
	speedHire: ModelCandidate | null
	allCandidates: ModelCandidate[]
	totalEvalRuns: number
	totalExercises: number
	lastUpdated: string
	cloudUrls: Record<string, string>
}

// ── Main Content Component ──────────────────────────────────────────────────

export function CandidatesContent({
	roleId,
	role,
	best,
	budgetHire,
	speedHire,
	allCandidates,
	totalEvalRuns,
	totalExercises,
	lastUpdated,
	cloudUrls,
}: CandidatesContentProps) {
	const theme = ROLE_THEMES[roleId] ?? DEFAULT_THEME
	const IconComponent = ICON_MAP[role.icon] ?? Code

	return (
		<>
			{/* ── Role Header ────────────────────────────────────────────── */}
			<section className="relative overflow-hidden pt-24 pb-10">
				{/* Atmospheric blur gradient background */}
				<motion.div
					className="absolute inset-0"
					initial="hidden"
					animate="visible"
					variants={backgroundVariants}>
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1400px] -translate-x-1/2">
						<div
							className={`absolute left-[40%] top-[30%] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full ${theme.blurBg1} blur-[120px]`}
						/>
						<div
							className={`absolute left-[60%] top-[60%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full ${theme.blurBg2} blur-[140px]`}
						/>
						<div className="absolute left-[20%] top-[70%] h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/[0.02] dark:bg-foreground/[0.03] blur-[100px]" />
					</div>
				</motion.div>

				<div className="container relative z-10 mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div initial="hidden" animate="visible" variants={containerVariants}>
						{/* Breadcrumb */}
						<motion.nav
							className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"
							variants={fadeUpVariants}>
							<Link href="/evals" className="transition-colors hover:text-foreground">
								Evals
							</Link>
							<span className="text-border">/</span>
							<Link href="/evals/workers" className="transition-colors hover:text-foreground">
								Hire an AI Engineer
							</Link>
							<span className="text-border">/</span>
							<span className="font-medium text-foreground">{role.name}</span>
						</motion.nav>

						{/* Icon + Title row */}
						<motion.div className="flex items-start gap-5" variants={fadeUpVariants}>
							<div
								className={`flex size-16 shrink-0 items-center justify-center rounded-2xl ${theme.iconBg} ${theme.iconText} shadow-lg`}>
								<IconComponent className="size-8" />
							</div>
							<div className="flex-1">
								<h1 className="text-4xl font-bold tracking-tight md:text-5xl">{role.name}</h1>
								<span
									className={`mt-1 inline-block font-mono text-base font-semibold ${theme.accentLight} ${theme.accentDark}`}>
									{role.salaryRange}
								</span>
								<p className="mt-2 text-base leading-relaxed text-muted-foreground md:text-lg">
									{role.description}
								</p>
							</div>
						</motion.div>

						{/* Stats bar */}
						<motion.div
							className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border/30 bg-card/30 px-5 py-3 backdrop-blur-sm"
							variants={fadeUpVariants}>
							<span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
								<FlaskConical className="size-4 text-foreground/60" />
								<span className="font-mono font-semibold text-foreground">
									{totalEvalRuns.toLocaleString()}
								</span>
								eval runs
							</span>
							<div className="hidden h-4 w-px bg-border sm:block" />
							<span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
								<BarChart3 className="size-4 text-foreground/60" />
								<span className="font-mono font-semibold text-foreground">
									{totalExercises.toLocaleString()}
								</span>
								exercises
							</span>
							<div className="hidden h-4 w-px bg-border sm:block" />
							<span className="text-sm text-muted-foreground">
								Updated{" "}
								<span className="font-medium text-foreground/80">
									{new Date(lastUpdated).toLocaleDateString("en-US", {
										month: "short",
										day: "numeric",
										year: "numeric",
									})}
								</span>
							</span>
							<div className="hidden h-4 w-px bg-border sm:block" />
							<Link
								href="/evals/methodology"
								className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
								<Beaker className="size-3.5" />
								How we interview
								<ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
							</Link>
						</motion.div>

						{/* Strengths + Trade-offs grid */}
						<motion.div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2" variants={fadeUpVariants}>
							<div className="space-y-2">
								<h4
									className={`text-[11px] font-bold uppercase tracking-wider ${theme.accentLight} ${theme.accentDark}`}>
									Strengths
								</h4>
								{role.strengths.map((s) => (
									<div
										key={s}
										className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400">
										<CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
										<span>{s}</span>
									</div>
								))}
							</div>
							<div className="space-y-2">
								<h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
									Trade-offs
								</h4>
								{role.weaknesses.map((w) => (
									<div
										key={w}
										className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
										<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
										<span>{w}</span>
									</div>
								))}
							</div>
						</motion.div>
					</motion.div>
				</div>
			</section>

			{/* ── Top Candidates: Best Overall ────────────────────────────── */}
			<section className="relative overflow-hidden pb-16">
				<div className="container relative z-10 mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						variants={containerVariants}>
						<motion.h2
							className="mb-8 flex items-center gap-3 text-3xl font-bold tracking-tight"
							variants={fadeUpVariants}>
							<Trophy className="size-7 text-yellow-500" />
							Top Candidates
						</motion.h2>

						<motion.div className="grid grid-cols-1 gap-6 md:grid-cols-3" variants={containerVariants}>
							{best.map((candidate, i) => (
								<CandidateCard
									key={candidate.modelId}
									candidate={candidate}
									rank={i}
									theme={theme}
									cloudUrl={cloudUrls[candidate.modelId] ?? "#"}
								/>
							))}
						</motion.div>
					</motion.div>
				</div>
			</section>

			{/* ── Budget & Speed Hire ─────────────────────────────────────── */}
			{(budgetHire || speedHire) && (
				<section className="relative overflow-hidden pb-16">
					<div className="container relative z-10 mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
						<motion.div
							className="grid grid-cols-1 gap-6 md:grid-cols-2"
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true }}
							variants={containerVariants}>
							{budgetHire && (
								<CompactCard
									candidate={budgetHire}
									label="💰 Budget Hire"
									icon={DollarSign}
									highlight="cost"
									theme={theme}
									cloudUrl={cloudUrls[budgetHire.modelId] ?? "#"}
								/>
							)}
							{speedHire && (
								<CompactCard
									candidate={speedHire}
									label="⚡ Speed Hire"
									icon={Zap}
									highlight="speed"
									theme={theme}
									cloudUrl={cloudUrls[speedHire.modelId] ?? "#"}
								/>
							)}
						</motion.div>
					</div>
				</section>
			)}

			{/* ── All Candidates Table ────────────────────────────────────── */}
			<section className="relative overflow-hidden pb-16">
				{/* Subtle background */}
				<motion.div
					className="absolute inset-0"
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={backgroundVariants}>
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
						<div className="absolute left-1/2 top-1/2 h-[600px] w-full -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-foreground/[0.01] dark:bg-foreground/[0.02] blur-[100px]" />
					</div>
				</motion.div>

				<div className="container relative z-10 mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						variants={containerVariants}>
						<motion.h2 className="mb-8 text-3xl font-bold tracking-tight" variants={fadeUpVariants}>
							All Candidates
						</motion.h2>

						<motion.div
							className="overflow-x-auto rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm"
							variants={fadeUpVariants}>
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-border/50">
										<th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
											#
										</th>
										<th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Model
										</th>
										<th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Provider
										</th>
										<th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Score
										</th>
										<th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Tier
										</th>
										<th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Success
										</th>
										<th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Daily Cost
										</th>
										<th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Time
										</th>
									</tr>
								</thead>
								<motion.tbody variants={containerVariants}>
									{allCandidates.map((candidate, i) => {
										const tier = tierBadge(candidate.tier)
										return (
											<motion.tr
												key={candidate.modelId}
												variants={tableRowVariants}
												className="border-b border-border/30 transition-colors hover:bg-muted/10">
												<td className="px-5 py-4 font-mono font-medium tabular-nums text-muted-foreground">
													{i + 1}
												</td>
												<td className="px-5 py-4 font-semibold">{candidate.displayName}</td>
												<td className="px-5 py-4 text-muted-foreground">
													{candidate.provider}
												</td>
												<td className="px-5 py-4 text-right">
													<span
														className={`inline-block rounded-md px-2.5 py-1 text-xs font-bold tabular-nums ${scoreBadgeColor(candidate.compositeScore)}`}>
														{candidate.compositeScore}
													</span>
												</td>
												<td className="px-5 py-4 text-center">
													<span
														className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${tier.className}`}>
														{tier.label}
													</span>
												</td>
												<td className="px-5 py-4 text-right font-mono tabular-nums">
													{candidate.successRate}%
												</td>
												<td className="px-5 py-4 text-right font-mono tabular-nums">
													<span>~${Math.round(candidate.estimatedDailyCost)}</span>
													<span className="ml-1 text-[10px] text-muted-foreground">
														(${candidate.avgCostPerTask.toFixed(3)})
													</span>
												</td>
												<td className="px-5 py-4 text-right font-mono tabular-nums">
													{candidate.avgTimePerTask.toFixed(1)}s
												</td>
											</motion.tr>
										)
									})}
								</motion.tbody>
							</table>
						</motion.div>

						{/* Compare link */}
						<motion.div className="mt-6 text-center" variants={fadeUpVariants}>
							<Link
								href={`/evals/workers/${roleId}/compare`}
								className={`group inline-flex items-center gap-2 rounded-full border ${theme.methodologyBorder} bg-card/50 px-5 py-2.5 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:text-foreground`}>
								📊 Compare all candidates
								<ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
							</Link>
						</motion.div>
					</motion.div>
				</div>
			</section>

			{/* ── Bottom Navigation ───────────────────────────────────────── */}
			<section className="relative border-t border-border/50 pb-20 pt-12">
				<div className="container mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div
						className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						variants={containerVariants}>
						<motion.div variants={fadeUpVariants}>
							<Link
								href="/evals/workers"
								className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-border hover:text-foreground">
								<ArrowLeft className="size-4" />
								Back to all roles
							</Link>
						</motion.div>
						<motion.div className="flex flex-wrap gap-3" variants={fadeUpVariants}>
							<Link
								href={`/evals/workers/${roleId}/compare`}
								className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-border hover:text-foreground">
								📊 Compare candidates
							</Link>
							<Link
								href="/evals"
								className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-border hover:text-foreground">
								📋 Raw eval data
								<ArrowRight className="size-3.5" />
							</Link>
						</motion.div>
					</motion.div>
				</div>
			</section>
		</>
	)
}
