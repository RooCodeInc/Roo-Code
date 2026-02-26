**Salesforce Object Creation**

# Mode Overview

This mode assists the AI model in creating Salesforce objects by generating the necessary XML files in the objects directory. It ensures that object names follow Salesforce conventions. The generated XML is compliant with Salesforce Metadata API standards and ready for deployment.

**IMPORTANT: This workflow supports MULTIPLE OBJECTS AND FIELDS**

- If user requests creation of 3 objects with 3 fields each, this workflow handles all 9 field creations
- ALL steps (creation, dry run, deployment, tabs, permissions, page layout) are executed for EACH object and EACH field
- This is a COMPLETE end-to-end workflow that ensures all objects and fields are fully configured

**Instructions(IMPORTANT!!)**

# Strict Rules for Salesforce Object Creation

## Check Existing Object

- Before creating a new object, check if the object already exists:
    - First, check locally in the objects directory (force-app/main/default/objects/)
    - Also use the <retrieve_sf_metadata> tool with metadata_type "CustomObject" and metadata_name "<ObjectApiName>" to check if the object exists in the Salesforce org
- If the object already exists (either locally or in the org):
    - Inform the user that the object is already present.
    - Ask: "Do you want to create new fields for this object or create a completely new object?"
- If the object does not exist in both locations, continue with the rules below.

## Folder Creation

Always create a folder in the objects directory with the same name as the object.
Example: For object Invoice_Item**c, create folder objects/Invoice_Item**c.

## File Creation

Inside the folder, create the object XML file with this format:
<ObjectApiName>.object-meta.xml
Example: Invoice_Item**c/Invoice_Item**c.object-meta.xml.

## Naming Conventions

- Replace spaces with underscores in object and file names.
    ### objectApiName rules:
    - Only letters, numbers, and underscores allowed.
    - Must start with a letter.
    - Must be unique.
    - Cannot end with an underscore.
    - Cannot contain consecutive underscores.

## Labels and Pluralization

- The label must always be the singular form of the object name.
- The pluralLabel must always be the plural form, unless the word should never be pluralized (e.g., Country, City, Person, Name, Data).
- Examples:
    - Flower → Label: Flower | PluralLabel: Flowers
    - Invoice → Label: Invoice | PluralLabel: Invoices
    - Country → Label: Country | PluralLabel: Country (no pluralization applied)

## Enable Features

- Always set the following to true in the XML definition:
    - enableReports
    - enableActivities
    - enableFeeds
    - enableHistory

## Tab Creation (MANDATORY)

- When creating a custom object you MUST also create a corresponding custom tab. Tab creation is required and cannot be skipped.
- Create the tab file at:

```
force-app/main/default/tabs/<ObjectApiName>.tab-meta.xml
```

- Example minimal Tab XML (replace placeholders):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
    <customObject>true</customObject>
    <motif>Custom53: Bell</motif>
</CustomTab>

```

- Ensure the tab file name and the object API name match the custom object. The tab file must be staged and deployed together with the object and any related metadata.

## Admin Profile Tab Permission Assignment (!!IMPORTANT - MANDATORY)

- **After creating the tab, MUST assign permission to Admin profile with default settings**
- Retrieve the Admin profile using `<retrieve_sf_metadata>` tool with:
    - metadata_type: "Profile"
    - metadata_name: "Admin"
- File location: `force-app/main/default/profiles/Admin.profile-meta.xml`
- Add tab visibility permission with **default settings** (MANDATORY):

```xml
<tabVisibilities>
  <tab>{ObjectApiName}</tab>
  <visibility>DefaultOn</visibility>
</tabVisibilities>
```

**Important:**

- **visibility MUST be set to `DefaultOn`** (mandatory default setting)
- This makes the tab visible by default for Admin users
- Tab API name must match the tab's fullName (e.g., Invoice\_\_c)
- Profile must be deployed together with the tab for complete setup
- Profile metadata name is exactly: "Admin"

## ⚠️ MANDATORY DEPLOYMENT FOR OBJECTS (!!**CRITICAL - MUST FOLLOW EVERY TIME**)

**AFTER EVERY CUSTOM OBJECT CREATION, YOU MUST IMMEDIATELY DEPLOY USING `<sf_deploy_metadata>` TOOL**

**THIS IS NOT OPTIONAL. THIS STEP MUST NOT BE SKIPPED UNDER ANY CIRCUMSTANCES.**

- (**!CRITICAL**) **You MUST use the `<sf_deploy_metadata>` tool for ALL custom object deployments**
- (**!CRITICAL**) **Do NOT attempt to use CLI commands like `sf project deploy start`**
- (**!CRITICAL**) **Provide all object metadata files to the tool at once for batch deployment**
- The tool will automatically handle both dry-run validation and actual deployment
- If there are any errors, the tool will report them - fix and retry the deployment
- After successful deployment, all objects will be available in the Salesforce org

**MUST DO THIS AFTER EVERY SINGLE CUSTOM OBJECT - NO EXCEPTIONS**

## ⚠️ MANDATORY DEPLOYMENT FOR TABS (!!**CRITICAL - MUST FOLLOW EVERY TIME**)

**AFTER EVERY CUSTOM TAB CREATION, YOU MUST IMMEDIATELY DEPLOY USING `<sf_deploy_metadata>` TOOL**

**THIS IS NOT OPTIONAL. THIS STEP MUST NOT BE SKIPPED UNDER ANY CIRCUMSTANCES.**

- (**!CRITICAL**) **You MUST use the `<sf_deploy_metadata>` tool for ALL custom tab deployments**
- (**!CRITICAL**) **Provide all tab metadata files to the tool at once for batch deployment**
- The tool will automatically handle both dry-run validation and actual deployment
- If there are any errors during validation, the tool will report them - fix and retry the deployment
- After successful deployment, all tabs will be visible to Admin users

**MUST DO THIS AFTER EVERY SINGLE CUSTOM TAB - NO EXCEPTIONS**

- Replace `<ObjectApiNames>` with all the objects that are created

## Compliance

- The XML must follow Salesforce Metadata API standards.
- The XML must be deployable via the `<sf_deploy_metadata>` tool.

## Session Behavior

- When the session starts:
  -Immediately initialize the workflow.
  -Begin the object creation process without asking what the user wants.

## Complete Example

Scenario: Creating a "Test" Custom Object
When creating a custom object named "Test", follow these steps:

- Step 1: Folder Structure
  Create the following directory structure:
  force-app/main/default/
  ├── objects/
  │ └── Test**c/
  │ └── Test**c.object-meta.xml
  └── tabs/
  └── Test\_\_c.tab-meta.xml

- Step 2: Object XML File
  File: objects/Test**c/Test**c.object-meta.xml
  xml<?xml version="1.0" encoding="UTF-8"?>
  <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
  <deploymentStatus>Deployed</deploymentStatus>
  <enableActivities>true</enableActivities>
  <enableFeeds>true</enableFeeds>
  <enableHistory>true</enableHistory>
  <enableReports>true</enableReports>
  <label>Test</label>
  <pluralLabel>Tests</pluralLabel>
  <nameField>
  <label>Test Name</label>
  <type>Text</type>
  </nameField>
  <sharingModel>ReadWrite</sharingModel>
  </CustomObject>

- Step 3: Tab XML File
  File: tabs/Test\_\_c.tab-meta.xml
  xml<?xml version="1.0" encoding="UTF-8"?>
  <CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
  <customObject>true</customObject>
  <motif>Custom53: Bell</motif>
  </CustomTab>

- Step 4: Dry Run and Deployment

Use the `<sf_deploy_metadata>` tool for both objects and tabs:

**For Objects:**

- Provide the object metadata file to the `<sf_deploy_metadata>` tool
- Example: `force-app/main/default/objects/Test__c`
- The tool will automatically validate (dry-run) and deploy the object

**For Tabs:**

- Provide the tab metadata file to the `<sf_deploy_metadata>` tool
- Example: `force-app/main/default/tabs/Test__c.tab-meta.xml`
- The tool will automatically validate (dry-run) and deploy the tab
