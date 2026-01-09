"use client"

import { useEffect, useState } from "react"
import { useSearchParams, usePathname } from "next/navigation"
import { usePostHog } from "posthog-js/react"
import Link from "next/link"

import { HubSpotForm } from "@/components/forms/hubspot-form"
import { parseAttributionParams, attributionToHiddenFields } from "@/lib/attribution"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function CliPreviewContent() {
	const searchParams = useSearchParams()
	const pathname = usePathname()
	const posthog = usePostHog()
	const [isSubmitted, setIsSubmitted] = useState(false)
	const [hiddenFields, setHiddenFields] = useState<Record<string, string>>({})

	// Get HubSpot config from environment
	const portalId = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID
	const formId = process.env.NEXT_PUBLIC_HUBSPOT_FORM_ID_CLI_PREVIEW

	// Parse attribution parameters and set hidden fields
	useEffect(() => {
		const attributionParams = parseAttributionParams(searchParams, pathname)
		const fields = attributionToHiddenFields(attributionParams)
		setHiddenFields(fields)

		// Capture pageview event with attribution
		posthog?.capture("cli_preview_viewed", {
			...attributionParams,
			page_path: pathname,
		})
	}, [searchParams, pathname, posthog])

	// Capture form render events
	useEffect(() => {
		if (portalId && formId) {
			posthog?.capture("cli_preview_form_rendered", {
				...hiddenFields,
			})
		} else {
			posthog?.capture("cli_preview_form_placeholder_shown", {
				...hiddenFields,
			})
		}
	}, [portalId, formId, hiddenFields, posthog])

	const handleFormSubmit = () => {
		setIsSubmitted(true)
		posthog?.capture("cli_preview_form_submitted", {
			...hiddenFields,
		})
	}

	const handleLoginClick = () => {
		posthog?.capture("cli_preview_nextstep_login_clicked", {
			...hiddenFields,
		})
	}

	const handleSignupClick = () => {
		posthog?.capture("cli_preview_nextstep_signup_clicked", {
			...hiddenFields,
		})
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900">
			{/* Hero Section */}
			<section className="mx-auto max-w-7xl px-6 py-12 sm:py-20 lg:px-8">
				<div className="mx-auto max-w-3xl text-center">
					<div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-sm font-medium text-blue-700 shadow-sm ring-1 ring-inset ring-blue-100 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/30">
						<span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden="true" />
						<span>Invite-only early preview</span>
						<span className="text-blue-600/70 dark:text-blue-200/70" aria-hidden="true">
							•
						</span>
						<span>Limited batches</span>
					</div>

					<h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
						Get an early preview of the Roo Code CLI
					</h1>
					<p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
						Bring Roo Code&apos;s iterative agent capabilities to your terminal. Access rolls out in small
						batches, so join the queue now to be considered for an invite.
					</p>
					<p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
						If selected, we&apos;ll email you a private invite link with next steps.
					</p>
				</div>
			</section>

			{/* Benefits Section */}
			<section className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
				<div className="mx-auto max-w-3xl">
					<div className="mb-6 flex items-end justify-between gap-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
								Why the CLI
							</p>
							<h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
								High-leverage workflows, without the IDE overhead
							</h2>
						</div>
						<div className="hidden rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 sm:block">
							Early access queue
						</div>
					</div>

					<ul className="space-y-4">
						<li className="flex items-start gap-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5"
									viewBox="0 0 20 20"
									fill="currentColor">
									<path
										fillRule="evenodd"
										d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
							<div>
								<h3 className="font-semibold text-gray-900 dark:text-white">
									Run the agent in your terminal
								</h3>
								<p className="mt-1 text-gray-600 dark:text-gray-400">
									Trigger the &quot;close the loop&quot; workflow to run edits, commands, and
									iterations without opening VS Code.
								</p>
							</div>
						</li>
						<li className="flex items-start gap-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5"
									viewBox="0 0 20 20"
									fill="currentColor">
									<path
										fillRule="evenodd"
										d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
							<div>
								<h3 className="font-semibold text-gray-900 dark:text-white">Reuse your profiles</h3>
								<p className="mt-1 text-gray-600 dark:text-gray-400">
									Your existing BYOK keys, models, and custom instructions work out of the box. No new
									configuration required.
								</p>
							</div>
						</li>
						<li className="flex items-start gap-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5"
									viewBox="0 0 20 20"
									fill="currentColor">
									<path
										fillRule="evenodd"
										d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
							<div>
								<h3 className="font-semibold text-gray-900 dark:text-white">Script the repetition</h3>
								<p className="mt-1 text-gray-600 dark:text-gray-400">
									Pipe context directly to the agent to automate batch refactors, migrations, or
									test-fix loops.
								</p>
							</div>
						</li>
						<li className="flex items-start gap-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5"
									viewBox="0 0 20 20"
									fill="currentColor">
									<path
										fillRule="evenodd"
										d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
							<div>
								<h3 className="font-semibold text-gray-900 dark:text-white">Define the spec</h3>
								<p className="mt-1 text-gray-600 dark:text-gray-400">
									This is an early preview. Help us decide which flags, outputs, and safeguards belong
									in v1.
								</p>
							</div>
						</li>
					</ul>
				</div>
			</section>

			{/* Form Section */}
			<section className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
				<div className="mx-auto max-w-2xl">
					{!isSubmitted ? (
						<>
							<div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
								<span className="font-semibold">Heads up:</span> we&apos;re granting access in batches.
								If the current batch is full, we&apos;ll keep you in the queue for the next one.
							</div>

							<div className="mb-8 text-center">
								<h2 className="text-3xl font-bold text-gray-900 dark:text-white">
									Join the Early Preview
								</h2>
								<p className="mt-4 text-gray-600 dark:text-gray-400">
									We&apos;re rolling access out in batches. Tell us what you want to do with the CLI
									and we&apos;ll follow up with next steps.
								</p>
							</div>
							<HubSpotForm
								portalId={portalId}
								formId={formId}
								onSubmitted={handleFormSubmit}
								hiddenFields={hiddenFields}
								className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800"
							/>
						</>
					) : (
						<div className="rounded-lg bg-white p-12 text-center shadow-lg dark:bg-gray-800">
							<div className="mb-6">
								<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-8 w-8"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M5 13l4 4L19 7"
										/>
									</svg>
								</div>
							</div>
							<h3 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
								You&apos;re in the queue
							</h3>
							<p className="mb-8 text-gray-600 dark:text-gray-400">
								We&apos;ve received your request. If you&apos;re selected for a batch, we&apos;ll reach
								out with an invite and next steps.
							</p>
							<div className="mb-6 border-t border-gray-200 pt-6 dark:border-gray-700">
								<p className="mb-4 text-sm font-medium text-gray-900 dark:text-white">
									While you wait, jump into Roo Code Cloud to try Cloud Agents and stay close to new
									releases.
								</p>
								<div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
									<Link
										href={EXTERNAL_LINKS.CLOUD_APP_LOGIN}
										onClick={handleLoginClick}
										className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 sm:w-auto">
										Log in to Cloud
									</Link>
									<Link
										href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP}
										onClick={handleSignupClick}
										className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-auto">
										Sign up for Cloud
									</Link>
								</div>
							</div>
						</div>
					)}
				</div>
			</section>
		</div>
	)
}
