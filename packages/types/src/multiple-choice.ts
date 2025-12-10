import { z } from "zod"

/**
 * Interface for multiple choice data structure used in multiple choice questions
 * This represents the data structure for structured choice questions that the LLM can ask
 * to collect user decisions efficiently with single or multiple selection support.
 */
export interface MultipleChoiceData {
	/** Optional title for the questions form */
	title?: string
	/** Array of questions to present to the user */
	questions: Array<MultipleChoiceQuestion>
	/** Saved user response (populated after user submits) */
	userResponse?: MultipleChoiceResponse
}

/**
 * Interface for a single multiple choice question
 */
export interface MultipleChoiceQuestion {
	/** Unique identifier for this question (used to match answers) */
	id: string
	/** The question text to display to the user */
	prompt: string
	/** Array of answer options for this question */
	options: Array<MultipleChoiceOption>
	/** If true, user can select multiple options. If false, only one option can be selected. */
	allow_multiple?: boolean
}

/**
 * Interface for a multiple choice option
 */
export interface MultipleChoiceOption {
	/** Unique identifier for this option (used in the result) */
	id: string
	/** Display text for this option */
	label: string
}

/**
 * Interface for multiple choice response
 * Maps question IDs to arrays of selected option IDs
 */
export interface MultipleChoiceResponse {
	[questionId: string]: string[]
}

/**
 * Zod schema for MultipleChoiceOption
 */
export const multipleChoiceOptionSchema = z.object({
	id: z.string(),
	label: z.string(),
})

/**
 * Zod schema for MultipleChoiceQuestion
 */
export const multipleChoiceQuestionSchema = z.object({
	id: z.string(),
	prompt: z.string(),
	options: z.array(multipleChoiceOptionSchema).min(2, "Each question must have at least 2 options"),
	allow_multiple: z.boolean().optional(),
})

/**
 * Zod schema for MultipleChoiceData
 */
export const multipleChoiceDataSchema = z.object({
	title: z.string().optional(),
	questions: z.array(multipleChoiceQuestionSchema).min(1, "At least one question is required"),
})

export type MultipleChoiceDataType = z.infer<typeof multipleChoiceDataSchema>

