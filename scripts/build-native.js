#!/usr/bin/env node

/**
 * Build script for Rust native modules
 *
 * This script compiles the Rust native addons using cargo and neon
 * It handles both development and production builds
 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

// Colors for console output
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	cyan: "\x1b[36m",
}

function log(message, color = colors.reset) {
	console.log(`${color}${message}${colors.reset}`)
}

function checkRustInstalled() {
	try {
		execSync("rustc --version", { stdio: "pipe" })
		return true
	} catch (error) {
		return false
	}
}

function checkCargoInstalled() {
	try {
		execSync("cargo --version", { stdio: "pipe" })
		return true
	} catch (error) {
		return false
	}
}

function buildModule(moduleName, modulePath) {
	log(`\n${colors.bright}Building ${moduleName}...${colors.reset}`, colors.cyan)

	const moduleDir = path.join(__dirname, "..", modulePath)

	if (!fs.existsSync(moduleDir)) {
		log(`❌ Module directory not found: ${moduleDir}`, colors.red)
		return false
	}

	try {
		// Check if Cargo.toml exists
		const cargoToml = path.join(moduleDir, "Cargo.toml")
		if (!fs.existsSync(cargoToml)) {
			log(`⚠️  Cargo.toml not found in ${moduleName}, skipping`, colors.yellow)
			return false
		}

		// Build in release mode for better performance
		const buildMode = process.env.NODE_ENV === "development" ? "" : "--release"

		log(`  Running: cargo build ${buildMode}`, colors.cyan)
		execSync(`cargo build ${buildMode}`, {
			cwd: moduleDir,
			stdio: "inherit",
		})

		// Copy the built .node file to a standard location
		const targetDir = buildMode ? "release" : "debug"
		const sourceFile = path.join(moduleDir, "target", targetDir, `${moduleName}.node`)
		const destFile = path.join(moduleDir, "index.node")

		// On different platforms, the extension might be different
		let actualSourceFile = sourceFile
		if (!fs.existsSync(sourceFile)) {
			// Try with .dll on Windows
			actualSourceFile = path.join(moduleDir, "target", targetDir, `${moduleName}.dll`)
			if (!fs.existsSync(actualSourceFile)) {
				// Try with .dylib on macOS
				actualSourceFile = path.join(moduleDir, "target", targetDir, `lib${moduleName}.dylib`)
				if (!fs.existsSync(actualSourceFile)) {
					// Try with .so on Linux
					actualSourceFile = path.join(moduleDir, "target", targetDir, `lib${moduleName}.so`)
				}
			}
		}

		if (fs.existsSync(actualSourceFile)) {
			fs.copyFileSync(actualSourceFile, destFile)
			log(`✅ ${moduleName} built successfully`, colors.green)
			return true
		} else {
			log(`⚠️  Built file not found, check cargo output`, colors.yellow)
			return false
		}
	} catch (error) {
		log(`❌ Failed to build ${moduleName}: ${error.message}`, colors.red)
		return false
	}
}

function main() {
	log(`\n${colors.bright}=== Building Rust Native Modules ===${colors.reset}`, colors.cyan)

	// Check prerequisites
	if (!checkRustInstalled()) {
		log("\n❌ Rust is not installed!", colors.red)
		log("Please install Rust from: https://rustup.rs/", colors.yellow)
		log("After installation, restart your terminal and run this script again.", colors.yellow)
		process.exit(1)
	}

	if (!checkCargoInstalled()) {
		log("\n❌ Cargo is not installed!", colors.red)
		log("Cargo should be installed with Rust. Please reinstall Rust.", colors.yellow)
		process.exit(1)
	}

	log("✅ Rust toolchain detected", colors.green)

	// Get Rust version
	try {
		const rustVersion = execSync("rustc --version", { encoding: "utf8" })
		log(`   ${rustVersion.trim()}`, colors.cyan)
	} catch (error) {
		// Ignore version check errors
	}

	// Build modules
	const modules = [
		{ name: "image-processor", path: "native/image-processor" },
		{ name: "file-processor", path: "native/file-processor" },
	]

	let successCount = 0
	let failCount = 0

	for (const module of modules) {
		if (buildModule(module.name, module.path)) {
			successCount++
		} else {
			failCount++
		}
	}

	// Summary
	log(`\n${colors.bright}=== Build Summary ===${colors.reset}`, colors.cyan)
	log(`✅ Successfully built: ${successCount}`, colors.green)
	if (failCount > 0) {
		log(`❌ Failed to build: ${failCount}`, colors.red)
		log(
			"\n⚠️  Some modules failed to build. The application will fall back to JavaScript implementations.",
			colors.yellow,
		)
	} else {
		log("\n🎉 All native modules built successfully!", colors.green)
	}

	// Exit with error code if any builds failed
	if (failCount > 0) {
		process.exit(1)
	}
}

// Run the build
main()
