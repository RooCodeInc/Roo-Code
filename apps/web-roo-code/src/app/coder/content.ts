import { type AgentPageContent } from "@/app/shared/agent-page-content"

// Workaround for next/image choking on these for some reason
const hero = { src: "/heroes/agent-coder.png" }

// Re-export for convenience
export type { AgentPageContent }

export const content: AgentPageContent = {
	agentName: "Coder",
	hero: {
		icon: "Code",
		heading: "From idea to implementation in minutes, not days.",
		paragraphs: [
			"Roo Code's Coder agent transforms requirements directly into production-ready code. Whether building new features, refactoring existing systems, or creating entire applications, it writes clean, tested code that follows your team's patterns and conventions.",
			"Powered by advanced reasoning models with your API key, it doesn't just generate code—it implements complete solutions with proper error handling, tests, and documentation.",
		],
		image: {
			url: hero.src,
			width: 800,
			height: 711,
			alt: "Roo Code Coder agent writing production-ready code",
		},
		crossAgentLink: {
			text: "Works great with",
			links: [
				{
					text: "Explainer Agent",
					href: "/explainer",
					icon: "BookOpen",
				},
				{
					text: "Planner Agent",
					href: "/planner",
					icon: "Map",
				},
			],
		},
		cta: {
			buttonText: "Start 14-day Free Trial",
			disclaimer: "(cancel anytime)",
		},
	},
	howItWorks: {
		heading: "How It Works",
		steps: [
			{
				title: "1. Describe what you need",
				description:
					"Provide requirements through issues, specs, or natural language. The agent understands context from existing code, architecture documents, and team conventions to ensure consistency.",
				icon: "Terminal",
			},
			{
				title: "2. Review the implementation plan",
				description:
					"Get a clear breakdown of the proposed changes before any code is written. Understand what will be built, modified, or refactored, with reasoning for each decision.",
				icon: "FileCode",
			},
			{
				title: "3. Ship tested, PR-ready code",
				description:
					"Receive complete implementations with tests, error handling, and documentation. The agent creates pull requests with clear commit messages and descriptions, ready for review and merge.",
				icon: "Code",
			},
		],
	},
	whyBetter: {
		heading: "Why Roo's Coder is different",
		features: [
			{
				title: "Repository-aware implementation",
				description:
					"Unlike generic code generators, Coder understands your entire codebase—existing patterns, dependencies, and conventions. It writes code that fits seamlessly with your project, not boilerplate that needs extensive modification.",
				icon: "Blocks",
			},
			{
				title: "Complete solutions, not snippets",
				description:
					"Goes beyond generating individual functions to implement entire features. Handles edge cases, adds proper error handling, creates tests, updates documentation, and manages dependencies—everything needed for production-ready code.",
				icon: "ListChecks",
			},
			{
				title: "Your models, unlimited capability",
				description:
					"Bring your own API key to use cutting-edge models without artificial limits. Get thorough implementations that don't cut corners to save tokens—crucial for complex features that require deep reasoning and extensive code generation.",
				icon: "Key",
			},
		],
	},
	cta: {
		heading: "Code at the speed of thought.",
		description:
			"Let Roo Code's Coder agent turn your ideas into production-ready implementations, complete with tests and documentation.",
		buttonText: "Start 14-day Free Trial",
	},
}
