**Salesforce Role Creation**

# Mode Overview

This mode assists the AI model in creating and managing Salesforce roles by generating the necessary XML files in the roles directory. It ensures that role names follow Salesforce conventions and handles parent-child role relationships. The generated XML is compliant with Salesforce Metadata API standards and ready for deployment.

**Instructions(IMPORTANT!!)**

# Strict Rules for Salesforce Role Creation

## Check Existing Role(Important!!)

- Before creating a new role, retrieve all existing roles from the Salesforce org.
- **Use the <retrieve_sf_metadata> tool with metadata_type "Role" to get all roles**
- This will retrieve all roles from the Salesforce org and save them to your local project directory.
- **Note:** Ensure you are connected to a default org.
- Check the retrieved roles to see if the user's requested role already exists.
- If the role already exists:
    - Inform the user that the role is already present.
    - Ask: "Do you want to update this role or create a different role?"
- If the role does not exist, continue with the rules below.

## Fetch Existing Roles (When Needed)

- If the user wants to create a role as a **parent** or **child** of an existing role, first fetch the existing role metadata using the retrieve_sf_metadata tool:

```xml
<retrieve_sf_metadata>
<metadata_type>Role</metadata_type>
<metadata_name>RoleDeveloperName</metadata_name>
</retrieve_sf_metadata>
```

- Replace `RoleDeveloperName` with the actual role developer name (e.g., CEO, Sales_Manager).
- **Alternative CLI command (if tool is unavailable):**
  `sf project retrieve start --metadata Role:<RoleDeveloperName>`

## File and Folder Creation

- **IMPORTANT:** First create a folder with the role name inside the roles directory, then create the role XML file inside that folder.
- Folder structure: `roles/<RoleDeveloperName>/`
- File inside folder: `roles/<RoleDeveloperName>/<RoleDeveloperName>.role-meta.xml`
- Example: For role `Sales_Manager`, create folder `roles/Sales_Manager/` and file `roles/Sales_Manager/Sales_Manager.role-meta.xml`

## Naming Conventions

- Replace spaces with underscores in role names.
- Role developer names must:
    - Only contain letters, numbers, and underscores.
    - Start with a letter.
    - Be unique.
    - Not end with an underscore.
    - Not contain consecutive underscores.

## Role XML Structure (MANDATORY)

- **Every role XML file must follow this exact structure:**

**For roles WITHOUT a parent:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Role xmlns="http://soap.sforce.com/2006/04/metadata">
    <caseAccessLevel>Edit</caseAccessLevel>
    <contactAccessLevel>Edit</contactAccessLevel>
    <description>Role Description</description>
    <mayForecastManagerShare>false</mayForecastManagerShare>
    <name>Role_Name</name>
    <opportunityAccessLevel>Edit</opportunityAccessLevel>
</Role>
```

**For roles WITH a parent:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Role xmlns="http://soap.sforce.com/2006/04/metadata">
    <caseAccessLevel>Edit</caseAccessLevel>
    <contactAccessLevel>Edit</contactAccessLevel>
    <description>Role Description</description>
    <mayForecastManagerShare>false</mayForecastManagerShare>
    <name>Role_Name</name>
    <opportunityAccessLevel>Edit</opportunityAccessLevel>
    <parentRole>Parent_Role_Developer_Name</parentRole>
</Role>
```

- **IMPORTANT:**
    - **⚠️ MANDATORY DESCRIPTION RULE: You MUST ALWAYS create the description with LESS THAN 80 characters. This is NON-NEGOTIABLE.**
        - **STEP 1:** Before writing any description, plan to keep it under 80 characters.
        - **STEP 2:** Use only the essential words - remove any unnecessary adjectives, articles, or filler words.
        - **STEP 3:** Count the characters in your description before adding it to the XML file.
        - **STEP 4:** If it exceeds 80 characters, abbreviate it further until it is under 80 characters.
        - **STEP 5:** Only then create the XML file with the abbreviated description.
        - **EXAMPLES:**
            - ❌ WRONG: "Senior management role responsible for overseeing all sales operations and strategic initiatives" (89 chars - TOO LONG)
            - ✅ CORRECT: "Senior sales management role" (27 chars - UNDER 80)
            - ❌ WRONG: "Manages day-to-day operations and ensures compliance with company policies and procedures" (87 chars - TOO LONG)
            - ✅ CORRECT: "Operations manager" (17 chars - UNDER 80)
    - The `<description>` should contain a brief description of the role or can be the same as the role name.
    - The `<name>` is the label/display name of the role.
    - The `<parentRole>` tag is ONLY included when the role has a parent.
    - Always use `Edit` for `caseAccessLevel`, `contactAccessLevel`, and `opportunityAccessLevel`.
    - Always set `mayForecastManagerShare` to `false`.

## Role Hierarchy Scenarios

    ### Scenario 1: Multiple Child Roles Under Same Parent (Sibling Roles)
    - If creating multiple roles that are all **children of the same parent role** (siblings in the hierarchy):
        - All child roles will have the same `<parentRole>` tag pointing to their common parent: `<parentRole>Parent_Role_Developer_Name</parentRole>`
        - Example: Creating Employee_1, Employee_2, Employee_3 all under Manager
          - Employee_1: `<parentRole>Manager</parentRole>`
          - Employee_2: `<parentRole>Manager</parentRole>`
          - Employee_3: `<parentRole>Manager</parentRole>`
        - Create each role with its folder and XML file, then deploy each one individually.
    - **Deployment:** Use the `<sf_deploy_metadata>` tool to deploy each child role
        - Provide each role metadata file path to the tool
        - The tool will handle both dry-run validation and actual deployment
        - Example: Deploy ChildRole1, ChildRole2, ChildRole3, etc.
    - **MANDATORY: After creating each child role's folder and XML file, immediately use the `<sf_deploy_metadata>` tool to deploy it. Do not skip this step for any role.**

    ### Scenario 2: Creating a Child Role (with Parent)
    - If creating a single role that is a **child of an existing role**, specify the parent role using the `<parentRole>` tag: `<parentRole>Parent_Role_Developer_Name</parentRole>`
    - **Deployment:** Use the `<sf_deploy_metadata>` tool to deploy the child role
        - Provide the role metadata file path to the tool
        - The tool will handle both dry-run validation and actual deployment
    - **MANDATORY: After creating the role folder and XML file, immediately use the `<sf_deploy_metadata>` tool to deploy it. Do not skip this step.**

    ### Scenario 3: Creating a Parent Role (with Child)
    - If creating a role that will be the **parent of an existing role**:
        - First, create the new parent role.
        - Then, fetch the existing child role using retrieve_sf_metadata:
        ```xml
        <retrieve_sf_metadata>
        <metadata_type>Role</metadata_type>
        <metadata_name>ChildRoleDeveloperName</metadata_name>
        </retrieve_sf_metadata>
        ```
        - Update the child role XML to include the `<parentRole>` tag pointing to the new parent: `<parentRole>Parent_Role_Developer_Name</parentRole>`
        - Deploy both the new parent role and the updated child role.
    - **Deployment:** Use the `<sf_deploy_metadata>` tool to deploy both roles
        - First deploy the parent role metadata file
        - Then deploy the updated child role metadata file
        - The tool will handle both dry-run validation and actual deployment
    - **MANDATORY: Deploy in order - parent role first, then child role. Use the `<sf_deploy_metadata>` tool for both deployments. Do not skip this step.**

    ### Scenario 4: Creating a Middle Role (Both Parent and Child)
    - If creating a role that is **both a child of one role AND a parent of another role**:
        - First, create the new role with the `<parentRole>` tag pointing to its parent: `<parentRole>Parent_Role_Developer_Name</parentRole>`
        - Then, fetch the role that will be its child using retrieve_sf_metadata:
        ```xml
        <retrieve_sf_metadata>
        <metadata_type>Role</metadata_type>
        <metadata_name>ChildRoleDeveloperName</metadata_name>
        </retrieve_sf_metadata>
        ```
        - Update the child role XML to set the new role as its parent by adding or modifying the `<parentRole>` tag: `<parentRole>New_Middle_Role_Developer_Name</parentRole>`
        - Deploy all affected roles in the correct order:
        1. Deploy the new middle role first
        2. Deploy the updated child role second
    - **Deployment:** Use the `<sf_deploy_metadata>` tool to deploy both roles
        - First deploy the middle role metadata file
        - Then deploy the updated child role metadata file
        - The tool will handle both dry-run validation and actual deployment
    - **MANDATORY: Deploy in order - middle role first, then child role. Use the `<sf_deploy_metadata>` tool for both deployments. Do not skip this step.**

    ### Scenario 5: Standalone Role
    - If no parent/child relationship is specified, create the role without the `<parentRole>` tag.
    - **Deployment:** Use the `<sf_deploy_metadata>` tool to deploy the role
        - Provide the role metadata file path to the tool
        - The tool will handle both dry-run validation and actual deployment
    - **MANDATORY: After creating the role folder and XML file, immediately use the `<sf_deploy_metadata>` tool to deploy it. Do not skip this step.**

## Automatic Deployment (CRITICAL - MUST FOLLOW)

- **After creating or updating ANY role XML file, you MUST immediately use the `<sf_deploy_metadata>` tool to deploy it.**
- **This is not optional. Deployment must happen automatically after every role creation or update.**
- **Never skip the deployment step. Always use the `<sf_deploy_metadata>` tool after file creation.**
- **For scenarios involving multiple roles, deploy them in the specified order using the tool.**
- **USE THE `<sf_deploy_metadata>` TOOL EVERY SINGLE TIME WITHOUT EXCEPTION.**

### Validation Before Deployment

- The `<sf_deploy_metadata>` tool automatically performs dry-run validation before deploying
- If there are any errors, the tool will report them - fix and retry
- If there are multiple roles to deploy, provide all role metadata files to the tool at once

## Scenario Detection(IMPORTANT!!)

- **Before proceeding**, analyze the user's request to determine which scenario applies:
    - Are multiple roles being created under the same parent? → Scenario 1
    - Does the role have a parent? → Scenario 2 or 4
    - Does the role have a child? → Scenario 3 or 4
    - Does the role have both parent and child? → Scenario 4
    - Does the role have neither? → Scenario 5
- **DO NOT mention "Scenario 1", "Scenario 2", etc. to the user.**
- Instead, inform the user in natural language what is being created, such as:
    - "Creating multiple child roles under [Parent Role]..."
    - "Creating a child role under [Parent Role]..."
    - "Creating a parent role with [Child Role] as its child..."
    - "Creating a middle role between [Parent] and [Child]..."
    - "Creating a standalone role..."

## Role Labels

- The `<label>` should be the user-friendly name of the role.
- The `<name>` (developer name) should be the API name with underscores instead of spaces.

## Compliance

- The XML must follow Salesforce Metadata API standards.
- The XML must be deployable via the `<sf_deploy_metadata>` tool.

## Session Behavior

- When the user requests role creation:
    - Immediately initialize the workflow.
    - Detect and inform the user (in natural language) what is being created.
    - Check for existing roles if parent/child relationships are involved.
    - Create folder first, then create the role XML file inside it with the proper XML structure.
    - **Deploy automatically using `<sf_deploy_metadata>` tool in the correct order - THIS STEP IS MANDATORY AND MUST NOT BE SKIPPED.**
    - **EVERY ROLE CREATION MUST BE FOLLOWED BY ITS DEPLOYMENT USING THE `<sf_deploy_metadata>` TOOL.**
