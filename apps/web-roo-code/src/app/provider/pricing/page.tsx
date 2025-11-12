"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatedBackground } from "@/components/homepage"
import { ModelCard } from "./components/model-card"
import { SearchBar } from "./components/search-bar"
import { SortDropdown } from "./components/sort-dropdown"
import { Model, ModelWithTotalPrice, ModelsResponse, SortOption } from "@/lib/types/models"
import Link from "next/link"

const API_URL = "https://api.roocode.com/proxy/v1/models"

const faqs = [
	{
		question: "What are AI model providers?",
		answer: "AI model providers offer various language models with different capabilities and pricing.",
	},
	{
		question: "How is pricing calculated?",
		answer: "Pricing is based on token usage for input and output, measured per million tokens.",
	},
	{
		question: "Wehat is the Roo Code Cloud Provider?",
		answer: (
			<>
				<p>This is our very own model provider, optimized to work seamlessly with Roo Code Cloud.</p>
				<p>
					It offers a selection of state-of-the-art LLMs (both closed and open weight) we know work well with
					Roo for you to choose, with no markup.
				</p>
				<p>
					We also often feature 100% free models which labs share with us for the community to use and provide
					feedback.
				</p>
			</>
		),
	},
]

function calculateTotalPrice(model: Model): number {
	return parseFloat(model.pricing.input) + parseFloat(model.pricing.output)
}

function enrichModelWithTotalPrice(model: Model): ModelWithTotalPrice {
	return {
		...model,
		totalPrice: calculateTotalPrice(model),
	}
}

export default function ProviderPricingPage() {
	const [models, setModels] = useState<ModelWithTotalPrice[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [searchQuery, setSearchQuery] = useState("")
	const [sortOption, setSortOption] = useState<SortOption>("alphabetical")

	useEffect(() => {
		async function fetchModels() {
			try {
				setLoading(true)
				setError(null)
				const response = await fetch(API_URL)
				if (!response.ok) {
					throw new Error(`Failed to fetch models: ${response.statusText}`)
				}
				const data: ModelsResponse = await response.json()
				const enrichedModels = data.data.map(enrichModelWithTotalPrice)
				setModels(enrichedModels)
			} catch (err) {
				setError(err instanceof Error ? err.message : "An error occurred while fetching models")
			} finally {
				setLoading(false)
			}
		}

		fetchModels()
	}, [])

	const filteredAndSortedModels = useMemo(() => {
		let filtered = models

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			filtered = models.filter((model) => {
				return (
					model.name.toLowerCase().includes(query) ||
					model.owned_by.toLowerCase().includes(query) ||
					model.description.toLowerCase().includes(query)
				)
			})
		}

		// Sort filtered results
		const sorted = [...filtered]
		switch (sortOption) {
			case "alphabetical":
				sorted.sort((a, b) => a.name.localeCompare(b.name))
				break
			case "price-asc":
				sorted.sort((a, b) => a.totalPrice - b.totalPrice)
				break
			case "price-desc":
				sorted.sort((a, b) => b.totalPrice - a.totalPrice)
				break
			case "context-window-asc":
				sorted.sort((a, b) => a.context_window - b.context_window)
				break
			case "context-window-desc":
				sorted.sort((a, b) => b.context_window - a.context_window)
				break
		}

		return sorted
	}, [models, searchQuery, sortOption])

	return (
		<>
			<AnimatedBackground />

			{/* Hero Section */}
			<section className="relative overflow-hidden pt-16 pb-12">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center">
						<h1 className="text-5xl font-bold tracking-tight">Roo Code Cloud Provider Pricing</h1>
						<p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
							See pricing and features for all models we support.
							<br />
							<Link href="/pricing" className="underline hover:no-underline">
								Looking for general Roo Code Cloud pricing?
							</Link>
						</p>
					</div>
				</div>
			</section>

			{/* Search and Sort Controls */}
			<section className="pb-8">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-4xl">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex-1">
								<SearchBar value={searchQuery} onChange={setSearchQuery} />
							</div>
							<div className="flex-shrink-0">
								<SortDropdown value={sortOption} onChange={setSortOption} />
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Models Grid */}
			<section className="pb-16">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-6xl">
						{loading && (
							<div className="text-center py-12">
								<p className="text-lg text-muted-foreground">Loading models...</p>
							</div>
						)}

						{error && (
							<div className="text-center py-12">
								<p className="text-lg text-red-500">Error: {error}</p>
							</div>
						)}

						{!loading && !error && filteredAndSortedModels.length === 0 && (
							<div className="text-center py-12">
								<p className="text-lg text-muted-foreground">
									No models found matching your search criteria.
								</p>
							</div>
						)}

						{!loading && !error && filteredAndSortedModels.length > 0 && (
							<>
								<div className="mb-4 text-sm text-muted-foreground">
									Showing {filteredAndSortedModels.length} of {models.length} models
								</div>
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
									{filteredAndSortedModels.map((model) => (
										<ModelCard key={model.id} model={model} />
									))}
								</div>
							</>
						)}
					</div>
				</div>
			</section>

			{/* FAQ Section */}
			<section className="bg-background py-16 my-16 border-t border-b relative z-50">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-3xl text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently Asked Questions</h2>
					</div>
					<div className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-2">
						{faqs.map((faq, index) => (
							<div key={index} className="rounded-lg border border-border bg-card p-6">
								<h3 className="font-semibold">{faq.question}</h3>
								<p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
							</div>
						))}
					</div>
				</div>
			</section>
		</>
	)
}
