import { Laptop, Cloud } from "lucide-react"

export function StrategySection() {
	return (
		<section className="py-24 bg-background">
			<div className="container px-4 mx-auto sm:px-6 lg:px-8">
				<div className="text-center mb-16">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">One Core. Two Runtimes.</h2>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
					{/* Local Runtime */}
					<div className="p-8 rounded-2xl border border-border bg-card hover:border-blue-500/50 transition-colors">
						<div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-6">
							<Laptop className="h-6 w-6 text-blue-500" />
						</div>
						<h3 className="text-2xl font-semibold mb-2">Local Runtime (Extension)</h3>
						<div className="text-sm font-mono text-blue-500 mb-4">For Deep Work</div>
						<p className="text-muted-foreground leading-relaxed">
							Run Roo directly in VS Code. You control the context, the prompts, and the API keys. Ideal
							for complex logic, architecture planning, and real-time debugging where you need full
							control.
						</p>
					</div>

					{/* Cloud Runtime */}
					<div className="p-8 rounded-2xl border border-border bg-card hover:border-purple-500/50 transition-colors">
						<div className="h-12 w-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-6">
							<Cloud className="h-6 w-6 text-purple-500" />
						</div>
						<h3 className="text-2xl font-semibold mb-2">Cloud Runtime (Headless)</h3>
						<div className="text-sm font-mono text-purple-500 mb-4">For Delegation</div>
						<p className="text-muted-foreground leading-relaxed">
							Dispatch tasks from your IDE or Slack. Roo spins up a sandboxed environment, checks out the
							repo, implements changes, runs tests, and opens a PR. Ideal for migrations, testing, and
							maintenance.
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}
