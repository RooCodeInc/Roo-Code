"use client"

import { motion } from "framer-motion"
import { Zap, Shield, Smartphone } from "lucide-react"

export function NarrativeBand() {
	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.15,
				delayChildren: 0.3,
			},
		},
	}

	const itemVariants = {
		hidden: {
			opacity: 0,
			y: 20,
		},
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.6,
				ease: [0.21, 0.45, 0.27, 0.9],
			},
		},
	}

	return (
		<section className="relative overflow-hidden py-20 md:py-32">
			<div className="absolute inset-0">
				<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
					<div className="absolute left-1/2 top-1/2 h-[600px] w-full -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-gradient-to-r from-blue-500/5 to-cyan-500/5 blur-[120px]" />
				</div>
			</div>

			<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, ease: [0.21, 0.45, 0.27, 0.9] }}
					className="mx-auto mb-16 max-w-3xl text-center">
					<h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
						Coding doesn't have to stop when you do
					</h2>
				</motion.div>

				<motion.div
					variants={containerVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					className="mx-auto max-w-6xl">
					<div className="grid gap-8 md:grid-cols-3">
						{/* Card 1 - Work anywhere */}
						<motion.div variants={itemVariants}>
							<div className="group relative h-full rounded-2xl border border-border/50 bg-background/30 p-6 text-center backdrop-blur-xl transition-all duration-300 hover:border-border hover:bg-background/40">
								<div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-100" />
								<div className="relative">
									<div className="mx-auto mb-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-2.5">
										<div className="rounded-lg bg-gradient-to-r from-blue-500/80 to-cyan-500/80 p-2.5">
											<Zap className="h-6 w-6 text-white" />
										</div>
									</div>
									<h3 className="mb-3 text-xl font-semibold">Work anywhere</h3>
									<p className="text-muted-foreground">
										Start tasks in your editor, then check progress during a meeting, refine while
										waiting for lunch, or approve changes from your phone.
									</p>
								</div>
							</div>
						</motion.div>

						{/* Card 2 - Transparent control */}
						<motion.div variants={itemVariants}>
							<div className="group relative h-full rounded-2xl border border-border/50 bg-background/30 p-6 text-center backdrop-blur-xl transition-all duration-300 hover:border-border hover:bg-background/40">
								<div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-100" />
								<div className="relative">
									<div className="mx-auto mb-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-2.5">
										<div className="rounded-lg bg-gradient-to-r from-blue-500/80 to-cyan-500/80 p-2.5">
											<Shield className="h-6 w-6 text-white" />
										</div>
									</div>
									<h3 className="mb-3 text-xl font-semibold">Transparent control</h3>
									<p className="text-muted-foreground">
										Traditional IDE plugins stop when your laptop closes, and other cloud agents can
										feel opaque. Roomote Control keeps you productive with full oversight.
									</p>
								</div>
							</div>
						</motion.div>

						{/* Card 3 - True hybrid coding */}
						<motion.div variants={itemVariants}>
							<div className="group relative h-full rounded-2xl border border-border/50 bg-background/30 p-6 text-center backdrop-blur-xl transition-all duration-300 hover:border-border hover:bg-background/40">
								<div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-100" />
								<div className="relative">
									<div className="mx-auto mb-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-2.5">
										<div className="rounded-lg bg-gradient-to-r from-blue-500/80 to-cyan-500/80 p-2.5">
											<Smartphone className="h-6 w-6 text-white" />
										</div>
									</div>
									<h3 className="mb-3 text-xl font-semibold">True hybrid coding</h3>
									<p className="text-muted-foreground">
										This is the first step in our vision for Roo Code Cloud, extending Roo Code
										beyond the editor and making it your true teammate across IDE, cloud, and
										mobile.
									</p>
								</div>
							</div>
						</motion.div>
					</div>
				</motion.div>
			</div>
		</section>
	)
}
