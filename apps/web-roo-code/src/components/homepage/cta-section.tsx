import { Button } from "@/components/ui"
import { Download } from "lucide-react"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function CTASection() {
	return (
		<section className="py-24 bg-muted/30 border-t border-border">
			<div className="container px-4 mx-auto sm:px-6 lg:px-8 text-center">
				<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-8">Build better and faster</h2>

				<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
					<Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base">
						<a
							href={EXTERNAL_LINKS.MARKETPLACE}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2">
							<Download className="h-4 w-4" />
							Install on VS Code
						</a>
					</Button>
				</div>
			</div>
		</section>
	)
}
