import { type AgentPageContent } from "@/app/shared/agent-page-content"

// Workaround for next/image choking on these for some reason
const hero = { src: "/heroes/agent-explainer.png" }

// Re-export for convenience
export type { AgentPageContent }

export const content: AgentPageContent = {
	agentName: "Explainer",
	hero: {
		icon: "BookOpen",
		heading: "Understanding at the speed of thought.",
		paragraphs: [
			"Roo Code's Explainer agent turns complex code, documentation, and technical concepts into crystal-clear explanations. Whether you're onboarding to a new codebase, understanding legacy systems, or documenting architectural decisions, get the insights you need instantly.",
			"Powered by your choice of AI models with full repository context, it delivers explanations that actually make sense—not generic responses.",
		],
		image: {
			url: hero.src,
			width: 800,
			height: 711,
			alt: "Roo Code Explainer agent providing clear technical explanations",
		},
		crossAgentLink: {
			text: "Works great with",
			links: [
				{
					text: "Coder Agent",
					href: "/coder",
					icon: "Code",
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
				title: "1. Point to any code or documentation",
				description:
					"Select code, reference documentation, or describe concepts you need explained. The agent understands context from files, PRs, issues, or architectural diagrams.",
				icon: "FileText",
			},
			{
				title: "2. Get deep, contextual explanations",
				description:
					"Receive comprehensive explanations that consider your entire codebase, project conventions, and technical stack. No more generic answers—get explanations specific to your implementation.",
				icon: "Lightbulb",
			},
			{
				title: "3. Generate or update documentation",
				description:
					"Transform explanations into lasting documentation. Automatically generate README files, API docs, or architectural decision records that stay in sync with your code. Perfect for pairing with the Coder Agent.",
				icon: "BookOpen",
			},
		],
	},
	whyBetter: {
		heading: "Why Roo's Explainer is different",
		features: [
			{
				title: "Full codebase awareness",
				description:
					"Unlike chat-based tools that only see snippets, Explainer analyzes your entire repository structure, dependencies, and patterns to provide complete, accurate explanations that consider all interactions and side effects.",
				icon: "BookMarked",
			},
			{
				title: "Learning that scales with your team",
				description:
					"Generate explanations once, share knowledge forever. Create onboarding guides, technical deep-dives, and living documentation that help your entire team understand complex systems faster.",
				icon: "Lightbulb",
			},
			{
				title: "Bring your own key, get unlimited depth",
				description:
					"Use your preferred AI models without token limits imposed by fixed pricing. Get thorough, detailed explanations that don't cut corners to save costs—especially crucial for understanding complex systems.",
				icon: "Key",
			},
		],
	},
	cta: {
		heading: "Turn confusion into clarity.",
		description:
			"Let Roo Code's Explainer agent help your team understand any codebase, concept, or technical decision in minutes, not days.",
		buttonText: "Start 14-day Free Trial",
	},
}
