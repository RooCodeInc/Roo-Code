import { describe, it, expect, beforeAll } from "vitest"
import { CodeParser } from "../parser"
import { shouldUseFallbackChunking } from "../../shared/supported-extensions"
import * as path from "path"
import { initializeTreeSitter } from "../../../tree-sitter/__tests__/helpers"

describe("Julia file parsing", () => {
	let parser: CodeParser

	beforeAll(async () => {
		await initializeTreeSitter()
		parser = new CodeParser()
	})

	it("should use fallback chunking for Julia files", () => {
		// Verify that Julia extension is marked for fallback chunking
		expect(shouldUseFallbackChunking(".jl")).toBe(true)
	})

	it("should parse Julia files using fallback chunking", async () => {
		const juliaContent = `# Julia module for data analysis
module DataAnalytics

using Statistics
using DataFrames

# Type definition for data points
struct DataPoint
    x::Float64
    y::Float64
    label::String
end

# Function to calculate basic statistics
function calculate_statistics(data::Vector{Float64})
    return (
        mean = mean(data),
        median = median(data),
        std = std(data),
        min = minimum(data),
        max = maximum(data)
    )
end

# Filter data by value range
function filter_data(data::Vector{DataPoint}, min_val::Float64, max_val::Float64)
    return filter(p -> min_val <= p.x <= max_val, data)
end

# Process dataset with custom transformation
function process_dataset(df::DataFrame, transform_func::Function)
    processed = DataFrame()
    for col in names(df)
        if eltype(df[!, col]) <: Number
            processed[!, col] = transform_func.(df[!, col])
        else
            processed[!, col] = df[!, col]
        end
    end
    return processed
end

# Main analysis pipeline
function run_analysis(input_file::String, output_file::String)
    # Load data
    df = DataFrame(CSV.File(input_file))
    
    # Process data
    processed = process_dataset(df, x -> log(1 + abs(x)))
    
    # Calculate statistics for numeric columns
    stats_dict = Dict{String, Any}()
    for col in names(processed)
        if eltype(processed[!, col]) <: Number
            stats_dict[col] = calculate_statistics(processed[!, col])
        end
    end
    
    # Save results
    CSV.write(output_file, processed)
    
    return stats_dict
end

# Export public interface
export DataPoint, calculate_statistics, filter_data, process_dataset, run_analysis

end # module DataAnalytics

# Usage example
using .DataAnalytics

# Create sample data
sample_points = [
    DataPoint(1.0, 2.0, "A"),
    DataPoint(3.0, 4.0, "B"),
    DataPoint(5.0, 6.0, "C")
]

# Filter data
filtered = filter_data(sample_points, 2.0, 4.0)
println("Filtered data: ", filtered)

# Calculate statistics
values = [p.x for p in sample_points]
stats = calculate_statistics(values)
println("Statistics: ", stats)`

		const testFilePath = path.join("/tmp", "test.jl")
		const result = await parser.parseFile(testFilePath, {
			content: juliaContent,
			fileHash: "test-hash",
		})

		// Should have results from fallback chunking
		expect(result.length).toBeGreaterThan(0)

		// Check that all blocks are of type 'fallback_chunk'
		result.forEach((block) => {
			expect(block.type).toBe("fallback_chunk")
		})

		// Verify that the content is properly chunked
		const firstBlock = result[0]
		expect(firstBlock.file_path).toBe(testFilePath)
		expect(firstBlock.content).toContain("Julia module")
		expect(firstBlock.identifier).toBeNull()
		expect(firstBlock.segmentHash).toMatch(/^[a-f0-9]{64}$/)
		expect(firstBlock.fileHash).toBe("test-hash")
	})

	it("should handle small Julia files that don't meet minimum character requirements", async () => {
		const smallJuliaContent = `# Small Julia file
x = 1
y = 2`

		const testFilePath = path.join("/tmp", "small.jl")
		const result = await parser.parseFile(testFilePath, {
			content: smallJuliaContent,
			fileHash: "small-hash",
		})

		// Should return empty array for files too small to index
		expect(result.length).toBe(0)
	})

	it("should chunk large Julia files appropriately", async () => {
		// Create a large Julia file content with multiple sections
		const sections: string[] = []

		// Add multiple function definitions to create chunks
		for (let i = 0; i < 20; i++) {
			sections.push(`
# Function ${i} for processing data
function process_data_${i}(data::Vector{Float64})
    # This is a longer function with detailed implementation
    # to ensure we have enough content for chunking
    
    # Step 1: Validate input data
    if isempty(data)
        throw(ArgumentError("Data cannot be empty"))
    end
    
    # Step 2: Calculate intermediate results
    intermediate = map(x -> x * 2.0, data)
    
    # Step 3: Apply transformation
    transformed = map(x -> log(1 + abs(x)), intermediate)
    
    # Step 4: Compute final result
    result = sum(transformed) / length(transformed)
    
    # Step 5: Return processed value
    return result
end
`)
		}

		const largeJuliaContent = `# Large Julia module with many functions
module LargeModule

using Statistics
using LinearAlgebra

${sections.join("\n")}

# Export all functions
export ${Array.from({ length: 20 }, (_, i) => `process_data_${i}`).join(", ")}

end # module LargeModule`

		const testFilePath = path.join("/tmp", "large.jl")
		const result = await parser.parseFile(testFilePath, {
			content: largeJuliaContent,
			fileHash: "large-hash",
		})

		// Should have multiple chunks
		expect(result.length).toBeGreaterThan(1)

		// All chunks should be fallback chunks
		result.forEach((block) => {
			expect(block.type).toBe("fallback_chunk")
		})

		// Check that chunks have reasonable sizes
		result.forEach((block) => {
			// Each chunk should have content
			expect(block.content.length).toBeGreaterThan(0)
			// Chunks should not exceed maximum size (with tolerance)
			expect(block.content.length).toBeLessThanOrEqual(150000) // MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR
		})
	})
})

describe("Fallback Extensions Configuration for Julia", () => {
	it("should correctly identify Julia extension for fallback chunking", () => {
		// Julia should use fallback
		expect(shouldUseFallbackChunking(".jl")).toBe(true)
		expect(shouldUseFallbackChunking(".JL")).toBe(true) // Case insensitive

		// Non-Julia extensions should not use fallback (unless they're in the list)
		expect(shouldUseFallbackChunking(".py")).toBe(false)
		expect(shouldUseFallbackChunking(".js")).toBe(false)
		expect(shouldUseFallbackChunking(".ts")).toBe(false)
	})
})
