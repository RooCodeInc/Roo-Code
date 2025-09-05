# Adding Tree-Sitter Language Support via Git Submodules

This document provides step-by-step instructions for adding new tree-sitter language parsers (specifically tree-sitter-abl and tree-sitter-df) to the Roo Code codebase using git submodules.

## Overview

The goal is to integrate the following tree-sitter repositories:

- [tree-sitter-abl](https://github.com/usagi-coffee/tree-sitter-abl) - For OpenEdge ABL language support
- [tree-sitter-df](https://github.com/usagi-coffee/tree-sitter-df) - For OpenEdge Data Dictionary (.df) file support

## Step-by-Step Instructions

### 1. Add Git Submodules

First, create a `/deps` directory in the project root and add the tree-sitter repositories as submodules:

```bash
# Create deps directory if it doesn't exist
mkdir -p deps

# Add tree-sitter-abl as a submodule
git submodule add https://github.com/usagi-coffee/tree-sitter-abl.git deps/tree-sitter-abl

# Add tree-sitter-df as a submodule
git submodule add https://github.com/usagi-coffee/tree-sitter-df.git deps/tree-sitter-df

# Initialize and update submodules
git submodule update --init --recursive
```

### 2. Build WASM Files from Submodules

You'll need to compile the tree-sitter grammars to WASM format. This requires the tree-sitter CLI tool:

```bash
# Install tree-sitter CLI if not already installed
npm install -g tree-sitter-cli

# Build WASM for tree-sitter-abl
cd deps/tree-sitter-abl
tree-sitter build --wasm
# This creates tree-sitter-abl.wasm

# Build WASM for tree-sitter-df
cd ../tree-sitter-df
tree-sitter build --wasm
# This creates tree-sitter-df.wasm

cd ../..
```

### 3. Update Build Process to Copy WASM Files

Modify `packages/build/src/esbuild.ts` to include the new WASM files in the build process:

```typescript
// In the copyWasms function, after copying from tree-sitter-wasms:

// Copy custom tree-sitter WASM files from deps
const customWasmFiles = [
	{ source: "deps/tree-sitter-abl/tree-sitter-abl.wasm", name: "tree-sitter-abl.wasm" },
	{ source: "deps/tree-sitter-df/tree-sitter-df.wasm", name: "tree-sitter-df.wasm" },
]

customWasmFiles.forEach(({ source, name }) => {
	const sourcePath = path.join(srcDir, "..", source)
	if (fs.existsSync(sourcePath)) {
		fs.copyFileSync(sourcePath, path.join(distDir, name))
		console.log(`[copyWasms] Copied custom ${name} to ${distDir}`)
	} else {
		console.warn(`[copyWasms] Custom WASM file not found: ${sourcePath}`)
	}
})
```

### 4. Add File Extensions to Scanner

Update `src/services/tree-sitter/index.ts` to include the new file extensions:

```typescript
const extensions = [
	// ... existing extensions ...

	// OpenEdge ABL
	"p", // ABL procedure files
	"i", // ABL include files
	"w", // ABL window files
	"cls", // ABL class files

	// OpenEdge Data Dictionary
	"df", // Data dictionary files

	// ... rest of extensions ...
].map((e) => `.${e}`)
```

### 5. Add Language Parser Support

Update `src/services/tree-sitter/languageParser.ts` to handle the new languages:

```typescript
// Add imports for the new query strings (create these first - see step 6)
import { ablQuery } from "./queries/abl"
import { dfQuery } from "./queries/df"

// In the loadRequiredLanguageParsers function, add cases:
case "p":
case "i":
case "w":
case "cls":
  language = await loadLanguage("abl", sourceDirectory)
  query = new Query(language, ablQuery)
  break

case "df":
  language = await loadLanguage("df", sourceDirectory)
  query = new Query(language, dfQuery)
  break
```

### 6. Create Query Files

Create query files for the new languages:

**src/services/tree-sitter/queries/abl.ts:**

```typescript
export default `
; ABL Query for code definitions
; Based on tree-sitter-abl grammar

; Procedure definitions
(procedure_statement
  name: (identifier) @name.definition.function)

; Function definitions  
(function_statement
  name: (identifier) @name.definition.function)

; Method definitions
(method_statement
  name: (identifier) @name.definition.method)

; Class definitions
(class_statement
  name: (identifier) @name.definition.class)

; Interface definitions
(interface_statement
  name: (identifier) @name.definition.interface)

; Variable definitions
(define_variable_statement
  name: (identifier) @name.definition.variable)

; Property definitions
(define_property_statement
  name: (identifier) @name.definition.property)

; Temp-table definitions
(define_temp_table_statement
  name: (identifier) @name.definition.table)
`
```

**src/services/tree-sitter/queries/df.ts:**

```typescript
export default `
; Data Dictionary Query for schema definitions
; Based on tree-sitter-df grammar

; Table definitions
(table_definition
  name: (identifier) @name.definition.table)

; Field definitions
(field_definition
  name: (identifier) @name.definition.field)

; Index definitions
(index_definition
  name: (identifier) @name.definition.index)

; Sequence definitions
(sequence_definition
  name: (identifier) @name.definition.sequence)
`
```

### 7. Add to Fallback Extensions (Optional)

If the parsers are not stable or complete, you may want to add these extensions to the fallback list in `src/services/code-index/shared/supported-extensions.ts`:

```typescript
export const fallbackExtensions = [
	// ... existing extensions ...
	".p", // ABL - use fallback if parser is incomplete
	".i", // ABL include
	".w", // ABL window
	".cls", // ABL class
	".df", // Data dictionary
]
```

### 8. Update GitHub Actions Workflow

Modify `.github/workflows/code-qa.yml` to handle submodules:

```yaml
- name: Checkout code
  uses: actions/checkout@v4
  with:
      submodules: recursive # Add this line to checkout submodules

# Add a step to build WASM files from submodules
- name: Build custom tree-sitter WASM files
  run: |
      # Install tree-sitter CLI
      npm install -g tree-sitter-cli

      # Build ABL WASM
      if [ -d "deps/tree-sitter-abl" ]; then
        cd deps/tree-sitter-abl
        tree-sitter build --wasm
        cd ../..
      fi

      # Build DF WASM
      if [ -d "deps/tree-sitter-df" ]; then
        cd deps/tree-sitter-df
        tree-sitter build --wasm
        cd ../..
      fi
```

### 9. Add Tests

Create test files to verify the new language support:

**src/services/tree-sitter/**tests**/parseSourceCodeDefinitions.abl.spec.ts:**

```typescript
import { describe, it, expect } from "vitest"
import { parseTestFile } from "./helpers"
import ablQuery from "../queries/abl"

describe("parseSourceCodeDefinitions - ABL", () => {
	it("should parse ABL procedure definitions", async () => {
		const { captures } = await parseTestFile({
			language: "abl",
			wasmFile: "tree-sitter-abl.wasm",
			queryString: ablQuery,
			content: `
PROCEDURE myProcedure:
  DEFINE VARIABLE x AS INTEGER NO-UNDO.
  x = 10.
END PROCEDURE.

FUNCTION myFunction RETURNS INTEGER:
  RETURN 42.
END FUNCTION.
      `,
		})

		expect(captures).toContainEqual(
			expect.objectContaining({
				name: "name.definition.function",
				node: expect.objectContaining({ text: "myProcedure" }),
			}),
		)
	})
})
```

### 10. Update Documentation

Add the new languages to any relevant documentation:

1. Update README.md to mention OpenEdge ABL support
2. Add to the list of supported languages in documentation
3. Update CHANGELOG.md with the new feature

## Building and Testing

After making all changes:

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Bundle the extension
pnpm bundle
```

## Verification Steps

After completing the integration, follow these steps to verify that the tree-sitter parsers are working correctly:

### 1. Verify WASM Files Are Built

Check that the WASM files were successfully generated:

```bash
# Check for ABL WASM file
ls -la deps/tree-sitter-abl/tree-sitter-abl.wasm

# Check for DF WASM file
ls -la deps/tree-sitter-df/tree-sitter-df.wasm

# Files should exist and be non-zero size
```

### 2. Verify Build Process

Ensure the WASM files are copied to the distribution directory:

```bash
# Build the project
pnpm build

# Check that WASM files are in dist
ls -la src/dist/tree-sitter-*.wasm | grep -E "(abl|df)"

# Should see:
# tree-sitter-abl.wasm
# tree-sitter-df.wasm
```

### 3. Test File Extension Recognition

Create test files to verify extension handling:

```bash
# Create test ABL files
echo "PROCEDURE test: END." > test.p
echo "/* Include file */" > test.i
echo "/* Window file */" > test.w
echo "CLASS TestClass: END CLASS." > test.cls

# Create test DF file
echo "ADD TABLE \"Customer\"" > test.df

# Run the extension and verify these files are recognized
# Check the output panel for parsing activity
```

### 4. Verify Parser Loading

Check the browser console when opening ABL/DF files in VSCode:

1. Open VSCode Developer Tools: `Help > Toggle Developer Tools`
2. Go to the Console tab
3. Open an ABL or DF file
4. Look for messages like:
    - `Loading language parser for extension: .p`
    - `Successfully loaded tree-sitter-abl.wasm`
    - No error messages about missing WASM files

### 5. Test Query Functionality

Create a test ABL file with various constructs:

```abl
/* test-verification.p */
PROCEDURE validateCustomer:
    DEFINE INPUT PARAMETER custNum AS INTEGER NO-UNDO.
    DEFINE VARIABLE isValid AS LOGICAL NO-UNDO.

    isValid = custNum > 0.
    RETURN isValid.
END PROCEDURE.

FUNCTION calculateDiscount RETURNS DECIMAL (INPUT orderTotal AS DECIMAL):
    IF orderTotal > 1000 THEN
        RETURN orderTotal * 0.1.
    ELSE
        RETURN 0.
END FUNCTION.

CLASS OrderProcessor:
    METHOD PUBLIC VOID processOrder():
        /* Processing logic */
    END METHOD.
END CLASS.
```

Then verify the parser captures these definitions:

- The outline view should show: `validateCustomer`, `calculateDiscount`, `OrderProcessor`
- Code navigation (Ctrl+Shift+O) should list all definitions
- Go to Definition (F12) should work for these constructs

### 6. Run Unit Tests

Execute the specific tests for the new languages:

```bash
# Run ABL parser tests
pnpm test -- parseSourceCodeDefinitions.abl

# Run DF parser tests (if created)
pnpm test -- parseSourceCodeDefinitions.df

# All tests should pass
```

### 7. Verify CI/CD Pipeline

Check that GitHub Actions handles the submodules correctly:

```bash
# Push changes to a test branch
git checkout -b test-abl-df-integration
git add .
git commit -m "test: Verify ABL/DF integration"
git push origin test-abl-df-integration

# Check GitHub Actions:
# - Workflow should checkout submodules
# - WASM build step should succeed
# - All tests should pass
```

### 8. Test with Real ABL/DF Files

If you have actual ABL/DF files:

1. Open them in VSCode with the extension
2. Verify:
    - Syntax highlighting works (if implemented)
    - Code folding works at procedure/function boundaries
    - Outline view shows correct structure
    - Search functionality finds definitions
    - No parsing errors in the output panel

### 9. Performance Verification

Check that the parsers perform adequately:

```bash
# Create a large test file
for i in {1..100}; do
    echo "PROCEDURE proc$i: END PROCEDURE." >> large-test.p
done

# Open the file and verify:
# - File opens without significant delay
# - Parsing completes within reasonable time
# - No memory issues or crashes
```

### 10. Fallback Verification

If you added extensions to fallback list, test that fallback works:

1. Temporarily rename/remove the WASM file
2. Open an ABL/DF file
3. Verify the file still opens and basic chunking works
4. Check console for fallback messages
5. Restore the WASM file

### Common Issues and Solutions

| Issue               | Solution                                                         |
| ------------------- | ---------------------------------------------------------------- |
| WASM file not found | Ensure submodules are initialized: `git submodule update --init` |
| Parser not loading  | Check file extension mapping in `languageParser.ts`              |
| Queries not working | Verify query syntax matches the grammar's node types             |
| Build failures      | Update tree-sitter CLI: `npm update -g tree-sitter-cli`          |
| Tests failing       | Ensure test files use correct language identifier                |
| CI/CD issues        | Verify `.github/workflows` includes submodule checkout           |

### Verification Checklist

- [ ] WASM files built successfully
- [ ] WASM files copied to dist directory
- [ ] File extensions recognized
- [ ] Parser loads without errors
- [ ] Queries capture expected definitions
- [ ] Unit tests pass
- [ ] CI/CD pipeline succeeds
- [ ] Real files parse correctly
- [ ] Performance is acceptable
- [ ] Fallback mechanism works (if configured)

If all verification steps pass, the tree-sitter integration is working correctly!

## Maintenance

### Updating Submodules

To update the submodules to their latest versions:

```bash
git submodule update --remote --merge
```

### Adding More Languages

Follow the same pattern:

1. Add submodule to `/deps`
2. Build WASM file
3. Add to build process
4. Add file extensions
5. Add parser cases
6. Create query files
7. Add tests

## Troubleshooting

### WASM Build Failures

If the tree-sitter CLI fails to build WASM:

- Ensure you have the latest tree-sitter CLI: `npm update -g tree-sitter-cli`
- Check that the grammar has a valid `grammar.js` file
- Verify Node.js version compatibility

### Parser Not Working

If files are not being parsed:

1. Check that file extensions are added to `src/services/tree-sitter/index.ts`
2. Verify WASM files are being copied to dist directory
3. Check browser console for WASM loading errors
4. Test with fallback chunking first to isolate parser issues

### Query Issues

If queries don't capture expected definitions:

- Use tree-sitter playground to test queries
- Check the grammar's node types match query patterns
- Start with simple queries and gradually add complexity

## Alternative Approach: Using npm Packages

If the repositories provide npm packages with prebuilt WASM files, you could alternatively:

1. Add them as dependencies in `src/package.json`
2. Import WASM files from node_modules
3. Skip the submodule approach entirely

This would be simpler but requires the maintainers to publish npm packages with WASM builds.

## References

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [Web Tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web)
- [Creating Tree-sitter Parsers](https://tree-sitter.github.io/tree-sitter/creating-parsers)
- [Tree-sitter Queries](https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries)
