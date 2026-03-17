const getReleaseLine = async (changeset) => {
	const lines = changeset.summary
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean)
	return lines.map((line) => (line.startsWith("- ") ? line : `- ${line}`)).join("\n")
}

const getDependencyReleaseLine = async () => {
	return ""
}

const changelogFunctions = {
	getReleaseLine,
	getDependencyReleaseLine,
}

module.exports = changelogFunctions
