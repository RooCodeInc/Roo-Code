import os from "os"
import osName from "os-name"

import { getShell } from "../../../utils/shell"

export function getSystemInfoSection(cwd: string): string {
	// Try to get detailed OS name, but fall back to basic info if it fails
	// This prevents ENOENT errors on Windows when PowerShell isn't available
	let operatingSystemInfo: string
	try {
		operatingSystemInfo = osName()
	} catch (error) {
		// Fallback to basic OS info from Node's built-in os module
		const platform = os.platform()
		const release = os.release()
		const type = os.type()

		// Create a readable OS string based on platform
		if (platform === "win32") {
			operatingSystemInfo = `Windows ${release}`
		} else if (platform === "darwin") {
			operatingSystemInfo = `macOS ${release}`
		} else if (platform === "linux") {
			operatingSystemInfo = `Linux ${release}`
		} else {
			operatingSystemInfo = `${type} ${release}`
		}
	}

	let details = `====

SYSTEM INFORMATION

Operating System: ${operatingSystemInfo}
Default Shell: ${getShell()}
Home Directory: ${os.homedir().toPosix()}
Current Workspace Directory: ${cwd.toPosix()}

The Current Workspace Directory is the active VS Code project directory, and is therefore the default directory for all tool operations. New terminals will be created in the current workspace directory, however if you change directories in a terminal it will then have a different working directory; changing directories in a terminal does not modify the workspace directory, because you do not have access to change the workspace directory. When the user initially gives you a task, a recursive list of all filepaths in the current workspace directory ('/test/path') will be included in environment_details. This provides an overview of the project's file structure, offering key insights into the project from directory/file names (how developers conceptualize and organize their code) and file extensions (the language used). This can also guide decision-making on which files to explore further. If you need to further explore directories such as outside the current workspace directory, you can use the list_files tool. If you pass 'true' for the recursive parameter, it will list files recursively. Otherwise, it will list files at the top level, which is better suited for generic directories where you don't necessarily need the nested structure, like the Desktop.`

	return details
}
