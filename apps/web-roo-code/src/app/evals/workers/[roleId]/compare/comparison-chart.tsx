"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
	ArrowLeft,
	ArrowRight,
	Copy,
	Check,
	FileJson,
	FileSpreadsheet,
	BarChart3,
	SlidersHorizontal,
	Download,
	FlaskConical,
} from "lucide-react"
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
	Legend,
	ScatterChart,
	Scatter,
	ZAxis,
	Cell,
	ReferenceArea,
} from "recharts"

import type { ModelCandidate, LanguageScores, EngineerRole, RoleRecommendation } from "@/lib/mock-recommendations"
import { TASKS_PER_DAY } from "@/lib/mock-recommendations"

// ── Role Color Themes (matching candidates-content.tsx) ─────────────────────

type RoleTheme = {
	accent: string
	accentLight: string
	accentDark: string
	iconBg: string
	iconText: string
	buttonBg: string
	buttonHover: string
	glowColor: string
	blurBg1: string
	blurBg2: string
	borderHover: string
	shadowHover: string
	methodologyBorder: string
	scoreText: string
	pillActive: string
	pillActiveBg: string
	checkboxAccent: string
	sliderAccent: string
}

const ROLE_THEMES: Record<string, RoleTheme> = {
	junior: {
		accent: "emerald",
		accentLight: "text-emerald-600",
		accentDark: "dark:text-emerald-400",
		iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
		iconText: "text-emerald-700 dark:text-emerald-300",
		buttonBg: "bg-emerald-600 dark:bg-emerald-600",
		buttonHover: "hover:bg-emerald-700 dark:hover:bg-emerald-500",
		glowColor: "bg-emerald-500/8 dark:bg-emerald-600/15",
		blurBg1: "bg-emerald-500/10 dark:bg-emerald-600/20",
		blurBg2: "bg-emerald-400/5 dark:bg-emerald-500/10",
		borderHover: "hover:border-emerald-500/40 dark:hover:border-emerald-400/30",
		shadowHover: "hover:shadow-emerald-500/10 dark:hover:shadow-emerald-400/10",
		methodologyBorder: "border-emerald-500/30 hover:border-emerald-500/50",
		scoreText: "text-emerald-400",
		pillActive: "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25",
		pillActiveBg: "bg-emerald-600",
		checkboxAccent: "accent-emerald-600",
		sliderAccent: "accent-emerald-600",
	},
	senior: {
		accent: "blue",
		accentLight: "text-blue-600",
		accentDark: "dark:text-blue-400",
		iconBg: "bg-blue-100 dark:bg-blue-900/30",
		iconText: "text-blue-700 dark:text-blue-300",
		buttonBg: "bg-blue-600 dark:bg-blue-600",
		buttonHover: "hover:bg-blue-700 dark:hover:bg-blue-500",
		glowColor: "bg-blue-500/8 dark:bg-blue-600/15",
		blurBg1: "bg-blue-500/10 dark:bg-blue-600/20",
		blurBg2: "bg-blue-400/5 dark:bg-blue-500/10",
		borderHover: "hover:border-blue-500/40 dark:hover:border-blue-400/30",
		shadowHover: "hover:shadow-blue-500/10 dark:hover:shadow-blue-400/10",
		methodologyBorder: "border-blue-500/30 hover:border-blue-500/50",
		scoreText: "text-blue-400",
		pillActive: "bg-blue-600 text-white shadow-lg shadow-blue-600/25",
		pillActiveBg: "bg-blue-600",
		checkboxAccent: "accent-blue-600",
		sliderAccent: "accent-blue-600",
	},
	staff: {
		accent: "amber",
		accentLight: "text-amber-600",
		accentDark: "dark:text-amber-400",
		iconBg: "bg-amber-100 dark:bg-amber-900/30",
		iconText: "text-amber-700 dark:text-amber-300",
		buttonBg: "bg-amber-600 dark:bg-amber-600",
		buttonHover: "hover:bg-amber-700 dark:hover:bg-amber-500",
		glowColor: "bg-amber-500/8 dark:bg-amber-600/15",
		blurBg1: "bg-amber-500/10 dark:bg-amber-600/20",
		blurBg2: "bg-amber-400/5 dark:bg-amber-500/10",
		borderHover: "hover:border-amber-500/40 dark:hover:border-amber-400/30",
		shadowHover: "hover:shadow-amber-500/10 dark:hover:shadow-amber-400/10",
		methodologyBorder: "border-amber-500/30 hover:border-amber-500/50",
		scoreText: "text-amber-400",
		pillActive: "bg-amber-600 text-white shadow-lg shadow-amber-600/25",
		pillActiveBg: "bg-amber-600",
		checkboxAccent: "accent-amber-600",
		sliderAccent: "accent-amber-600",
	},
	reviewer: {
		accent: "violet",
		accentLight: "text-violet-600",
		accentDark: "dark:text-violet-400",
		iconBg: "bg-violet-100 dark:bg-violet-900/30",
		iconText: "text-violet-700 dark:text-violet-300",
		buttonBg: "bg-violet-600 dark:bg-violet-600",
		buttonHover: "hover:bg-violet-700 dark:hover:bg-violet-500",
		glowColor: "bg-violet-500/8 dark:bg-violet-600/15",
		blurBg1: "bg-violet-500/10 dark:bg-violet-600/20",
		blurBg2: "bg-violet-400/5 dark:bg-violet-500/10",
		borderHover: "hover:border-violet-500/40 dark:hover:border-violet-400/30",
		shadowHover: "hover:shadow-violet-500/10 dark:hover:shadow-violet-400/10",
		methodologyBorder: "border-violet-500/30 hover:border-violet-500/50",
		scoreText: "text-violet-400",
		pillActive: "bg-violet-600 text-white shadow-lg shadow-violet-600/25",
		pillActiveBg: "bg-violet-600",
		checkboxAccent: "accent-violet-600",
		sliderAccent: "accent-violet-600",
	},
	autonomous: {
		accent: "cyan",
		accentLight: "text-cyan-600",
		accentDark: "dark:text-cyan-400",
		iconBg: "bg-cyan-100 dark:bg-cyan-900/30",
		iconText: "text-cyan-700 dark:text-cyan-300",
		buttonBg: "bg-cyan-600 dark:bg-cyan-600",
		buttonHover: "hover:bg-cyan-700 dark:hover:bg-cyan-500",
		glowColor: "bg-cyan-500/8 dark:bg-cyan-600/15",
		blurBg1: "bg-cyan-500/10 dark:bg-cyan-600/20",
		blurBg2: "bg-cyan-400/5 dark:bg-cyan-500/10",
		borderHover: "hover:border-cyan-500/40 dark:hover:border-cyan-400/30",
		shadowHover: "hover:shadow-cyan-500/10 dark:hover:shadow-cyan-400/10",
		methodologyBorder: "border-cyan-500/30 hover:border-cyan-500/50",
		scoreText: "text-cyan-400",
		pillActive: "bg-cyan-600 text-white shadow-lg shadow-cyan-600/25",
		pillActiveBg: "bg-cyan-600",
		checkboxAccent: "accent-cyan-600",
		sliderAccent: "accent-cyan-600",
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

// ── Constants ───────────────────────────────────────────────────────────────

const LANGUAGES: { key: keyof LanguageScores; label: string }[] = [
	{ key: "go", label: "Go" },
	{ key: "java", label: "Java" },
	{ key: "javascript", label: "JavaScript" },
	{ key: "python", label: "Python" },
	{ key: "rust", label: "Rust" },
]

const PROVIDERS = [
	"anthropic",
	"openai",
	"google",
	"deepseek",
	"groq",
	"alibaba",
	"mistral",
	"xai",
	"moonshot",
] as const

const PROVIDER_LABELS: Record<string, string> = {
	anthropic: "Anthropic",
	openai: "OpenAI",
	google: "Google",
	deepseek: "DeepSeek",
	groq: "Meta/Groq",
	alibaba: "Alibaba",
	mistral: "Mistral",
	xai: "xAI",
	moonshot: "Moonshot",
}

const DIMENSION_COLORS = {
	composite: "#3b82f6", // blue
	success: "#22c55e", // green
	cost: "#f59e0b", // amber
	speed: "#a855f7", // purple
}

const TIER_COLORS: Record<string, string> = {
	best: "#22c55e", // green
	recommended: "#3b82f6", // blue
	situational: "#eab308", // yellow
	"not-recommended": "#ef4444", // red
}

const TIER_LABELS: Record<string, string> = {
	best: "Best",
	recommended: "Recommended",
	situational: "Situational",
	"not-recommended": "Not Recommended",
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize cost: lower cost → higher bar (0–100). */
function normalizeCost(cost: number, maxCost: number): number {
	if (maxCost === 0) return 100
	return Math.round((1 - cost / maxCost) * 100)
}

/** Normalize speed: lower time → higher bar (0–100). */
function normalizeSpeed(time: number, maxTime: number): number {
	if (maxTime === 0) return 100
	return Math.round((1 - time / maxTime) * 100)
}

function buildChartData(
	candidates: ModelCandidate[],
	language: keyof LanguageScores | "all",
	maxCost: number,
	maxTime: number,
) {
	return candidates.map((c) => ({
		name: c.displayName,
		composite: language === "all" ? c.compositeScore : c.languageScores[language],
		success: c.successRate,
		costEfficiency: normalizeCost(c.avgCostPerTask, maxCost),
		speed: normalizeSpeed(c.avgTimePerTask, maxTime),
		// raw daily cost for tooltip display
		dailyCost: Math.round(c.estimatedDailyCost),
		costPerTask: c.avgCostPerTask,
		// raw data for export
		_raw: c,
	}))
}

function candidateToCsvRow(c: ModelCandidate): string {
	return [
		c.provider,
		c.modelId,
		c.displayName,
		c.compositeScore,
		c.successRate,
		c.avgCostPerTask,
		Math.round(c.estimatedDailyCost),
		c.avgTimePerTask,
		c.languageScores.go,
		c.languageScores.java,
		c.languageScores.javascript,
		c.languageScores.python,
		c.languageScores.rust,
		c.tier,
		`"${c.settings.temperature}"`,
		`"${c.settings.reasoningEffort ?? ""}"`,
	].join(",")
}

function downloadBlob(content: string, filename: string, mimeType: string) {
	const blob = new Blob([content], { type: mimeType })
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)
}

// ── Custom Tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	payload?: any[]
	label?: string
}) {
	if (!active || !payload || !payload.length) return null

	// Extract raw daily cost from first payload entry's data
	const rawData = payload[0]?.payload as { dailyCost?: number; costPerTask?: number } | undefined
	const dailyCost = rawData?.dailyCost
	const costPerTask = rawData?.costPerTask

	return (
		<div className="rounded-xl border border-border/50 bg-card/95 p-4 shadow-2xl backdrop-blur-md">
			<p className="mb-2.5 text-sm font-bold tracking-tight">{label}</p>
			<div className="space-y-1.5">
				{payload.map(
					(
						entry: {
							name: string
							value: number
							color: string
							dataKey: string
						},
						index: number,
					) => (
						<div key={index} className="flex items-center gap-2.5 text-xs">
							<span
								className="size-2.5 rounded-full ring-1 ring-white/10"
								style={{ backgroundColor: entry.color }}
							/>
							<span className="text-muted-foreground">{entry.name}:</span>
							<span className="font-semibold tabular-nums">
								{entry.dataKey === "costEfficiency" && dailyCost !== undefined
									? `${entry.value} ($${dailyCost}/day · $${costPerTask?.toFixed(3)}/task)`
									: entry.value}
							</span>
						</div>
					),
				)}
			</div>
		</div>
	)
}

// ── Scatter Tooltip ─────────────────────────────────────────────────────────

function ScatterTooltip({
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
				name?: string
				dailyCost?: number
				score?: number
				successRate?: number
				tier?: string
		  }
		| undefined

	if (!data) return null

	return (
		<div className="rounded-xl border border-border/50 bg-card/95 p-4 shadow-2xl backdrop-blur-md">
			<p className="mb-2.5 text-sm font-bold tracking-tight">{data.name}</p>
			<div className="space-y-1.5">
				<div className="flex items-center gap-2.5 text-xs">
					<span
						className="size-2.5 rounded-full ring-1 ring-white/10"
						style={{ backgroundColor: TIER_COLORS[data.tier ?? "situational"] }}
					/>
					<span className="text-muted-foreground">Tier:</span>
					<span className="font-semibold">{TIER_LABELS[data.tier ?? "situational"]}</span>
				</div>
				<div className="flex items-center gap-2.5 text-xs">
					<span className="size-2.5 rounded-full bg-amber-400 ring-1 ring-white/10" />
					<span className="text-muted-foreground">Daily Spend:</span>
					<span className="font-semibold tabular-nums">${data.dailyCost}/day</span>
				</div>
				<div className="flex items-center gap-2.5 text-xs">
					<span className="size-2.5 rounded-full bg-blue-400 ring-1 ring-white/10" />
					<span className="text-muted-foreground">Eval Score:</span>
					<span className="font-semibold tabular-nums">{data.score}</span>
				</div>
				<div className="flex items-center gap-2.5 text-xs">
					<span className="size-2.5 rounded-full bg-green-400 ring-1 ring-white/10" />
					<span className="text-muted-foreground">Success Rate:</span>
					<span className="font-semibold tabular-nums">{data.successRate}%</span>
				</div>
			</div>
		</div>
	)
}

// ── Main Component ──────────────────────────────────────────────────────────

interface ComparisonChartProps {
	recommendation: RoleRecommendation
	role: EngineerRole
	roleId: string
	workersRootPath?: string
}

export function ComparisonChart({
	recommendation,
	role,
	roleId,
	workersRootPath = "/evals/workers",
}: ComparisonChartProps) {
	const searchParams = useSearchParams()
	const { allCandidates } = recommendation
	const theme = ROLE_THEMES[roleId] ?? DEFAULT_THEME
	const alternateWorkersRootPath = workersRootPath === "/evals/workers-v2" ? "/evals/workers" : "/evals/workers-v2"
	const alternateVersionLabel = workersRootPath === "/evals/workers-v2" ? "View baseline" : "View V2 preview"
	const setupQuery = (() => {
		const outcome = searchParams.get("outcome")
		if (!outcome) return ""
		const params = new URLSearchParams()
		params.set("outcome", outcome)
		const mode = searchParams.get("mode")
		if (mode) params.set("mode", mode)
		return `?${params.toString()}`
	})()

	// ── State ───────────────────────────────────────────────────────────────
	const [selectedLanguage, setSelectedLanguage] = useState<keyof LanguageScores | "all">("all")
	const [enabledProviders, setEnabledProviders] = useState<Set<string>>(() => new Set(PROVIDERS))
	const [minSuccessRate, setMinSuccessRate] = useState(0)
	const [copiedSettings, setCopiedSettings] = useState(false)

	// ── Derived ─────────────────────────────────────────────────────────────

	const filteredCandidates = useMemo(
		() => allCandidates.filter((c) => enabledProviders.has(c.provider) && c.successRate >= minSuccessRate),
		[allCandidates, enabledProviders, minSuccessRate],
	)

	const maxCost = useMemo(() => Math.max(...allCandidates.map((c) => c.avgCostPerTask), 0.001), [allCandidates])

	const maxTime = useMemo(() => Math.max(...allCandidates.map((c) => c.avgTimePerTask), 0.1), [allCandidates])

	const chartData = useMemo(
		() => buildChartData(filteredCandidates, selectedLanguage, maxCost, maxTime),
		[filteredCandidates, selectedLanguage, maxCost, maxTime],
	)

	const chartHeight = Math.max(400, chartData.length * 100)

	// Scatter plot data: value map of daily cost vs composite score
	const scatterData = useMemo(
		() =>
			filteredCandidates.map((c) => ({
				name: c.displayName,
				dailyCost: Math.round(c.estimatedDailyCost),
				score: c.compositeScore,
				successRate: c.successRate,
				tier: c.tier,
				// ZAxis size: map success rate to dot size (60–400 range)
				dotSize: Math.round(60 + (c.successRate / 100) * 340),
			})),
		[filteredCandidates],
	)

	// Determine axis domains for scatter plot
	const scatterMaxCost = useMemo(() => Math.max(...scatterData.map((d) => d.dailyCost), 10), [scatterData])
	const scatterMinScore = useMemo(() => Math.min(...scatterData.map((d) => d.score), 50), [scatterData])

	// Providers that actually appear in data
	const activeProviders = useMemo(() => {
		const providers = new Set(allCandidates.map((c) => c.provider))
		return PROVIDERS.filter((p) => providers.has(p))
	}, [allCandidates])

	// ── Handlers ────────────────────────────────────────────────────────────

	const toggleProvider = useCallback((provider: string) => {
		setEnabledProviders((prev) => {
			const next = new Set(prev)
			if (next.has(provider)) {
				next.delete(provider)
			} else {
				next.add(provider)
			}
			return next
		})
	}, [])

	const handleCopySettings = useCallback(async () => {
		const settings = filteredCandidates.map((c) => ({
			provider: c.provider,
			model: c.modelId,
			displayName: c.displayName,
			temperature: c.settings.temperature,
			...(c.settings.reasoningEffort ? { reasoningEffort: c.settings.reasoningEffort } : {}),
		}))
		await navigator.clipboard.writeText(JSON.stringify(settings, null, 2))
		setCopiedSettings(true)
		setTimeout(() => setCopiedSettings(false), 2000)
	}, [filteredCandidates])

	const handleExportCsv = useCallback(() => {
		const header =
			"Provider,Model ID,Display Name,Composite Score,Success Rate,Avg Cost/Task,Est. Daily Cost,Avg Time/Task,Go,Java,JavaScript,Python,Rust,Tier,Temperature,Reasoning Effort"
		const rows = filteredCandidates.map(candidateToCsvRow)
		const csv = [header, ...rows].join("\n")
		downloadBlob(csv, `${roleId}-comparison.csv`, "text/csv")
	}, [filteredCandidates, roleId])

	const handleExportJson = useCallback(() => {
		const json = JSON.stringify(filteredCandidates, null, 2)
		downloadBlob(json, `${roleId}-comparison.json`, "application/json")
	}, [filteredCandidates, roleId])

	// ── Render ──────────────────────────────────────────────────────────────

	return (
		<>
			{/* ── Atmospheric Header ────────────────────────────────────── */}
			<section className="relative overflow-hidden pt-24 pb-10">
				{/* Blur gradient background in role color */}
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
							className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
							variants={fadeUpVariants}>
							<Link href="/evals" className="transition-colors hover:text-foreground">
								Evals
							</Link>
							<span className="text-border">/</span>
							<Link
								href={`${workersRootPath}${setupQuery}`}
								className="transition-colors hover:text-foreground">
								Build with Roo Code Cloud
							</Link>
							<span className="text-border">/</span>
							<Link
								href={`${workersRootPath}/${roleId}${setupQuery}`}
								className="transition-colors hover:text-foreground">
								{role.name}
							</Link>
							<span className="text-border">/</span>
							<span className="font-medium text-foreground">Compare Models</span>
							<span className="text-border">/</span>
							<Link
								href={`${alternateWorkersRootPath}/${roleId}/compare${setupQuery}`}
								className="font-medium text-muted-foreground transition-colors hover:text-foreground">
								{alternateVersionLabel}
							</Link>
						</motion.nav>

						{/* Title row */}
						<motion.div className="flex items-start gap-5" variants={fadeUpVariants}>
							<div
								className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${theme.iconBg} ${theme.iconText} shadow-lg`}>
								<BarChart3 className="size-7" />
							</div>
							<div className="flex-1">
								<h1 className="text-4xl font-bold tracking-tight md:text-5xl">Compare Models</h1>
								<p className={`mt-1 font-semibold ${theme.accentLight} ${theme.accentDark}`}>
									{role.name}
								</p>
								<p className="mt-2 text-base leading-relaxed text-muted-foreground md:text-lg">
									Interactive comparison across composite score, success rate, cost efficiency, and
									speed. Filter by provider, language, and minimum success rate.
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
									{filteredCandidates.length}
								</span>
								of {allCandidates.length} models shown
							</span>
							<div className="hidden h-4 w-px bg-border sm:block" />
							<span className="text-sm text-muted-foreground">
								Viewing{" "}
								<span className="font-medium text-foreground/80">
									{selectedLanguage === "all"
										? "All Languages"
										: LANGUAGES.find((l) => l.key === selectedLanguage)?.label}
								</span>
							</span>
							{minSuccessRate > 0 && (
								<>
									<div className="hidden h-4 w-px bg-border sm:block" />
									<span className="text-sm text-muted-foreground">
										Min success{" "}
										<span className="font-mono font-semibold text-foreground/80">
											{minSuccessRate}%
										</span>
									</span>
								</>
							)}
						</motion.div>
					</motion.div>
				</div>
			</section>

			{/* ── Main Content ──────────────────────────────────────────── */}
			<div className="container mx-auto max-w-screen-lg px-4 pb-20 sm:px-6 lg:px-8">
				<motion.div
					className="flex flex-col gap-8"
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={containerVariants}>
					{/* ── Filters Section ────────────────────────────────────── */}
					<motion.section
						className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm"
						variants={fadeUpVariants}>
						<div className="mb-5 flex items-center gap-2.5">
							<div
								className={`flex size-8 items-center justify-center rounded-lg ${theme.iconBg} ${theme.iconText}`}>
								<SlidersHorizontal className="size-4" />
							</div>
							<h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
								Filters
							</h2>
						</div>

						<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
							{/* Language toggle pills */}
							<div className="flex-1">
								<h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
									Score View
								</h3>
								<div className="flex flex-wrap gap-2">
									<button
										onClick={() => setSelectedLanguage("all")}
										className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
											selectedLanguage === "all"
												? theme.pillActive
												: "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
										}`}>
										All Languages
									</button>
									{LANGUAGES.map(({ key, label }) => (
										<button
											key={key}
											onClick={() => setSelectedLanguage(key)}
											className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
												selectedLanguage === key
													? theme.pillActive
													: "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
											}`}>
											{label}
										</button>
									))}
								</div>
							</div>

							{/* Min success rate slider */}
							<div className="w-full lg:w-56">
								<h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
									Min Success Rate
								</h3>
								<div className="flex items-center gap-3">
									<input
										type="range"
										min={0}
										max={100}
										value={minSuccessRate}
										onChange={(e) => setMinSuccessRate(Number(e.target.value))}
										className={`h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted/50 ${theme.sliderAccent}`}
									/>
									<span
										className={`inline-flex min-w-[3.5rem] items-center justify-center rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 text-center text-sm font-bold tabular-nums ${theme.accentLight} ${theme.accentDark}`}>
										{minSuccessRate}%
									</span>
								</div>
							</div>
						</div>

						{/* Provider checkboxes */}
						<div className="mt-5 border-t border-border/30 pt-5">
							<h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
								Providers
							</h3>
							<div className="flex flex-wrap gap-x-5 gap-y-2.5">
								{activeProviders.map((p) => (
									<label
										key={p}
										className="group inline-flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-muted/30">
										<input
											type="checkbox"
											checked={enabledProviders.has(p)}
											onChange={() => toggleProvider(p)}
											className={`size-4 rounded border-border ${theme.checkboxAccent}`}
										/>
										<span className="font-medium text-foreground/80 transition-colors group-hover:text-foreground">
											{PROVIDER_LABELS[p] ?? p}
										</span>
									</label>
								))}
							</div>
						</div>
					</motion.section>

					{/* ── Value Map Scatter Chart ────────────────────────────── */}
					<motion.section
						className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm"
						variants={fadeUpVariants}>
						<div className="mb-1 flex items-center gap-2.5">
							<h2 className="text-lg font-bold tracking-tight">Value Map: Spend vs Eval Score</h2>
						</div>
						<p className="mb-4 text-xs leading-relaxed text-muted-foreground/80">
							Upper-left = higher score at lower spend. Each dot is a model. Size reflects success rate.
						</p>

						{/* Tier legend */}
						<div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
							{Object.entries(TIER_COLORS).map(([tier, color]) => (
								<div key={tier} className="flex items-center gap-1.5">
									<span
										className="size-2.5 rounded-full ring-1 ring-white/10"
										style={{ backgroundColor: color }}
									/>
									<span>{TIER_LABELS[tier]}</span>
								</div>
							))}
						</div>

						{scatterData.length === 0 ? (
							<div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 text-muted-foreground">
								<SlidersHorizontal className="size-6 text-muted-foreground/50" />
								<p className="text-sm">No models match the current filters.</p>
								<p className="text-xs text-muted-foreground/60">
									Try adjusting the provider or success rate filters.
								</p>
							</div>
						) : (
							<div className="rounded-xl bg-background/30 p-2">
								<ResponsiveContainer width="100%" height={420}>
									<ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
										<XAxis
											type="number"
											dataKey="dailyCost"
											name="Daily Spend"
											domain={[0, Math.ceil(scatterMaxCost * 1.1)]}
											tickFormatter={(v: number) => `$${v}`}
											stroke="hsl(var(--muted-foreground))"
											strokeOpacity={0.3}
											tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
											axisLine={false}
											label={{
												value: "Daily Spend ($)",
												position: "insideBottom",
												offset: -10,
												style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
											}}
										/>
										<YAxis
											type="number"
											dataKey="score"
											name="Eval Score"
											domain={[Math.max(0, scatterMinScore - 10), 100]}
											stroke="hsl(var(--muted-foreground))"
											strokeOpacity={0.3}
											tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
											axisLine={false}
											label={{
												value: "Eval Score",
												angle: -90,
												position: "insideLeft",
												offset: 10,
												style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
											}}
										/>
										<ZAxis type="number" dataKey="dotSize" range={[60, 400]} />
										{/* Sweet spot reference zone: upper-left quadrant */}
										<ReferenceArea
											x1={0}
											x2={Math.ceil(scatterMaxCost * 0.4)}
											y1={80}
											y2={100}
											fill="hsl(var(--foreground))"
											fillOpacity={0.03}
											stroke="hsl(var(--foreground))"
											strokeOpacity={0.08}
											strokeDasharray="4 4"
											label={{
												value: "Sweet Spot",
												position: "insideTopLeft",
												style: {
													fontSize: 10,
													fill: "hsl(var(--muted-foreground))",
													fontWeight: 500,
												},
											}}
										/>
										<Tooltip
											content={<ScatterTooltip />}
											cursor={{
												strokeDasharray: "3 3",
												stroke: "hsl(var(--muted-foreground))",
												strokeOpacity: 0.3,
											}}
										/>
										<Scatter data={scatterData} name="Models">
											{scatterData.map((entry, index) => (
												<Cell
													key={`scatter-cell-${index}`}
													fill={TIER_COLORS[entry.tier] ?? "#94a3b8"}
													fillOpacity={0.85}
													stroke={TIER_COLORS[entry.tier] ?? "#94a3b8"}
													strokeWidth={1}
													strokeOpacity={0.4}
												/>
											))}
										</Scatter>
									</ScatterChart>
								</ResponsiveContainer>
							</div>
						)}
					</motion.section>

					{/* ── Chart Section ──────────────────────────────────────── */}
					<motion.section
						className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm"
						variants={fadeUpVariants}>
						<div className="mb-1 flex items-center gap-2.5">
							<h2 className="text-lg font-bold tracking-tight">
								{selectedLanguage === "all"
									? "Composite Score"
									: `${LANGUAGES.find((l) => l.key === selectedLanguage)?.label} Score`}{" "}
								Comparison
							</h2>
						</div>
						<p className="mb-6 text-xs leading-relaxed text-muted-foreground/80">
							Cost Efficiency and Speed are inverted — higher bars mean cheaper / faster. Daily costs
							assume ~{TASKS_PER_DAY} tasks per agent per day (~6 productive hours).
						</p>

						{chartData.length === 0 ? (
							<div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 text-muted-foreground">
								<SlidersHorizontal className="size-6 text-muted-foreground/50" />
								<p className="text-sm">No models match the current filters.</p>
								<p className="text-xs text-muted-foreground/60">
									Try adjusting the provider or success rate filters.
								</p>
							</div>
						) : (
							<div className="rounded-xl bg-background/30 p-2">
								<ResponsiveContainer width="100%" height={chartHeight}>
									<BarChart
										data={chartData}
										layout="vertical"
										barCategoryGap="30%"
										barGap={4}
										margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
										<XAxis
											type="number"
											domain={[0, 100]}
											tickFormatter={(v: number) => `${v}`}
											stroke="hsl(var(--muted-foreground))"
											strokeOpacity={0.3}
											tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
											axisLine={false}
										/>
										<YAxis
											type="category"
											dataKey="name"
											width={150}
											tick={{ fontSize: 12, fill: "hsl(var(--foreground))", fontWeight: 500 }}
											axisLine={false}
											tickLine={false}
										/>
										<Tooltip
											content={<CustomTooltip />}
											cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.15 }}
										/>
										<Legend
											wrapperStyle={{
												fontSize: 12,
												paddingTop: 12,
											}}
										/>
										<Bar
											dataKey="composite"
											name={
												selectedLanguage === "all"
													? "Composite"
													: `${LANGUAGES.find((l) => l.key === selectedLanguage)?.label ?? "Language"} Score`
											}
											fill={DIMENSION_COLORS.composite}
											radius={[0, 4, 4, 0]}
											barSize={10}
										/>
										<Bar
											dataKey="success"
											name="Success Rate"
											fill={DIMENSION_COLORS.success}
											radius={[0, 4, 4, 0]}
											barSize={10}
										/>
										<Bar
											dataKey="costEfficiency"
											name="Cost Efficiency"
											fill={DIMENSION_COLORS.cost}
											radius={[0, 4, 4, 0]}
											barSize={10}
										/>
										<Bar
											dataKey="speed"
											name="Speed"
											fill={DIMENSION_COLORS.speed}
											radius={[0, 4, 4, 0]}
											barSize={10}
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
						)}
					</motion.section>

					{/* ── Export Section ──────────────────────────────────────── */}
					<motion.section
						className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm"
						variants={fadeUpVariants}>
						<div className="mb-5 flex items-center gap-2.5">
							<div
								className={`flex size-8 items-center justify-center rounded-lg ${theme.iconBg} ${theme.iconText}`}>
								<Download className="size-4" />
							</div>
							<h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
								Export Data
							</h2>
						</div>

						<div className="flex flex-wrap gap-3">
							<button
								onClick={handleCopySettings}
								className={`group inline-flex items-center gap-2.5 rounded-xl border border-border/50 bg-card/80 px-5 py-3 text-sm font-medium text-foreground/80 backdrop-blur-sm transition-all duration-200 hover:border-border hover:bg-card hover:text-foreground hover:shadow-lg active:scale-[0.98]`}>
								{copiedSettings ? (
									<>
										<Check className="size-4 text-green-500" />
										<span className="text-green-500">Copied!</span>
									</>
								) : (
									<>
										<Copy className="size-4" />
										Copy Settings JSON
									</>
								)}
							</button>
							<button
								onClick={handleExportCsv}
								className="group inline-flex items-center gap-2.5 rounded-xl border border-border/50 bg-card/80 px-5 py-3 text-sm font-medium text-foreground/80 backdrop-blur-sm transition-all duration-200 hover:border-border hover:bg-card hover:text-foreground hover:shadow-lg active:scale-[0.98]">
								<FileSpreadsheet className="size-4" />
								Export CSV
							</button>
							<button
								onClick={handleExportJson}
								className="group inline-flex items-center gap-2.5 rounded-xl border border-border/50 bg-card/80 px-5 py-3 text-sm font-medium text-foreground/80 backdrop-blur-sm transition-all duration-200 hover:border-border hover:bg-card hover:text-foreground hover:shadow-lg active:scale-[0.98]">
								<FileJson className="size-4" />
								Export JSON
							</button>
						</div>
					</motion.section>

					{/* ── Bottom Navigation ───────────────────────────────────── */}
					<motion.section className="border-t border-border/50 pt-10" variants={fadeUpVariants}>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<Link
									href={`${workersRootPath}/${roleId}${setupQuery}`}
									className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-border hover:text-foreground">
									<ArrowLeft className="size-4" />
									Back to {role.name} models
								</Link>
							</div>
							<div className="flex flex-wrap gap-3">
								<Link
									href={`${workersRootPath}${setupQuery}`}
									className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-border hover:text-foreground">
									<ArrowLeft className="size-3.5" />
									All roles
								</Link>
								<Link
									href="/evals"
									className={`inline-flex items-center gap-2 rounded-full border ${theme.methodologyBorder} bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:text-foreground`}>
									📋 Raw eval data
									<ArrowRight className="size-3.5" />
								</Link>
							</div>
						</div>
					</motion.section>
				</motion.div>
			</div>
		</>
	)
}
