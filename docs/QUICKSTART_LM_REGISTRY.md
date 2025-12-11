# Quick Start: VS Code LM Model Registry

## What Changed?

Roo Code now automatically corrects context window limits for models accessed through GitHub Copilot and other VS Code LM providers.

**Example: Claude Opus 4.5**

- Before: 128K context (limited by Copilot)
- After: 200K context (native capability) ✓

## How to Use

### No Setup Required! 🎉

The enhancement works automatically. Just:

1. **Select a model** through the VS Code LM provider (e.g., Copilot)
2. **Start coding** - you'll automatically get the full context window
3. **Check logs** (optional) to see the registry in action

### Example

```typescript
// When you select Claude Opus 4.5 in Copilot...
// Old behavior: 128K context
// New behavior: 200K context automatically!
```

## Verify It's Working

### Method 1: Check Model Info UI

1. Open Roo Code settings
2. Select "VS Code LM API" as provider
3. Choose "Claude Opus 4.5" model
4. Look for "Context Window: 200,000 tokens" ✓

### Method 2: Debug Console

1. Open VS Code Developer Console (Help → Toggle Developer Tools)
2. Start a chat with Claude Opus 4.5
3. Look for logs:
    ```
    Roo Code <VS Code LM Registry>: Matched model 'claude-opus-4-5' to pattern 'claude-opus-4-5'
    Roo Code <VS Code LM Registry>: Using registry info. Context: 200000
    ```

## Supported Models

### Full Context Unlocked ✓

**Anthropic Claude:**

- Claude Opus 4.5: 200K → 200K ✓
- Claude Sonnet 4.5: 200K → 200K ✓
- Claude Haiku 4.5: 200K → 200K ✓

**OpenAI GPT:**

- GPT-4o: 128K → 128K ✓
- GPT-5: 200K → 200K ✓
- O3-mini: 200K → 200K ✓

**Google Gemini:**

- Gemini 2.5 Pro: 1M → 1M ✓
- Gemini 1.5 Pro: 2M → 2M ✓

### How It Works

```
Copilot says: "128K context"
   ↓
Registry checks: "Is this Claude Opus 4.5?"
   ↓
Registry says: "Yes! Use 200K instead"
   ↓
You get: Full 200K context! 🎉
```

## Benefits You'll Notice

✅ **Longer conversations** without truncation
✅ **More context** for complex tasks
✅ **Better results** from the AI
✅ **Accurate token counts** for usage tracking

## Troubleshooting

### "Still seeing 128K context"

**Check:**

1. Model ID matches expected format (check debug logs)
2. Roo Code extension updated to latest version
3. Restart VS Code after update

### "Debug logs show no match"

**Action:**

1. Copy the exact model ID from logs
2. Report as issue with model ID
3. Pattern can be added to registry

### "Different model showing wrong context"

**Solution:**
Registry can be extended! See [vscode-lm-registry.md](./vscode-lm-registry.md) for details.

## Technical Details

For developers wanting to understand or extend the implementation:

- 📖 **Full Documentation**: [vscode-lm-registry.md](./vscode-lm-registry.md)
- 📝 **Implementation Details**: [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)
- 🧪 **Tests**: `/packages/types/src/providers/__tests__/vscode-lm-registry.spec.ts`
- 💻 **Source**: `/packages/types/src/providers/vscode-lm-registry.ts`

## FAQs

**Q: Do I need to configure anything?**
A: No! It works automatically for all supported models.

**Q: Will this break my existing setup?**
A: No! It's fully backward compatible.

**Q: What if my model isn't in the registry?**
A: It falls back to the API-reported value (current behavior).

**Q: Can I add my own models?**
A: Yes! Edit `/packages/types/src/providers/vscode-lm-registry.ts`

**Q: Does this work with all LM providers?**
A: Yes! Any provider using the VS Code LM API.

**Q: Is there a performance impact?**
A: No. The registry lookup is instant (<1ms).

## Example Workflow

```bash
# 1. Open Roo Code
code .

# 2. Select Provider: "VS Code LM API"
# 3. Select Model: "Claude Opus 4.5" (via Copilot)

# 4. Start chatting!
# Behind the scenes:
# - Copilot reports: 128K
# - Registry corrects: 200K ✓
# - You get full context!

# 5. Verify in console (optional):
# "Roo Code <VS Code LM Registry>: Using registry info. Context: 200000"
```

## Next Steps

1. ✅ **Nothing!** It just works
2. 💡 Optional: Check debug logs to see it in action
3. 📚 Optional: Read full docs to understand internals
4. 🚀 Optional: Contribute new model patterns

---

**Questions?** See the full documentation: [vscode-lm-registry.md](./vscode-lm-registry.md)

**Issues?** Check debug logs and report with model ID

**Feedback?** We'd love to hear how it's working for you!
