import { ModelWithTotalPrice } from "@/lib/types/models"
import { formatCurrency, formatTokens } from "@/lib/formatters"

interface ModelCardProps {
	model: ModelWithTotalPrice
}

export function ModelCard({ model }: ModelCardProps) {
	const inputPrice = parseFloat(model.pricing.input)
	const outputPrice = parseFloat(model.pricing.output)
	const cacheReadPrice = parseFloat(model.pricing.input_cache_read)
	const cacheWritePrice = parseFloat(model.pricing.input_cache_write)

	return (
		<div className="relative p-6 flex flex-col justify-start bg-background border rounded-2xl transition-all hover:shadow-lg">
			<div className="mb-4">
				<h3 className="text-xl font-bold tracking-tight mb-2">{model.name}</h3>
				<p className="text-sm text-muted-foreground">{model.description}</p>
			</div>

			{model.tags.length > 0 && (
				<div className="flex flex-wrap gap-2 mb-4">
					{model.tags.map((tag) => (
						<span
							key={tag}
							className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-500 ring-1 ring-inset ring-blue-500/20">
							{tag}
						</span>
					))}
				</div>
			)}

			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<tbody>
						<tr className="border-b border-border">
							<td className="py-2 font-medium text-muted-foreground">Provider</td>
							<td className="py-2 text-right">{model.owned_by || "N/A"}</td>
						</tr>
						<tr className="border-b border-border">
							<td className="py-2 font-medium text-muted-foreground">Context Window</td>
							<td className="py-2 text-right">{formatTokens(model.context_window)}</td>
						</tr>
						<tr className="border-b border-border">
							<td className="py-2 font-medium text-muted-foreground">Max Output Tokens</td>
							<td className="py-2 text-right">{formatTokens(model.max_tokens)}</td>
						</tr>
						<tr className="border-b border-border">
							<td className="py-2 font-medium text-muted-foreground">Input Price</td>
							<td className="py-2 text-right">
								{inputPrice === 0 ? "Free" : `${formatCurrency(inputPrice)}/1M tokens`}
							</td>
						</tr>
						<tr className="border-b border-border">
							<td className="py-2 font-medium text-muted-foreground">Output Price</td>
							<td className="py-2 text-right">
								{outputPrice === 0 ? "Free" : `${formatCurrency(outputPrice)}/1M tokens`}
							</td>
						</tr>
						{(cacheReadPrice > 0 || cacheWritePrice > 0) && (
							<>
								<tr className="border-b border-border">
									<td className="py-2 font-medium text-muted-foreground">Cache Read</td>
									<td className="py-2 text-right">
										{cacheReadPrice === 0 ? "Free" : `${formatCurrency(cacheReadPrice)}/1M tokens`}
									</td>
								</tr>
								<tr className="border-b border-border">
									<td className="py-2 font-medium text-muted-foreground">Cache Write</td>
									<td className="py-2 text-right">
										{cacheWritePrice === 0
											? "Free"
											: `${formatCurrency(cacheWritePrice)}/1M tokens`}
									</td>
								</tr>
							</>
						)}
						<tr>
							<td className="py-2 font-semibold">Total Price</td>
							<td className="py-2 text-right font-semibold">
								{model.totalPrice === 0 ? "Free" : `${formatCurrency(model.totalPrice)}/1M tokens`}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	)
}
