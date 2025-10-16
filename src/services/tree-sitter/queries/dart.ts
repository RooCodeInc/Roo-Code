/*
Query patterns for Dart language structures
Note: This is a basic implementation that captures common Dart constructs.
The exact node names may vary based on the tree-sitter-dart grammar version.
*/
export default `
; Capture all identifiers as potential definitions
; This is a fallback pattern that should work with most grammars
(identifier) @definition.identifier
`
