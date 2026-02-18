import * as path from "path"
import * as fs from "fs"
import { execSync } from "child_process"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { FileChangesService } from "../../services/file-changes"
import type { DeploymentStatus } from "../../services/file-changes"

/**
 * Metadata type configuration for SF CLI commands
 * Reuses the same configuration as retrieve_sf_metadata
 */
interface MetadataTypeConfig {
	// The metadata type name as used by SF CLI
	cliType: string
	// Whether this type supports deployment
	supportsDeployment: boolean
	// Description for error messages
	description: string
	// Default relative path from project root (for SFDX projects)
	defaultPath: string
	// File extension for this metadata type
	fileExtension?: string
}

/**
 * Configuration for supported Salesforce metadata types for deployment
 */
const METADATA_TYPE_CONFIG: Record<string, MetadataTypeConfig> = {
	ApexClass: {
		cliType: "ApexClass",
		supportsDeployment: true,
		description: "Apex Class",
		defaultPath: "force-app/main/default/classes",
		fileExtension: ".cls",
	},
	ApexTrigger: {
		cliType: "ApexTrigger",
		supportsDeployment: true,
		description: "Apex Trigger",
		defaultPath: "force-app/main/default/triggers",
		fileExtension: ".trigger",
	},
	CustomObject: {
		cliType: "CustomObject",
		supportsDeployment: true,
		description: "Custom Object",
		defaultPath: "force-app/main/default/objects",
		fileExtension: ".object-meta.xml",
	},
	CustomField: {
		cliType: "CustomField",
		supportsDeployment: true,
		description: "Custom Field",
		defaultPath: "force-app/main/default/objects",
		fileExtension: ".field-meta.xml",
	},
	LightningComponentBundle: {
		cliType: "LightningComponentBundle",
		supportsDeployment: true,
		description: "Lightning Web Component",
		defaultPath: "force-app/main/default/lwc",
	},
	AuraDefinitionBundle: {
		cliType: "AuraDefinitionBundle",
		supportsDeployment: true,
		description: "Aura Component",
		defaultPath: "force-app/main/default/aura",
	},
	FlexiPage: {
		cliType: "FlexiPage",
		supportsDeployment: true,
		description: "Lightning Page",
		defaultPath: "force-app/main/default/flexipages",
		fileExtension: ".flexipage-meta.xml",
	},
	Flow: {
		cliType: "Flow",
		supportsDeployment: true,
		description: "Flow",
		defaultPath: "force-app/main/default/flows",
		fileExtension: ".flow-meta.xml",
	},
	PermissionSet: {
		cliType: "PermissionSet",
		supportsDeployment: true,
		description: "Permission Set",
		defaultPath: "force-app/main/default/permissionsets",
		fileExtension: ".permissionset-meta.xml",
	},
	Profile: {
		cliType: "Profile",
		supportsDeployment: true,
		description: "Profile",
		defaultPath: "force-app/main/default/profiles",
		fileExtension: ".profile-meta.xml",
	},
	Layout: {
		cliType: "Layout",
		supportsDeployment: true,
		description: "Page Layout",
		defaultPath: "force-app/main/default/layouts",
		fileExtension: ".layout-meta.xml",
	},
	ApexPage: {
		cliType: "ApexPage",
		supportsDeployment: true,
		description: "Visualforce Page",
		defaultPath: "force-app/main/default/pages",
		fileExtension: ".page",
	},
	ApexComponent: {
		cliType: "ApexComponent",
		supportsDeployment: true,
		description: "Visualforce Component",
		defaultPath: "force-app/main/default/components",
		fileExtension: ".component",
	},
	StaticResource: {
		cliType: "StaticResource",
		supportsDeployment: true,
		description: "Static Resource",
		defaultPath: "force-app/main/default/staticresources",
	},
	CustomTab: {
		cliType: "CustomTab",
		supportsDeployment: true,
		description: "Custom Tab",
		defaultPath: "force-app/main/default/tabs",
		fileExtension: ".tab-meta.xml",
	},
	CustomApplication: {
		cliType: "CustomApplication",
		supportsDeployment: true,
		description: "Custom Application",
		defaultPath: "force-app/main/default/applications",
		fileExtension: ".app-meta.xml",
	},
	ValidationRule: {
		cliType: "ValidationRule",
		supportsDeployment: true,
		description: "Validation Rule",
		defaultPath: "force-app/main/default/objects",
		fileExtension: ".validationRule-meta.xml",
	},
	RecordType: {
		cliType: "RecordType",
		supportsDeployment: true,
		description: "Record Type",
		defaultPath: "force-app/main/default/objects",
		fileExtension: ".recordType-meta.xml",
	},
	Role: {
		cliType: "Role",
		supportsDeployment: true,
		description: "Role",
		defaultPath: "force-app/main/default/roles",
		fileExtension: ".role-meta.xml",
	},
	AssignmentRule: {
		cliType: "AssignmentRule",
		supportsDeployment: true,
		description: "Assignment Rule",
		defaultPath: "force-app/main/default/assignmentRules",
		fileExtension: ".assignmentRule-meta.xml",
	},
	AssignmentRules: {
		cliType: "AssignmentRules",
		supportsDeployment: true,
		description: "Assignment Rules",
		defaultPath: "force-app/main/default/assignmentRules",
		fileExtension: ".assignmentRules-meta.xml",
	},
	PathAssistant: {
		cliType: "PathAssistant",
		supportsDeployment: true,
		description: "Path Assistant (Sales Path)",
		defaultPath: "force-app/main/default/pathAssistants",
		fileExtension: ".pathAssistant-meta.xml",
	},
	GenAiPlannerBundle: {
		cliType: "GenAiPlannerBundle",
		supportsDeployment: true,
		description: "Gen AI Planner Bundle",
		defaultPath: "force-app/main/default/genAiPlannerBundles",
	},
	Bot: {
		cliType: "Bot",
		supportsDeployment: true,
		description: "Bot",
		defaultPath: "force-app/main/default/bots",
	},
}

/**
 * Try to resolve the actual file path for a metadata component
 * Returns the source directory if file is found, undefined otherwise
 */
function resolveMetadataPath(metadataType: string, metadataName: string, cwd: string): string | undefined {
	console.log(`[deploySfMetadata] resolveMetadataPath: type=${metadataType}, name=${metadataName}, cwd=${cwd}`)
	const config = METADATA_TYPE_CONFIG[metadataType]
	if (!config || !config.defaultPath) {
		console.log(`[deploySfMetadata] No config or defaultPath found for ${metadataType}`)
		return undefined
	}

	// Use the default path from config
	const fullBasePath = path.join(cwd, config.defaultPath)
	console.log(`[deploySfMetadata] Checking path: ${fullBasePath}`)

	// For bundle types (LWC, Aura, GenAiPlannerBundle, Bot), the metadata name is the directory name
	const isBundleType =
		metadataType === "LightningComponentBundle" ||
		metadataType === "AuraDefinitionBundle" ||
		metadataType === "GenAiPlannerBundle" ||
		metadataType === "Bot"

	if (isBundleType) {
		// For bundles, check if the directory exists
		const bundlePath = path.join(fullBasePath, metadataName)
		console.log(`[deploySfMetadata] Bundle type - checking: ${bundlePath}`)
		if (fs.existsSync(bundlePath) && fs.statSync(bundlePath).isDirectory()) {
			console.log(`[deploySfMetadata] ✅ Bundle found: ${bundlePath}`)
			return bundlePath
		}
		console.log(`[deploySfMetadata] ❌ Bundle not found at ${bundlePath}`)
	} else if (config.fileExtension) {
		// For file-based metadata, check if the file exists
		const filePath = path.join(fullBasePath, metadataName + config.fileExtension)
		console.log(`[deploySfMetadata] File-based - checking: ${filePath}`)
		if (fs.existsSync(filePath)) {
			console.log(`[deploySfMetadata] ✅ File found, returning source dir: ${fullBasePath}`)
			// Return the directory containing the file for --source-dir
			return fullBasePath
		}
		console.log(`[deploySfMetadata] ❌ File not found at ${filePath}`)

		// For nested types (CustomField, ValidationRule, etc.), check object subdirectories
		if (metadataType === "CustomField" || metadataType === "ValidationRule" || metadataType === "RecordType") {
			console.log(`[deploySfMetadata] Nested type detected, searching in object subdirectories...`)
			// Try to find in object directories
			if (fs.existsSync(fullBasePath)) {
				const objectDirs = fs
					.readdirSync(fullBasePath, { withFileTypes: true })
					.filter((dirent) => dirent.isDirectory())
					.map((dirent) => dirent.name)
				console.log(
					`[deploySfMetadata] Found ${objectDirs.length} object directories: ${objectDirs.join(", ")}`,
				)

				for (const objDir of objectDirs) {
					const subFolder =
						metadataType === "CustomField"
							? "fields"
							: metadataType === "ValidationRule"
								? "validationRules"
								: "recordTypes"
					const nestedPath = path.join(fullBasePath, objDir, subFolder, metadataName + config.fileExtension)
					console.log(`[deploySfMetadata] Checking nested: ${nestedPath}`)
					if (fs.existsSync(nestedPath)) {
						const resolvedDir = path.join(fullBasePath, objDir, subFolder)
						console.log(`[deploySfMetadata] ✅ Nested file found, returning: ${resolvedDir}`)
						return resolvedDir
					}
				}
				console.log(`[deploySfMetadata] ❌ Not found in any object subdirectories`)
			}
		}
	}

	console.log(`[deploySfMetadata] ❌ resolveMetadataPath: No path resolved for ${metadataName}`)
	return undefined
}

/**
 * Build the SF CLI deploy command based on metadata type, name, and options
 */
function buildSfDeployCommand(
	metadataType: string,
	metadataName: string,
	sourceDir: string | undefined,
	testLevel: string | undefined,
	tests: string | undefined,
	ignoreWarnings: boolean,
	isDryRun: boolean,
	cwd: string,
): string {
	console.log(
		`[deploySfMetadata] buildSfDeployCommand: type=${metadataType}, name=${metadataName}, sourceDir=${sourceDir}, isDryRun=${isDryRun}`,
	)
	const config = METADATA_TYPE_CONFIG[metadataType]

	if (!config) {
		throw new Error(
			`Unsupported metadata type: ${metadataType}. Supported types: ${Object.keys(METADATA_TYPE_CONFIG).join(", ")}`,
		)
	}

	if (!config.supportsDeployment) {
		throw new Error(`Metadata type ${metadataType} does not support deployment.`)
	}

	// Build base command
	let command = "sf project deploy start"

	// Add metadata specification
	if (sourceDir) {
		// Deploy from specific directory (user-provided)
		console.log(`[deploySfMetadata] Using user-provided source-dir: ${sourceDir}`)
		command += ` --source-dir "${sourceDir}"`
	} else {
		// Try to automatically resolve the file path for single component deployment
		const metadataNames = metadataName.split(",").map((name) => name.trim())
		console.log(`[deploySfMetadata] Parsed ${metadataNames.length} metadata name(s): ${metadataNames.join(", ")}`)

		if (metadataNames.length === 1) {
			// For single component, try to find the actual file
			console.log(`[deploySfMetadata] Single component - attempting auto-resolution...`)
			const resolvedPath = resolveMetadataPath(metadataType, metadataNames[0], cwd)
			if (resolvedPath) {
				// Use --source-dir with the resolved path
				console.log(`[deploySfMetadata] ✅ Using resolved --source-dir: ${resolvedPath}`)
				command += ` --source-dir "${resolvedPath}"`
			} else {
				// Fall back to --metadata if file not found
				console.log(
					`[deploySfMetadata] ⚠️ File not found, falling back to --metadata: ${config.cliType}:${metadataNames[0]}`,
				)
				command += ` --metadata "${config.cliType}:${metadataNames[0]}"`
			}
		} else {
			// For multiple components, use --metadata specification
			const metadataSpecs = metadataNames.map((name) => `${config.cliType}:${name}`).join(",")
			console.log(`[deploySfMetadata] Multiple components - using --metadata: ${metadataSpecs}`)
			command += ` --metadata "${metadataSpecs}"`
		}
	}

	// Add test level (default to NoTestRun if not specified)
	const effectiveTestLevel = testLevel || "NoTestRun"
	command += ` --test-level ${effectiveTestLevel}`

	// Add specific tests if provided
	if (tests && effectiveTestLevel === "RunSpecifiedTests") {
		command += ` --tests ${tests}`
	}

	// Add dry-run flag if this is validation phase
	if (isDryRun) {
		command += " --dry-run"
	}

	// Add ignore warnings flag if specified
	if (ignoreWarnings) {
		command += " --ignore-warnings"
	}

	// Always add --json for parseable output and --wait for synchronous execution
	command += " --json --wait 10"

	console.log(`[deploySfMetadata] Final command: ${command}`)
	return command
}

/**
 * Parse and format the SF CLI deploy output for dry run
 */
function formatDryRunResult(
	output: string,
	metadataType: string,
	metadataName: string,
	testLevel: string,
): { success: boolean; message: string } {
	const componentCount = metadataName.split(",").length
	const componentText = componentCount > 1 ? `${componentCount} components` : metadataName
	try {
		const jsonOutput = JSON.parse(output)

		if (jsonOutput.status === 0 || jsonOutput.result?.status === "Succeeded") {
			const result = jsonOutput.result

			// Format success message
			let message = `✅ DRY RUN VALIDATION PASSED\n\n`
			message += `Metadata: ${metadataType} - ${metadataName}\n`
			message += `Test Level: ${testLevel}\n\n`

			// Add test results if available
			if (result?.numberTestsTotal > 0) {
				const testsRun = result.numberTestsTotal || 0
				const testsPassed = testsRun - (result.numberTestErrors || 0)
				const coverage =
					result.numberComponentsDeployed > 0
						? Math.round(((result.numberComponentsCovered || 0) / result.numberComponentsDeployed) * 100)
						: 0

				message += `Test Results:\n`
				message += `  - Tests Run: ${testsRun}\n`
				message += `  - Tests Passed: ${testsPassed}\n`
				message += `  - Tests Failed: ${result.numberTestErrors || 0}\n`
				message += `  - Code Coverage: ${coverage}%\n\n`
			}

			// Add components that will be deployed
			if (result?.deployedSource && result.deployedSource.length > 0) {
				message += `Components validated for deployment:\n`
				result.deployedSource.slice(0, 10).forEach((comp: any) => {
					message += `  - ${comp.fullName || comp.fileName} (${comp.type})\n`
				})
				if (result.deployedSource.length > 10) {
					message += `  ... and ${result.deployedSource.length - 10} more\n`
				}
				message += `\n`
			}

			message += `✅ Proceeding with actual deployment...`

			return { success: true, message }
		} else {
			// Dry run failed - format error message
			let message = `❌ DRY RUN VALIDATION FAILED - DEPLOYMENT ABORTED\n\n`
			message += `Metadata: ${metadataType} - ${metadataName}\n`
			message += `Test Level: ${testLevel}\n\n`

			const result = jsonOutput.result

			// Add validation errors
			if (result?.details?.componentFailures) {
				const failures = Array.isArray(result.details.componentFailures)
					? result.details.componentFailures
					: [result.details.componentFailures]

				message += `Validation Errors:\n`
				failures.forEach((failure: any) => {
					message += `  - ${failure.fullName || failure.fileName}: ${failure.problem || failure.problemType}\n`
					if (failure.lineNumber) {
						message += `    Line ${failure.lineNumber}: ${failure.problemType}\n`
					}
				})
				message += `\n`
			}

			// Add test failures
			if (result?.details?.runTestResult?.failures) {
				const testFailures = Array.isArray(result.details.runTestResult.failures)
					? result.details.runTestResult.failures
					: [result.details.runTestResult.failures]

				message += `Test Failures:\n`
				testFailures.forEach((failure: any) => {
					message += `  - ${failure.name}.${failure.methodName}:\n`
					message += `    ${failure.message}\n`
					if (failure.stackTrace) {
						message += `    Stack: ${failure.stackTrace.substring(0, 200)}...\n`
					}
				})
				message += `\n`
			}

			// Add code coverage issues
			if (result?.details?.runTestResult?.codeCoverage) {
				const coverage = result.details.runTestResult.codeCoverage
				const totalCoverage = coverage.reduce((acc: number, c: any) => acc + (c.numLocations || 0), 0)
				const coveredLines = coverage.reduce((acc: number, c: any) => acc + (c.numLocationsNotCovered || 0), 0)
				const coveragePercent = totalCoverage > 0 ? Math.round((1 - coveredLines / totalCoverage) * 100) : 0

				if (coveragePercent < 75) {
					message += `Code Coverage: ${coveragePercent}% (Minimum required: 75%)\n\n`
				}
			}

			// Add general error message
			const errorMessage = jsonOutput.message || result?.message || "Unknown validation error"
			message += `Error: ${errorMessage}\n\n`
			message += `⚠️ Please fix these issues before attempting deployment again.`

			return { success: false, message }
		}
	} catch (parseError) {
		// If JSON parsing fails, return raw output
		let message = `❌ DRY RUN VALIDATION FAILED - DEPLOYMENT ABORTED\n\n`
		message += `Failed to parse SF CLI output:\n${output}\n\n`
		message += `⚠️ Please review the output and fix any issues before attempting deployment again.`
		return { success: false, message }
	}
}

/**
 * Parse and format the SF CLI deploy output for actual deployment
 */
function formatDeployResult(output: string, metadataType: string, metadataName: string): string {
	try {
		const jsonOutput = JSON.parse(output)

		if (jsonOutput.status === 0 || jsonOutput.result?.status === "Succeeded") {
			const result = jsonOutput.result

			let message = `✅ DEPLOYMENT SUCCESSFUL!\n\n`
			message += `Dry Run Validation: ✅ PASSED\n`
			message += `Deployment Status: ✅ COMPLETED\n\n`

			message += `Metadata: ${metadataType} - ${metadataName}\n`
			message += `Deployment ID: ${result?.id || "N/A"}\n\n`

			// Add deployed components
			if (result?.deployedSource && result.deployedSource.length > 0) {
				message += `Deployed Components:\n`
				result.deployedSource.forEach((comp: any) => {
					message += `  - ${comp.fullName || comp.fileName} (${comp.type})\n`
				})
				message += `\n`
			}

			// Add test results
			if (result?.numberTestsTotal > 0) {
				const testsRun = result.numberTestsTotal || 0
				const testsPassed = testsRun - (result.numberTestErrors || 0)
				const coverage =
					result.numberComponentsDeployed > 0
						? Math.round(((result.numberComponentsCovered || 0) / result.numberComponentsDeployed) * 100)
						: 0

				message += `Test Results:\n`
				message += `  - Tests Run: ${testsRun}\n`
				message += `  - Tests Passed: ${testsPassed}\n`
				message += `  - Code Coverage: ${coverage}%\n\n`
			}

			message += `The metadata has been successfully deployed to the org.`

			return message
		} else {
			// Deployment failed after dry run passed (rare case)
			const errorMessage = jsonOutput.message || jsonOutput.result?.message || "Unknown deployment error"
			return `❌ DEPLOYMENT FAILED\n\nNote: Dry run passed but actual deployment failed.\nError: ${errorMessage}\n\nDeployment ID: ${jsonOutput.result?.id || "N/A"}`
		}
	} catch (parseError) {
		if (output.includes("ERROR") || output.includes("error")) {
			return `❌ DEPLOYMENT FAILED\n\nSF CLI Error:\n${output}`
		}
		return `SF CLI Output:\n${output}`
	}
}

/**
 * Extract deployed component file paths from SF CLI JSON output.
 * Returns relative file paths (e.g., "force-app/main/default/classes/MyClass.cls").
 */
function extractDeployedFilePaths(jsonOutput: any): string[] {
	const filePaths: string[] = []
	const deployedSource = jsonOutput?.result?.deployedSource || jsonOutput?.result?.files || []

	for (const comp of deployedSource) {
		// SF CLI provides filePath or fileName for each deployed component
		const filePath = comp.filePath || comp.fileName
		if (filePath) {
			filePaths.push(filePath)
		}
	}

	return filePaths
}

/**
 * Update deployment status for files involved in a deploy operation.
 * Handles both tracked files (in FileChangesDatabase) and untracked files
 * (ones the AI deployed that weren't modified in this task).
 */
async function updateDeploymentStatuses(
	taskId: string,
	filePaths: string[],
	status: DeploymentStatus,
	error?: string,
): Promise<void> {
	try {
		const service = FileChangesService.getInstance()
		for (const filePath of filePaths) {
			await service.updateDeploymentStatus(taskId, filePath, status, error)
		}
	} catch (err) {
		console.error(`[deploySfMetadata] Failed to update deployment statuses: ${err}`)
	}
}

export async function deploySfMetadataTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	console.log(`[deploySfMetadata] ========== TOOL INVOKED ==========`)
	console.log(`[deploySfMetadata] Parameters:`, block.params)
	const metadataType: string | undefined = block.params.metadata_type
	const metadataName: string | undefined = block.params.metadata_name
	const sourceDir: string | undefined = block.params.source_dir
	const testLevel: string | undefined = block.params.test_level
	const tests: string | undefined = block.params.tests
	const ignoreWarnings: boolean = block.params.ignore_warnings === "true"
	console.log(
		`[deploySfMetadata] Parsed params: type=${metadataType}, name=${metadataName}, sourceDir=${sourceDir}, testLevel=${testLevel}, cwd=${cline.cwd}`,
	)

	try {
		// Build shared message props for UI display
		const sharedMessageProps: ClineSayTool = {
			tool: "deploySfMetadata",
			metadataType: metadataType || "",
			metadataName: metadataName || "",
			testLevel: testLevel || "NoTestRun",
		}

		if (block.partial) {
			// Show partial state while streaming
			await cline
				.ask(
					"tool",
					JSON.stringify({
						...sharedMessageProps,
						metadataType: removeClosingTag("metadata_type", metadataType),
						metadataName: removeClosingTag("metadata_name", metadataName),
						testLevel: removeClosingTag("test_level", testLevel),
					} satisfies ClineSayTool),
					block.partial,
				)
				.catch(() => {})
			return
		}

		// Validate required parameters
		if (!metadataType) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("sf_deploy_metadata")
			pushToolResult(await cline.sayAndCreateMissingParamError("sf_deploy_metadata", "metadata_type"))
			return
		}

		if (!metadataName) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("sf_deploy_metadata")
			pushToolResult(await cline.sayAndCreateMissingParamError("sf_deploy_metadata", "metadata_name"))
			return
		}

		// Reset mistake count on valid input
		cline.consecutiveMistakeCount = 0

		// Build the SF CLI commands (one for dry run, one for actual deploy)
		let dryRunCommand: string
		let deployCommand: string

		try {
			dryRunCommand = buildSfDeployCommand(
				metadataType,
				metadataName,
				sourceDir,
				testLevel,
				tests,
				ignoreWarnings,
				true, // isDryRun
				cline.cwd,
			)

			deployCommand = buildSfDeployCommand(
				metadataType,
				metadataName,
				sourceDir,
				testLevel,
				tests,
				ignoreWarnings,
				false, // not dry run
				cline.cwd,
			)
		} catch (error) {
			pushToolResult(formatResponse.toolError(error.message))
			return
		}

		// Ask for approval with proper tool UI showing deployment details
		const approvalMessage = JSON.stringify({
			...sharedMessageProps,
			metadataType,
			metadataName,
			testLevel: testLevel || "NoTestRun",
			sourceDir: sourceDir || "default",
			content: `Metadata Type: ${metadataType}\nMetadata Name: ${metadataName}\nTest Level: ${testLevel || "NoTestRun"}${sourceDir ? `\nSource Directory: ${sourceDir}` : ""}${tests ? `\nTests: ${tests}` : ""}\n\nCommand Preview:\n${deployCommand}`,
		} satisfies ClineSayTool)

		// Check if auto-approval is enabled for this tool
		const providerState = await cline.providerRef.deref()?.getState()
		const forceApproval = !providerState?.alwaysAllowDeploySfMetadata

		const didApprove = await askApproval("tool", approvalMessage, undefined, forceApproval)

		if (!didApprove) {
			return
		}

		// PHASE 1: Execute DRY RUN for validation
		console.log(`[deploySfMetadata] ===== PHASE 1: DRY RUN =====`)
		console.log(`[deploySfMetadata] Executing dry run command...`)

		try {
			// Execute dry run validation
			const dryRunOutput = execSync(dryRunCommand, {
				cwd: cline.cwd,
				encoding: "utf-8",
				timeout: 300000, // 5 minute timeout for dry run
				maxBuffer: 10 * 1024 * 1024, // 10MB buffer
				stdio: ["pipe", "pipe", "pipe"],
			})

			// Parse and format dry run result
			console.log(`[deploySfMetadata] Dry run completed, parsing output...`)
			const dryRunResult = formatDryRunResult(dryRunOutput, metadataType, metadataName, testLevel || "NoTestRun")

			// If dry run failed, abort deployment
			if (!dryRunResult.success) {
				console.log(`[deploySfMetadata] ❌ Dry run FAILED - aborting deployment`)
				pushToolResult(formatResponse.toolError(dryRunResult.message))
				return
			}
			console.log(`[deploySfMetadata] ✅ Dry run PASSED - proceeding to actual deployment`)

			// Update deployment status to "dry-run" for validated components
			try {
				const dryRunJson = JSON.parse(dryRunOutput)
				const validatedPaths = extractDeployedFilePaths(dryRunJson)
				if (validatedPaths.length > 0) {
					await updateDeploymentStatuses(cline.taskId, validatedPaths, "dry-run")
					console.log(`[deploySfMetadata] Updated ${validatedPaths.length} files to dry-run status`)
				}
			} catch {
				// Non-critical — continue with deployment even if status update fails
			}

			// Update UI: Dry run passed
			await cline.say("text", "✅ Validation passed! Proceeding with actual deployment...")
		} catch (dryRunError: any) {
			// Handle dry run execution errors
			let errorMessage = "Failed to execute SF CLI dry run validation"

			if (dryRunError.killed) {
				errorMessage = "Dry run validation timed out after 5 minutes"
			} else if (dryRunError.stdout) {
				// Sometimes SF CLI returns error info in stdout with non-zero exit
				const dryRunResult = formatDryRunResult(
					dryRunError.stdout,
					metadataType,
					metadataName,
					testLevel || "NoTestRun",
				)

				// Update UI: Show dry run error in deployment results
				const errorResultMessage = JSON.stringify({
					...sharedMessageProps,
					metadataType,
					metadataName,
					testLevel: testLevel || "NoTestRun",
					sourceDir: sourceDir || "default",
					content: `❌ DEPLOYMENT FAILED\n\nDry Run Validation Error:\n${dryRunResult.message}`,
				} satisfies ClineSayTool)
				await cline.ask("tool", errorResultMessage, false).catch(() => {})

				pushToolResult(formatResponse.toolError(dryRunResult.message))
				return
			} else if (dryRunError.stderr) {
				errorMessage = dryRunError.stderr
			} else if (dryRunError.message) {
				errorMessage = dryRunError.message
			}

			// Check for common SF CLI issues
			errorMessage = handleCommonSfCliErrors(errorMessage)

			// Update UI: Show error in deployment results
			const errorResultMessage = JSON.stringify({
				...sharedMessageProps,
				metadataType,
				metadataName,
				testLevel: testLevel || "NoTestRun",
				sourceDir: sourceDir || "default",
				content: `❌ DEPLOYMENT FAILED\n\nDry Run Validation Error:\n${errorMessage}`,
			} satisfies ClineSayTool)
			await cline.ask("tool", errorResultMessage, false).catch(() => {})

			pushToolResult(formatResponse.toolError(`SF CLI Dry Run Error: ${errorMessage}`))
			return
		}

		// PHASE 2: Execute ACTUAL DEPLOYMENT
		console.log(`[deploySfMetadata] ===== PHASE 2: ACTUAL DEPLOYMENT =====`)
		console.log(`[deploySfMetadata] Executing deployment command...`)

		// Mark all task files as "deploying" before starting
		try {
			const service = FileChangesService.getInstance()
			const taskFiles = await service.getTaskFileChanges(cline.taskId)
			const dryRunPaths = taskFiles.filter((f) => f.deploymentStatus === "dry-run").map((f) => f.filePath)
			if (dryRunPaths.length > 0) {
				await updateDeploymentStatuses(cline.taskId, dryRunPaths, "deploying")
			}
		} catch {
			// Non-critical
		}

		try {
			// Execute actual deployment
			const deployOutput = execSync(deployCommand, {
				cwd: cline.cwd,
				encoding: "utf-8",
				timeout: 600000, // 10 minute timeout for deployment
				maxBuffer: 10 * 1024 * 1024, // 10MB buffer
				stdio: ["pipe", "pipe", "pipe"],
			})

			// Format and return the deployment result
			console.log(`[deploySfMetadata] Deployment completed, formatting result...`)
			const formattedResult = formatDeployResult(deployOutput, metadataType, metadataName)
			console.log(`[deploySfMetadata] ✅ DEPLOYMENT SUCCESSFUL ${formattedResult}`)

			// Update deployment status to "deployed" for successfully deployed components
			try {
				const deployJson = JSON.parse(deployOutput)
				const deployedPaths = extractDeployedFilePaths(deployJson)
				if (deployedPaths.length > 0) {
					await updateDeploymentStatuses(cline.taskId, deployedPaths, "deployed")
					console.log(`[deploySfMetadata] Updated ${deployedPaths.length} files to deployed status`)
				}
			} catch {
				// Non-critical
			}

			// Update UI: Show deployment results in expandable section
			const deployResultMessage = JSON.stringify({
				...sharedMessageProps,
				metadataType,
				metadataName,
				testLevel: testLevel || "NoTestRun",
				sourceDir: sourceDir || "default",
				content: formattedResult,
			} satisfies ClineSayTool)
			await cline.ask("tool", deployResultMessage, false).catch(() => {})

			pushToolResult(formatResponse.toolResult(formattedResult))
		} catch (deployError: any) {
			// Mark deploying files as "failed"
			try {
				const service = FileChangesService.getInstance()
				const taskFiles = await service.getTaskFileChanges(cline.taskId)
				const deployingPaths = taskFiles
					.filter((f) => f.deploymentStatus === "deploying")
					.map((f) => f.filePath)
				if (deployingPaths.length > 0) {
					await updateDeploymentStatuses(
						cline.taskId,
						deployingPaths,
						"failed",
						String(deployError?.message || "Deployment failed"),
					)
				}
			} catch {
				// Non-critical
			}

			// Handle deployment execution errors
			let errorMessage = "Failed to execute SF CLI deployment"

			if (deployError.killed) {
				errorMessage = "Deployment timed out after 10 minutes"
			} else if (deployError.stdout) {
				// Sometimes SF CLI returns error info in stdout with non-zero exit
				const formattedResult = formatDeployResult(deployError.stdout, metadataType, metadataName)

				// Update UI: Show deployment results (may contain partial success or errors)
				const deployResultMessage = JSON.stringify({
					...sharedMessageProps,
					metadataType,
					metadataName,
					testLevel: testLevel || "NoTestRun",
					sourceDir: sourceDir || "default",
					content: formattedResult,
				} satisfies ClineSayTool)
				await cline.ask("tool", deployResultMessage, false).catch(() => {})

				pushToolResult(formatResponse.toolResult(formattedResult))
				return
			} else if (deployError.stderr) {
				errorMessage = deployError.stderr
			} else if (deployError.message) {
				errorMessage = deployError.message
			}

			// Check for common SF CLI issues
			errorMessage = handleCommonSfCliErrors(errorMessage)

			// Update UI: Show error in deployment results
			const errorResultMessage = JSON.stringify({
				...sharedMessageProps,
				metadataType,
				metadataName,
				testLevel: testLevel || "NoTestRun",
				sourceDir: sourceDir || "default",
				content: `❌ DEPLOYMENT FAILED\n\nError:\n${errorMessage}`,
			} satisfies ClineSayTool)
			await cline.ask("tool", errorResultMessage, false).catch(() => {})

			pushToolResult(formatResponse.toolError(`SF CLI Deployment Error: ${errorMessage}`))
		}
	} catch (error) {
		await handleError("deploying Salesforce metadata", error)
	}
}

/**
 * Handle common SF CLI error messages
 */
function handleCommonSfCliErrors(errorMessage: string): string {
	if (errorMessage.includes("command not found") || errorMessage.includes("'sf' is not recognized")) {
		return "Salesforce CLI (sf) is not installed or not in PATH. Please install it from https://developer.salesforce.com/tools/salesforcecli"
	} else if (errorMessage.includes("No default org set") || errorMessage.includes("No default username")) {
		return "No default Salesforce org is set. Please run 'sf org login web' or 'sf config set target-org <username>' to set a default org."
	} else if (errorMessage.includes("ENOENT")) {
		return "Salesforce CLI (sf) is not installed. Please install it from https://developer.salesforce.com/tools/salesforcecli"
	}
	return errorMessage
}
