"use client"

import { motion } from "framer-motion"
import { AlertTriangle, CheckCircle2, Scale, Timer, Zap } from "lucide-react"
import Link from "next/link"

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.12,
			delayChildren: 0.08,
		},
	},
}

const fadeUpVariants = {
	hidden: { opacity: 0, y: 18 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.55, ease: [0.21, 0.45, 0.27, 0.9] as const },
	},
}

const backgroundVariants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: { duration: 1.1, ease: "easeOut" as const } },
}

function InlineArrow() {
	return (
		<span aria-hidden className="inline-block text-sm leading-none text-muted-foreground/70">
			→
		</span>
	)
}

function Chip({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
	return (
		<span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-3.5 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm">
			<Icon className="size-4 text-foreground/65" />
			{label}
		</span>
	)
}

function Callout({
	icon: Icon,
	title,
	body,
	tone = "neutral",
}: {
	icon: React.ComponentType<{ className?: string }>
	title: string
	body: string
	tone?: "neutral" | "warning" | "success"
}) {
	const toneClasses =
		tone === "warning"
			? "border-amber-500/20 bg-amber-500/5"
			: tone === "success"
				? "border-emerald-500/20 bg-emerald-500/5"
				: "border-border/50 bg-card/40"

	return (
		<div className={`rounded-2xl border p-5 backdrop-blur-sm ${toneClasses}`}>
			<div className="flex items-start gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/25">
					<Icon className="size-5 text-foreground/70" />
				</div>
				<div className="min-w-0">
					<p className="text-sm font-semibold text-foreground">{title}</p>
					<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
				</div>
			</div>
		</div>
	)
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
	return (
		<div className="flex items-start gap-4 rounded-2xl border border-border/50 bg-card/35 p-5 backdrop-blur-sm">
			<span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/25 font-mono text-sm font-semibold text-foreground/85">
				{num}
			</span>
			<div className="min-w-0">
				<p className="text-sm font-semibold text-foreground">{title}</p>
				<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
			</div>
		</div>
	)
}

function SmallLink({ href, label }: { href: string; label: string }) {
	return (
		<Link
			href={href}
			className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground underline decoration-border/60 underline-offset-4 transition-colors hover:text-foreground hover:decoration-border">
			{label} <InlineArrow />
		</Link>
	)
}

export function MethodologyContent() {
	return (
		<>
			{/* Hero */}
			<section className="relative overflow-hidden pb-24 pt-28">
				<motion.div
					initial="hidden"
					animate="visible"
					variants={backgroundVariants}
					className="absolute inset-0">
					<div className="absolute inset-0 opacity-[0.6]" aria-hidden />
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
						<div className="absolute left-[28%] top-[40%] h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/8 blur-[130px]" />
						<div className="absolute left-[55%] top-[36%] h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/6 blur-[150px]" />
						<div className="absolute left-[72%] top-[55%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/5 blur-[120px]" />
					</div>
					<div
						className="pointer-events-none absolute inset-0 opacity-[0.35]"
						aria-hidden
						style={{
							backgroundImage:
								"linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
							backgroundSize: "96px 96px",
							maskImage: "radial-gradient(circle at 50% 35%, black 12%, transparent 70%)",
							WebkitMaskImage: "radial-gradient(circle at 50% 35%, black 12%, transparent 70%)",
						}}
					/>
				</motion.div>

				<div className="container relative z-10 mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
					<motion.div
						initial="hidden"
						animate="visible"
						variants={containerVariants}
						className="mx-auto max-w-6xl">
						<div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end">
							<div className="lg:col-span-7">
								<motion.nav
									variants={fadeUpVariants}
									className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
									<Link href="/evals" className="transition-colors hover:text-foreground">
										Evals
									</Link>
									<span className="text-border">/</span>
									<Link
										href="/evals/recommendations"
										className="transition-colors hover:text-foreground">
										Recommendations
									</Link>
									<span className="text-border">/</span>
									<span className="font-medium text-foreground">Methodology</span>
								</motion.nav>

								<motion.p
									variants={fadeUpVariants}
									className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
									Read this before you compare models
								</motion.p>

								<motion.h1
									variants={fadeUpVariants}
									className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl [font-family:var(--font-display)]">
									How we run evals
								</motion.h1>

								<motion.p
									variants={fadeUpVariants}
									className="mt-4 max-w-[72ch] text-lg leading-relaxed text-muted-foreground md:text-xl">
									We keep tasks, environment, and scoring constant across models. Use our results to
									pick a default for a specific objective, then validate in your repo.
								</motion.p>

								<motion.div variants={fadeUpVariants} className="mt-8 flex flex-wrap gap-2.5">
									<Chip icon={Scale} label="Same tasks for every model" />
									<Chip icon={Timer} label="Fixed time limit per run" />
									<Chip icon={Zap} label="Quality / Speed / Cost tradeoffs" />
								</motion.div>

								<motion.div
									variants={fadeUpVariants}
									className="mt-10 flex flex-wrap items-center gap-5">
									<Link
										href="/evals/recommendations"
										className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground/20 bg-foreground/5 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/10">
										View recommendations <InlineArrow />
									</Link>
									<Link
										href="/evals"
										className="inline-flex items-center justify-center gap-2 rounded-full border border-border/60 bg-card/40 px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground">
										Raw eval data <InlineArrow />
									</Link>
								</motion.div>

								<motion.div
									variants={fadeUpVariants}
									className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
									<span className="text-muted-foreground">Jump to:</span>
									<a
										href="#constants"
										className="font-medium text-muted-foreground underline decoration-border/60 underline-offset-4 transition-colors hover:text-foreground hover:decoration-border">
										What we hold constant
									</a>
									<a
										href="#scoring"
										className="font-medium text-muted-foreground underline decoration-border/60 underline-offset-4 transition-colors hover:text-foreground hover:decoration-border">
										Scoring
									</a>
									<a
										href="#limits"
										className="font-medium text-muted-foreground underline decoration-border/60 underline-offset-4 transition-colors hover:text-foreground hover:decoration-border">
										Limitations
									</a>
								</motion.div>
							</div>

							<motion.aside variants={fadeUpVariants} className="lg:col-span-5">
								<div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/35 p-6 backdrop-blur-sm">
									<div
										aria-hidden
										className="pointer-events-none absolute inset-0 opacity-[0.5]"
										style={{
											backgroundImage:
												"radial-gradient(circle at 18% 18%, rgba(59,130,246,0.16), transparent 55%), radial-gradient(circle at 78% 35%, rgba(16,185,129,0.12), transparent 55%), linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
											backgroundSize: "auto, auto, 84px 84px, 84px 84px",
										}}
									/>

									<div className="relative">
										<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
											Methodology at a glance
										</p>
										<h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
											Comparable results, not universal truth
										</h2>

										<div className="mt-5 grid grid-cols-1 gap-3">
											<div className="rounded-xl border border-border/50 bg-background/10 p-4">
												<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
													We hold constant
												</p>
												<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
													Same exercises, same tools, same time limit, same scoring.
												</p>
											</div>
											<div className="rounded-xl border border-border/50 bg-background/10 p-4">
												<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
													We measure
												</p>
												<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
													Pass rate, latency, and cost signals across multiple languages.
												</p>
											</div>
											<div className="rounded-xl border border-border/50 bg-background/10 p-4">
												<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
													We recommend
												</p>
												<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
													A default model and agent lineup for an objective. It&rsquo;s a
													baseline, not a guarantee.
												</p>
											</div>
										</div>

										<div className="mt-6 flex flex-wrap gap-2.5">
											<span className="rounded-full border border-border/50 bg-background/15 px-3 py-1 text-xs font-medium text-muted-foreground">
												Objective-first
											</span>
											<span className="rounded-full border border-border/50 bg-background/15 px-3 py-1 text-xs font-medium text-muted-foreground">
												Optimized for: Quality / Speed / Cost
											</span>
											<span className="rounded-full border border-border/50 bg-background/15 px-3 py-1 text-xs font-medium text-muted-foreground">
												Validate in your repo
											</span>
										</div>
									</div>
								</div>
							</motion.aside>
						</div>
					</motion.div>
				</div>
			</section>

			{/* Body */}
			<section className="relative overflow-hidden border-t border-border/40 pb-28 pt-20">
				<div className="container relative z-10 mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
					<motion.div
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true, margin: "-120px" }}
						variants={containerVariants}
						className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-12">
						{/* Left rail */}
						<motion.div variants={fadeUpVariants} className="lg:col-span-5">
							<div className="lg:sticky lg:top-24">
								<h2 className="text-2xl font-semibold tracking-tight [font-family:var(--font-display)]">
									How to read results responsibly
								</h2>
								<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
									Evals help you pick a better default. They don&rsquo;t predict how a model behaves
									in your repo, with your tests, tooling, and constraints.
								</p>

								<div className="mt-6 space-y-3">
									<Callout
										icon={CheckCircle2}
										tone="success"
										title="Good for"
										body="Choosing a default setup for a workflow (Idea → Prototype, Issue → PR, Bug Report → Fix)."
									/>
									<Callout
										icon={AlertTriangle}
										tone="warning"
										title="Not a promise"
										body="Treat results as a baseline. Validate with your objective in Roo Code Cloud."
									/>
								</div>

								<nav className="mt-8 rounded-2xl border border-border/50 bg-background/10 p-5 backdrop-blur-sm">
									<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										On this page
									</p>
									<div className="mt-3 grid gap-2 text-sm">
										<a
											className="text-muted-foreground underline decoration-border/60 underline-offset-4 transition-colors hover:text-foreground hover:decoration-border"
											href="#constants">
											What we hold constant
										</a>
										<a
											className="text-muted-foreground underline decoration-border/60 underline-offset-4 transition-colors hover:text-foreground hover:decoration-border"
											href="#scoring">
											Scoring and signals
										</a>
										<a
											className="text-muted-foreground underline decoration-border/60 underline-offset-4 transition-colors hover:text-foreground hover:decoration-border"
											href="#tradeoffs">
											Quality / Speed / Cost
										</a>
										<a
											className="text-muted-foreground underline decoration-border/60 underline-offset-4 transition-colors hover:text-foreground hover:decoration-border"
											href="#limits">
											Limitations
										</a>
									</div>
								</nav>

								<div className="mt-6 rounded-2xl border border-border/50 bg-card/35 p-5 backdrop-blur-sm">
									<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Quick definitions
									</p>
									<ul className="mt-3 space-y-2 text-sm text-muted-foreground">
										<li className="flex items-start gap-2">
											<span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
											<span className="min-w-0">
												<strong className="font-semibold text-foreground/80">Objective</strong>:
												the workflow you want to ship (for example,{" "}
												<span className="font-mono text-foreground/80">Issue → PR</span>).
											</span>
										</li>
										<li className="flex items-start gap-2">
											<span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
											<span className="min-w-0">
												<strong className="font-semibold text-foreground/80">
													Optimized for
												</strong>
												: the tradeoff you care about most (
												<span className="font-mono text-foreground/80">Quality</span>,{" "}
												<span className="font-mono text-foreground/80">Speed</span>,{" "}
												<span className="font-mono text-foreground/80">Cost</span>).
											</span>
										</li>
										<li className="flex items-start gap-2">
											<span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
											<span className="min-w-0">
												<strong className="font-semibold text-foreground/80">Pass rate</strong>:
												percent of exercises a model completes within the limit.
											</span>
										</li>
									</ul>
								</div>
							</div>
						</motion.div>

						{/* Main column */}
						<div className="lg:col-span-7">
							<motion.div variants={fadeUpVariants}>
								<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
									Methodology
								</p>
								<h2 className="mt-3 text-2xl font-semibold tracking-tight [font-family:var(--font-display)]">
									How to use these evals
								</h2>
								<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
									The recommendations page is organized around what you&rsquo;re trying to ship. You
									pick the objective and tradeoff. We show the best default setup based on the signal
									we have.
								</p>
							</motion.div>

							<div className="mt-6 space-y-3" id="constants">
								<motion.div variants={fadeUpVariants}>
									<Step
										num="1"
										title="Pick the objective"
										body="Choose a workflow that matches what you need to ship (Idea → Prototype, Issue → PR, etc.)."
									/>
								</motion.div>
								<motion.div variants={fadeUpVariants}>
									<Step
										num="2"
										title="Pick the tradeoff"
										body="Choose Quality, Speed, or Cost. You&rsquo;re telling us what to optimize for."
									/>
								</motion.div>
								<motion.div variants={fadeUpVariants}>
									<Step
										num="3"
										title="Start in Roo Code Cloud"
										body="Open the candidates, review settings, and run the work loop in your environment."
									/>
								</motion.div>
							</div>

							<motion.div variants={fadeUpVariants} className="mt-10" id="scoring">
								<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
									Scoring and signals
								</p>
								<h3 className="mt-3 text-xl font-semibold tracking-tight [font-family:var(--font-display)]">
									What we measure
								</h3>
								<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
									<Callout
										icon={CheckCircle2}
										title="Pass rate"
										body="Did the model finish the task within the limit? High pass rate matters when you need merge confidence."
									/>
									<Callout
										icon={Timer}
										title="Latency"
										body="Speed adds up in volume. Faster models can win on throughput even when quality is close."
									/>
									<Callout
										icon={Zap}
										title="Cost signal"
										body="A small $/task difference becomes a big deal at 100+ tasks/day across a team."
									/>
									<Callout
										icon={Scale}
										title="Comparable setup"
										body="We hold tasks and environment constant so comparisons are meaningful across providers."
									/>
								</div>
							</motion.div>

							<motion.div variants={fadeUpVariants} className="mt-10" id="tradeoffs">
								<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
									Tradeoffs
								</p>
								<h3 className="mt-3 text-xl font-semibold tracking-tight [font-family:var(--font-display)]">
									Quality, speed, cost: pick one to optimize
								</h3>
								<div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
									<p>
										Choosing an optimization mode is how you tell the system what matters most for
										your objective. If you care about merge confidence, optimize for Quality. If you
										care about throughput, Speed and Cost matter.
									</p>
									<p>
										When two models are close on pass rate, the most practical tie-breakers are
										latency and $/task.
									</p>
								</div>
							</motion.div>

							<motion.div variants={fadeUpVariants} className="mt-10" id="limits">
								<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
									Limitations
								</p>
								<h3 className="mt-3 text-xl font-semibold tracking-tight [font-family:var(--font-display)]">
									What these evals don&rsquo;t tell you
								</h3>
								<div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
									<p>
										A model can score well on this suite and still struggle in your repo because
										your stack, tests, dependencies, and CI constraints are different.
									</p>
									<p>
										The right move is to treat our results as a starting point, then run your
										objective end-to-end in Roo Code Cloud and inspect the PR output.
									</p>
								</div>
							</motion.div>

							<motion.div
								variants={fadeUpVariants}
								className="mt-10 rounded-2xl border border-border/50 bg-card/35 p-6 backdrop-blur-sm">
								<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
									Links
								</p>
								<div className="mt-4 flex flex-col gap-3">
									<SmallLink href="/evals/recommendations" label="Recommendations" />
									<SmallLink href="/evals" label="Raw eval data" />
								</div>
								<div className="mt-5 border-t border-border/40 pt-5">
									<p className="text-sm text-muted-foreground">
										If something feels off in the recommendations, that&rsquo;s a signal too. The
										fastest path is to run your objective in Roo Code Cloud and compare the PR
										output.
									</p>
								</div>
							</motion.div>
						</div>
					</motion.div>
				</div>
			</section>
		</>
	)
}
