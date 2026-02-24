"use client"

import { motion } from "framer-motion"
import { ArrowRight, Download } from "lucide-react"
import { Button } from "@/components/ui"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function OpenClawCTASection() {
	return (
		<section className="py-24 relative overflow-hidden">
			{/* Background gradient */}
			<div className="absolute inset-0">
				<div className="absolute left-1/3 top-1/2 h-[500px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 dark:bg-violet-600/15 blur-[140px]" />
				<div className="absolute right-1/3 top-1/2 h-[500px] w-[400px] translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 dark:bg-amber-600/15 blur-[140px]" />
			</div>

			<div className="container px-4 mx-auto sm:px-6 lg:px-8 text-center relative z-10">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}>
					<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">
						The AI stack that{" "}
						<span className="bg-gradient-to-r from-violet-600 to-amber-500 bg-clip-text text-transparent">
							does it all
						</span>
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
						Start coding with Roo. Start automating with OpenClaw. Start shipping with both.
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, delay: 0.2 }}
					className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
					<Button
						size="lg"
						className="w-full sm:w-auto h-12 px-8 text-base bg-violet-600 hover:bg-violet-600/80">
						<a
							href={EXTERNAL_LINKS.MARKETPLACE}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2">
							<Download className="h-4 w-4" />
							Install Roo Code
						</a>
					</Button>

					<Button
						size="lg"
						className="w-full sm:w-auto h-12 px-8 text-base bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-500/90 hover:to-orange-600/90 text-white border-0">
						<a
							href="https://openclaw.ai"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2">
							Try OpenClaw
							<ArrowRight className="h-4 w-4" />
						</a>
					</Button>

					<Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base">
						<a
							href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2">
							Roo Code Cloud
							<ArrowRight className="h-4 w-4" />
						</a>
					</Button>
				</motion.div>

				<motion.p
					initial={{ opacity: 0 }}
					whileInView={{ opacity: 1 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, delay: 0.4 }}
					className="text-sm text-muted-foreground">
					Roo Code is free and open source. OpenClaw offers a generous free tier. No credit card needed.
				</motion.p>
			</div>
		</section>
	)
}
