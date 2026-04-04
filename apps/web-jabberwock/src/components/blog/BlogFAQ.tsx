"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FAQItem {
	question: string
	answer: string
}

interface BlogFAQProps {
	items: FAQItem[]
}

/**
 * BlogFAQ - Accordion-style FAQ section for blog posts
 *
 * Renders FAQ items in a collapsible accordion format to reduce page length
 * while maintaining full content visibility for AI crawlers (server-rendered).
 */
export function BlogFAQ({ items }: BlogFAQProps) {
	const [openIndex, setOpenIndex] = useState<number | null>(null)

	const toggleFAQ = (index: number) => {
		setOpenIndex(openIndex === index ? null : index)
	}

	if (items.length === 0) return null

	return (
		<section className="mt-12 not-prose">
			<h2 className="text-2xl font-bold mb-6">Frequently asked questions</h2>
			<div className="space-y-3">
				{items.map((item, index) => (
					<div key={index} className="rounded-lg border border-border bg-card/50 overflow-hidden">
						<button
							onClick={() => toggleFAQ(index)}
							className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
							aria-expanded={openIndex === index}>
							<h3 className="text-base font-medium text-foreground pr-4">{item.question}</h3>
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
								openIndex === index ? "max-h-[500px]" : "max-h-0",
							)}>
							<div className="px-4 pb-4 text-muted-foreground leading-relaxed">{item.answer}</div>
						</div>
						{/* Hidden content for crawlers - ensures FAQ content is always in the DOM */}
						<div className="sr-only" aria-hidden="true">
							<p>{item.question}</p>
							<p>{item.answer}</p>
						</div>
					</div>
				))}
			</div>
		</section>
	)
}
