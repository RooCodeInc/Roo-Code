# Agentforce Apex Invocable Actions Guide

Quick reference for creating Apex invocable actions for Agentforce agents.

---

## Basic Structure

Every invocable action follows this pattern:

```apex
/**
 * AgentforceAccountAction
 * Description: What this action does
 * Example: Agent asks for account details → calls this action
 */
public with sharing class AgentforceAccountAction {

    @InvocableMethod(label='Get Account Details' description='Retrieves account information')
    public static List<GetAccountResponse> getAccount(List<GetAccountRequest> requests) {
        List<GetAccountResponse> responses = new List<GetAccountResponse>();

        for (GetAccountRequest req : requests) {
            try {
                // Validate input
                if (String.isBlank(req.accountName)) {
                    GetAccountResponse res = new GetAccountResponse();
                    res.success = false;
                    res.message = 'Account name is required';
                    responses.add(res);
                    continue;
                }

                // Query with security enforcement
                List<Account> accounts = [
                    SELECT Id, Name, Industry, Rating, AnnualRevenue
                    FROM Account
                    WHERE Name = :req.accountName
                    WITH USER_MODE
                    LIMIT 1
                ];

                GetAccountResponse res = new GetAccountResponse();
                if (!accounts.isEmpty()) {
                    Account acc = accounts[0];
                    res.accountId = acc.Id;
                    res.name = acc.Name;
                    res.industry = acc.Industry;
                    res.rating = acc.Rating;
                    res.revenue = acc.AnnualRevenue;
                    res.success = true;
                } else {
                    res.success = false;
                    res.message = 'Account not found';
                }
                responses.add(res);

            } catch (Exception e) {
                GetAccountResponse res = new GetAccountResponse();
                res.success = false;
                res.message = 'Error: ' + e.getMessage();
                responses.add(res);
            }
        }
        return responses;
    }

    public class GetAccountRequest {
        @InvocableVariable(required=true label='Account Name' description='The name of the account to retrieve')
        public String accountName;
    }

    public class GetAccountResponse {
        @InvocableVariable(required=false label='Account ID' description='Unique identifier of the account')
        public String accountId;

        @InvocableVariable(required=false label='Account Name' description='Name of the account')
        public String name;

        @InvocableVariable(required=false label='Industry' description='Industry classification of the account')
        public String industry;

        @InvocableVariable(required=false label='Rating' description='Account rating (Hot, Warm, Cold)')
        public String rating;

        @InvocableVariable(required=false label='Annual Revenue' description='Annual revenue amount')
        public Decimal revenue;

        @InvocableVariable(required=false label='Success' description='Whether the action succeeded')
        public Boolean success;

        @InvocableVariable(required=false label='Error Message' description='Error message if action failed')
        public String message;
    }
}
```

## Key Requirements

- ✅ Class must be `public with sharing`
- ✅ Method must be `public static`
- ✅ Input parameter must be `List<RequestClass>`
- ✅ Return type must be `List<ResponseClass>`
- ✅ Must have `@InvocableMethod` decorator
- ✅ **Request class MUST have at least ONE input variable with `@InvocableVariable`**
- ✅ **Response class MUST have at least ONE output variable with `@InvocableVariable`**
- ✅ Use `WITH USER_MODE` in SOQL queries
- ✅ Validate all inputs
- ✅ Handle exceptions in try-catch
- ✅ **Create both Apex class AND corresponding XML metadata file**
- ✅ **InvocableVariable must include 3 parameters: `required`, `label`, `description`**

---

## Annotation Syntax (CRITICAL)

### @InvocableMethod Syntax

**ALWAYS use space to separate parameters:**

```apex
// ✅ CORRECT - Parameters separated by space
@InvocableMethod(label='Get Account Details' description='Retrieves account information')
public static List<GetAccountResponse> getAccount(List<GetAccountRequest> requests) {
```

```apex
// ❌ WRONG - Missing space or added commas
@InvocableMethod(label='Get Account Details', description='Retrieves account information')
```

### @InvocableVariable Syntax

**ALWAYS use space to separate parameters:**

```apex
// ✅ CORRECT - All parameters separated by spaces
@InvocableVariable(required=true label='Account Name' description='The name of the account to retrieve')
public String accountName;
```

```apex
// ❌ WRONG - Missing space or added commas
@InvocableVariable(required=true, label='Account Name', description='The name of the account to retrieve')
public String accountName;
```

**Format Rule:** `parameter=value parameter=value parameter=value` (space between each parameter)

---

## File Creation Locations and XML Metadata

### Apex Class Location

```
force-app/main/default/classes/AgentforceAccountAction.cls
```

### XML Metadata File Location (REQUIRED)

```
force-app/main/default/classes/AgentforceAccountAction.cls-meta.xml
```

### XML Metadata File Content Template

Create the corresponding `.cls-meta.xml` file for every Apex class:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>60.0</apiVersion>
    <status>Active</status>
</ApexClass>
```

**Important**: Both the `.cls` (Apex class) and `.cls-meta.xml` (metadata) files must be created together. The metadata file tells Salesforce about the class configuration.

---

## InvocableVariable Parameters (Required for All Variables)

Every `@InvocableVariable` annotation **MUST** include these 3 parameters **separated by spaces**:

| Parameter     | Type    | Required | Example                                           | Purpose                                                  |
| ------------- | ------- | -------- | ------------------------------------------------- | -------------------------------------------------------- |
| `required`    | Boolean | ✅ Yes   | `required=true`                                   | Marks if input is mandatory or output is always provided |
| `label`       | String  | ✅ Yes   | `label='Account Name'`                            | Display name shown in Agentforce UI and flows            |
| `description` | String  | ✅ Yes   | `description='The name of the account to search'` | Explains what the variable is used for                   |

### Correct Format

```apex
// ✅ Parameters separated by space: required=true label='...' description='...'
@InvocableVariable(required=true label='Search Term' description='The text to search for in account names')
public String searchTerm;
```

### Incorrect Format (Missing Parameters)

```apex
@InvocableVariable  // ❌ WRONG - no parameters
public String searchTerm;

@InvocableVariable(required=true)  // ❌ WRONG - missing label and description
public String searchTerm;
```

---

## Deployment

Deploy your Apex invocable action class using the Salesforce CLI:

```bash
# Deploy a single Apex class
sf project deploy start --source-dir force-app/main/default/classes/AgentforceAccountAction.cls --json
```

### Deploying Multiple Apex Classes

When deploying multiple Apex classes, use this format:

```bash
# Deploy multiple specific Apex classes (replace with actual class names)
sf project deploy start --source-dir force-app/main/default/classes/AgentforceAccountAction.cls force-app/main/default/classes/AgentforceContactAction.cls force-app/main/default/classes/AgentforceOpportunityAction.cls --json
```

**Or deploy all classes at once:**

```bash
# Deploy all Apex classes in the classes directory
sf project deploy start --source-dir force-app/main/default/classes --json
```

---

## Naming Conventions

| Type          | Format                     | Example                           |
| ------------- | -------------------------- | --------------------------------- |
| **Classes**   | `Agentforce<Noun><Action>` | `AgentforceAccountAction`         |
| **Methods**   | `camelCase` with verb      | `getAccount()`, `createContact()` |
| **Requests**  | `<Action>Request`          | `GetAccountRequest`               |
| **Responses** | `<Action>Response`         | `GetAccountResponse`              |
| **Strings**   | `str` prefix               | `strAccountName`                  |
| **Lists**     | `list` prefix              | `listAccounts`                    |
| **Booleans**  | `is/has/should`            | `isSuccess`, `hasError`           |

---

## Common Patterns

### 1. Query/Retrieve Records

Use Pattern 1 from basic structure above (GetAccount example)

### 2. Create Records

```apex
@InvocableMethod(label='Create Contact')
public static List<CreateContactResponse> createContact(List<CreateContactRequest> requests) {
    List<CreateContactResponse> responses = new List<CreateContactResponse>();
    List<Contact> contactsToInsert = new List<Contact>();

    for (CreateContactRequest req : requests) {
        try {
            if (String.isBlank(req.firstName) || String.isBlank(req.lastName)) {
                CreateContactResponse res = new CreateContactResponse();
                res.success = false;
                res.message = 'First and last names required';
                responses.add(res);
                continue;
            }

            Contact contact = new Contact(
                FirstName = req.firstName,
                LastName = req.lastName,
                Email = req.email
            );
            contactsToInsert.add(contact);

        } catch (Exception e) {
            CreateContactResponse res = new CreateContactResponse();
            res.success = false;
            res.message = 'Error: ' + e.getMessage();
            responses.add(res);
        }
    }

    if (!contactsToInsert.isEmpty()) {
        try {
            insert contactsToInsert;
            for (Contact c : contactsToInsert) {
                CreateContactResponse res = new CreateContactResponse();
                res.success = true;
                res.contactId = c.Id;
                responses.add(res);
            }
        } catch (DmlException e) {
            CreateContactResponse res = new CreateContactResponse();
            res.success = false;
            res.message = 'Database error: ' + e.getMessage();
            responses.add(res);
        }
    }
    return responses;
}
```

### 3. Calculate/Transform Data

```apex
@InvocableMethod(label='Calculate Metrics')
public static List<MetricsResponse> calculateMetrics(List<MetricsRequest> requests) {
    List<MetricsResponse> responses = new List<MetricsResponse>();

    for (MetricsRequest req : requests) {
        try {
            String size = req.amount < 50000 ? 'Small' :
                         req.amount < 250000 ? 'Medium' : 'Large';

            MetricsResponse res = new MetricsResponse();
            res.opportunitySize = size;
            res.success = true;
            responses.add(res);
        } catch (Exception e) {
            MetricsResponse res = new MetricsResponse();
            res.success = false;
            res.message = 'Error: ' + e.getMessage();
            responses.add(res);
        }
    }
    return responses;
}
```

### 4. Search Records

```apex
@InvocableMethod(label='Search Accounts')
public static List<SearchResponse> searchAccounts(List<SearchRequest> requests) {
    List<SearchResponse> responses = new List<SearchResponse>();

    for (SearchRequest req : requests) {
        try {
            String pattern = '%' + req.searchTerm + '%';
            List<Account> accounts = [
                SELECT Id, Name, Industry
                FROM Account
                WHERE Name LIKE :pattern
                WITH USER_MODE
                LIMIT 10
            ];

            SearchResponse res = new SearchResponse();
            res.resultCount = accounts.size();
            res.success = true;
            responses.add(res);
        } catch (Exception e) {
            SearchResponse res = new SearchResponse();
            res.success = false;
            res.message = 'Search error: ' + e.getMessage();
            responses.add(res);
        }
    }
    return responses;
}
```

---

## Dynamic SOQL Query Patterns - CRITICAL

### SOQL Bind Variables with Request Wrapper Properties

**⚠️ CRITICAL BUG TO AVOID:**

You CANNOT use request wrapper properties directly in SOQL bind variables.

**❌ WRONG - This will cause compilation errors:**

```apex
@InvocableMethod(label='Search Courses')
public static List<SearchResponse> searchCourses(List<SearchRequest> requests) {
    List<SearchResponse> responses = new List<SearchResponse>();

    for (SearchRequest req : requests) {
        String query = 'SELECT Id, Name FROM Course__c WHERE IsActive = true';

        // ❌ WRONG - Cannot use req.courseLevel directly in bind variable
        if (String.isNotBlank(req.courseLevel)) {
            query += ' AND Course_Level__c = :req.courseLevel';  // ❌ ERROR!
        }

        List<Course__c> courses = Database.query(query);
        // ...
    }
    return responses;
}
```

**Error Message You'll See:**

```
Variable does not exist: req.courseLevel
```

**✅ CORRECT - Create standalone variables first:**

```apex
@InvocableMethod(label='Search Courses')
public static List<SearchResponse> searchCourses(List<SearchRequest> requests) {
    List<SearchResponse> responses = new List<SearchResponse>();

    for (SearchRequest req : requests) {
        // Step 1: Extract values to standalone variables FIRST
        String level = req.courseLevel;
        String category = req.category;
        String department = req.department;

        // Step 2: Build dynamic query
        String query = 'SELECT Id, Name, Course_Level__c FROM Course__c WHERE IsActive = true';

        // Step 3: Use standalone variables in bind syntax
        if (String.isNotBlank(level)) {
            query += ' AND Course_Level__c = :level';  // ✅ CORRECT
        }
        if (String.isNotBlank(category)) {
            query += ' AND Category__c = :category';  // ✅ CORRECT
        }
        if (String.isNotBlank(department)) {
            query += ' AND Department__c = :department';  // ✅ CORRECT
        }

        query += ' WITH USER_MODE LIMIT 10';

        // Step 4: Execute query
        List<Course__c> courses = Database.query(query);

        SearchResponse res = new SearchResponse();
        res.courses = courses;
        res.success = true;
        responses.add(res);
    }
    return responses;
}
```

**Why This Matters:**

- SOQL bind variables (`:variableName`) can only reference standalone variables, NOT object properties
- Using `:req.property` or `:request.field` syntax will cause "Variable does not exist" errors
- Always extract wrapper properties to local variables before using in dynamic SOQL

**The Pattern:**

1. **Extract** all needed values from request wrapper to standalone variables
2. **Build** your dynamic query string
3. **Use** the standalone variables in bind variable syntax (`:variableName`)
4. **Execute** the query with `Database.query()`

**Complete Working Example:**

```apex
public class SearchCoursesRequest {
    @InvocableVariable(required=false label='Course Level' description='Filter by course level')
    public String courseLevel;

    @InvocableVariable(required=false label='Category' description='Filter by category')
    public String category;
}

@InvocableMethod(label='Search Courses')
public static List<SearchResponse> searchCourses(List<SearchCoursesRequest> requests) {
    List<SearchResponse> responses = new List<SearchResponse>();

    for (SearchCoursesRequest req : requests) {
        try {
            // CRITICAL: Extract to standalone variables FIRST
            String level = req.courseLevel;
            String category = req.category;

            // Build query with standalone variable binds
            String query = 'SELECT Id, Name FROM Course__c WHERE IsActive = true';
            if (String.isNotBlank(level)) {
                query += ' AND Course_Level__c = :level';
            }
            if (String.isNotBlank(category)) {
                query += ' AND Category__c = :category';
            }
            query += ' WITH USER_MODE LIMIT 10';

            List<Course__c> courses = Database.query(query);

            SearchResponse res = new SearchResponse();
            res.resultCount = courses.size();
            res.success = true;
            responses.add(res);

        } catch (Exception e) {
            SearchResponse res = new SearchResponse();
            res.success = false;
            res.message = 'Error: ' + e.getMessage();
            responses.add(res);
        }
    }
    return responses;
}
```

---

## Security Requirements (MANDATORY)

```apex
// ✅ DO: Use with sharing
public with sharing class AgentforceAction { }

// ✅ DO: Use WITH USER_MODE in SOQL
List<Account> accounts = [
    SELECT Id, Name FROM Account WITH USER_MODE LIMIT 10
];

// ✅ DO: Validate inputs
if (String.isBlank(req.input)) { return error; }

// ❌ DON'T: Use without sharing
public without sharing class AgentforceAction { }

// ❌ DON'T: Query without WITH USER_MODE
List<Account> accounts = [SELECT Id, Name FROM Account];
```

---

## Error Handling

Always catch exceptions and return error status:

```apex
try {
    // Your logic
    Response res = new Response();
    res.success = true;
    responses.add(res);
} catch (QueryException e) {
    Response res = new Response();
    res.success = false;
    res.message = 'Query error: ' + e.getMessage();
    responses.add(res);
} catch (DmlException e) {
    Response res = new Response();
    res.success = false;
    res.message = 'Database error: ' + e.getMessage();
    responses.add(res);
} catch (Exception e) {
    Response res = new Response();
    res.success = false;
    res.message = 'Error: ' + e.getMessage();
    responses.add(res);
}
```

---

## Response Classes Must Include

```apex
public class ActionResponse {
    @InvocableVariable public Boolean success;  // true/false
    @InvocableVariable public String message;   // Error message if failed
    @InvocableVariable public String resultId;  // Result data if needed
}
```

---

## Deployment Checklist

Before deploying:

- [ ] ✅ Uses `public with sharing`
- [ ] ✅ Uses `WITH USER_MODE` in SOQL
- [ ] ✅ Has error handling (try-catch)
- [ ] ✅ Validates all inputs
- [ ] ✅ Response class has success/message fields
- [ ] ✅ Has JSDoc comments
- [ ] ✅ No hardcoded values
- [ ] ✅ Naming conventions followed

---

## Quick Reference

**Always use Lists**: Input/output are always Lists, even for single items

**Always handle errors**: Return false/error message in response

**Always validate input**: Check for null/empty before processing

**Always use WITH USER_MODE**: Enforces FLS and sharing

---

## Asynchronous Operations

If your Agentforce action needs to perform long-running operations (like processing large datasets, making multiple API calls, or bulk updates), consider using asynchronous Apex patterns instead of synchronous invocable methods.

**📖 For detailed information**: See [asynchronous-apex-guide.md](./asynchronous-apex-guide.md) for:

- When to use Future Methods vs Queueable Apex
- Batch processing patterns
- Job monitoring and error handling
- Invoking async operations from synchronous code

**Common pattern**: Invocable method enqueues an async job

```apex
@InvocableMethod(label='Process Large Dataset')
public static List<ProcessResponse> processLargeDataset(List<ProcessRequest> requests) {
    System.enqueueJob(new LargeDatasetProcessor(requests[0].recordIds));
    return new List<ProcessResponse>{ new ProcessResponse(true, 'Processing started') };
}
```

---

## Resources

- [Invocable Methods Documentation](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_InvocableMethod.htm)
- [Asynchronous Apex Guide](./asynchronous-apex-guide.md)
- [Agentforce Guide](https://developer.salesforce.com/docs/einstein/agentforce)
- [SOQL Reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/)
- [Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/)
