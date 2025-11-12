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
} from "lucide-react"

interface ModelCardProps {
	model: ModelWithTotalPrice
}

export function ModelCard({ model }: ModelCardProps) {
	let inputPrice = parseFloat(model.pricing.input)
	const outputPrice = parseFloat(model.pricing.output)
	const cacheReadPrice = parseFloat(model.pricing.input_cache_read)
	const cacheWritePrice = parseFloat(model.pricing.input_cache_write)

	const free = model.tags.includes("free")
	const usefulTags = model.tags.filter((tag) => tag !== "free")

	inputPrice += 100

	return (
		<div className="relative cursor-default px-8 pt-7 pb-5 flex flex-col justify-start bg-background border rounded-3xl transition-all hover:shadow-xl">
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
				<p className="text-sm text-muted-foreground">{model.description}</p>
			</div>

			<div className="overflow-x-auto">
				<table className="w-full text-xs">
					<tbody>
						{model.owned_by && (
							<tr className="border-b border-border">
								<td className="py-1.5 font-medium text-muted-foreground">Vendor</td>
								<td className="py-1.5 text-right">{model.owned_by}</td>
							</tr>
						)}
						<tr className="border-b border-border">
							<td className="py-1.5 font-medium text-muted-foreground">
								<RulerDimensionLine className="size-4 inline-block mr-1.5" />
								Context Window
							</td>
							<td className="py-1.5 text-right font-mono">{formatTokens(model.context_window)}</td>
						</tr>
						<tr className="border-b border-border">
							<td className="py-1.5 font-medium text-muted-foreground">
								<Expand className="size-4 inline-block mr-1.5" />
								Max Output Tokens
							</td>
							<td className="py-1.5 text-right font-mono">{formatTokens(model.max_tokens)}</td>
						</tr>
						<tr className="border-b border-border">
							<td className="py-1.5 font-medium text-muted-foreground">
								<ArrowRightToLine className="size-4 inline-block mr-1.5" />
								Input Price
							</td>
							<td className="py-1.5 text-right">
								{inputPrice === 0 ? "Free" : `${formatCurrency(inputPrice)}/1M tokens`}
							</td>
						</tr>
						<tr className="border-b border-border">
							<td className="py-1.5 font-medium text-muted-foreground">
								<ArrowLeftToLine className="size-4 inline-block mr-1.5" />
								Output Price
							</td>
							<td className="py-1.5 text-right">
								{outputPrice === 0 ? "Free" : `${formatCurrency(outputPrice)}/1M tokens`}
							</td>
						</tr>
						{(cacheReadPrice > 0 || cacheWritePrice > 0) && (
							<>
								<tr className="border-b border-border">
									<td className="py-1.5 font-medium text-muted-foreground">
										<HardDriveUpload className="size-4 inline-block mr-1.5" />
										Cache Read
									</td>
									<td className="py-1.5 text-right">
										{cacheReadPrice === 0 ? "Free" : `${formatCurrency(cacheReadPrice)}/1M tokens`}
									</td>
								</tr>
								<tr className="border-b border-border">
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
						<tr className="">
							<td className="py-1.5 font-medium text-muted-foreground align-top">
								<ListChecks className="size-4 inline-block mr-1.5" />
								Features
							</td>
							<td className="py-1.5 ">
								{usefulTags.map((tag) => (
									<span key={tag} className="flex justify-end items-center text-xs capitalize">
										<Check className="size-3 m-1" />
										{tag}
									</span>
								))}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	)
}
