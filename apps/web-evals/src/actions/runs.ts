"use server"

import * as path from "path"
import fs from "fs"
import { fileURLToPath } from "url"
import { spawn, execFileSync } from "child_process"

import { revalidatePath } from "next/cache"
import pMap from "p-map"

import {
	type ExerciseLanguage,
	exerciseLanguages,
	createRun as _createRun,
	deleteRun as _deleteRun,
	createTask,
	getExercisesForLanguage,
} from "@roo-code/evals"

import { CreateRun } from "@/lib/schemas"
import { redisClient } from "@/lib/server/redis"

const EVALS_REPO_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../evals")

export async function createRun({ suite, exercises = [], timeout, iterations = 1, ...values }: CreateRun) {
	const run = await _createRun({
		...values,
		timeout,
		socketPath: "", // TODO: Get rid of this.
	})

	if (suite === "partial") {
		for (const path of exercises) {
			const [language, exercise] = path.split("/")

			if (!language || !exercise) {
				throw new Error("Invalid exercise path: " + path)
			}

			// Create multiple tasks for each iteration
			for (let iteration = 1; iteration <= iterations; iteration++) {
				await createTask({
					...values,
					runId: run.id,
					language: language as ExerciseLanguage,
					exercise,
					iteration,
				})
			}
		}
	} else {
		for (const language of exerciseLanguages) {
			const languageExercises = await getExercisesForLanguage(EVALS_REPO_PATH, language)

			// Create tasks for all iterations of each exercise
			const tasksToCreate: Array<{ language: ExerciseLanguage; exercise: string; iteration: number }> = []
			for (const exercise of languageExercises) {
				for (let iteration = 1; iteration <= iterations; iteration++) {
					tasksToCreate.push({ language, exercise, iteration })
				}
			}

			await pMap(
				tasksToCreate,
				({ language, exercise, iteration }) => createTask({ runId: run.id, language, exercise, iteration }),
				{ concurrency: 10 },
			)
		}
	}

	revalidatePath("/runs")

	try {
		const isRunningInDocker = fs.existsSync("/.dockerenv")

		const dockerArgs = [
			`--name evals-controller-${run.id}`,
			"--rm",
			"--network evals_default",
			"-v /var/run/docker.sock:/var/run/docker.sock",
			"-v /tmp/evals:/var/log/evals",
			"-e HOST_EXECUTION_METHOD=docker",
		]

		const cliCommand = `pnpm --filter @roo-code/evals cli --runId ${run.id}`

		const command = isRunningInDocker
			? `docker run ${dockerArgs.join(" ")} evals-runner sh -c "${cliCommand}"`
			: cliCommand

		console.log("spawn ->", command)

		const childProcess = spawn("sh", ["-c", command], {
			detached: true,
			stdio: ["ignore", "pipe", "pipe"],
		})

		const logStream = fs.createWriteStream("/tmp/roo-code-evals.log", { flags: "a" })

		if (childProcess.stdout) {
			childProcess.stdout.pipe(logStream)
		}

		if (childProcess.stderr) {
			childProcess.stderr.pipe(logStream)
		}

		childProcess.unref()
	} catch (error) {
		console.error(error)
	}

	return run
}

export async function deleteRun(runId: number) {
	await _deleteRun(runId)
	revalidatePath("/runs")
}

export type KillRunResult = {
	success: boolean
	killedContainers: string[]
	errors: string[]
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Kill all Docker containers associated with a run (controller and task runners).
 * Kills the controller first, waits 10 seconds, then kills runners.
 * Also clears Redis state for heartbeat and runners.
 *
 * Container naming conventions:
 * - Controller: evals-controller-{runId}
 * - Task runners: evals-task-{runId}-{taskId}.{attempt}
 */
export async function killRun(runId: number): Promise<KillRunResult> {
	const killedContainers: string[] = []
	const errors: string[] = []
	const controllerPattern = `evals-controller-${runId}`
	const taskPattern = `evals-task-${runId}-`

	try {
		// Step 1: Kill the controller first
		console.log(`Killing controller: ${controllerPattern}`)
		try {
			execFileSync("docker", ["kill", controllerPattern], { encoding: "utf-8", timeout: 10000 })
			killedContainers.push(controllerPattern)
			console.log(`Killed controller container: ${controllerPattern}`)
		} catch (_error) {
			// Controller might not be running - that's ok, continue to kill runners
			console.log(`Controller ${controllerPattern} not running or already stopped`)
		}

		// Step 2: Wait 10 seconds before killing runners
		console.log("Waiting 10 seconds before killing runners...")
		await sleep(10000)

		// Step 3: Find and kill all task runner containers for THIS run only
		let taskContainerNames: string[] = []

		try {
			const output = execFileSync("docker", ["ps", "--format", "{{.Names}}", "--filter", `name=${taskPattern}`], {
				encoding: "utf-8",
				timeout: 10000,
			})
			taskContainerNames = output
				.split("\n")
				.map((name) => name.trim())
				.filter((name) => name.length > 0 && name.startsWith(taskPattern))
		} catch (error) {
			console.error("Failed to list task containers:", error)
			errors.push("Failed to list Docker task containers")
		}

		// Kill each task runner container
		for (const containerName of taskContainerNames) {
			try {
				execFileSync("docker", ["kill", containerName], { encoding: "utf-8", timeout: 10000 })
				killedContainers.push(containerName)
				console.log(`Killed task container: ${containerName}`)
			} catch (error) {
				// Container might have already stopped
				console.error(`Failed to kill container ${containerName}:`, error)
				errors.push(`Failed to kill container: ${containerName}`)
			}
		}

		// Step 4: Clear Redis state
		try {
			const redis = await redisClient()
			const heartbeatKey = `heartbeat:${runId}`
			const runnersKey = `runners:${runId}`

			await redis.del(heartbeatKey)
			await redis.del(runnersKey)
			console.log(`Cleared Redis keys: ${heartbeatKey}, ${runnersKey}`)
		} catch (error) {
			console.error("Failed to clear Redis state:", error)
			errors.push("Failed to clear Redis state")
		}
	} catch (error) {
		console.error("Error in killRun:", error)
		errors.push("Unexpected error while killing containers")
	}

	revalidatePath(`/runs/${runId}`)
	revalidatePath("/runs")

	return {
		success: killedContainers.length > 0 || errors.length === 0,
		killedContainers,
		errors,
	}
}
