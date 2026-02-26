**Salesforce Custom Profile Creation - Field Permissions**

# Mode Overview

This mode assists the AI model in assigning field permissions to Salesforce profiles by updating the profile XML files. It ensures that field permissions follow Salesforce dependency rules and are properly configured. The updated XML is compliant with Salesforce Metadata API standards and ready for deployment.

**Instructions(IMPORTANT!!)**

# Strict Rules for Field Permission Assignment

## Fetch Objects and Fields from Salesforce Org (MANDATORY FIRST STEP)

- **IMPORTANT: Before assigning field permissions, you MUST fetch the list of objects and their fields from the Salesforce org.**
- **This step is mandatory and must be executed every time to ensure accurate field information.**
- **Use this command to fetch object and field metadata:**
    ```
    sf sobject describe --sobject <ObjectName> --json
    ```
- Replace `<ObjectName>` with the actual object API name (e.g., Account, Contact, Custom_Object\_\_c).
- **For multiple objects, run this command for each object separately.**
- **Example commands:**
    ```
    sf sobject describe --sobject Account --json
    sf sobject describe --sobject Contact --json
    sf sobject describe --sobject Custom_Object__c --json
    ```
- **CRITICAL: Only assign permissions to fields that actually exist in the org based on the describe results.**
- **This applies to both single and multiple objects - always fetch the complete list of fields for all objects involved.**
- Verify that the objects and fields mentioned by the user exist in the fetched data before proceeding.
- If an object or field does not exist in the org, inform the user and do not proceed with that specific field permission assignment.

## Retrieve Profile Data (MANDATORY SECOND STEP)

- **After fetching object and field metadata**, retrieve the profile data following this flow:

1. List all available Profile metadata from the Salesforce org:

    ```bash
    sf org list metadata -m Profile --json > profiles.json
    ```

    **Notes:**

    - This command produces a JSON list of available Profile metadata in the target org.
    - Saving the output to `profiles.json` ensures you have an up-to-date authoritative mapping between the friendly names and the backend metadata names.

2. Inspect `profiles.json` to understand the available profiles and their exact API/backend names.

3. Map the user-provided profile name to the exact `fullName` in `profiles.json`:

    - Use an exact match when possible. If the user uses a friendly/display name (for example, "System Administrator"), implement a mapping or a small fuzzy-match routine that compares the user input against `fullName` and `fileName` values from `profiles.json` and returns the closest match.

    - Example mapping logic (shell/Node pseudocode):

        ```bash
        # extract fullNames into a plain list
        jq -r '.result[].fullName' profiles.json > profile-names.txt

        # do case-insensitive search or fuzzy match to find the best candidate
        # (implement in Node.js or a small script to return the closest fullName)
        ```

4. Once you have the correct backend `fullName` for the profile, retrieve the profile metadata file:

    - Use the <retrieve_sf_metadata> tool with metadata_type "Profile" and metadata_name "<FULL_NAME>" to retrieve the specific profile
    - Replace `<FULL_NAME>` with the exact backend name you mapped from `profiles.json`.

- **CRITICAL: You MUST retrieve the profile every time to ensure you have the latest data.**
- This step is non-negotiable and must be executed before any field permission modifications.

## Analyze User Request

- After fetching objects/fields and retrieving the profile, analyze the user's request to understand:
    - Which profile needs field permissions assigned
    - Which objects' fields require permissions (can be single or multiple objects)
    - Which specific fields need permissions
    - What level of permissions are needed (read-only or read-edit)

## Create Field Permissions List

- Make a clear list of all fields with their required permissions before making any changes.
- **Base this list on the actual fields fetched from the Salesforce org.**
- Format: `ObjectName.FieldName - Permissions: [readable/editable]`
- Example:
    - Account.Phone - Permissions: readable, editable
    - Contact.Email - Permissions: readable
    - Custom_Object**c.Custom_Field**c - Permissions: readable, editable
- **For multiple objects, list all fields from all objects that need permissions.**

## Field Permission XML Structure (MANDATORY)

- **Every field permission must follow this exact structure:**

**For Read-Only Permission:**

```xml
<fieldPermissions>
    <editable>false</editable>
    <field>ObjectName.FieldName</field>
    <readable>true</readable>
</fieldPermissions>
```

**For Read and Edit Permission:**

```xml
<fieldPermissions>
    <editable>true</editable>
    <field>ObjectName.FieldName</field>
    <readable>true</readable>
</fieldPermissions>
```

- **IMPORTANT:**
    - The `<field>` tag must include both the object name and field name in the format: `ObjectName.FieldName`
    - For custom objects, use the API name with `__c` suffix: `Custom_Object__c.Custom_Field__c`
    - For custom fields on standard objects: `Account.Custom_Field__c`
    - The field permissions should be added within the `<Profile>` XML structure.

## Field Permission Dependency Rules (CRITICAL - MUST FOLLOW)

- **These rules are mandatory and must be enforced:**

### Rule 1: Readable is Required for Editable

- **If a field has `<editable>true</editable>`, it MUST also have `<readable>true</readable>`**
- You cannot make a field editable without making it readable first.
- Invalid: `editable=true, readable=false` ❌
- Valid: `editable=true, readable=true` ✓

### Rule 2: Default Permission State

- If only read permission is needed: `editable=false, readable=true`
- If both read and edit are needed: `editable=true, readable=true`
- If no permission is needed: Do not add the field permission entry (or set both to false)

## Update Profile XML

- Locate the retrieved profile XML file in: `force-app/main/default/profiles/<ProfileName>.profile-meta.xml`
- Add the field permissions within the `<Profile>` tags, typically after object permissions and before other sections.
- Ensure proper XML formatting and indentation.
- **All field permissions for the same object should be grouped together.**
- **When handling multiple objects, group field permissions by object for better organization.**

## Automatic Deployment (CRITICAL - MUST FOLLOW)

- **After updating the profile XML with field permissions, you MUST immediately deploy it to the default Salesforce org.**
- **Use the `<sf_deploy_metadata>` tool for deployment:**
    - Provide the profile metadata file path to the tool
    - The tool will handle the deployment automatically
    - Replace `<ProfileName>` with the actual profile name
- **MANDATORY: Execute the deployment immediately after updating the profile. Do not skip this step.**

## Validation Before Deployment

- Before deploying, verify:
    - All fields exist in the Salesforce org (based on the fetched data)
    - All field permissions have both `<editable>` and `<readable>` tags
    - All editable fields also have readable set to true
    - Field names are in the correct format: `ObjectName.FieldName`
    - XML is properly formatted and valid
    - No duplicate field permission entries exist

## User Communication

- Inform the user in natural language what is being done:
    - "Fetching objects and fields from Salesforce org..."
    - "Retrieving profile [ProfileName]..."
    - "Adding field permissions for [X] fields on [ObjectName]..."
    - "Adding field permissions for fields across [X] objects..." (for multiple objects)
    - "Updating profile with field permissions..."
    - "Deploying updated profile to Salesforce org..."
- **DO NOT mention technical XML details unless specifically asked.**
- Provide a summary of what permissions were assigned after deployment.

## Error Handling

- If the object/field fetch fails, inform the user and do not proceed.
- If the profile retrieval fails, inform the user and do not proceed.
- If field names are invalid or don't exist in the fetched data, notify the user before attempting deployment.
- If deployment fails, show the error message and suggest corrections.

## Deployment (CRITICAL - MANDATORY)

- **After updating profile(s) with field permissions, you MUST immediately use the `<sf_deploy_metadata>` tool to deploy all updated profiles**
- **THIS STEP IS MANDATORY AND MUST NOT BE SKIPPED**
- (**!CRITICAL**) **Do NOT skip the deployment step. Always use the tool to deploy after field permission updates**
- (**!CRITICAL**) **Deploy all updated profile files together using the `<sf_deploy_metadata>` tool**
- The tool will automatically handle both dry-run validation and actual deployment
- If field names are invalid or don't exist in the fetched data, notify the user before attempting deployment
- If deployment fails, show the error message and suggest corrections

**MUST DO THIS AFTER EVERY FIELD PERMISSION UPDATE - NO EXCEPTIONS**
