# **Salesforce Tab Creation**

## **Overview**

This guide covers creating **Salesforce custom tabs** with **mandatory System Administrator profile permission assignment** with default settings.

## **Strict Rules**

### **1. Folder and File Placement**

- Path: `force-app/main/default/tabs/<TabApiName>.tab-meta.xml`
- Example: `force-app/main/default/tabs/Invoice__c.tab-meta.xml`

### **2. Tab Naming Conventions**

- Use underscores instead of spaces
- Must start with a letter
- Only letters, numbers, underscores allowed
- For custom objects: use object API name (e.g., `Invoice__c`)

### **3. Supported Tab Types**

#### **a. Custom Object Tab (Most Common)**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
    <customObject>true</customObject>
    <motif>Custom53: Bell</motif>
</CustomTab>
```

#### **b. Visualforce Page Tab**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
    <customObject>false</customObject>
    <frameHeight>600</frameHeight>
    <frameWidth>100%</frameWidth>
    <hasScrollbars>true</hasScrollbars>
    <motif>Custom87: Cube</motif>
    <page>DashboardPage</page>
</CustomTab>
```

#### **c. Aura Component Tab**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
    <customObject>false</customObject>
    <auraComponent>c:DashboardComponent</auraComponent>
    <motif>Custom87: Cube</motif>
</CustomTab>
```

#### **d. Lightning Web Component Tab**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
    <customObject>false</customObject>
    <lwcComponent>c:dashboardComponent</lwcComponent>
    <motif>Custom87: Cube</motif>
</CustomTab>
```

### **4. System Administrator Profile Permission Assignment (!!MANDATORY)**

**After tab creation, MUST assign permission to System Administrator profile.**

File: `force-app/main/default/profiles/System Administrator.profile-meta.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <tabVisibilities>
        <tab>Invoice__c</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
</Profile>
```

**MANDATORY Default Settings:**

- `visibility` = `DefaultOn` (makes tab visible by default for System Admin)
- Tab name must match tab fullName

### **5. ⚠️ MANDATORY DEPLOYMENT (!!**CRITICAL - MUST FOLLOW EVERY TIME**)**

**AFTER EVERY CUSTOM TAB CREATION, YOU MUST IMMEDIATELY DEPLOY USING `<sf_deploy_metadata>` TOOL**

**THIS IS NOT OPTIONAL. THIS STEP MUST NOT BE SKIPPED UNDER ANY CIRCUMSTANCES.**

**Use the `<sf_deploy_metadata>` tool for deployment:**

- (**!CRITICAL**) **Provide the tab metadata file (`force-app/main/default/tabs/<TabApiName>.tab-meta.xml`) to the tool**
- (**!CRITICAL**) **Also provide the System Administrator profile file for permission updates**
- (**!CRITICAL**) **The tool will automatically handle both dry-run validation and actual deployment**
- (**!CRITICAL**) **Deploy both tab and profile together for complete setup**
- After successful deployment, the tab will be visible to System Admin users

**MUST DO THIS AFTER EVERY SINGLE CUSTOM TAB - NO EXCEPTIONS**

---

**KEY POINTS:**

- ✅ Tab creation is MANDATORY for custom objects
- ✅ System Admin permission assignment is MANDATORY after tab creation
- ✅ Visibility MUST be `DefaultOn` (mandatory default setting)
- ✅ Deploy tab and profile permissions together
