# **Salesforce Page Layout Field Management**

## **Mode Overview**

This mode assists the AI model in retrieving page layouts for created custom objects and adding newly created custom fields to those page layouts. This ensures that all newly created fields are immediately visible and accessible to users on the object's page layouts after field deployment.

**IMPORTANT: COMPLETE END-TO-END WORKFLOW FOR MULTIPLE OBJECTS AND FIELDS**

This instruction is the FINAL step in a comprehensive workflow that handles multiple objects and fields. When a user requests creation of multiple objects with multiple fields (e.g., 3 objects with 3 fields each), the COMPLETE workflow is:

## **Complete Workflow for Multiple Objects and Fields**

**For EACH Object:**

1. ✓ Create custom object XML
2. ✓ Dry run object deployment
3. ✓ Deploy object
4. ✓ Create custom tab XML
5. ✓ Dry run tab deployment
6. ✓ Deploy tab
7. ✓ Retrieve Admin profile and add tab visibility permission (DefaultOn)
8. ✓ Deploy updated Admin profile

**For EACH Field (on each object):** 9. ✓ Create field XML 10. ✓ Dry run field deployment 11. ✓ Deploy field 12. ✓ Retrieve Admin profile and add field permissions (editable=true, readable=true) 13. ✓ Deploy updated Admin profile

**For ALL Objects and ALL Fields (FINAL STEP):** 14. → **Retrieve page layout for each object** ← _You are here_ 15. → **Add ALL newly created fields to page layout** 16. → **Dry run page layout deployment** 17. → **Deploy page layout** 18. → **Confirm all objects and fields are fully configured**

**This workflow ensures:**

- ✅ All objects are created and deployed
- ✅ All tabs are created, deployed, and visible to Admin
- ✅ All fields are created, deployed, and visible to Admin
- ✅ All fields are added to page layouts (final step)
- ✅ All objects and fields are fully accessible to end users

## **Important Workflow Order**

1. **Create and deploy the custom object and tab** (force-app/main/default/objects/{Object}/ and tabs/{Object}.tab-meta.xml)
2. **Retrieve Admin profile and add object tab permissions** (use object-permissions.md guidelines)
3. **Create and deploy custom fields** (force-app/main/default/objects/{Object}/fields/{Field}.field-meta.xml)
4. **Retrieve Admin profile and add field permissions** (use field-permissions.md guidelines)
5. **Retrieve and update page layouts** (force-app/main/default/layouts/{Object}-{Layout}.layout-meta.xml)

All steps must be completed for objects and fields to be fully accessible to users.

## **Strict Rules for Page Layout Field Management**

### **1. When to Trigger Page Layout Field Addition**

- **After ALL custom fields have been successfully created and deployed** to their respective objects
- **After field deployment confirmation** (post dry-run and deployment) for all fields
- **This is the FINAL step** before considering the entire object/field creation task complete
- Apply this for **EACH object that had fields created**

### **2. Retrieve Page Layout for Target Object**

- Use the `<retrieve_sf_metadata>` tool with:
    - **metadata_type**: "Layout"
    - **metadata_name**: "{ObjectApiName}-{LayoutName}" (e.g., "Invoice\_\_c-Invoice Layout" or "Account-Account Layout")
    - **Do this for EACH object that had fields created**
- Common page layout naming patterns:
    - Standard objects: `{ObjectName}-{ObjectName} Layout` (e.g., `Account-Account Layout`)
    - Custom objects: `{ObjectApiName}-{Custom Name}` (e.g., `Invoice__c-Invoice Layout`)

### **3. Identify Page Layouts to Update**

- Retrieve all available page layouts for the object
- Typically, you should update:
    - **Master-Detail Layout** (the default/main layout)
    - **Role-based layouts** if they exist
    - **Record Type-specific layouts** if applicable
- Inform the user: _"Found {X} page layout(s) for {ObjectName}. I'll add the new fields to: [Layout names]"_

### **4. Page Layout XML Structure**

The page layout XML includes the following key sections:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
  <excludeButtons>...</excludeButtons>
  <layoutSections>
    <customLabel>false</customLabel>
    <detailHeading>true</detailHeading>
    <editHeading>true</editHeading>
    <label>Information</label>
    <layoutColumns>
      <layoutItems>
        <behavior>Readonly</behavior>
        <field>Field_Name__c</field>
      </layoutItems>
    </layoutColumns>
    <layoutColumns>
      <layoutItems>
        <behavior>Edit</behavior>
        <field>Another_Field__c</field>
      </layoutItems>
    </layoutColumns>
  </layoutSections>
  <showEmailCheckbox>false</showEmailCheckbox>
  <showHighlightsPanel>false</showHighlightsPanel>
  <showInteractionLogPanel>false</showInteractionLogPanel>
</Layout>
```

### **5. Adding Fields to Page Layout - SIMPLE APPROACH**

**IMPORTANT RULES:**

- Only add `<layoutItems>` blocks to existing columns
- Do NOT modify, add, or remove `<layoutColumns>` tags
- Do NOT change the `<layoutSection>` structure or attributes
- Do NOT modify section labels, styles, or column configurations
- Keep the entire layout structure exactly as it is

**Steps:**

1. **Find an existing `<layoutColumns>` section** in the page layout
2. **Add each new field as a simple `<layoutItems>` block**:
    ```xml
    <layoutItems>
      <behavior>Edit</behavior>
      <field>{FieldApiName}</field>
    </layoutItems>
    ```
3. **Insert at the end of the existing `<layoutItems>` list** in that column
4. **That's it** - do not modify anything else in the layout

**Behavior Values:**

- `Edit` - For text, number, picklist, lookup, and other editable fields
- `Readonly` - For formula fields and auto-number fields

### **6. Multiple Layout Support**

If the object has multiple page layouts:

- Apply the same simple approach to each layout
- Add the same fields to all layouts you want to update
- Ask the user which layouts to update if multiple exist

### **7. Validation Before Deployment**

Before deploying the updated page layout:

- Verify all field API names are correctly spelled
- Ensure you only added `<layoutItems>` blocks - nothing else changed
- Confirm the XML is valid
- Verify fields exist on the object
- Confirm with the user: _"I'll now add the newly created fields to the page layout: {Field List}"_

### **8. Dry Run and Deployment** (!IMPORTANT)

Use the `<sf_deploy_metadata>` tool to validate and deploy the updated page layout:

**How to Deploy:**

- Provide the page layout metadata file path to the `<sf_deploy_metadata>` tool
- The tool will automatically handle both dry-run validation and actual deployment
- For the deployment, use:
    - `{ObjectApiName}`: The object's API name (e.g., `Invoice__c`)
    - `{LayoutName}`: The page layout name (e.g., `Invoice__c-Invoice Layout`)

**Handle Deployment Errors:**

- If errors occur, the tool will display them to the user
- Most common error: **"Too many columns for section style"** - This means the layout structure was modified
    - **FIX**: Only add `<layoutItems>` blocks, do NOT modify `<layoutColumns>` or `<layoutSection>` structure
- Other common issues:
    - Field API names spelled incorrectly
    - Fields that don't exist on the object
- Correct the errors and retry the deployment using the tool

**Deployment Process:**

The `<sf_deploy_metadata>` tool will:

1. Validate the page layout XML
2. Run a dry-run deployment to check for errors
3. If successful, deploy the updated page layout(s) to the org
4. Deploy all updated layouts at once if multiple exist

### **10. User Communication**

Inform the user at each stage:

**Stage 1 - Retrieval**

- "Retrieving page layout for {ObjectName}..."
- "Found {X} page layout(s): {Layout names}"

**Stage 2 - Modification**

- "Adding {X} newly created field(s) to the page layout(s)..."
- "Fields being added: {Field names and their API names}"

**Stage 3 - Validation**

- "Validating page layout XML structure..."
- "Layout XML is valid and ready for deployment"

**Stage 4 - Deployment**

- "Running dry run on page layout(s)..."
- "Dry run successful. Deploying updated page layout(s)..."
- "Page layout successfully updated with new fields!"

**Final Summary**

- "✓ Page layout for {ObjectName} updated successfully"
- "✓ {X} newly created field(s) are now visible in the page layout"

## **FINAL VERIFICATION - Complete Workflow Summary**

After completing all page layout updates, provide this final comprehensive summary to the user:

### **Workflow Completion Checklist:**

✓ **Phase 1 - Object Creation** (for each object):

- Custom object XML created
- Object validated using `<sf_deploy_metadata>` tool
- Object deployed to org

✓ **Phase 2 - Tab Creation** (for each object):

- Custom tab XML created
- Tab validated using `<sf_deploy_metadata>` tool
- Tab deployed to org
- Tab permission added to Admin profile
- Admin profile deployed

✓ **Phase 3 - Field Creation** (for each field on each object):

- Field XML created
- Field validated using `<sf_deploy_metadata>` tool
- Field deployed to org
- Field permission added to Admin profile
- Admin profile deployed

✓ **Phase 4 - Page Layout Configuration** (for each object with fields):

- Page layout retrieved
- Fields added to page layout
- Page layout validated using `<sf_deploy_metadata>` tool
- Page layout deployed to org

### **Final Status:**

- All {X} custom object(s) created and deployed
- All {Y} custom tab(s) created, deployed, and visible to Admin
- All {Z} custom field(s) created, deployed, and visible to Admin
- All field(s) added to respective page layout(s)
- All configuration changes deployed to Salesforce org

**✅ Objects, tabs, fields, and page layouts are now FULLY CONFIGURED and ACCESSIBLE to end users!**

- "✓ Fields available for end users in: {Layout names}"

### **11. Error Handling**

- If page layout retrieval fails, inform the user and ask for clarification on layout name
- If field doesn't exist on the object, verify the field was created successfully before adding to layout
- If XML formatting errors occur, display the error and suggest corrections
- If deployment fails, show the error message and provide troubleshooting steps

### **12. Compliance**

- Page layout XML must follow Salesforce Metadata API standards
- The updated layout must be deployable via the `<sf_deploy_metadata>` tool
- Field references must match exactly with created field API names
- No special characters or invalid XML syntax allowed

## **⚠️ MANDATORY DEPLOYMENT (!!**CRITICAL - MUST FOLLOW EVERY TIME**)**

**AFTER UPDATING PAGE LAYOUTS WITH FIELDS, YOU MUST IMMEDIATELY DEPLOY USING `<sf_deploy_metadata>` TOOL**

**THIS IS NOT OPTIONAL. THIS STEP MUST NOT BE SKIPPED UNDER ANY CIRCUMSTANCES.**

### Strict Deployment Rules

- (**!CRITICAL**) **You MUST use the `<sf_deploy_metadata>` tool for ALL page layout deployments**
- (**!CRITICAL**) **Do NOT skip this step - deployment is MANDATORY after every page layout update**
- (**!CRITICAL**) **Deploy only the page layout files that were updated - do NOT deploy the entire layouts folder**
- (**!CRITICAL**) **The tool will automatically handle both dry-run validation and actual deployment**
- If there are any errors during validation, the tool will report them - fix and retry the deployment
- After successful deployment, updated page layouts will reflect the new field additions

## **Complete Workflow Integration**

This instruction should be executed as **Step 9 (FINAL MANDATORY STEP)** in the custom field creation process:

1. ✓ Check target object exists
2. ✓ Create field XML file
3. ✓ Assign field permissions
4. ✓ Validate field configuration
5. ✓ Deploy field using `<sf_deploy_metadata>` tool
6. ✓ Confirm field creation
7. ✓ **Retrieve page layout**
8. ✓ **Add fields to page layout**
9. ✓ **Deploy page layout using `<sf_deploy_metadata>` tool (THIS STEP IS MANDATORY - NO EXCEPTIONS)**
10. ✓ **Confirm page layout update**

**This ensures a complete and seamless field creation experience where fields are immediately available in the user interface.**

**MUST DO THIS AFTER EVERY PAGE LAYOUT UPDATE - NO EXCEPTIONS**
