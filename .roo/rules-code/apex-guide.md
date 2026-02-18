## Comprehensive Apex Reference for AI Systems with Programming & Salesforce Knowledge

## ⚠️ MANDATORY WORKFLOW FOR ALL APEX TASKS

**When a prompt is given, you MUST follow this workflow for EVERY Apex-related task:**

### Step 1: 📋 Plan Your Implementation Using Required Patterns

**YOU MUST USE THESE PATTERNS - THIS IS NOT OPTIONAL:**

#### A) Selector Pattern for SOQL (MANDATORY)

- **All SOQL queries MUST be in Selector classes**
- **One Selector class per SObject** (e.g., `OpportunitySelector`, `AccountSelector`)
- **Naming**: `<ObjectName>Selector`
- **Methods return Lists/Sets**, never single records

**Example:**

```apex
public with sharing class OpportunitySelector {
    /**
     * Get opportunities by stage name
     * @param strStageName The stage name to filter by
     * @return List of Opportunity records
     */
    public static List<Opportunity> getByStage(String strStageName) {
        return [
            SELECT Id, Name, Amount, CloseDate, StageName
            FROM Opportunity
            WHERE StageName = :strStageName
            WITH USER_MODE
        ];
    }
}
```

#### B) Service Pattern for Business Logic (MANDATORY)

- **All business logic MUST be in Service classes**
- **Controllers should only call Service classes, NOT Selectors directly**
- **Naming**: `<ObjectName>Service`
- **Methods are entry points for business operations**

**Example:**

```apex
public with sharing class OpportunityService {
    /**
     * Get prospecting opportunities for display
     * @return List of Opportunity records with Prospecting stage
     */
    public static List<Opportunity> getProspectingOpportunities() {
        // Call Selector for data retrieval
        List<Opportunity> listOpportunities = OpportunitySelector.getByStage('Prospecting');

        // Add any business logic/transformations here if needed

        return listOpportunities;
    }
}
```

#### C) Controller for LWC (MANDATORY NAMING CONVENTIONS)

- **Naming**: `<ComponentName>Controller`
- **All methods must be @AuraEnabled**
- **Use Service classes, NOT Selector classes directly**
- **Follow variable naming conventions**

**Example:**

```apex
public with sharing class OpportunityListController {
    /**
     * Get prospecting opportunities for LWC component
     * @return List of Opportunity records
     */
    @AuraEnabled(cacheable=true)
    public static List<Opportunity> getProspectingOpportunities() {
        try {
            // Call Service class
            return OpportunityService.getProspectingOpportunities();
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
```

### Step 2: 🔤 Follow Naming Conventions (MANDATORY)

**YOU MUST USE THESE NAMING CONVENTIONS:**

#### Variables:

- **Lists**: `listOpportunities`, `listAccounts`, `listContacts`
- **Sets**: `setOpportunityIds`, `setAccountIds`
- **Maps**: `mapOppById`, `mapAccByName`
- **Strings**: `strStageName`, `strAccountName`
- **Integers**: `intCount`, `intIndex`
- **Booleans**: `isValid`, `hasErrors`, `shouldProcess`

#### Classes:

- **Selectors**: `OpportunitySelector`, `AccountSelector`
- **Services**: `OpportunityService`, `AccountService`
- **Controllers**: `OpportunityListController`, `AccountCardController`

#### Methods:

- **camelCase with verb**: `getProspectingOpportunities()`, `validateAccount()`, `createOrder()`

### Step 3: 📝 Implementation Checklist

Before writing ANY code, verify:

- [ ] 📋 Planned to use Selector pattern for SOQL
- [ ] 📋 Planned to use Service pattern for business logic
- [ ] 🔤 Will follow naming conventions (list/set/map/str/int prefixes)
- [ ] 🔒 Will use `WITH USER_MODE` or `WITH SECURITY_ENFORCED` in SOQL
- [ ] 📦 Will use `with sharing` on classes
- [ ] 📄 Will create XML metadata files for each class

### Step 4: ⚡ Create Classes in This Order

1. **First**: Create Selector class(es) with SOQL queries
2. **Second**: Create Service class(es) that call Selector(s)
3. **Third**: Create Controller class(es) that call Service(s)
4. **Fourth**: Create corresponding XML metadata files for each class

### ❌ ANTI-PATTERNS TO AVOID

❌ **NEVER put SOQL directly in Controller classes**
❌ **NEVER put SOQL directly in LWC JavaScript files**
❌ **NEVER skip the Selector pattern**
❌ **NEVER skip the Service pattern**
❌ **NEVER use variable names without prefixes** (e.g., `opportunities` instead of `listOpportunities`)
❌ **NEVER create a Controller that directly calls Selector** - always go through Service

### ✅ CORRECT PATTERN

```
LWC Component
    ↓ calls
Controller (@AuraEnabled method)
    ↓ calls
Service (business logic)
    ↓ calls
Selector (SOQL queries)
    ↓ returns data
```

---

## Executive Summary

**Apex** is Salesforce's proprietary, strongly-typed, object-oriented programming language that executes on the Salesforce Platform server. It's syntactically similar to Java but specifically designed for building business logic that operates on Salesforce data within a multi-tenant cloud environment.

**Key Characteristics:**

- **Server-side execution only** (no client-side Apex)
- **Multi-tenant enforced** via governor limits
- **Case-insensitive** (unlike most languages)
- **Automatically compiled** at deploy time (no local compiler)
- **API version tied** for backward compatibility
- **Transactional by default** with automatic rollback on exceptions

---

## Table of Contents

1. [Naming Conventions & Standards](#naming-conventions--standards)
2. [Language Fundamentals](#language-fundamentals)
3. [Data Types](#data-types)
4. [Collections](#collections)
5. [Classes, Interfaces & Enums](#classes-interfaces--enums)
6. [Apex Class Architecture Patterns](#apex-class-architecture-patterns)
7. [SOQL & SOSL](#soql--sosl)
8. [DML Operations](#dml-operations)
9. [Governor Limits & Bulkification](#governor-limits--bulkification)
10. [Asynchronous Apex](#asynchronous-apex)
11. [Security & Sharing](#security--sharing)
12. [Triggers](#triggers)
13. [Key Namespaces](#key-namespaces)
14. [Exception Handling](#exception-handling)
15. [Integration Standards](#integration-standards)
16. [Best Practices](#best-practices)
17. [Governance & Developer Checklist](#governance--developer-checklist)

---

## Creation of XML: (!!**IMPORTANT**)

- After creation of apex class immediatly create it's XML file too WITHOUT ASKING.

## User-Provided Guidelines Priority (**HIGHEST PRIORITY**)

- **When the user provides code or project guidelines in a BRD (Business Requirement Document), you MUST prioritize those guidelines above all else.**
- User-provided guidelines have the **HIGHEST PRIORITY** and override any default patterns or best practices mentioned in this guide.
- If there is a conflict between user guidelines and this reference guide, always follow the user's guidelines.
- Examples of user guidelines include:
    - Naming conventions specific to the project
    - Code structure and architecture patterns
    - Error handling approaches
    - Testing strategies
    - Documentation standards
    - Deployment processes
- Always acknowledge and confirm user-provided guidelines before proceeding with implementation.

---

## Naming Conventions & Standards

Consistent naming is critical for maintainability and code readability. Use the following standards for all Apex classes, variables, and components.

### General Apex Naming

| Component      | Format                 | Pattern / Example                                          |
| -------------- | ---------------------- | ---------------------------------------------------------- |
| **Classes**    | PascalCase             | `OrderService`, `AccountTriggerHandler`, `AccountSelector` |
| **Interfaces** | PascalCase + Suffix    | `IntegrationStrategyInterface`                             |
| **Methods**    | camelCase (Verb-based) | `createOrder()`, `validateInput()`, `syncToSAP()`          |
| **Variables**  | camelCase              | `accountList`, `hasErrors`, `retryCount`                   |
| **Constants**  | ALL_CAPS (Underscore)  | `MAX_RETRY_COUNT`, `SAP_ENDPOINT_NAME`                     |
| **Triggers**   | PascalCase             | `<ObjectName>Trigger` (e.g., `AccountTrigger`)             |

### Primitive Variable Prefixes (Optional but Recommended)

Use type-based prefixes to improve readability and consistency:

| Data Type    | Prefix              | Example                                |
| ------------ | ------------------- | -------------------------------------- |
| **Integer**  | `int`               | `intRetryCount`, `intIndex`            |
| **Decimal**  | `dec`               | `decTotalAmount`, `decDiscountRate`    |
| **Double**   | `dbl`               | `dblPercentage`, `dblRatio`            |
| **Long**     | `lng`               | `lngRecordCount`, `lngExecutionTimeMs` |
| **String**   | `str`               | `strAccountName`, `strErrorMessage`    |
| **Boolean**  | `is`/`has`/`should` | `isValid`, `hasErrors`, `shouldSync`   |
| **Date**     | `dt`                | `dtStartDate`, `dtEndDate`             |
| **Datetime** | `dtm`               | `dtmCreatedOn`, `dtmLastRunAt`         |
| **Id**       | `id`                | `idAccount`, `idContact`               |

### Collection Naming Patterns

| Collection Type | Prefix                | Example                                          |
| --------------- | --------------------- | ------------------------------------------------ |
| **List**        | `list`                | `listAccounts`, `listOrders`, `listWrapAccounts` |
| **Set**         | `set`                 | `setAccountIds`, `setEmailIds`                   |
| **Map**         | `map`                 | `mapAccById`, `mapOppByStage`, `mapConfigByName` |
| **Wrapper/DTO** | Suffix DTO or Wrapper | `OrderDTO`, `ProductDTO`, `AccountWrapper`       |

### Automation Naming Standards

Apply consistent naming to declarative automation to prevent conflicts and ensure sortability:

| Component                 | Format                          | Example                                                                                    |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| **Validation Rule**       | `{Object}{Validation}{Purpose}` | `AccountValidationForTaxCalculation`                                                       |
| **Record-Triggered Flow** | `{Object}{RTF}{Event}{Purpose}` | `AccountRTFAfterUpdateForTerritoryAssignment`<br>`ContactRTFBeforeInsertForAutoEnrollment` |
| **Screen Flow**           | `{Object}{ScreenFlow}{Purpose}` | `CaseScreenFlowForIntake`                                                                  |
| **Auto-Launched Flow**    | `{Object}{Flow}{Purpose}`       | `OpportunityFlowForDiscountProcessing`                                                     |
| **Workflow Rule**         | `{Object}{Workflow}{Purpose}`   | `LeadWorkflowAlertSalesManager`                                                            |
| **Approval Process**      | `{Object}{Approval}{Purpose}`   | `OpportunityApprovalDiscountRequest`                                                       |

**Note:** While prefixes are optional for primitive variables, using them consistently across your team improves code clarity and reduces ambiguity.

---

## Language Fundamentals

### Syntax Overview

```apex
// Case-insensitive language
String name = 'John';
string NAME = 'Jane';  // Same as String (case-insensitive)

// Strongly-typed
Integer count = 10;
// count = 'text';  // Compile error

// Semicolons required
System.debug('Hello World');
```

### Key Differences from Java

| Feature                  | Java               | Apex                                        |
| ------------------------ | ------------------ | ------------------------------------------- |
| **Case Sensitivity**     | Case-sensitive     | **Case-insensitive**                        |
| **Execution**            | Local JVM          | **Server-side only**                        |
| **Compiler**             | Local javac        | **Deploy-time compilation**                 |
| **Default Modifiers**    | Package-private    | **Public** (classes), **Private** (methods) |
| **Methods/Classes**      | Virtual by default | **Final by default**                        |
| **Generics**             | Full support       | **System types only** (no custom)           |
| **Annotations**          | Custom supported   | **System only** (no custom)                 |
| **Collections**          | Interfaces         | **Classes** (List, Set, Map)                |
| **Static Inner Classes** | Explicit `static`  | **Implicit static** (no keyword needed)     |
| **Threads**              | Full access        | **No direct access**                        |

### Variable Declaration

```apex
// Local variables
Integer count = 0;
String message;  // Defaults to null

// Class variables
public class MyClass {
    private String instanceVar;
    public static Integer classVar = 0;

    // Static can't be accessed through instances
    // MyClass instance = new MyClass();
    // instance.classVar; // Compile error
    // MyClass.classVar; // Correct
}
```

### Access Modifiers

```apex
// PRIVATE: Default for methods, visible only within class
private void helperMethod() { }

// PUBLIC: Default for classes, visible to organization
public class MyClass { }

// GLOBAL: Visible to all orgs (for managed packages)
global class PackageClass { }

// PROTECTED: Available to extending classes
public virtual class Parent {
    protected Integer protectedVar;
}

// NO PACKAGE-PRIVATE equivalent in Apex
```

### Class Modifiers

```apex
// VIRTUAL: Can be extended and methods overridden
public virtual class BaseClass {
    public virtual void doSomething() { }
}

// ABSTRACT: Cannot be instantiated
public abstract class AbstractClass {
    public abstract void mustImplement();
}

// WITH SHARING: Enforces record-level security
public with sharing class SecureClass { }

// WITHOUT SHARING: Runs in system mode
public without sharing class SystemClass { }

// INHERITED SHARING: Inherits sharing from caller
public inherited sharing class FlexibleClass { }
```

---

## Data Types

### Primitive Types

```apex
// INTEGER: 32-bit signed
Integer count = 100;
Integer nullInt;  // null by default

// LONG: 64-bit signed
Long bigNumber = 9223372036854775807L;

// DOUBLE: 64-bit floating point
Double price = 99.99;

// DECIMAL: Arbitrary precision (recommended for currency)
Decimal amount = 199.99;
Decimal precise = Decimal.valueOf('0.1');  // Avoids floating point errors

// BOOLEAN
Boolean isActive = true;
Boolean hasPermission = false;

// STRING: Immutable, case-insensitive comparisons
String name = 'John Doe';
String quote = 'It\'s amazing';  // Escape single quote
String multiLine = 'Line 1\nLine 2';

// ID: 15 or 18 character Salesforce record ID
Id recordId = '001000000000001AAA';

// DATE
Date today = Date.today();
Date custom = Date.newInstance(2025, 1, 15);

// TIME
Time now = Time.newInstance(14, 30, 0, 0);  // Hour, min, sec, ms

// DATETIME
Datetime rightNow = Datetime.now();
Datetime custom = Datetime.newInstance(2025, 1, 15, 14, 30, 0);

// BLOB: Binary data
Blob data = Blob.valueOf('Text');
Blob base64 = EncodingUtil.base64Decode('SGVsbG8=');

// OBJECT: Root of all types
Object anything = 'Can be any type';
String str = (String)anything;  // Cast required
```

### Type Conversion

```apex
// String to Integer
Integer num = Integer.valueOf('123');

// Integer to String
String str = String.valueOf(123);

// String to Decimal
Decimal dec = Decimal.valueOf('99.99');

// Type checking
Object obj = 'Hello';
if (obj instanceof String) {
    String str = (String)obj;
}
```

### Null Handling

```apex
// All variables can be null
Integer nullInt;  // null
String nullStr;   // null

// Null-safe navigation (NO BUILT-IN OPERATOR like ?.)
// Must check manually
Account acc = null;
// String name = acc.Name;  // NullPointerException
String name = (acc != null) ? acc.Name : null;  // Safe
```

---

## Collections

Apex provides three collection types as **classes** (not interfaces like Java):

### List (Ordered, Allows Duplicates)

```apex
// Declaration
List<String> names = new List<String>();
List<Integer> nums = new List<Integer>{1, 2, 3};

// Array notation (syntactic sugar)
String[] namesArray = new String[]{};
Integer[] numsArray = new Integer[]{1, 2, 3};

// Common methods
names.add('John');
names.add(0, 'Jane');  // Insert at index
names.size();          // Get size
names.get(0);          // Access by index
names.set(0, 'Jack'); // Update by index
names.remove(0);       // Remove by index
names.clear();         // Remove all
names.isEmpty();       // Check if empty
names.contains('John'); // Check contains

// Iteration
for(String name : names) {
    System.debug(name);
}

for(Integer i = 0; i < names.size(); i++) {
    System.debug(names[i]);  // Array-style access
}

// Sorting
names.sort();  // Natural order

// IMPORTANT: Lists can hold max 50,000 records
// For larger datasets, use SOQL for loops
```

### Set (Unordered, No Duplicates)

```apex
// Declaration
Set<String> uniqueNames = new Set<String>();
Set<Id> accountIds = new Set<Id>{'001xxx', '001yyy'};

// Common methods
uniqueNames.add('John');
uniqueNames.add('John');  // Won't add duplicate
uniqueNames.size();
uniqueNames.contains('John');
uniqueNames.remove('John');
uniqueNames.addAll(names);  // Add list elements
uniqueNames.retainAll(otherSet);  // Intersection
uniqueNames.removeAll(otherSet);   // Difference

// Iteration (order not guaranteed)
for(String name : uniqueNames) {
    System.debug(name);
}

// Use case: Bulkifying queries
Set<Id> accountIds = new Set<Id>();
for(Contact con : contacts) {
    accountIds.add(con.AccountId);
}
List<Account> accs = [SELECT Id FROM Account WHERE Id IN :accountIds];
```

### Map (Key-Value Pairs)

```apex
// Declaration
Map<String, Integer> scores = new Map<String, Integer>();
Map<Id, Account> accountMap = new Map<Id, Account>();

// Initialization
Map<String, String> labels = new Map<String, String>{
    'firstName' => 'First Name',
    'lastName' => 'Last Name'
};

// Common methods
scores.put('John', 95);
scores.get('John');        // Returns 95
scores.containsKey('John');
scores.remove('John');
scores.keySet();           // Returns Set<String>
scores.values();           // Returns List<Integer>
scores.size();
scores.isEmpty();

// Iteration
for(String key : scores.keySet()) {
    Integer value = scores.get(key);
    System.debug(key + ': ' + value);
}

// Direct construction from SOQL
Map<Id, Account> accountMap = new Map<Id, Account>(
    [SELECT Id, Name FROM Account]
);

// Map of Lists pattern (common)
Map<Id, List<Contact>> accountToContacts = new Map<Id, List<Contact>>();
for(Contact con : contacts) {
    if(!accountToContacts.containsKey(con.AccountId)) {
        accountToContacts.put(con.AccountId, new List<Contact>());
    }
    accountToContacts.get(con.AccountId).add(con);
}

// LIMIT: Max 5 levels of nested collections
// Map<String, Map<String, Map<String, Map<String, Map<String, String>>>>>
// This works, but 6 levels would fail
```

### Collection Best Practices

```apex
// ✅ Use specific types
List<Account> accounts = new List<Account>();

// ❌ Avoid untyped collections
List<Object> mixed = new List<Object>();

// ✅ Initialize with capacity hint for large collections
List<Account> largeList = new List<Account>(10000);

// ✅ Use Maps for lookups (O(1) vs O(n))
Map<Id, Account> accountMap = new Map<Id, Account>([SELECT Id FROM Account]);
Account acc = accountMap.get(someId);  // Fast

// ❌ Avoid searching lists
for(Account acc : accountList) {  // Slow O(n)
    if(acc.Id == someId) { }
}
```

---

## Classes, Interfaces & Enums

### Class Declaration

```apex
// Basic class
public class Calculator {
    // Instance variable
    private Integer result;

    // Constructor
    public Calculator() {
        this.result = 0;
    }

    // Constructor overloading
    public Calculator(Integer initialValue) {
        this.result = initialValue;
    }

    // Instance method
    public void add(Integer value) {
        this.result += value;
    }

    // Static method
    public static Integer multiply(Integer a, Integer b) {
        return a * b;
    }

    // Property with getter/setter
    public Integer Result {
        get { return result; }
        set { result = value; }
    }

    // Auto-property
    public String Name { get; set; }
}

// Usage
Calculator calc = new Calculator();
calc.add(10);
System.debug(calc.Result);  // 10

Integer product = Calculator.multiply(5, 3);  // Static call
```

### Inheritance

```apex
// Base class must be VIRTUAL or ABSTRACT
public virtual class Animal {
    public virtual void makeSound() {
        System.debug('Some sound');
    }
}

// Extending class uses EXTENDS
public class Dog extends Animal {
    // Override requires OVERRIDE keyword
    public override void makeSound() {
        System.debug('Woof!');
    }
}

// Abstract class
public abstract class Shape {
    public abstract Decimal getArea();

    public void display() {
        System.debug('Area: ' + getArea());
    }
}

public class Circle extends Shape {
    private Decimal radius;

    public Circle(Decimal r) {
        this.radius = r;
    }

    public override Decimal getArea() {
        return Math.PI * radius * radius;
    }
}
```

### Interfaces

```apex
// Interface declaration
public interface Printable {
    void print();
    String getContent();
}

// Implementation
public class Document implements Printable {
    private String content;

    public Document(String content) {
        this.content = content;
    }

    public void print() {
        System.debug(content);
    }

    public String getContent() {
        return content;
    }
}

// Multiple interfaces
public class MyClass implements Interface1, Interface2 {
    // Must implement all methods
}

// Built-in interfaces
// - Database.Batchable<SObject>
// - Queueable
// - Schedulable
// - Comparable
```

### Enums

```apex
// Enum declaration
public enum Season {
    WINTER, SPRING, SUMMER, FALL
}

// Usage
Season current = Season.SUMMER;

// Enum methods
String name = current.name();    // 'SUMMER'
Integer ordinal = current.ordinal();  // 2 (zero-indexed)

// Enum in switch
switch on current {
    when WINTER {
        System.debug('Cold');
    }
    when SUMMER {
        System.debug('Hot');
    }
    when else {
        System.debug('Moderate');
    }
}

// Built-in enums
System.LoggingLevel level = System.LoggingLevel.DEBUG;
System.StatusCode status = System.StatusCode.CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY;
```

### Inner Classes

```apex
public class OuterClass {
    // Inner class (implicitly static)
    public class InnerClass {
        public void doSomething() {
            // Can access outer class static members
        }
    }

    // Static keyword not needed (and not allowed for inner classes)
    private Integer outerVar;

    public void createInner() {
        InnerClass inner = new InnerClass();
    }
}

// Instantiation
OuterClass.InnerClass inner = new OuterClass.InnerClass();
```

---

## Apex Class Architecture Patterns

### Service Class Pattern

Business logic should reside in **Service classes**, not Triggers or Controllers. Service classes provide reusable, testable business logic that can be called from multiple contexts.

**✅ Recommended Structure:**

1. Class-level constants
2. Public service methods (entry points)
3. Private helper methods
4. Inner wrapper/DTO classes (if needed)

```apex
public with sharing class OrderService {
    private static final Integer MAX_RETRY_COUNT = 3;

    /**
     * Public entry method to create orders for given Account Ids.
     * @param listAccountIds List of Account Ids to create orders for
     * @return List of created Order records
     */
    public static List<Order__c> createOrdersForAccounts(List<Id> listAccountIds) {
        // Validation
        if (listAccountIds == null || listAccountIds.isEmpty()) {
            return new List<Order__c>();
        }

        // Query using Selector pattern
        List<Account> listAccounts = AccountSelector.getByIds(new Set<Id>(listAccountIds));

        // Build orders using helper method
        List<Order__c> listOrdersToInsert = buildOrders(listAccounts);

        // DML operation
        if (!listOrdersToInsert.isEmpty()) {
            insert listOrdersToInsert;
        }

        return listOrdersToInsert;
    }

    /**
     * Private helper to build Orders from Accounts.
     * @param listAccounts List of Account records
     * @return List of Order records ready for insert
     */
    private static List<Order__c> buildOrders(List<Account> listAccounts) {
        List<Order__c> listOrders = new List<Order__c>();
        for (Account acc : listAccounts) {
            listOrders.add(new Order__c(
                Account__c = acc.Id,
                Name = acc.Name + ' - Auto Order',
                Status__c = 'Draft'
            ));
        }
        return listOrders;
    }
}
```

### Selector Pattern (SOQL Encapsulation)

Centralize all SOQL queries in Selector classes to promote reusability and maintainability.

- **Rule:** One selector per SObject (e.g., `AccountSelector`).
- **Rule:** Methods should return Lists/Sets, not single records.

```apex
public with sharing class AccountSelector {
    public static List<Account> getByIds(Set<Id> setAccountIds) {
        if (setAccountIds == null || setAccountIds.isEmpty()) {
            return new List<Account>();
        }
        return [
            SELECT Id, Name, Industry, AnnualRevenue
            FROM Account
            WHERE Id IN :setAccountIds
        ];
    }
}
```

---

## SOQL & SOSL

### SOQL (Salesforce Object Query Language)

SOQL is similar to SQL SELECT but specifically for Salesforce data.

#### Basic SOQL

```apex
// Inline SOQL (square brackets)
List<Account> accounts = [SELECT Id, Name FROM Account];

// With WHERE clause
List<Account> activeAccounts = [
    SELECT Id, Name, Industry
    FROM Account
    WHERE IsActive__c = true
];

// Binding variables (prevents SOQL injection)
String searchName = 'ACME';
List<Account> results = [
    SELECT Id, Name
    FROM Account
    WHERE Name = :searchName
];

// Collection binding
Set<Id> accountIds = new Set<Id>{'001xxx', '001yyy'};
List<Account> accounts = [
    SELECT Id, Name
    FROM Account
    WHERE Id IN :accountIds
];

// LIMIT and ORDER BY
List<Account> topAccounts = [
    SELECT Id, Name, AnnualRevenue
    FROM Account
    ORDER BY AnnualRevenue DESC
    LIMIT 10
];

// OFFSET (for pagination)
List<Account> page2 = [
    SELECT Id, Name
    FROM Account
    LIMIT 10
    OFFSET 10
];
```

#### Relationship Queries

```apex
// Parent-to-Child (Subqueries)
List<Account> accountsWithContacts = [
    SELECT Id, Name,
        (SELECT Id, FirstName, LastName FROM Contacts)
    FROM Account
];

// Access child records
for(Account acc : accountsWithContacts) {
    for(Contact con : acc.Contacts) {
        System.debug(con.FirstName);
    }
}

// Child-to-Parent (Dot Notation)
List<Contact> contacts = [
    SELECT Id, FirstName, Account.Name, Account.Industry
    FROM Contact
];

// Access parent fields
for(Contact con : contacts) {
    System.debug(con.Account.Name);
}

// Multi-level relationships (up to 5 levels)
List<Contact> contacts = [
    SELECT Id, Account.Owner.Profile.Name
    FROM Contact
];
```

#### Aggregate Functions

```apex
// COUNT
AggregateResult[] results = [
    SELECT COUNT(Id) totalCount
    FROM Account
];
Integer count = (Integer)results[0].get('totalCount');

// GROUP BY
AggregateResult[] results = [
    SELECT Industry, COUNT(Id) cnt
    FROM Account
    GROUP BY Industry
];

for(AggregateResult ar : results) {
    String industry = (String)ar.get('Industry');
    Integer count = (Integer)ar.get('cnt');
}

// Other functions: SUM, AVG, MIN, MAX
AggregateResult[] results = [
    SELECT
        SUM(Amount) total,
        AVG(Amount) average,
        MIN(Amount) minimum,
        MAX(Amount) maximum
    FROM Opportunity
];
```

#### Dynamic SOQL

```apex
// Build query as string
String objectName = 'Account';
String fieldName = 'Name';
String searchValue = 'ACME';

String query = 'SELECT Id, ' + fieldName +
               ' FROM ' + objectName +
               ' WHERE ' + fieldName + ' = :searchValue';

List<SObject> results = Database.query(query);

// CRITICAL: Sanitize user input to prevent SOQL injection
String sanitized = String.escapeSingleQuotes(userInput);
```

#### SOQL For Loops (for large datasets)

```apex
// Regular query limited to 50,000 records
// List<Account> accounts = [SELECT Id FROM Account];

// SOQL for loop processes in batches (no heap limit)
for(Account acc : [SELECT Id, Name FROM Account]) {
    // Process each account
    // Internally batched by platform
}

// Batch list processing
for(List<Account> accBatch : [SELECT Id FROM Account]) {
    // Process batch of 200 records
    // More efficient for DML operations
}
```

#### SOQL Best Practices

```apex
// ✅ Select only needed fields
List<Account> accounts = [SELECT Id, Name FROM Account];

// ❌ Avoid selecting all fields
// List<Account> accounts = [SELECT FIELDS(ALL) FROM Account];

// ✅ Use WHERE clause to filter
List<Account> active = [SELECT Id FROM Account WHERE IsActive__c = true];

// ✅ Use indexed fields in WHERE (Id, Name, external IDs)
// ❌ Avoid filtering on formula fields (not indexed)

// ✅ Bulkify by moving queries out of loops
Set<Id> accountIds = new Set<Id>();
for(Contact con : contacts) {
    accountIds.add(con.AccountId);
}
Map<Id, Account> accountMap = new Map<Id, Account>(
    [SELECT Id, Name FROM Account WHERE Id IN :accountIds]
);

// ❌ NEVER query in a loop
for(Contact con : contacts) {
    Account acc = [SELECT Id FROM Account WHERE Id = :con.AccountId];  // NO!
}
```

#### SOQL Safety & Assignment

Always assign SOQL results to a List, even if you expect one record. This prevents "List has no rows for assignment" exceptions.

```apex
// ❌ BAD: Throws exception if 0 rows returned
Account acc = [SELECT Id FROM Account WHERE Name = 'Acme'];

// ✅ GOOD: Safely handle empty results
List<Account> listAccounts = [SELECT Id FROM Account WHERE Name = 'Acme'];
if (!listAccounts.isEmpty()) {
    Account acc = listAccounts[0];
    // Process account
} else {
    // Handle no results case
    System.debug('No account found');
}

// ✅ GOOD: Alternative with LIMIT 1
List<Account> listAccounts = [SELECT Id FROM Account WHERE Name = 'Acme' LIMIT 1];
Account acc = listAccounts.isEmpty() ? null : listAccounts[0];
```

### SOSL (Salesforce Object Search Language)

SOSL is used for text-based searches across multiple objects.

```apex
// Basic SOSL
List<List<SObject>> searchResults = [
    FIND 'ACME'
    IN ALL FIELDS
    RETURNING Account(Id, Name), Contact(Id, Name)
];

// Access results
List<Account> accounts = searchResults[0];
List<Contact> contacts = searchResults[1];

// SOSL with filters
List<List<SObject>> results = [
    FIND 'John'
    IN NAME FIELDS
    RETURNING Contact(Id, Name WHERE Department = 'Sales')
];

// Dynamic SOSL
String searchTerm = 'ACME';
String query = 'FIND :searchTerm IN ALL FIELDS RETURNING Account(Id, Name)';
List<List<SObject>> results = Search.query(query);
```

#### SOQL vs SOSL

| Feature            | SOQL                        | SOSL                       |
| ------------------ | --------------------------- | -------------------------- |
| **Purpose**        | Retrieve specific records   | Text search across objects |
| **Syntax**         | SELECT ... FROM ...         | FIND ... RETURNING ...     |
| **Objects**        | Single object (+ related)   | Multiple objects           |
| **Performance**    | Faster for specific queries | Optimized for text search  |
| **Return Type**    | List<SObject>               | List<List<SObject>>        |
| **Governor Limit** | 100 queries/transaction     | 20 searches/transaction    |

---

## DML Operations

DML (Data Manipulation Language) is used to insert, update, upsert, delete, undelete, and merge records.

### DML Statements

```apex
// INSERT
Account acc = new Account(Name = 'ACME Corp');
insert acc;
System.debug(acc.Id);  // Id populated after insert

// Bulk insert
List<Account> accounts = new List<Account>();
accounts.add(new Account(Name = 'Account 1'));
accounts.add(new Account(Name = 'Account 2'));
insert accounts;

// UPDATE
acc.Industry = 'Technology';
update acc;

// UPSERT (insert or update based on external ID or Id)
Account acc = new Account(
    ExternalId__c = 'EXT123',
    Name = 'ACME Corp'
);
upsert acc ExternalId__c;  // Updates if exists, inserts if not

// DELETE
delete acc;

// UNDELETE (restore from recycle bin)
undelete acc;

// MERGE (combine duplicate records)
Account master = accounts[0];
Account duplicate = accounts[1];
merge master duplicate;  // Duplicate merged into master
```

### Database Class Methods

Database methods provide more control than DML statements:

```apex
// Partial success option
Database.SaveResult[] results = Database.insert(accounts, false);

// Check results
for(Database.SaveResult sr : results) {
    if(sr.isSuccess()) {
        System.debug('Success: ' + sr.getId());
    } else {
        for(Database.Error err : sr.getErrors()) {
            System.debug('Error: ' + err.getMessage());
        }
    }
}

// Other Database methods
Database.SaveResult sr = Database.insert(acc, false);
Database.SaveResult sr = Database.update(acc, false);
Database.UpsertResult ur = Database.upsert(acc, false);
Database.DeleteResult dr = Database.delete(acc, false);
Database.UndeleteResult udr = Database.undelete(acc, false);
Database.MergeResult mr = Database.merge(master, duplicate, false);

// DML with allOrNone parameter
// true: All-or-nothing (throws exception on any error) - DEFAULT
// false: Partial success (returns results, no exception)
```

### DML vs Database Methods

| Aspect                 | DML Statement     | Database Method          |
| ---------------------- | ----------------- | ------------------------ |
| **Syntax**             | `insert acc;`     | `Database.insert(acc);`  |
| **Partial Success**    | No                | Yes (with `false` param) |
| **Exception Handling** | Throws exception  | Returns result objects   |
| **Use Case**           | Simple operations | Complex error handling   |

### Transaction Control

```apex
// SAVEPOINT
Savepoint sp = Database.setSavepoint();

try {
    insert account1;
    insert account2;  // This might fail
} catch(Exception e) {
    // Rollback to savepoint
    Database.rollback(sp);
}

// Transactions are automatic
// All DML operations in a transaction are committed or rolled back together
```

### DML Limitations & Best Practices

```apex
// ✅ Bulkify DML (operate on lists)
List<Account> accounts = new List<Account>();
for(Integer i = 0; i < 200; i++) {
    accounts.add(new Account(Name = 'Account ' + i));
}
insert accounts;  // Single DML operation

// ❌ NEVER perform DML in a loop
for(Integer i = 0; i < 200; i++) {
    insert new Account(Name = 'Account ' + i);  // 200 DML operations! NO!
}

// Governor Limit: 150 DML statements per transaction
// Each DML statement can process up to 10,000 records

// ✅ Collect records, then perform single DML
List<Contact> contactsToUpdate = new List<Contact>();
for(Account acc : accounts) {
    for(Contact con : acc.Contacts) {
        con.Department__c = acc.Industry;
        contactsToUpdate.add(con);
    }
}
update contactsToUpdate;
```

---

## Governor Limits & Bulkification

### What Are Governor Limits?

In a multi-tenant environment, Salesforce enforces **governor limits** to prevent any single tenant from monopolizing shared resources. Exceeding a limit throws an **unhandled runtime exception** that cannot be caught.

### Key Limits (Per Transaction)

| Limit Type                          | Synchronous | Asynchronous |
| ----------------------------------- | ----------- | ------------ |
| **Total SOQL queries**              | 100         | 200          |
| **Total records retrieved by SOQL** | 50,000      | 50,000       |
| **Total DML statements**            | 150         | 150          |
| **Total records processed by DML**  | 10,000      | 10,000       |
| **Total Heap Size**                 | 6 MB        | 12 MB        |
| **Maximum CPU time**                | 10,000 ms   | 60,000 ms    |
| **Total SOSL queries**              | 20          | 20           |
| **Callouts (HTTP/Web services)**    | 100         | 100          |
| **Maximum callout time**            | 120 seconds | 120 seconds  |

### Checking Limits

```apex
// Check current usage
Integer queriesUsed = Limits.getQueries();
Integer queriesLimit = Limits.getLimitQueries();
System.debug('Queries: ' + queriesUsed + '/' + queriesLimit);

// Other Limits class methods
Limits.getDmlStatements();
Limits.getDmlRows();
Limits.getHeapSize();
Limits.getCpuTime();
Limits.getCallouts();

// Check before hitting limit
if(Limits.getQueries() < Limits.getLimitQueries()) {
    // Safe to query
}
```

### Bulkification Principles

**Bulkification** means writing code that handles multiple records efficiently to avoid governor limits.

#### Anti-Pattern 1: SOQL in Loops

```apex
// ❌ BAD: Query inside loop
for(Contact con : contacts) {
    Account acc = [SELECT Id, Name FROM Account WHERE Id = :con.AccountId];
    // If 200 contacts, this hits 200 SOQL queries (exceeds 100 limit)
}

// ✅ GOOD: Single query with Set
Set<Id> accountIds = new Set<Id>();
for(Contact con : contacts) {
    accountIds.add(con.AccountId);
}
Map<Id, Account> accountMap = new Map<Id, Account>(
    [SELECT Id, Name FROM Account WHERE Id IN :accountIds]
);

for(Contact con : contacts) {
    Account acc = accountMap.get(con.AccountId);
    // Only 1 SOQL query regardless of contacts count
}
```

#### Anti-Pattern 2: DML in Loops

```apex
// ❌ BAD: DML inside loop
for(Account acc : accounts) {
    acc.Industry = 'Technology';
    update acc;  // If 200 accounts, exceeds 150 DML limit
}

// ✅ GOOD: Collect and perform single DML
List<Account> accountsToUpdate = new List<Account>();
for(Account acc : accounts) {
    acc.Industry = 'Technology';
    accountsToUpdate.add(acc);
}
update accountsToUpdate;  // Single DML operation
```

#### Pattern: Map-Based Processing

```apex
// Common bulkification pattern
Map<Id, List<Contact>> accountToContacts = new Map<Id, List<Contact>>();

// Group contacts by account
for(Contact con : contacts) {
    if(!accountToContacts.containsKey(con.AccountId)) {
        accountToContacts.put(con.AccountId, new List<Contact>());
    }
    accountToContacts.get(con.AccountId).add(con);
}

// Query accounts once
List<Account> accounts = [
    SELECT Id, Name
    FROM Account
    WHERE Id IN :accountToContacts.keySet()
];

// Process efficiently
for(Account acc : accounts) {
    List<Contact> relatedContacts = accountToContacts.get(acc.Id);
    // Process contacts for this account
}
```

### Large Data Volumes

```apex
// For > 50,000 records, use SOQL for loops
for(List<Account> accountBatch : [SELECT Id FROM Account]) {
    // Process batch (200 records per iteration)
    // No heap limit hit
}

// Or use Batch Apex for even larger datasets
```

---

## Asynchronous Apex

**📖 For all asynchronous Apex documentation**: See [asynchronous-apex-guide.md](./asynchronous-apex-guide.md)

This includes Future Methods, Queueable Apex, Batch Apex, Scheduled Apex, error handling, monitoring, and real-world scenarios.

---

## Security & Sharing

### Sharing Modes

Apex runs in **system mode** by default, ignoring user permissions and sharing rules.

```apex
// WITH SHARING: Enforces record-level security
public with sharing class SecureController {
    // Respects user's record access
    public List<Account> getAccounts() {
        return [SELECT Id, Name FROM Account];
    }
}

// WITHOUT SHARING: System mode (ignores sharing)
public without sharing class SystemController {
    // Ignores user's record access
    public List<Account> getAllAccounts() {
        return [SELECT Id, Name FROM Account];
    }
}

// INHERITED SHARING: Inherits from caller
public inherited sharing class FlexibleController {
    // If called from 'with sharing', enforces sharing
    // If called from 'without sharing', ignores sharing
}

// NO MODIFIER: Defaults to without sharing
public class DefaultController {
    // Runs in system mode
}
```

### Security Standards Summary

| Security Feature    | Usage Rule                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Read Access**     | Use `WITH USER_MODE` (API 59+) or `WITH SECURITY_ENFORCED` for user-facing data           |
| **Create/Update**   | Use `Security.stripInaccessible` to enforce field-level security (FLS)                    |
| **Secrets**         | Never log passwords or tokens. Use Named Credentials                                      |
| **SOQL Injection**  | Always use bind variables (`:variable`), never string concatenation                       |
| **Client Exposure** | Do not expose sensitive fields or internal IDs to client-side components unless necessary |

### Object & Field-Level Security

Apex does NOT automatically enforce object-level (CRUD) or field-level security (FLS).

#### Option 1: WITH USER_MODE (Recommended - API 59+)

```apex
public with sharing class SecureSOQL {
    public List<Account> getAccounts() {
        // Enforces object, field, and record-level security
        return [
            SELECT Id, Name, Industry
            FROM Account
            WITH USER_MODE
        ];
    }
}
```

**Note:** When using WITH USER_MODE in SOQL or DML statements, always ensure your Apex class is set to API version 59.0 or higher (Winter '24 or later), as earlier versions do not support this keyword. If your org or class uses an older API version, use `WITH SECURITY_ENFORCED` to enforce object- and field-level security instead.

```apex
// For API versions < 59
public with sharing class LegacySecureSOQL {
    public List<Account> getAccounts() {
        return [
            SELECT Id, Name, Industry
            FROM Account
            WITH SECURITY_ENFORCED
        ];
    }
}
```

#### Option 2: Security.stripInaccessible()

```apex
public class SecureController {
    public List<Account> getAccounts() {
        List<Account> accounts = [SELECT Id, Name, Industry FROM Account];

        // Remove fields user can't access
        SObjectAccessDecision decision = Security.stripInaccessible(
            AccessType.READABLE,
            accounts
        );

        return decision.getRecords();
    }

    public void updateAccounts(List<Account> accounts) {
        // Strip fields user can't update
        SObjectAccessDecision decision = Security.stripInaccessible(
            AccessType.UPDATABLE,
            accounts
        );

        update decision.getRecords();
    }
}

// AccessType enum values:
// - CREATABLE
// - READABLE
// - UPDATABLE
// - UPSERTABLE
```

#### Option 3: Schema Describe (Manual)

```apex
public class ManualSecurityCheck {
    public List<Account> getAccounts() {
        // Check object access
        if(!Schema.sObjectType.Account.isAccessible()) {
            throw new SecurityException('No access to Account');
        }

        // Check field access
        if(!Schema.sObjectType.Account.fields.Name.isAccessible()) {
            throw new SecurityException('No access to Name field');
        }

        return [SELECT Id, Name FROM Account];
    }
}
```

### User Mode vs System Mode

```apex
// System mode (default)
public class SystemModeClass {
    // Sees all records
    // Ignores permissions
    // Can modify any data
}

// User mode
public with sharing class UserModeClass {
    public List<Account> getAccounts() {
        // WITH USER_MODE enforces all security
        return [SELECT Id, Name FROM Account WITH USER_MODE];
    }
}
```

### Best Practices

```apex
// ✅ For Lightning Web Components (@AuraEnabled)
public with sharing class LWCController {
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccounts() {
        return [SELECT Id, Name FROM Account WITH USER_MODE];
    }
}

// ✅ For internal business logic (system mode)
public without sharing class SystemService {
    // Intentionally runs with elevated permissions
}

// ✅ Use inherited sharing when context-dependent
public inherited sharing class FlexibleService {
    // Respects caller's security context
}
```

---

## Triggers

Triggers are Apex code that execute before or after DML operations.

### Trigger Syntax

```apex
trigger AccountTrigger on Account (before insert, before update, after insert, after update) {
    // Trigger logic
}
```

### Trigger Contexts

```apex
trigger AccountTrigger on Account (
    before insert, before update, before delete,
    after insert, after update, after delete, after undelete
) {

    // Context variables
    if(Trigger.isBefore) {
        if(Trigger.isInsert) {
            // Before insert logic
        }
        if(Trigger.isUpdate) {
            // Before update logic
        }
    }

    if(Trigger.isAfter) {
        if(Trigger.isInsert) {
            // After insert logic
        }
    }

    // Access records
    List<Account> newRecords = Trigger.new;  // New values
    List<Account> oldRecords = Trigger.old;  // Old values (update/delete only)
    Map<Id, Account> newMap = Trigger.newMap;  // Id to new record
    Map<Id, Account> oldMap = Trigger.oldMap;  // Id to old record (update/delete only)

    // Trigger size
    Integer size = Trigger.size;
}
```

### Trigger Context Variables

| Variable             | Type             | Available In                                | Description       |
| -------------------- | ---------------- | ------------------------------------------- | ----------------- |
| `Trigger.new`        | List<SObject>    | insert, update, undelete                    | New record values |
| `Trigger.old`        | List<SObject>    | update, delete                              | Old record values |
| `Trigger.newMap`     | Map<Id, SObject> | before update, after insert/update/undelete | Id to new record  |
| `Trigger.oldMap`     | Map<Id, SObject> | update, delete                              | Id to old record  |
| `Trigger.isInsert`   | Boolean          | All                                         | True if insert    |
| `Trigger.isUpdate`   | Boolean          | All                                         | True if update    |
| `Trigger.isDelete`   | Boolean          | All                                         | True if delete    |
| `Trigger.isUndelete` | Boolean          | All                                         | True if undelete  |
| `Trigger.isBefore`   | Boolean          | All                                         | True if before    |
| `Trigger.isAfter`    | Boolean          | All                                         | True if after     |
| `Trigger.size`       | Integer          | All                                         | Number of records |

### Best Practice: Trigger Handler Pattern

**One trigger per object** that delegates to a handler class.

```apex
// Trigger (logic-less)
trigger AccountTrigger on Account (
    before insert, before update,
    after insert, after update
) {
    AccountTriggerHandler.handle();
}

// Handler class
public class AccountTriggerHandler {

    public static void handle() {
        if(Trigger.isBefore) {
            if(Trigger.isInsert) {
                beforeInsert(Trigger.new);
            }
            if(Trigger.isUpdate) {
                beforeUpdate(Trigger.new, Trigger.oldMap);
            }
        }

        if(Trigger.isAfter) {
            if(Trigger.isInsert) {
                afterInsert(Trigger.new);
            }
            if(Trigger.isUpdate) {
                afterUpdate(Trigger.new, Trigger.oldMap);
            }
        }
    }

    private static void beforeInsert(List<Account> newAccounts) {
        for(Account acc : newAccounts) {
            if(String.isBlank(acc.Industry)) {
                acc.Industry = 'Other';
            }
        }
    }

    private static void afterInsert(List<Account> newAccounts) {
        // Create related records
        List<Contact> contacts = new List<Contact>();
        for(Account acc : newAccounts) {
            contacts.add(new Contact(
                LastName = acc.Name,
                AccountId = acc.Id
            ));
        }
        insert contacts;
    }

    private static void beforeUpdate(
        List<Account> newAccounts,
        Map<Id, Account> oldMap
    ) {
        for(Account acc : newAccounts) {
            Account oldAcc = oldMap.get(acc.Id);
            // Check if field changed
            if(acc.Industry != oldAcc.Industry) {
                // Logic for changed industry
            }
        }
    }

    private static void afterUpdate(
        List<Account> newAccounts,
        Map<Id, Account> oldMap
    ) {
        // Update related records
    }
}
```

### Recursion Prevention

```apex
public class AccountTriggerHandler {
    private static Boolean isExecuting = false;

    public static void handle() {
        if(isExecuting) {
            return;  // Prevent recursion
        }

        isExecuting = true;

        // Trigger logic

        isExecuting = false;
    }
}
```

### Trigger Best Practices

```apex
// ✅ One trigger per object
// ❌ Multiple triggers (order not guaranteed)

// ✅ Logic-less triggers (delegate to handler)
trigger AccountTrigger on Account (before insert) {
    AccountTriggerHandler.handle();
}

// ❌ Logic in trigger
trigger AccountTrigger on Account (before insert) {
    for(Account acc : Trigger.new) {
        // Complex logic here - BAD
    }
}

// ✅ Bulkified (process all records at once)
Set<Id> accountIds = new Set<Id>();
for(Contact con : Trigger.new) {
    accountIds.add(con.AccountId);
}
Map<Id, Account> accounts = new Map<Id, Account>([...]);

// ❌ Query/DML in loop
for(Contact con : Trigger.new) {
    Account acc = [SELECT Id FROM Account WHERE Id = :con.AccountId];
}

// ✅ Before triggers for modifying same object
trigger AccountTrigger on Account (before insert) {
    for(Account acc : Trigger.new) {
        acc.Industry = 'Technology';  // No DML needed
    }
}

// ✅ After triggers for modifying related objects
trigger AccountTrigger on Account (after insert) {
    List<Contact> contacts = new List<Contact>();
    for(Account acc : Trigger.new) {
        contacts.add(new Contact(AccountId = acc.Id));
    }
    insert contacts;  // DML on related object
}
```

---

## Key Namespaces

### System Namespace

**Implicit import** - no prefix required (but can use `System.` for clarity)

```apex
// Core functionality
System.debug('Message');
System.assertEquals(expected, actual);
System.now();
System.today();

// Database operations
Database.insert(records);
Database.update(records);
Database.query(queryString);

// HTTP operations
HttpRequest req = new HttpRequest();
Http http = new Http();
HttpResponse res = http.send(req);

// Limits checking
Limits.getQueries();
Limits.getDmlStatements();



// JSON handling
String jsonString = JSON.serialize(obj);
MyClass obj = (MyClass)JSON.deserialize(jsonString, MyClass.class);

// Math operations
Math.abs(-10);
Math.max(5, 10);
Math.random();
Math.round(3.7);

// String operations
String.valueOf(123);
String.isBlank(str);
String.isEmpty(str);
String.escapeSingleQuotes(userInput);
```

### Schema Namespace

**Must use `Schema.` prefix**

```apex
// Get object describe
Schema.DescribeSObjectResult accountDescribe = Schema.SObjectType.Account;

// Check object permissions
Boolean isAccessible = Schema.sObjectType.Account.isAccessible();
Boolean isCreateable = Schema.sObjectType.Account.isCreateable();
Boolean isUpdateable = Schema.sObjectType.Account.isUpdateable();
Boolean isDeletable = Schema.sObjectType.Account.isDeletable();

// Get field describe
Schema.DescribeFieldResult nameField = Schema.SObjectType.Account.fields.Name;

// Field properties
String fieldLabel = nameField.getLabel();
Schema.DisplayType fieldType = nameField.getType();
Integer fieldLength = nameField.getLength();
Boolean isRequired = !nameField.isNillable();
List<Schema.PicklistEntry> picklistValues = nameField.getPicklistValues();

// Get all fields
Map<String, Schema.SObjectField> fieldMap = Schema.SObjectType.Account.fields.getMap();

// Dynamic field access
String fieldName = 'Name';
Schema.SObjectField field = fieldMap.get(fieldName);

// Get all objects
Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
```

### Database Namespace

```apex
// DML with partial success
Database.SaveResult[] results = Database.insert(accounts, false);

// Query
List<Account> accounts = Database.query('SELECT Id FROM Account');

// Count query
Integer count = Database.countQuery('SELECT COUNT() FROM Account');

// Batch operations
Id jobId = Database.executeBatch(new MyBatch(), 200);

// Query locator (for batch)
Database.QueryLocator ql = Database.getQueryLocator([SELECT Id FROM Account]);

// Get query locator iterator
Database.QueryLocatorIterator iterator = ql.iterator();
```

### ConnectApi Namespace (Chatter API)

```apex
// Post to Chatter feed
ConnectApi.FeedElement feedElement = ConnectApi.ChatterFeeds.postFeedElement(
    Network.getNetworkId(),
    ConnectApi.FeedType.Record,
    recordId,
    feedItemInput
);

// Get feed items
ConnectApi.FeedElementPage feedPage = ConnectApi.ChatterFeeds.getFeedElementsFromFeed(
    Network.getNetworkId(),
    ConnectApi.FeedType.News
);

// User info
ConnectApi.UserDetail userDetail = ConnectApi.ChatterUsers.getUserDetail(
    Network.getNetworkId(),
    userId
);
```

### Other Important Namespaces

```apex
// Messaging (Email)
Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
email.setToAddresses(new String[]{'user@example.com'});
email.setSubject('Subject');
email.setPlainTextBody('Body');
Messaging.sendEmail(new Messaging.SingleEmailMessage[]{email});

// Approval
Approval.ProcessSubmitRequest req = new Approval.ProcessSubmitRequest();
req.setObjectId(recordId);
Approval.ProcessResult result = Approval.process(req);

// Flow
Flow.Interview interview = Flow.Interview.createInterview('FlowName', inputMap);
interview.start();

// UserInfo
Id userId = UserInfo.getUserId();
String userName = UserInfo.getUserName();
String userEmail = UserInfo.getUserEmail();
Id profileId = UserInfo.getProfileId();
```

---

## Exception Handling

### Try-Catch-Finally

```apex
try {
    // Code that might throw exception
    Account acc = [SELECT Id FROM Account WHERE Name = 'NonExistent'];
} catch(QueryException e) {
    // Handle specific exception
    System.debug('Query error: ' + e.getMessage());
} catch(Exception e) {
    // Handle any exception
    System.debug('General error: ' + e.getMessage());
} finally {
    // Always executes (cleanup code)
    System.debug('Cleanup');
}
```

### Built-in Exceptions

```apex
// DmlException
try {
    insert new Account();  // Missing required fields
} catch(DmlException e) {
    System.debug('DML Error: ' + e.getDmlMessage(0));
    System.debug('Failed record index: ' + e.getDmlIndex(0));
}

// QueryException (no rows returned by query)
try {
    Account acc = [SELECT Id FROM Account WHERE Name = 'NonExistent' LIMIT 1];
} catch(QueryException e) {
    System.debug('No records found');
}

// ListException (invalid index)
List<String> items = new List<String>{'a', 'b'};
try {
    String item = items.get(10);  // Index out of bounds
} catch(ListException e) {
    System.debug('Invalid index');
}

// NullPointerException
Account acc = null;
try {
    String name = acc.Name;
} catch(NullPointerException e) {
    System.debug('Null reference');
}

// TypeException (invalid cast)
Object obj = 'String';
try {
    Integer num = (Integer)obj;
} catch(TypeException e) {
    System.debug('Invalid cast');
}

// MathException (division by zero)
try {
    Integer result = 10 / 0;
} catch(MathException e) {
    System.debug('Division by zero');
}
```

### Custom Exceptions

```apex
// Define custom exception
public class MyCustomException extends Exception {
    // Optionally add custom properties/methods
}

// Throw custom exception
throw new MyCustomException('Something went wrong');

// Catch custom exception
try {
    throw new MyCustomException('Error');
} catch(MyCustomException e) {
    System.debug(e.getMessage());
}
```

### Exception Methods

```apex
try {
    // Code
} catch(Exception e) {
    String message = e.getMessage();           // Error message
    String stackTrace = e.getStackTraceString();  // Stack trace
    Integer lineNumber = e.getLineNumber();    // Line number
    String typeName = e.getTypeName();         // Exception type

    System.debug('Error: ' + message);
    System.debug('Stack: ' + stackTrace);
}
```

### Governor Limit Exceptions

**CANNOT be caught** - terminate execution immediately

```apex
try {
    // Query in loop (bad code)
    for(Integer i = 0; i < 200; i++) {
        List<Account> accounts = [SELECT Id FROM Account LIMIT 1];
    }
} catch(Exception e) {
    // This WILL NOT catch governor limit exception
    // Exception terminates transaction with full rollback
}

// Check limits proactively
if(Limits.getQueries() >= Limits.getLimitQueries()) {
    throw new LimitException('Approaching SOQL limit');
}
```

---

## Integration Standards

- **Named Credentials:** Always use Named Credentials for endpoints and authentication.
- **DTOs:** Use separate Request and Response DTO (Data Transfer Object) classes.
- **Error Handling:** Handle timeouts and status codes (200 vs 500) gracefully.

**Code Snippet (Callout):**

```apex
HttpRequest httpRequest = new HttpRequest();
httpRequest.setEndpoint('callout:SAP_NC/orders');
httpRequest.setMethod('POST');
httpRequest.setBody(JSON.serialize(orderRequest));

Http http = new Http();
HttpResponse response = http.send(httpRequest);

if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
    return (SAPOrderResponseDTO) JSON.deserialize(response.getBody(), SAPOrderResponseDTO.class);
} else {
    // Log error securely
    throw new SAPIntegrationException('Integration failed: ' + response.getStatus());
}
```

---

## Best Practices

### 1. Bulkification

```apex
// ✅ ALWAYS process collections, never single records
public static void updateAccounts(List<Account> accounts) {
    // Process all accounts
}

// ❌ NEVER accept single records
public static void updateAccount(Account acc) {
    // If called 200 times, inefficient
}

// ✅ Move queries outside loops
Set<Id> accountIds = new Set<Id>();
for(Contact con : contacts) {
    accountIds.add(con.AccountId);
}
List<Account> accounts = [SELECT Id FROM Account WHERE Id IN :accountIds];

// ❌ NEVER query in loop
for(Contact con : contacts) {
    Account acc = [SELECT Id FROM Account WHERE Id = :con.AccountId];
}
```

### 2. SOQL Best Practices

```apex
// ✅ Select only needed fields
List<Account> accounts = [SELECT Id, Name FROM Account];

// ❌ Don't select all fields
// SELECT FIELDS(ALL) or SELECT Id, Name, ... (100 fields)

// ✅ Use indexed fields in WHERE clause
// Id, Name, RecordTypeId, External IDs, Master-Detail fields
List<Account> accounts = [SELECT Id FROM Account WHERE Name = :searchName];

// ❌ Avoid filtering on formula/unindexed fields
// List<Account> accounts = [SELECT Id FROM Account WHERE FormulaField__c = 'Value'];

// ✅ Use LIMIT to prevent hitting 50,000 record limit
List<Account> accounts = [SELECT Id FROM Account LIMIT 10000];

// ✅ Use FOR loops for large datasets
for(Account acc : [SELECT Id FROM Account]) {
    // Process without heap limit
}
```

### 3. DML Best Practices

```apex
// ✅ Collect records, then single DML
List<Account> accountsToUpdate = new List<Account>();
for(Account acc : accounts) {
    acc.Industry = 'Technology';
    accountsToUpdate.add(acc);
}
update accountsToUpdate;

// ❌ NEVER DML in loop
for(Account acc : accounts) {
    update acc;
}

// ✅ Use Database methods for partial success
Database.SaveResult[] results = Database.update(accounts, false);
for(Database.SaveResult sr : results) {
    if(!sr.isSuccess()) {
        for(Database.Error err : sr.getErrors()) {
            System.debug('Error: ' + err.getMessage());
        }
    }
}
```

### 4. Security Best Practices

```apex
// ✅ Use WITH USER_MODE for user-facing operations
public with sharing class SecureController {
    public List<Account> getAccounts() {
        return [SELECT Id, Name FROM Account WITH USER_MODE];
    }
}

// ✅ Sanitize user input
String userInput = 'O\'Reilly';
String sanitized = String.escapeSingleQuotes(userInput);

// ✅ Use bind variables to prevent SOQL injection
String searchName = userInput;
List<Account> accounts = [
    SELECT Id, Name
    FROM Account
    WHERE Name = :searchName
];

// ❌ NEVER concatenate user input
// String query = 'SELECT Id FROM Account WHERE Name = \'' + userInput + '\'';
```

### 5. Exception Handling Best Practices

```apex
// ✅ Catch specific exceptions first
try {
    // Code
} catch(DmlException e) {
    // Handle DML errors
} catch(QueryException e) {
    // Handle query errors
} catch(Exception e) {
    // Handle all others
}

// ✅ Log errors properly
catch(Exception e) {
    System.debug(LoggingLevel.ERROR, 'Error: ' + e.getMessage());
    System.debug(LoggingLevel.ERROR, 'Stack: ' + e.getStackTraceString());
}

// ✅ Use custom exceptions for business logic
if(!isValid) {
    throw new ValidationException('Invalid data');
}
```

### 6. Code Organization

```apex
// ✅ Use helper classes for shared logic
public class AccountHelper {
    public static void updateIndustry(List<Account> accounts, String industry) {
        for(Account acc : accounts) {
            acc.Industry = industry;
        }
    }
}

// ✅ Keep triggers logic-less
trigger AccountTrigger on Account (before insert) {
    AccountTriggerHandler.beforeInsert(Trigger.new);
}

// ✅ Use constants for magic strings/numbers
public class Constants {
    public static final String DEFAULT_INDUSTRY = 'Technology';
    public static final Integer MAX_RECORDS = 200;
}
```

### 7. Performance Optimization

```apex
// ✅ Use Maps for lookups
Map<Id, Account> accountMap = new Map<Id, Account>([SELECT Id FROM Account]);
Account acc = accountMap.get(someId);  // O(1)

// ❌ Avoid searching Lists
for(Account acc : accountList) {
    if(acc.Id == someId) {  // O(n)
        // Found
    }
}

// ✅ Minimize SOQL queries
// Combine multiple queries into one with subqueries/relationships

// ✅ Use selective queries
// Add WHERE clause to reduce records returned
```

---

### 9. (**!! IMPORTANT**)Dry run and Deployment:

After creation of all required apex classes and LWC components then first do dry run on apex using this command:
`sf project deploy start --dry-run --source-dir force-app/main/default/classes/<classname.cls> --json`
Replace <classname.cls> with the actual classes.

- If got any errors after dry run solve them.
- After successful dry run of apex classes then immediatly proceed with deloyment of apex classes.
  `sf project deploy start --source-dir force-app/main/default/objects/<classname.cls> --json`
- Replace <classname.cls> with the all classes that are created like below format for multiple apex classes deployment:
    # Deploy multiple specific Apex classes in order
    ```
    sf project deploy start --dry-run --source-dir force-app/main/default/objects/MyCustomObject__c --source-dir force-app/main/default/classes/HelperClass.cls --source-dir force-app/main/default/classes/MainService.cls --source-dir force-app/main/default/triggers/AccountTrigger.trigger --json
    ```
- (**!IMPORTANT**)Before Going for LWC first dry-run and deploy Apex Classes.

Deploy only the metadata files and component bundles that were created or modified by the AI — do NOT deploy the entire metadata folder. Deploying the whole folder can introduce unrelated dependencies and cause avoidable deployment failures.

Deployment workflow you should follow every time:

- Verify dependencies: if LWC calls Apex controllers, ensure those Apex classes are deployed.

## Quick Reference: Common Patterns

### Pattern 1: Trigger Handler

```apex
trigger AccountTrigger on Account (before insert, after insert) {
    AccountTriggerHandler.handle();
}

public class AccountTriggerHandler {
    public static void handle() {
        if(Trigger.isBefore && Trigger.isInsert) {
            beforeInsert(Trigger.new);
        }
        if(Trigger.isAfter && Trigger.isInsert) {
            afterInsert(Trigger.new);
        }
    }

    private static void beforeInsert(List<Account> accounts) { }
    private static void afterInsert(List<Account> accounts) { }
}
```

### Pattern 2: Map-Based Bulkification

```apex
// Collect IDs
Set<Id> accountIds = new Set<Id>();
for(Contact con : contacts) {
    accountIds.add(con.AccountId);
}

// Single query
Map<Id, Account> accountMap = new Map<Id, Account>(
    [SELECT Id, Name FROM Account WHERE Id IN :accountIds]
);

// Process with map lookup
for(Contact con : contacts) {
    Account acc = accountMap.get(con.AccountId);
    // Use account
}
```

### Pattern 3: Batch Processing

```apex
public class MyBatch implements Database.Batchable<SObject> {
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator('SELECT Id FROM Account');
    }

    public void execute(Database.BatchableContext bc, List<Account> scope) {
        // Process batch
        update scope;
    }

    public void finish(Database.BatchableContext bc) {
        // Cleanup
    }
}

// Execute
Database.executeBatch(new MyBatch(), 200);
```

### Pattern 4: Queueable with Callouts

```apex
public class CalloutQueueable implements Queueable, Database.AllowsCallouts {
    public void execute(QueueableContext context) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://api.example.com');
        req.setMethod('GET');

        Http http = new Http();
        HttpResponse res = http.send(req);

        // Process response
    }
}

System.enqueueJob(new CalloutQueueable());
```

---

## Summary for AI Context

Apex is Salesforce's **strongly-typed, object-oriented, case-insensitive** server-side language designed for the multi-tenant Salesforce Platform. Key differentiators:

1. **Governor Limits**: Strict resource limits enforced at runtime
2. **Bulkification**: Must process collections, never single records
3. **SOQL/SOSL**: Salesforce-specific query languages
4. **SObject**: Database records as first-class objects
5. **Triggers**: Event-driven code on DML operations
6. **Security**: System mode by default (must explicitly enforce security)
7. **Testing**: 75% code coverage required for production

**For AI systems**: When helping with Apex, always emphasize:

- Bulkification patterns to avoid governor limits
- Security considerations (sharing, FLS, CRUD)
- Best practices for SOQL (no queries in loops)
- Proper test coverage and bulkified test data
- Asynchronous processing for long-running operations

Apex combines Java-like syntax with Salesforce-specific features, requiring constant awareness of the multi-tenant environment's constraints and capabilities.

---

## Governance & Developer Checklist

### Developer Checklist

Before submitting a Pull Request, ensure the following:

- [ ] Naming conventions followed (Variables, Methods, Classes).
- [ ] No SOQL or DML inside loops.
- [ ] Code is bulkified (handles List inputs).
- [ ] Security enforced (`WITH SECURITY_ENFORCED`).
- [ ] No hard-coded IDs (Use Custom Labels/Metadata).
- [ ] Unit tests cover positive, negative, and bulk scenarios.
- [ ] Code formatted/indented correctly.

### Automation Governance

Avoid automation conflicts by adhering to the "One Tool" strategy per object:

| Scenario              | Preferred Tool                                                   |
| --------------------- | ---------------------------------------------------------------- |
| Simple Field Updates  | Record-Triggered Flow (Fast Field Update)                        |
| Cross-Object Logic    | Record-Triggered Flow                                            |
| Complex Logic / Loops | Apex Trigger + Handler                                           |
| **Conflict Rule**     | Do Not Mix Flow and Apex Triggers on the same event if possible. |

---

**End of Apex Reference Guide with Integrated Coding Standards**
