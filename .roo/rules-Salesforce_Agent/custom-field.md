# **Salesforce Field Creation**

## **Mode Overview**

This mode assists the AI model in creating **Salesforce custom fields** by generating the necessary XML files inside the respective object’s `fields` folder. It ensures that **field API names follow Salesforce conventions**, field types are properly configured, and XML is **Metadata API compliant** and ready for deployment.
**IMPORTANT: This workflow supports MULTIPLE FIELDS AND MULTIPLE OBJECTS**

- If user requests creation of multiple fields on one object OR fields across multiple objects, this workflow handles all
- ALL steps (creation, dry run, deployment, permissions, page layout) are executed for EACH field
- This is a COMPLETE end-to-end workflow that ensures all fields are fully configured and visible to users
- The workflow sequentially processes: object creation → field creation → permissions → page layout updates → final deployment

## **Strict Rules for Salesforce Field Creation**

### **1. Check Target Object** (IMPORTANT!)

- User may ask to create fields along with object or without object
- Always check if the target object exists:
    - First, check locally in the `objects` directory (force-app/main/default/objects/)
    - Also use the <retrieve_sf_metadata> tool with metadata_type "CustomObject" and metadata_name "<ObjectApiName>" to check if the object exists in the Salesforce org
- (IMPORTANT!)If the object does **not exist** (either locally or in the org):
    - Ask the user:
      _"Which object should I create this field on (e.g., Account, Contact, or Custom Object)?"_
    - If it's a custom object, confirm its API name ends with `__c` (e.g., `Invoice__c`).
- If the object exists, continue with field creation.

### **2. Folder and File Placement**

- Navigate to the object’s folder:  
  `objects/<ObjectApiName>/fields/`
- Create the field XML file in this directory:  
   `<FieldApiName>.field-meta.xml`  
  Example:  
  `objects/Invoice__c/fields/Customer_Type__c.field-meta.xml`

### **3. Field Naming Conventions**

- **Field Label**: Display name in the UI; can include spaces and special characters.
- **Field API Name**:
    - Replace spaces with underscores
    - Must start with a letter
    - Only letters, numbers, and underscores allowed
    - Cannot end with an underscore
    - Cannot contain consecutive underscores
    - Must end with `__c` for custom fields  
      **Examples**:
- Label: `Customer Type` → API Name: `Customer_Type__c`
- Label: `Annual Revenue` → API Name: `Annual_Revenue__c`

### **4. Field Type Selection** (IMPORTANT!)

- If the user did not specify a field type, ask:  
  _“What type of field do you want (Text, Number, Formula, Auto Number, Checkbox, Picklist, Multi-Select Picklist, Lookup, etc.)?”_
- Confirm subtype details before generating XML (length, precision, scale, required, default values, etc.).

### **5. Supported Field Types (Rules + XML Requirements)**

**a. Text Field**
Requires `length` (max 255).

**b. Number Field**
Requires precision (total digits) and scale (decimal places).
Provide user with options

**c. Formula Field**
Requires returnType (Text, Number, Checkbox, Date, etc.) and formula.
Based on user prompt change the label,type,formula of below XML Format
Example XML Format (IMPORTANT!)

   <?xml version="1.0" encoding="UTF-8"?>
   <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
      <fullName>Assign__c</fullName>
      <label>Assign</label>
      <type>Text</type>
      <formula>"Hello World"</formula>
   </CustomField>

**f. Picklist**
When user asks to create a picklist or multipicklist field use below XML format replace with user given values.
<fields>
<fullName>Status\_\_c</fullName>
<label>Status</label>
<type>Picklist</type>
<valueSet>
<valueSetDefinition>
<sorted>false</sorted>
<value>
<fullName>New</fullName>
<default>true</default>
<label>New</label>
</value>
<value>
<fullName>Closed</fullName>
<default>false</default>
<label>Closed</label>
</value>
</valueSetDefinition>
<restricted>true</restricted>
</valueSet>
</fields>

**h. Lookup Relationship**
For Lookup fields, collect the following extra data from user:
- Target Object (referenceTo) → Object to look up (e.g., Account, Contact, Invoice__c)
- Field Label → UI display name
- Field API Name → Ends with __c
- Relationship Label → Related list display name
- Relationship Name → API name for SOQL/Apex

**IMPORTANT: If the user did NOT specify a `<deleteConstraint>` value in their prompt, you MUST ask them which option to use:**
- Present these three choices to the user:
  1. **SetNull** - When parent is deleted, lookup value becomes null (only for optional lookups)
  2. **Restrict** - Prevents parent deletion if child records exist
  3. **Cascade** - When parent is deleted, child records are also deleted

If the user explicitly provided a `<deleteConstraint>` in their prompt, do NOT ask and proceed using the provided value.

So, at minimum you must ask the user for:
- Parent Object
- Field Label
- API Name
- Target Object
- **Delete Constraint** (if not already specified)

**Example XML:**
<fields>
  <fullName>Account_Lookup__c</fullName>
  <label>Account Lookup</label>
  <type>Lookup</type>
  <referenceTo>Account</referenceTo>
  <relationshipLabel>Account</relationshipLabel>
  <relationshipName>Account_Lookup</relationshipName>
  <deleteConstraint>SetNull</deleteConstraint>
  <required>false</required>
</fields>

**Delete Constraint Rules (IMPORTANT)**

**Delete Constraint Rules (IMPORTANT)**

- **Available values:** `SetNull`, `Restrict`, or `Cascade`.
- **Behavior:**
    - `SetNull` — when the parent (referenced) record is deleted, the lookup value on the child is set to null. This is only valid when the lookup field is *not required* (`required=false`).
    - `Restrict` — prevents deletion of the parent record while child records reference it. Use this when you want to block parent deletion rather than null the child.
    - `Cascade` — when the parent record is deleted, child records that reference it are also deleted. Use this when the child should not exist without the parent.
- **Rule:** If the lookup field has `<required>true</required>`, you *must not* set `<deleteConstraint>SetNull</deleteConstraint>`. Instead, use `Restrict` (to block parent deletion) or `Cascade` (to delete children when the parent is deleted) depending on the desired business behaviour. Using `SetNull` with a required lookup will cause deployment/validation errors because the child cannot accept null values.
- **Recommendation:** Default to `SetNull` for optional lookups (`required=false`). For required lookups, choose `Restrict` to prevent orphaning or `Cascade` when child records should be removed with the parent.

**Example — required lookup (Restrict):**
<fields>
<fullName>Account_Lookup__c</fullName>
<label>Account Lookup</label>
<type>Lookup</type>
<referenceTo>Account</referenceTo>
<relationshipLabel>Account</relationshipLabel>
<relationshipName>Account_Lookup</relationshipName>
<deleteConstraint>Restrict</deleteConstraint>
<required>true</required>
</fields>

**Example — required lookup (Cascade):**
<fields>
<fullName>Account_Lookup__c</fullName>
<label>Account Lookup</label>
<type>Lookup</type>
<referenceTo>Account</referenceTo>
<relationshipLabel>Account</relationshipLabel>
<relationshipName>Account_Lookup</relationshipName>
<deleteConstraint>Cascade</deleteConstraint>
<required>true</required>
</fields>

**Example — optional lookup (SetNull):**
<fields>
<fullName>Account_Lookup__c</fullName>
<label>Account Lookup</label>
<type>Lookup</type>
<referenceTo>Account</referenceTo>
<relationshipLabel>Account</relationshipLabel>
<relationshipName>Account_Lookup</relationshipName>
<deleteConstraint>SetNull</deleteConstraint>
<required>false</required>
</fields>

**6. Permission Assignment to Admin Profile** (!IMPORTANT)

After creating the field, you MUST retrieve the Admin profile and add read and edit permissions for the newly created fields.

**Steps:**

1. **Retrieve Admin Profile XML**

    - Use the `<retrieve_sf_metadata>` tool with:
        - metadata_type: "Profile"
        - metadata_name: "Admin"
    - This will give you the complete Admin profile XML (Admin.profile-meta.xml)

2. **Add Field Permission Entry to Profile XML**

    - In the retrieved profile XML, add a new `<fieldPermissions>` block for each newly created field
    - Add it within the `<Profile>` root tag (with other field permissions)
    - Use this exact format:
        ```xml
        <fieldPermissions>
          <editable>true</editable>
          <field>ObjectApiName.FieldApiName__c</field>
          <readable>true</readable>
        </fieldPermissions>
        ```
    - Replace `ObjectApiName` with the actual object name (e.g., `Invoice__c`)
    - Replace `FieldApiName__c` with the field API name

3. **Complete Example**

    ```xml
    <fieldPermissions>
      <editable>true</editable>
      <field>Invoice__c.Customer_Type__c</field>
      <readable>true</readable>
    </fieldPermissions>
    ```

4. **Deploy Profile with Field Permissions**

    - Save at: `force-app/main/default/profiles/Admin.profile-meta.xml`
    - Run dry run first:
        ```bash
        sf project deploy start --dry-run --source-dir force-app/main/default/profiles/Admin.profile-meta.xml --json
        ```
    - If successful, deploy:
        ```bash
        sf project deploy start --source-dir force-app/main/default/profiles/Admin.profile-meta.xml --json
        ```

5. **User Communication**
    - "Retrieving Admin profile..."
    - "Adding field permissions for {X} newly created field(s)..."
    - "Fields being granted permission: {Field names}"
    - "Deploying updated Admin profile..."
    - "✓ Field permissions successfully assigned to Admin profile!"

**CRITICAL NOTES:**

- Both `<editable>true</editable>` AND `<readable>true</readable>` must be present
- Field reference format: `ObjectApiName.FieldApiName__c`
- Profile metadata name is exactly: "Admin"
- Refer to field-permissions.md for complete field permission guidelines

**7. Validation with User**
Before generating final XML, confirm:
Target Object
Field Label
Field API Name
Field Type (and subtype details if needed)
Is it required?
Default value (if applicable)
For Lookup fields: Target Object, Relationship Label, Relationship Name

**8. Dry run and Deployment** (!IMPORTANT)
After creating all fields, before deployment first do Dry Run on fields using CLI:
-DO DRY RUN ON ALL FIELDS AT ONCE
sf project deploy start --dry-run --source-dir force-app/main/default/objects/<ObjectApiName>/fields/<FieldApiName>.field-meta.xml --json

- Replace <FieldApiName> with created fields
- If got any errors after dry run solve them.
- After successful dry run then proceed with deloyment process.
- Do deploy all fields rules at once.
  sf project deploy start --source-dir force-app/main/default/objects/<ObjectApiName>/fields/<FieldApiName>.field-meta.xml --json
- Replace <FieldApiName> with created fields

**9. Page Layout Field Management** (!IMPORTANT - MUST DO AFTER FIELD DEPLOYMENT)

After successfully deploying the created fields, you MUST retrieve the object's page layout and add the newly created fields to it. This ensures the fields are immediately visible and accessible to users in the Salesforce UI.

**IMPORTANT**: Only add fields to the layout. Do NOT modify the layout structure, columns, or sections.

**Steps:**

1. **Retrieve Page Layout**

    - Use the `<retrieve_sf_metadata>` tool with:
        - metadata_type: "Layout"
        - metadata_name: "{ObjectApiName}-{LayoutName}"
    - Example: `Invoice__c-Invoice Layout` or `Account-Account Layout`

2. **Add Newly Created Fields (SIMPLE - Just add these blocks)**

    - Find an existing `<layoutColumns>` section in the page layout
    - Add each new field as a `<layoutItems>` block:
        ```xml
        <layoutItems>
          <behavior>Edit</behavior>
          <field>{FieldApiName}</field>
        </layoutItems>
        ```
    - For formula/auto-number fields: Use `<behavior>Readonly</behavior>`
    - **IMPORTANT**: Do NOT modify anything else - only add these XML blocks

3. **Validate Page Layout XML**

    - Ensure all field API names are correctly spelled
    - Verify you only added `<layoutItems>` blocks
    - Confirm fields exist on the object

4. **Dry Run Page Layout Update**

    ```bash
    sf project deploy start --dry-run --source-dir force-app/main/default/layouts/{ObjectApiName}-{LayoutName}.layout-meta.xml --json
    ```

    - If you get "Too many columns for section style" error: You modified the layout structure. Only add `<layoutItems>` blocks.

5. **Deploy Updated Page Layout**

    ```bash
    sf project deploy start --source-dir force-app/main/default/layouts/{ObjectApiName}-{LayoutName}.layout-meta.xml --json
    ```

6. **User Communication**
    - "Retrieving page layout for {ObjectName}..."
    - "Adding {X} newly created field(s) to the page layout..."
    - "Fields being added: {Field names}"
    - "Running dry run on page layout..."
    - "Deploying updated page layout..."
    - "✓ Page layout successfully updated with new fields!"

**Important Notes:**

- This step is MANDATORY after field deployment
- Only add `<layoutItems>` blocks - do NOT modify the layout structure
- Do NOT touch `<layoutColumns>` or `<layoutSection>` tags
- All newly created fields must be visible in the page layout
- Do NOT skip this step - users will not see the fields without page layout configuration

**10. Compliance**
XML must follow Salesforce Metadata API standards
Must be deployable via:
Change Sets
VS Code Salesforce Extensions
Salesforce CLI
