import { Button } from "@/components/ui"
import { ArrowRight, Download } from "lucide-react"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function CTASection() {
	return (
		<section className="py-24 bg-muted/30 border-t border-border relative overflow-hidden">
			<div className="absolute inset-0 -z-10">
				<div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-fuchsia-500/10 dark:from-violet-700/15 dark:via-blue-700/15 dark:to-fuchsia-700/15 blur-[120px]" />
			</div>
			<div className="container px-4 mx-auto sm:px-6 lg:px-8 text-center">
				<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-8">
					Build faster.{" "}
					<span className="bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 dark:from-blue-400 dark:via-violet-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
						Solo or Together.
					</span>
				</h2>

				<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
					<Button
						size="lg"
						className="w-full sm:w-auto h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-lg shadow-blue-500/25">
						<a
							href={EXTERNAL_LINKS.MARKETPLACE}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2">
							<Download className="h-4 w-4" />
							Install on VS Code
						</a>
					</Button>

					<Button
						variant="outline"
						size="lg"
						className="w-full sm:w-auto h-12 px-8 text-base border-violet-500/50 hover:bg-violet-500/10 hover:border-violet-500">
						<a
							href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2">
							Try Cloud for Free
							<ArrowRight className="h-4 w-4" />
						</a>
					</Button>
				</div>
			</div>
		</section>
	)
}
