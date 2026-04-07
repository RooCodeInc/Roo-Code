// npx vitest run __tests__/delegation-events.spec.ts

import { JabberwockEventName, jabberwockEventsSchema, taskEventSchema } from "@jabberwock/types"

describe("delegation event schemas", () => {
	test("jabberwockEventsSchema validates tuples", () => {
		expect(() =>
			(jabberwockEventsSchema.shape as any)[JabberwockEventName.TaskDelegated].parse(["p", "c"]),
		).not.toThrow()
		expect(() =>
			(jabberwockEventsSchema.shape as any)[JabberwockEventName.TaskDelegationCompleted].parse(["p", "c", "s"]),
		).not.toThrow()
		expect(() =>
			(jabberwockEventsSchema.shape as any)[JabberwockEventName.TaskDelegationResumed].parse(["p", "c"]),
		).not.toThrow()

		// invalid shapes
		expect(() => (jabberwockEventsSchema.shape as any)[JabberwockEventName.TaskDelegated].parse(["p"])).toThrow()
		expect(() =>
			(jabberwockEventsSchema.shape as any)[JabberwockEventName.TaskDelegationCompleted].parse(["p", "c"]),
		).toThrow()
		expect(() =>
			(jabberwockEventsSchema.shape as any)[JabberwockEventName.TaskDelegationResumed].parse(["p"]),
		).toThrow()
	})

	test("taskEventSchema discriminated union includes delegation events", () => {
		expect(() =>
			taskEventSchema.parse({
				eventName: JabberwockEventName.TaskDelegated,
				payload: ["p", "c"],
				taskId: 1,
			}),
		).not.toThrow()

		expect(() =>
			taskEventSchema.parse({
				eventName: JabberwockEventName.TaskDelegationCompleted,
				payload: ["p", "c", "s"],
				taskId: 1,
			}),
		).not.toThrow()

		expect(() =>
			taskEventSchema.parse({
				eventName: JabberwockEventName.TaskDelegationResumed,
				payload: ["p", "c"],
				taskId: 1,
			}),
		).not.toThrow()
	})
})
