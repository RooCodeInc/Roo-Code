# Complete Guide to Creating Visualforce Pages with Apex Controllers

---

## Table of Contents

1. [Introduction to Visualforce](#introduction)
2. [Prerequisites](#prerequisites)
3. [Step 1: Create a Simple Visualforce Page](#step-1-create-visualforce-page)
4. [Step 2: Create an Apex Controller](#step-2-create-apex-controller)
5. [Step 3: Data Binding Syntax](#step-3-link-controller)
6. [Step 4: Dry Run & Deployment](#step-4-dry-run-deployment)

---

## Introduction to Visualforce {#introduction}

### What is Visualforce?

Visualforce is a framework that allows developers to build custom user interfaces that can be hosted natively on the Salesforce Lightning Platform. It includes:

- A tag-based markup language similar to HTML
- Server-side "standard controllers" for basic database operations
- The ability to associate custom logic via Apex controllers

### Key Components:

1. **Visualforce Markup**: HTML-like tags (e.g., `<apex:page>`, `<apex:commandButton>`, `<apex:outputField>`) that define UI components
2. **Visualforce Controllers**: Apex classes that handle page logic and data access

### Where Visualforce Can Be Used:

- Override standard buttons (New, Edit, Delete)
- Override tab overview pages
- Define custom tabs
- Embed components in detail page layouts
- Create dashboard components
- Customize Salesforce console components
- Create custom mobile app menu items

---

## Prerequisites {#prerequisites}

### Required Permissions:

- **"Customize Application"** permission (System Administrator typically has this)
- **"Author Apex"** permission
- **"Manage Custom Pages"** permission

### Development Tools:

- **Salesforce CLI** (recommended)
- **Visual Studio Code** with Salesforce Extensions
- **Org Access**: Developer Edition or Sandbox environment

### Verify Permissions:

1. Log in to Salesforce as System Administrator
2. Go to **Setup** → **Users** → **User Permissions**
3. Verify that your user has:
    - "Customize Application"
    - "Author Apex"
    - "Manage Custom Pages"

---

## Step 1: Create a Simple Visualforce Page {#step-1-create-visualforce-page}

### Basic Visualforce Page Structure

A Visualforce page requires the `<apex:page>` root tag and a controller reference:

```xml
<apex:page controller="ContactController">
    <apex:pageMessages/>

    <apex:form>
        <apex:pageBlock title="Create New Contact">
            <apex:pageBlockSection columns="2">
                <apex:inputField value="{!contact.FirstName}" label="First Name"/>
                <apex:inputField value="{!contact.LastName}" label="Last Name"/>
                <apex:inputField value="{!contact.Email}" label="Email"/>
                <apex:inputField value="{!contact.Phone}" label="Phone"/>
            </apex:pageBlockSection>

            <apex:pageBlockButtons>
                <apex:commandButton action="{!save}" value="Save"/>
                <apex:commandButton action="{!cancel}" value="Cancel"/>
            </apex:pageBlockButtons>
        </apex:pageBlock>
    </apex:form>
</apex:page>
```

### Core Visualforce Components

| Tag                       | Purpose                 | Example                                                  |
| ------------------------- | ----------------------- | -------------------------------------------------------- |
| `<apex:page>`             | Page container          | `<apex:page controller="MyController">`                  |
| `<apex:form>`             | HTML form wrapper       | `<apex:form>`                                            |
| `<apex:pageBlock>`        | Styled section          | `<apex:pageBlock title="Title">`                         |
| `<apex:pageBlockSection>` | Field layout            | `<apex:pageBlockSection columns="2">`                    |
| `<apex:inputField>`       | Input bound to object   | `<apex:inputField value="{!object.field}"/>`             |
| `<apex:outputField>`      | Display field value     | `<apex:outputField value="{!object.field}"/>`            |
| `<apex:commandButton>`    | Button with action      | `<apex:commandButton action="{!method}" value="Label"/>` |
| `<apex:pageMessages>`     | Display messages/errors | `<apex:pageMessages/>`                                   |
| `<apex:pageBlockTable>`   | Data table              | `<apex:pageBlockTable value="{!list}" var="item">`       |
| `<apex:column>`           | Table column            | `<apex:column headerValue="Header">`                     |

### Special Character Escaping

In Visualforce XML and text content, special characters must be escaped:

| Character          | Escape Sequence | Usage                              |
| ------------------ | --------------- | ---------------------------------- |
| `&` (ampersand)    | `&amp;`         | Use in text content and attributes |
| `<` (less than)    | `&lt;`          | Use in text content                |
| `>` (greater than) | `&gt;`          | Use in text content                |
| `"` (double quote) | `&quot;`        | Use in attribute values            |
| `'` (single quote) | `&apos;`        | Use in attribute values            |

**Examples:**

```xml
<!-- Correct: Ampersand escaped in text -->
<apex:outputText value="Fruits &amp; Vegetables"/>

<!-- Correct: Ampersand escaped in attribute -->
<apex:commandButton action="{!search}" value="Search &amp; Filter"/>

<!-- Correct: Multiple special characters -->
<apex:outputText value="Price &gt; 100 &amp; Stock &lt; 50"/>

<!-- Wrong: Unescaped ampersand (will cause error) -->
<apex:outputText value="Fruits & Vegetables"/>
```

---

## Step 2: Create an Apex Controller {#step-2-create-apex-controller}

### Apex Controller Structure

A Visualforce controller can use a standard controller or custom controller. Custom controllers provide full business logic control:

```apex
public class ContactController {

    // Properties for two-way binding with VF page
    public Contact contact { get; set; }
    public List<Contact> contactList { get; set; }

    // Constructor - initialize objects
    public ContactController() {
        contact = new Contact();
        contactList = new List<Contact>();
    }

    // Save action method
    public PageReference save() {
        try {
            insert contact;
            ApexPages.addMessage(new ApexPages.Message(
                ApexPages.Severity.CONFIRM,
                'Contact ' + contact.FirstName + ' ' + contact.LastName + ' saved successfully!'));
            contact = new Contact(); // Reset for next entry
            return null;
        } catch (DmlException e) {
            ApexPages.addMessage(new ApexPages.Message(
                ApexPages.Severity.ERROR,
                'Error saving contact: ' + e.getMessage()));
            return null;
        }
    }

    // Cancel action method
    public PageReference cancel() {
        return new PageReference('/');
    }

    // Get all contacts
    public List<Contact> getAllContacts() {
        if (contactList.isEmpty()) {
            contactList = [SELECT Id, FirstName, LastName, Email, Phone
                          FROM Contact
                          ORDER BY CreatedDate DESC
                          LIMIT 100];
        }
        return contactList;
    }

    // Delete contact
    public void deleteContact(String contactId) {
        try {
            Contact c = new Contact(Id = contactId);
            delete c;
            ApexPages.addMessage(new ApexPages.Message(
                ApexPages.Severity.CONFIRM,
                'Contact deleted successfully!'));
            contactList.clear(); // Refresh list
        } catch (DmlException e) {
            ApexPages.addMessage(new ApexPages.Message(
                ApexPages.Severity.ERROR,
                'Error deleting contact: ' + e.getMessage()));
        }
    }
}
```

### Key Controller Concepts

| Concept               | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| **Properties**        | `public Type property { get; set; }` - Two-way binding with VF page |
| **Methods**           | Public methods callable from VF via `action="{!methodName}"`        |
| **PageReference**     | Return type for action methods; null = refresh current page         |
| **ApexPages.Message** | Display messages to user on page                                    |
| **DML Operations**    | insert, update, delete, upsert within try-catch                     |

---

## Step 3: Data Binding Syntax {#step-3-link-controller}

### Controller to Page Binding

Visualforce uses expression language `{! }` to bind page elements to controller properties and methods:

```xml
<apex:page controller="ContactController">
    <apex:pageMessages/>

    <apex:form>
        <!-- Form for creating new contacts -->
        <apex:pageBlock title="Create New Contact">
            <apex:pageBlockSection columns="2">
                <!-- Input fields - two-way binding -->
                <apex:inputField value="{!contact.FirstName}" label="First Name" required="true"/>
                <apex:inputField value="{!contact.LastName}" label="Last Name" required="true"/>
                <apex:inputField value="{!contact.Email}" label="Email"/>
                <apex:inputField value="{!contact.Phone}" label="Phone"/>
            </apex:pageBlockSection>

            <apex:pageBlockButtons>
                <!-- Buttons - call controller methods -->
                <apex:commandButton action="{!save}" value="Save" rerender="pageMessages"/>
                <apex:commandButton action="{!cancel}" value="Cancel"/>
            </apex:pageBlockButtons>
        </apex:pageBlock>
    </apex:form>

    <!-- Display list of all contacts -->
    <apex:pageBlock title="All Contacts">
        <apex:pageBlockTable value="{!getAllContacts}" var="c">
            <apex:column headerValue="First Name">
                <apex:outputField value="{!c.FirstName}"/>
            </apex:column>
            <apex:column headerValue="Last Name">
                <apex:outputField value="{!c.LastName}"/>
            </apex:column>
            <apex:column headerValue="Email">
                <apex:outputField value="{!c.Email}"/>
            </apex:column>
            <apex:column headerValue="Phone">
                <apex:outputField value="{!c.Phone}"/>
            </apex:column>
            <apex:column headerValue="Action">
                <apex:commandLink action="{!deleteContact}" value="Delete"
                    onclick="return confirm('Are you sure?');">
                    <apex:param name="contactId" value="{!c.Id}"/>
                </apex:commandLink>
            </apex:column>
        </apex:pageBlockTable>
    </apex:pageBlock>
</apex:page>
```

### Binding Syntax Reference

| Syntax                | Purpose                       | Example                                      |
| --------------------- | ----------------------------- | -------------------------------------------- |
| `{!property}`         | Access controller property    | `{!contact.FirstName}`                       |
| `{!method()}`         | Call controller method        | `{!getAllContacts}`                          |
| `action="{!method}"`  | Invoke method on button click | `<apex:commandButton action="{!save}"/>`     |
| `value="{!property}"` | Bind element to property      | `<apex:inputField value="{!object.field}"/>` |
| `rerender="id"`       | Refresh element after action  | `rerender="pageMessages"`                    |

---

## ⚠️ MANDATORY DEPLOYMENT (!!**CRITICAL - MUST FOLLOW EVERY TIME**) {#step-4-dry-run-deployment}

**AFTER EVERY VISUALFORCE PAGE AND CONTROLLER CREATION, YOU MUST IMMEDIATELY DEPLOY USING `<sf_deploy_metadata>` TOOL**

**THIS IS NOT OPTIONAL. THIS STEP MUST NOT BE SKIPPED UNDER ANY CIRCUMSTANCES.**

### Strict Deployment Rules

- (**!CRITICAL**) **You MUST use the `<sf_deploy_metadata>` tool for ALL Visualforce deployments**
- (**!CRITICAL**) **Do NOT attempt to use CLI commands like `sf project deploy start`**
- (**!CRITICAL**) **Do NOT skip this step - deployment is MANDATORY after every Visualforce page and controller creation**
- (**!CRITICAL**) **Deploy Apex controller BEFORE the Visualforce page that references it**
- (**!CRITICAL**) **Deploy only the metadata files that were created or modified — do NOT deploy the entire metadata folder**

### Mandatory Deployment Workflow

1. **Verify all Apex controller dependencies are deployed first** (this step is MANDATORY)
2. **Use `<sf_deploy_metadata>` tool with the Visualforce page and/or controller file paths** (this step is MANDATORY)
3. **The tool will automatically validate (dry-run) the deployment** (automatic)
4. **If validation is successful, the tool will proceed with deployment** (automatic)
5. **If there are errors, fix them immediately and retry the deployment using the tool** (this step is MANDATORY)

**Supported Deployment Combinations:**

- Single Visualforce page
- Apex controller alone
- Both controller and page together
- Multiple pages and controllers at once

**MUST DO THIS AFTER EVERY SINGLE VISUALFORCE PAGE AND CONTROLLER - NO EXCEPTIONS**

### Deployment Notes

| Aspect                   | Details                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| **Order**                | Deploy Apex controllers BEFORE Visualforce pages that depend on them |
| **Dry Run First**        | Always run dry run before actual deployment                          |
| **Test Coverage**        | Apex code requires minimum 75% test coverage for production          |
| **Deploy Only Modified** | Deploy only components you created/modified, not entire folders      |
| **Status Check**         | Deployment typically completes in 2-5 minutes                        |

---

## Additional Resources

- **Salesforce Visualforce Developer Guide**: https://developer.salesforce.com/docs/atlas.en-us.pages.meta/pages/
- **Apex Developer Guide**: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/
- **Visualforce Best Practices**: https://developer.salesforce.com/docs/atlas.en-us.pages.meta/pages/pages_best_practice.htm
- **Trailhead Learning**: https://trailhead.salesforce.com/content/learn/trails/lex_dev_lpc_visualforce_fundamentals
