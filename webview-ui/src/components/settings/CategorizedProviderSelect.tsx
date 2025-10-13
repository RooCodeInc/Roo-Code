import React, { useMemo, useState } from "react"
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons"
import { ProviderMetadata, PROVIDER_METADATA, ProviderCategory, PricingModel } from "@roo-code/types"
import { cn } from "@src/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"

interface CategorizedProviderSelectProps {
	value: string
	onValueChange: (value: string) => void
	availableProviders: Array<{ value: string; label: string }>
	placeholder?: string
}

// Helper function to get badge styles based on pricing
const getPricingBadgeStyles = (pricing: PricingModel) => {
	switch (pricing) {
		case "free":
			return "bg-green-500/20 text-green-700 dark:text-green-400"
		case "freemium":
			return "bg-blue-500/20 text-blue-700 dark:text-blue-400"
		case "pay-per-use":
			return "bg-orange-500/20 text-orange-700 dark:text-orange-400"
		case "subscription":
			return "bg-purple-500/20 text-purple-700 dark:text-purple-400"
		default:
			return "bg-gray-500/20 text-gray-700 dark:text-gray-400"
	}
}

// Helper function to get badge styles based on quality
const getQualityBadgeStyles = (quality: string) => {
	switch (quality) {
		case "premium":
			return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
		case "standard":
			return "bg-gray-500/20 text-gray-700 dark:text-gray-400"
		case "experimental":
			return "bg-red-500/20 text-red-700 dark:text-red-400"
		case "deprecated":
			return "bg-red-800/20 text-red-900 dark:text-red-300"
		default:
			return "bg-gray-500/20 text-gray-700 dark:text-gray-400"
	}
}

// Helper function to get category icon
const getCategoryIcon = (category: ProviderCategory) => {
	switch (category) {
		case "cloud":
			return "☁️"
		case "local":
			return "💻"
		case "hybrid":
			return "🔄"
		default:
			return "📦"
	}
}

export const CategorizedProviderSelect: React.FC<CategorizedProviderSelectProps> = ({
	value,
	onValueChange,
	availableProviders,
	placeholder = "Select a provider",
}) => {
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
		new Set(["recommended", "cloud", "local"]),
	)

	// Group providers by category
	const categorizedProviders = useMemo(() => {
		const groups: Record<string, Array<{ provider: ProviderMetadata; value: string }>> = {
			recommended: [],
			cloud: [],
			local: [],
			hybrid: [],
			experimental: [],
			deprecated: [],
		}

		availableProviders.forEach(({ value: providerId }) => {
			const metadata = PROVIDER_METADATA[providerId]
			if (metadata) {
				const provider = { provider: metadata, value: providerId }

				// Add to recommended section if applicable
				if (metadata.recommended) {
					groups.recommended.push(provider)
				}

				// Add to quality-based sections
				if (metadata.deprecated || metadata.quality === "deprecated") {
					groups.deprecated.push(provider)
				} else if (metadata.quality === "experimental") {
					groups.experimental.push(provider)
				} else {
					// Add to category-based section
					groups[metadata.category]?.push(provider)
				}
			} else {
				// Fallback for providers without metadata
				groups.cloud.push({
					provider: {
						id: providerId,
						label: availableProviders.find((p) => p.value === providerId)?.label || providerId,
						category: "cloud",
						pricing: "pay-per-use",
						quality: "standard",
						authentication: "api-key",
						recommended: false,
						deprecated: false,
					},
					value: providerId,
				})
			}
		})

		// Sort providers within each group
		Object.keys(groups).forEach((key) => {
			groups[key].sort((a, b) => a.provider.label.localeCompare(b.provider.label))
		})

		// Remove empty groups
		return Object.entries(groups).filter(([_, providers]) => providers.length > 0)
	}, [availableProviders])

	const toggleCategory = (category: string) => {
		setExpandedCategories((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(category)) {
				newSet.delete(category)
			} else {
				newSet.add(category)
			}
			return newSet
		})
	}

	const getCategoryLabel = (category: string) => {
		switch (category) {
			case "recommended":
				return "⭐ Recommended"
			case "cloud":
				return "☁️ Cloud Providers"
			case "local":
				return "💻 Local Providers"
			case "hybrid":
				return "🔄 Hybrid Providers"
			case "experimental":
				return "🧪 Experimental"
			case "deprecated":
				return "⚠️ Deprecated"
			default:
				return category
		}
	}

	const selectedMetadata = PROVIDER_METADATA[value]
	const selectedLabel = selectedMetadata?.label || availableProviders.find((p) => p.value === value)?.label || value

	return (
		<div className="relative">
			<Select value={value} onValueChange={onValueChange}>
				<SelectTrigger className="w-full" data-testid="categorized-provider-select">
					<SelectValue placeholder={placeholder}>
						<div className="flex items-center gap-2">
							{selectedMetadata && (
								<span className="text-sm">{getCategoryIcon(selectedMetadata.category)}</span>
							)}
							<span>{selectedLabel}</span>
							{selectedMetadata && (
								<div className="flex gap-1 ml-auto">
									<span
										className={cn(
											"text-xs px-1.5 py-0.5 rounded",
											getPricingBadgeStyles(selectedMetadata.pricing),
										)}>
										{selectedMetadata.pricing}
									</span>
									{selectedMetadata.quality === "premium" && (
										<span
											className={cn(
												"text-xs px-1.5 py-0.5 rounded",
												getQualityBadgeStyles(selectedMetadata.quality),
											)}>
											Premium
										</span>
									)}
								</div>
							)}
						</div>
					</SelectValue>
				</SelectTrigger>
				<SelectContent className="max-h-[400px] overflow-y-auto">
					{categorizedProviders.map(([category, providers]) => (
						<div key={category} className="mb-1">
							<div
								className="flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-vscode-list-hoverBackground text-sm font-medium"
								onClick={() => toggleCategory(category)}>
								{expandedCategories.has(category) ? (
									<ChevronDownIcon className="w-3 h-3" />
								) : (
									<ChevronRightIcon className="w-3 h-3" />
								)}
								<span>{getCategoryLabel(category)}</span>
								<span className="text-xs text-vscode-descriptionForeground ml-auto">
									({providers.length})
								</span>
							</div>
							{expandedCategories.has(category) && (
								<div className="ml-2">
									{providers.map(({ provider, value: providerId }) => (
										<SelectItem key={providerId} value={providerId} className="pl-4 pr-2 py-2">
											<div className="flex items-center justify-between w-full">
												<div className="flex items-center gap-2">
													<span className="text-sm">
														{getCategoryIcon(provider.category)}
													</span>
													<div className="flex flex-col">
														<span className="text-sm">{provider.label}</span>
														{provider.description && (
															<span className="text-xs text-vscode-descriptionForeground">
																{provider.description}
															</span>
														)}
													</div>
												</div>
												<div className="flex gap-1 ml-4">
													<span
														className={cn(
															"text-xs px-1.5 py-0.5 rounded",
															getPricingBadgeStyles(provider.pricing),
														)}>
														{provider.pricing}
													</span>
													{provider.quality !== "standard" && (
														<span
															className={cn(
																"text-xs px-1.5 py-0.5 rounded",
																getQualityBadgeStyles(provider.quality),
															)}>
															{provider.quality}
														</span>
													)}
													{provider.setupDifficulty === "advanced" && (
														<span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
															Advanced
														</span>
													)}
												</div>
											</div>
										</SelectItem>
									))}
								</div>
							)}
						</div>
					))}
				</SelectContent>
			</Select>

			{/* Show metadata info for selected provider */}
			{selectedMetadata && (
				<div className="mt-2 p-2 rounded bg-vscode-editor-background border border-vscode-panel-border">
					<div className="flex items-start justify-between">
						<div className="flex-1">
							{selectedMetadata.description && (
								<p className="text-sm text-vscode-descriptionForeground mb-2">
									{selectedMetadata.description}
								</p>
							)}
							{selectedMetadata.warning && (
								<p className="text-sm text-yellow-600 dark:text-yellow-500 mb-2">
									⚠️ {selectedMetadata.warning}
								</p>
							)}
							<div className="flex flex-wrap gap-2">
								<span
									className={cn(
										"text-xs px-2 py-1 rounded",
										getPricingBadgeStyles(selectedMetadata.pricing),
									)}>
									{selectedMetadata.pricing === "free"
										? "Free"
										: selectedMetadata.pricing === "freemium"
											? "Free tier available"
											: selectedMetadata.pricing === "pay-per-use"
												? "Pay per use"
												: selectedMetadata.pricing === "subscription"
													? "Subscription"
													: selectedMetadata.pricing}
								</span>
								{selectedMetadata.quality !== "standard" && (
									<span
										className={cn(
											"text-xs px-2 py-1 rounded",
											getQualityBadgeStyles(selectedMetadata.quality),
										)}>
										{selectedMetadata.quality === "premium"
											? "Premium Quality"
											: selectedMetadata.quality === "experimental"
												? "Experimental"
												: selectedMetadata.quality === "deprecated"
													? "Deprecated"
													: selectedMetadata.quality}
									</span>
								)}
								{selectedMetadata.setupDifficulty && (
									<span className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-700 dark:text-gray-400">
										Setup: {selectedMetadata.setupDifficulty}
									</span>
								)}
								{selectedMetadata.performance && (
									<>
										<span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400">
											Speed: {selectedMetadata.performance.speed}
										</span>
										<span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-700 dark:text-purple-400">
											Reliability: {selectedMetadata.performance.reliability}
										</span>
									</>
								)}
							</div>
							{selectedMetadata.features && (
								<div className="mt-2 flex flex-wrap gap-1">
									{selectedMetadata.features.supportsStreaming && (
										<span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-700 dark:text-green-400">
											✓ Streaming
										</span>
									)}
									{selectedMetadata.features.supportsImages && (
										<span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-700 dark:text-green-400">
											✓ Images
										</span>
									)}
									{selectedMetadata.features.supportsTools && (
										<span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-700 dark:text-green-400">
											✓ Tools
										</span>
									)}
									{selectedMetadata.features.supportsPromptCaching && (
										<span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-700 dark:text-green-400">
											✓ Caching
										</span>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
