"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"

const testimonials = [
	{
		quote: "You can do almost anything that you can do in your local instance... It's a pretty sleek interface. The interaction works amazingly well — almost like the local Roo Code. And I haven't seen any issues... Another thing that is more of a cloud feature, is you can see the tasks that you have made here. I really like this because you can start some tasks, let them run in the background if you're outside or busy, and then come back and plug right back into the same Roo Code that you already love without compromising on any of the features, because it's literally just Roo Code being interfaced via a web UI.",
		author: "AI Code King",
		avatar: "/ai-code-king.jpg",
		fallback: "/placeholder_pfp.png",
	},
	{
		quote: "What Roo Code has done is they've actually come out and created a cloud-based version of this where theoretically, you can do what I was doing here, have a computer set up with multiple instances of your IDE, and basically run it in your own infrastructure and you're controlling it through this orchestrator that Roo Code has called Roomote. Maybe I'm out to lunch somewhere and I want to think through something, I can do that remotely with my computer. It's pretty sweet to be honest.",
		author: "Adam Larson, GosuCoder",
		avatar: "/adam-larson.jpg",
		fallback: "/placeholder_pfp.png",
	},
]

export function RoomoteTestimonials() {
	const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>({})
	const [imagesLoaded, setImagesLoaded] = useState<{ [key: number]: boolean }>({})

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.2,
				delayChildren: 0.3,
			},
		},
	}

	const itemVariants = {
		hidden: {
			opacity: 0,
			y: 20,
		},
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.6,
				ease: [0.21, 0.45, 0.27, 0.9],
			},
		},
	}

	const handleImageError = (index: number) => {
		setImageErrors((prev) => ({ ...prev, [index]: true }))
		setImagesLoaded((prev) => ({ ...prev, [index]: true }))
	}

	const handleImageLoad = (index: number) => {
		setImagesLoaded((prev) => ({ ...prev, [index]: true }))
	}

	return (
		<section className="relative overflow-hidden border-t border-border py-20 md:py-32">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, ease: [0.21, 0.45, 0.27, 0.9] }}
					className="mx-auto mb-16 max-w-3xl text-center">
					<h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">What developers are saying</h2>
					<p className="text-lg text-muted-foreground">
						<em>Real feedback from early adopters using Roomote Control in the wild.</em>
					</p>
				</motion.div>

				<motion.div
					variants={containerVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					className="mx-auto max-w-5xl">
					<div className="space-y-8">
						{testimonials.map((testimonial, index) => (
							<motion.div key={index} variants={itemVariants}>
								<div className="group relative rounded-2xl border border-border/50 bg-background/30 p-8 backdrop-blur-xl transition-all duration-300 hover:border-border hover:bg-background/40">
									<div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-100" />
									<div className="relative">
										<svg
											className="mb-6 h-8 w-8 text-blue-500/20"
											fill="currentColor"
											viewBox="0 0 32 32">
											<path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
										</svg>
										<blockquote className="mb-6 text-lg leading-relaxed text-muted-foreground">
											{testimonial.quote}
										</blockquote>
										<div className="flex items-center gap-4">
											<div className="relative h-12 w-12 overflow-hidden rounded-full border border-border/50 bg-muted">
												{/* Placeholder shown until image loads */}
												{!imagesLoaded[index] && (
													<div className="absolute inset-0 flex items-center justify-center bg-muted">
														<div className="h-8 w-8 rounded-full bg-muted-foreground/10" />
													</div>
												)}
												<Image
													src={imageErrors[index] ? testimonial.fallback : testimonial.avatar}
													alt={testimonial.author}
													fill
													className={`object-cover transition-opacity duration-300 ${
														imagesLoaded[index] ? "opacity-100" : "opacity-0"
													}`}
													onError={() => handleImageError(index)}
													onLoad={() => handleImageLoad(index)}
													priority
													sizes="48px"
												/>
											</div>
											<div>
												<div className="font-semibold">{testimonial.author}</div>
											</div>
										</div>
									</div>
								</div>
							</motion.div>
						))}
					</div>
				</motion.div>
			</div>
		</section>
	)
}
