"use client"

import { motion } from "framer-motion"
import {
	ArrowRight,
	FlaskConical,
	Code,
	AlertTriangle,
	BarChart3,
	Terminal,
	ExternalLink,
	CheckCircle2,
	Beaker,
	Timer,
	DollarSign,
	Zap,
	Trophy,
	Scale,
} from "lucide-react"
import Link from "next/link"

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

// ── Section Number Marker ───────────────────────────────────────────────────

function SectionNumber({ num }: { num: string }) {
	return (
		<span className="font-mono text-5xl font-black tracking-tighter text-foreground/[0.15] dark:text-foreground/[0.18] md:text-7xl">
			{num}
		</span>
	)
}

// ── Process Step Icon ───────────────────────────────────────────────────────

function ProcessStep({
	icon: Icon,
	label,
	isLast,
}: {
	icon: React.ComponentType<{ className?: string }>
	label: string
	isLast?: boolean
}) {
	return (
		<div className="flex items-center gap-3">
			<div className="flex flex-col items-center gap-1">
				<div className="flex size-12 items-center justify-center rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm">
					<Icon className="size-5 text-foreground/70" />
				</div>
				<span className="text-[11px] font-medium text-muted-foreground">{label}</span>
			</div>
			{!isLast && (
				<div className="mb-5 flex items-center">
					<div className="h-px w-6 bg-gradient-to-r from-border to-border/30 sm:w-10" />
					<ArrowRight className="size-3 text-muted-foreground/50" />
				</div>
			)}
		</div>
	)
}

// ── Language Card ───────────────────────────────────────────────────────────

function LanguageCard({ name, color }: { name: string; color: string }) {
	return (
		<div className="group flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-4 py-4 backdrop-blur-sm transition-all duration-200 hover:border-border hover:bg-card/80">
			<div className={`flex size-10 items-center justify-center rounded-lg ${color}`}>
				<span className="text-sm font-bold text-white">{name.slice(0, 2).toUpperCase()}</span>
			</div>
			<span className="text-xs font-medium text-muted-foreground">{name}</span>
		</div>
	)
}

// ── Scoring Bar Component ───────────────────────────────────────────────────

function ScoringBar({
	label,
	icon: Icon,
	color,
	bgColor,
	weight,
	description,
}: {
	label: string
	icon: React.ComponentType<{ className?: string }>
	color: string
	bgColor: string
	weight: number
	description: string
}) {
	return (
		<div className="flex items-start gap-4 rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
			<div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${bgColor}`}>
				<Icon className={`size-5 ${color}`} />
			</div>
			<div className="flex-1">
				<div className="flex items-baseline justify-between">
					<p className="text-sm font-semibold text-foreground">{label}</p>
					<span className="font-mono text-xs font-bold text-muted-foreground">{weight}%</span>
				</div>
				<p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
				<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
					<motion.div
						className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
						initial={{ width: 0 }}
						whileInView={{ width: `${weight}%` }}
						viewport={{ once: true }}
						transition={{ duration: 0.8, ease: [0.21, 0.45, 0.27, 0.9], delay: 0.3 }}
					/>
				</div>
			</div>
		</div>
	)
}

// ── Main Content Component ──────────────────────────────────────────────────

export function MethodologyContent() {
	return (
		<>
			{/* ════════════════════════════════════════════════════════════════
			    HERO SECTION
			    ════════════════════════════════════════════════════════════════ */}
			<section className="relative flex flex-col items-center overflow-hidden pt-32 pb-20">
				{/* Atmospheric blur background */}
				<motion.div
					className="absolute inset-0"
					initial="hidden"
					animate="visible"
					variants={backgroundVariants}>
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
						<div className="absolute left-[35%] top-[45%] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/8 dark:bg-blue-600/15 blur-[120px]" />
						<div className="absolute left-[55%] top-[40%] h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/6 dark:bg-indigo-600/10 blur-[140px]" />
						<div className="absolute left-[70%] top-[55%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500/5 dark:bg-slate-400/8 blur-[100px]" />
					</div>
				</motion.div>

				<div className="container relative z-10 mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div
						className="mx-auto max-w-3xl text-center"
						initial="hidden"
						animate="visible"
						variants={containerVariants}>
						{/* Breadcrumb */}
						<motion.nav
							className="mb-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"
							variants={fadeUpVariants}>
							<Link href="/evals" className="transition-colors hover:text-foreground">
								Evals
							</Link>
							<span className="text-border">/</span>
							<Link href="/evals/workers" className="transition-colors hover:text-foreground">
								Hire an AI Engineer
							</Link>
							<span className="text-border">/</span>
							<span className="font-medium text-foreground">How We Interview</span>
						</motion.nav>

						{/* Heading */}
						<motion.h1
							className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl"
							variants={fadeUpVariants}>
							How We Interview{" "}
							<span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
								AI Models
							</span>
						</motion.h1>

						{/* Subtitle */}
						<motion.p
							className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl"
							variants={fadeUpVariants}>
							Same exercises, same environment, same scoring for every model. Every step is documented and
							every eval run is reproducible.
						</motion.p>

						{/* Pill badge links */}
						<motion.div
							className="mt-8 flex flex-wrap items-center justify-center gap-3"
							variants={fadeUpVariants}>
							<Link
								href="/evals/workers"
								className="group inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:border-border hover:text-foreground">
								<Trophy className="size-4" />
								View recommendations
								<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
							</Link>
							<Link
								href="/evals"
								className="group inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:border-border hover:text-foreground">
								<FlaskConical className="size-4" />
								Raw eval data
								<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
							</Link>
						</motion.div>
					</motion.div>
				</div>
			</section>

			{/* ════════════════════════════════════════════════════════════════
			    SECTION 01: THE INTERVIEW PROCESS
			    ════════════════════════════════════════════════════════════════ */}
			<motion.section
				className="relative overflow-hidden border-t border-border/30 py-20"
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, margin: "-100px" }}
				variants={containerVariants}>
				<div className="container mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div variants={fadeUpVariants}>
						<SectionNumber num="01" />
					</motion.div>

					<motion.h2
						className="-mt-3 text-3xl font-bold tracking-tight md:text-4xl"
						variants={fadeUpVariants}>
						The Interview Process
					</motion.h2>

					<motion.div
						className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
						variants={fadeUpVariants}>
						<p>
							We don&apos;t test models in isolation. We test them as they work inside Roo Code. Each
							model gets the same exercises, same time limit, same tools. We measure what matters.
						</p>
					</motion.div>

					{/* Process flow */}
					<motion.div
						className="mt-10 flex flex-wrap items-start justify-center gap-2 sm:gap-0"
						variants={fadeUpVariants}>
						<ProcessStep icon={Beaker} label="Exercise" />
						<ProcessStep icon={Code} label="Roo Code" />
						<ProcessStep icon={CheckCircle2} label="Test Suite" />
						<ProcessStep icon={BarChart3} label="Score" isLast />
					</motion.div>

					{/* Key principles */}
					<motion.div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3" variants={containerVariants}>
						{[
							{
								title: "Identical Environment",
								desc: "Docker container with VS Code, Roo Code extension, and a fresh workspace per exercise.",
							},
							{
								title: "No Cherry-Picking",
								desc: "Every model gets the exact same interview. No curated demos, no special treatment.",
							},
							{
								title: "Real Metrics",
								desc: "Does it pass the tests? How much does it cost? How fast does it deliver?",
							},
						].map((item) => (
							<motion.div
								key={item.title}
								className="rounded-xl border border-border/50 bg-card/50 p-5 backdrop-blur-sm"
								variants={cardVariants}>
								<p className="text-sm font-semibold text-foreground">{item.title}</p>
								<p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
							</motion.div>
						))}
					</motion.div>
				</div>
			</motion.section>

			{/* ════════════════════════════════════════════════════════════════
			    SECTION 02: THE INTERVIEW SUITE
			    ════════════════════════════════════════════════════════════════ */}
			<motion.section
				className="relative overflow-hidden border-t border-border/30 py-20"
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, margin: "-100px" }}
				variants={containerVariants}>
				{/* Subtle background glow */}
				<motion.div className="absolute inset-0" variants={backgroundVariants}>
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
						<div className="absolute left-1/2 top-1/2 h-[600px] w-full -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-foreground/[0.015] dark:bg-foreground/[0.025] blur-[80px]" />
					</div>
				</motion.div>

				<div className="container relative z-10 mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div variants={fadeUpVariants}>
						<SectionNumber num="02" />
					</motion.div>

					<motion.h2
						className="-mt-3 text-3xl font-bold tracking-tight md:text-4xl"
						variants={fadeUpVariants}>
						The Interview Suite
					</motion.h2>

					<motion.p
						className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
						variants={fadeUpVariants}>
						Hundreds of coding exercises across <strong className="text-foreground">5 languages</strong> and{" "}
						<strong className="text-foreground">3 difficulty tiers</strong>. From single-file fixes to
						complex architecture decisions.
					</motion.p>

					{/* Language cards */}
					<motion.div className="mt-10 grid grid-cols-5 gap-3" variants={containerVariants}>
						<motion.div variants={cardVariants}>
							<LanguageCard name="Go" color="bg-cyan-600" />
						</motion.div>
						<motion.div variants={cardVariants}>
							<LanguageCard name="Java" color="bg-orange-600" />
						</motion.div>
						<motion.div variants={cardVariants}>
							<LanguageCard name="JavaScript" color="bg-yellow-500" />
						</motion.div>
						<motion.div variants={cardVariants}>
							<LanguageCard name="Python" color="bg-green-600" />
						</motion.div>
						<motion.div variants={cardVariants}>
							<LanguageCard name="Rust" color="bg-red-600" />
						</motion.div>
					</motion.div>

					{/* Difficulty tiers */}
					<motion.div className="mt-10" variants={fadeUpVariants}>
						<h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Difficulty Tiers
						</h3>
						<div className="overflow-hidden rounded-xl border border-border/50 backdrop-blur-sm">
							{/* Easy */}
							<div className="flex items-center gap-4 border-b border-border/30 bg-card/50 p-4 sm:p-5">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 dark:bg-green-500/15">
									<span className="text-sm font-bold text-green-600 dark:text-green-400">E</span>
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-foreground">Easy</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										Single-file fixes, straightforward implementations, basic debugging
									</p>
								</div>
								<div className="hidden shrink-0 items-center gap-3 sm:flex">
									<span className="min-w-[80px] text-right font-mono text-sm font-bold text-green-600 dark:text-green-400">
										90–95%
									</span>
									<div className="h-2 w-32 overflow-hidden rounded-full bg-green-500/10">
										<motion.div
											className="h-full rounded-full bg-green-500"
											initial={{ width: 0 }}
											whileInView={{ width: "92%" }}
											viewport={{ once: true }}
											transition={{ duration: 0.8, delay: 0.2 }}
										/>
									</div>
								</div>
							</div>
							{/* Medium */}
							<div className="flex items-center gap-4 border-b border-border/30 bg-card/30 p-4 sm:p-5">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10 dark:bg-yellow-500/15">
									<span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">M</span>
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-foreground">Medium</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										Multi-file changes, refactoring, cross-file understanding
									</p>
								</div>
								<div className="hidden shrink-0 items-center gap-3 sm:flex">
									<span className="min-w-[80px] text-right font-mono text-sm font-bold text-yellow-600 dark:text-yellow-400">
										60–80%
									</span>
									<div className="h-2 w-32 overflow-hidden rounded-full bg-yellow-500/10">
										<motion.div
											className="h-full rounded-full bg-yellow-500"
											initial={{ width: 0 }}
											whileInView={{ width: "70%" }}
											viewport={{ once: true }}
											transition={{ duration: 0.8, delay: 0.3 }}
										/>
									</div>
								</div>
							</div>
							{/* Hard */}
							<div className="flex items-center gap-4 bg-card/20 p-4 sm:p-5">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 dark:bg-red-500/15">
									<span className="text-sm font-bold text-red-600 dark:text-red-400">H</span>
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-foreground">Hard</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										Architecture decisions, ambiguous requirements, complex system design
									</p>
								</div>
								<div className="hidden shrink-0 items-center gap-3 sm:flex">
									<span className="min-w-[80px] text-right font-mono text-sm font-bold text-red-600 dark:text-red-400">
										30–50%
									</span>
									<div className="h-2 w-32 overflow-hidden rounded-full bg-red-500/10">
										<motion.div
											className="h-full rounded-full bg-red-500"
											initial={{ width: 0 }}
											whileInView={{ width: "40%" }}
											viewport={{ once: true }}
											transition={{ duration: 0.8, delay: 0.4 }}
										/>
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				</div>
			</motion.section>

			{/* ════════════════════════════════════════════════════════════════
			    SECTION 03: ENGINEER ROLES
			    ════════════════════════════════════════════════════════════════ */}
			<motion.section
				className="relative overflow-hidden border-t border-border/30 py-20"
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, margin: "-100px" }}
				variants={containerVariants}>
				<div className="container mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div variants={fadeUpVariants}>
						<SectionNumber num="03" />
					</motion.div>

					<motion.h2
						className="-mt-3 text-3xl font-bold tracking-tight md:text-4xl"
						variants={fadeUpVariants}>
						Engineer Roles
					</motion.h2>

					<motion.div
						className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
						variants={fadeUpVariants}>
						<p>
							Each role represents a different engineering seniority level. We test models against
							exercises matched to that role&apos;s complexity, then score using role-specific weights.
						</p>
					</motion.div>

					{/* How weights differ */}
					<motion.div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2" variants={containerVariants}>
						<motion.div
							className="rounded-xl border border-border/50 bg-card/50 p-5 backdrop-blur-sm"
							variants={cardVariants}>
							<p className="text-sm font-semibold text-foreground">Different Roles, Different Weights</p>
							<p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
								Each role has its own scoring weights. A model that&apos;s great for simple tasks might
								not rank for architecture decisions.
							</p>
						</motion.div>
						<motion.div
							className="rounded-xl border border-border/50 bg-card/50 p-5 backdrop-blur-sm"
							variants={cardVariants}>
							<p className="text-sm font-semibold text-foreground">Matched Exercises</p>
							<p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
								Budget roles get simpler exercises. Complex roles get harder ones. The difficulty and
								scoring shift together so recommendations stay relevant.
							</p>
						</motion.div>
					</motion.div>

					{/* Budget vs Complex comparison */}
					<motion.div className="mt-8" variants={fadeUpVariants}>
						<h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							How Scoring Weights Shift
						</h3>
						<div className="overflow-hidden rounded-xl border border-border/50 backdrop-blur-sm">
							{/* Budget roles */}
							<div className="flex items-center gap-4 border-b border-border/30 bg-card/50 p-4 sm:p-5">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
									<DollarSign className="size-5 text-emerald-600 dark:text-emerald-400" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-foreground">Budget Roles</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										Cost and speed matter most. Simpler exercises where many models succeed, so
										efficiency breaks the tie.
									</p>
								</div>
								<div className="hidden shrink-0 sm:block">
									<div className="flex h-3 w-40 overflow-hidden rounded-full">
										<div className="bg-green-500/70" style={{ width: "30%" }} title="Success" />
										<div className="bg-blue-500/70" style={{ width: "10%" }} title="Quality" />
										<div className="bg-amber-500" style={{ width: "40%" }} title="Cost" />
										<div className="bg-purple-500" style={{ width: "20%" }} title="Speed" />
									</div>
									<div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
										<span>Success</span>
										<span>Quality</span>
										<span className="font-semibold text-amber-600 dark:text-amber-400">Cost ↑</span>
										<span>Speed</span>
									</div>
								</div>
							</div>
							{/* Complex roles */}
							<div className="flex items-center gap-4 bg-card/30 p-4 sm:p-5">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
									<Scale className="size-5 text-violet-600 dark:text-violet-400" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-foreground">Complex Roles</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										Reasoning quality and success rate matter most. Harder exercises where only the
										best models deliver.
									</p>
								</div>
								<div className="hidden shrink-0 sm:block">
									<div className="flex h-3 w-40 overflow-hidden rounded-full">
										<div className="bg-green-500" style={{ width: "40%" }} title="Success" />
										<div className="bg-blue-500" style={{ width: "30%" }} title="Quality" />
										<div className="bg-amber-500/70" style={{ width: "15%" }} title="Cost" />
										<div className="bg-purple-500/70" style={{ width: "15%" }} title="Speed" />
									</div>
									<div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
										<span className="font-semibold text-green-600 dark:text-green-400">
											Success ↑
										</span>
										<span className="font-semibold text-blue-600 dark:text-blue-400">
											Quality ↑
										</span>
										<span>Cost</span>
										<span>Speed</span>
									</div>
								</div>
							</div>
						</div>
					</motion.div>

					{/* Link to roles page */}
					<motion.div className="mt-8" variants={fadeUpVariants}>
						<Link
							href="/evals/workers"
							className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
							Browse all engineer roles
							<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
						</Link>
					</motion.div>
				</div>
			</motion.section>

			{/* ════════════════════════════════════════════════════════════════
			    SECTION 04: SCORING
			    ════════════════════════════════════════════════════════════════ */}
			<motion.section
				className="relative overflow-hidden border-t border-border/30 py-20"
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, margin: "-100px" }}
				variants={containerVariants}>
				{/* Background glow */}
				<motion.div className="absolute inset-0" variants={backgroundVariants}>
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
						<div className="absolute left-1/2 top-1/2 h-[600px] w-full -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-foreground/[0.015] dark:bg-foreground/[0.025] blur-[80px]" />
					</div>
				</motion.div>

				<div className="container relative z-10 mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div variants={fadeUpVariants}>
						<SectionNumber num="04" />
					</motion.div>

					<motion.h2
						className="-mt-3 text-3xl font-bold tracking-tight md:text-4xl"
						variants={fadeUpVariants}>
						Scoring
					</motion.h2>

					<motion.p
						className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
						variants={fadeUpVariants}>
						Each model receives a <strong className="text-foreground">composite score</strong>, a weighted
						sum of four dimensions normalized to a 0–100 scale.
					</motion.p>

					{/* Scoring formula components */}
					<motion.div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2" variants={containerVariants}>
						<motion.div variants={cardVariants}>
							<ScoringBar
								label="Success Rate"
								icon={CheckCircle2}
								color="text-green-500"
								bgColor="bg-green-500/10 dark:bg-green-500/15"
								weight={40}
								description="Percentage of exercises where the model produces code that passes all tests."
							/>
						</motion.div>
						<motion.div variants={cardVariants}>
							<ScoringBar
								label="Code Quality"
								icon={Zap}
								color="text-blue-500"
								bgColor="bg-blue-500/10 dark:bg-blue-500/15"
								weight={25}
								description="Structure, readability, and adherence to best practices of produced code."
							/>
						</motion.div>
						<motion.div variants={cardVariants}>
							<ScoringBar
								label="Cost Efficiency"
								icon={DollarSign}
								color="text-amber-500"
								bgColor="bg-amber-500/10 dark:bg-amber-500/15"
								weight={20}
								description="Average API cost per task. Lower cost with equal quality ranks higher."
							/>
						</motion.div>
						<motion.div variants={cardVariants}>
							<ScoringBar
								label="Speed"
								icon={Timer}
								color="text-purple-500"
								bgColor="bg-purple-500/10 dark:bg-purple-500/15"
								weight={15}
								description="Average time to complete each task. Faster completion ranks higher."
							/>
						</motion.div>
					</motion.div>

					{/* Tier classification */}
					<motion.div className="mt-14" variants={fadeUpVariants}>
						<h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Recommendation Tiers
						</h3>
						<p className="mb-6 text-sm text-muted-foreground">
							Composite scores are mapped to recommendation tiers:
						</p>
					</motion.div>

					<motion.div
						className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
						variants={containerVariants}>
						{/* Best */}
						<motion.div
							className="relative overflow-hidden rounded-xl border border-green-500/20 bg-green-500/[0.04] p-5 backdrop-blur-sm dark:bg-green-500/[0.06]"
							variants={cardVariants}>
							<div className="absolute right-3 top-3 font-mono text-3xl font-black text-green-500/10 dark:text-green-500/15">
								≥85
							</div>
							<div className="relative z-10">
								<span className="inline-block rounded-md bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
									Best
								</span>
								<p className="mt-3 text-sm font-medium text-foreground">Top Performer</p>
								<p className="mt-1 text-xs text-muted-foreground">Highly recommended for this role.</p>
							</div>
						</motion.div>

						{/* Recommended */}
						<motion.div
							className="relative overflow-hidden rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-5 backdrop-blur-sm dark:bg-blue-500/[0.06]"
							variants={cardVariants}>
							<div className="absolute right-3 top-3 font-mono text-3xl font-black text-blue-500/10 dark:text-blue-500/15">
								70–84
							</div>
							<div className="relative z-10">
								<span className="inline-block rounded-md bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
									Recommended
								</span>
								<p className="mt-3 text-sm font-medium text-foreground">Solid Choice</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Reliable for most tasks at this level.
								</p>
							</div>
						</motion.div>

						{/* Situational */}
						<motion.div
							className="relative overflow-hidden rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04] p-5 backdrop-blur-sm dark:bg-yellow-500/[0.06]"
							variants={cardVariants}>
							<div className="absolute right-3 top-3 font-mono text-3xl font-black text-yellow-500/10 dark:text-yellow-500/15">
								50–69
							</div>
							<div className="relative z-10">
								<span className="inline-block rounded-md bg-yellow-500/15 px-2.5 py-0.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400">
									Situational
								</span>
								<p className="mt-3 text-sm font-medium text-foreground">Usable with Caveats</p>
								<p className="mt-1 text-xs text-muted-foreground">May struggle in specific areas.</p>
							</div>
						</motion.div>

						{/* Not Recommended */}
						<motion.div
							className="relative overflow-hidden rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5 backdrop-blur-sm dark:bg-red-500/[0.06]"
							variants={cardVariants}>
							<div className="absolute right-3 top-3 font-mono text-3xl font-black text-red-500/10 dark:text-red-500/15">
								&lt;50
							</div>
							<div className="relative z-10">
								<span className="inline-block rounded-md bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
									Not Recommended
								</span>
								<p className="mt-3 text-sm font-medium text-foreground">High Failure Rate</p>
								<p className="mt-1 text-xs text-muted-foreground">Not suitable for this role.</p>
							</div>
						</motion.div>
					</motion.div>

					<motion.p className="mt-8 text-sm leading-relaxed text-muted-foreground" variants={fadeUpVariants}>
						Per-language breakdowns reveal where each model excels or struggles. A model might score well
						overall but underperform in Rust, or dominate in Python but lag in Go.
					</motion.p>
				</div>
			</motion.section>

			{/* ════════════════════════════════════════════════════════════════
			    SECTION 05: RUN YOUR OWN INTERVIEWS
			    ════════════════════════════════════════════════════════════════ */}
			<motion.section
				className="relative overflow-hidden border-t border-border/30 py-20"
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, margin: "-100px" }}
				variants={containerVariants}>
				<div className="container mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div variants={fadeUpVariants}>
						<SectionNumber num="05" />
					</motion.div>

					<motion.h2
						className="-mt-3 text-3xl font-bold tracking-tight md:text-4xl"
						variants={fadeUpVariants}>
						Run Your Own Interviews
					</motion.h2>

					<motion.p
						className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
						variants={fadeUpVariants}>
						Our evaluation framework is fully open source. Run the exact same interviews on your own
						infrastructure, with your own API keys, against any model.
					</motion.p>

					{/* Terminal card */}
					<motion.div
						className="mt-10 overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm"
						variants={cardVariants}>
						{/* Terminal header */}
						<div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-3">
							<div className="flex gap-1.5">
								<div className="size-3 rounded-full bg-red-500/60" />
								<div className="size-3 rounded-full bg-yellow-500/60" />
								<div className="size-3 rounded-full bg-green-500/60" />
							</div>
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Terminal className="size-3.5" />
								<span>terminal</span>
							</div>
						</div>
						{/* Terminal body */}
						<div className="p-5 font-mono text-sm leading-relaxed">
							<div className="text-muted-foreground">
								<span className="text-green-500">$</span>{" "}
								<span className="text-foreground">git clone</span>{" "}
								<span className="text-blue-400">https://github.com/RooCodeInc/Roo-Code-Evals.git</span>
							</div>
							<div className="mt-1 text-muted-foreground">
								<span className="text-green-500">$</span> <span className="text-foreground">cd</span>{" "}
								<span className="text-blue-400">Roo-Code-Evals</span>
							</div>
							<div className="mt-1 text-muted-foreground">
								<span className="text-green-500">$</span>{" "}
								<span className="text-foreground/50"># Follow the README for setup instructions</span>
							</div>
						</div>
					</motion.div>

					{/* GitHub link */}
					<motion.div className="mt-6" variants={fadeUpVariants}>
						<a
							href="https://github.com/RooCodeInc/Roo-Code-Evals"
							target="_blank"
							rel="noopener noreferrer"
							className="group inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-5 py-2.5 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:border-border hover:text-foreground">
							<svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
							</svg>
							View on GitHub
							<ExternalLink className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
						</a>
					</motion.div>
				</div>
			</motion.section>

			{/* ════════════════════════════════════════════════════════════════
			    SECTION 06: LIMITATIONS
			    ════════════════════════════════════════════════════════════════ */}
			<motion.section
				className="relative overflow-hidden border-t border-border/30 py-20"
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, margin: "-100px" }}
				variants={containerVariants}>
				<div className="container mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div variants={fadeUpVariants}>
						<SectionNumber num="06" />
					</motion.div>

					<motion.h2
						className="-mt-3 text-3xl font-bold tracking-tight md:text-4xl"
						variants={fadeUpVariants}>
						Limitations
					</motion.h2>

					<motion.p
						className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
						variants={fadeUpVariants}>
						Every evaluation has blind spots. These are ours.
					</motion.p>

					<motion.ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2" variants={containerVariants}>
						{[
							{
								title: "Single test environment",
								description:
									"All evals run in Docker + VS Code. Results may differ in other IDEs or environments.",
							},
							{
								title: "Expanding exercise coverage",
								description:
									"Hundreds of exercises, but the suite is continuously growing. Some niche patterns may be underrepresented.",
							},
							{
								title: "API changes affect results",
								description:
									"Providers update their models. A model that scored well last month may behave differently after an update.",
							},
							{
								title: "Point-in-time snapshots",
								description:
									'Each eval run captures performance at a specific point. We re-run regularly; check the "last updated" date.',
							},
						].map((item) => (
							<motion.li
								key={item.title}
								className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4 backdrop-blur-sm dark:bg-amber-500/[0.05]"
								variants={cardVariants}>
								<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
								<div>
									<p className="text-sm font-medium text-foreground">{item.title}</p>
									<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
										{item.description}
									</p>
								</div>
							</motion.li>
						))}
					</motion.ul>
				</div>
			</motion.section>

			{/* ════════════════════════════════════════════════════════════════
			    BOTTOM NAVIGATION
			    ════════════════════════════════════════════════════════════════ */}
			<section className="border-t border-border/50 pb-24 pt-16">
				<div className="container mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8">
					<motion.div
						className="mx-auto max-w-2xl text-center"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						variants={containerVariants}>
						<motion.p className="mb-6 text-sm text-muted-foreground" variants={fadeUpVariants}>
							Ready to see the results?
						</motion.p>
						<motion.div
							className="flex flex-wrap items-center justify-center gap-4"
							variants={fadeUpVariants}>
							<Link
								href="/evals/workers"
								className="group inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-5 py-2.5 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:border-border hover:text-foreground">
								<Trophy className="size-4" />
								View recommendations
								<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
							</Link>
							<Link
								href="/evals"
								className="group inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-5 py-2.5 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:border-border hover:text-foreground">
								<FlaskConical className="size-4" />
								Raw eval data
								<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
							</Link>
						</motion.div>
					</motion.div>
				</div>
			</section>
		</>
	)
}
