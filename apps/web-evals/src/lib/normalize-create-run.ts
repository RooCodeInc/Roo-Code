import type { CreateRun } from "./schemas"

/**
 * The New Run UI keeps exercise selection in component state.
 * This normalizer ensures we submit the *visible/selected* exercises when suite is partial.
 */
export function normalizeCreateRunForSubmit(
	values: CreateRun,
	selectedExercises: string[],
	suiteOverride?: CreateRun["suite"],
): CreateRun {
	const suite = suiteOverride ?? values.suite

	return {
		...values,
		suite,
		exercises: suite === "partial" ? selectedExercises : [],
	}
}
