use neon::prelude::*;
use memmap2::Mmap;
use regex::Regex;
use std::fs::File;
use std::path::Path;

/// Error types for file processing
#[derive(Debug)]
enum FileError {
    IoError(String),
    MmapError(String),
    RegexError(String),
}

impl std::fmt::Display for FileError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            FileError::IoError(msg) => write!(f, "IO error: {}", msg),
            FileError::MmapError(msg) => write!(f, "Mmap error: {}", msg),
            FileError::RegexError(msg) => write!(f, "Regex error: {}", msg),
        }
    }
}

impl std::error::Error for FileError {}

/// Count lines in a file using memory-mapped I/O for performance
/// 
/// # Arguments
/// * `file_path` - Path to the file
/// 
/// # Returns
/// Number of lines in the file
fn count_lines_internal(file_path: &str) -> Result<usize, FileError> {
    let path = Path::new(file_path);
    let file = File::open(path)
        .map_err(|e| FileError::IoError(format!("Failed to open file: {}", e)))?;
    
    // Use memory-mapped I/O for faster access
    let mmap = unsafe {
        Mmap::map(&file)
            .map_err(|e| FileError::MmapError(format!("Failed to mmap file: {}", e)))?
    };
    
    // Count newlines efficiently
    let count = bytecount::count(&mmap, b'\n');
    
    // If file doesn't end with newline, add 1
    let line_count = if !mmap.is_empty() && mmap[mmap.len() - 1] != b'\n' {
        count + 1
    } else {
        count
    };
    
    Ok(line_count)
}

/// Read file content efficiently using memory-mapped I/O
/// 
/// # Arguments
/// * `file_path` - Path to the file
/// 
/// # Returns
/// File content as String
fn read_file_content_internal(file_path: &str) -> Result<String, FileError> {
    let path = Path::new(file_path);
    let file = File::open(path)
        .map_err(|e| FileError::IoError(format!("Failed to open file: {}", e)))?;
    
    let mmap = unsafe {
        Mmap::map(&file)
            .map_err(|e| FileError::MmapError(format!("Failed to mmap file: {}", e)))?
    };
    
    // Convert to string with UTF-8 validation
    String::from_utf8(mmap.to_vec())
        .map_err(|e| FileError::IoError(format!("Invalid UTF-8: {}", e)))
}

/// Read specific line range from file
/// 
/// # Arguments
/// * `file_path` - Path to the file
/// * `start_line` - Starting line (1-indexed)
/// * `end_line` - Ending line (1-indexed, inclusive)
/// 
/// # Returns
/// Content of the specified line range
fn read_line_range_internal(file_path: &str, start_line: usize, end_line: usize) -> Result<String, FileError> {
    let content = read_file_content_internal(file_path)?;
    
    let lines: Vec<&str> = content.lines().collect();
    
    if start_line == 0 || end_line == 0 || start_line > end_line || start_line > lines.len() {
        return Err(FileError::IoError("Invalid line range".to_string()));
    }
    
    let start_idx = start_line.saturating_sub(1);
    let end_idx = end_line.min(lines.len());
    
    Ok(lines[start_idx..end_idx].join("\n"))
}

/// Search for pattern in file using regex
/// 
/// # Arguments
/// * `file_path` - Path to the file
/// * `pattern` - Regex pattern to search
/// 
/// # Returns
/// Vector of matching lines with line numbers
fn search_in_file_internal(file_path: &str, pattern: &str) -> Result<Vec<(usize, String)>, FileError> {
    let content = read_file_content_internal(file_path)?;
    
    let re = Regex::new(pattern)
        .map_err(|e| FileError::RegexError(format!("Invalid regex: {}", e)))?;
    
    let mut matches = Vec::new();
    
    for (line_num, line) in content.lines().enumerate() {
        if re.is_match(line) {
            matches.push((line_num + 1, line.to_string()));
        }
    }
    
    Ok(matches)
}

/// Estimate token count for text (approximate)
/// Uses a simple heuristic: ~4 characters per token
/// 
/// # Arguments
/// * `text` - Text to estimate tokens for
/// 
/// # Returns
/// Estimated token count
fn estimate_tokens_internal(text: &str) -> usize {
    // Simple estimation: 4 characters ≈ 1 token
    // Also count whitespace and punctuation
    let char_count = text.chars().count();
    let word_count = text.split_whitespace().count();
    
    // Better estimation considering words
    (char_count / 4).max(word_count / 3)
}

/// Neon binding: Count lines in file
/// 
/// JavaScript signature: countLines(filePath: string): number
fn count_lines(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let file_path = cx.argument::<JsString>(0)?.value(&mut cx);
    
    let count = match count_lines_internal(&file_path) {
        Ok(c) => c,
        Err(e) => return cx.throw_error(e.to_string()),
    };
    
    Ok(cx.number(count as f64))
}

/// Neon binding: Read file content
/// 
/// JavaScript signature: readFileContent(filePath: string): string
fn read_file_content(mut cx: FunctionContext) -> JsResult<JsString> {
    let file_path = cx.argument::<JsString>(0)?.value(&mut cx);
    
    let content = match read_file_content_internal(&file_path) {
        Ok(c) => c,
        Err(e) => return cx.throw_error(e.to_string()),
    };
    
    Ok(cx.string(content))
}

/// Neon binding: Read line range
/// 
/// JavaScript signature: readLineRange(filePath: string, startLine: number, endLine: number): string
fn read_line_range(mut cx: FunctionContext) -> JsResult<JsString> {
    let file_path = cx.argument::<JsString>(0)?.value(&mut cx);
    let start_line = cx.argument::<JsNumber>(1)?.value(&mut cx) as usize;
    let end_line = cx.argument::<JsNumber>(2)?.value(&mut cx) as usize;
    
    let content = match read_line_range_internal(&file_path, start_line, end_line) {
        Ok(c) => c,
        Err(e) => return cx.throw_error(e.to_string()),
    };
    
    Ok(cx.string(content))
}

/// Neon binding: Search in file
/// 
/// JavaScript signature: searchInFile(filePath: string, pattern: string): Array<{line: number, content: string}>
fn search_in_file(mut cx: FunctionContext) -> JsResult<JsArray> {
    let file_path = cx.argument::<JsString>(0)?.value(&mut cx);
    let pattern = cx.argument::<JsString>(1)?.value(&mut cx);
    
    let matches = match search_in_file_internal(&file_path, &pattern) {
        Ok(m) => m,
        Err(e) => return cx.throw_error(e.to_string()),
    };
    
    let js_array = JsArray::new(&mut cx, matches.len());
    
    for (i, (line_num, content)) in matches.iter().enumerate() {
        let obj = cx.empty_object();
        let line_val = cx.number(*line_num as f64);
        let content_val = cx.string(content);
        
        obj.set(&mut cx, "line", line_val)?;
        obj.set(&mut cx, "content", content_val)?;
        
        js_array.set(&mut cx, i as u32, obj)?;
    }
    
    Ok(js_array)
}

/// Neon binding: Estimate tokens
/// 
/// JavaScript signature: estimateTokens(text: string): number
fn estimate_tokens(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let text = cx.argument::<JsString>(0)?.value(&mut cx);
    
    let count = estimate_tokens_internal(&text);
    
    Ok(cx.number(count as f64))
}

/// Neon binding: Get file size in bytes
/// 
/// JavaScript signature: getFileSize(filePath: string): number
fn get_file_size(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let file_path = cx.argument::<JsString>(0)?.value(&mut cx);
    
    let path = Path::new(&file_path);
    let metadata = match std::fs::metadata(path) {
        Ok(m) => m,
        Err(e) => return cx.throw_error(format!("Failed to get file metadata: {}", e)),
    };
    
    Ok(cx.number(metadata.len() as f64))
}

// Add bytecount as a helper for fast counting
mod bytecount {
    pub fn count(haystack: &[u8], needle: u8) -> usize {
        haystack.iter().filter(|&&b| b == needle).count()
    }
}

/// Module initialization - export all functions to JavaScript
#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("countLines", count_lines)?;
    cx.export_function("readFileContent", read_file_content)?;
    cx.export_function("readLineRange", read_line_range)?;
    cx.export_function("searchInFile", search_in_file)?;
    cx.export_function("estimateTokens", estimate_tokens)?;
    cx.export_function("getFileSize", get_file_size)?;
    Ok(())
}