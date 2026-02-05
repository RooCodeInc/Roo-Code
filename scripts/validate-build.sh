#!/bin/bash

echo "🔍 Running build validation..."

# Step 1: Lint
echo "📝 Running lint..."
pnpm lint
if [ $? -ne 0 ]; then
  echo "❌ Lint failed"
  exit 1
fi

# Step 2: Test
echo "🧪 Running tests..."
pnpm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi

# Step 3: Build
echo "🏗️ Building..."
pnpm build
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ All validations passed!"
