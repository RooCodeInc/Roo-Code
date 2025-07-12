## Description

Fixes #5532

This PR expands the current image-only attachment system to support all file types while maintaining full backward compatibility. The enhancement replaces the camera icon with a paperclip icon to better reflect the general file attachment functionality.

## Changes Made

### UI Updates
- **Icon Change**: Replaced camera icon with paperclip icon in ChatTextArea component
- **Tooltip Update**: Changed from "Add images to message" to "Attach files to message"
- **Accessibility**: Updated aria-label to reflect new functionality

### Backend Enhancements
- **New File Processing**: Created comprehensive process-files.ts with support for all file types
- **MIME Type Detection**: Intelligent file type categorization (images, documents, code files, data files, etc.)
- **File Size Validation**: 10MB maximum file size limit with proper error handling
- **Smart Content Handling**: Text files displayed as content, binary files encoded as base64

### Message System Updates
- **New Message Types**: Added "selectFiles" to WebviewMessage and "selectedFiles" to ExtensionMessage
- **Dual Support**: Both image-only and general file workflows supported simultaneously
- **Handler Updates**: Extended webview message handler to process both message types

### Internationalization
- **Translation Updates**: Added "attachFiles" key to all supported languages:
  - English: "Attach files to message"
  - French: "Joindre des fichiers au message"
  - Korean: "메시지에 파일 첨부"
  - Turkish: "Mesaja dosya ekle"
  - Russian: "Прикрепить файлы к сообщению"

### Backward Compatibility
- **Preserved Functionality**: Original process-images.ts remains unchanged
- **Dual Function Support**: New process-files.ts includes backward-compatible selectImages() function
- **Message Type Compatibility**: Both "selectImages" and "selectFiles" message types supported
- **Component Props**: ChatTextArea accepts both onSelectImages and onSelectFiles props

## Technical Implementation

### File Type Support
The new system supports comprehensive file categories:
- **Images**: PNG, JPG, JPEG, GIF, BMP, WEBP, SVG
- **Documents**: PDF, DOC, DOCX, TXT, RTF, ODT
- **Code Files**: JS, TS, PY, JAVA, CPP, HTML, CSS, JSON, XML, YAML
- **Data Files**: CSV, XLS, XLSX, SQL
- **Archives**: ZIP, RAR, TAR, GZ
- **And many more**: All file types with proper MIME detection

## Testing Performed

- [x] UI Testing: Verified paperclip icon displays correctly
- [x] File Selection: Tested file dialog with various file types
- [x] Size Validation: Confirmed 10MB limit enforcement
- [x] MIME Detection: Verified correct file type categorization
- [x] Text File Handling: Tested content extraction for text files
- [x] Binary File Handling: Verified base64 encoding for binary files
- [x] Backward Compatibility: Confirmed existing image functionality unchanged
- [x] Translation Testing: Verified all language translations display correctly
- [x] Message Handling: Tested both selectImages and selectFiles workflows

## Verification of Acceptance Criteria

- [x] File Dialog Enhancement: Now accepts all file types instead of images only
- [x] Icon Update: Camera icon replaced with paperclip icon
- [x] Functionality Preservation: All existing image attachment features work unchanged
- [x] User Experience: Seamless transition with improved file support
- [x] Error Handling: Proper validation and user feedback for file operations

## Files Changed

- webview-ui/src/components/chat/ChatTextArea.tsx - Icon and prop updates
- webview-ui/src/components/chat/ChatView.tsx - File selection workflow
- src/integrations/misc/process-files.ts - New comprehensive file processing
- src/shared/WebviewMessage.ts - Added selectFiles message type
- src/shared/ExtensionMessage.ts - Added selectedFiles message type
- src/core/webview/webviewMessageHandler.ts - Dual message handling
- webview-ui/src/i18n/locales/*/chat.json - Translation updates (5 languages)

## Potential Impacts

- **Breaking Changes**: None - full backward compatibility maintained
- **Performance**: Minimal impact - file processing only on user action
- **Security**: File size limits and type validation prevent abuse
- **Accessibility**: Improved with updated aria-labels and tooltips

The implementation maintains the existing codebase patterns while providing a robust, extensible file attachment system.