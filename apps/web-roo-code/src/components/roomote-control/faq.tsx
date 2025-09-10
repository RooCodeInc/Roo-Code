"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface FAQItem {
	question: string
	answer: string
}

const faqs: FAQItem[] = [
	{
		question: "What is Roo Code Cloud?",
		answer: "Roo Code Cloud is a web-based platform that extends your Roo Code extension with cloud-powered features. By connecting your local VS Code extension to the cloud, you unlock task sharing, usage analytics, and remote control options that enhance your AI-assisted development workflow. [Learn more](https://docs.roocode.com/roo-code-cloud/what-is-roo-code-cloud).",
	},
	{
		question: "What is Roomote Control?",
		answer: "Roomote Control creates a bidirectional connection between your local extension and Roo Code Cloud, enabling real-time monitoring and control of Roo Code tasks running in your extension directly from the Roo Code Cloud mobile or web interface. [Learn more](https://docs.roocode.com/roo-code-cloud/roomote-control).",
	},
	{
		question: "How do I enable Roomote Control?",
		answer: "Open the Roo Code extension, go to the Account tab, and toggle on Roomote Control. Sign in with GitHub, Google, or email to connect your extension to Roo Code Cloud. Once connected, your workspace appears under Connected Workspaces and your tasks automatically sync across devices and sessions. Learn more about [Login/Signup](https://docs.roocode.com/roo-code-cloud/login).",
	},
	{
		question: "Can I disable it?",
		answer: "Yes. Toggle off anytime or log out of Roo Cloud.",
	},
	{
		question: "Is my code safe?",
		answer: "Roo only shares the context needed for tasks, not your full repo. Run Roo in your own infrastructure with confidence. See our [Roo Code Cloud docs](https://docs.roocode.com/roo-code-cloud/what-is-roo-code-cloud) and [Roo Code Trust Center](https://trust.roocode.com/) for additional security details.",
	},
	{
		question: "What is free vs. paid?",
		answer: "Free users can monitor tasks in real time and view previously logged work in Roo Code Cloud. Pro ($20/mo after free 14-day trial) unlocks full Roomote Control — start, stop, create, edit, and manage tasks remotely. Cancel anytime, no commitment. Learn more about [Free vs. Paid Features](https://docs.roocode.com/roo-code-cloud/billing-subscriptions#pro-plan-20month).",
	},
	{
		question: "How does billing work?",
		answer: "Pro is billed at $20 per user, per month. Plans are month-to-month, and you can cancel anytime. Billing is handled through Stripe, and no credit card is required to start with the free plan. Learn more about [Billing & Subscriptions](https://docs.roocode.com/roo-code-cloud/billing-subscriptions).",
	},
	{
		question: 'What does "priority support" include?',
		answer: "Pro subscribers get faster responses from the Roo Code team on Discord and email, as well as early access to new features and roadmap previews. Learn more about [Plan Tiers](https://docs.roocode.com/roo-code-cloud/billing-subscriptions).",
	},
	{
		question: "Are there any limits in the free plan?",
		answer: "Free users can monitor and view logged tasks, but cannot start new tasks from the web or exercise full edit controls. Learn more about [Plan Tiers](https://docs.roocode.com/roo-code-cloud/billing-subscriptions).",
	},
	{
		question: "Which builds are supported?",
		answer: "Latest Roo Code extension and a connected Git provider.",
	},
	{
		question: "What about notifications?",
		answer: 'Completion notifications are rolling out shortly. Features marked "coming soon" are actively in development and will be available to all users as they launch.',
	},
	{
		question: "Can I share tasks with teammates?",
		answer: "Yes. You can share individual tasks with colleagues or the community through secure, expiring links. Control what you share and when, with links that automatically expire after 30 days for enhanced security. Learn more about [Task Sharing](https://docs.roocode.com/roo-code-cloud/task-sharing).",
	},
]

export function RoomoteFAQ() {
	const [openIndex, setOpenIndex] = useState<number | null>(null)

	const toggleFAQ = (index: number) => {
		setOpenIndex(openIndex === index ? null : index)
	}

	return (
		<section className="border-t border-border py-20 md:py-32">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, ease: [0.21, 0.45, 0.27, 0.9] }}
					className="mx-auto mb-16 max-w-3xl text-center">
					<h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">FAQ</h2>
				</motion.div>

				<div className="mx-auto max-w-3xl">
					<div className="space-y-4">
						{faqs.map((faq, index) => (
							<motion.div
								key={index}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{
									duration: 0.5,
									delay: index * 0.1,
									ease: [0.21, 0.45, 0.27, 0.9],
								}}>
								<div className="group relative rounded-lg border border-border/50 bg-background/30 backdrop-blur-xl transition-all duration-300 hover:border-border">
									<button
										onClick={() => toggleFAQ(index)}
										className="flex w-full items-center justify-between p-6 text-left"
										aria-expanded={openIndex === index}>
										<h3 className="pr-4 text-lg font-medium text-foreground/90">{faq.question}</h3>
										<ChevronDown
											className={cn(
												"h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200",
												openIndex === index ? "rotate-180" : "",
											)}
										/>
									</button>
									<div
										className={cn(
											"overflow-hidden transition-all duration-300 ease-in-out",
											openIndex === index ? "max-h-96 pb-6" : "max-h-0",
										)}>
										<div className="px-6 text-muted-foreground">
											<p>
												{faq.answer.split(/(\[.*?\]\(.*?\))/).map((part, i) => {
													// Handle markdown-style links
													const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/)
													if (linkMatch) {
														return (
															<a
																key={i}
																href={linkMatch[2]}
																target="_blank"
																rel="noopener noreferrer"
																className="text-blue-500 underline-offset-4 hover:underline">
																{linkMatch[1]}
															</a>
														)
													}
													return part
												})}
											</p>
										</div>
									</div>
								</div>
							</motion.div>
						))}
					</div>
				</div>
			</div>
		</section>
	)
}
