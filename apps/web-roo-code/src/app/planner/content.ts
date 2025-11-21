import { type AgentPageContent } from "@/app/shared/agent-page-content"

// Workaround for next/image choking on these for some reason
const hero = { src: "/heroes/agent-planner.png" }

// Re-export for convenience
export type { AgentPageContent }

export const content: AgentPageContent = {
	agentName: "Planner",
	hero: {
		icon: "Map",
		heading: "Strategic thinking for complex technical challenges.",
		paragraphs: [
			"Roo Code's Planner agent transforms vague requirements into clear implementation strategies. It maps out technical decisions, identifies potential pitfalls, and creates detailed roadmaps that guide your team from concept to completion.",
			"Using advanced reasoning with your API key, it doesn't just outline steps—it anticipates challenges, evaluates tradeoffs, and recommends optimal solutions based on your specific context.",
		],
		image: {
			url: hero.src,
			width: 800,
			height: 711,
			alt: "Roo Code Planner agent creating technical implementation strategies",
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
					text: "Explainer Agent",
					href: "/explainer",
					icon: "BookOpen",
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
				title: "1. Define your goals and constraints",
				description:
					"Describe what you want to build, your technical constraints, and business requirements. The agent analyzes your existing architecture, tech stack, and team capabilities to understand the full context.",
				icon: "Target",
			},
			{
				title: "2. Get comprehensive implementation plans",
				description:
					"Receive detailed technical specifications with architecture diagrams, data flow designs, API contracts, and step-by-step implementation guides. Each decision includes reasoning and alternatives considered.",
				icon: "Compass",
			},
			{
				title: "3. Navigate execution with confidence",
				description:
					"Use the roadmap to guide development, with clear milestones, risk mitigation strategies, and contingency plans. The agent helps you make informed decisions when requirements change or challenges arise.",
				icon: "Map",
			},
		],
	},
	whyBetter: {
		heading: "Why Roo's Planner is different",
		features: [
			{
				title: "Context-aware strategic thinking",
				description:
					"Unlike generic planning tools, Planner understands your specific codebase, architecture, and constraints. It creates strategies that work with your existing systems, not theoretical solutions that ignore reality.",
				icon: "Compass",
			},
			{
				title: "Technical depth meets business sense",
				description:
					"Balances technical excellence with practical constraints. Considers performance, scalability, maintainability, and team velocity to recommend solutions that are both elegant and achievable within your timeline.",
				icon: "Target",
			},
			{
				title: "Unlimited reasoning, zero compromises",
				description:
					"Your API key powers deep analysis without token limits. Get thorough evaluations of complex problems, detailed tradeoff analysis, and comprehensive documentation—not rushed summaries that miss critical details.",
				icon: "Key",
			},
		],
	},
	cta: {
		heading: "Plan with precision. Execute with confidence.",
		description:
			"Let Roo Code's Planner agent map out your technical strategy, from high-level architecture to detailed implementation roadmaps.",
		buttonText: "Start 14-day Free Trial",
	},
}
