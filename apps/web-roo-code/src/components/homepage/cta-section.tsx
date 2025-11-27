import { Button } from "@/components/ui"
import { ArrowRight, Download } from "lucide-react"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function CTASection() {
	return (
		<section className="py-24 bg-muted/30 border-t border-border">
			<div className="container px-4 mx-auto sm:px-6 lg:px-8 text-center">
				<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-8">Build faster. Solo or Together.</h2>

				<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
					<Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base">
						<a
							href="https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2">
							<Download className="h-4 w-4" />
							Download for VS Code
						</a>
					</Button>

					<Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base">
						<a
							href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2">
							Start Cloud Trial
							<ArrowRight className="h-4 w-4" />
						</a>
					</Button>
				</div>
			</div>
		</section>
	)
}
