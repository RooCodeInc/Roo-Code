# F5 Troubleshooting Guide

If pressing F5 doesn't work, try these steps:

## Step 1: Check VS Code Output

1. Open **View** → **Output** (or `Ctrl+Shift+U`)
2. Select **Tasks** from the dropdown
3. Press F5 again and watch for errors

## Step 2: Manually Run Build Task

1. Press `Ctrl+Shift+P` (Command Palette)
2. Type "Tasks: Run Task"
3. Select "watch" task
4. Check the Terminal for errors

## Step 3: Build Extension Manually First

Open a terminal and run:

```powershell
cd "C:\Users\yohan\OneDrive\Desktop\10Academy\intent_developement\Roo-Code"
pnpm bundle
```

Wait for it to complete, then try F5 again.

## Step 4: Check Workspace Folder

Make sure VS Code is opened with the **Roo-Code** folder as the workspace root:

- File → Open Folder → Select `Roo-Code` folder
- NOT the parent `intent_developement` folder

## Step 5: Check Debug Console

1. Open **View** → **Debug Console**
2. Press F5
3. Look for error messages

## Step 6: Verify Launch Configuration

The launch.json should point to:

- `extensionDevelopmentPath`: `${workspaceFolder}/src`
- `preLaunchTask`: `${defaultBuildTask}` (which is "watch")

## Common Issues

### Issue: Build task fails silently

**Solution**: Run `pnpm bundle` manually first, then F5

### Issue: "Cannot find task 'watch'"

**Solution**: Make sure `.vscode/tasks.json` exists and has the "watch" task

### Issue: "Extension host terminated unexpectedly"

**Solution**: Check for TypeScript errors:

```powershell
pnpm check-types
```

### Issue: No new window opens

**Solution**:

1. Check if VS Code is already running another extension host
2. Close all extension host windows
3. Try F5 again

## Alternative: Run Without Pre-Launch Task

If the build task keeps failing, you can modify `.vscode/launch.json`:

1. Comment out or remove the `preLaunchTask` line:

```json
// "preLaunchTask": "${defaultBuildTask}",
```

2. Manually build first:

```powershell
pnpm bundle
```

3. Then press F5

## Still Not Working?

1. Check VS Code version (should be recent)
2. Check Node.js version (project wants 20.19.2)
3. Check pnpm version: `pnpm --version` (should be 10.8.1)
4. Try restarting VS Code
5. Check for extension conflicts
