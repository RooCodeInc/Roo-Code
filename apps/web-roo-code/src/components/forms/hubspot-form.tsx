"use client"

import { useEffect, useRef, useState } from "react"

declare global {
	interface Window {
		hbspt?: {
			forms: {
				create: (options: {
					region?: string
					portalId: string
					formId: string
					target: string
					onFormSubmitted?: () => void
				}) => void
			}
		}
	}
}

export interface HubSpotFormProps {
	portalId?: string
	formId?: string
	region?: string
	className?: string
	onSubmitted?: () => void
	hiddenFields?: Record<string, string>
}

export function HubSpotForm({
	portalId,
	formId,
	region = "na1",
	className = "",
	onSubmitted,
	hiddenFields = {},
}: HubSpotFormProps) {
	const formContainerRef = useRef<HTMLDivElement>(null)
	const [isScriptLoaded, setIsScriptLoaded] = useState(false)
	const [hasError, setHasError] = useState(false)
	const formCreatedRef = useRef(false)

	// Check if HubSpot IDs are configured
	const isConfigured = Boolean(portalId && formId)

	// Load HubSpot script
	useEffect(() => {
		if (!isConfigured) return

		// Check if script already exists
		const existingScript = document.querySelector('script[src*="js.hsforms.net"]')
		if (existingScript) {
			setIsScriptLoaded(true)
			return
		}

		// Create and load script
		const script = document.createElement("script")
		script.src = "https://js.hsforms.net/forms/v2.js"
		script.async = true
		script.defer = true

		script.onload = () => {
			setIsScriptLoaded(true)
		}

		script.onerror = () => {
			console.error("Failed to load HubSpot form script")
			setHasError(true)
		}

		document.body.appendChild(script)

		return () => {
			// Don't remove the script on unmount as it might be used by other forms
		}
	}, [isConfigured])

	// Create form once script is loaded
	useEffect(() => {
		if (!isConfigured || !isScriptLoaded || !window.hbspt || !formContainerRef.current || formCreatedRef.current) {
			return
		}

		try {
			// Mark as created before calling create to prevent double-creation
			formCreatedRef.current = true

			window.hbspt.forms.create({
				region,
				portalId: portalId!,
				formId: formId!,
				target: `#${formContainerRef.current.id}`,
				onFormSubmitted: () => {
					if (onSubmitted) {
						onSubmitted()
					}
				},
			})

			// Set hidden fields after form is created
			// HubSpot forms need a moment to render
			setTimeout(() => {
				if (Object.keys(hiddenFields).length > 0) {
					Object.entries(hiddenFields).forEach(([name, value]) => {
						const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)
						if (input) {
							input.value = value
						}
					})
				}
			}, 500)
		} catch (error) {
			console.error("Error creating HubSpot form:", error)
			setHasError(true)
		}
	}, [isConfigured, isScriptLoaded, portalId, formId, region, onSubmitted, hiddenFields])

	// Show placeholder if not configured
	if (!isConfigured) {
		return (
			<div className={`rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center ${className}`}>
				<div className="mx-auto max-w-md space-y-4">
					<div className="text-4xl">📝</div>
					<h3 className="text-lg font-semibold text-gray-900">Form Configuration Pending</h3>
					<p className="text-sm text-gray-600">
						The HubSpot form for CLI preview is not yet configured. Please set the following environment
						variables:
					</p>
					<div className="rounded bg-white p-4 text-left font-mono text-xs text-gray-700">
						<div>NEXT_PUBLIC_HUBSPOT_PORTAL_ID</div>
						<div>NEXT_PUBLIC_HUBSPOT_FORM_ID_CLI_PREVIEW</div>
					</div>
					{process.env.NODE_ENV === "development" && (
						<p className="text-xs text-gray-500">
							This message is only visible in development. In production, consider showing a contact email
							or alternative CTA.
						</p>
					)}
				</div>
			</div>
		)
	}

	// Show error state if script failed to load
	if (hasError) {
		return (
			<div className={`rounded-lg border border-red-200 bg-red-50 p-8 text-center ${className}`}>
				<div className="mx-auto max-w-md space-y-4">
					<div className="text-4xl">⚠️</div>
					<h3 className="text-lg font-semibold text-red-900">Unable to Load Form</h3>
					<p className="text-sm text-red-700">
						We&apos;re having trouble loading the form. This might be due to an ad blocker or connectivity
						issue.
					</p>
					<p className="text-sm text-gray-600">
						Please reach out to us directly at{" "}
						<a href="mailto:support@roocode.com" className="font-medium text-blue-600 hover:underline">
							support@roocode.com
						</a>
					</p>
				</div>
			</div>
		)
	}

	// Render form container
	return (
		<div className={className}>
			<div ref={formContainerRef} id="hubspot-form-cli-preview" />
		</div>
	)
}
