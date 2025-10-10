use neon::prelude::*;
use neon::types::buffer::TypedArray;
use base64::{Engine as _, engine::general_purpose};
use image::{ImageFormat, GenericImageView, ImageReader};
use std::io::Cursor;

/// Error types for image processing
#[derive(Debug)]
enum ImageError {
    DecodeError(String),
    InvalidFormat(String),
    LoadError(String),
}

impl std::fmt::Display for ImageError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            ImageError::DecodeError(msg) => write!(f, "Decode error: {}", msg),
            ImageError::InvalidFormat(msg) => write!(f, "Invalid format: {}", msg),
            ImageError::LoadError(msg) => write!(f, "Load error: {}", msg),
        }
    }
}

impl std::error::Error for ImageError {}

/// Decode a base64 encoded string to bytes
/// 
/// # Arguments
/// * `data` - Base64 encoded string
/// 
/// # Returns
/// Result containing decoded bytes or error message
fn decode_base64_internal(data: &str) -> Result<Vec<u8>, ImageError> {
    general_purpose::STANDARD
        .decode(data)
        .map_err(|e| ImageError::DecodeError(format!("Failed to decode base64: {}", e)))
}

/// Validate image format from bytes
/// 
/// # Arguments
/// * `data` - Raw image bytes
/// 
/// # Returns
/// Result containing the image format or error message
fn validate_image_internal(data: &[u8]) -> Result<ImageFormat, ImageError> {
    image::guess_format(data)
        .map_err(|e| ImageError::InvalidFormat(format!("Invalid image format: {}", e)))
}

/// Get image dimensions from bytes
/// 
/// # Arguments
/// * `data` - Raw image bytes
/// 
/// # Returns
/// Result containing (width, height) tuple or error message
fn get_dimensions_internal(data: &[u8]) -> Result<(u32, u32), ImageError> {
    let img = ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| ImageError::LoadError(format!("Failed to read image: {}", e)))?
        .decode()
        .map_err(|e| ImageError::LoadError(format!("Failed to decode image: {}", e)))?;
    
    Ok(img.dimensions())
}

/// Calculate memory usage for image data
/// 
/// # Arguments
/// * `data` - Raw image bytes
/// 
/// # Returns
/// Size in bytes
fn calculate_memory_usage_internal(data: &[u8]) -> usize {
    data.len()
}

/// Neon binding: Decode base64 string to Buffer
/// 
/// JavaScript signature: decodeBase64(data: string): Buffer
fn decode_base64(mut cx: FunctionContext) -> JsResult<JsBuffer> {
    // Get the base64 string argument
    let data = cx.argument::<JsString>(0)?.value(&mut cx);
    
    // Decode the base64 data
    let decoded = match decode_base64_internal(&data) {
        Ok(bytes) => bytes,
        Err(e) => return cx.throw_error(e.to_string()),
    };
    
    // Create a Node.js Buffer and copy the decoded data into it
    let mut buffer = cx.buffer(decoded.len())?;
    buffer.as_mut_slice(&mut cx).copy_from_slice(&decoded);
    
    Ok(buffer)
}

/// Neon binding: Validate image format
/// 
/// JavaScript signature: validateImage(data: Buffer): string
fn validate_image(mut cx: FunctionContext) -> JsResult<JsString> {
    // Get the buffer argument
    let buffer = cx.argument::<JsBuffer>(0)?;
    let data = buffer.as_slice(&cx);
    
    // Validate the image format
    let format = match validate_image_internal(data) {
        Ok(fmt) => fmt,
        Err(e) => return cx.throw_error(e.to_string()),
    };
    
    // Convert ImageFormat to string
    let format_str = match format {
        ImageFormat::Png => "PNG",
        ImageFormat::Jpeg => "JPEG",
        ImageFormat::Gif => "GIF",
        ImageFormat::WebP => "WEBP",
        ImageFormat::Tiff => "TIFF",
        ImageFormat::Bmp => "BMP",
        ImageFormat::Ico => "ICO",
        ImageFormat::Avif => "AVIF",
        _ => "UNKNOWN",
    };
    
    Ok(cx.string(format_str))
}

/// Neon binding: Get image dimensions
/// 
/// JavaScript signature: getDimensions(data: Buffer): { width: number, height: number }
fn get_dimensions(mut cx: FunctionContext) -> JsResult<JsObject> {
    // Get the buffer argument
    let buffer = cx.argument::<JsBuffer>(0)?;
    let data = buffer.as_slice(&cx);
    
    // Get the dimensions
    let (width, height) = match get_dimensions_internal(data) {
        Ok(dims) => dims,
        Err(e) => return cx.throw_error(e.to_string()),
    };
    
    // Create a JavaScript object with width and height
    let obj = cx.empty_object();
    let width_val = cx.number(width as f64);
    let height_val = cx.number(height as f64);
    
    obj.set(&mut cx, "width", width_val)?;
    obj.set(&mut cx, "height", height_val)?;
    
    Ok(obj)
}

/// Neon binding: Calculate memory usage
/// 
/// JavaScript signature: calculateMemoryUsage(data: Buffer): number
fn calculate_memory_usage(mut cx: FunctionContext) -> JsResult<JsNumber> {
    // Get the buffer argument
    let buffer = cx.argument::<JsBuffer>(0)?;
    let data = buffer.as_slice(&cx);
    
    // Calculate memory usage
    let size = calculate_memory_usage_internal(data);
    
    Ok(cx.number(size as f64))
}

/// Neon binding: Encode bytes to base64 string
/// 
/// JavaScript signature: encodeBase64(data: Buffer): string
fn encode_base64(mut cx: FunctionContext) -> JsResult<JsString> {
    // Get the buffer argument
    let buffer = cx.argument::<JsBuffer>(0)?;
    let data = buffer.as_slice(&cx);
    
    // Encode to base64
    let encoded = general_purpose::STANDARD.encode(data);
    
    Ok(cx.string(encoded))
}

/// Neon binding: Get image format as string without throwing
/// 
/// JavaScript signature: getImageFormat(data: Buffer): string | null
fn get_image_format(mut cx: FunctionContext) -> JsResult<JsValue> {
    // Get the buffer argument
    let buffer = cx.argument::<JsBuffer>(0)?;
    let data = buffer.as_slice(&cx);
    
    // Try to guess the format
    match image::guess_format(data) {
        Ok(format) => {
            let format_str = match format {
                ImageFormat::Png => "png",
                ImageFormat::Jpeg => "jpeg",
                ImageFormat::Gif => "gif",
                ImageFormat::WebP => "webp",
                ImageFormat::Tiff => "tiff",
                ImageFormat::Bmp => "bmp",
                ImageFormat::Ico => "ico",
                ImageFormat::Avif => "avif",
                _ => "unknown",
            };
            Ok(cx.string(format_str).upcast())
        }
        Err(_) => Ok(cx.null().upcast()),
    }
}

/// Module initialization - export all functions to JavaScript
#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("decodeBase64", decode_base64)?;
    cx.export_function("encodeBase64", encode_base64)?;
    cx.export_function("validateImage", validate_image)?;
    cx.export_function("getDimensions", get_dimensions)?;
    cx.export_function("calculateMemoryUsage", calculate_memory_usage)?;
    cx.export_function("getImageFormat", get_image_format)?;
    Ok(())
}