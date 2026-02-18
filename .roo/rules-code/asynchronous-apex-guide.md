# Asynchronous Apex Comprehensive Guide

## Overview

Asynchronous Apex allows you to run processes in the background with higher governor limits while improving user experience by freeing up resources. Salesforce provides multiple ways to run code asynchronously, each suited for different use cases.

---

## Table of Contents

1. [When to Use Async Apex](#when-to-use-async-apex)
2. [Future Methods](#future-methods)
3. [Queueable Apex](#queueable-apex)
4. [Batch Apex](#batch-apex)
5. [Scheduled Apex](#scheduled-apex)
6. [Governor Limits Comparison](#governor-limits-comparison)
7. [Async Apex Patterns & Best Practices](#async-apex-patterns--best-practices)
8. [Error Handling & Monitoring](#error-handling--monitoring)
9. [Common Scenarios](#common-scenarios)

---

## When to Use Async Apex

| Scenario                     | Solution            | Reason                                  |
| ---------------------------- | ------------------- | --------------------------------------- |
| Simple background operation  | Future Methods      | Lightweight, minimal setup              |
| Need to pass complex objects | Queueable Apex      | Supports serializable objects           |
| Chain multiple async jobs    | Queueable Apex      | Built-in chaining support               |
| Process millions of records  | Batch Apex          | Higher heap limits, larger data volumes |
| Run code at specific times   | Scheduled Apex      | Time-based execution                    |
| Make web service callouts    | Future or Queueable | Avoid mixed DML errors                  |
| Bypass DML limits            | Batch Apex          | Separate DML operations                 |
| Need job monitoring          | Queueable or Batch  | Returns job ID, AsyncApexJob tracking   |

---

## Future Methods

**Best for**: Simple asynchronous operations, external callouts, segregating DML operations

### Fundamental Concept

Future methods are static methods marked with `@future` annotation. They execute asynchronously in a separate transaction and have higher governor limits.

### Basic Syntax

```apex
public class FutureExample {

    // Simple future method
    @future
    public static void doSomethingAsync() {
        // Runs asynchronously
        // Has higher governor limits
    }

    // With callouts
    @future(callout=true)
    public static void makeCallout(String endpoint) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod('GET');
        Http http = new Http();
        HttpResponse res = http.send(req);
    }

    // Can pass primitives and collections
    @future
    public static void updateAccounts(List<String> accountIds, String industry) {
        List<Account> accounts = [SELECT Id FROM Account WHERE Id IN :accountIds];
        for(Account acc : accounts) {
            acc.Industry = industry;
        }
        update accounts;
    }
}

// Calling future methods
FutureExample.doSomethingAsync();
FutureExample.makeCallout('https://api.example.com/data');
FutureExample.updateAccounts(new List<String>{'001xx000003DHP'}, 'Technology');
```

### Key Characteristics

✅ **Advantages**:

- Simplest async solution
- Perfect for simple operations
- Can make callouts with `callout=true`
- Prevents mixed DML errors
- Runs in separate transaction with higher limits

❌ **Limitations**:

- **Must be static** - Cannot be instance method
- **Primitive parameters only** - Cannot pass complex objects (no custom classes)
- **No job monitoring** - Cannot get job ID or track status
- **No chaining** - Cannot call another @future from @future
- **Maximum 50 future calls per transaction** - Can hit callout limits

### When to Use Future Methods

```apex
// ✅ GOOD USE CASES

// 1. Simple background task
@future
public static void sendWelcomeEmail(String email) {
    Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
    mail.setToAddresses(new String[]{ email });
    mail.setSubject('Welcome!');
    mail.setHtmlBody('Welcome to our service!');
    Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail });
}

// 2. External callout (avoids mixed DML)
@future(callout=true)
public static void callExternalAPI(String accountId, String endpoint) {
    Account acc = [SELECT Id, Name FROM Account WHERE Id = :accountId];

    Http http = new Http();
    HttpRequest req = new HttpRequest();
    req.setEndpoint(endpoint);
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setBody(JSON.serialize(new Map<String, String>{'account' => acc.Name}));

    HttpResponse res = http.send(req);
    System.debug('Response: ' + res.getBody());
}

// 3. Bypass DML operation limits
@future
public static void bulkUpdateRecords(List<Id> recordIds) {
    List<Account> accounts = [SELECT Id, Description FROM Account WHERE Id IN :recordIds];
    for(Account acc : accounts) {
        acc.Description = 'Updated async';
    }
    update accounts;
}
```

---

## Queueable Apex

**Best for**: Complex async operations, passing objects, chaining jobs, monitoring

### Fundamental Concept

Queueable Apex implements the `Queueable` interface and adds jobs to an async queue. It's an enhanced version of future methods supporting complex parameters and chaining.

### Basic Syntax

```apex
public class QueueableExample implements Queueable {

    private List<Account> accounts;
    private String industry;

    // Constructor to pass parameters
    public QueueableExample(List<Account> accounts, String industry) {
        this.accounts = accounts;
        this.industry = industry;
    }

    // Execute method called when job runs
    public void execute(QueueableContext context) {
        // Process accounts
        for(Account acc : accounts) {
            acc.Industry = industry;
        }
        update accounts;

        // Optional: Chain another queueable job
        System.enqueueJob(new AnotherQueueable(accounts));
    }
}

// Enqueuing and monitoring
List<Account> accounts = [SELECT Id, Industry FROM Account LIMIT 100];
Id jobId = System.enqueueJob(new QueueableExample(accounts, 'Technology'));

// Monitor the job
AsyncApexJob job = [
    SELECT Id, Status, NumberOfErrors
    FROM AsyncApexJob
    WHERE Id = :jobId
];
System.debug('Job Status: ' + job.Status);
```

### Advanced Features

#### 1. Passing Complex Objects

```apex
public class ProcessCustomData implements Queueable {

    private List<Case> cases;
    private Map<String, String> configMap;
    private ProcessingConfig config;

    public ProcessCustomData(List<Case> cases, ProcessingConfig config) {
        this.cases = cases;
        this.config = config;
    }

    public void execute(QueueableContext context) {
        for(Case c : cases) {
            c.Status = config.defaultStatus;
            c.Priority = config.defaultPriority;
        }
        update cases;
    }
}

// Custom class (must be serializable)
public class ProcessingConfig {
    public String defaultStatus { get; set; }
    public String defaultPriority { get; set; }
    public Integer retryCount { get; set; }
}
```

#### 2. Chaining Queueable Jobs

```apex
public class ChainedQueueable1 implements Queueable {
    private List<Account> accounts;

    public ChainedQueueable1(List<Account> accounts) {
        this.accounts = accounts;
    }

    public void execute(QueueableContext context) {
        // Step 1: Update accounts
        for(Account acc : accounts) {
            acc.Industry = 'Technology';
        }
        update accounts;

        // Step 2: Chain next job (max 1 enqueued job per execute)
        System.enqueueJob(new ChainedQueueable2(accounts));
    }
}

public class ChainedQueueable2 implements Queueable {
    private List<Account> accounts;

    public ChainedQueueable2(List<Account> accounts) {
        this.accounts = accounts;
    }

    public void execute(QueueableContext context) {
        // Step 2: Process related records
        List<Contact> contacts = [SELECT Id FROM Contact WHERE AccountId IN (
            SELECT Id FROM Account WHERE Id IN :accounts
        )];

        // Can continue chaining...
        System.enqueueJob(new ChainedQueueable3(contacts));
    }
}
```

#### 3. Making Callouts from Queueable

```apex
public class QueueableWithCallout implements Queueable, Database.AllowsCallouts {

    private String endpoint;
    private String payload;

    public QueueableWithCallout(String endpoint, String payload) {
        this.endpoint = endpoint;
        this.payload = payload;
    }

    public void execute(QueueableContext context) {
        Http http = new Http();
        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(payload);
        req.setTimeout(120000);

        try {
            HttpResponse res = http.send(req);
            System.debug('Response: ' + res.getBody());
        } catch (Exception e) {
            System.debug('Error: ' + e.getMessage());
        }
    }
}

// Enqueue with callouts
String payload = JSON.serialize(new Map<String, Object>{'data' => 'value'});
System.enqueueJob(new QueueableWithCallout('https://api.example.com/endpoint', payload));
```

### Queueable Advantages Over @future

| Feature         | @future | Queueable          |
| --------------- | ------- | ------------------ |
| Complex objects | ❌ No   | ✅ Yes             |
| Job monitoring  | ❌ No   | ✅ Yes             |
| Chaining        | ❌ No   | ✅ Yes             |
| Job ID access   | ❌ No   | ✅ Yes             |
| Callouts        | ✅ Yes  | ✅ Yes (interface) |
| Static only     | ✅ Yes  | ❌ No (classes)    |

---

## Batch Apex

**Best for**: Processing large volumes of data (millions of records), complex processing logic, jobs that need higher heap memory

### Fundamental Concept

Batch Apex implements `Database.Batchable<SObject>` interface. It processes records in batches, allowing you to process large data volumes while respecting governor limits.

### Basic Syntax

```apex
public class BatchExample implements Database.Batchable<SObject> {

    // START METHOD: Return records to process
    public Database.QueryLocator start(Database.BatchableContext bc) {
        // Return all records to process (can be up to 50M)
        return Database.getQueryLocator([
            SELECT Id, Name, Industry FROM Account
        ]);
    }

    // EXECUTE METHOD: Process each batch
    public void execute(Database.BatchableContext bc, List<SObject> scope) {
        List<Account> accounts = (List<Account>) scope;

        for(Account acc : accounts) {
            acc.Industry = 'Technology';
        }

        update accounts;
    }

    // FINISH METHOD: Cleanup and notifications
    public void finish(Database.BatchableContext bc) {
        AsyncApexJob job = [
            SELECT Id, Status, NumberOfErrors, TotalJobItems, JobItemsProcessed
            FROM AsyncApexJob
            WHERE Id = :bc.getJobId()
        ];

        // Send notification email
        String subject = 'Batch Job ' + bc.getJobId() + ' finished';
        String body = 'Status: ' + job.Status + '\n' +
                      'Items Processed: ' + job.JobItemsProcessed + '\n' +
                      'Errors: ' + job.NumberOfErrors;

        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setToAddresses(new String[]{ UserInfo.getUserEmail() });
        mail.setSubject(subject);
        mail.setPlainTextBody(body);
        Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail });
    }
}

// Execute batch with batch size (default 200, max 2000)
BatchExample batch = new BatchExample();
Id batchId = Database.executeBatch(batch, 200);
```

### Advanced Features

#### 1. Batch with Callouts

```apex
public class BatchWithCallout implements
    Database.Batchable<SObject>,
    Database.AllowsCallouts {

    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator('SELECT Id, Name FROM Account');
    }

    public void execute(Database.BatchableContext bc, List<SObject> scope) {
        for(SObject record : scope) {
            makeCallout(record.Id);
        }
    }

    public void finish(Database.BatchableContext bc) {
        System.debug('Batch finished');
    }

    private void makeCallout(String recordId) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://api.example.com/sync/' + recordId);
        req.setMethod('POST');
        Http http = new Http();
        HttpResponse res = http.send(req);
    }
}
```

#### 2. Stateful Batch (Maintain State Across Executions)

```apex
public class StatefulBatch implements
    Database.Batchable<SObject>,
    Database.Stateful {

    public Integer recordsProcessed = 0;
    public Integer totalErrors = 0;

    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator('SELECT Id FROM Account');
    }

    public void execute(Database.BatchableContext bc, List<SObject> scope) {
        try {
            List<Account> accounts = (List<Account>) scope;
            recordsProcessed += accounts.size();

            for(Account acc : accounts) {
                acc.Description = 'Processed at ' + System.now();
            }
            update accounts;
        } catch (Exception e) {
            totalErrors++;
            System.debug('Error: ' + e.getMessage());
        }
    }

    public void finish(Database.BatchableContext bc) {
        System.debug('Total Records: ' + recordsProcessed);
        System.debug('Total Errors: ' + totalErrors);
    }
}
```

#### 3. Batch Using Iterable Instead of QueryLocator

```apex
public class BatchWithIterable implements Database.Batchable<SObject> {

    public Iterable<SObject> start(Database.BatchableContext bc) {
        // Use custom iterable when QueryLocator is not suitable
        return new AccountIterable();
    }

    public void execute(Database.BatchableContext bc, List<SObject> scope) {
        List<Account> accounts = (List<Account>) scope;
        for(Account acc : accounts) {
            acc.Industry = 'Technology';
        }
        update accounts;
    }

    public void finish(Database.BatchableContext bc) {}
}

// Custom Iterable class
public class AccountIterable implements Iterable<SObject> {
    public Iterator<SObject> iterator() {
        return new AccountIterator();
    }
}

public class AccountIterator implements Iterator<SObject> {
    private List<Account> accounts;
    private Integer index = 0;

    public AccountIteator() {
        this.accounts = [SELECT Id, Name FROM Account];
    }

    public boolean hasNext() {
        return index < accounts.size();
    }

    public SObject next() {
        if (!hasNext()) {
            throw new NoDataFoundException();
        }
        return accounts[index++];
    }
}
```

#### 4. Batch with Database Methods for Partial Success

```apex
public class BatchWithDatabaseMethods implements Database.Batchable<SObject> {

    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator('SELECT Id FROM Account');
    }

    public void execute(Database.BatchableContext bc, List<SObject> scope) {
        List<Account> accounts = (List<Account>) scope;

        for(Account acc : accounts) {
            acc.Industry = 'Technology';
        }

        // Use Database.update for partial success
        List<Database.SaveResult> results = Database.update(accounts, false);

        for(Database.SaveResult result : results) {
            if (!result.isSuccess()) {
                for(Database.Error error : result.getErrors()) {
                    System.debug('Error: ' + error.getMessage());
                }
            }
        }
    }

    public void finish(Database.BatchableContext bc) {}
}
```

### Batch Governor Limits

```apex
// Batch has much higher async limits:
// - Heap size: 6 MB (vs 12 MB sync)
// - CPU time: 60 minutes total per batch job
// - SOQL queries: Can be very large (up to 50M records with Iterable)
// - DML: 5000 + 10000 per batch
// - API calls: 100

// Default batch size: 200 records
// Max batch size: 2000 records
// Larger batch = fewer execute calls but more memory per batch
```

---

## Scheduled Apex

**Best for**: Running code at specific times, daily/weekly maintenance, triggering batch jobs, scheduled reports

### Fundamental Concept

Scheduled Apex implements the `Schedulable` interface. It allows you to schedule code execution at a specific time using cron expressions.

### Basic Syntax

```apex
public class ScheduledExample implements Schedulable {

    public void execute(SchedulableContext sc) {
        // Code runs on schedule

        // Typically used to start batch jobs
        BatchExample batch = new BatchExample();
        Database.executeBatch(batch, 200);
    }
}

// Schedule using cron expression
// Format: 'Seconds Minutes Hours Day_of_month Month Day_of_week Year'
String cronExp = '0 0 2 * * ?';  // Every day at 2 AM
String jobId = System.schedule('Nightly Batch', cronExp, new ScheduledExample());

System.debug('Job scheduled: ' + jobId);
```

### Cron Expression Guide

```apex
// Basic format: second minute hour day month dayOfWeek year

// COMMON EXPRESSIONS:

// Every hour
'0 0 * * * ?'

// Every day at midnight
'0 0 0 * * ?'

// Every day at 2 AM
'0 0 2 * * ?'

// Every Monday at 9 AM
'0 0 9 ? * MON'

// Every business day (Mon-Fri) at 8 AM
'0 0 8 ? * MON-FRI'

// First day of month at midnight
'0 0 0 1 * ?'

// Last day of month at 11 PM
'0 0 23 L * ?'

// Every 15 minutes
'0 */15 * * * ?'

// Every 30 seconds
'*/30 * * * * ?'

// 5 PM every Friday
'0 0 17 ? * FRI'

// Quarterly (first day of Jan, Apr, Jul, Oct at 1 AM)
'0 0 1 1 1,4,7,10 ?'
```

### Advanced Scheduling

#### 1. Stateful Scheduler

```apex
public class StatefulScheduler implements Schedulable, Database.Stateful {

    private Integer executionCount = 0;

    public void execute(SchedulableContext sc) {
        executionCount++;
        System.debug('Execution: ' + executionCount);

        // Run batch job
        BatchExample batch = new BatchExample();
        Database.executeBatch(batch);
    }
}
```

#### 2. Rescheduling Within Scheduler

```apex
public class ReschedulingScheduler implements Schedulable {

    public void execute(SchedulableContext sc) {
        // Do work
        BatchExample batch = new BatchExample();
        Database.executeBatch(batch);

        // Reschedule self
        String cronExp = '0 0 2 * * ?';  // Next day at 2 AM
        System.schedule('Nightly Batch ' + System.now(), cronExp, new ReschedulingScheduler());
    }
}

// Initial schedule
String jobId = System.schedule('Nightly Batch', '0 0 2 * * ?', new ReschedulingScheduler());
```

#### 3. Scheduling with Parameters

```apex
public class ParameterizedScheduler implements Schedulable {

    private String batchType;
    private Integer batchSize;

    public ParameterizedScheduler(String batchType, Integer batchSize) {
        this.batchType = batchType;
        this.batchSize = batchSize;
    }

    public void execute(SchedulableContext sc) {
        if (batchType == 'accounts') {
            Database.executeBatch(new BatchExample(), batchSize);
        } else if (batchType == 'contacts') {
            // Another batch
        }
    }
}

// Schedule with parameters
String jobId = System.schedule(
    'Custom Batch',
    '0 0 2 * * ?',
    new ParameterizedScheduler('accounts', 200)
);
```

#### 4. Managing Scheduled Jobs

```apex
// Get all scheduled jobs
List<CronTrigger> jobs = [
    SELECT Id, CronExpression, NextFireTime, OwnerId, State
    FROM CronTrigger
    WHERE OwnerId = :UserInfo.getUserId()
];

// Abort a scheduled job
System.abortJob(jobId);

// Check if job exists
CronTrigger job = [
    SELECT Id FROM CronTrigger
    WHERE Id = :jobId
];
System.debug('Job still scheduled: ' + (job != null));
```

---

## Governor Limits Comparison

### Synchronous vs Asynchronous

| Governor Limit           | Synchronous | Asynchronous                                        |
| ------------------------ | ----------- | --------------------------------------------------- |
| **Apex CPU time**        | 10 seconds  | 60 seconds (Future/Queueable)<br>60 minutes (Batch) |
| **Database connections** | 100         | 100                                                 |
| **SOQL queries**         | 100         | 100                                                 |
| **SOSL queries**         | 20          | 20                                                  |
| **DML statements**       | 150         | 10,000                                              |
| **Heap size**            | 12 MB       | 6 MB (Future/Queueable)<br>6 MB per batch execution |
| **Callouts**             | 100         | 100                                                 |
| **Streaming API calls**  | 5           | 5                                                   |
| **List batch size**      | N/A         | 200 (default, max 2000)                             |
| **Total batch records**  | N/A         | Unlimited                                           |

### Key Insights

```apex
// ✅ Async increases DML and CPU limits significantly
// - 150 DML → 10,000 DML statements
// - 10 sec → 60 seconds (Future/Queueable) or 60 minutes (Batch)

// ❌ Async reduces heap limit
// - 12 MB → 6 MB per execution

// ✅ Batch allows processing massive datasets
// - Can query and process millions of records
// - Higher CPU time (60 minutes total)
// - Must manage heap carefully with large batch sizes
```

---

## Async Apex Patterns & Best Practices

### 1. Choose the Right Tool

```apex
// ✅ FUTURE METHOD: Simple background task
@future
public static void logAnalytics(String eventType) {
    Analytics__c record = new Analytics__c();
    record.Event_Type__c = eventType;
    record.Timestamp__c = System.now();
    insert record;
}

// ✅ QUEUEABLE: Complex processing with objects
public class ProcessLeads implements Queueable {
    private List<Lead> leads;

    public ProcessLeads(List<Lead> leads) {
        this.leads = leads;
    }

    public void execute(QueueableContext context) {
        // Process leads
    }
}

// ✅ BATCH: Large volume processing
public class UpdateAllAccounts implements Database.Batchable<SObject> {
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator('SELECT Id FROM Account'); // Millions
    }

    public void execute(Database.BatchableContext bc, List<SObject> scope) {}
    public void finish(Database.BatchableContext bc) {}
}

// ✅ SCHEDULED: Trigger batch daily
public class DailyBatchScheduler implements Schedulable {
    public void execute(SchedulableContext sc) {
        Database.executeBatch(new UpdateAllAccounts());
    }
}
```

### 2. Error Handling in Async Context

```apex
public class RobustQueueable implements Queueable {

    private List<Account> accounts;

    public RobustQueueable(List<Account> accounts) {
        this.accounts = accounts;
    }

    public void execute(QueueableContext context) {
        try {
            processAccounts();
        } catch (Exception e) {
            logError('QueueableError', e);
            rethrow(e);  // Allows retry or manual investigation
        }
    }

    private void processAccounts() {
        for(Account acc : accounts) {
            acc.Industry = 'Technology';
        }
        update accounts;
    }

    private void logError(String errorType, Exception e) {
        ErrorLog__c log = new ErrorLog__c();
        log.Type__c = errorType;
        log.Message__c = e.getMessage();
        log.StackTrace__c = e.getStackTraceString();
        log.Timestamp__c = System.now();
        insert log;
    }
}
```

### 3. Monitoring Async Jobs

```apex
public class AsyncJobMonitor {

    // Get all async jobs
    public static List<AsyncApexJob> getAllJobs() {
        return [
            SELECT Id, JobType, Status, NumberOfErrors, AsyncApexJobId
            FROM AsyncApexJob
            ORDER BY CreatedDate DESC
            LIMIT 100
        ];
    }

    // Get job by ID
    public static AsyncApexJob getJobStatus(String jobId) {
        return [
            SELECT Id, Status, NumberOfErrors, TotalJobItems, JobItemsProcessed
            FROM AsyncApexJob
            WHERE Id = :jobId
        ];
    }

    // Check if job failed
    public static Boolean hasJobFailed(String jobId) {
        Integer failedCount = [
            SELECT COUNT()
            FROM AsyncApexJob
            WHERE Id = :jobId AND Status = 'Failed'
        ];
        return failedCount > 0;
    }

    // Get failed batch details
    public static List<ApexLog> getFailedBatchLogs(String jobId) {
        return [
            SELECT Id, LogLength, Request, Operation
            FROM ApexLog
            WHERE AsyncApexJobId = :jobId
            ORDER BY StartTime DESC
        ];
    }
}

// Usage
Id jobId = Database.executeBatch(new BatchExample());
AsyncApexJob job = AsyncJobMonitor.getJobStatus(jobId);
System.debug('Status: ' + job.Status);
System.debug('Items Processed: ' + job.JobItemsProcessed);
System.debug('Errors: ' + job.NumberOfErrors);
```

### 4. Chainable Async Operations

```apex
public class ChainableAsyncFlow {

    // Step 1: Start validation
    public static void initiateFlow() {
        List<Account> accounts = [SELECT Id FROM Account LIMIT 10000];
        System.enqueueJob(new ValidateAccountsJob(accounts));
    }
}

// Job 1: Validate
public class ValidateAccountsJob implements Queueable {
    private List<Account> accounts;

    public ValidateAccountsJob(List<Account> accounts) {
        this.accounts = accounts;
    }

    public void execute(QueueableContext context) {
        List<Account> validAccounts = new List<Account>();
        for(Account acc : accounts) {
            if (acc.Name != null && acc.BillingCity != null) {
                validAccounts.add(acc);
            }
        }

        System.enqueueJob(new EnrichAccountsJob(validAccounts));
    }
}

// Job 2: Enrich
public class EnrichAccountsJob implements Queueable {
    private List<Account> accounts;

    public EnrichAccountsJob(List<Account> accounts) {
        this.accounts = accounts;
    }

    public void execute(QueueableContext context) {
        for(Account acc : accounts) {
            acc.Industry = 'Technology';
            acc.Rating = 'Hot';
        }
        update accounts;

        System.enqueueJob(new NotifyUsersJob(accounts.size()));
    }
}

// Job 3: Notify
public class NotifyUsersJob implements Queueable {
    private Integer processedCount;

    public NotifyUsersJob(Integer processedCount) {
        this.processedCount = processedCount;
    }

    public void execute(QueueableContext context) {
        String subject = 'Account Processing Completed';
        String body = 'Processed ' + processedCount + ' accounts';

        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setSubject(subject);
        mail.setPlainTextBody(body);
        mail.setToAddresses(new String[]{ UserInfo.getUserEmail() });
        Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail });
    }
}
```

---

## Error Handling & Monitoring

### AsyncApexJob Query

```apex
// AsyncApexJob tracks all async executions (Future, Queueable, Batch, Scheduled)
List<AsyncApexJob> jobs = [
    SELECT
        Id,
        ApexClassId,
        Status,
        JobType,
        CreatedDate,
        CompletedDate,
        MethodName,
        NumberOfErrors,
        JobItemsProcessed,
        TotalJobItems,
        ExtendedStatus
    FROM AsyncApexJob
    WHERE CreatedDate = TODAY
    ORDER BY CreatedDate DESC
];

for(AsyncApexJob job : jobs) {
    System.debug('Job: ' + job.JobType);
    System.debug('Status: ' + job.Status);  // 'Queued', 'Processing', 'Completed', 'Failed', 'Aborted'
    System.debug('Errors: ' + job.NumberOfErrors);
}
```

### Retry Patterns

```apex
// Pattern 1: Manual retry with counter
public class RetryableQueueable implements Queueable {

    private List<Account> accounts;
    private Integer retryCount = 0;
    private static final Integer MAX_RETRIES = 3;

    public RetryableQueueable(List<Account> accounts, Integer retryCount) {
        this.accounts = accounts;
        this.retryCount = retryCount;
    }

    public void execute(QueueableContext context) {
        try {
            processAccounts();
        } catch (Exception e) {
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                System.enqueueJob(new RetryableQueueable(accounts, retryCount));
            } else {
                logFatalError(e);
            }
        }
    }

    private void processAccounts() {
        for(Account acc : accounts) {
            acc.Industry = 'Technology';
        }
        update accounts;
    }

    private void logFatalError(Exception e) {
        System.debug('Max retries exceeded: ' + e.getMessage());
    }
}

// Usage
System.enqueueJob(new RetryableQueueable(accounts, 0));
```

---

## Common Scenarios

### Scenario 1: Send Emails Without Blocking User

**Use Case**: User submits form, need to send confirmation email

**Solution**: Use @future with callout=true

```apex
public class FormHandler {
    public static void handleSubmission(Map<String, String> formData) {
        // Process form synchronously
        Contact contact = new Contact();
        contact.FirstName = formData.get('firstName');
        contact.LastName = formData.get('lastName');
        contact.Email = formData.get('email');
        insert contact;

        // Send email async
        sendConfirmationEmail(contact.Email);
    }

    @future(callout=true)
    private static void sendConfirmationEmail(String email) {
        // Can make callouts
        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setToAddresses(new String[]{ email });
        mail.setSubject('Form Submitted');
        mail.setHtmlBody('Thank you for submitting!');
        Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail });
    }
}
```

### Scenario 2: Bulk Update Millions of Records

**Use Case**: Annual cleanup job processing 10M+ records

**Solution**: Use Batch Apex

```apex
public class AnnualAccountCleanup implements Database.Batchable<SObject>, Database.Stateful {

    public Integer recordsUpdated = 0;
    public Integer recordsSkipped = 0;

    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(
            'SELECT Id, LastModifiedDate FROM Account WHERE LastModifiedDate < LAST_N_DAYS:365'
        );
    }

    public void execute(Database.BatchableContext bc, List<SObject> scope) {
        List<Account> accounts = (List<Account>) scope;
        List<Account> toUpdate = new List<Account>();

        for(Account acc : accounts) {
            if (shouldCleanup(acc)) {
                acc.Description = 'Cleaned up: ' + System.now();
                toUpdate.add(acc);
                recordsUpdated++;
            } else {
                recordsSkipped++;
            }
        }

        if (!toUpdate.isEmpty()) {
            update toUpdate;
        }
    }

    public void finish(Database.BatchableContext bc) {
        AsyncApexJob job = [
            SELECT Id, Status FROM AsyncApexJob WHERE Id = :bc.getJobId()
        ];

        String subject = 'Annual Cleanup Complete';
        String body = 'Updated: ' + recordsUpdated + '\nSkipped: ' + recordsSkipped;

        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setToAddresses(new String[]{ UserInfo.getUserEmail() });
        mail.setSubject(subject);
        mail.setPlainTextBody(body);
        Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail });
    }

    private Boolean shouldCleanup(Account acc) {
        return acc.LastModifiedDate < (System.now() - 365);
    }
}

// Schedule to run once per year
public class AnnualCleanupScheduler implements Schedulable {
    public void execute(SchedulableContext sc) {
        // Run on Jan 1st at 2 AM
        Database.executeBatch(new AnnualAccountCleanup(), 2000);
    }
}

// Initial schedule
String jobId = System.schedule(
    'Annual Account Cleanup',
    '0 0 2 1 1 ?',
    new AnnualCleanupScheduler()
);
```

### Scenario 3: Complex Multi-Step Data Processing

**Use Case**: Data migration with validation, transformation, and notification

**Solution**: Chain Queueable jobs

```apex
// Entry point
public class DataMigrationController {
    public static void startMigration() {
        List<LegacyData__c> legacyData = [SELECT Id, ExternalId__c, Data__c FROM LegacyData__c];
        System.enqueueJob(new ValidateLegacyDataJob(legacyData));
    }
}

// Job 1: Validate
public class ValidateLegacyDataJob implements Queueable {
    private List<LegacyData__c> data;

    public ValidateLegacyDataJob(List<LegacyData__c> data) {
        this.data = data;
    }

    public void execute(QueueableContext context) {
        List<LegacyData__c> validData = new List<LegacyData__c>();

        for(LegacyData__c record : data) {
            if (isValid(record)) {
                validData.add(record);
            }
        }

        System.enqueueJob(new TransformDataJob(validData));
    }

    private Boolean isValid(LegacyData__c record) {
        return String.isNotBlank(record.ExternalId__c) && String.isNotBlank(record.Data__c);
    }
}

// Job 2: Transform
public class TransformDataJob implements Queueable {
    private List<LegacyData__c> data;

    public TransformDataJob(List<LegacyData__c> data) {
        this.data = data;
    }

    public void execute(QueueableContext context) {
        List<Account> newAccounts = new List<Account>();

        for(LegacyData__c record : data) {
            Account acc = new Account();
            acc.Name = record.Data__c;
            acc.ExternalId__c = record.ExternalId__c;
            newAccounts.add(acc);
        }

        insert newAccounts;
        System.enqueueJob(new NotifyMigrationCompleteJob(newAccounts.size()));
    }
}

// Job 3: Notify
public class NotifyMigrationCompleteJob implements Queueable {
    private Integer migratedCount;

    public NotifyMigrationCompleteJob(Integer migratedCount) {
        this.migratedCount = migratedCount;
    }

    public void execute(QueueableContext context) {
        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setToAddresses(new String[]{ UserInfo.getUserEmail() });
        mail.setSubject('Data Migration Complete');
        mail.setPlainTextBody('Successfully migrated ' + migratedCount + ' records');
        Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail });
    }
}
```

---

## Summary Decision Tree

```
START: I need to run code asynchronously

↓ Is it a simple operation?
├─ YES → Only need primitives? → @future (simplest)
│
├─ NO / MAYBE → Need to pass objects?
│   └─ YES → Queueable (complex objects, monitoring)
│
├─ Processing HUGE amounts of data?
│   └─ YES → Batch Apex (millions of records)
│
└─ Need to run at specific times?
    └─ YES → Scheduled Apex (daily/weekly tasks)
```

---

### 10. (**!! IMPORTANT**)Dry run and Deployment:

**Important Notes:**

- All async Apex classes (Future, Queueable, Batch, Scheduled) should be created in `force-app/main/default/classes/`
- (**!IMPORTANT**) Always create corresponding XML metadata files (.cls-meta.xml) for each Apex class file
- (**!IMPORTANT**) Always execute DRY RUN FIRST to validate all changes BEFORE deploying
- After successful dry-run with NO ERRORS, then immediately deploy to production

---

#### Step 1: Run DRY RUN (REQUIRED - Do NOT skip this step!)

**For Single Async Apex Class:**

```
sf project deploy start --dry-run --source-dir force-app/main/default/classes/ClassName.cls --json
```

**For Multiple Async Apex Classes:**

```
sf project deploy start --dry-run --source-dir force-app/main/default/classes/FutureEmailService.cls --source-dir force-app/main/default/classes/DataProcessingQueueable.cls --source-dir force-app/main/default/classes/BatchDataProcessor.cls --source-dir force-app/main/default/classes/DailyReportScheduler.cls --json
```

**Wait for the response and check:**

- If deployment has **SUCCESS** status → proceed to Step 2 (Deployment)
- If deployment has **ERRORS** → fix the errors in your code and re-run dry-run again

---

#### Step 2: Deploy ONLY after successful DRY RUN

**For Single Async Apex Class:**

```
sf project deploy start --source-dir force-app/main/default/classes/ClassName.cls --json
```

**For Multiple Async Apex Classes (same order as dry-run):**

```
sf project deploy start --source-dir force-app/main/default/classes/FutureEmailService.cls --source-dir force-app/main/default/classes/DataProcessingQueueable.cls --source-dir force-app/main/default/classes/BatchDataProcessor.cls --source-dir force-app/main/default/classes/DailyReportScheduler.cls --json
```

---

#### Deployment Workflow:

1. **Create async Apex classes** (Future, Queueable, Batch, Scheduled)
2. **Create corresponding XML metadata files** (.cls-meta.xml) for each Apex class
3. **Always run DRY RUN FIRST** to validate all changes
4. **Verify dry-run result** — must show SUCCESS status
5. **THEN proceed with actual deployment** using same source-dir parameters (without --dry-run flag)
6. **Monitor deployment** — check for completion and success status
7. **Query AsyncApexJob** after deployment to monitor job execution status

**Important Warnings:**

- Deploy only the metadata files that were created or modified — do NOT deploy the entire metadata folder
- Deploying the whole folder can introduce unrelated dependencies and cause avoidable deployment failures
- Never skip dry-run validation — always run dry-run first before deploying
- (**!IMPORTANT**) Deploy async Apex classes immediately after successful dry-run to ensure all jobs, schedules, and related dependencies are properly registered in your Salesforce org

---

## References

- [Salesforce Async Apex Documentation](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_async_overview.htm)
- [Future Methods Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_invoking_future_methods.htm)
- [Queueable Interface](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_queueing_jobs.htm)
- [Batch Apex Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_batch.htm)
- [Apex Scheduler](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_scheduler.htm)
