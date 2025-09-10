"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Play } from "lucide-react"
import { Button } from "@/components/ui"

export function RoomoteHero() {
	return (
		<section className="relative overflow-hidden border-b border-border py-20 md:py-32">
			<div className="absolute inset-0">
				<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
					<div className="absolute left-1/2 top-1/2 h-[600px] w-full -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-blue-500/10 blur-[120px]" />
				</div>
			</div>

			<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-4xl text-center">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, ease: [0.21, 0.45, 0.27, 0.9] }}>
						<div className="group relative mb-6 inline-flex items-center overflow-hidden rounded-full bg-gradient-to-r from-blue-500/10 to-cyan-500/10 px-3 py-1 text-xs">
							<span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text font-semibold uppercase tracking-wider text-transparent">
								Early Access
							</span>
							{/* Glint effect */}
							<div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
						</div>
						<h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
							Roomote Control keeps your
							<br />
							workflow going.
						</h1>
						<div className="mx-auto max-w-2xl">
							<p className="mb-8 text-lg text-muted-foreground sm:text-xl">
								Start tasks in your editor, manage them from mobile or web, and stay connected through
								the Roo Code Cloud dashboard with your first truly{" "}
								<span className="inline-block">hybrid coding teammate,</span> wherever you are.
							</p>
						</div>

						<div className="mb-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
							<Button
								size="lg"
								asChild
								className="w-full hover:bg-gray-200 dark:bg-white dark:text-black sm:w-auto">
								<Link
									href="https://app.roocode.com/"
									className="flex w-full items-center justify-center">
									Get Started
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="ml-2 h-4 w-4"
										viewBox="0 0 20 20"
										fill="currentColor">
										<path
											fillRule="evenodd"
											d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
											clipRule="evenodd"
										/>
									</svg>
								</Link>
							</Button>
							<Button size="lg" variant="outline" asChild className="group w-full sm:w-auto">
								<Link
									href="https://youtube.com/shorts/2T2CA6CYxlI"
									target="_blank"
									rel="noopener noreferrer"
									className="flex w-full items-center justify-center">
									<Play className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
									Watch Demo
								</Link>
							</Button>
						</div>

						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ delay: 0.3, duration: 0.5 }}
							className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-500/10 to-cyan-500/10 px-4 py-2 text-sm">
							<span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text font-medium text-transparent">
								Mobile Ready <span className="mx-2 text-lg">•</span> Free to Try{" "}
								<span className="mx-2 text-lg">•</span> Pro Features $20/month
							</span>
						</motion.div>
					</motion.div>
				</div>
			</div>
		</section>
	)
}
