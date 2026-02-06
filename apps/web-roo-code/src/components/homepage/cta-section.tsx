import { Button } from "@/components/ui"
import { ArrowRight, Download, Heart } from "lucide-react"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function CTASection() {
	return (
		<section className="py-24 bg-gradient-to-b from-pink-50/50 to-rose-50/30 dark:from-pink-950/20 dark:to-rose-950/10 border-t border-pink-200 dark:border-pink-900/30">
			<div className="container px-4 mx-auto sm:px-6 lg:px-8 text-center">
				<div className="flex items-center justify-center gap-2 mb-4">
					<Heart className="h-6 w-6 text-pink-500 fill-pink-500 pulse-heart" />
					<Heart
						className="h-8 w-8 text-rose-500 fill-rose-500 pulse-heart"
						style={{ animationDelay: "0.2s" }}
					/>
					<Heart
						className="h-6 w-6 text-red-500 fill-red-500 pulse-heart"
						style={{ animationDelay: "0.4s" }}
					/>
				</div>
				<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">
					Code with <span className="text-pink-500 dark:text-pink-400">love</span>.
				</h2>
				<p className="text-lg text-muted-foreground mb-8">Build faster. Solo or Together.</p>

				<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
					<Button
						size="lg"
						className="w-full sm:w-auto h-12 px-8 text-base bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-0">
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
						className="w-full sm:w-auto h-12 px-8 text-base border-pink-300 dark:border-pink-700 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/50">
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
