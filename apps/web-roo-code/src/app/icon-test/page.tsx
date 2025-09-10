"use client"

import { FaRobot, FaCode, FaBrain, FaGlobe, FaTerminal, FaPuzzlePiece } from "react-icons/fa"
import {
	FaRobot as Fa6Robot,
	FaCode as Fa6Code,
	FaBrain as Fa6Brain,
	FaGlobe as Fa6Globe,
	FaPuzzlePiece as Fa6PuzzlePiece,
} from "react-icons/fa6"
import { Bot, Code2, Brain, Globe, Terminal, Puzzle } from "lucide-react"

export default function IconTestPage() {
	const iconSets = [
		{
			title: "Font Awesome 5 (react-icons/fa) - Currently Used",
			description: "Icons from react-icons/fa - what we're using now",
			icons: [
				{ icon: <FaRobot className="h-6 w-6" />, label: "FaRobot" },
				{ icon: <FaPuzzlePiece className="h-6 w-6" />, label: "FaPuzzlePiece" },
				{ icon: <FaBrain className="h-6 w-6" />, label: "FaBrain" },
				{ icon: <FaGlobe className="h-6 w-6" />, label: "FaGlobe" },
				{ icon: <FaCode className="h-6 w-6" />, label: "FaCode" },
				{ icon: <FaTerminal className="h-6 w-6" />, label: "FaTerminal" },
			],
			wrapperClass:
				"mb-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500/5 to-cyan-500/5 p-2.5",
			innerClass: "rounded-lg bg-gradient-to-r from-blue-500/80 to-cyan-500/80 p-2.5",
			iconClass: "text-foreground/90",
		},
		{
			title: "Font Awesome 6 (react-icons/fa6)",
			description: "Icons from react-icons/fa6 - newer version",
			icons: [
				{ icon: <Fa6Robot className="h-6 w-6" />, label: "Fa6Robot" },
				{ icon: <Fa6PuzzlePiece className="h-6 w-6" />, label: "Fa6PuzzlePiece" },
				{ icon: <Fa6Brain className="h-6 w-6" />, label: "Fa6Brain" },
				{ icon: <Fa6Globe className="h-6 w-6" />, label: "Fa6Globe" },
				{ icon: <Fa6Code className="h-6 w-6" />, label: "Fa6Code" },
			],
			wrapperClass:
				"mb-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500/5 to-cyan-500/5 p-2.5",
			innerClass: "rounded-lg bg-gradient-to-r from-blue-500/80 to-cyan-500/80 p-2.5",
			iconClass: "text-foreground/90",
		},
		{
			title: "Lucide React Icons",
			description: "Alternative icons from lucide-react",
			icons: [
				{ icon: <Bot className="h-6 w-6" />, label: "Bot" },
				{ icon: <Puzzle className="h-6 w-6" />, label: "Puzzle" },
				{ icon: <Brain className="h-6 w-6" />, label: "Brain" },
				{ icon: <Globe className="h-6 w-6" />, label: "Globe" },
				{ icon: <Code2 className="h-6 w-6" />, label: "Code2" },
				{ icon: <Terminal className="h-6 w-6" />, label: "Terminal" },
			],
			wrapperClass:
				"mb-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500/5 to-cyan-500/5 p-2.5",
			innerClass: "rounded-lg bg-gradient-to-r from-blue-500/80 to-cyan-500/80 p-2.5",
			iconClass: "text-foreground/90",
		},
		{
			title: "Raw Icons Comparison (No Styling)",
			description: "All icon sets without wrapper styling",
			icons: [
				{ icon: <FaRobot className="h-8 w-8" />, label: "FA5 Robot" },
				{ icon: <Fa6Robot className="h-8 w-8" />, label: "FA6 Robot" },
				{ icon: <Bot className="h-8 w-8" />, label: "Lucide Bot" },
				{ icon: <FaPuzzlePiece className="h-8 w-8" />, label: "FA5 Puzzle" },
				{ icon: <Fa6PuzzlePiece className="h-8 w-8" />, label: "FA6 Puzzle" },
				{ icon: <Puzzle className="h-8 w-8" />, label: "Lucide Puzzle" },
			],
			wrapperClass: "",
			innerClass: "",
			iconClass: "",
		},
	]

	return (
		<div className="min-h-screen bg-background p-8">
			<div className="mx-auto max-w-7xl">
				<h1 className="mb-8 text-3xl font-bold">Icon Library Comparison</h1>

				<div className="mb-8 rounded-lg bg-muted p-4">
					<p className="text-sm mb-2">
						<strong>Current Setup:</strong> React Icons v5.5.0 (from package.json)
					</p>
					<p className="text-sm mb-2">
						This page compares different icon libraries to identify which ones match the production site.
					</p>
					<p className="text-sm">
						The production site at https://roocode.com might be using a different icon set or version.
					</p>
				</div>

				{iconSets.map((set, setIndex) => (
					<div key={setIndex} className="mb-12 border-b border-border pb-8">
						<h2 className="mb-2 text-xl font-semibold">{set.title}</h2>
						<p className="mb-6 text-sm text-muted-foreground">{set.description}</p>

						<div className="grid grid-cols-3 gap-8 md:grid-cols-6">
							{set.icons.map((item, index) => (
								<div key={index} className="text-center">
									{set.wrapperClass ? (
										<div className={set.wrapperClass}>
											<div className={set.innerClass}>
												<div className={set.iconClass}>{item.icon}</div>
											</div>
										</div>
									) : (
										<div className="mb-5 inline-flex items-center justify-center p-4">
											{item.icon}
										</div>
									)}
									<p className="text-xs font-medium">{item.label}</p>
								</div>
							))}
						</div>
					</div>
				))}

				<div className="mt-12 space-y-4 rounded-lg bg-muted p-6">
					<h3 className="text-lg font-semibold">Visual Differences to Look For:</h3>
					<ul className="space-y-2 text-sm list-disc list-inside">
						<li>Font Awesome 5 vs 6: FA6 icons often have slightly different designs and weights</li>
						<li>Lucide icons: Generally have a more consistent stroke width and modern design</li>
						<li>The robot icon in FA5 vs FA6 has notable differences in design</li>
						<li>The puzzle piece icon also varies between versions</li>
					</ul>
				</div>

				<div className="mt-8 flex gap-4">
					<a href="/" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">
						Go to Homepage
					</a>
					<a href="/roomote-control" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">
						Go to Roomote Control
					</a>
					<a
						href="https://roocode.com"
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-lg bg-secondary px-4 py-2 text-secondary-foreground">
						View Production Site
					</a>
				</div>
			</div>
		</div>
	)
}
