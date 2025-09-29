---
sidebar_label: "Power Steering"
description: "Improve Roo Code's response consistency with Power Steering. This experimental feature reinforces mode definitions and custom instructions for better adherence to assigned roles."
keywords:
    - power steering
    - LLM consistency
    - mode adherence
    - custom instructions
    - experimental feature
    - token optimization
    - role definition
image: /img/social-share.jpg
---

import Codicon from '@site/src/components/Codicon';

# Power Steering (Experimental Feature)

The "Power Steering" experimental feature (`POWER_STEERING`) is designed to enhance the consistency of Roo Code's responses by more frequently reminding the underlying Large Language Model (LLM) about its current mode definition and any custom instructions.

---

## How It Works

When Power Steering is enabled, Roo Code constantly reinforces the LLM's understanding of its assigned role (e.g., "You are a helpful coding assistant") and any specific guidelines provided by the user (e.g., "Always provide code examples in Python").

This is achieved by explicitly including the `modeDetails.roleDefinition` and `modeDetails.customInstructions` within the information sent to the LLM with each interaction.

**Goal:**
The primary goal is to ensure the LLM adheres more strictly to its defined persona and follows user-specific instructions more consistently. If you find Roo deviating from its role or overlooking custom rules, Power Steering can help maintain its focus.

**Trade-off:**
These frequent reminders consume additional tokens in each message sent to the LLM. This means:

- Increased token usage per message.
- Potentially higher operational costs.
- The context window may be filled more quickly.

It's a balance between stricter adherence to instructions and resource consumption.

**Default Status:** Disabled.

---

## Technical Details

- **Experiment ID:** `powerSteering`
- **Mechanism:**
    - The feature's status is checked by the `getEnvironmentDetails` function.
    - If enabled, the current mode's `roleDefinition` and `customInstructions` are added to the details sent to the LLM.
    - These details are wrapped in `<environment_details>` tags and become part of the context for each LLM interaction.
- **Impact:** By frequently including the role definition and custom instructions, the LLM is steered to generate responses more aligned with these parameters.

---

## Enabling This Feature

Power Steering is managed within the "Experimental Features" section of Roo Code's Advanced Settings.

1.  Open Roo Code settings (<Codicon name="gear" /> icon in the top right corner).
2.  Navigate to "Advanced Settings".
3.  Locate the "Experimental Features" area.
4.  Toggle the "Power Steering" option.
5.  Save your changes.
    <img src="/img/power-steering/power-steering.png" alt="Settings for Intelligent Context Condensation and Power Steering" width="600" />

For general information on experimental features, see [Experimental Features Overview](/features/experimental/experimental-features).

---

## Feedback

Please report any issues or suggestions regarding this feature on the [Roo Code GitHub Issues page](https://github.com/RooCodeInc/Roo-Code/issues). Your feedback is crucial for improving Roo Code.
