---
sidebar_label: ChatGPT Plus/Pro
title: ChatGPT Plus/Pro
description: Use OpenAI models in Roo Code with your ChatGPT Plus/Pro subscription (OAuth sign-in, no API key).
keywords:
    - OpenAI Codex
    - ChatGPT Plus
    - ChatGPT Pro
    - Roo Code
    - OAuth
    - no api key
    - subscription
---

<div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
  <iframe
    src="https://www.youtube.com/embed/c1IXRMl5i0g?rel=0&modestbranding=1"
    title="OpenAI – ChatGPT Plus/Pro provider setup"
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
    }}
    frameBorder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  ></iframe>
</div>

---

## Quickstart: Connect your subscription to Roo Code

1. Open Roo Code settings (click the gear icon <Codicon name="gear" /> in the Roo Code panel).
2. In **API Provider**, select **OpenAI – ChatGPT Plus/Pro**.
3. Click **Sign in to OpenAI Codex**.
4. Finish the sign-in flow in your browser.
5. Back in Roo Code settings, pick a model from the dropdown.
6. Save.

## Tips and Notes

- **Subscription Required:** You need an active ChatGPT Plus or Pro subscription. This provider won't work with free ChatGPT accounts. See [OpenAI's ChatGPT plans](https://openai.com/chatgpt/pricing) for more info.
- **No API Costs:** Usage through this provider counts against your ChatGPT subscription, not separately billed API usage.
- **Sign Out:** To disconnect, use the "Sign Out" button in the provider settings.

## What you can't do (and why)

- **You can't use arbitrary OpenAI API models.** This provider only exposes the models listed in Roo's Codex model catalog.
- **You can't export/migrate your sign-in state with settings export.** OAuth tokens are stored in VS Code SecretStorage, which isn't included in Roo's settings export.
