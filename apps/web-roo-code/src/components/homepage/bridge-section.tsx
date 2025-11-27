import { ArrowRight } from "lucide-react"

export function BridgeSection() {
	return (
		<section className="py-24 bg-background border-y border-border relative overflow-hidden">
			{/* Background decorative elements */}
			<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

			<div className="container relative px-4 mx-auto sm:px-6 lg:px-8 text-center">
				<div className="inline-flex items-center justify-center p-2 mb-8 rounded-full bg-muted/50 backdrop-blur-sm border border-border">
					<span className="px-3 py-1 text-sm font-medium">The Bridge</span>
				</div>

				<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-6">
					Prototype Locally. Scale Globally.
				</h2>

				<div className="max-w-3xl mx-auto mb-12">
					<p className="text-xl text-muted-foreground leading-relaxed">
						&quot;The Extension is your proving ground. Once you trust a specific Model and Mode to handle
						your logic, dispatch it to the Cloud to run in parallel.&quot;
					</p>
				</div>

				<div className="flex flex-col md:flex-row items-center justify-center gap-8 text-lg font-medium">
					<div className="px-8 py-4 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
						Local Prototyping
					</div>
					<ArrowRight className="h-8 w-8 text-muted-foreground rotate-90 md:rotate-0" />
					<div className="px-8 py-4 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
						Cloud Scaling
					</div>
				</div>
			</div>
		</section>
	)
}
