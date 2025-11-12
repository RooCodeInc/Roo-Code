import { ModelWithTotalPrice } from "@/lib/types/models"
import { formatCurrency, formatTokens } from "@/lib/formatters"
import {
	ArrowLeftToLine,
	ArrowRightToLine,
	Check,
	Expand,
	Gift,
	HardDriveDownload,
	HardDriveUpload,
	ListChecks,
	RulerDimensionLine,
	ChevronDown,
	ChevronUp,
} from "lucide-react"
import { useState } from "react"

interface ModelCardProps {
	model: ModelWithTotalPrice
}

export function ModelCard({ model }: ModelCardProps) {
	const inputPrice = parseFloat(model.pricing.input)
	const outputPrice = parseFloat(model.pricing.output)
	const cacheReadPrice = parseFloat(model.pricing.input_cache_read)
	const cacheWritePrice = parseFloat(model.pricing.input_cache_write)

	const free = model.tags.includes("free")
	const usefulTags = model.tags.filter((tag) => tag !== "free")

	// Mobile collapsed/expanded state
	const [expanded, setExpanded] = useState(false)

	return (
		<div
			className={[
				"relative cursor-default px-8 pt-7 pb-5 flex flex-col justify-start bg-background border rounded-3xl transition-all hover:shadow-xl",
				// On mobile, visually hint at expandability
				"sm:cursor-default",
			].join(" ")}>
			{/* Header: always visible */}
			<div className="mb-4">
				<h3 className="text-xl font-semibold tracking-tight mb-2 flex items-center gap-2 justify-between">
					{model.name}
					{free && (
						<span className="inline-flex items-center text-sm font-medium text-green-500">
							<Gift className="size-4 mr-1" />
							Free!
						</span>
					)}
				</h3>
				<p
					className={[
						"text-sm text-muted-foreground",
						// On mobile + collapsed: clamp description
						"sm:line-clamp-none",
						!expanded ? "line-clamp-2" : "",
					]
						.join(" ")
						.trim()}>
					{model.description}
				</p>
			</div>

			{/* Content */}
			<div className="overflow-x-auto">
				<table className="w-full text-xs">
					<tbody>
						{/* Context Window: always visible */}
						<tr className="border-b border-border">
							<td className="py-1.5 font-medium text-muted-foreground">
								<RulerDimensionLine className="size-4 inline-block mr-1.5" />
								Context Window
							</td>
							<td className="py-1.5 text-right font-mono">{formatTokens(model.context_window)}</td>
						</tr>

						{/* Input Price: always visible */}
						<tr className="border-b border-border">
							<td className="py-1.5 font-medium text-muted-foreground">
								<ArrowRightToLine className="size-4 inline-block mr-1.5" />
								Input Price
							</td>
							<td className="py-1.5 text-right">
								{inputPrice === 0 ? "Free" : `${formatCurrency(inputPrice)}/1M tokens`}
							</td>
						</tr>

						{/* Output Price: always visible */}
						<tr
							className={[
								"border-b border-border",
								// Add subtle separation from toggle on mobile
							].join(" ")}>
							<td className="py-1.5 font-medium text-muted-foreground">
								<ArrowLeftToLine className="size-4 inline-block mr-1.5" />
								Output Price
							</td>
							<td className="py-1.5 text-right">
								{outputPrice === 0 ? "Free" : `${formatCurrency(outputPrice)}/1M tokens`}
							</td>
						</tr>

						{/* Extra details: only visible on mobile when expanded, always visible on >=sm */}
						{model.owned_by && (
							<tr
								className={[
									"border-b border-border",
									expanded ? "table-row" : "hidden sm:table-row",
								].join(" ")}>
								<td className="py-1.5 font-medium text-muted-foreground">Vendor</td>
								<td className="py-1.5 text-right">{model.owned_by}</td>
							</tr>
						)}

						<tr
							className={["border-b border-border", expanded ? "table-row" : "hidden sm:table-row"].join(
								" ",
							)}>
							<td className="py-1.5 font-medium text-muted-foreground">
								<Expand className="size-4 inline-block mr-1.5" />
								Max Output Tokens
							</td>
							<td className="py-1.5 text-right font-mono">{formatTokens(model.max_tokens)}</td>
						</tr>

						{(cacheReadPrice > 0 || cacheWritePrice > 0) && (
							<>
								<tr
									className={[
										"border-b border-border",
										expanded ? "table-row" : "hidden sm:table-row",
									].join(" ")}>
									<td className="py-1.5 font-medium text-muted-foreground">
										<HardDriveUpload className="size-4 inline-block mr-1.5" />
										Cache Read
									</td>
									<td className="py-1.5 text-right">
										{cacheReadPrice === 0 ? "Free" : `${formatCurrency(cacheReadPrice)}/1M tokens`}
									</td>
								</tr>
								<tr
									className={[
										"border-b border-border",
										expanded ? "table-row" : "hidden sm:table-row",
									].join(" ")}>
									<td className="py-1.5 font-medium text-muted-foreground">
										<HardDriveDownload className="size-4 inline-block mr-1.5" />
										Cache Write
									</td>
									<td className="py-1.5 text-right">
										{cacheWritePrice === 0
											? "Free"
											: `${formatCurrency(cacheWritePrice)}/1M tokens`}
									</td>
								</tr>
							</>
						)}

						<tr className={[expanded ? "table-row" : "hidden sm:table-row"].join(" ")}>
							<td className="py-1.5 font-medium text-muted-foreground align-top">
								<ListChecks className="size-4 inline-block mr-1.5" />
								Features
							</td>
							<td className="py-1.5">
								{usefulTags.map((tag) => (
									<span key={tag} className="flex justify-end items-center text-xs capitalize">
										<Check className="size-3 m-1" />
										{tag}
									</span>
								))}
							</td>
						</tr>

						{/* Mobile-only toggle row */}
						<tr className="sm:hidden">
							<td colSpan={2} className="pt-3">
								<button
									type="button"
									onClick={() => setExpanded((v) => !v)}
									className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary">
									{expanded ? "Less" : "More"}
									{expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	)
}
