# Complete Guide to Creating Aura Components

---

## Table of Contents

1. [Introduction to Aura Components](#introduction)
2. [Prerequisites](#prerequisites)
3. [Step 1: Understand Aura Component Structure](#step-1-component-structure)
4. [Step 2: Create an Aura Component](#step-2-create-component)
5. [Step 3: Create Component Controller (JavaScript)](#step-3-component-controller)
6. [Step 4: Create Component Helper (JavaScript)](#step-4-component-helper)
7. [Step 5: Component Styling (CSS)](#step-5-component-styling)
8. [Step 6: Dry Run & Deployment](#step-6-dry-run-deployment)

---

## Introduction to Aura Components {#introduction}

### What are Aura Components?

Aura components are the self-contained and reusable units of an app. They represent a reusable section of the UI and can range in granularity from a single line of text to an entire app. The framework includes a set of prebuilt components known as Lightning Base Components.

### Key Features:

- **Self-contained**: Components encapsulate their own markup, logic, and styles
- **Reusable**: Can be assembled and configured to form new components
- **Event-driven**: Components interact with their environment by publishing and listening to events
- **Lightning Design System support**: Built-in styling components from the lightning namespace

### Where Aura Components Can Be Used:

- Lightning Pages (Record Pages, App Pages, Home Pages)
- Lightning App Builder
- Standalone apps
- Custom tabs
- Embedded in Visualforce pages (with iframe)
- Community pages
- Sales Cloud and Service Cloud applications

### Important Note:

⚠️ **Salesforce recommends using Lightning Web Components (LWC) instead of Aura Components for new development.** Aura Components are legacy technology. However, they are still supported and widely used in existing implementations.

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
- **Knowledge of JavaScript** for controllers and helpers

### Verify Permissions:

1. Log in to Salesforce as System Administrator
2. Go to **Setup** → **Users** → **User Permissions**
3. Verify that your user has:
    - "Customize Application"
    - "Author Apex"
    - "Manage Custom Pages"

---

## Step 1: Understand Aura Component Structure {#step-1-component-structure}

### Component Folder Structure

```
force-app/main/default/aura/
└── contactForm/                          # Component folder (camelCase)
    ├── contactForm.cmp                   # Component markup (required)
    ├── contactFormController.js          # Component controller (optional)
    ├── contactFormHelper.js              # Component helper (optional)
    ├── contactForm.css                   # Component styles (optional)
    └── contactForm.cmp-meta.xml          # Metadata file (required)
```

### File Descriptions

| File                         | Purpose                                           | Required |
| ---------------------------- | ------------------------------------------------- | -------- |
| `componentName.cmp`          | Component markup (HTML-like syntax)               | Yes      |
| `componentNameController.js` | JavaScript controller with request/response logic | No       |
| `componentNameHelper.js`     | JavaScript helper with shared utility functions   | No       |
| `componentName.css`          | CSS styles for the component                      | No       |
| `componentName.cmp-meta.xml` | Metadata configuration file                       | Yes      |

---

## Step 2: Create an Aura Component {#step-2-create-component}

### Basic Aura Component Structure

An Aura component requires a `.cmp` file and a `.cmp-meta.xml` file:

### Component Markup File (contactForm.cmp)

```xml
<aura:component controller="ContactFormController">
    <!-- Component attributes (inputs/outputs) -->
    <aura:attribute name="contacts" type="Contact[]"/>
    <aura:attribute name="selectedContact" type="Contact"/>
    <aura:attribute name="isLoading" type="Boolean" default="false"/>

    <!-- Component event handlers -->
    <aura:handler name="init" value="{!this}" action="{!c.init}"/>

    <!-- Component HTML markup -->
    <div class="contact-form">
        <h2>Contact Management</h2>

        <!-- Loading spinner -->
        <aura:if isTrue="{!v.isLoading}">
            <lightning:spinner alternativeText="Loading" size="small"/>
        </aura:if>

        <!-- Contact list -->
        <aura:if isTrue="{!v.contacts}">
            <table class="slds-table slds-table_bordered">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <aura:iteration items="{!v.contacts}" var="contact">
                        <tr>
                            <td>{!contact.FirstName} {!contact.LastName}</td>
                            <td>{!contact.Email}</td>
                            <td>{!contact.Phone}</td>
                            <td>
                                <lightning:button
                                    label="Edit"
                                    onclick="{!c.handleEdit}"
                                    data-contact-id="{!contact.Id}"/>
                            </td>
                        </tr>
                    </aura:iteration>
                </tbody>
            </table>
        </aura:if>
    </div>
</aura:component>
```

### Metadata File (contactForm.cmp-meta.xml)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <description>Contact Form Component for managing contacts</description>
    <isExposed>true</isExposed>
    <masterLabel>Contact Form</masterLabel>
    <visibility>GLOBAL</visibility>
</AuraDefinitionBundle>
```

### Core Aura Tags

| Tag                    | Purpose                     | Example                                          |
| ---------------------- | --------------------------- | ------------------------------------------------ |
| `<aura:component>`     | Root component element      | `<aura:component controller="MyController">`     |
| `<aura:attribute>`     | Define component properties | `<aura:attribute name="name" type="String"/>`    |
| `<aura:handler>`       | Handle component events     | `<aura:handler name="init" action="{!c.init}"/>` |
| `<aura:iteration>`     | Loop through list items     | `<aura:iteration items="{!v.items}" var="item">` |
| `<aura:if>`            | Conditional rendering       | `<aura:if isTrue="{!v.condition}">`              |
| `<lightning:*>`        | Lightning Base Components   | `<lightning:button label="Save"/>`               |
| `<force:createRecord>` | Create record actions       | `<force:createRecord type="Contact"/>`           |
| `<force:editRecord>`   | Edit record actions         | `<force:editRecord recordId="{!v.recordId}"/>`   |

---

## Step 3: Create Component Controller (JavaScript) {#step-3-component-controller}

### Controller Structure (contactFormController.js)

```javascript
;({
	// Initialize component - called when component is inserted into DOM
	init: function (component, event, helper) {
		// Set loading state
		component.set("v.isLoading", true)

		// Get contacts from server
		helper.getContacts(component, function (result) {
			component.set("v.contacts", result)
			component.set("v.isLoading", false)
		})
	},

	// Handle edit button click
	handleEdit: function (component, event, helper) {
		var button = event.getSource()
		var contactId = button.get("v.value")

		// Create payload for record edit
		var editRecordEvent = $A.get("e.force:editRecord")
		editRecordEvent.setParams({
			recordId: contactId,
		})
		editRecordEvent.fire()
	},

	// Handle save action
	handleSave: function (component, event, helper) {
		var contact = component.get("v.selectedContact")

		// Validate contact
		if (!contact.FirstName || !contact.LastName) {
			helper.showToast("Error", "First Name and Last Name are required", "error")
			return
		}

		// Call helper to save contact
		helper.saveContact(component, contact, function (result) {
			if (result.success) {
				helper.showToast("Success", "Contact saved successfully", "success")
				// Refresh contacts list
				component.set("v.init", null) // This will trigger init handler
			} else {
				helper.showToast("Error", result.message, "error")
			}
		})
	},
})
```

### Controller Key Concepts

| Concept             | Description                                         |
| ------------------- | --------------------------------------------------- |
| **Function Map**    | First object in the controller contains all actions |
| **component**       | Reference to the component instance                 |
| **event**           | The event that triggered the action                 |
| **helper**          | Reference to helper functions                       |
| **component.get()** | Get attribute value from component                  |
| **component.set()** | Set attribute value on component                    |

---

## Step 4: Create Component Helper (JavaScript) {#step-4-component-helper}

### Helper Structure (contactFormHelper.js)

```javascript
;({
	// Fetch contacts from server
	getContacts: function (component, callback) {
		var action = component.get("c.getContacts")

		action.setCallback(this, function (response) {
			var state = response.getState()

			if (state === "SUCCESS") {
				var contacts = response.getReturnValue()
				callback(contacts)
			} else if (state === "INCOMPLETE") {
				console.log("Incomplete response from server")
			} else if (state === "ERROR") {
				var errors = response.getError()
				console.error("Error:", errors)
				this.showToast("Error", "Failed to load contacts", "error")
			}
		})

		$A.enqueueAction(action)
	},

	// Save contact to database
	saveContact: function (component, contact, callback) {
		var action = component.get("c.saveContact")
		action.setParams({
			contact: contact,
		})

		action.setCallback(this, function (response) {
			var state = response.getState()

			if (state === "SUCCESS") {
				var result = response.getReturnValue()
				callback({
					success: true,
					data: result,
				})
			} else if (state === "ERROR") {
				var errors = response.getError()
				callback({
					success: false,
					message: errors[0].message || "Unknown error",
				})
			}
		})

		$A.enqueueAction(action)
	},

	// Show toast notification
	showToast: function (title, message, type) {
		var toastEvent = $A.get("e.force:showToast")
		toastEvent.setParams({
			title: title,
			message: message,
			type: type,
			duration: 5000,
		})
		toastEvent.fire()
	},
})
```

### Helper Key Concepts

| Concept                  | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| **Shared Functions**     | Reusable utility functions used by controller        |
| **Server Communication** | Use `component.get("c.method")` to call Apex methods |
| **Callbacks**            | Handle asynchronous server responses                 |
| **$A.enqueueAction()**   | Queue action to be processed asynchronously          |
| **response.getState()**  | Check state: SUCCESS, INCOMPLETE, ERROR              |
| **$A.get("e.force:\*")** | Access Salesforce framework events                   |

---

## Step 5: Component Styling (CSS) {#step-5-component-styling}

### CSS File (contactForm.css)

```css
/* Component wrapper styles */
.contact-form {
	padding: 1rem;
	background-color: #f5f5f5;
	border-radius: 4px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.contact-form h2 {
	margin: 0 0 1rem 0;
	font-size: 1.5rem;
	color: #333;
	border-bottom: 2px solid #0070d2;
	padding-bottom: 0.5rem;
}

/* Table styles using Lightning Design System */
.contact-form table {
	width: 100%;
	margin-top: 1rem;
}

.contact-form table th {
	background-color: #0070d2;
	color: white;
	padding: 0.75rem;
	text-align: left;
	font-weight: 600;
}

.contact-form table td {
	padding: 0.75rem;
	border-bottom: 1px solid #ddd;
}

.contact-form table tr:hover {
	background-color: #f9f9f9;
}

/* Loading spinner centered */
.contact-form lightning-spinner {
	text-align: center;
	padding: 2rem;
}

/* Action buttons */
.contact-form lightning-button {
	margin: 0.25rem;
}

/* Responsive design */
@media (max-width: 768px) {
	.contact-form {
		padding: 0.5rem;
	}

	.contact-form table {
		font-size: 0.875rem;
	}

	.contact-form table th,
	.contact-form table td {
		padding: 0.5rem;
	}
}
```

### CSS Best Practices:

✅ Use Lightning Design System (SLDS) classes when available
✅ Keep styles scoped to the component
✅ Use relative units (rem, %, em) for responsive design
✅ Avoid using `!important` unless absolutely necessary
✅ Test styles on mobile and tablet devices

---

## Step 6: Dry Run & Deployment {#step-6-dry-run-deployment}

### Dry Run Commands

Always perform a dry run before deployment:

```bash
# Dry run for single Aura component
sf project deploy start --dry-run --source-dir force-app/main/default/aura/contactForm

# Dry run for multiple Aura components
sf project deploy start --dry-run \
  --source-dir force-app/main/default/aura/contactForm \
  --source-dir force-app/main/default/aura/opportunityList
```

### Deployment Commands

After successful dry run, deploy to the org:

```bash
# Deploy single Aura component
sf project deploy start --source-dir force-app/main/default/aura/contactForm

# Deploy multiple Aura components
sf project deploy start \
  --source-dir force-app/main/default/aura/contactForm \
  --source-dir force-app/main/default/aura/opportunityList

# Deploy component with related Apex controller
sf project deploy start \
  --source-dir force-app/main/default/aura/contactForm \
  --source-dir force-app/main/default/classes/ContactFormController.cls
```

### Deployment Notes

| Aspect            | Details                                                            |
| ----------------- | ------------------------------------------------------------------ |
| **Order**         | Deploy Apex controllers BEFORE Aura components that depend on them |
| **Dry Run First** | Always run dry run before actual deployment                        |
| **Test Coverage** | Apex code requires minimum 75% test coverage for production        |
| **API Version**   | Set in `.cmp-meta.xml` (recommended: 65.0 or latest)               |
| **Visibility**    | Set `<visibility>GLOBAL</visibility>` to use in other components   |
| **Status Check**  | Deployment typically completes in 2-5 minutes                      |

### Deployment Checklist

- ✅ All files are in correct folder structure
- ✅ `.cmp-meta.xml` file exists with proper configuration
- ✅ Component name in folder matches file names (camelCase)
- ✅ Associated Apex controller deployed first (if applicable)
- ✅ All attributes have proper types
- ✅ Event handlers reference valid controller actions
- ✅ Dry run completed successfully with no errors

---

## Creating Apex Controller for Aura Component

### Apex Controller Class (ContactFormController.cls)

Aura components often require an Apex controller to handle server-side logic:

```apex
public class ContactFormController {

    @AuraEnabled
    public static List<Contact> getContacts() {
        try {
            return [
                SELECT Id, FirstName, LastName, Email, Phone
                FROM Contact
                ORDER BY CreatedDate DESC
                LIMIT 100
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving contacts: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Contact saveContact(Contact contact) {
        try {
            upsert contact;
            return contact;
        } catch (DmlException e) {
            throw new AuraHandledException('Error saving contact: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteContact(String contactId) {
        try {
            Contact c = new Contact(Id = contactId);
            delete c;
        } catch (DmlException e) {
            throw new AuraHandledException('Error deleting contact: ' + e.getMessage());
        }
    }
}
```

### Key Annotations

| Annotation                      | Purpose                                     |
| ------------------------------- | ------------------------------------------- |
| `@AuraEnabled`                  | Makes method accessible from Aura component |
| `@AuraEnabled(cacheable=true)`  | Caches method result for better performance |
| `@AuraEnabled(cacheable=false)` | Does not cache result (for mutations)       |

---

## Troubleshooting Common Errors

### Deployment Error Reference

| Error Message                                                                                         | Cause                                                                                                                                              | Solution                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `The attribute "data-*" was not found on the COMPONENT markup://lightning:select`                     | Using HTML data attributes on Lightning components instead of proper component attributes                                                          | Replace `data-opportunity-id="{!id}"` with `value="{!id}"`. Lightning components have predefined attributes (value, label, placeholder, etc.) - use these instead of custom data attributes. |
| `The attribute "data-*" was not found on the COMPONENT markup://lightning:button`                     | HTML data attributes not supported on Lightning components                                                                                         | For storing data on a button, use a Lightning attribute on the component: `<lightning:button value="{!recordId}"/>` and retrieve via `event.getSource().get("v.value")` in the handler.      |
| `Undefined attribute used in markup`                                                                  | Component markup references an attribute that doesn't exist in the component definition                                                            | Add the missing attribute to the `.cmp` file: `<aura:attribute name="attributeName" type="String" required="true"/>`                                                                         |
| `Syntax error in component markup`                                                                    | Malformed XML in `.cmp` file (missing closing tags, invalid characters, unclosed quotes)                                                           | Validate XML syntax: all tags must be properly closed, attributes quoted, special characters escaped. Run deploy with `--verbose` flag to see exact line number.                             |
| `Method is not visible: 'methodName'`                                                                 | Apex method missing `@AuraEnabled` annotation or is private                                                                                        | Add `@AuraEnabled` to make method accessible to Aura components: `@AuraEnabled public static List<Contact> getContacts() { }`                                                                |
| `Cannot find property in component`                                                                   | Component attribute used before it's defined in `.cmp` or attribute type mismatch                                                                  | Define attribute in component markup first: `<aura:attribute name="contacts" type="Contact[]"/>`. Ensure type matches usage in controller.                                                   |
| `Method does not exist or incorrect signature: void isConverted() from the type Schema.PicklistEntry` | Calling `isConverted()` on a `Schema.PicklistEntry` object. The `isConverted()` method only exists on `Lead` object, not on picklist metadata      | If checking Lead status: `Boolean converted = lead.IsConverted;`. If looping picklist values, use valid PicklistEntry methods: `pe.isActive()`, `pe.getValue()`, `pe.getLabel()`             |
| `Invalid bind expression type of APEX_OBJECT for column of type Id`                                   | Binding an entire SObject to a SOQL query when an Id is expected: `WHERE LeadId = :lead` (binding object instead of Id)                            | Always extract the Id from the object: `WHERE LeadId = :lead.Id` or `WHERE LeadId = :leadId`                                                                                                 |
| `Method does not exist or incorrect signature: void assertNull(Object, String) from type System`      | Using overloaded `assertNull()` with a message parameter in test classes. Salesforce System class doesn't support the 2-parameter version          | Use `System.assertEquals(null, obj);` or `System.assert(obj == null);` - no message parameter supported                                                                                      |
| `Dependent class is invalid and needs recompilation`                                                  | A test class references a main Apex class that has compilation errors                                                                              | Fix the main Apex class first (e.g., LeadConversionController), save/compile it, then re-deploy the test class                                                                               |
| `CSS selector must begin with '.THIS' or '.cComponentName'`                                           | Aura component CSS file contains unscoped selectors like `.container { }` or `button { }`. All CSS in Aura must be scoped to prevent style leakage | Prefix every CSS selector: `.THIS .container { }` or `.cLeadConverter .container { }`. Example: `.THIS button { color: blue; }`                                                              |
| `The entity name must immediately follow the '&' in the entity reference`                             | Using unescaped special characters in Aura markup, particularly `&` without HTML entity encoding                                                   | Escape special characters: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`. Example: `Tom &amp; Jerry` instead of `Tom & Jerry`                                                    |

### Dry-Run Validation Checklist

Before deploying, run a dry-run to catch errors:

```bash
sf project deploy start --dir . --dry-run --verbose
```

Common dry-run issues to check:

- ✅ All `.cmp` files have matching `.cmp-meta.xml` files
- ✅ All Apex methods called from components have `@AuraEnabled` annotation
- ✅ Component attributes in markup match attribute definitions
- ✅ Lightning component attributes are correctly spelled (no `data-*` attributes)
- ✅ Event handlers reference methods that exist in the controller
- ✅ No syntax errors in JavaScript controller/helper files

---

## Common Patterns and Best Practices

### Error Handling in Components

```javascript
handleError: function(component, event, helper) {
    var errors = event.getParam("arguments").oneOrMore.returnValue.getError();
    var message = "Unknown error";

    if (errors && Array.isArray(errors) && errors.length > 0) {
        message = errors[0].message;
    }

    helper.showToast("Error", message, "error");
}
```

### Component Communication with Events

```javascript
// Publishing event from child component
;({
	fireEvent: function (component) {
		var cmp = component.getEvent("eventName")
		cmp.fire()
	},
})
```

### Using Lightning Base Components

```xml
<!-- Button -->
<lightning:button label="Save" onclick="{!c.handleSave}" variant="brand"/>

<!-- Input -->
<lightning:input label="Name" value="{!v.name}" onchange="{!c.handleChange}"/>

<!-- Card -->
<lightning:card iconName="action:new" title="Contact Form">
    <!-- Card content -->
</lightning:card>

<!-- Record Form -->
<lightning:recordForm
    recordId="{!v.recordId}"
    objectApiName="Contact"
    layoutType="Full"
    onload="{!c.handleLoad}"
    onsave="{!c.handleSave}"/>
```

---

## Additional Resources

- **Salesforce Aura Components Developer Guide**: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/intro_components.htm
- **Lightning Base Components Reference**: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/lightning_overview.htm
- **Aura Framework**: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/intro_framework.htm
- **Trailhead - Aura Components Basics**: https://trailhead.salesforce.com/content/learn/trails/lex_dev_aura_components
- **Lightning Design System**: https://www.lightningdesignsystem.com/

---

## Important Notes

⚠️ **Legacy Technology**: While Aura Components are still supported, Salesforce recommends using **Lightning Web Components (LWC)** for new development. LWC provides better performance, easier development, and more modern JavaScript standards.

🔄 **Migration Path**: If you're maintaining existing Aura Components, consider planning a migration to LWC for long-term maintainability.
