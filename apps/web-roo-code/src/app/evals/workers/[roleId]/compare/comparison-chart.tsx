"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Copy, Check, FileJson, FileSpreadsheet } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"

import type { ModelCandidate, LanguageScores, EngineerRole, RoleRecommendation } from "@/lib/mock-recommendations"
import { TASKS_PER_DAY } from "@/lib/mock-recommendations"

// ── Constants ───────────────────────────────────────────────────────────────

const LANGUAGES: { key: keyof LanguageScores; label: string }[] = [
	{ key: "go", label: "Go" },
	{ key: "java", label: "Java" },
	{ key: "javascript", label: "JavaScript" },
	{ key: "python", label: "Python" },
	{ key: "rust", label: "Rust" },
]

const PROVIDERS = ["anthropic", "openai", "google", "deepseek", "groq", "alibaba", "mistral"] as const

const PROVIDER_LABELS: Record<string, string> = {
	anthropic: "Anthropic",
	openai: "OpenAI",
	google: "Google",
	deepseek: "DeepSeek",
	groq: "Meta/Groq",
	alibaba: "Alibaba",
	mistral: "Mistral",
}

const DIMENSION_COLORS = {
	composite: "#3b82f6", // blue
	success: "#22c55e", // green
	cost: "#f59e0b", // amber
	speed: "#a855f7", // purple
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
		<div className="rounded-lg border border-border bg-card p-3 shadow-lg">
			<p className="mb-2 font-semibold text-sm">{label}</p>
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
					<div key={index} className="flex items-center gap-2 text-xs">
						<span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
						<span className="text-muted-foreground">{entry.name}:</span>
						<span className="font-medium tabular-nums">
							{entry.dataKey === "costEfficiency" && dailyCost !== undefined
								? `${entry.value} (~$${dailyCost}/day · $${costPerTask?.toFixed(3)}/task)`
								: entry.value}
						</span>
					</div>
				),
			)}
		</div>
	)
}

// ── Main Component ──────────────────────────────────────────────────────────

interface ComparisonChartProps {
	recommendation: RoleRecommendation
	role: EngineerRole
	roleId: string
}

export function ComparisonChart({ recommendation, role, roleId }: ComparisonChartProps) {
	const { allCandidates } = recommendation

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

	const chartHeight = Math.max(300, chartData.length * 60 + 80)

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
		<div className="mx-auto flex max-w-screen-lg flex-col gap-10 px-4 pt-28 pb-16 sm:px-6 lg:px-8">
			{/* ── Breadcrumb ─────────────────────────────────────────────── */}
			<nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				<Link href="/evals" className="transition-colors hover:text-foreground">
					Evals
				</Link>
				<span>/</span>
				<Link href="/evals/workers" className="transition-colors hover:text-foreground">
					Hire an AI Engineer
				</Link>
				<span>/</span>
				<Link href={`/evals/workers/${roleId}`} className="transition-colors hover:text-foreground">
					{role.name}
				</Link>
				<span>/</span>
				<span className="font-medium text-foreground">Compare Candidates</span>
			</nav>

			{/* ── Page Header ────────────────────────────────────────────── */}
			<section>
				<h1 className="text-3xl font-bold tracking-tight md:text-4xl">Compare Candidates — {role.name}</h1>
				<p className="mt-2 text-base text-muted-foreground">
					Interactive comparison across composite score, success rate, cost efficiency, and speed.
				</p>
			</section>

			{/* ── Language Toggle ─────────────────────────────────────────── */}
			<section>
				<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
					Score View
				</h2>
				<div className="flex flex-wrap gap-2">
					<button
						onClick={() => setSelectedLanguage("all")}
						className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
							selectedLanguage === "all"
								? "bg-blue-600 text-white"
								: "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
						}`}>
						All Languages
					</button>
					{LANGUAGES.map(({ key, label }) => (
						<button
							key={key}
							onClick={() => setSelectedLanguage(key)}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
								selectedLanguage === key
									? "bg-blue-600 text-white"
									: "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
							}`}>
							{label}
						</button>
					))}
				</div>
			</section>

			{/* ── Filters ────────────────────────────────────────────────── */}
			<section className="flex flex-col gap-6 rounded-xl border border-border/50 bg-card/50 p-5 backdrop-blur-sm sm:flex-row sm:items-start sm:gap-10">
				{/* Provider checkboxes */}
				<div className="flex-1">
					<h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
						Providers
					</h3>
					<div className="flex flex-wrap gap-x-4 gap-y-2">
						{PROVIDERS.map((p) => (
							<label key={p} className="inline-flex cursor-pointer items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={enabledProviders.has(p)}
									onChange={() => toggleProvider(p)}
									className="size-4 rounded border-border accent-blue-600"
								/>
								{PROVIDER_LABELS[p]}
							</label>
						))}
					</div>
				</div>

				{/* Min success rate slider */}
				<div className="w-full sm:w-52">
					<h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
						Min Success Rate
					</h3>
					<div className="flex items-center gap-3">
						<input
							type="range"
							min={0}
							max={100}
							value={minSuccessRate}
							onChange={(e) => setMinSuccessRate(Number(e.target.value))}
							className="h-2 flex-1 cursor-pointer accent-blue-600"
						/>
						<span className="w-10 text-right text-sm font-medium tabular-nums">{minSuccessRate}%</span>
					</div>
				</div>
			</section>

			{/* ── Chart ──────────────────────────────────────────────────── */}
			<section className="rounded-xl border border-border/50 bg-card/50 p-5 backdrop-blur-sm">
				<h2 className="mb-1 text-lg font-semibold">
					{selectedLanguage === "all"
						? "Composite Score"
						: `${LANGUAGES.find((l) => l.key === selectedLanguage)?.label} Score`}{" "}
					Comparison
				</h2>
				<p className="mb-6 text-xs text-muted-foreground">
					Cost Efficiency and Speed are inverted — higher bars mean cheaper / faster. Daily costs assume ~
					{TASKS_PER_DAY} tasks per agent per day (~6 productive hours).
				</p>

				{chartData.length === 0 ? (
					<div className="flex h-48 items-center justify-center text-muted-foreground">
						No candidates match the current filters.
					</div>
				) : (
					<ResponsiveContainer width="100%" height={chartHeight}>
						<BarChart
							data={chartData}
							layout="vertical"
							margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
							<XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}`} />
							<YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
							<Tooltip content={<CustomTooltip />} />
							<Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
							<Bar
								dataKey="composite"
								name={
									selectedLanguage === "all"
										? "Composite"
										: `${LANGUAGES.find((l) => l.key === selectedLanguage)?.label ?? "Language"} Score`
								}
								fill={DIMENSION_COLORS.composite}
								radius={[0, 4, 4, 0]}
								barSize={12}
							/>
							<Bar
								dataKey="success"
								name="Success Rate"
								fill={DIMENSION_COLORS.success}
								radius={[0, 4, 4, 0]}
								barSize={12}
							/>
							<Bar
								dataKey="costEfficiency"
								name="Cost Efficiency"
								fill={DIMENSION_COLORS.cost}
								radius={[0, 4, 4, 0]}
								barSize={12}
							/>
							<Bar
								dataKey="speed"
								name="Speed"
								fill={DIMENSION_COLORS.speed}
								radius={[0, 4, 4, 0]}
								barSize={12}
							/>
						</BarChart>
					</ResponsiveContainer>
				)}
			</section>

			{/* ── Export Buttons ──────────────────────────────────────────── */}
			<section className="flex flex-wrap gap-3">
				<button
					onClick={handleCopySettings}
					className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
					{copiedSettings ? (
						<>
							<Check className="size-4 text-green-500" />
							Copied!
						</>
					) : (
						<>
							<Copy className="size-4" />
							📋 Copy Settings
						</>
					)}
				</button>
				<button
					onClick={handleExportCsv}
					className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
					<FileSpreadsheet className="size-4" />
					📄 Export CSV
				</button>
				<button
					onClick={handleExportJson}
					className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
					<FileJson className="size-4" />
					📦 Export JSON
				</button>
			</section>

			{/* ── Bottom Navigation ───────────────────────────────────────── */}
			<nav className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-2">
					<Link
						href={`/evals/workers/${roleId}`}
						className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
						<ArrowLeft className="size-4" />
						Back to {role.name} candidates
					</Link>
					<Link
						href="/evals/workers"
						className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
						<ArrowLeft className="size-4" />
						Back to all roles
					</Link>
				</div>
			</nav>
		</div>
	)
}
