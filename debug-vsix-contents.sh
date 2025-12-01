#!/bin/bash

# VSIX Debug Script - Inspect what's inside the built extension
# This unpacks the VSIX and checks for fordllm references

LOG_FILE="vsix-debug-$(date +%Y%m%d-%H%M%S).log"

echo "VSIX Debug Script" | tee "$LOG_FILE"
echo "=================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Check if VSIX exists
if [ ! -f "bin/roo-fordllm-3.32.1.vsix" ]; then
    echo "ERROR: VSIX file not found at bin/roo-fordllm-3.32.1.vsix" | tee -a "$LOG_FILE"
    exit 1
fi

echo "✓ VSIX file found: bin/roo-fordllm-3.32.1.vsix" | tee -a "$LOG_FILE"
echo "File size: $(du -h bin/roo-fordllm-3.32.1.vsix | cut -f1)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Create temp directory for unpacking
TEMP_DIR="vsix-unpacked-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TEMP_DIR"

echo "Unpacking VSIX to $TEMP_DIR..." | tee -a "$LOG_FILE"
unzip -q "bin/roo-fordllm-3.32.1.vsix" -d "$TEMP_DIR"

if [ $? -eq 0 ]; then
    echo "✓ VSIX unpacked successfully" | tee -a "$LOG_FILE"
else
    echo "✗ Failed to unpack VSIX" | tee -a "$LOG_FILE"
    exit 1
fi
echo "" | tee -a "$LOG_FILE"

# Search for fordllm in the unpacked extension
echo "=== Searching for 'fordllm' in unpacked VSIX ===" | tee -a "$LOG_FILE"
FORDLLM_COUNT=$(grep -r "fordllm" "$TEMP_DIR/extension" 2>/dev/null | wc -l)
echo "Found $FORDLLM_COUNT references to 'fordllm' in extension/" | tee -a "$LOG_FILE"

if [ $FORDLLM_COUNT -gt 0 ]; then
    echo "✓ fordllm found in VSIX" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "First 20 occurrences:" | tee -a "$LOG_FILE"
    grep -r "fordllm" "$TEMP_DIR/extension" 2>/dev/null | head -20 | tee -a "$LOG_FILE"
else
    echo "✗ fordllm NOT found in VSIX" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Check webview build files
echo "=== Checking webview files ===" | tee -a "$LOG_FILE"
if [ -d "$TEMP_DIR/extension/webview-ui/build" ]; then
    echo "Searching for provider dropdown code in webview..." | tee -a "$LOG_FILE"
    WEBVIEW_FORDLLM=$(grep -r "fordllm" "$TEMP_DIR/extension/webview-ui" 2>/dev/null | wc -l)
    echo "Found $WEBVIEW_FORDLLM references to 'fordllm' in webview-ui/" | tee -a "$LOG_FILE"

    if [ $WEBVIEW_FORDLLM -gt 0 ]; then
        echo "✓ fordllm found in webview" | tee -a "$LOG_FILE"
        grep -r "fordllm" "$TEMP_DIR/extension/webview-ui" 2>/dev/null | head -10 | tee -a "$LOG_FILE"
    else
        echo "✗ fordllm NOT found in webview" | tee -a "$LOG_FILE"
    fi
else
    echo "✗ webview-ui/build directory not found" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Check dist files
echo "=== Checking extension dist files ===" | tee -a "$LOG_FILE"
if [ -d "$TEMP_DIR/extension/dist" ]; then
    DIST_FORDLLM=$(grep -r "fordllm" "$TEMP_DIR/extension/dist" 2>/dev/null | wc -l)
    echo "Found $DIST_FORDLLM references to 'fordllm' in dist/" | tee -a "$LOG_FILE"

    if [ $DIST_FORDLLM -gt 0 ]; then
        echo "✓ fordllm found in dist" | tee -a "$LOG_FILE"
    else
        echo "✗ fordllm NOT found in dist" | tee -a "$LOG_FILE"
    fi
else
    echo "✗ dist directory not found" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Check for provider list
echo "=== Looking for provider definitions ===" | tee -a "$LOG_FILE"
echo "Searching for 'MODELS_BY_PROVIDER' or providerNames..." | tee -a "$LOG_FILE"
grep -r "MODELS_BY_PROVIDER\|providerNames" "$TEMP_DIR/extension" 2>/dev/null | head -5 | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Check welcome banner
echo "=== Checking welcome banner ===" | tee -a "$LOG_FILE"
FORD_BANNER=$(grep -r "Welcome to Roo Code - Ford" "$TEMP_DIR/extension" 2>/dev/null | wc -l)
if [ $FORD_BANNER -gt 0 ]; then
    echo "✓ Ford banner found ($FORD_BANNER occurrences)" | tee -a "$LOG_FILE"
else
    echo "✗ Ford banner NOT found" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Cleanup
echo "=== Cleanup ===" | tee -a "$LOG_FILE"
read -p "Delete unpacked directory $TEMP_DIR? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$TEMP_DIR"
    echo "Deleted $TEMP_DIR" | tee -a "$LOG_FILE"
else
    echo "Kept $TEMP_DIR for manual inspection" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

echo "=== Summary ===" | tee -a "$LOG_FILE"
echo "Log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [ $FORDLLM_COUNT -eq 0 ]; then
    echo "ISSUE FOUND: fordllm is NOT in the VSIX!" | tee -a "$LOG_FILE"
    echo "This means the types package isn't being bundled correctly." | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "Try these fixes:" | tee -a "$LOG_FILE"
    echo "1. rm -rf node_modules/@roo-code" | tee -a "$LOG_FILE"
    echo "2. pnpm install --force" | tee -a "$LOG_FILE"
    echo "3. pnpm vsix" | tee -a "$LOG_FILE"
else
    echo "fordllm IS in the VSIX ($FORDLLM_COUNT references)" | tee -a "$LOG_FILE"
    echo "The issue might be in the UI rendering logic." | tee -a "$LOG_FILE"
fi
