"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui"

export function FinalCTA() {
	const backgroundVariants = {
		hidden: {
			opacity: 0,
		},
		visible: {
			opacity: 1,
			transition: {
				duration: 1.2,
				ease: "easeOut",
			},
		},
	}

	return (
		<section className="relative overflow-hidden bg-secondary/50 py-16 sm:py-24 lg:py-32">
			<motion.div
				className="absolute inset-x-0 top-1/2 -translate-y-1/2"
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true }}
				variants={backgroundVariants}>
				<div className="relative mx-auto max-w-[1200px]">
					<div className="absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-blue-500/10 blur-[120px]" />
				</div>
			</motion.div>

			<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, ease: [0.21, 0.45, 0.27, 0.9] }}
					className="mx-auto max-w-3xl text-center">
					<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
						Stay in flow with Roomote Control
					</h2>
					<p className="mb-8 text-lg text-muted-foreground">
						Build on your terms, wherever you work. Start free or upgrade to Pro for full control.
					</p>
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ delay: 0.2, duration: 0.6, ease: [0.21, 0.45, 0.27, 0.9] }}
						className="flex flex-col items-center justify-center gap-4 sm:flex-row">
						<Button
							size="lg"
							asChild
							className="w-full hover:bg-gray-200 dark:bg-white dark:text-black sm:w-auto">
							<Link href="https://app.roocode.com/" className="flex items-center justify-center">
								Start Free
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
						<Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
							<Link href="https://app.roocode.com/billing" className="flex items-center justify-center">
								Upgrade to Pro — $20/mo
							</Link>
						</Button>
					</motion.div>
				</motion.div>
			</div>
		</section>
	)
}
