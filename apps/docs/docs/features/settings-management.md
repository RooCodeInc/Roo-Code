---
sidebar_label: Import/Export/Reset Settings
description: Manage your Roo Code settings by exporting, importing, or resetting them to defaults.
keywords:
    - settings management
    - import settings
    - export settings
    - reset settings
    - configuration backup
    - auto import
image: /img/social-share.jpg
---

# Import, Export, and Reset Settings

Roo Code allows you to manage your configuration settings effectively through export, import, and reset options. These features are useful for backing up your setup, sharing configurations with others, or restoring default settings if needed.

You can find these options at the bottom of the Roo Code settings page, accessible via the gear icon (<i class="codicon codicon-gear"></i>) in the Roo Code chat view.

<img src="/img/settings-management/settings-management.png" alt="Export, Import, and Reset buttons in Roo Code settings" width="400" />
*Image: Export, Import, and Reset buttons.*

---

## Export Settings

Clicking the **Export** button saves your current Roo Code settings to a JSON file.

- **What's Exported:** The file includes your configured API Provider Profiles and Global Settings (UI preferences, mode configurations, context settings, etc.).
- **Security Warning:** The exported JSON file contains **all** your configured API Provider Profiles and Global Settings. Crucially, this includes **API keys in plaintext**. Treat this file as highly sensitive. Do not share it publicly or with untrusted individuals, as it grants access to your API accounts.
- **Process:**
    1.  Click **Export**.
    2.  A file save dialog appears, suggesting `roo-code-settings.json` as the filename (usually in your `~/Documents` folder).
    3.  Choose a location and save the file.

This creates a backup of your configuration or a file you can share.

---

## Import Settings

Clicking the **Import** button allows you to load settings from a previously exported JSON file.

- **Process:**
    1.  Click **Import**.
    2.  A file open dialog appears. Select the `roo-code-settings.json` file (or similarly named file) you want to import.
    3.  Roo Code reads the file, validates its contents against the expected schema, and applies the settings.
- **Merging:** Importing settings **merges** the configurations. It adds new API profiles and updates existing ones and global settings based on the file content. It does **not** delete configurations present in your current setup but missing from the imported file.
- **Validation:** Only valid settings matching the internal schema can be imported, preventing configuration errors. A success notification appears upon completion.

---

## Automatic Configuration Import

Automatically import your Roo Code settings from a file every time you start VS Code. This is a powerful way to sync your configuration across multiple machines or standardize settings for your entire team.

### Key Features

- **Effortless Sync**: Keep your settings consistent across different workspaces and devices.
- **Team Standardization**: Share a single configuration file to ensure your whole team uses the same settings.
- **Flexible Pathing**: Works with absolute paths, or paths relative to your home directory (e.g., `~/Documents/roo-settings.json`).
- **Silent & Safe**: If the file isn't found or contains errors, Roo Code starts up normally without blocking your workflow.

### Use Case

**Before**: Manually exporting and importing settings every time you moved to a new machine or wanted to share your setup.

- Manually open the settings panel.
- Export your current settings to a file.
- Send the file to a teammate or a new machine.
- Manually import the file.

**With this feature**: Configure the path once, and Roo Code handles the rest on every launch.

### How it Works

When VS Code starts, Roo Code checks for a specific setting: `roo-cline.autoImportSettingsPath`. If this setting contains a path to a valid Roo Code configuration file (`.json`), Roo Code will load it automatically.

- Upon successful import, you will see a notification: `Successfully imported settings from [your-file-name.json]`.
- If the file is invalid or can't be found, you'll get a non-intrusive warning, and the extension will start with your last known settings. The `autoImportSettings` function is designed to never block the extension from activating.

### Configuration

To use this feature, add the following to your VS Code `settings.json` file:

1.  **Open your `settings.json` file**:

    - Use the Command Palette (`Ctrl/Cmd + Shift + P`) and search for "Preferences: Open User Settings (JSON)".

2.  **Add the setting**:
    - Add the `roo-cline.autoImportSettingsPath` key with the path to your configuration file.

**Examples**:

- **Absolute Path (Recommended)**

    ```json
    {
    	"roo-cline.autoImportSettingsPath": "/Users/your-username/Documents/dev-configs/roo-code.json"
    }
    ```

- **Home Directory Path** (using `~`)

    ```json
    {
    	"roo-cline.autoImportSettingsPath": "~/roo-code-settings.json"
    }
    ```

- **To disable**, simply leave the path empty or remove the line entirely:
    ```json
    {
    	"roo-cline.autoImportSettingsPath": ""
    }
    ```

### FAQ

**"What happens if my file has an error?"**

- Roo Code will show a warning notification with the error details. The extension will continue to load normally with your previously saved settings.

**"Where does Roo Code look for relative paths?"**

- For safety and consistency, paths that are not absolute or home-directory-based are resolved relative to your home directory.

**"Can I use this to manage settings for my team?"**

- Yes. Place the configuration file in a shared location (like a synced cloud folder or a shared network drive) and have each team member point to that file.

---

## Reset Settings

Clicking the **Reset** button completely clears all Roo Code configuration data and returns the extension to its default state. This is a destructive action intended for troubleshooting or starting fresh.

- **Warning:** This action is **irreversible**. It permanently deletes all API configurations (including keys stored in secret storage), custom modes, global settings, and task history.

- **Process:**

    1.  Click the red **Reset** button.
    2.  A confirmation dialog appears, warning that the action cannot be undone.
    3.  Click "Yes" to confirm.

- **What is Reset:**

    - **API Provider Profiles:** All configurations are deleted from settings and secret storage.
    - **Global Settings:** All preferences (UI, modes, approvals, browser, etc.) are reset to defaults.
    - **Custom Modes:** All user-defined modes are deleted.
    - **Secret Storage:** All API keys and other secrets managed by Roo Code are cleared.
    - **Task History:** The current task stack is cleared.

- **Result:** Roo Code returns to its initial state, as if freshly installed, with default settings and no user configurations.

Use this option only if you are certain you want to remove all Roo Code data or if instructed during troubleshooting. Consider exporting your settings first if you might want to restore them later.
