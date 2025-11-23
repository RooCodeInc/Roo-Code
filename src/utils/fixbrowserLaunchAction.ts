export const fixBrowserLaunchAction = (params: any) => {
	// Handle null/undefined params
	if (!params) {
		return undefined
	}

	// Handle URL only scenario
	if (params.url && !params.action) {
		console.log(`fixBrowserLaunchAction: ${params.action} -> launch for ${params.url}`)
		params.action = "launch"

		return "launch"
	}

	// Handle action mapping for navigation-like actions
	if (
		params.action &&
		typeof params.action === "string" &&
		[
			"open_url",
			"navigate_to",
			"navigateto",
			"browse_to",
			"browseto",
			"load",
			"jump_to",
			"jumpto",
			"open",
			"navigator",
			"navigate",
			"goto",
		].includes(params.action.toLowerCase())
	) {
		console.log(`fixBrowserLaunchAction: ${params.action} -> launch`)

		params.action = "launch"
		return "launch"
	}

	return params.action
}
