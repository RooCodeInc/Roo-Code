import { Button } from "@/components/ui"
import { ArrowRight, Download, Heart } from "lucide-react"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function CTASection() {
	return (
		<section className="py-24 bg-gradient-to-b from-muted/30 to-pink-50/30 dark:to-rose-950/10 border-t border-border">
			<div className="container px-4 mx-auto sm:px-6 lg:px-8 text-center">
				<div className="flex items-center justify-center gap-2 mb-4">
					<Heart className="h-6 w-6 text-pink-500 fill-pink-500 animate-pulse" />
					<span className="text-pink-500 dark:text-pink-400 font-medium">Valentine&apos;s Special</span>
					<Heart className="h-6 w-6 text-pink-500 fill-pink-500 animate-pulse" />
				</div>
				<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">Fall in Love with AI Coding</h2>
				<p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
					This Valentine&apos;s Day, give your development workflow the love it deserves. Build faster,
					together.
				</p>

				<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
					<Button
						size="lg"
						className="w-full sm:w-auto h-12 px-8 text-base bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 border-0">
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
						className="w-full sm:w-auto h-12 px-8 text-base border-pink-300 dark:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-950/20">
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
