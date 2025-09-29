---
description: Generate Discord-formatted release notes from existing release files
argument-hint: <version(s)> [compress]
---

<task>
Generate Discord-formatted release notes from existing Roo Code release documentation
</task>

<context>
Discord has specific formatting requirements and character limits. Release notes need to be 
transformed from the documentation format to be suitable for Discord announcements while 
maintaining clarity and highlighting key features.
</context>

<requirements>
  <input_handling>
    - Accept single version: "3.20.3" or "v3.20.3"
    - Accept multiple versions: "3.20.3, 3.20.4" 
    - Support optional compression flag for long notes
    - Validate that release files exist before processing
  </input_handling>

  <transformations>
    <remove_elements>
      - All PR links and numbers (e.g., ([#1234](link)) becomes empty)
      - GitHub-specific formatting
      - Frontmatter sections
    </remove_elements>
    
    <convert_links>
      - Internal docs: [text](/path) → [text](https://docs.roocode.com/path)
      - Preserve external links as-is
      - Ensure all links are absolute
    </convert_links>
    
    <preserve_elements>
      - Section structure and headings
      - Contributor acknowledgments (thanks username!)
      - Feature descriptions and benefits
      - Bullet point formatting
    </preserve_elements>
  </transformations>

<output_format>
<single_version> - Include version and date in title - Maintain original section order - Add footer: [Full X.Y.Z Release Notes](https://docs.roocode.com/update-notes/vX.Y.Z)
</single_version>

    <multiple_versions>
      - Separate sections per version with clear headers
      - Option to combine by category with version indicators
      - Include footer links for each version
    </multiple_versions>

    <compression optional="true">
      - When character count exceeds 1800 (leaving buffer for Discord's 2000 limit)
      - Compress smaller sections into summary format
      - Keep major features expanded
      - Format: "## :wrench: [Other Improvements and Fixes](link)"
      - List contributor count and affected areas
    </compression>

</output_format>
</requirements>

<workflow>
  <step number="1">
    <action>Parse version input</action>
    <details>
      - Extract version numbers (with or without 'v' prefix)
      - Detect compression flag if present
      - Handle comma-separated lists for multiple versions
    </details>
  </step>
  
  <step number="2">
    <action>Verify release files exist</action>
    <details>
      - Check docs/update-notes/vX.Y.Z.mdx for each version
      - If missing, offer to process only existing versions
      - Provide clear error message for missing files
    </details>
  </step>
  
  <step number="3">
    <action>Read and transform content</action>
    <details>
      - Load release notes content
      - Apply all transformations listed in requirements
      - Preserve markdown formatting for Discord
      - Calculate character count for compression decisions
    </details>
  </step>
  
  <step number="4">
    <action>Format for Discord</action>
    <details>
      - Apply Discord-friendly formatting
      - Use emoji for visual appeal where appropriate
      - Ensure proper spacing between sections
      - Add version indicators for multi-version output
    </details>
  </step>
  
  <step number="5">
    <action>Handle character limits</action>
    <details>
      - Check total character count
      - If over 1800 chars and compression requested, apply compression
      - If over 2000 chars without compression, warn user
      - Suggest splitting into multiple messages if needed
    </details>
  </step>
  
  <step number="6">
    <action>Output formatted text</action>
    <details>
      - Display the formatted announcement
      - Do NOT create any files
      - Provide copy-ready text block
      - Include character count information
    </details>
  </step>
</workflow>

<examples>
  <example name="single_version">
    <input>/discord-release-notes 3.20.3</input>
    <output_preview>
# Roo Code 3.20.3 Release Notes (2024-01-15)

This release adds context condensing, improves performance, and fixes UI bugs.

## Context Condensing is Now Default

We've made context condensing the default behavior (thanks contributor!):

- **Automatic optimization**: Reduces token usage by up to 40%
- **Smart selection**: Preserves relevant context
- **Configurable**: Adjust settings via preferences

This significantly improves response times for large codebases.

## Bug Fixes

- **File handling**: Fixed errors with special characters (thanks user1!)
- **Terminal output**: Resolved streaming issues (thanks user2!)

[Full 3.20.3 Release Notes](https://docs.roocode.com/update-notes/v3.20.3)
</output_preview>
</example>

  <example name="multiple_versions_compressed">
    <input>/discord-release-notes 3.20.3, 3.20.4 compress</input>
    <output_preview>
# Roo Code Updates: v3.20.3 & v3.20.4

## v3.20.3 - Context Condensing (2024-01-15)

Major feature: Context condensing is now default, reducing token usage by up to 40% (thanks contributor!)

## v3.20.4 - Performance Boost (2024-01-18)

Key improvements: 2x faster file operations and improved memory usage (thanks dev-team!)

## :wrench: Other Improvements and Fixes

Both releases include 15+ bug fixes and QOL improvements. Thanks to all 12 contributors!

Release Notes: [v3.20.3](https://docs.roocode.com/update-notes/v3.20.3) | [v3.20.4](https://docs.roocode.com/update-notes/v3.20.4)
</output_preview>
</example>
</examples>

<error_handling>
<scenario type="missing_file">
<message>Release notes for version X.Y.Z not found. Would you like to: 1. Process only existing versions 2. Create release notes first 3. Cancel</message>
</scenario>

  <scenario type="character_limit">
    <message>Warning: Output exceeds Discord's 2000 character limit (current: [count]).
    Consider using 'compress' flag or splitting into multiple messages.</message>
  </scenario>
  
  <scenario type="invalid_version">
    <message>Invalid version format. Please use: X.Y.Z or vX.Y.Z</message>
  </scenario>
</error_handling>

<output_instructions>
Present the Discord-formatted text in a code block for easy copying.
Include metadata: character count, versions processed, compression status.
Never create files - only display formatted output.
</output_instructions>
