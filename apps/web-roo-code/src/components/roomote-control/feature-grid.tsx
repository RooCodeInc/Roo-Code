"use client"

import { motion } from "framer-motion"
import { Users, RefreshCw, Bell, Shield, Smartphone, Lock, Sparkles, Globe, Rocket } from "lucide-react"

const features = [
	// Row 1
	{
		icon: <Shield className="h-6 w-6" />,
		title: "Stay in control",
		description: "Accept, reject, refine, and cancel tasks. Queue messages and switch modes in real time.",
	},
	{
		icon: <Smartphone className="h-6 w-6" />,
		title: "Work anywhere",
		description: "Start from your IDE, then continue seamlessly from your phone or browser.",
	},
	{
		icon: <Lock className="h-6 w-6" />,
		title: "Secure by design",
		description: "Roo tasks run with minimal context and full visibility, in your IDE or the cloud.",
	},
	// Row 2
	{
		icon: <Sparkles className="h-6 w-6" />,
		title: "Unified dashboard",
		description: "One hub across IDE, cloud, and mobile to view tasks, usage analytics, and workspaces.",
	},
	{
		icon: <Globe className="h-6 w-6" />,
		title: "Start tasks on web",
		description: "Spin up new tasks directly in Roo Code Cloud and track them from end-to-end.",
	},
	{
		icon: <Rocket className="h-6 w-6" />,
		title: "Kick off a Roomote",
		description: "Launch dedicated Roomotes for longer-running, continuous work.",
	},
	// Row 3
	{
		icon: <Users className="h-6 w-6" />,
		title: "Share with teammates",
		description: "Easily share secure task links, so your teammates have visibility and stay aligned.",
	},
	{
		icon: <RefreshCw className="h-6 w-6" />,
		title: "Continuous progress",
		description: "Tasks keep running in the background, even when you step away.",
	},
	{
		icon: <Bell className="h-6 w-6" />,
		title: "Stay informed",
		description: "Get notifications the moment tasks complete, right on web or mobile.",
		comingSoon: true,
	},
]

export function FeatureGrid() {
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
			y: 20,
		},
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.5,
				ease: [0.21, 0.45, 0.27, 0.9],
			},
		},
	}

	return (
		<section className="relative overflow-hidden border-t border-border py-20 md:py-32">
			<div className="absolute inset-0">
				<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
					<div className="absolute left-1/2 top-1/2 h-[800px] w-full -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-blue-500/10 blur-[120px]" />
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
						Built for real-world dev workflows
					</h2>
				</motion.div>

				<motion.div
					variants={containerVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					className="mx-auto max-w-6xl">
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{features.map((feature, index) => (
							<motion.div key={index} variants={itemVariants}>
								<div className="group relative h-full rounded-2xl border border-border/50 bg-background/30 p-8 backdrop-blur-xl transition-colors duration-300 hover:border-border">
									<div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/30 via-cyan-500/30 to-purple-500/30 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-100" />
									<div className="relative">
										<div className="mb-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500/5 to-cyan-500/5 p-2.5">
											<div className="rounded-lg bg-gradient-to-r from-blue-500/80 to-cyan-500/80 p-2.5">
												<div className="text-foreground/90">{feature.icon}</div>
											</div>
										</div>
										<div className="mb-2 flex items-center gap-2">
											<h3 className="text-xl font-medium text-foreground/90">{feature.title}</h3>
											{feature.comingSoon && (
												<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
													Coming Soon
												</span>
											)}
										</div>
										<p className="leading-relaxed text-muted-foreground">{feature.description}</p>
									</div>
								</div>
							</motion.div>
						))}
					</div>
				</motion.div>
			</div>
		</section>
	)
}
