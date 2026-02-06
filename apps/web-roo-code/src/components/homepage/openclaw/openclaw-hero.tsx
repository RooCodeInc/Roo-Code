"use client"

import { motion } from "framer-motion"
import { ArrowRight, Zap } from "lucide-react"
import { Button } from "@/components/ui"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function OpenClawHero() {
	return (
		<section className="relative flex flex-col items-center overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
			{/* Dual gradient glow - violet for Roo, amber for OpenClaw */}
			<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1400px] -translate-x-1/2 z-1">
				<div className="absolute left-1/3 top-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/15 dark:bg-violet-600/25 blur-[160px]" />
				<div className="absolute right-1/3 top-1/2 h-[500px] w-[600px] translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/15 dark:bg-amber-600/20 blur-[160px]" />
				<div className="absolute left-1/2 top-1/2 h-[300px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400/10 dark:bg-orange-500/15 blur-[120px]" />
			</div>

			<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
				{/* Partnership badge */}
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, ease: "easeOut" }}
					className="mb-8">
					<div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400">
						<Zap className="size-4" />
						<span>New Integration</span>
						<span className="mx-1 text-amber-500/40">|</span>
						<span>Roo Code + OpenClaw</span>
					</div>
				</motion.div>

				{/* Co-branded logos */}
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
					className="flex items-center gap-4 mb-8">
					<div className="flex items-center gap-3 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg px-5 py-3">
						<div className="size-10 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
							R
						</div>
						<span className="text-lg font-semibold">Roo Code</span>
					</div>

					<motion.div
						animate={{ rotate: [0, 5, -5, 0] }}
						transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
						className="text-2xl font-bold text-muted-foreground/60">
						+
					</motion.div>

					<div className="flex items-center gap-3 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg px-5 py-3">
						<div className="size-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
							O
						</div>
						<span className="text-lg font-semibold">OpenClaw</span>
					</div>
				</motion.div>

				{/* Main headline */}
				<motion.h1
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
					className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground max-w-5xl mb-6 leading-tight">
					Code it.{" "}
					<span className="bg-gradient-to-r from-violet-600 to-violet-500 bg-clip-text text-transparent">
						Ship it.
					</span>{" "}
					<span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
						Automate it.
					</span>
				</motion.h1>

				{/* Sub-headline */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
					className="mt-2 max-w-3xl text-lg md:text-xl text-muted-foreground mb-10 space-y-3">
					<p>
						<strong className="text-foreground">Roo Code</strong> builds your software.{" "}
						<strong className="text-foreground">OpenClaw</strong> automates everything else. Together,
						they&apos;re the AI stack that handles{" "}
						<span className="text-foreground font-medium">code to calendar</span>.
					</p>
				</motion.div>

				{/* CTAs */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
					className="flex flex-col sm:flex-row gap-4 mb-16">
					<div className="flex flex-col items-center gap-2">
						<Button
							size="xl"
							className="w-full bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-600/90 hover:to-amber-500/90 text-white border-0 shadow-lg shadow-violet-500/20">
							<a href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME} className="flex items-center justify-center">
								Explore the Integration
								<ArrowRight className="ml-2 size-5" />
							</a>
						</Button>
						<span className="text-xs text-muted-foreground">See how they work together</span>
					</div>

					<div className="flex flex-col items-center gap-2">
						<Button size="xl" variant="outline" className="w-full">
							<a
								href="https://openclaw.ai"
								target="_blank"
								rel="noreferrer"
								className="flex items-center justify-center">
								Meet OpenClaw
								<ArrowRight className="ml-2 size-5" />
							</a>
						</Button>
						<span className="text-xs text-muted-foreground">The AI that actually does things</span>
					</div>
				</motion.div>

				{/* Stats bar */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
					className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
					<div className="flex items-center gap-2">
						<div className="size-2 rounded-full bg-violet-500" />
						<span>
							<strong className="text-foreground">Roo Code</strong> &mdash; AI coding in IDE & Cloud
						</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="size-2 rounded-full bg-amber-500" />
						<span>
							<strong className="text-foreground">OpenClaw</strong> &mdash; AI actions via any chat app
						</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="size-2 rounded-full bg-gradient-to-r from-violet-500 to-amber-500" />
						<span>
							<strong className="text-foreground">Together</strong> &mdash; from code to real-world action
						</span>
					</div>
				</motion.div>
			</div>
		</section>
	)
}
