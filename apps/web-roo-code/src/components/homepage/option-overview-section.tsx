import { Laptop, Cloud, ArrowRight } from "lucide-react"
import { Button } from "../ui"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function OptionOverviewSection() {
	return (
		<section className="py-24 bg-background">
			<div className="container px-4 mx-auto sm:px-6 lg:px-8">
				<div className="text-center mb-16">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
						Different form factors for different ways of working.
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Roo&apos;s always there to help you get stuff done.
					</p>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
					<div className="rounded-2xl bg-card shadow-lg p-8 h-full group transition-all hover:shadow-2xl hover:shadow-blue-800/30">
						<div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-6">
							<Laptop className="h-6 w-6 text-blue-500" />
						</div>
						<h3 className="text-2xl font-semibold mb-2">Roo Code VS Code Extension</h3>
						<p className="font-semibold text-blue-500 mb-4">For Individual Work</p>

						<div className="text-muted-foreground mb-4">
							<p>
								Run Roo directly in VS Code (or any fork – even Cursor!), stay close to the code and
								control everything:
							</p>
							<ul className="list-inside my-4 space-y-1">
								<li className="list-disc">Approve every action (or set it to auto-approve)</li>
								<li className="list-disc">Manage the context window</li>
								<li className="list-disc">Configure every detail</li>
								<li className="list-disc">Preview changes live</li>
								<li className="list-disc">Stick to your customized editor</li>
								<li className="list-disc">Write code by hand (gasp!)</li>
							</ul>
							<p>
								Ideal for real-time debugging or quick iteration where you need full, immediate control.
							</p>
						</div>

						<Button size="lg" variant="default" className="bg-blue-600 hover:bg-blue-600/80">
							<a
								href={EXTERNAL_LINKS.MARKETPLACE}
								target="_blank"
								rel="noreferrer"
								className="flex items-center justify-center">
								Install now
								<ArrowRight className="ml-2" />
							</a>
						</Button>
					</div>

					<div className="rounded-2xl bg-card shadow-lg p-8 h-full group transition-all hover:shadow-2xl hover:shadow-violet-800/30">
						<div className="h-12 w-12 bg-violet-500/10 rounded-lg flex items-center justify-center mb-6">
							<Cloud className="h-6 w-6 text-violet-500" />
						</div>
						<h3 className="text-2xl font-semibold mb-2">Roo Code Cloud</h3>
						<div className="font-semibold text-violet-500 mb-4">For Team Work with Agents</div>

						<div className="text-muted-foreground mb-4">
							<p>
								Create your agent team in the Cloud, give them access to Github and start giving them
								tasks:
							</p>
							<ul className="list-inside my-4 space-y-1">
								<li className="list-disc">
									Use agents like the Planner, Coder, Explainer, Reviewer and Fixer
								</li>
								<li className="list-disc">Choose your provider and model</li>
								<li className="list-disc">
									Create tasks from the Web and Slack (more integrations soon)
								</li>
								<li className="list-disc">Get PR Reviews (and fixes) directly on Github</li>
								<li className="list-disc">Collaborate with co-workers</li>
							</ul>
							<p>Ideal for kicking projects off and parallelizing execution.</p>
						</div>

						<Button size="lg" variant="default" className="bg-violet-600 hover:bg-violet-600/80">
							<a href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME} className="flex items-center justify-center">
								Try now for free
								<ArrowRight className="ml-2" />
							</a>
						</Button>
					</div>
				</div>
			</div>
		</section>
	)
}
