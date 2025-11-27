import { Brain, Layers } from "lucide-react"

export function ExtensionSection() {
	return (
		<section className="py-24 bg-muted/30">
			<div className="container px-4 mx-auto sm:px-6 lg:px-8">
				<div className="text-center mb-16">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
						Local Control. Universal Compatibility.
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						The interface that adapts to your stack, not the other way around.
					</p>
				</div>

				<div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
					{/* Visual Placeholder - In a real implementation this would be the screenshot */}
					<div className="relative aspect-video rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-border shadow-2xl overflow-hidden flex items-center justify-center">
						<div className="text-slate-500 text-sm">Extension Interface Screenshot</div>
						{/* Ideally we would use the CodeExample component here or an actual image */}
					</div>

					<div className="space-y-8">
						<div>
							<div className="flex items-center gap-3 mb-4">
								<Brain className="h-6 w-6 text-blue-500" />
								<h3 className="text-2xl font-bold">Radical Model Freedom</h3>
							</div>
							<h4 className="text-lg font-semibold mb-2">Bring Your Own Intelligence</h4>
							<p className="text-muted-foreground mb-6">
								Don&apos;t get locked into a single provider. Roo performs well with a wide range of
								models, from the bleeding edge to cost-effective open weight options. It&apos;s the
								closest to brain transplants you&apos;ll ever see.
							</p>
							<ul className="space-y-3 text-sm">
								<li className="flex gap-3">
									<span className="font-bold min-w-[60px]">Dev:</span>
									<span className="text-muted-foreground">
										Use Claude 3.5 Sonnet for complex reasoning.
									</span>
								</li>
								<li className="flex gap-3">
									<span className="font-bold min-w-[60px]">Speed:</span>
									<span className="text-muted-foreground">
										Switch to DeepSeek or GPT-4o for quick refactors.
									</span>
								</li>
								<li className="flex gap-3">
									<span className="font-bold min-w-[60px]">Privacy:</span>
									<span className="text-muted-foreground">
										Connect to Ollama for air-gapped, local inference.
									</span>
								</li>
							</ul>
							<div className="mt-6 pt-6 border-t border-border">
								<p className="text-xs text-muted-foreground font-mono">
									Supports: OpenRouter, Anthropic, OpenAI, Gemini, Mishmash, and more.
								</p>
							</div>
						</div>
					</div>
				</div>

				<div className="grid lg:grid-cols-2 gap-12 items-center">
					<div className="order-2 lg:order-1 space-y-8">
						<div>
							<div className="flex items-center gap-3 mb-4">
								<Layers className="h-6 w-6 text-purple-500" />
								<h3 className="text-2xl font-bold">Mode-Based Workflow</h3>
							</div>
							<h4 className="text-lg font-semibold mb-2">Context Switching Built-In</h4>
							<p className="text-muted-foreground mb-6">
								Roo doesn&apos;t treat every prompt the same. Use specialized modes to constrain the
								AI’s behavior:
							</p>
							<div className="grid gap-4">
								<div className="p-4 rounded-lg bg-background border border-border">
									<div className="font-bold mb-1 text-purple-500">Architect Mode</div>
									<div className="text-sm text-muted-foreground">
										High-level planning. No file writes.
									</div>
								</div>
								<div className="p-4 rounded-lg bg-background border border-border">
									<div className="font-bold mb-1 text-blue-500">Code Mode</div>
									<div className="text-sm text-muted-foreground">
										Implementation and terminal execution.
									</div>
								</div>
								<div className="p-4 rounded-lg bg-background border border-border">
									<div className="font-bold mb-1 text-green-500">Ask Mode</div>
									<div className="text-sm text-muted-foreground">
										Data retrieval and codebase analysis.
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Visual Placeholder for Modes */}
					<div className="order-1 lg:order-2 relative aspect-square max-w-md mx-auto rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-border shadow-2xl overflow-hidden flex items-center justify-center">
						<div className="text-slate-500 text-sm">Mode Selector UI</div>
					</div>
				</div>
			</div>
		</section>
	)
}
