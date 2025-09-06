export const formatScore = (score: number | null | undefined) => {
	if (score === null || score === undefined) {
		return "-"
	}
	return Math.round(score * 100)
}
