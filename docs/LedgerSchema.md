# Ledger Schema: agent_trace.jsonl

Defines cryptographically verifiable, spatially independent entries for every mutating action.

## JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AgentTraceEntry",
  "type": "object",
  "required": ["id", "timestamp", "files"],
  "properties": {
    "id": {"type": "string"},
    "timestamp": {"type": "string", "format": "date-time"},
    "vcs": {
      "type": "object",
      "properties": {"revision_id": {"type": "string"}},
      "additionalProperties": false
    },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["relative_path", "conversations"],
        "properties": {
          "relative_path": {"type": "string"},
          "conversations": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "url": {"type": "string"},
                "contributor": {
                  "type": "object",
                  "properties": {
                    "entity_type": {"type": "string", "enum": ["AI", "Human"]},
                    "model_identifier": {"type": "string"}
                  },
                  "additionalProperties": false
                },
                "classification": {"type": "string", "enum": ["REFACTOR", "FEATURE", "BUGFIX"]},
                "ast_node_type": {"type": "string"},
                "intent_id": {"type": "string"},
                "ranges": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["start_line", "end_line", "content_hash"],
                    "properties": {
                      "start_line": {"type": "integer", "minimum": 0},
                      "end_line": {"type": "integer", "minimum": 0},
                      "content_hash": {"type": "string", "pattern": "^sha256:[a-f0-9]{64}$"}
                    },
                    "additionalProperties": false
                  }
                },
                "related": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["type", "value"],
                    "properties": {
                      "type": {"type": "string"},
                      "value": {"type": "string"}
                    },
                    "additionalProperties": false
                  }
                }
              },
              "required": ["ranges"],
              "additionalProperties": false
            }
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

## Example Entry

```json
{
  "id": "b4d3e9c2-4f1a-4d3f-9f8a-9c6e8c7f2a1b",
  "timestamp": "2026-02-17T12:34:56.789Z",
  "files": [
    {
      "relative_path": "src/utils/math.ts",
      "conversations": [
        {
          "contributor": {"entity_type": "AI", "model_identifier": "gpt-5"},
          "classification": "REFACTOR",
          "ast_node_type": "FunctionDeclaration",
          "ranges": [
            {
              "start_line": 0,
              "end_line": 9,
              "content_hash": "sha256:0f8c3b9fd4e0a1c2e3f4d5b6c7d8e9fa0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e"
            }
          ],
          "related": [{"type": "specification", "value": "INT-001"}]
        }
      ]
    }
  ]
}
```

## Hashing Logic (PostHook.ts)

```ts
function computeContentHash(code: string): string {
  const normalized = code.trim().replace(/\s+/g, " ")
  return createHash("sha256").update(normalized, "utf8").digest("hex")
}
```

- Normalization: collapse whitespace to ensure spatial independence.
- Prefix: entries store `content_hash` as `sha256:<hex>`.

## Integration
- Write path: [src/hooks/engines/PostHook.ts](src/hooks/engines/PostHook.ts)
- Types: [src/hooks/models/AgentTrace.ts](src/hooks/models/AgentTrace.ts)
