"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import {
	LucideIcon,
	Pointer,
	Slack,
	Github,
	Code,
	GitPullRequest,
	Wrench,
	Map,
	MessageCircleQuestionMark,
} from "lucide-react"

interface UseCase {
	role: string
	use: string
	agent: UseCaseAgent
	context: UseCaseSource
}

interface UseCaseSource {
	name: string
	icon: LucideIcon
}

interface UseCaseAgent {
	name: string
	icon: LucideIcon
}

interface PositionedUseCase extends UseCase {
	layer: 1 | 2 | 3 | 4
	position: { x: number; y: number }
	scale: number
	zIndex: number
}

const SOURCES = {
	slack: {
		name: "Slack",
		icon: Slack,
	},
	web: {
		name: "Web",
		icon: Pointer,
	},
	github: {
		name: "Github",
		icon: Github,
	},
	extension: {
		name: "Extension",
		icon: Code,
	},
}

const AGENTS = {
	explainer: {
		name: "Explainer",
		icon: MessageCircleQuestionMark,
	},
	planner: {
		name: "Planner",
		icon: Map,
	},
	coder: {
		name: "Coder",
		icon: Code,
	},
	reviewer: {
		name: "Reviewer",
		icon: GitPullRequest,
	},
	fixer: {
		name: "Fixer",
		icon: Wrench,
	},
}

const USE_CASES: UseCase[] = [
	{
		role: "Frontend Developer",
		use: "Take Lisa's feedback above and incorporate it into the landing page.",
		agent: AGENTS.coder,
		context: SOURCES.slack,
	},
	{
		role: "Customer Success Rep",
		use: "What could be causing this bug?",
		agent: AGENTS.explainer,
		context: SOURCES.web,
	},
	{
		role: "Backend Engineer",
		use: "Create a migration denormalizing total_cost calculation and backfill the remainder.",
		agent: AGENTS.coder,
		context: SOURCES.extension,
	},
	{
		role: "Security Engineer",
		use: "Do we use any of the libraries mentioned in the thread?",
		agent: AGENTS.explainer,
		context: SOURCES.slack,
	},
	{
		role: "Designer",
		use: "Refactor the button component to use CSS variables",
		agent: AGENTS.coder,
		context: SOURCES.slack,
	},
	{
		role: "Product Manager",
		use: "How big of a change would it be to make this an option?",
		agent: AGENTS.coder,
		context: SOURCES.web,
	},
]

// Seeded random number generator for consistent layout
function seededRandom(seed: number) {
	let value = seed
	return () => {
		value = (value * 9301 + 49297) % 233280
		return value / 233280
	}
}

const LAYER_SCALES = {
	1: 0.7,
	2: 0.85,
	3: 1.0,
	4: 1.15,
}

function distributeItems(items: UseCase[]): PositionedUseCase[] {
	const rng = seededRandom(12345)
	const zones = { rows: 4, cols: 5 } // 20 zones for 20 items
	const zoneWidth = 100 / zones.cols
	const zoneHeight = 100 / zones.rows

	// Create array of zone indices [0...19] and shuffle them
	const zoneIndices = Array.from({ length: items.length }, (_, i) => i)
	for (let i = zoneIndices.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1))
		const temp = zoneIndices[i]!
		zoneIndices[i] = zoneIndices[j]!
		zoneIndices[j] = temp
	}

	return items.map((item, index) => {
		// Assign to a random unique zone
		const zoneIndex = zoneIndices[index]!
		const row = Math.floor(zoneIndex / zones.cols)
		const col = zoneIndex % zones.cols

		// Distribute layers evenly
		const layer = (Math.floor(index / 5) + 1) as 1 | 2 | 3 | 4

		// Calculate base position (center of zone)
		const baseX = col * zoneWidth + zoneWidth / 2
		const baseY = row * zoneHeight + zoneHeight / 2

		// Add jitter (±35% of zone size to keep somewhat contained but messy)
		const jitterX = (rng() - 0.5) * zoneWidth * 0.7
		const jitterY = (rng() - 0.5) * zoneHeight * 0.7

		return {
			...item,
			layer,
			position: {
				x: baseX + jitterX,
				y: baseY + jitterY,
			},
			scale: LAYER_SCALES[layer],
			zIndex: layer,
		}
	})
}

function UseCaseCard({ item }: { item: PositionedUseCase }) {
	const ContextIcon: LucideIcon = item.context.icon
	const AgentIcon: LucideIcon = item.agent.icon

	return (
		<motion.div
			className="absolute w-[200px] md:w-[300px] cursor-default"
			style={{
				left: `${item.position.x}%`,
				top: `${item.position.y}%`,
				zIndex: item.zIndex,
			}}
			initial={{ opacity: 0, scale: 0 }}
			whileInView={{
				opacity: 1,
				scale: item.scale,
				transition: {
					duration: 0.1,
					delay: 0, // Stagger by layer
				},
			}}
			whileHover={{
				scale: 1,
				zIndex: 30,
			}}
			viewport={{ once: true }}
			// Use standard CSS transform for the positioning to avoid conflicts with Framer Motion's scale
			transformTemplate={({ scale }) => `translate(-50%, -50%) scale(${scale})`}>
			<div
				className={`rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-3 md:p-4 shadow-sm transition-shadow hover:shadow-md ${
					item.layer === 4 ? "shadow-lg border-border" : ""
				}`}>
				<div className="text-lg font- text-violet-600 mb-1">
					{item.role}
					<br />
					<div>
						with <AgentIcon className="size-4 inline ml-1" /> {item.agent.name} Agent
					</div>
				</div>

				<div className="text-xl font-light leading-tight my-1">{item.use}</div>

				<div className="text-base font-light text-muted-foreground leading-tight mb-1">
					via <ContextIcon className="size-4 inline ml-1" /> {item.context.name}
				</div>
			</div>
		</motion.div>
	)
}

export function UseExamplesSection() {
	const positionedItems = useMemo(() => distributeItems(USE_CASES), [])

	return (
		<section className="py-24 bg-background overflow-hidden">
			<div className="container px-4 mx-auto sm:px-6 lg:px-8">
				<div className="text-center mb-16">
					<h2 className="text-4xl font-bold tracking-tight mb-4">
						The AI team to help your <em>entire</em> human team
					</h2>
					<p className="text-xl font-light text-muted-foreground max-w-2xl mx-auto">
						Developers, PMs, Designers, Customer Success: everyone moves faster and more independently with
						Roo.
					</p>
				</div>

				{/* Positioned Items Container */}
				<div className="relative min-h-[500px] md:min-h-[600px] lg:min-h-[700px] w-full max-w-7xl mx-auto">
					{positionedItems.map((item, index) => (
						<UseCaseCard key={index} item={item} />
					))}
				</div>
			</div>
		</section>
	)
}
