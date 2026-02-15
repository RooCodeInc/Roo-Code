/**
 * FAQStructuredData Component
 *
 * Renders FAQPage JSON-LD structured data for AEO (Answer Engine Optimization).
 * AI answer engines specifically look for FAQPage schema to extract Q&A pairs.
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */

interface FAQItem {
	question: string
	answer: string
}

interface FAQStructuredDataProps {
	faqs: FAQItem[]
}

export function FAQStructuredData({ faqs }: FAQStructuredDataProps) {
	const structuredData = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqs.map((faq) => ({
			"@type": "Question",
			name: faq.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: faq.answer,
			},
		})),
	}

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(structuredData),
			}}
		/>
	)
}
