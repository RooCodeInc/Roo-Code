"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight, BarChart3, Copy, ExternalLink, SlidersHorizontal, Sparkles, Workflow } from "lucide-react"
import { Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts"

import type { RoleRecommendation, ModelCandidate } from "@/lib/mock-recommendations"
import { getCloudSetupUrl } from "@/lib/mock-recommendations"

type EvalOptimizationMode = "best" | "fastest" | "cost"

type ObjectiveDeepDive = {
	id: string
	slug: string
	name: string
	description: string
	whyItWorks: string[]
	recommendedRoleIds: string[]
	builderProfile?: {
		title: string
		description: string
		examplePrompt?: string
		howItWorks: string[]
	}
}

type ObjectiveRoleRec = {
	roleId: string
	recommendation: RoleRecommendation
}

type Props = {
	objective: ObjectiveDeepDive
	initialMode: EvalOptimizationMode
	recs: ObjectiveRoleRec[]
}

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.08, delayChildren: 0.08 },
	},
}

const fadeUp = {
	hidden: { opacity: 0, y: 14 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.45, 0.27, 0.9] as const } },
}

function isEvalOptimizationMode(value: string): value is EvalOptimizationMode {
	return value === "best" || value === "fastest" || value === "cost"
}

function pickCandidate(rec: RoleRecommendation | undefined, mode: EvalOptimizationMode): ModelCandidate | null {
	if (!rec) return null
	if (mode === "fastest") return rec.speedHire ?? rec.best[0] ?? null
	if (mode === "cost") return rec.budgetHire ?? rec.best[0] ?? null
	return rec.best[0] ?? null
}

function shortProvider(provider: string) {
	switch (provider) {
		case "openai":
			return "OpenAI"
		case "anthropic":
			return "Anthropic"
		case "google":
			return "Google"
		case "xai":
			return "xAI"
		case "deepseek":
			return "DeepSeek"
		case "moonshot":
			return "Moonshot"
		default:
			return provider
	}
}

function formatDollars(value: number) {
	if (!Number.isFinite(value)) return "—"
	return `$${Math.round(value)}`
}

function formatSeconds(value: number) {
	if (!Number.isFinite(value)) return "—"
	return `${value.toFixed(1)}s`
}

function buildObjectiveQueryString(
	searchParams: { get(name: string): string | null },
	objectiveSlug: string,
	mode: EvalOptimizationMode,
) {
	const params = new URLSearchParams()
	params.set("objective", objectiveSlug)
	params.set("mode", mode)

	// Preserve any existing query bits we might add later without breaking URLs.
	const view = searchParams.get("view")
	if (view) params.set("view", view)

	return `?${params.toString()}`
}

type ObjectiveTooltipPayloadEntry = { payload?: unknown }

function ObjectiveTooltip({ active, payload }: { active?: boolean; payload?: ObjectiveTooltipPayloadEntry[] }) {
	if (!active || !payload?.length) return null
	const entryPayload = payload[0]?.payload
	const p = entryPayload as
		| {
				name?: string
				provider?: string
				score?: number
				dailyCost?: number
				successRate?: number
		  }
		| undefined
	if (!p) return null

	return (
		<div className="rounded-xl border border-border/50 bg-card/95 p-3 shadow-2xl backdrop-blur-md">
			<p className="text-sm font-semibold tracking-tight">{p.name}</p>
			<p className="mt-1 text-xs text-muted-foreground">
				{shortProvider(p.provider ?? "")} · <span className="font-mono">{p.score}</span> score ·{" "}
				<span className="font-mono">{p.successRate}%</span> success
			</p>
			<p className="mt-1 text-xs text-muted-foreground">
				Est daily cost <span className="font-mono">{formatDollars(p.dailyCost ?? NaN)}</span>
			</p>
		</div>
	)
}

export function ObjectiveContent({ objective, initialMode, recs }: Props) {
	const searchParams = useSearchParams()

	const recByRole = useMemo(() => new Map(recs.map((r) => [r.roleId, r.recommendation])), [recs])
	const lineup = useMemo(() => objective.recommendedRoleIds.filter((id) => recByRole.has(id)), [objective, recByRole])

	const [mode, setMode] = useState<EvalOptimizationMode>(() => {
		const m = searchParams.get("mode")
		if (m && isEvalOptimizationMode(m)) return m
		return initialMode
	})

	const [overrides, setOverrides] = useState<Record<string, string>>({})

	const selectedByRole = useMemo(() => {
		const next = new Map<string, ModelCandidate | null>()
		for (const roleId of lineup) {
			const rec = recByRole.get(roleId)
			const overrideModelId = overrides[roleId]
			if (overrideModelId && rec) {
				next.set(roleId, rec.allCandidates.find((c) => c.modelId === overrideModelId) ?? null)
			} else {
				next.set(roleId, pickCandidate(rec, mode))
			}
		}
		return next
	}, [lineup, mode, overrides, recByRole])

	const primaryRoleId = lineup[0] ?? null
	const primaryCandidate = primaryRoleId ? (selectedByRole.get(primaryRoleId) ?? null) : null

	const modePill = useMemo(
		() => [
			{ id: "best" as const, label: "Quality" },
			{ id: "fastest" as const, label: "Speed" },
			{ id: "cost" as const, label: "Cost" },
		],
		[],
	)

	const cloudHref = useMemo(() => {
		if (!primaryCandidate) return "https://app.roocode.com"
		return getCloudSetupUrl(primaryCandidate)
	}, [primaryCandidate])

	const examplePrompt = objective.builderProfile?.examplePrompt?.trim() ?? ""
	const copyPrompt = useCallback(async () => {
		if (!examplePrompt) return
		await navigator.clipboard.writeText(examplePrompt)
	}, [examplePrompt])

	const onSelectModel = useCallback((roleId: string, modelId: string) => {
		setOverrides((prev) => ({ ...prev, [roleId]: modelId }))
	}, [])

	const onSetMode = useCallback((next: EvalOptimizationMode) => {
		setMode(next)
	}, [])

	const roleQuery = useMemo(
		() => buildObjectiveQueryString(searchParams, objective.slug, mode),
		[mode, objective.slug, searchParams],
	)

	const primaryScatter = useMemo(() => {
		if (!primaryRoleId) return []
		const rec = recByRole.get(primaryRoleId)
		if (!rec) return []
		return rec.allCandidates.map((c) => ({
			name: c.displayName,
			provider: c.provider,
			score: c.compositeScore,
			successRate: c.successRate,
			dailyCost: Math.round(c.estimatedDailyCost),
			dotSize: Math.round(40 + (c.successRate / 100) * 260),
			isSelected: primaryCandidate?.modelId === c.modelId,
		}))
	}, [primaryCandidate?.modelId, primaryRoleId, recByRole])

	return (
		<div className="relative">
			{/* Atmosphere */}
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
				<div className="absolute -left-32 -top-40 h-[560px] w-[560px] rounded-full bg-foreground/[0.035] blur-3xl" />
				<div className="absolute right-[-180px] top-24 h-[700px] w-[700px] rounded-full bg-foreground/[0.03] blur-3xl" />
				<div
					className="absolute inset-0 opacity-[0.45]"
					style={{
						backgroundImage:
							"linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
						backgroundSize: "88px 88px",
					}}
				/>
			</div>

			<section className="relative pt-24">
				<div className="container relative z-10 mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
					<motion.div initial="hidden" animate="visible" variants={containerVariants}>
						<motion.nav
							className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
							variants={fadeUp}>
							<Link href="/evals" className="transition-colors hover:text-foreground">
								Evals
							</Link>
							<span className="text-border">/</span>
							<Link href="/evals/recommendations" className="transition-colors hover:text-foreground">
								Build with Roo Code Cloud
							</Link>
							<span className="text-border">/</span>
							<span className="font-medium text-foreground">{objective.name}</span>
						</motion.nav>

						<motion.div
							className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start"
							variants={fadeUp}>
							<div className="lg:col-span-7">
								<div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground backdrop-blur-sm">
									<Sparkles className="size-3.5" />
									Objective Deep Dive
								</div>
								<h1 className="mt-4 text-balance text-5xl font-semibold tracking-tight text-foreground [font-family:var(--font-display)] sm:text-6xl">
									{objective.name}
								</h1>
								<p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
									{objective.description} Explore why this setup is recommended, compare options, and
									tune it to your constraints before you start in Roo Code Cloud.
								</p>

								<div className="mt-7 flex flex-wrap items-center gap-3">
									<Link
										href={
											primaryRoleId
												? `/evals/recommendations/roles/${primaryRoleId}${roleQuery}`
												: "/evals/recommendations"
										}
										className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/20 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-background/30">
										<BarChart3 className="size-4" />
										See model data
									</Link>
									<Link
										href={
											primaryRoleId
												? `/evals/recommendations/roles/${primaryRoleId}/compare${roleQuery}`
												: "/evals/recommendations"
										}
										className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/10 px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-background/20 hover:text-foreground">
										<Workflow className="size-4" />
										Compare candidates
									</Link>
								</div>
							</div>

							<div className="lg:col-span-5">
								<div className="relative overflow-hidden rounded-2xl border border-border/50 bg-background/25 p-6 backdrop-blur-xl">
									<div
										aria-hidden="true"
										className="pointer-events-none absolute -right-40 -top-40 size-96 rounded-full bg-foreground/[0.04] blur-3xl"
									/>
									<div className="relative">
										<div className="flex flex-wrap items-center justify-between gap-3">
											<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
												Configuration
											</p>
											<span className="rounded-full border border-border/50 bg-background/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
												<SlidersHorizontal className="mr-1 inline-block size-3" />
												Tunable
											</span>
										</div>

										<div className="mt-4">
											<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
												Optimized for
											</p>
											<div className="mt-2 inline-flex rounded-full border border-border/50 bg-card/30 p-1 backdrop-blur-sm">
												{modePill.map((m) => {
													const selected = m.id === mode
													return (
														<button
															key={m.id}
															type="button"
															aria-pressed={selected}
															onClick={() => onSetMode(m.id)}
															className={[
																"rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
																selected
																	? "bg-foreground/10 text-foreground"
																	: "text-muted-foreground hover:text-foreground",
															].join(" ")}>
															{m.label}
														</button>
													)
												})}
											</div>
										</div>

										<div className="mt-5 rounded-2xl border border-border/50 bg-background/10 p-4">
											<p className="text-xs font-semibold text-foreground">Primary model</p>
											<p className="mt-1 text-sm text-muted-foreground">
												{primaryCandidate ? (
													<>
														<span className="font-semibold text-foreground">
															{primaryCandidate.displayName}
														</span>{" "}
														<span className="text-muted-foreground/70">
															({shortProvider(primaryCandidate.provider)})
														</span>
													</>
												) : (
													<span className="text-muted-foreground">
														Pick an objective to see recommendations.
													</span>
												)}
											</p>
											{primaryCandidate ? (
												<div className="mt-3 grid grid-cols-3 gap-2">
													<div className="rounded-xl border border-border/50 bg-background/10 px-3 py-2">
														<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
															Score
														</p>
														<p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
															{primaryCandidate.compositeScore}
														</p>
													</div>
													<div className="rounded-xl border border-border/50 bg-background/10 px-3 py-2">
														<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
															Success
														</p>
														<p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
															{primaryCandidate.successRate}%
														</p>
													</div>
													<div className="rounded-xl border border-border/50 bg-background/10 px-3 py-2">
														<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
															Daily
														</p>
														<p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
															{formatDollars(primaryCandidate.estimatedDailyCost)}
														</p>
													</div>
												</div>
											) : null}
										</div>

										<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
											<a
												href={cloudHref}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center justify-center gap-2 rounded-2xl border border-foreground/20 bg-foreground/10 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/15">
												Open in Roo Code Cloud
												<ExternalLink className="size-4" />
											</a>
											<button
												type="button"
												onClick={copyPrompt}
												disabled={!examplePrompt}
												className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/10 px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-border hover:bg-background/15 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60">
												Copy example prompt
												<Copy className="size-4" />
											</button>
										</div>

										<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
											This is a starting point. Adjust the lineup and model picks to match your
											repo and delivery constraints.
										</p>
									</div>
								</div>
							</div>
						</motion.div>
					</motion.div>
				</div>
			</section>

			<section className="relative pb-20 pt-14">
				<div className="container relative z-10 mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
					<div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
						<div className="lg:col-span-7">
							<h2 className="text-2xl font-semibold tracking-tight text-foreground [font-family:var(--font-display)]">
								Recommended lineup
							</h2>
							<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
								For {objective.name}, this lineup balances momentum and safety. Swap models per agent if
								you have different constraints.
							</p>

							<div className="mt-6 space-y-4">
								{lineup.map((roleId) => {
									const rec = recByRole.get(roleId)
									if (!rec) return null
									const selected = selectedByRole.get(roleId) ?? null

									return (
										<div
											key={roleId}
											className="rounded-2xl border border-border/50 bg-background/15 p-5 backdrop-blur-sm">
											<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
												<div className="min-w-0">
													<p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
														For
													</p>
													<p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
														{rec.role.name}
													</p>
													<p className="mt-1 text-sm text-muted-foreground">
														{rec.role.salaryRange}
													</p>
												</div>
												<div className="flex flex-wrap gap-2">
													<Link
														href={`/evals/recommendations/roles/${roleId}${roleQuery}`}
														className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/10 px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-background/20 hover:text-foreground">
														Details
														<ArrowRight className="size-3.5" />
													</Link>
													<Link
														href={`/evals/recommendations/roles/${roleId}/compare${roleQuery}`}
														className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/10 px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-background/20 hover:text-foreground">
														Compare
														<ArrowRight className="size-3.5" />
													</Link>
												</div>
											</div>

											<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-5 sm:items-end">
												<div className="sm:col-span-3">
													<label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
														Model pick
													</label>
													<div className="mt-2">
														<select
															value={selected?.modelId ?? ""}
															onChange={(e) => onSelectModel(roleId, e.target.value)}
															className="w-full rounded-xl border border-border/60 bg-background/20 px-3 py-2.5 text-sm font-semibold text-foreground shadow-sm outline-none transition-colors focus:border-foreground/30">
															{rec.allCandidates.slice(0, 12).map((c) => (
																<option key={c.modelId} value={c.modelId}>
																	{c.displayName} · {shortProvider(c.provider)} ·{" "}
																	{c.compositeScore}
																</option>
															))}
														</select>
													</div>
												</div>
												<div className="sm:col-span-2">
													<div className="grid grid-cols-3 gap-2">
														<div className="rounded-xl border border-border/50 bg-background/10 px-3 py-2">
															<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
																Success
															</p>
															<p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
																{selected ? `${selected.successRate}%` : "—"}
															</p>
														</div>
														<div className="rounded-xl border border-border/50 bg-background/10 px-3 py-2">
															<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
																Daily
															</p>
															<p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
																{selected
																	? formatDollars(selected.estimatedDailyCost)
																	: "—"}
															</p>
														</div>
														<div className="rounded-xl border border-border/50 bg-background/10 px-3 py-2">
															<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
																Time
															</p>
															<p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
																{selected
																	? formatSeconds(selected.avgTimePerTask)
																	: "—"}
															</p>
														</div>
													</div>
												</div>
											</div>
										</div>
									)
								})}
							</div>
						</div>

						<div className="lg:col-span-5">
							<div className="rounded-2xl border border-border/50 bg-background/15 p-6 backdrop-blur-sm">
								<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
									Why this works
								</p>
								<ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
									{(objective.whyItWorks ?? []).slice(0, 4).map((line) => (
										<li key={line}>- {line}</li>
									))}
								</ul>

								{objective.builderProfile?.howItWorks?.length ? (
									<>
										<p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
											How it runs
										</p>
										<ol className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
											{objective.builderProfile.howItWorks.slice(0, 4).map((step, idx) => (
												<li key={`${idx}:${step}`} className="flex gap-3">
													<span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/20 font-mono text-xs font-semibold text-foreground/80">
														{idx + 1}
													</span>
													<span>{step}</span>
												</li>
											))}
										</ol>
									</>
								) : null}

								{examplePrompt ? (
									<div className="mt-6 rounded-2xl border border-border/50 bg-background/10 p-4">
										<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											Example prompt
										</p>
										<pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-border/50 bg-background/10 p-3 text-xs leading-relaxed text-foreground/85">
											{examplePrompt}
										</pre>
									</div>
								) : null}
							</div>

							<div className="mt-6 rounded-2xl border border-border/50 bg-background/15 p-6 backdrop-blur-sm">
								<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
									Data preview
								</p>
								<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
									Composite score vs estimated daily cost for the primary agent, with dot size mapped
									to success rate.
								</p>

								<div className="mt-4 h-[320px] w-full overflow-hidden rounded-2xl border border-border/50 bg-background/10 p-3">
									<ResponsiveContainer width="100%" height="100%">
										<ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
											<XAxis
												type="number"
												dataKey="dailyCost"
												name="Daily Cost"
												tick={{ fill: "currentColor", fontSize: 12 }}
												axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
												tickLine={{ stroke: "rgba(255,255,255,0.08)" }}
											/>
											<YAxis
												type="number"
												dataKey="score"
												name="Score"
												domain={[40, 100]}
												tick={{ fill: "currentColor", fontSize: 12 }}
												axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
												tickLine={{ stroke: "rgba(255,255,255,0.08)" }}
											/>
											<ZAxis type="number" dataKey="dotSize" range={[60, 360]} />
											<Tooltip content={<ObjectiveTooltip />} />
											<Scatter data={primaryScatter} fill="#3b82f6">
												{primaryScatter.map((d, i) => (
													<Cell
														key={i}
														fill={d.isSelected ? "#22c55e" : "#3b82f6"}
														stroke={
															d.isSelected
																? "rgba(34,197,94,0.65)"
																: "rgba(59,130,246,0.35)"
														}
														strokeWidth={d.isSelected ? 2 : 1}
													/>
												))}
											</Scatter>
										</ScatterChart>
									</ResponsiveContainer>
								</div>

								<div className="mt-4">
									<Link
										href={
											primaryRoleId
												? `/evals/recommendations/roles/${primaryRoleId}/compare${roleQuery}`
												: "/evals/recommendations"
										}
										className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/10 px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-background/20 hover:text-foreground">
										Compare the full set
										<ArrowRight className="size-4" />
									</Link>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	)
}
