---
description: Generate new images from text prompts or edit existing images in Roo Code using OpenRouter API. Transform, enhance, and save AI-processed images to your workspace with preview support.
keywords:
    - image generation
    - image editing
    - text to image
    - image transformation
    - OpenRouter
    - AI images
    - experimental feature
    - image creation
    - prompt to image
    - watercolor
    - upscaling
    - style transfer
image: /img/social-share.jpg
---

# Image Generation

Generate new images from text prompts or edit existing images in your workspace. Save results to your project with preview in chat. This experimental feature requires an OpenRouter API key.

:::warning Experimental Feature
Image Generation is an experimental feature that requires enabling in settings and configuring an OpenRouter API key.
:::

---

## Key Features

- Create new images from text prompts using natural language
- Edit and transform existing images in your workspace
- Saves to your workspace at a path you choose; appropriate extension (.png or .jpg) is auto-added if missing
- Shows a preview of the generated/edited image in the conversation
- Currently uses Gemini 2.5 Flash Image Preview models via OpenRouter
- Simple on/off toggle under Experimental settings

---

## Use Cases

### Image Generation

**Before:** You had to copy prompts to an external site, download the result, then move it into your workspace.

**With this feature:** Ask Roo to generate an image, approve, pick a save location, and continue editing with the image already in your project.

### Image Editing

**Before:** Export image, upload to external editor, make changes, download, import back to project.

**With this feature:** Ask Roo to transform your existing image directly - it reads the file, applies your edits, and saves the result in your project.

---

## How It Works

When enabled, Roo sends your prompt (and optionally an existing image) to an image-capable model through OpenRouter. The generated or edited image returned by OpenRouter is saved to the path you specify inside your current workspace. Roo shows a preview in the chat and the file appears in your file explorer.

---

## Requirements

- OpenRouter account and API key
- Internet access
- An open, writable workspace folder

---

## Configuration

### 1. Enable Image Generation (Experimental)

- **Purpose:** Turns the feature on so Roo can create images on request
- **Default:** Off
- **Location:** Settings > Experimental

### 2. OpenRouter API Key

- **Purpose:** Authorizes image generation requests
- **Default:** Empty (required)
- **Get your key:** [https://openrouter.ai/keys](https://openrouter.ai/keys)

### 3. Image Generation Model

- **Purpose:** Selects which model to use for generation
- **Default:** Gemini 2.5 Flash Image Preview
- **Available Models:** Currently limited to Gemini 2.5 Flash Image Preview and its free variant

---

## Using Image Generation

1. In chat, ask Roo to generate an image and describe what you want (subject, style, lighting, composition).
2. Confirm the action when prompted. Roo may ask you to choose a save path (for example: `images/sunset.png`).
3. Roo generates the image and saves it. If you don't include an extension, the appropriate extension (.png or .jpg) is added based on the output format.
4. See the image preview in the chat and locate the file in your workspace.

---

## Editing Existing Images

Roo can also transform and edit existing images in your workspace:

1. Ask Roo to edit an image, describing the transformation you want
2. Specify both the input image path and where to save the result
3. Roo will apply your requested edits to the existing image

**Supported Input Formats**: PNG, JPG, JPEG, GIF, WEBP

**Example Requests**:

- "Transform `photos/portrait.jpg` into a watercolor painting and save as `art/watercolor-portrait.png`"
- "Upscale and enhance `images/logo.png` to higher resolution"
- "Apply a vintage filter to `screenshots/app.png`"

**Note**: Both the input image path and output path must be accessible (not blocked by `.rooignore`)

---

## Tips for Better Results

### Be Specific

Include these elements in your prompts:

- **Style:** artistic medium, art movement, or specific artist style
- **Mood:** emotional tone, atmosphere
- **Color palette:** specific colors or color schemes
- **Camera/lighting:** angle, perspective, lighting conditions
- **Aspect ratio:** dimensions or orientation

---

## Limitations

- Experimental feature; availability and model list are limited
- Currently limited to Gemini 2.5 Flash Image Preview models
- One image is produced per request
- Output formats supported: PNG or JPG
- Supported input formats for editing: PNG, JPG, JPEG, GIF, WEBP only
- Image paths must be accessible (not blocked by `.rooignore` restrictions)
- Usage may be subject to your OpenRouter plan limits and costs

---

## Status

This feature is experimental and may change or be removed in future versions. Provide feedback through [GitHub Issues](https://github.com/RooCodeInc/Roo-Code/issues).
