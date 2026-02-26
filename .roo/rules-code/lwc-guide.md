# Lightning Web Components (LWC) Guide Summary

## For AI Systems with Web Development & Salesforce Knowledge

---

## LWC Standards

- **Naming:** kebab-case for folders/files (`accountList`), PascalCase for Classes (`AccountList`).
- **@wire:** Prefer `@wire` for reading data; use imperative Apex for user actions (button clicks).
- **Logic:** Keep heavy business logic in Apex, not JavaScript.

**Example (JS Controller):**

```javascript
import { LightningElement, wire } from "lwc"
import getActiveAccounts from "@salesforce/apex/AccountService.getActiveAccounts"

export default class AccountList extends LightningElement {
	listAccounts
	error

	@wire(getActiveAccounts)
	wiredAccounts({ data, error }) {
		if (data) {
			this.listAccounts = data
			this.error = undefined
		} else if (error) {
			this.error = error
			this.listAccounts = undefined
		}
	}
}
```

## User-Provided Guidelines Priority (HIGHEST PRIORITY)

- **When the user provides code or project guidelines in a BRD (Business Requirement Document), you MUST prioritize those guidelines above all else.**
- User-provided guidelines have the **HIGHEST PRIORITY** and override any default patterns or best practices mentioned in this guide.
- If there is a conflict between user guidelines and this reference guide, always follow the user's guidelines.
- Examples of user guidelines include:
    - Naming conventions specific to the project
    - Component structure and architecture patterns
    - Event handling approaches
    - Data management strategies
    - Styling and design system standards
    - Testing and documentation requirements
- Always acknowledge and confirm user-provided guidelines before proceeding with implementation.

---

## Core Concepts

### What LWC Is

Lightning Web Components is Salesforce's modern framework built on **Web Components standards** (W3C). It's not a proprietary framework—it uses native browser capabilities with minimal abstraction. Most code is standard JavaScript and HTML, with the framework only adding what's necessary for Salesforce-specific functionality and performance optimization.

**Key Philosophy**: LWC leverages native browser APIs and standards rather than creating its own abstractions. This results in lightweight, high-performance components.

---

## Component Architecture

### File Structure

Every LWC component consists of at least a JavaScript file, with optional HTML and CSS files following strict naming conventions:

```
myComponent/
├── myComponent.js       (required)
├── myComponent.html     (optional)
├── myComponent.css      (optional)
└── myComponent.js-meta.xml (metadata)
```

**Naming Convention**:

- Folder and files use camelCase: `myComponent`
- JavaScript class uses PascalCase: `MyComponent`
- Maximum JavaScript file size: 1 MB

### JavaScript File

```javascript
import { LightningElement } from "lwc"

export default class MyComponent extends LightningElement {
	// Component logic
}
```

**Critical Rules**:

- Must extend `LightningElement` (the only allowed base class)
- Must be the default export
- Follows ES6 module syntax
- No namespace imports or re-export bindings allowed

---

## Decorators (Key Differentiator from Standard Web Components)

LWC provides three decorators that add Salesforce-specific functionality:

### 1. `@api` - Public Properties/Methods

```javascript
import { LightningElement, api } from "lwc"

export default class MyComponent extends LightningElement {
	@api recordId // Publicly settable property

	@api refresh() {
		// Public method callable by parent
		// logic
	}
}
```

- Makes properties/methods part of component's public API
- Properties are reactive (trigger re-renders)
- **Read-only from child component's perspective** when set by parent

### 2. `@track` - Deep Reactivity for Objects/Arrays

```javascript
@track userData = { firstName: '', lastName: '' };
```

**Important Context**:

- Since Spring '20, **all fields are reactive by default** (shallow observation)
- `@track` is only needed for **deep observation** of object properties or array elements
- Without `@track`: Only reassigning the entire object/array triggers re-render
- With `@track`: Mutating internal properties/elements triggers re-render

**Example**:

```javascript
// Without @track - this WON'T trigger re-render:
this.user.name = 'John';

// Must do this instead:
this.user = { ...this.user, name: 'John' };

// With @track - this WILL trigger re-render:
@track user = {};
this.user.name = 'John';  // Re-renders
```

### 3. `@wire` - Reactive Data Service

```javascript
import { wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';

@wire(getRecord, { recordId: '$recordId', fields })
wiredRecord({ error, data }) {
    if (data) {
        // Handle data
    }
}
```

**Key Characteristics**:

- Provides **immutable, reactive data streams**
- Data provisioned by Lightning Data Service (LDS)
- Supports reactive variables prefixed with `$`
- Can decorate properties or functions
- Respects CRUD, FLS, and sharing rules
- **Read-only data** - component must make shallow copies to mutate

**Available Wire Adapters**:

- `getRecord` - Fetch record data
- `getRecordUi` - Get layout + metadata + data
- `getObjectInfo` - Object metadata
- `getPicklistValues` - Picklist values
- Custom Apex methods (with `@wire` support)

---

## Lifecycle Hooks

### Standard Web Components Hooks

#### `constructor()`

- Fires when component instance created
- **Flows parent → child**
- Must call `super()` first (no parameters)
- Properties not yet assigned
- **Cannot** add attributes to host element
- Cannot access child elements

#### `connectedCallback()`

- Fires when inserted into DOM
- **Flows parent → child**
- Can fire multiple times (e.g., reordering elements)
- Use for initialization, event listeners, data fetching
- Check `this.isConnected` to verify DOM connection

#### `disconnectedCallback()`

- Fires when removed from DOM
- **Flows parent → child**
- Use for cleanup (remove event listeners, purge caches)

### LWC-Specific Hooks

#### `renderedCallback()`

- **Unique to LWC**
- Fires after rendering phase completes
- **Flows child → parent** (opposite direction)
- Template expressions re-evaluated
- **Warning**: Updating component state here can cause infinite loops

#### `errorCallback(error, stack)`

- **Unique to LWC**
- Creates error boundary components
- Captures errors in all descendant components
- Like JavaScript `catch{}` block
- Errors from programmatic event handlers NOT caught

#### `render()`

- Not technically a lifecycle hook (protected method)
- Override to conditionally render multiple templates
- Must return template reference

---

## Templating System

### HTML Templates

```html
<template>
	<div>Component content</div>
</template>
```

**Core Principles**:

- Uses **virtual DOM** for efficient rendering
- Root `<template>` tag required
- Let LWC manipulate DOM (don't use imperative DOM manipulation)

### Template Directives

#### Conditional Rendering

```html
<template lwc:if="{isTrue}">
	<!-- Rendered if true -->
</template>
<template lwc:elseif="{isOtherCondition}">
	<!-- Alternative condition -->
</template>
<template lwc:else>
	<!-- Fallback -->
</template>
```

**Limitations**:

- Simple dot notation only (no complex expressions like `!condition` or `obj?.prop`)
- Use getters in JavaScript for complex logic

#### Iteration

```html
<!-- for:each -->
<template for:each="{items}" for:item="item" for:index="index">
	<div key="{item.id}">{item.name}</div>
</template>

<!-- iterator (more control) -->
<template iterator:it="{items}">
	<div key="{it.value.id}">
		<span lwc:if="{it.first}">First!</span>
		{it.value.name}
	</div>
</template>
```

**Key attribute**: Required for performance optimization

#### Refs (DOM Access)

```html
<div lwc:ref="myDiv"></div>
```

```javascript
// Access in JavaScript
this.refs.myDiv
```

**Preferred over**:

- `this.template.querySelector()` (shadow DOM)
- `this.querySelector()` (light DOM)

#### Other Directives

- `lwc:dom="manual"` - For third-party library integration
- `lwc:external` - Render third-party web components
- `lwc:spread` - Dynamic property binding
- `lwc:slot-data` / `lwc:slot-bind` - Scoped slots

---

## Shadow DOM vs Light DOM

### Shadow DOM (Default)

- **Synthetic shadow DOM** in Lightning Experience (polyfill)
- **Native shadow DOM** in Lightning Out
- CSS encapsulation enforced
- Access owned elements: `this.template.querySelector()`
- Slotted content: `this.querySelector()`

**Enable Light DOM**:

```javascript
import { LightningElement } from "lwc"

export default class MyComponent extends LightningElement {
	static renderMode = "light"
}
```

```html
<template lwc:render-mode="light">
	<!-- content -->
</template>
```

### Key Differences

| Aspect            | Shadow DOM                      | Light DOM                                            |
| ----------------- | ------------------------------- | ---------------------------------------------------- |
| CSS Encapsulation | Automatic                       | Manual (use `*.scoped.css`)                          |
| DOM Access        | `this.template.querySelector()` | `this.querySelector()` or `document.querySelector()` |
| Event Retargeting | Yes                             | No                                                   |
| Slots             | Browser native                  | LWC-implemented                                      |
| ID Selectors      | Transformed (don't use)         | Normal behavior                                      |

---

## CSS & Styling

### Shadow DOM CSS Rules

```css
/* Component scoped automatically */
h1 {
	color: blue; /* Only affects this component */
}

/* Host element styling */
:host {
	display: block;
}
```

**Restrictions**:

- **No ID selectors** (IDs get transformed)
- Styles don't leak to children
- Parent can style child as single element only
- Some properties inherit (color, font)
- CSS custom properties pierce shadow boundary

### Styling Hooks (CSS Custom Properties)

```css
/* Define in component */
:host {
	background: var(--my-component-bg, white);
}

/* Consumer sets value */
c-my-component {
	--my-component-bg: lightblue;
}
```

### Light DOM Scoped Styles

```css
/* myComponent.scoped.css */
.container {
	/* Scoped to component */
}
```

### Multiple Stylesheets

```javascript
import stylesheets from "./base.css"
import headerStyles from "./header.css"

export default class MyComponent extends LightningElement {
	static stylesheets = [stylesheets, headerStyles]
}
```

**Load order**:

1. `myComponent.css` (implicit)
2. Stylesheets in `stylesheets` array (in order)

---

## Event Handling

### Declarative (Preferred)

```html
<template>
	<button onclick="{handleClick}">Click</button>
</template>
```

```javascript
handleClick(event) {
    // Handle event
}
```

### Imperative

```javascript
connectedCallback() {
    this.template.querySelector('button')
        .addEventListener('click', this.handleClick);
}

disconnectedCallback() {
    // Framework handles cleanup for template elements
    // YOU must cleanup for window, document, etc.
}
```

**Important**:

- Framework auto-cleans template element listeners
- Must manually clean listeners on window, document, etc. in `disconnectedCallback()`
- Don't use `.bind(this)` with `addEventListener()`

### Event Retargeting (Shadow DOM)

When events cross shadow boundary, `event.target` changes to match listener's scope (prevents exposing shadow DOM internals).

---

## Data Flow & Reactivity

### Reactivity Rules

1. **All fields are reactive** (since Spring '20)
2. Shallow observation by default (identity comparison with `===`)
3. Deep observation requires `@track`
4. Reactive changes trigger re-render if:
    - Field used in template
    - Field used in getter of property used in template

### Data Mutations

```javascript
// ❌ Won't trigger re-render (without @track)
this.user.name = 'John';

// ✅ Will trigger re-render
this.user = { ...this.user, name: 'John' };

// ✅ With @track decorator
@track user = {};
this.user.name = 'John';  // Re-renders
```

### Wire Service Data

- **Immutable** - always read-only
- Make shallow copies to mutate
- Never update wire config in `renderedCallback()`
- Reactive variables prefixed with `$`

```javascript
@wire(getRecord, { recordId: '$recordId', fields })
contact;

// When recordId changes, wire service re-provisions data
```

---

## Communication Patterns

### Parent → Child

```javascript
// Child component
@api messageFromParent;

// Parent template
<c-child message-from-parent={parentData}></c-child>
```

### Child → Parent (Custom Events)

```javascript
// Child dispatches
this.dispatchEvent(
	new CustomEvent("select", {
		detail: selectedId,
		bubbles: true,
		composed: true,
	}),
)

// Parent listens
;<c-child onselect={handleSelect}></c-child>
```

### Unrelated Components

- Lightning Message Service (pub/sub)
- Application events

---

## Salesforce-Specific Features

### Lightning Data Service (LDS)

- Client-side data caching
- Automatic synchronization across components
- Respects security (CRUD, FLS, sharing)
- Shared between Aura and LWC
- Wire adapters built on LDS

### UI API Modules

```javascript
import { getRecord } from "lightning/uiRecordApi"
import { getObjectInfo } from "lightning/uiObjectInfoApi"
```

### Apex Integration

```javascript
import apexMethod from '@salesforce/apex/ClassName.methodName';

// Wire adapter
@wire(apexMethod, { param: '$value' })
wiredResult;

// Imperative call
apexMethod({ param: value })
    .then(result => { /* ... */ })
    .catch(error => { /* ... */ });
```

### Record Context

Components on record pages automatically receive `recordId`:

```javascript
@api recordId;  // Auto-populated on record pages
```

---

## Dynamic Components

### Using `<lwc:component>`

```html
<template>
	<lwc:component lwc:is="{dynamicCtor}"></lwc:component>
</template>
```

```javascript
dynamicCtor;

async connectedCallback() {
    const module = await import('c/myDynamicComponent');
    this.dynamicCtor = module.default;
}
```

**Features**:

- Lazy loading
- Conditional component rendering
- Pass properties via markup or `lwc:spread`

---

## Testing

### Jest Tests

- `@salesforce/sfdx-lwc-jest` utility
- Mock wire adapters
- Mock Apex calls
- Test lifecycle hooks

**Test Structure**:

```
myComponent/
├── __tests__/
│   ├── myComponent.test.js
│   └── data/
│       └── getRecord.json
```

---

## Performance Considerations

1. **Virtual DOM** handles efficient rendering
2. **Scoped CSS** has performance cost (use sparingly)
3. Avoid state updates in `renderedCallback()`
4. LDS caching reduces network calls
5. Wire service delegates control flow to framework

---

## Migration from Aura

### Key Differences

| Feature     | Aura               | LWC                  |
| ----------- | ------------------ | -------------------- |
| Base        | Proprietary        | Web Standards        |
| Performance | Slower             | Faster (native APIs) |
| Bundle      | Flexible           | Strict naming        |
| Events      | Application events | Custom events/LMS    |
| Attributes  | `<aura:attribute>` | `@api` properties    |

**Recommendation**: Choose LWC for new development

---

## Common Patterns & Best Practices

### 1. Property Validation

```javascript
@api
get value() {
    return this._value;
}
set value(val) {
    this._value = this.validateValue(val);
}
```

### 2. Conditional Templates

Use `lwc:if/elseif/else` instead of multiple template files (better performance)

### 3. Error Boundaries

```javascript
errorCallback(error, stack) {
    console.error('Error:', error);
    // Show error UI
}
```

### 4. Refs Over Queries

```javascript
// ✅ Preferred
;<div lwc:ref="myDiv"></div>
this.refs.myDiv

// ❌ Less performant
this.template.querySelector("div")
```

### 5. Event Listener Cleanup

```javascript
connectedCallback() {
    window.addEventListener('resize', this.handleResize);
}

disconnectedCallback() {
    window.removeEventListener('resize', this.handleResize);
}
```

---

## Lightning Design System (SLDS)

Salesforce provides base components built on SLDS:

- `lightning-button`
- `lightning-input`
- `lightning-card`
- `lightning-datatable`
- etc.

**Styling Hooks**: Override SLDS component styles using CSS custom properties

---

### ⚠️ MANDATORY DEPLOYMENT (!!**CRITICAL - MUST FOLLOW EVERY TIME**)

**AFTER EVERY LWC COMPONENT CREATION, YOU MUST IMMEDIATELY DEPLOY USING `<sf_deploy_metadata>` TOOL**

**THIS IS NOT OPTIONAL. THIS STEP MUST NOT BE SKIPPED UNDER ANY CIRCUMSTANCES.**

### Strict Deployment Rules

- (**!CRITICAL**) **You MUST use the `<sf_deploy_metadata>` tool for ALL LWC deployments**
- (**!CRITICAL**) **Do NOT attempt to use CLI commands like `sf project deploy start`**
- (**!CRITICAL**) **Do NOT skip this step - deployment is MANDATORY after every LWC component creation**
- (**!CRITICAL**) **Before deploying LWC components, ensure ALL required Apex classes are deployed first**
- Deploy only the metadata files and component bundles that were created or modified — do NOT deploy the entire metadata folder
- Deploying the whole folder can introduce unrelated dependencies and cause avoidable deployment failures

### Mandatory Deployment Workflow

1. **Verify all Apex dependencies are deployed** (this step is MANDATORY)
2. **Use `<sf_deploy_metadata>` tool with the LWC component file path** (this step is MANDATORY)
3. **The tool will automatically validate (dry-run) the deployment** (automatic)
4. **If validation is successful, the tool will proceed with deployment** (automatic)
5. **If there are errors, fix them immediately and retry the deployment using the tool** (this step is MANDATORY)

**MUST DO THIS AFTER EVERY SINGLE LWC COMPONENT - NO EXCEPTIONS**

## Development Tools

### Local Development

```bash
sfdx force:lightning:lwc:start
```

- Runs components locally
- Hot reload
- Proxies org data

### Debug Mode

Enable for specific users to get:

- Custom formatters for proxies
- LWC engine warnings
- Enhanced console logging

---

## Key Limitations & Gotchas

1. **Constructor limitations**: Cannot add host attributes, access children
2. **ID selectors**: Don't use in CSS (IDs get transformed in shadow DOM)
3. **@track requirement**: Only for deep observation of objects/arrays
4. **Wire data**: Always read-only (immutable)
5. **renderedCallback()**: Don't update reactive state (infinite loops)
6. **File size**: 1 MB max for JavaScript files
7. **No namespace imports**: Cannot use `import * as name`
8. **Expando properties**: Not reactive

---

## Architecture Decision Highlights for AI

When reasoning about LWC:

1. **It's Web Standards First**: Assume standard HTML/CSS/JS behavior unless Salesforce adds specific abstraction
2. **Shadow DOM is Default**: CSS and DOM querying behave differently than plain HTML
3. **Reactivity is Built-in**: Unlike React (manual state), fields are automatically reactive
4. **Decorators Add Salesforce Magic**: `@api`, `@track`, `@wire` are the key differentiators
5. **LDS Caching is Powerful**: Wire adapters share cached data across all components
6. **Security is Enforced**: Cannot bypass CRUD/FLS through framework
7. **Performance is Optimized**: Virtual DOM + native APIs = fast rendering

---

## Resources

- **Component Library**: https://developer.salesforce.com/docs/component-library
- **LWC Recipes**: https://github.com/trailheadapps/lwc-recipes
- **LWC OSS**: https://lwc.dev (for non-Salesforce use)
- **API Reference**: https://developer.salesforce.com/docs/platform/lwc/guide

---

## Summary for AI Context

Lightning Web Components represents Salesforce's embrace of web standards. As an AI with modern web development knowledge, understand that LWC is:

- **95% standard web tech** (HTML, CSS, ES6 modules, Web Components)
- **5% Salesforce enhancements** (decorators, LDS, security enforcement)

The framework's goal: minimal abstraction, maximum performance, standards-compliant. When helping developers, emphasize web standards first, then explain Salesforce-specific additions.
