#!/bin/bash

# Build and Debug Script for Roo-FordLLM Extension
# This script builds the extension and creates a detailed debug log

LOG_FILE="build-debug-$(date +%Y%m%d-%H%M%S).log"

echo "Starting build and debug process..." | tee "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Check Node version
echo "=== Environment Check ===" | tee -a "$LOG_FILE"
echo "Node version: $(node --version)" | tee -a "$LOG_FILE"
echo "pnpm version: $(pnpm --version)" | tee -a "$LOG_FILE"
echo "Current directory: $(pwd)" | tee -a "$LOG_FILE"
echo "Current branch: $(git branch --show-current)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Check source files
echo "=== Source Files Check ===" | tee -a "$LOG_FILE"
echo "Checking for fordllm source files..." | tee -a "$LOG_FILE"
if [ -f "packages/types/src/providers/fordllm.ts" ]; then
    echo "✓ fordllm.ts exists" | tee -a "$LOG_FILE"
    echo "File size: $(wc -c < packages/types/src/providers/fordllm.ts) bytes" | tee -a "$LOG_FILE"
else
    echo "✗ fordllm.ts NOT FOUND" | tee -a "$LOG_FILE"
fi

echo "Checking provider-settings.ts for fordllm references..." | tee -a "$LOG_FILE"
grep -n "fordllm" packages/types/src/provider-settings.ts | head -5 | tee -a "$LOG_FILE"

echo "Checking providers/index.ts for fordllm export..." | tee -a "$LOG_FILE"
grep -n "fordllm" packages/types/src/providers/index.ts | head -3 | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Clean build
echo "=== Cleaning Build ===" | tee -a "$LOG_FILE"
echo "Running pnpm clean..." | tee -a "$LOG_FILE"
pnpm clean >> "$LOG_FILE" 2>&1

echo "Removing node_modules..." | tee -a "$LOG_FILE"
rm -rf node_modules

echo "Removing packages/types/dist..." | tee -a "$LOG_FILE"
rm -rf packages/types/dist
echo "" | tee -a "$LOG_FILE"

# Install dependencies
echo "=== Installing Dependencies ===" | tee -a "$LOG_FILE"
echo "Running pnpm install --frozen-lockfile..." | tee -a "$LOG_FILE"
pnpm install --frozen-lockfile >> "$LOG_FILE" 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed successfully" | tee -a "$LOG_FILE"
else
    echo "✗ Dependency installation failed" | tee -a "$LOG_FILE"
    exit 1
fi
echo "" | tee -a "$LOG_FILE"

# Build types package specifically
echo "=== Building Types Package ===" | tee -a "$LOG_FILE"
cd packages/types
echo "Building in $(pwd)..." | tee -a "../../$LOG_FILE"
pnpm build >> "../../$LOG_FILE" 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Types package built successfully" | tee -a "../../$LOG_FILE"
else
    echo "✗ Types package build failed" | tee -a "../../$LOG_FILE"
    cd ../..
    exit 1
fi

# Check if fordllm is in types build output
echo "Checking for fordllm in types dist..." | tee -a "../../$LOG_FILE"
FORDLLM_COUNT=$(grep -r "fordllm" dist/ 2>/dev/null | wc -l)
echo "Found $FORDLLM_COUNT references to 'fordllm' in dist/" | tee -a "../../$LOG_FILE"
if [ $FORDLLM_COUNT -gt 0 ]; then
    echo "✓ fordllm found in types build" | tee -a "../../$LOG_FILE"
    grep -r "fordllm" dist/ 2>/dev/null | head -10 | tee -a "../../$LOG_FILE"
else
    echo "✗ fordllm NOT found in types build" | tee -a "../../$LOG_FILE"
fi

cd ../..
echo "" | tee -a "$LOG_FILE"

# Build VSIX
echo "=== Building VSIX ===" | tee -a "$LOG_FILE"
echo "Running pnpm vsix..." | tee -a "$LOG_FILE"
pnpm vsix >> "$LOG_FILE" 2>&1
if [ $? -eq 0 ]; then
    echo "✓ VSIX built successfully" | tee -a "$LOG_FILE"
else
    echo "✗ VSIX build failed" | tee -a "$LOG_FILE"
    exit 1
fi
echo "" | tee -a "$LOG_FILE"

# Check VSIX output
echo "=== VSIX Check ===" | tee -a "$LOG_FILE"
if [ -f "bin/roo-fordllm-3.32.1.vsix" ]; then
    echo "✓ VSIX file exists" | tee -a "$LOG_FILE"
    echo "File size: $(du -h bin/roo-fordllm-3.32.1.vsix | cut -f1)" | tee -a "$LOG_FILE"
else
    echo "✗ VSIX file NOT FOUND" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Check fordllm in node_modules
echo "=== Node Modules Check ===" | tee -a "$LOG_FILE"
FORDLLM_NM_COUNT=$(grep -r "fordllm" node_modules/@roo-code/types/dist/ 2>/dev/null | wc -l)
echo "Found $FORDLLM_NM_COUNT references to 'fordllm' in node_modules/@roo-code/types/dist/" | tee -a "$LOG_FILE"
if [ $FORDLLM_NM_COUNT -gt 0 ]; then
    echo "✓ fordllm found in node_modules" | tee -a "$LOG_FILE"
    grep -r "fordllm" node_modules/@roo-code/types/dist/ 2>/dev/null | head -10 | tee -a "$LOG_FILE"
else
    echo "✗ fordllm NOT found in node_modules" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Check fordllm in dist
echo "=== Extension Dist Check ===" | tee -a "$LOG_FILE"
if [ -d "dist" ]; then
    FORDLLM_DIST_COUNT=$(grep -r "fordllm" dist/ 2>/dev/null | wc -l)
    echo "Found $FORDLLM_DIST_COUNT references to 'fordllm' in dist/" | tee -a "$LOG_FILE"
    if [ $FORDLLM_DIST_COUNT -gt 0 ]; then
        echo "✓ fordllm found in extension dist" | tee -a "$LOG_FILE"
        grep -r "fordllm" dist/ 2>/dev/null | head -10 | tee -a "$LOG_FILE"
    else
        echo "✗ fordllm NOT found in extension dist" | tee -a "$LOG_FILE"
    fi
else
    echo "✗ dist directory does not exist" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Summary
echo "=== Build Summary ===" | tee -a "$LOG_FILE"
echo "Build completed at: $(date)" | tee -a "$LOG_FILE"
echo "Log file saved to: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Next steps:" | tee -a "$LOG_FILE"
echo "1. Share this log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "2. Install extension: code --install-extension bin/roo-fordllm-3.32.1.vsix" | tee -a "$LOG_FILE"
echo "3. Restart VS Code completely" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
