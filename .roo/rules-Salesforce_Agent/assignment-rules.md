# Salesforce Assignment Rules — Full Workflow (with Queue Creation)

This workflow automates creation and deployment of Assignment Rules in Salesforce using the Salesforce CLI.
It supports creating a new Queue dynamically if it does not already exist.

All commands use the `sf` CLI.

## 0. Check Existing Assignment Rules (RECOMMENDED FIRST STEP)

Before creating new assignment rules, retrieve existing assignment rules from the Salesforce org:

- **Use the <retrieve_sf_metadata> tool with metadata_type "AssignmentRules" to retrieve all assignment rules**
- This will retrieve all assignment rules from all objects in the org
- **IMPORTANT: Check if there is an ACTIVE assignment rule on the target object**
- After retrieval, read the assignment rules file for the object: `force-app/main/default/assignmentRules/<ObjectApiName>.assignmentRules-meta.xml`
- Look for any `<assignmentRule>` with `<active>true</active>` tag
- If an active assignment rule exists:
    - Inform the user: "An active assignment rule already exists for [ObjectName]"
    - Show the existing rule details (rule name, assigned to)
    - Ask: "Do you want to deactivate the existing rule and create a new active rule?"
    - **If user says YES:**
        - Set the existing rule's `<active>` tag to `false`
        - Create the new rule with `<active>true</active>`
    - **If user says NO:**
        - Create the new rule with `<active>false</active>` (inactive)
        - Inform the user they can activate it later from Salesforce Setup
- If no active assignment rule exists:
    - Continue with creating the new rule as active
- **Note:** Only one assignment rule can be active per object at a time

## 1. Prompt: Gather Minimal Inputs

When user enters to prompt gather

1.  Object API name for which the rule should be created
2.  Generate Rule Developer Name (must start with letter, may include letters, numbers, underscores)
3.  Ask Whether to assign to a User or Queue (U/Q)
4.  Ask Whether to include an Email Template (yes/no)

## 2. Retrieve All Active Users

When he want to assign to users (U)
Run:
sf data query --query "SELECT Id, Name, Username, Email FROM User WHERE IsActive = true ORDER BY Name" --json

Parse the JSON output.  
Build a `users[]` array and display a numbered list showing Name, Username, Email, and Id.  
Show the total record count at the top.

## 3. Retrieve All Queues

When he wants to assign to Queue(Q)
Run:
sf data query --query "SELECT Id, QueueName, DeveloperName FROM Group WHERE Type = 'Queue' ORDER BY QueueName" --json

Parse the JSON output.  
Build a `queues[]` array and display a numbered list showing QueueName, DeveloperName, and Id.  
Show the total record count at the top.  
Add a final option labeled “Create a new Queue”.
When final option selected “Create a new Queue” THEN :

## Queue Creation Flow

Before creating queue ask user weather they want to create a new queue or not if they want to then create a new queue or not.
(!IMPORTANT) Deploy the queue immediatly after creating.

### Prompt for Basic Queue Details

Ask the user for:

- Queue Label
- Developer Name (auto-generate from label if not provided)
- Object(s) the queue should support
- Ask which types of members to include:
    - Users (U)
    - Public Groups (P)
    - Roles (R)
    - Roles and Subordinates

Validate that the Developer Name is unique compared to existing queues.

For each chosen type:

## If Users,

Fetch all users by
Run:
sf data query --query "SELECT Id, Name, Username, Email FROM User WHERE IsActive = true ORDER BY Name" --json

## If Public Groups,

query:
sf data query --query "SELECT Id, Name, DeveloperName FROM Group WHERE Type = 'Regular'" --json
Display numbered list, prompt for one or more group numbers.

## If Roles,

query:
sf data query --query "SELECT Id, Name FROM UserRole ORDER BY Name" --json
Display list and prompt for selections.

For each selected type, retrieve available options using CLI and prompt for one or more selections.  
Store the selected members in `queueMembers[]` with `memberType` and `memberValue`.

First ask what they want to choose either Users or Public Groups or Roles then only create XML.

### Generate Queue XML

## Example XML Structure if queue members are users:

<?xml version="1.0" encoding="UTF-8"?>
<Queue xmlns="http://soap.sforce.com/2006/04/metadata">
    <doesSendEmailToMembers>false</doesSendEmailToMembers>
    <name>new</name>
    <queueMembers>
        <users>
            <user>saisuhas30@gmail.com</user>
            <user>suhas45@salesforce.com</user>
        </users>
    </queueMembers>
    <queueSobject>
        <sobjectType>Case</sobjectType>
    </queueSobject>
</Queue>

## Example XML Structure if queue members are public groups:

<?xml version="1.0" encoding="UTF-8"?>
<Queue xmlns="http://soap.sforce.com/2006/04/metadata">
    <doesSendEmailToMembers>false</doesSendEmailToMembers>
    <name>new</name>
    <queueMembers>
        <publicGroups>
            <publicGroup>group1</publicGroup>
        </publicGroups>
    </queueMembers>
    <queueSobject>
        <sobjectType>Case</sobjectType>
    </queueSobject>
</Queue>

Create the file path:
force-app/main/default/queues/<DeveloperName>.queue-meta.xml

Use the XML structure:

<?xml version="1.0" encoding="UTF-8"?> <Queue xmlns="http://soap.sforce.com/2006/04/metadata"> <label>{QueueLabel}</label> <developerName>{DeveloperName}</developerName> <queueSobject> <sobject>{ObjectApiName}</sobject> </queueSobject> <queueMembers> {QUEUE_MEMBER_BLOCKS} </queueMembers> </Queue> ```

Each member block:

<queueMembers>
  <member>{MemberValue}</member>
  <memberType>{MemberType}</memberType>
</queueMembers>

### Deploy the Queue (!IMPORTANT)

** Immediatly after creating the queue deploy it to current authorized org( WITHOUT ANY DELAY) **
Deploy the queue before creating the assignment rule:

sf project deploy start --source-dir force-app/main/default/queues/<DeveloperName>.queue-meta.xml --json
On successful deployment:
Set assignedToType = "Queue"
Set assignedToValue = DeveloperName
If deployment fails, display the full CLI error and stop execution.

## 4. Retrieve Email Templates

When user says yes to include email template then :
Ask user wheather he want to assign an email template or not if he wants to then retreive all of them and show to user in numbering format so that user cna select one.
If the user selected “yes” for including an Email Template, run:
sf data query --query "SELECT Id, DeveloperName, FolderName FROM EmailTemplate ORDER BY FolderName, DeveloperName" --json

Parse the output into `templates[]` and display a numbered list showing FolderName and DeveloperName.

## 5. Selection and Validation

- If assignment type is User:

    - Prompt for user number from the list.
    - Validate the selected number is within range.
    - Set `assignedToType = "User"`.
    - Set `assignedToValue = users[selected].Username`.

- If assignment type is Queue:
    - Prompt for queue number from the list.
    - Validate selection.
    - If an existing queue is selected:
        - Set `assignedToType = "Queue"`.
        - Set `assignedToValue = queues[selected].DeveloperName`.
    - If “Create a new Queue” option is selected:
        - Proceed with the Queue Creation flow.

## 6. Collect Criteria

Prompt the user for:
Field that triggers the rule (must include Object prefix)
Operation type
Comparison value
Whether to add another criterion
Repeat until all criteria are collected.
Store them in an ordered list criteria[].

## 7. Confirm Summary and Generate Assignment Rule XML

Display summary including:
Object API name
Rule Developer Name
Assignment details
Criteria list
Email Template if applicable
Ask the user to confirm before deployment.

## Create XML file at:

force-app/main/default/assignmentRules/<ObjectApiName>.assignmentRules-meta.xml

## XML structure:

<?xml version="1.0" encoding="UTF-8"?>
<AssignmentRules xmlns="http://soap.sforce.com/2006/04/metadata">
  <assignmentRule>
    <fullName>{RuleDeveloperName}</fullName>
    <active>true</active>
    <ruleEntry>
      <assignedTo>{ASSIGNED_TO_VALUE}</assignedTo>
      <assignedToType>{ASSIGNED_TO_TYPE}</assignedToType>
      {CRITERIA_BLOCKS}
      {TEMPLATE_BLOCK}
    </ruleEntry>
  </assignmentRule>
</AssignmentRules>

## Each criteria block:

<criteriaItems>
  <field>{Object.Field}</field>
  <operation>{Operation}</operation>
  <value>{Value}</value>
</criteriaItems>

## Optional email template block:

<template>{FolderName/DeveloperName}</template>

## ⚠️ MANDATORY DEPLOYMENT (!!**CRITICAL - MUST FOLLOW EVERY TIME**)

**AFTER EVERY ASSIGNMENT RULE CREATION, YOU MUST IMMEDIATELY DEPLOY USING `<sf_deploy_metadata>` TOOL**

**THIS IS NOT OPTIONAL. THIS STEP MUST NOT BE SKIPPED UNDER ANY CIRCUMSTANCES.**

### Strict Deployment Rules

- (**!CRITICAL**) **You MUST use the `<sf_deploy_metadata>` tool for ALL assignment rule deployments**
- (**!CRITICAL**) **Do NOT skip this step - deployment is MANDATORY after every assignment rule creation**
- (**!CRITICAL**) **Deploy all assignment rule metadata files to the tool at once for batch deployment**
- Provide all `.assignmentRules-meta.xml` files to the tool
- The tool will automatically handle both dry-run validation and actual deployment
- If there are any errors during validation, the tool will report them - fix and retry the deployment
- After successful deployment, all assignment rules will be active in the Salesforce org

**MUST DO THIS AFTER EVERY SINGLE ASSIGNMENT RULE - NO EXCEPTIONS**

## 9. Validations

Rule Developer Name pattern is valid
Field references are in correct Object.Field format
Operation is supported
Selected User is active
Queue Developer Name is valid and unique
Queue and Assignment Rule files are in correct directories
Metadata namespace is correct

## 10. Error Handling

If CLI queries fail, display full error and suggest login verification.
If parsing fails, show raw JSON output.
If invalid selections occur, re-prompt until valid.
If deployment fails, display full error message and file path.
If queue creation fails, do not proceed with assignment rule creation.

## 11. Completion and Reporting

After successful deployment:
Log Object API name, Rule Developer Name, AssignedToType, and AssignedToValue
Include deployment timestamp and status message
Confirm completion to the user

## END OF INSTRUCTIONS
