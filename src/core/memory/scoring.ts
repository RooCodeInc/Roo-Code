/** Logarithmic bonus capped at 3.0 for repeated reinforcements. */
export function reinforcementBonus(count: number): number {
	return Math.min(Math.log2(count + 1), 3.0)
}

/** Exponential decay factor based on days since last reinforcement. */
export function temporalDecay(daysSinceReinforced: number, decayRate: number): number {
	return Math.exp(-decayRate * daysSinceReinforced)
}

export interface ScoreInput {
	significance: number
	priorityWeight: number
	reinforcementCount: number
	daysSinceReinforced: number
	decayRate: number
}

/** Compute a composite relevance score for a memory entry. */
export function computeScore(input: ScoreInput): number {
	return (
		input.significance *
		input.priorityWeight *
		reinforcementBonus(input.reinforcementCount) *
		temporalDecay(input.daysSinceReinforced, input.decayRate)
	)
}
