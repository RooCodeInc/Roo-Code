# Salesforce Profile Management

## Profile Mapping and Retrieval (new recommended flow)

When the user asks to "create a profile" or to "create from <source profile>", follow this recommended, deterministic flow:

1. Retrieve the list of Profile metadata from the org using the CLI and store it in the workspace.

    ```bash
    # Run this to list profile metadata in JSON format and save into profiles.json
    sf org list metadata -m Profile --json > profiles.json
    ```

    Notes:

    - This command uses the Salesforce CLI SLI (`sf org list metadata`) to produce a JSON list of available Profile metadata in the target org.
    - Saving the output to `profiles.json` ensures you have an up-to-date authoritative mapping between the friendly names and the backend metadata names.

2. Inspect `profiles.json` to understand the available profiles and their exact API/backend names.

3. Map the user-provided profile name to the exact `fullName` in `profiles.json`.

    - Use an exact match when possible. If the user uses a friendly/display name (for example, "System Administrator"), implement a mapping or a small fuzzy-match routine that compares the user input against `fullName` and `fileName` values from `profiles.json` and returns the closest match.

    - Example mapping logic (shell/Node pseudocode):

        ```bash
        # extract fullNames into a plain list
        jq -r '.result[].fullName' profiles.json > profile-names.txt

        # do case-insensitive search or fuzzy match to find the best candidate
        # (implement in Node.js or a small script to return the closest fullName)
        ```

4. Once you have the correct backend `fullName` for the source profile, retrieve the profile metadata file into your local source tree (if not already retrieved).

    - Use the <retrieve_sf_metadata> tool with metadata_type "Profile" and metadata_name "<FULL_NAME>" to retrieve the specific profile
    - Replace `<FULL_NAME>` with the exact backend name you mapped from `profiles.json`.

5. Copy or clone the retrieved profile file to create the new profile XML file. Use relative paths and keep the metadata filename consistent with the new profile `fullName` you plan to deploy.

    ```bash
    # Example: copy retrieved Admin.profile-meta.xml to NewProfile.profile-meta.xml
    copy force-app/main/default/profiles/Admin.profile-meta.xml force-app/main/default/profiles/NewProfile.profile-meta.xml
    ```

6. Update the new profile XML content if needed (display name, permissions, layout assignments, etc.).

## ⚠️ MANDATORY DEPLOYMENT (!!**CRITICAL - MUST FOLLOW EVERY TIME**)

**AFTER EVERY PROFILE CREATION, YOU MUST IMMEDIATELY DEPLOY USING `<sf_deploy_metadata>` TOOL**

**THIS IS NOT OPTIONAL. THIS STEP MUST NOT BE SKIPPED UNDER ANY CIRCUMSTANCES.**

### Strict Deployment Rules

- (**!CRITICAL**) **You MUST use the `<sf_deploy_metadata>` tool for ALL profile deployments**
- (**!CRITICAL**) **Do NOT skip this step - deployment is MANDATORY after every profile creation**
- (**!CRITICAL**) **Provide all profile metadata files to the tool at once for batch deployment**
- The tool will automatically handle both dry-run validation and actual deployment
- If there are any errors during validation, the tool will report them - fix and retry the deployment
- After successful deployment, all profiles will be available in the Salesforce org

**MUST DO THIS AFTER EVERY SINGLE PROFILE - NO EXCEPTIONS**

8. Confirm deployment success and update `profiles.json` (rerun step 1) to keep the mapping file current.

9. When interacting with users (chat or CLI), always run step 1 automatically if `profiles.json` is missing or older than a configurable TTL (for example, 24 hours). This keeps names in sync with the org and avoids ambiguous profile-name issues.
