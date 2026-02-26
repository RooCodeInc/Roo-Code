# REQUIRED INTERACTIVE FLOW FOR RECORD TYPE CREATION

Always follow this step-by-step process when creating a Salesforce Record Type. Do NOT skip any step or deploy before all user selections are confirmed.

1. Initial Prompt

    - When the user asks to create a record type, do NOT create or deploy anything yet.
    - Use the <retrieve_sf_metadata> tool with metadata_type "CustomObject" and metadata_name "<ObjectName>" to retrieve the specific object
    - Check if record types already exist in the recordTypes/ subfolder under force-app/main/default/objects/<ObjectName>/recordTypes/
    - If existing record types are found, display them to the user for awareness
    - Confirm these details with the user:
        - Object API Name
        - Record Type Label
        - DeveloperName (suggest a default, allow edit)
        - Description (optional)
        - Active? (yes/no)

2. Picklist Fields

    - Ask: “Would you like to add any picklist fields to this record type?”
    - If yes:
        - Retrieve all picklist fields for the object.
        - Present a MultiSelect UI for the user to choose picklist fields (show label + API name).

3. Picklist Values

    - For each selected picklist field:
        - Retrieve all possible values.
        - Present a MultiSelect UI for the user to select allowed values for this record type.
        - Allow the user to mark one value as default (optional).

4. Profile Assignment

    - Retrieve all profiles.
    - Present a MultiSelect UI for the user to select which profiles should have access to this record type.
    - For each selected profile, allow the user to mark the record type as default for that profile (optional).

5. Review & Confirmation

    - Show a summary of all selections (object, label, picklists, values, profiles, defaults).
    - Ask the user to confirm before proceeding.

6. Dry-Run Validation

    - Run a dry-run deploy using the Salesforce CLI with the generated XML.
    - If errors occur, show them to the user and allow corrections.

7. Deployment
    - Only after a successful dry-run, deploy the record type and any related business process/profile updates in the correct order.

Key Rules:

- Never skip user confirmation steps.
- Always use MultiSelect UI for picklist fields, values, and profiles.
- Never deploy or create XML until all user selections are confirmed and reviewed.
- Always run a dry-run before deploying.
- File and XML naming must follow the conventions in this document.

# Salesforce Record Type Creation - Complete Instructions (MultiSelect UI)

## Mode overview

This mode assists the AI model in creating and managing Salesforce Record Types by generating the necessary XML files in the recordTypes directory. It enforces Salesforce naming conventions, handles picklist field value management, creates required business processes for Lead/Opportunity/Case objects, and performs dry-run validation before deployment.

Important change: UI interactions that previously relied on free-text parsing (selection-parser) are replaced with a MultiSelect UI control. Use the project's `MultiSelect` component (see apps/web-evals/src/components/ui/multi-select.tsx) to present and gather multi-selection inputs from users in the webview.

---

## High-level flow (strict)

1. User provides the object name and record type name in the initial prompt (e.g., "Create record type Enterprise_Account for Account").
2. Confirm basic details (Object, Record Type Label, DeveloperName, Description, Active?).
3. Ask if the user wants to add picklist fields. If yes: retrieve the object's metadata, extract all picklist fields, and present them in a MultiSelect control.
4. When the user selects one or more picklist fields via the MultiSelect, for each selected field fetch that field's picklist values and present each field's values in sequence using the MultiSelect control (one MultiSelect instance per field shown to the user, or a sequential UI flow showing one field's values at a time).
5. After field value selection is finished, immediately retrieve all profiles and present them in a MultiSelect control for profile assignment.
6. When the user confirms profile selections (and defaults if requested), generate the RecordType XML (and BusinessProcess XML when required), run dry-run validations, and deploy in the required order (BusinessProcess → RecordType → Profiles) only after dry-run success.

Key constraints:

- Do NOT rely on text parsing of user responses to infer selections; use MultiSelect options and onValueChange for deterministic input.
- Always present label + API name in the UI option label, and set the option value to a stable API identifier (for fields: Field API name; for field values: picklist value API/label; for profiles: Profile API name).

---

## Implementation details and UI contract

Minimal contract for each interactive step (inputs/outputs):

- List picklist fields: Inputs — Object API name. Outputs — Array of { label: string, value: string } where label is "{FieldLabel} (API: {FieldAPI})" and value is the Field API name.
- Picklist values for a field: Inputs — Object API name + Field API name. Outputs — Array of { label: string, value: string } where label is "{ValueLabel}" and value is the picklist value API or label (consistent across UI).
- Profiles: Inputs — none (just fetch all profiles). Outputs — Array of { label: string, value: string } where label is the profile name and value is the profile API file name (or profile unique Id/Name used in metadata XML).

Use the project's `MultiSelect` component with the following expectations:

- Component path: `apps/web-evals/src/components/ui/multi-select.tsx`
- Option shape: { label: string, value: string }
- Example usage (webview React code):

```tsx
import { MultiSelect } from "@/components/ui/multi-select"

// fieldsOptions: Array<{label: string, value: string}>
;<MultiSelect
	options={fieldsOptions}
	defaultValue={[]}
	placeholder="Select picklist fields"
	// IMPORTANT: enable commitOnConfirm to require an explicit Confirm (Enter or Confirm button)
	commitOnConfirm={true}
	onConfirm={(selectedFieldApiNames) => {
		// selectedFieldApiNames is string[] of field API names
		// Trigger fetching values for each selected field and show next UI step
	}}
	maxCount={5}
/>
```

Notes:

- Present each option label to users as a readable label that includes both the field label and the API name. Example label: "Industry (API: Industry)" with value: "Industry".
- When presenting picklist values, present label as the displayed picklist value and value as the same or an API-style identifier if available.
- The component supports `commitOnConfirm` (boolean). When true, selections are buffered locally and only sent to the host via `onConfirm` (and `onValueChange`) when the user explicitly confirms by pressing Enter in the search box or clicking the Confirm button in the popover. This prevents a single click selection from immediately sending data to the AI; instead the user can pick multiple items and then press Enter to commit.

---

## Step-by-step UI flow and commands

1. Initial prompt & confirmation

- User: "Create record type Enterprise_Account for Account"
- Bot: Confirm the details (Label: "Enterprise Account", DevName: "Enterprise_Account", Object: "Account"). Ask: "Do you want to add any picklist fields to this record type?"

2. If user says Yes — retrieve picklist fields

- Execute:
    ```powershell
    sf project retrieve start --metadata CustomObject:<ObjectName>
    ```
- Parse the returned object XML (force-app/main/default/objects/<ObjectName>.object-meta.xml) to extract all picklist fields (standard and custom). Build a `fieldsOptions` array with each entry: { label: `${fieldLabel} (API: ${fieldApiName})`, value: fieldApiName }.
- Render a MultiSelect populated with `fieldsOptions`.

3. User selects multiple fields with the MultiSelect

- When `commitOnConfirm` is enabled (recommended), use the `onConfirm` handler to get the final array of selected field API names after the user presses Enter or clicks Confirm. If `commitOnConfirm` is not used, `onValueChange` will be called on each toggle.
- Store the confirmed selected field API names in order and iterate over them.
- For each selected field in sequence, fetch its picklist values (either from the object XML or via metadata retrieval of the specific CustomField if needed) and render a MultiSelect for that field's values. Example option entries: { label: "Agriculture", value: "Agriculture" }.

4. For each field's values MultiSelect

- Allow the user to select multiple picklist values and optionally indicate one default value. To support default selection UI, the UI should allow one value to be marked as default (for example via an additional radio-style control or a simple checkbox that is only allowed for a single selected value). The MultiSelect returns an array of selected values; the UI should ask explicitly if any selected value should be the default for that picklist.

Implementation note: keep the data shape for field values as { fieldApiName: string, values: string[], default?: string }

5. Profile assignment — immediate and required

- After picklist and value selection finishes, attempt to retrieve all profiles with:
    ```powershell
    sf project retrieve start --metadata Profile:*
    ```
- If retrieving all profiles is not possible for performance or metadata access reasons, present a prioritized set of common/important profiles (for example: System Administrator, Standard User, Sales User, Marketing User) plus any other matching profiles fetched.
- Parse profiles and build `profilesOptions`: { label: ProfileName, value: ProfileFileNameOrAPIName }
- Render a MultiSelect with `profilesOptions` (use `commitOnConfirm` here as well to require explicit confirmation). Let the user pick multiple profiles. For any profile the user wants to mark the record type as the default for that object, present a simple per-profile toggle (or ask for defaults after selection). The UI should validate and ensure only one profile per object is marked default if that constraint is required by the metadata usage.

## Business Process Creation (MANDATORY for Lead, Opportunity, Case)

### Detection

**Automatically detect** if the record type is being created for:

- **Lead** object
- **Opportunity** object
- **Case** object

If YES, inform the user:

> "Since you're creating a record type for [Lead/Opportunity/Case], a Business Process is mandatory. Let me help you configure it."

### Business Process Configuration

#### Information to Collect:

1. **Business Process Label**: User-friendly name (e.g., "Enterprise Sales Process")
2. **Business Process Developer Name**: API name (e.g., Enterprise_Sales_Process)
3. **Description**: Brief description
4. **Active Status**: Should be set to `true`

#### Object-Specific Status Fields:

- **For Opportunity**: Use `OpportunityStage` → stageName values
- **For Lead**: Use `LeadStatus` → status values
- **For Case**: Use `CaseStatus` → status values

#### Step-by-Step Process:

##### Step 1: Retrieve Status/Stage Values

**For Opportunity:**

```bash
sf project retrieve start --metadata StandardValueSet:OpportunityStage
```

**For Lead:**

```bash
sf project retrieve start --metadata StandardValueSet:LeadStatus
```

**For Case:**

```bash
sf project retrieve start --metadata StandardValueSet:CaseStatus
```

##### Step 2: Parse Retrieved Values

After successful retrieval, parse the metadata file to extract all available values for the respective field.

##### Step 3: Display Values with Checkboxes

Display the retrieved values to the user:

> "Select the [stages/statuses] for the Business Process:
>
> 1. Value_1
> 2. Value_2
> 3. Value_3
>    ...
>
> Please provide the values you want to include (comma-separated)."

##### Step 4: Set Default Value

Ask the user:

> "Which value should be the default? (Enter one value from the selected list)"

##### Step 5: Collect Selected Values

Store user selections for the business process XML generation.

---

## File and Folder Creation

### Record Type File Structure

- **Folder structure**: `force-app/main/default/objects/<ObjectName>/recordTypes/`
- **File inside folder**: `force-app/main/default/objects/<ObjectName>/recordTypes/<RecordTypeDeveloperName>.recordType-meta.xml`
- **Example**: For record type `Enterprise_Account` on Account object:
    - Path: `force-app/main/default/objects/Account/recordTypes/Enterprise_Account.recordType-meta.xml`

### Business Process File Structure (if required)

- **Folder structure**: `force-app/main/default/objects/<ObjectName>/businessProcesses/`
- **File inside folder**: `force-app/main/default/objects/<ObjectName>/businessProcesses/<BusinessProcessDeveloperName>.businessProcess-meta.xml`
- **Example**: For business process `Enterprise_Sales_Process` on Opportunity:
    - Path: `force-app/main/default/objects/Opportunity/businessProcesses/Enterprise_Sales_Process.businessProcess-meta.xml`

---

### Record Type with Business Process (Lead, Opportunity, Case)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<RecordType xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>RecordTypeDeveloperName</fullName>
    <active>true</active>
    <businessProcess>Business_Process_Developer_Name</businessProcess>
    <description>Record Type Description</description>
    <label>Record Type Label</label>
</RecordType>
```

**IMPORTANT:**

- The `<fullName>` tag MUST be included and contains the record type developer name
- The `<active>` tag determines if the record type is active (true/false)
- The `<description>` should contain a brief description of the record type's purpose
- The `<label>` is the user-friendly display name
- The `<businessProcess>` tag is ONLY included for Lead, Opportunity, and Case objects
- Each picklist field has its own `<picklistValues>` section
- Within each picklist section, individual values are defined with `<default>` indicating if it's the default value

---

## Business Process XML Structure (MANDATORY)

### General Structure (For Lead, Opportunity, and Case)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<BusinessProcess xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>BusinessProcessDeveloperName</fullName>
    <description>Business Process Description</description>
    <isActive>true</isActive>
    <values>
        <fullName>SelectedValue1</fullName>
        <default>false</default>
    </values>
    <values>
        <fullName>SelectedValue2</fullName>
        <default>true</default>
    </values>
    <values>
        <fullName>SelectedValue3</fullName>
        <default>false</default>
    </values>
</BusinessProcess>
```

**For Record Type with Business Process (Lead, Opportunity, Case):**

**Step 1 - Deploy Business Process:**

```bash
sf project deploy start --source-dir force-app/main/default/objects/<ObjectName>/businessProcesses/<BusinessProcessDeveloperName>.businessProcess-meta.xml
```

**Step 2 - Deploy Record Type:**

```bash
sf project deploy start --source-dir force-app/main/default/objects/<ObjectName>/recordTypes/<RecordTypeDeveloperName>.recordType-meta.xml
```

6. Generate metadata XML

- Use the collected inputs to generate the RecordType XML at:
  `force-app/main/default/objects/<Object>/recordTypes/<DevName>.recordType-meta.xml` including:
    - `<fullName>`: `<Object>.<DevName>` (or the required format)
    - `<label>`
    - `<description>`
    - `<active>`
    - For each picklist field configured, include `<picklistValues>` with `<values>` entries and `<default>true</default>` for the chosen default where present.
- If object is Lead/Opportunity/Case and a business process is required, generate the BusinessProcess metadata first.

7. Dry-run and deploy

- Always dry-run before final deploy. Two common deployment approaches exist in Salesforce CLI (source format and manifest format). The "Not in package.xml" error appears when using the metadata/manifest deployment flow without including the RecordType entry in the `package.xml`. To avoid that error, you can either deploy in source format (no package.xml required) or ensure your manifest includes the RecordType member.

### Deployment Process

Use the `<sf_deploy_metadata>` tool to validate and deploy record types:

**How to Deploy:**

- Provide the record type metadata file(s) to the `<sf_deploy_metadata>` tool
- The tool will automatically handle both dry-run validation and actual deployment
- You can deploy:
    - Single record type file
    - Multiple files (BusinessProcess → RecordType → Profiles) at once

**Important Notes:**

- Always validate before deployment using the `<sf_deploy_metadata>` tool
- Ensure the record type metadata includes correct fullName format: `<Object>.<DeveloperName>` (e.g., `Contact.contype001`)
- If deploying profiles with record types, ensure the order is correct: BusinessProcess first, then RecordType, then Profiles
- The tool will automatically handle package.xml generation if needed

- On dry-run success, perform the actual deploy (same commands without `--dry-run`):

````powershell
# source-format deploy
sf project deploy start --source-dir "force-app/main/default/objects/<Object>/recordTypes/<DevName>.recordType-meta.xml"

# manifest deploy
sf project deploy start --manifest "path\to\package.xml"

-- On multi-file deployments that include BusinessProcess (Lead/Opportunity/Case) generate and include BusinessProcess file first, dry-run both, then deploy BusinessProcess, RecordType, and finally Profiles (profile changes should be last).


8) Profile updates (assigning the new record type to profiles)

- After the record type has been generated and dry-run/deployed (or when you want to prepare profile changes for the same deployment), update the selected profile XMLs to include `<recordTypeVisibilities>` entries for the new record type. This step must be performed and deployed so the profile sees the new record type.

- Typical `<recordTypeVisibilities>` snippet to add to a profile XML (note `<recordType>` value is the fullName format `Object.DeveloperName`):

```xml
<recordTypeVisibilities>
    <recordType>Contact.contype001</recordType>
    <visible>true</visible>
    <default>false</default>
</recordTypeVisibilities>
````

- If you want that profile to use the new record type as the default for the object, set `<default>true</default>` and ensure at most one `<recordTypeVisibilities>` with `<default>true</default>` exists per object per profile. If another default exists, set it to `false` before deploying.

- Recommended profile update flow (PowerShell-friendly `sf` commands):

1. Retrieve the profile(s) you plan to update (manifest or wildcard):

```powershell
# retrieve all profiles (may be large) - adjust if needed
sf project retrieve start --metadata "Profile:*"

# or retrieve specific profiles via manifest or explicit files
sf project retrieve start --manifest "path\to\package.xml"
```

2. Edit the downloaded profile XML(s) under `force-app/main/default/profiles/` and add the `<recordTypeVisibilities>` snippet. Keep entries alphabetized by `<recordType>` if your process relies on deterministic ordering.

3. Dry-run the profile deploy together with the record type (if you haven't deployed the RT yet) or just the profile changes:

```powershell
# dry-run profile deploy (source-format)
sf project deploy start --dry-run --source-dir "force-app/main/default/profiles/<ProfileFile>.profile-meta.xml"

# or deploy multiple profiles at once
sf project deploy start --dry-run --source-dir "force-app/main/default/profiles"
```

4. Deploy the profile updates (after dry-run success):

```powershell
sf project deploy start --source-dir "force-app/main/default/profiles/<ProfileFile>.profile-meta.xml"
```

- Important: If the profile references the new record type, ensure the RecordType (and BusinessProcess, if required) are deployed first, then deploy the profiles. If you use a single `--source-dir` that contains both the RecordType and Profile files, the CLI will handle the ordering for you in many cases, but when you encounter dependency errors prefer to deploy RecordType first and Profiles last.

9. File naming and content rules (preventing "Not in package.xml" and related errors)

- Record type metadata file path and filename (source-format canonical):

    - Path: force-app/main/default/objects/<Object>/recordTypes/
    - Filename: <DeveloperName>.recordType-meta.xml
        - Example: `AccountType001.recordType-meta.xml` for DeveloperName `AccountType001`.

- Inside the record type XML, the `<fullName>` MUST be exactly `Object.DeveloperName`:

```xml
<RecordType xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Account.AccountType001</fullName>
    <label>Account Type 001</label>
    <active>true</active>
    <!-- other tags -->
</RecordType>
```

- Common mismatches that cause "Not in package.xml" or member-not-found errors:

    - File named `Account.AccountType001.recordType-meta.xml` instead of `AccountType001.recordType-meta.xml`.
    - `<fullName>` containing an extra `Account.` segment (e.g., `Account.Account.AccountType001`).
    - `package.xml` listing a member that doesn't match the `<fullName>` exactly (case-sensitive match required).
    - Deploying profile files that reference `Account.AccountType001` before the RecordType is deployed.

- DeveloperName rules and recommendations:

    - Use only letters, numbers and underscores for DeveloperName (no spaces, avoid special characters). Recommended: PascalCase or snake_case without leading numbers.
    - DeveloperName is the token used in filenames and package.xml members. Keep it stable and predictable.

- DeveloperName / fullName convention (how to derive the DeveloperName from the Label)

    - The RecordType's internal name (the metadata `<fullName>` or DeveloperName) SHOULD be a normalized form of the Label: replace spaces with underscores and remove any object name prefix. Do NOT include the object API name inside the `<fullName>` tag.
    - Example mapping:
        - Label: "Enterprise Account" → DeveloperName / `<fullName>`: `Enterprise_Account`
        - File name: `Enterprise_Account.recordType-meta.xml` (placed in `force-app/main/default/objects/Account/recordTypes/`)
        - package.xml member (manifest) for this record type: `Account.Enterprise_Account` <-- note this includes the object prefix ONLY in the manifest member
    - Summary: internal `<fullName>` = DeveloperName (Label with spaces→underscores, no object name). package.xml members = `Object.DeveloperName`.

    - Quick examples:

```xml
<!-- inside force-app/main/default/objects/Account/recordTypes/Enterprise_Account.recordType-meta.xml -->
<RecordType xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Enterprise_Account</fullName>
    <label>Enterprise Account</label>
    <active>true</active>
</RecordType>

<!-- package.xml must reference -->
<types>
    <members>Account.Enterprise_Account</members>
    <name>RecordType</name>
</types>
```

    - Following this rule prevents mismatch errors where the package.xml expects `Account.DeveloperName` but the recordType file's `<fullName>` (or filename) doesn't match the DeveloperName used in the manifest.

- `package.xml` member format when using manifest/metadata deploy:

```xml
<types>
    <members>Account.AccountType001</members>
    <name>RecordType</name>
</types>
```

    - The string `Account.AccountType001` must match the `<fullName>` exactly.

- Checklist before running a manifest deploy (quick preflight):

    1. Confirm file exists at `force-app/main/default/objects/Account/recordTypes/AccountType001.recordType-meta.xml`.
    2. Open the file and confirm `<fullName>Account.AccountType001</fullName>`.
    3. If using `package.xml`, confirm it contains `<members>Account.AccountType001</members>` under `<types><name>RecordType</name>`.
    4. If profiles reference the record type, either include the RecordType file in the same `--source-dir` deploy or deploy the RecordType first.
    5. Run a `--dry-run` deploy and address any member mismatch errors before the real deploy.

- Quick PowerShell commands to validate names and run a dry-run (examples):

````powershell
# check file exists
Test-Path "force-app/main/default/objects/Account/recordTypes/AccountType001.recordType-meta.xml"

# simple grep for fullName (PowerShell):
Select-String -Path "force-app/main/default/objects/Account/recordTypes/AccountType001.recordType-meta.xml" -Pattern '<fullName>'

# dry-run source-format
sf project deploy start --dry-run --source-dir "force-app/main/default/objects/Account/recordTypes/AccountType001.recordType-meta.xml"

If you follow the filename and `<fullName>` conventions above the "Not in package.xml" error will not occur when using the manifest approach, and source-format deploys will find the file reliably.

---

## Validation, edge cases and error handling

Edge cases to cover:
- No picklist fields available for the object: present a message and skip field/value selection steps.
- Picklist value mismatch: fetch full metadata and present canonical values; do not accept arbitrary free-text values.
- Retrieval failures: retry with separate `--metadata` flags for each entity.
- Dry-run failures: show error, attempt safe auto-fixes (invalid API name formatting, XML syntax), re-run dry-run. Only deploy once dry-run passes.

Validation rules (UI-driven):
1. MultiSelect options must map to canonical API values. The UI should pass API values to the backend.
2. A single explicit default per picklist field is allowed. If user doesn't provide a default, none is marked.
3. Profile matches must be unique. If a partial name matches multiple profiles, prompt the user to resolve in the UI (e.g., show the narrowed list via MultiSelect).

---

## UI prompt examples and guidance (use these messages in webview)

- After initial confirmation:
    "Would you like to add any picklist fields to this record type? (Select fields from the list)"

- When presenting picklist fields via MultiSelect label example:
    "Industry (API: Industry)"

- After the user selects fields, for each field show:
    "Select values for Industry (API: Industry) — choose one or more values and optionally mark one default."

- After field values selection:
    "Fetching profiles... Select the profiles to which this record type should be visible (and choose defaults if applicable)."

---

## How to wire the MultiSelect in the webview (implementation hints)

- Use `onValueChange` handlers to store arrays of API names/values instead of parsing typed input.
- Example sequence:
    1. Render fields MultiSelect → user selects field API names array.
    2. For each field API name, fetch values and render a MultiSelect (valuesMultiSelect) with options for that field.
    3. Collect selected values and any chosen default for the field.

Code example (conceptual):

```tsx
const [selectedFields, setSelectedFields] = useState<string[]>([])
const [fieldValueSelections, setFieldValueSelections] = useState<Record<string, { values: string[]; default?: string }>>({})

<MultiSelect options={fieldsOptions} commitOnConfirm={true} onConfirm={(v) => setSelectedFields(v)} />

// then for each field in selectedFields:
<MultiSelect options={valuesOptionsForField} commitOnConfirm={true} onConfirm={(v) => setFieldValueSelections(prev => ({ ...prev, [fieldApi]: { values: v } }))} />
// UI should also provide a mechanism to mark one value as default per field
````

---

## Removal of selection-parser

- This document replaces any free-text parsing approach (selection-parser) with deterministic MultiSelect UI components. Remove references to selection-parser in any helper flows that feed these instructions. The webview should never ask the user to type comma-separated or numbered lists for selections that appear in a MultiSelect control.

---

## Confirmation & final summary

After deployment, present a short summary:

- Object: <Object>
- Record Type Label: <Label>
- Developer Name: <DevName>
- Picklist fields configured: [Field API names + selected values with defaults]
- Profiles assigned: [Profile names with default flags]

---

## ⚠️ MANDATORY DEPLOYMENT (!!**CRITICAL - MUST FOLLOW EVERY TIME**)

**AFTER EVERY RECORD TYPE CREATION, YOU MUST IMMEDIATELY DEPLOY USING `<sf_deploy_metadata>` TOOL**

**THIS IS NOT OPTIONAL. THIS STEP MUST NOT BE SKIPPED UNDER ANY CIRCUMSTANCES.**

### Strict Deployment Rules

- (**!CRITICAL**) **You MUST use the `<sf_deploy_metadata>` tool for ALL record type deployments**
- (**!CRITICAL**) **Do NOT skip this step - deployment is MANDATORY after every record type creation**
- (**!CRITICAL**) **Deploy in the correct order: BusinessProcess (#1) → RecordType (#2) → Profiles (#3) if needed**
- (**!CRITICAL**) **The tool will automatically handle both dry-run validation and actual deployment**
- (**!CRITICAL**) **Do NOT deploy the entire metadata folder - deploy only created/modified files**
- If there are any errors during validation, the tool will report them - fix and retry the deployment
- After successful deployment, all record types and business processes will be available in the Salesforce org

**MUST DO THIS AFTER EVERY SINGLE RECORD TYPE - NO EXCEPTIONS**
