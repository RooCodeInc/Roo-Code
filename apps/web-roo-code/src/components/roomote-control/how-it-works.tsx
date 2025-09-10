"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Monitor, Cloud, Smartphone, ArrowRight } from "lucide-react"

const steps = [
	{
		number: "1",
		title: "Enable in your extension",
		description:
			"Open the Roo Code extension, go to the Account tab, and toggle on Roomote Control to get started.",
	},
	{
		number: "2",
		title: "Connect to Roo Code Cloud",
		description:
			"Sign up at app.roocode.com to sync prompts, enable collaboration, and access online task history across devices.",
		link: { text: "app.roocode.com", href: "https://app.roocode.com/" },
	},
	{
		number: "3",
		title: "View your cloud dashboard",
		description:
			"Your Roo Code Cloud dashboard is the central hub to view task history, monitor usage, and manage remote workspaces.",
		link: { text: "Roo Code Cloud dashboard", href: "https://app.roocode.com/" },
	},
	{
		number: "4",
		title: "Follow from mobile or web",
		description:
			"See your task list, usage analytics, and real-time updates in Roo Code Cloud — no need to reopen your IDE.",
	},
	{
		number: "5",
		title: "Unlock Pro for full control",
		description:
			"Upgrade to Pro ($20/mo) to start, stop, approve, and refine tasks remotely, with priority support and early access to features.",
		link: { text: "Upgrade to Pro", href: "https://app.roocode.com/billing" },
	},
]

export function HowItWorks() {
	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.1,
				delayChildren: 0.2,
			},
		},
	}

	const itemVariants = {
		hidden: {
			opacity: 0,
			x: -20,
		},
		visible: {
			opacity: 1,
			x: 0,
			transition: {
				duration: 0.5,
				ease: [0.21, 0.45, 0.27, 0.9],
			},
		},
	}

	return (
		<section className="relative overflow-hidden border-t border-border py-16 md:py-24">
			<div className="absolute inset-0">
				<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
					<div className="absolute left-1/2 top-1/2 h-[600px] w-full -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-cyan-500/5 blur-[120px]" />
				</div>
			</div>

			<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, ease: [0.21, 0.45, 0.27, 0.9] }}
					className="mx-auto mb-12 max-w-3xl text-center">
					<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
				</motion.div>

				<motion.div
					variants={containerVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					className="mx-auto max-w-6xl">
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 lg:gap-4">
						{steps.map((step, index) => {
							return (
								<motion.div key={index} variants={itemVariants} className="relative">
									<div className="group relative h-full rounded-2xl border border-border/50 bg-background/30 p-6 backdrop-blur-xl transition-all duration-300 hover:border-border hover:bg-background/40">
										<div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-100" />
										<div className="relative">
											{/* Number icon with gradient background matching other sections */}
											<div className="mb-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-2.5">
												<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500/80 to-cyan-500/80">
													<span className="text-xl font-bold text-white leading-none">
														{step.number}
													</span>
												</div>
											</div>
											<h3 className="mb-3 text-lg font-semibold leading-tight">{step.title}</h3>
											<p className="text-sm leading-relaxed text-muted-foreground">
												{step.description.split(step.link?.text || "").map((part, i) => {
													if (i === 0) return part
													if (step.link) {
														return (
															<span key={i}>
																<Link
																	href={step.link.href}
																	className="text-blue-500 underline-offset-4 hover:underline"
																	target="_blank"
																	rel="noopener noreferrer">
																	{step.link.text}
																</Link>
																{part}
															</span>
														)
													}
													return part
												})}
											</p>
										</div>
									</div>
									{index < steps.length - 1 && (
										<div className="absolute -right-5 top-1/2 hidden -translate-y-1/2 lg:block">
											<motion.div
												animate={{ x: [0, 6, 0] }}
												transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
												className="relative">
												<div className="absolute inset-0 rounded-full bg-blue-500/20 blur-sm" />
												<ArrowRight
													className="relative h-6 w-6 text-blue-500"
													strokeWidth={2.5}
												/>
											</motion.div>
										</div>
									)}
								</motion.div>
							)
						})}
					</div>

					{/* Visual Flow Diagram */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						whileInView={{ opacity: 1, scale: 1 }}
						viewport={{ once: true }}
						transition={{ delay: 0.4, duration: 0.6 }}
						className="mt-16">
						<div className="relative mx-auto max-w-5xl">
							<div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10 blur-3xl" />
							<div className="relative rounded-3xl border border-border/50 bg-background/30 p-8 backdrop-blur-xl md:p-12">
								{/* Horizontal Flow */}
								<div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
									{/* Editor */}
									<motion.div
										initial={{ opacity: 0, x: -20 }}
										whileInView={{ opacity: 1, x: 0 }}
										viewport={{ once: true }}
										transition={{ delay: 0.5 }}
										className="text-center">
										<div className="relative mx-auto mb-4 h-24 w-24">
											<div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20" />
											<div className="absolute inset-[1px] flex items-center justify-center rounded-2xl bg-background">
												<Monitor className="h-12 w-12 text-blue-500" />
											</div>
										</div>
										<h4 className="text-lg font-semibold">Your Editor</h4>
										<p className="mt-2 text-sm text-muted-foreground">
											Start tasks from your editor
										</p>
									</motion.div>

									{/* Arrow 1 */}
									<motion.div
										animate={{
											x: [0, 15, 0],
											scale: [1, 1.1, 1],
										}}
										transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
										className="hidden md:block">
										<div className="relative">
											<div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl" />
											<ArrowRight className="relative h-12 w-12 text-blue-500" strokeWidth={3} />
										</div>
									</motion.div>

									{/* Cloud Dashboard */}
									<motion.div
										initial={{ opacity: 0, y: 20 }}
										whileInView={{ opacity: 1, y: 0 }}
										viewport={{ once: true }}
										transition={{ delay: 0.6 }}
										className="text-center">
										<div className="relative mx-auto mb-4 h-24 w-24">
											<div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20" />
											<div className="absolute inset-[1px] flex items-center justify-center rounded-2xl bg-background">
												<Cloud className="h-12 w-12 text-cyan-500" />
											</div>
										</div>
										<h4 className="text-lg font-semibold">Cloud Dashboard</h4>
										<p className="mt-2 text-sm text-muted-foreground">Monitor & manage remotely</p>
									</motion.div>

									{/* Arrow 2 */}
									<motion.div
										animate={{
											x: [0, 15, 0],
											scale: [1, 1.1, 1],
										}}
										transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
										className="hidden md:block">
										<div className="relative">
											<div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl" />
											<ArrowRight className="relative h-12 w-12 text-cyan-500" strokeWidth={3} />
										</div>
									</motion.div>

									{/* Mobile */}
									<motion.div
										initial={{ opacity: 0, x: 20 }}
										whileInView={{ opacity: 1, x: 0 }}
										viewport={{ once: true }}
										transition={{ delay: 0.7 }}
										className="text-center">
										<div className="relative mx-auto mb-4 h-24 w-24">
											<div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20" />
											<div className="absolute inset-[1px] flex items-center justify-center rounded-2xl bg-background">
												<Smartphone className="h-12 w-12 text-purple-500" />
											</div>
										</div>
										<h4 className="text-lg font-semibold">Mobile Approval</h4>
										<p className="mt-2 text-sm text-muted-foreground">Approve & refine on the go</p>
									</motion.div>
								</div>
							</div>
						</div>
					</motion.div>
				</motion.div>
			</div>
		</section>
	)
}
